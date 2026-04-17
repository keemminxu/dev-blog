// ---------------------------------------------------------------------------
// Admin editor — Supabase drafts CRUD + GitHub publish
// - body.is-admin일 때만 CSS로 표시 (admin.js가 클래스 토글)
// - 드래프트는 Supabase `drafts` 테이블에 auto-save (2s debounce)
// - 발행 = GitHub API로 _posts/YYYY-MM-DD-{slug}.md 커밋 → Jekyll 자동 재빌드
// ---------------------------------------------------------------------------

(function () {
'use strict';

const SUPABASE_URL = 'https://mnatdbpscbvhhsxstvaq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uYXRkYnBzY2J2aGhzeHN0dmFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDY4MzAsImV4cCI6MjA5MDQ4MjgzMH0.8iItsIbd06Sbi0PSt_4FAVGlEd8YdsTWL3xztszVieE';
const DRAFT_BUCKET = 'draft-images';
const GH_OWNER = 'keemminxu';
const GH_REPO = 'keemminxu.github.io';
const GH_BRANCH = 'main';
const PAT_KEY = 'blog_github_pat';
const AUTOSAVE_MS = 2000;
const PREVIEW_DEBOUNCE_MS = 300;
const MARKED_CDN = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';

let currentDraftId = null;
let autoSaveTimer = null;

// 편집 모드 상태. 발행된 글 수정 시 editingFilename에 원본 파일명 (YYYY-MM-DD-slug.md) 저장
let editingFilename = null;
let customOgUrl = null; // Supabase Storage public URL for 커스텀 OG 이미지

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

function getSession() {
  return window.blogAdmin && window.blogAdmin.getSession();
}

async function supaFetch(path, opts) {
  const session = getSession();
  if (!session) throw new Error('로그인이 필요합니다');
  opts = opts || {};
  const res = await fetch(SUPABASE_URL + path, {
    method: opts.method || 'GET',
    headers: Object.assign({
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + session.accessToken,
      'Content-Type': 'application/json',
    }, opts.headers || {}),
    body: opts.body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.hint || ('HTTP ' + res.status));
  }
  return res.status === 204 ? null : res.json();
}

async function listDrafts() {
  return supaFetch('/rest/v1/drafts?order=updated_at.desc&select=*');
}

async function createDraft(data) {
  const arr = await supaFetch('/rest/v1/drafts', {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  });
  return arr[0];
}

async function updateDraft(id, data) {
  const arr = await supaFetch('/rest/v1/drafts?id=eq.' + id, {
    method: 'PATCH',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify(Object.assign({}, data, { updated_at: new Date().toISOString() })),
  });
  return arr[0];
}

async function deleteDraftById(id) {
  await supaFetch('/rest/v1/drafts?id=eq.' + id, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// GitHub publish
// ---------------------------------------------------------------------------

function getPat(interactive) {
  let pat = localStorage.getItem(PAT_KEY);
  if (!pat && interactive) {
    pat = prompt('GitHub Personal Access Token\n(repo의 Contents: Write 권한 필요)');
    if (pat) localStorage.setItem(PAT_KEY, pat.trim());
  }
  return pat;
}

async function ghListPosts() {
  const url = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/_posts?ref=' + GH_BRANCH;
  const pat = getPat(false);
  const headers = { 'Accept': 'application/vnd.github+json' };
  if (pat) headers['Authorization'] = 'Bearer ' + pat;
  const res = await fetch(url, { headers });
  if (!res.ok) return [];
  const items = await res.json();
  return items.filter(x => x.name && x.name.endsWith('.md')).sort((a, b) => b.name.localeCompare(a.name));
}

async function ghGetFileContent(path) {
  const url = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + GH_BRANCH;
  const pat = getPat(false);
  const headers = { 'Accept': 'application/vnd.github+json' };
  if (pat) headers['Authorization'] = 'Bearer ' + pat;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('파일 가져오기 실패: ' + res.status);
  const data = await res.json();
  const bytes = Uint8Array.from(atob(data.content.replace(/\s/g, '')), c => c.charCodeAt(0));
  const text = new TextDecoder().decode(bytes);
  return { text, sha: data.sha };
}

async function ghDeleteFile(path, message) {
  const pat = getPat(true);
  if (!pat) throw new Error('PAT가 필요합니다');
  // sha 먼저 조회
  let sha;
  try {
    const f = await ghGetFileContent(path);
    sha = f.sha;
  } catch (_) {
    return; // 파일이 이미 없으면 조용히 패스
  }
  const url = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': 'Bearer ' + pat,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, sha, branch: GH_BRANCH }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || ('DELETE 실패 ' + res.status));
  }
}

async function ghPutFile(path, contentB64, message, existingSha) {
  const pat = getPat(true);
  if (!pat) throw new Error('PAT가 필요합니다');

  const url = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + path.split('/').map(encodeURIComponent).join('/');

  const body = { message, content: contentB64, branch: GH_BRANCH };
  if (existingSha) body.sha = existingSha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + pat,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) {
      localStorage.removeItem(PAT_KEY);
      throw new Error('PAT 인증 실패 (401). 토큰을 다시 입력하세요');
    }
    if (res.status === 403) {
      localStorage.removeItem(PAT_KEY);
      throw new Error('PAT 권한 부족 (403: ' + (err.message || 'Resource not accessible') + ').\n\n다음을 확인하세요:\n1. fine-grained PAT인지\n2. Repository access에 keemminxu.github.io 포함\n3. Repository permissions → Contents: Read and write 체크\n\n토큰 캐시를 초기화했으니 다시 발급 후 입력해주세요');
    }
    if (res.status === 422 && /sha/.test(err.message || '') && !existingSha) {
      // 파일이 이미 존재 → sha 받아 재시도
      try {
        const existing = await ghGetFileContent(path);
        return ghPutFile(path, contentB64, message, existing.sha);
      } catch (retryErr) {
        throw new Error('파일이 이미 존재하지만 sha 조회 실패: ' + retryErr.message);
      }
    }
    throw new Error(err.message || ('GitHub API ' + res.status));
  }
  return res.json();
}

function textToBase64(content) {
  const bytes = new TextEncoder().encode(content);
  return bytesToBase64(bytes);
}

function bytesToBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer();
  return bytesToBase64(new Uint8Array(buf));
}

