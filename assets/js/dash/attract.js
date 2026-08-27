// attract.js — 대기 화면 로고 오버레이 (「몽구랑 산책가자」)
export function createAttract(container) {
  const img = document.createElement('img');
  img.className = 'dash-logo';
  img.alt = '몽구랑 산책가자';
  img.draggable = false;
  img.src = new URL('../../images/crt/logo-dash.webp', import.meta.url).href;
  img.hidden = true;
  container.appendChild(img);
  return {
    show() { img.hidden = false; },
    hide() { img.hidden = true; },
    destroy() { img.remove(); },
  };
}
