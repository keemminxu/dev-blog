// ---------------------------------------------------------------------------
// Admin login via Supabase Auth
// - footer copyright 5연타 → 비밀번호 prompt → signInWithPassword
// - 세션은 Supabase가 발급한 JWT를 localStorage에 저장 (SDK 없이 REST 직접 호출)
// - 로그인 상태는 body.is-admin 클래스로 노출 → 다른 UI가 CSS/JS로 읽어갈 수 있음
// ---------------------------------------------------------------------------

(function () {
'use strict';

const SUPABASE_URL = 'https://mnatdbpscbvhhsxstvaq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uYXRkYnBzY2J2aGhzeHN0dmFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDY4MzAsImV4cCI6MjA5MDQ4MjgzMH0.8iItsIbd06Sbi0PSt_4FAVGlEd8YdsTWL3xztszVieE';
const ADMIN_EMAIL = 'cuzziman@gmail.com';

const SESSION_KEY = 'blog_admin_session';
const CLICK_THRESHOLD = 4;
const CLICK_WINDOW_MS = 2500;   // 연타 인정 제한 시간

let clickCount = 0;
let clickTimer = null;

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.accessToken) return null;
    if (s.expiresAt && Date.now() >= s.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function saveSession(data) {
  const session = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
    email: data.user && data.user.email,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function isAdmin() {
  return readSession() !== null;
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  updateAdminUI();
}

async function login(password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.msg || err.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  saveSession(data);
  updateAdminUI();
}

async function promptLogin() {
  if (isAdmin()) {
    if (confirm('이미 로그인 상태입니다. 로그아웃 하시겠습니까?')) logout();
    return;
  }
  const password = prompt('로그인 금지!');
  if (!password) return;
  try {
    await login(password);
    alert('로그인 성공');
  } catch (e) {
    alert('로그인 실패: ' + e.message);
  }
}

function updateAdminUI() {
  document.body.classList.toggle('is-admin', isAdmin());
}

function handleTriggerClick() {
  clickCount += 1;
  clearTimeout(clickTimer);
  clickTimer = setTimeout(() => { clickCount = 0; }, CLICK_WINDOW_MS);
  if (clickCount >= CLICK_THRESHOLD) {
    clickCount = 0;
    clearTimeout(clickTimer);
    promptLogin();
  }
}

function init() {
  updateAdminUI();
  const trigger = document.getElementById('admin-trigger');
  if (trigger) {
    trigger.addEventListener('click', handleTriggerClick);
    // 선택 방지 — 연타 시 텍스트 드래그로 선택되는 불편함 제거
    trigger.style.userSelect = 'none';
    trigger.style.cursor = 'default';
  }
}

// 외부에서도 상태 확인/로그아웃 가능하도록 전역 노출
window.blogAdmin = {
  isAdmin,
  logout,
  getSession: readSession,
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