async function publishToGitHub(filename, content, message) {
  return ghPutFile('_posts/' + filename, textToBase64(content), message);
}

// ---------------------------------------------------------------------------
// Markdown / frontmatter
// ---------------------------------------------------------------------------

function yamlString(s) {
  // 간단 YAML 문자열 — 따옴표 이스케이프
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function buildMarkdown(form) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
             + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds())
             + ' +0900';

  const lines = ['---'];
  lines.push('layout: post');
  lines.push('title: ' + yamlString(form.title));
  if (form.title_en) lines.push('title_en: ' + yamlString(form.title_en));
  lines.push('date: ' + date);
  if (form.categories && form.categories.length) {
    lines.push('categories: [' + form.categories.map(yamlString).join(', ') + ']');
  }
  if (form.tags && form.tags.length) {
    lines.push('tags: [' + form.tags.map(yamlString).join(', ') + ']');
  }
  if (form.excerpt) lines.push('excerpt: ' + yamlString(form.excerpt));
  if (form.excerpt_en) lines.push('excerpt_en: ' + yamlString(form.excerpt_en));
  lines.push('---');
  lines.push('');
  lines.push(form.content);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// OG image generation (Canvas) — scripts/generate_og.py 포팅
// ---------------------------------------------------------------------------

function wrapCanvasText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width <= maxWidth) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function generateOgBlob({ title, tags, date }) {
  const W = 1200, H = 630;
  const PAD = 60;
  const FONT = "'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', -apple-system, BlinkMacSystemFont, sans-serif";

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 배경
  ctx.fillStyle = '#393633';
  ctx.fillRect(0, 0, W, H);

  // 블로그명
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#83A598';
  ctx.font = `20px ${FONT}`;
  ctx.fillText("keem's blog.", PAD, PAD);

  // 액센트 라인
  ctx.strokeStyle = '#83A598';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, PAD + 34);
  ctx.lineTo(W - PAD, PAD + 34);
  ctx.stroke();

  // 제목 (최대 3줄)
  ctx.fillStyle = '#EBDBB2';
  ctx.font = `bold 42px ${FONT}`;
  const lines = wrapCanvasText(ctx, title || 'Untitled', W - PAD * 2);
  const display = lines.slice(0, 3);
  if (lines.length > 3) {
    const last = display[2];
    display[2] = last.length > 3 ? last.slice(0, -3) + '...' : last + '...';
  }
  const LH = 56;
  const totalH = display.length * LH;
  const startY = Math.floor((H - totalH) / 2) - 20;
  display.forEach((line, i) => ctx.fillText(line, PAD, startY + i * LH));

  // 태그 (최대 5개, 하단-좌)
  const tagList = Array.isArray(tags) ? tags.slice(0, 5) : [];
  const tagY = H - PAD - 50;
  let tagX = PAD;
  ctx.font = `18px ${FONT}`;
  for (const t of tagList) {
    const text = '#' + t;
    const tw = ctx.measureText(text).width + 16;
    const th = 30;
    ctx.fillStyle = '#45423E';
    roundRectPath(ctx, tagX, tagY, tw, th, 10);
    ctx.fill();
    ctx.fillStyle = '#A89984';
    ctx.fillText(text, tagX + 8, tagY + 6);
    tagX += tw + 8;
  }

  // 날짜 (하단-우)
  const dateStr = String(date || '').slice(0, 10);
  ctx.font = `16px ${FONT}`;
  ctx.fillStyle = '#A89984';
  const dw = ctx.measureText(dateStr).width;
  ctx.fillText(dateStr, W - PAD - dw, H - PAD - 20);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => b ? resolve(b) : reject(new Error('OG blob 생성 실패')), 'image/png');
  });
}

async function publishOgImage(slug, { title, tags, dateStr }) {
  const blob = await generateOgBlob({ title, tags, date: dateStr });
  const b64 = await blobToBase64(blob);
  return ghPutFile('assets/og/' + slug + '.png', b64, '[OG] ' + slug);
}

