// 사이드바 열림 상태를 localStorage에 저장 → 페이지 이동 후에도 유지
(function () {
  'use strict';
  var STATE_KEY = 'sidebar_open';

  function apply(open) {
    var sidebar = document.querySelector('.sidebar-left');
    var backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar) return;
    sidebar.classList.toggle('is-open', open);
    if (backdrop) backdrop.classList.toggle('is-open', open);
    document.body.classList.toggle('sidebar-open', open);
  }

  function persist(open) {
    try { localStorage.setItem(STATE_KEY, open ? '1' : '0'); } catch (_) {}
  }

  window.toggleSidebar = function () {
    var sidebar = document.querySelector('.sidebar-left');
    if (!sidebar) return;
    var willOpen = !sidebar.classList.contains('is-open');
    apply(willOpen);
    persist(willOpen);
  };

  window.closeSidebar = function () {
    apply(false);
    persist(false);
  };

  window.openSidebar = function () {
    apply(true);
    persist(true);
  };

  window.resetSidebarWidth = function () {
    var sidebar = document.querySelector('.sidebar-left');
    if (sidebar) sidebar.classList.remove('is-wide');
  };

  window.expandSidebarWidth = function () {
    var sidebar = document.querySelector('.sidebar-left');
    if (sidebar) sidebar.classList.add('is-wide');
  };

  // 페이지 로드 시 이전 상태 복원
  function restore() {
    try {
      if (localStorage.getItem(STATE_KEY) === '1') {
        apply(true);
      }
    } catch (_) {}
    // inline head 스크립트가 붙인 preopen 클래스는 이제 필요 없음 (정식 is-open로 대체됨)
    document.documentElement.classList.remove('sidebar-preopen');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restore);
  } else {
    restore();
  }
})();
