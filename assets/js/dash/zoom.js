// zoom.js — 게임 화면 확대 모달
// 데스크톱: 내부 해상도 정수배(2~4×)로 가운데 확대 + 딤 + 키보드 힌트
// 모바일: 화면 폭 가득 + 딤 + 점프/숙이기 터치 존 표시
// 구현: .console-screen 엘리먼트를 통째로 모달 스테이지로 옮겼다가(입력·HUD·로고가 함께 이동) 닫을 때 원위치
import { INTERNAL } from './materials.js';

const SCREEN_RATIO = 970 / 700;   // .console-screen 비율(1.386)

export function createZoom({ screen, onResize }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dash-zoom-btn';
  btn.setAttribute('aria-label', '게임 화면 크게 보기');
  btn.innerHTML = '<span class="dash-zoom-btn-icon" aria-hidden="true">&#x26F6;</span><span class="dash-zoom-btn-text">크게 보기</span>';
  screen.appendChild(btn);

  const modal = document.createElement('div');
  modal.className = 'dash-zoom';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="dash-zoom-backdrop"></div>
    <div class="dash-zoom-frame">
      <button type="button" class="dash-zoom-close" aria-label="닫기">&#x2715; 닫기</button>
      <div class="dash-zoom-stage">
        <div class="dash-zoom-zones" aria-hidden="true">
          <div class="dash-zoom-zone dash-zoom-zone--jump">탭 = 점프</div>
          <div class="dash-zoom-zone dash-zoom-zone--duck">탭 = 숙이기</div>
        </div>
      </div>
      <div class="dash-zoom-hints">
        <span><b>Space / X</b> 점프 (길게 = 높이)</span>
        <span><b>Shift / &#8595;</b> 숙이기</span>
        <span><b>E</b> 짖기</span>
        <span><b>F</b> 소리</span>
        <span><b>ESC</b> 닫기</span>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const stage = modal.querySelector('.dash-zoom-stage');
  const zones = modal.querySelector('.dash-zoom-zones');
  let placeholder = null;
  let fadeTimer = null;

  const isMobile = () => window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

  function layout() {
    const mobile = isMobile();
    modal.classList.toggle('is-mobile', mobile);
    let w, h, ui;
    if (mobile) {
      w = Math.min(window.innerWidth, 720);
      h = Math.round(w / SCREEN_RATIO);
      ui = Math.max(1, w / 364);
    } else {
      const maxW = window.innerWidth * 0.82;
      const maxH = window.innerHeight * 0.72;
      const scale = Math.max(2, Math.min(4, Math.floor(Math.min(maxW / INTERNAL.W, maxH / INTERNAL.H))));
      w = INTERNAL.W * scale;
      h = INTERNAL.H * scale;
      ui = scale / 2;                       // 기본 캔버스(≈2×) 대비 HUD 배율
    }
    stage.style.width = w + 'px';
    stage.style.height = h + 'px';
    stage.style.setProperty('--dash-ui', ui.toFixed(2));
    onResize();
  }

  function open() {
    if (!modal.hidden) return;
    placeholder = document.createComment('dash-screen-anchor');
    screen.parentNode.insertBefore(placeholder, screen);
    stage.insertBefore(screen, zones);
    modal.hidden = false;
    document.body.classList.add('dash-zoom-open');
    layout();
    zones.classList.remove('is-faded');
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => zones.classList.add('is-faded'), 2600);
    window.addEventListener('resize', layout);
    modal.querySelector('.dash-zoom-close').focus({ preventScroll: true });
  }

  function close() {
    if (modal.hidden) return;
    placeholder.parentNode.insertBefore(screen, placeholder);
    placeholder.remove();
    placeholder = null;
    stage.style.removeProperty('--dash-ui');
    modal.hidden = true;
    document.body.classList.remove('dash-zoom-open');
    window.removeEventListener('resize', layout);
    clearTimeout(fadeTimer);
    onResize();
  }

  btn.addEventListener('click', open);
  modal.querySelector('.dash-zoom-close').addEventListener('click', close);
  modal.querySelector('.dash-zoom-backdrop').addEventListener('click', close);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });

  return { open, close, get isOpen() { return !modal.hidden; } };
}