// ---------------------------------------------------------------------------
// Image upload (마크다운 에디터 커서 위치에 삽입)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Supabase Storage (draft-images 버킷)
// ---------------------------------------------------------------------------

function getUserIdFromSession() {
  const s = getSession();
  if (!s) return null;
  try {
    const payload = JSON.parse(atob(s.accessToken.split('.')[1]));
    return payload.sub;
  } catch {
    return null;
  }
}

async function uploadToStorage(file) {
  const session = getSession();
  if (!session) throw new Error('로그인이 필요합니다');
  const userId = getUserIdFromSession();
  if (!userId) throw new Error('세션 파싱 실패');

  const ext = file.name && file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : guessExtFromType(file.type);
  const uuid = crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2));
  const path = userId + '/' + uuid + ext;

  const url = SUPABASE_URL + '/storage/v1/object/' + DRAFT_BUCKET + '/' + path;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + session.accessToken,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: file,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || ('Storage 업로드 실패 ' + res.status));
  }
  const publicUrl = SUPABASE_URL + '/storage/v1/object/public/' + DRAFT_BUCKET + '/' + path;
  return { path, publicUrl };
}

async function deleteFromStorage(path) {
  const session = getSession();
  if (!session) return;
  const url = SUPABASE_URL + '/storage/v1/object/' + DRAFT_BUCKET + '/' + path;
  await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + session.accessToken,
    },
  }).catch(() => {});
}

function guessExtFromType(mime) {
  if (!mime) return '.bin';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/svg+xml') return '.svg';
  return '.' + mime.split('/')[1];
}

// ---------------------------------------------------------------------------
// Paste handler — 클립보드 이미지 자동 업로드
// ---------------------------------------------------------------------------

async function handlePasteEvent(e) {
  const items = (e.clipboardData && e.clipboardData.items) || [];
  const imageFiles = [];
  for (const item of items) {
    if (item.kind === 'file' && /^image\//.test(item.type)) {
      const f = item.getAsFile();
      if (f) imageFiles.push(f);
    }
  }
  if (imageFiles.length === 0) return; // 일반 텍스트 paste는 기본 동작 유지

  e.preventDefault();
  const textarea = $('ed-content');
  const statusEl = $('ed-upload-status');

  for (let i = 0; i < imageFiles.length; i++) {
    const f = imageFiles[i];
    try {
      if (statusEl) statusEl.textContent = `paste 업로드 중 (${i + 1}/${imageFiles.length})...`;
      const { publicUrl } = await uploadToStorage(f);
      insertAtCursor(textarea, `\n![](${publicUrl})\n`);
    } catch (err) {
      if (statusEl) statusEl.textContent = 'paste 실패: ' + err.message;
      alert('이미지 paste 실패: ' + err.message);
      return;
    }
  }
  if (statusEl) statusEl.textContent = `paste 완료 (${imageFiles.length}개)`;
  setTimeout(() => { if (statusEl && statusEl.textContent.startsWith('paste 완료')) statusEl.textContent = ''; }, 2500);
}

// ---------------------------------------------------------------------------
// Preview — marked.js lazy-load
// ---------------------------------------------------------------------------

let markedLoader = null;
function ensureMarked() {
  if (window.marked) return Promise.resolve(window.marked);
  if (markedLoader) return markedLoader;
  markedLoader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = MARKED_CDN;
    s.onload = () => resolve(window.marked);
    s.onerror = () => reject(new Error('marked.js 로드 실패'));
    document.head.appendChild(s);
  });
  return markedLoader;
}

let previewTimer = null;
async function renderPreview() {
  const preview = $('ed-preview');
  const textarea = $('ed-content');
  if (!preview || !textarea) return;
  try {
    await ensureMarked();
    preview.innerHTML = window.marked.parse(textarea.value || '');
  } catch (e) {
    preview.innerHTML = '<p style="color:#e76060">preview 렌더 실패: ' + (e.message || e) + '</p>';
  }
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, PREVIEW_DEBOUNCE_MS);
}

function togglePreview() {
  const ws = $('ed-workspace');
  if (!ws) return;
  const off = ws.classList.toggle('preview-off');
  if (!off) renderPreview();
}

// ---------------------------------------------------------------------------
// Publish 시 Supabase Storage URL → GitHub assets로 이전 + 마크다운 재작성
// ---------------------------------------------------------------------------

