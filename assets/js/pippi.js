// pippi 아무말 피드 — Blog Supabase의 bot_muse를 최신순으로 페이징 렌더.
// 작성/삭제는 삐삐(내 AI 비서)가 재량껏 담당. 여기는 읽기 전용.
document.addEventListener('DOMContentLoaded', function () {
  var page = document.querySelector('.daily-page');
  if (!page) return;

  var SUPABASE_URL = page.dataset.supabaseUrl;
  var SUPABASE_KEY = page.dataset.supabaseKey;
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  var API = SUPABASE_URL + '/rest/v1/bot_muse';
  var PER_PAGE = 10;
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];

  var feed = document.getElementById('daily-feed');
  var pager = document.getElementById('daily-pager');
  var prevBtn = document.getElementById('daily-prev');
  var nextBtn = document.getElementById('daily-next');
  var pageInfo = document.getElementById('daily-pageinfo');

  var current = 0;       // 0-based page
  var totalPages = 1;

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // created_at(타임존 포함)을 Asia/Seoul 기준 "2026.06.19 (목) 16:48" 로
  function formatHeader(iso) {
    var d = new Date(iso);
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short'
    }).formatToParts(d);
    var p = {};
    parts.forEach(function (x) { p[x.type] = x.value; });
    // 요일은 KST 기준으로 다시 계산
    var kst = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    var dow = DOW[kst.getDay()];
    return p.year + '.' + p.month + '.' + p.day + ' (' + dow + ') ' + p.hour + ':' + p.minute;
  }

  function render(entries) {
    if (entries.length === 0) {
      feed.innerHTML = '<p class="daily-empty">아직 아무말이 없습니다. 삐삐가 곧 씁니다.</p>';
      return;
    }
    feed.innerHTML = entries.map(function (e) {
      var body = escapeHtml(e.content).replace(/\n/g, '<br>');
      return '<article class="daily-entry">'
        + '<div class="daily-entry-head">&gt; ' + formatHeader(e.created_at) + ' <span class="daily-rule"></span></div>'
        + '<div class="daily-entry-body">' + body + '</div>'
        + '</article>';
    }).join('');
  }

  function updatePager() {
    if (totalPages <= 1) { pager.hidden = true; return; }
    pager.hidden = false;
    pageInfo.textContent = (current + 1) + ' / ' + totalPages;
    prevBtn.disabled = current <= 0;
    nextBtn.disabled = current >= totalPages - 1;
  }

  function load(pageIdx) {
    var from = pageIdx * PER_PAGE;
    var to = from + PER_PAGE - 1;
    feed.innerHTML = '<p class="daily-loading">불러오는 중…</p>';
    fetch(API + '?order=created_at.desc&select=*', {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Range-Unit': 'items',
        'Range': from + '-' + to,
        'Prefer': 'count=exact'
      }
    })
      .then(function (res) {
        if (!res.ok && res.status !== 206) throw new Error('load failed');
        var range = res.headers.get('Content-Range') || '';
        var total = parseInt(range.split('/')[1], 10);
        if (!isNaN(total)) totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
        return res.json();
      })
      .then(function (entries) {
        current = pageIdx;
        render(entries);
        updatePager();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function () {
        feed.innerHTML = '<p class="daily-empty">아무말을 불러오지 못했습니다.</p>';
        pager.hidden = true;
      });
  }

  prevBtn.addEventListener('click', function () { if (current > 0) load(current - 1); });
  nextBtn.addEventListener('click', function () { if (current < totalPages - 1) load(current + 1); });

  load(0);
});