function extractDraftImageUrls(content) {
  const prefix = SUPABASE_URL + '/storage/v1/object/public/' + DRAFT_BUCKET + '/';
  const re = new RegExp(prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([\\w\\-\\/\\.]+)', 'g');
  const seen = new Map();
  let m;
  while ((m = re.exec(content)) !== null) {
    const fullUrl = m[0];
    if (!seen.has(fullUrl)) seen.set(fullUrl, m[1]); // path (userId/uuid.ext)
  }
  return Array.from(seen.entries()); // [[url, path], ...]
}

async function migrateImagesToGitHub(content, slug, onProgress) {
  const pairs = extractDraftImageUrls(content);
  const urlMap = new Map();
  for (let i = 0; i < pairs.length; i++) {
    const [oldUrl, path] = pairs[i];
    if (onProgress) onProgress(i + 1, pairs.length);
    // Supabase Storage에서 다운로드 (public URL)
    const imgRes = await fetch(oldUrl);
    if (!imgRes.ok) throw new Error('Storage 이미지 다운로드 실패: ' + path);
    const blob = await imgRes.blob();
    const filename = path.split('/').pop();
    const b64 = await blobToBase64(blob);
    await ghPutFile('assets/images/' + slug + '/' + filename, b64, '[IMG] ' + slug + '/' + filename);
    const newUrl = '/assets/images/' + slug + '/' + filename;
    urlMap.set(oldUrl, newUrl);
  }
  let rewritten = content;
  for (const [oldUrl, newUrl] of urlMap) {
    rewritten = rewritten.split(oldUrl).join(newUrl);
  }
  return { content: rewritten, migratedPaths: pairs.map(([, p]) => p) };
}

// ---------------------------------------------------------------------------
// Category page auto-creation
// - 새 카테고리 쓰면 category/{slug}.html 파일을 자동 커밋
// - 기존 파일 있으면 스킵
// ---------------------------------------------------------------------------

function buildCategoryPageHtml(cat) {
  const title = cat.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return [
    '---',
    'layout: default',
    'title: "Category: ' + title + '"',
    'permalink: /category/' + cat + '/',
    '---',
    '',
    '<div class="category-page">',
    '  {% include category-tabs.html %}',
    '',
    '  <div class="post-list">',
    "    {% assign posts = site.categories['" + cat + "'] %}",
    '    {% if posts and posts.size > 0 %}',
    "      {% assign sorted = posts | sort: 'date' | reverse %}",
    '      {% for post in sorted %}',
    '        {% include post-card.html post=post %}',
    '      {% endfor %}',
    '    {% else %}',
    '      <p class="empty-message">아직 작성된 글이 없습니다.</p>',
    '    {% endif %}',
    '  </div>',
    '</div>',
    '',
  ].join('\n');
}

async function ghListCategories() {
  const url = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/category?ref=' + GH_BRANCH;
  const pat = getPat(false);
  const headers = { 'Accept': 'application/vnd.github+json' };
  if (pat) headers['Authorization'] = 'Bearer ' + pat;
  const res = await fetch(url, { headers });
  if (!res.ok) return [];
  const items = await res.json();
  return items
    .filter(x => x.name && x.name.endsWith('.html'))
    .map(x => x.name.replace(/\.html$/, ''))
    .sort();
}

async function refreshCategoryChips() {
  const box = $('ed-categories-chips');
  if (!box) return;
  try {
    const cats = await ghListCategories();
    box.innerHTML = cats
      .map(c => '<button type="button" class="admin-editor-chip" data-cat="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>')
      .join('');
    box.querySelectorAll('.admin-editor-chip').forEach(btn => {
      btn.addEventListener('click', () => toggleCategoryInInput(btn.dataset.cat));
    });
    updateChipSelectedState();
  } catch (e) {
    console.warn('[admin-editor] category chips 로드 실패:', e);
  }
}

function toggleCategoryInInput(cat) {
  const input = $('ed-categories');
  if (!input) return;
  const cur = input.value.split(',').map(s => s.trim()).filter(Boolean);
  const idx = cur.indexOf(cat);
  if (idx >= 0) cur.splice(idx, 1);
  else cur.push(cat);
  input.value = cur.join(', ');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  updateChipSelectedState();
}

function updateChipSelectedState() {
  const input = $('ed-categories');
  if (!input) return;
  const cur = new Set(input.value.split(',').map(s => s.trim()).filter(Boolean));
  document.querySelectorAll('.admin-editor-chip').forEach(btn => {
    btn.classList.toggle('is-selected', cur.has(btn.dataset.cat));
  });
}

async function ensureCategoryPages(categories, onProgress) {
  const created = [];
  for (let i = 0; i < categories.length; i++) {
    const cat = String(categories[i]).trim();
    if (!cat) continue;
    if (!/^[a-z0-9-]+$/.test(cat)) {
      console.warn('[admin-editor] skip category with invalid chars:', cat);
      continue;
    }
    const path = 'category/' + cat + '.html';
    let exists = true;
    try {
      await ghGetFileContent(path);
    } catch (_) {
      exists = false;
    }
    if (exists) continue;
    if (onProgress) onProgress(created.length + 1, cat);
    const html = buildCategoryPageHtml(cat);
    await ghPutFile(path, textToBase64(html), '[CAT] ' + cat);
    created.push(cat);
  }
  return created;
}

// ---------------------------------------------------------------------------
// Frontmatter parser — 발행된 글 수정용 (flow YAML 제한 지원)
// ---------------------------------------------------------------------------

function parseFrontmatter(md) {
  const m = String(md).match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: md };
  const fmText = m[1];
  const body = m[2];
  const fm = {};
  const lines = fmText.split(/\r?\n/);
  for (const line of lines) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let raw = kv[2].trim();
    if (raw === '') { fm[key] = ''; continue; }
    if (raw.startsWith('[') && raw.endsWith(']')) {
      fm[key] = raw.slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      fm[key] = raw.slice(1, -1).replace(/\\"/g, '"');
    } else {
      fm[key] = raw;
    }
  }
  return { fm, body };
}

// ---------------------------------------------------------------------------
// 발행된 글 조회/로드
// ---------------------------------------------------------------------------

function filenameToSlug(filename) {
  // YYYY-MM-DD-slug.md → slug
  return filename.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
}

async function loadPublishedPost(filename) {
  setStatus('발행 글 불러오는 중...');
  try {
    const { text } = await ghGetFileContent('_posts/' + filename);
    const { fm, body } = parseFrontmatter(text);
    const slug = filenameToSlug(filename);
    loadForm({
      title: fm.title || '',
      title_en: fm.title_en || '',
      slug: slug,
      categories: Array.isArray(fm.categories) ? fm.categories : (fm.categories ? [fm.categories] : []),
      tags: Array.isArray(fm.tags) ? fm.tags : (fm.tags ? [fm.tags] : []),
      excerpt: fm.excerpt || '',
      excerpt_en: fm.excerpt_en || '',
      content: body,
    });
    editingFilename = filename;
    currentDraftId = null;
    customOgUrl = null;
    updateOgPreview();
    setStatus('발행 글 편집 모드: ' + slug);
    renderPreview();
    updateEditingModeUI();
  } catch (e) {
    setStatus('글 불러오기 실패: ' + e.message);
    alert('글 불러오기 실패: ' + e.message);
  }
}

function updateEditingModeUI() {
  const panel = $('admin-editor-modal');
  if (!panel) return;
  panel.classList.toggle('mode-editing-post', !!editingFilename);
  // 버튼 라벨 동적 변경
  const delBtn = $('ed-delete');
  const pubBtn = $('ed-publish');
  if (editingFilename) {
    if (delBtn) delBtn.textContent = '🗑 발행글 삭제';
    if (pubBtn) pubBtn.textContent = '✏️ 업데이트';
  } else {
    if (delBtn) delBtn.textContent = '드래프트 삭제';
    if (pubBtn) pubBtn.textContent = '📢 발행';
  }
}

// ---------------------------------------------------------------------------
// Custom OG thumbnail
// ---------------------------------------------------------------------------

async function uploadCustomOg(file) {
  try {
    setStatus('OG 썸네일 업로드 중...');
    const { publicUrl } = await uploadToStorage(file);
    customOgUrl = publicUrl;
    updateOgPreview();
    setStatus('OG 썸네일 업로드 완료');
    if (currentDraftId) {
      await updateDraft(currentDraftId, { og_custom_url: publicUrl });
    } else {
      // 드래프트 아직 없으면 다음 auto-save에 포함됨
    }
  } catch (e) {
    setStatus('OG 업로드 실패: ' + e.message);
    alert('OG 업로드 실패: ' + e.message);
  }
}

function updateOgPreview() {
  const box = $('ed-og-preview');
  if (!box) return;
  if (customOgUrl) {
    box.innerHTML = '<img src="' + customOgUrl + '" alt="OG"><button type="button" id="ed-og-remove" class="admin-editor-btn-danger">제거</button>';
    const removeBtn = $('ed-og-remove');
    if (removeBtn) removeBtn.addEventListener('click', () => {
      customOgUrl = null;
      updateOgPreview();
      if (currentDraftId) updateDraft(currentDraftId, { og_custom_url: null }).catch(() => {});
    });
  } else {
    box.innerHTML = '<div class="admin-editor-og-placeholder">자동 생성 (발행 시 제목/태그로 생성)</div>';
  }
}

// ---------------------------------------------------------------------------
// Existing helpers
// ---------------------------------------------------------------------------

function sanitizeFilename(name) {
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
  const base = (dot >= 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (base || 'image-' + Date.now()) + ext;
}

function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const value = textarea.value;
  textarea.value = value.slice(0, start) + text + value.slice(end);
  const pos = start + text.length;
  textarea.selectionStart = textarea.selectionEnd = pos;
  textarea.focus();
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

async function uploadImages(files) {
  const slugEl = $('ed-slug');
  let slug = slugEl.value.trim();
  if (!slug) {
    const title = $('ed-title').value.trim();
    if (title) {
      slug = slugify(title);
      slugEl.value = slug;
    }
  }
  if (!slug) {
    alert('제목 또는 slug를 먼저 입력하세요');
    return;
  }

  const statusEl = $('ed-upload-status');
  const textarea = $('ed-content');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filename = sanitizeFilename(file.name);
    const path = 'assets/images/' + slug + '/' + filename;
    if (statusEl) statusEl.textContent = `업로드 중 (${i+1}/${files.length}) ${filename}...`;
    try {
      const b64 = await blobToBase64(file);
      await ghPutFile(path, b64, '[IMG] ' + slug + '/' + filename);
      const alt = filename.replace(/\.[^.]+$/, '');
      const md = `\n![${alt}](/${path})\n`;
      insertAtCursor(textarea, md);
    } catch (e) {
      if (statusEl) statusEl.textContent = '업로드 실패: ' + e.message;
      alert('업로드 실패: ' + e.message);
      return;
    }
  }
  if (statusEl) statusEl.textContent = `업로드 완료 (${files.length}개)`;
  setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
}

function slugify(s) {
  return String(s).toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

function dateFilenamePrefix() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// ---------------------------------------------------------------------------
// Form serialization
// ---------------------------------------------------------------------------

function $(id) { return document.getElementById(id); }

function serializeForm() {
  const split = (s) => s.split(',').map(x => x.trim()).filter(Boolean);
  return {
    title: $('ed-title').value.trim(),
    title_en: $('ed-title-en').value.trim(),
    slug: $('ed-slug').value.trim(),
    categories: split($('ed-categories').value),
    tags: split($('ed-tags').value),
    excerpt: $('ed-excerpt').value.trim(),
    excerpt_en: $('ed-excerpt-en').value.trim(),
    content: $('ed-content').value,
  };
}

function loadForm(data) {
  data = data || {};
  $('ed-title').value = data.title || '';
  $('ed-title-en').value = data.title_en || '';
  $('ed-slug').value = data.slug || '';
  $('ed-categories').value = (data.categories || []).join(', ');
  $('ed-tags').value = (data.tags || []).join(', ');
  $('ed-excerpt').value = data.excerpt || '';
  $('ed-excerpt-en').value = data.excerpt_en || '';
  $('ed-content').value = data.content || '';
  updateChipSelectedState();
}

function setStatus(msg) {
  const el = $('ed-status');
  if (el) el.textContent = msg || '';
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function refreshDraftList() {
  const sel = $('ed-draft-select');
  const opts = ['<option value="">+ 새 드래프트</option>'];
  // drafts
  try {
    const drafts = await listDrafts();
    if (drafts.length) {
      opts.push('<optgroup label="📝 드래프트">');
      for (const d of drafts) {
        const label = (d.title || '(제목 없음)') + '  · ' + new Date(d.updated_at).toLocaleString();
        opts.push('<option value="draft:' + d.id + '">' + escapeHtml(label) + '</option>');
      }
      opts.push('</optgroup>');
    }
  } catch (e) {
    console.error('[admin-editor] listDrafts failed:', e);
  }
  // published posts
  try {
    const posts = await ghListPosts();
    if (posts.length) {
      opts.push('<optgroup label="📄 발행된 글">');
      for (const p of posts) {
        opts.push('<option value="post:' + p.name + '">' + escapeHtml(p.name) + '</option>');
      }
      opts.push('</optgroup>');
    }
  } catch (e) {
    console.warn('[admin-editor] ghListPosts failed:', e);
  }
  sel.innerHTML = opts.join('');
  if (currentDraftId) sel.value = 'draft:' + currentDraftId;
  else if (editingFilename) sel.value = 'post:' + editingFilename;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

async function onDraftSelect(e) {
  const val = e.target.value;
  if (!val) {
    currentDraftId = null;
    editingFilename = null;
    customOgUrl = null;
    loadForm({});
    updateOgPreview();
    updateEditingModeUI();
    setStatus('새 드래프트');
    renderPreview();
    return;
  }
  if (val.startsWith('post:')) {
    const filename = val.slice(5);
    await loadPublishedPost(filename);
    return;
  }
  if (val.startsWith('draft:')) {
    const id = val.slice(6);
    try {
      const drafts = await listDrafts();
      const d = drafts.find(x => x.id === id);
      if (!d) return;
      currentDraftId = d.id;
      editingFilename = d.editing_filename || null;
      customOgUrl = d.og_custom_url || null;
      loadForm(d);
      updateOgPreview();
      updateEditingModeUI();
      setStatus(editingFilename ? '편집 중: ' + editingFilename : '드래프트 불러옴');
      renderPreview();
    } catch (err) {
      setStatus('불러오기 실패: ' + err.message);
    }
  }
}

async function saveDraft(silent) {
  const form = serializeForm();
  if (!form.title && !form.content) return;
  if (!form.slug && form.title) {
    form.slug = slugify(form.title);
    $('ed-slug').value = form.slug;
  }
  // 편집 모드 메타 포함
  const payload = Object.assign({}, form, {
    editing_filename: editingFilename || null,
    og_custom_url: customOgUrl || null,
  });
  try {
    if (!silent) setStatus('저장 중...');
    if (currentDraftId) {
      await updateDraft(currentDraftId, payload);
    } else {
      const d = await createDraft(payload);
      currentDraftId = d.id;
    }
    setStatus('저장됨 · ' + new Date().toLocaleTimeString());
    await refreshDraftList();
  } catch (e) {
    setStatus('저장 실패: ' + e.message);
  }
}

function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  setStatus('편집 중...');
  autoSaveTimer = setTimeout(() => saveDraft(true), AUTOSAVE_MS);
}

async function onPublish() {
  const form = serializeForm();
  if (!form.title) { alert('제목은 필수입니다'); return; }
  if (!form.content) { alert('본문은 필수입니다'); return; }
  if (!form.slug) {
    form.slug = slugify(form.title);
    $('ed-slug').value = form.slug;
  }
  if (!/^[a-z0-9가-힣-]+$/.test(form.slug)) {
    alert('slug는 영문소문자/숫자/하이픈만 사용하세요 (한글 가능하지만 영문 권장)');
    return;
  }
  if (!form.categories.length) {
    if (!confirm('카테고리가 비어있습니다. 계속 발행할까요?')) return;
  }

  // 편집 모드면 기존 파일명 유지, 아니면 오늘 날짜로 새 파일
  const filename = editingFilename || (dateFilenamePrefix() + '-' + form.slug + '.md');
  const action = editingFilename ? '업데이트' : '발행';
  if (!confirm(action + '하시겠습니까?\n\n파일: _posts/' + filename)) return;

  try {
    // 1) 본문에 Supabase draft-images URL 있으면 GitHub로 이전 + URL 재작성
    const draftImageCount = extractDraftImageUrls(form.content).length;
    let migratedPaths = [];
    if (draftImageCount > 0) {
      setStatus(`이미지 이전 중... (0/${draftImageCount})`);
      const mig = await migrateImagesToGitHub(form.content, form.slug, (cur, tot) => {
        setStatus(`이미지 이전 중... (${cur}/${tot})`);
      });
      form.content = mig.content;
      migratedPaths = mig.migratedPaths;
      if (currentDraftId) {
        try { await updateDraft(currentDraftId, { content: form.content }); } catch (_) {}
      }
    }

    // 2) 새 카테고리면 카테고리 페이지 자동 생성
    if (form.categories && form.categories.length) {
      setStatus(action + ' 중... (카테고리 페이지 확인)');
      try {
        const createdCats = await ensureCategoryPages(form.categories, (_, cat) => {
          setStatus(action + ' 중... (카테고리 [' + cat + '] 생성)');
        });
        if (createdCats.length) {
          console.log('[admin-editor] created category pages:', createdCats);
        }
      } catch (catErr) {
        console.warn('[admin-editor] 카테고리 페이지 생성 실패:', catErr);
        alert('카테고리 페이지 생성 실패:\n' + catErr.message + '\n\n포스트는 계속 ' + action + '됩니다. 수동으로 category/{name}.html을 만들어주세요.');
      }
    }

    setStatus(action + ' 중... (포스트)');
    const md = buildMarkdown(form);
    // 편집 모드면 기존 sha 조회해서 업데이트, 아니면 신규 create
    let existingSha = null;
    if (editingFilename) {
      try {
        const cur = await ghGetFileContent('_posts/' + filename);
        existingSha = cur.sha;
      } catch (_) { /* 없으면 create */ }
    }
    await ghPutFile('_posts/' + filename, textToBase64(md),
      (editingFilename ? '[UPDATE] ' : '[POST] ') + form.title, existingSha);

    // 2) OG — 커스텀 업로드 있으면 그거 이전, 아니면 자동 생성
    try {
      setStatus(action + ' 중... (OG)');
      const ogPath = 'assets/og/' + form.slug + '.png';
      // 기존 OG sha 조회 (update 위해)
      let ogSha = null;
      try { ogSha = (await ghGetFileContent(ogPath)).sha; } catch (_) {}
      let ogB64;
      if (customOgUrl) {
        const ogRes = await fetch(customOgUrl);
        if (!ogRes.ok) throw new Error('커스텀 OG 다운로드 실패');
        ogB64 = await blobToBase64(await ogRes.blob());
      } else {
        const ogBlob = await generateOgBlob({
          title: form.title,
          tags: form.tags,
          date: dateFilenamePrefix(),
        });
        ogB64 = await blobToBase64(ogBlob);
      }
      await ghPutFile(ogPath, ogB64, '[OG] ' + form.slug, ogSha);
    } catch (ogErr) {
      console.warn('[admin-editor] OG 처리 실패:', ogErr);
      alert('포스트는 ' + action + '됐지만 OG 처리 실패:\n' + ogErr.message);
    }

    setStatus(action + ' 완료');
    if (currentDraftId) {
      try { await deleteDraftById(currentDraftId); } catch (_) {}
      currentDraftId = null;
    }
    for (const p of migratedPaths) deleteFromStorage(p);
    if (customOgUrl) {
      // draft-images에서 커스텀 OG도 정리
      try {
        const prefix = SUPABASE_URL + '/storage/v1/object/public/' + DRAFT_BUCKET + '/';
        if (customOgUrl.startsWith(prefix)) {
          deleteFromStorage(customOgUrl.slice(prefix.length));
        }
      } catch (_) {}
    }
    customOgUrl = null;
    editingFilename = null;
    updateEditingModeUI();
    updateOgPreview();
    alert(action + ' 완료!\n\n1~2분 후 사이트에 반영됩니다.');
    loadForm({});
    await refreshDraftList();
  } catch (e) {
    setStatus(action + ' 실패');
    alert(action + ' 실패: ' + e.message);
  }
}

async function onDeleteDraft() {
  // 편집 모드 (발행된 글)이면 GitHub 파일 삭제
  if (editingFilename) {
    const slug = filenameToSlug(editingFilename);
    if (!confirm('🚨 발행된 글을 삭제합니다\n\n' + editingFilename + '\n+ assets/og/' + slug + '.png\n\n진행할까요? (assets/images/' + slug + '/ 폴더는 수동 정리)')) return;
    try {
      setStatus('삭제 중... (포스트)');
      await ghDeleteFile('_posts/' + editingFilename, '[DEL] ' + editingFilename);
      try {
        setStatus('삭제 중... (OG)');
        await ghDeleteFile('assets/og/' + slug + '.png', '[DEL] OG ' + slug);
      } catch (_) {}
      // 해당 draft가 있으면 같이 삭제
      if (currentDraftId) {
        try { await deleteDraftById(currentDraftId); } catch (_) {}
        currentDraftId = null;
      }
      editingFilename = null;
      customOgUrl = null;
      updateEditingModeUI();
      updateOgPreview();
      loadForm({});
      await refreshDraftList();
      setStatus('삭제 완료');
      alert('발행된 글 삭제 완료.\n\n1~2분 후 사이트에 반영됩니다.');
    } catch (e) {
      setStatus('삭제 실패');
      alert('삭제 실패: ' + e.message);
    }
    return;
  }

  // 일반 드래프트 삭제
  if (!currentDraftId) {
    loadForm({});
    return;
  }
  if (!confirm('이 드래프트를 삭제할까요?')) return;
  try {
    await deleteDraftById(currentDraftId);
    currentDraftId = null;
    customOgUrl = null;
    updateOgPreview();
    loadForm({});
    await refreshDraftList();
    setStatus('삭제됨');
  } catch (e) {
    alert('삭제 실패: ' + e.message);
  }
}

function openEditor() {
  if (!getSession()) {
    alert('로그인이 필요합니다');
    return;
  }
  const modal = $('admin-editor-modal');
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('admin-editor-open');
  refreshDraftList();
  refreshCategoryChips();
  // preview 초기 렌더 (marked.js lazy-load 트리거)
  renderPreview();
}

function closeEditor() {
  const modal = $('admin-editor-modal');
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('admin-editor-open');
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init() {
  if (!$('admin-editor-btn')) return;

  $('admin-editor-btn').addEventListener('click', openEditor);
  $('ed-close').addEventListener('click', closeEditor);
  $('ed-save').addEventListener('click', () => saveDraft(false));
  $('ed-publish').addEventListener('click', onPublish);
  $('ed-delete').addEventListener('click', onDeleteDraft);
  $('ed-draft-select').addEventListener('change', onDraftSelect);

  // PAT 재설정
  const resetPatBtn = $('ed-reset-pat');
  if (resetPatBtn) {
    resetPatBtn.addEventListener('click', () => {
      const cur = localStorage.getItem(PAT_KEY);
      const msg = cur
        ? '현재 저장된 GitHub PAT을 지울까요?\n다음 발행/업로드 시 다시 입력하게 됩니다'
        : '저장된 PAT이 없습니다. 새로 입력할까요?';
      if (!confirm(msg)) return;
      localStorage.removeItem(PAT_KEY);
      const pat = prompt('GitHub Personal Access Token (fine-grained, Contents: Write)');
      if (pat) {
        localStorage.setItem(PAT_KEY, pat.trim());
        setStatus('PAT 저장됨');
      } else {
        setStatus('PAT 초기화됨');
      }
    });
  }

  // 이미지 업로드
  const uploadBtn = $('ed-upload-image');
  const imageInput = $('ed-image-input');
  if (uploadBtn && imageInput) {
    uploadBtn.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      await uploadImages(files);
      e.target.value = '';
    });
  }

  // OG 썸네일 업로드
  const ogBtn = $('ed-upload-og');
  const ogInput = $('ed-og-input');
  if (ogBtn && ogInput) {
    ogBtn.addEventListener('click', () => ogInput.click());
    ogInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) await uploadCustomOg(file);
      e.target.value = '';
    });
  }
  updateOgPreview();

  const inputs = ['ed-title', 'ed-title-en', 'ed-slug', 'ed-categories', 'ed-tags', 'ed-excerpt', 'ed-excerpt-en', 'ed-content'];
  for (const id of inputs) {
    const el = $(id);
    if (el) el.addEventListener('input', scheduleAutoSave);
  }

  // 카테고리 input 변경 시 칩 선택 상태 동기화
  const catInput = $('ed-categories');
  if (catInput) catInput.addEventListener('input', updateChipSelectedState);

  // 본문 변경 시 preview 렌더
  const contentEl = $('ed-content');
  if (contentEl) {
    contentEl.addEventListener('input', schedulePreview);
    contentEl.addEventListener('paste', handlePasteEvent);
  }

  // preview 토글
  const togglePreviewBtn = $('ed-toggle-preview');
  if (togglePreviewBtn) togglePreviewBtn.addEventListener('click', togglePreview);

  // title → slug 자동 반영 (slug 비어있거나 이전 title의 slugify 결과와 같을 때만)
  const titleEl = $('ed-title');
  const slugEl = $('ed-slug');
  titleEl.addEventListener('input', () => {
    const prev = titleEl.dataset.prev || '';
    const prevSlug = slugify(prev);
    if (!slugEl.value || slugEl.value === prevSlug) {
      slugEl.value = slugify(titleEl.value);
    }
    titleEl.dataset.prev = titleEl.value;
  });

  // ESC로 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('admin-editor-modal').classList.contains('is-open')) {
      closeEditor();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
