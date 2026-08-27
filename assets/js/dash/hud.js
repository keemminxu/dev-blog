// hud.js — .console-screen 위 DOM 오버레이 (점수·메시지·게임오버·말풍선)
export function createHud(container) {
  const root = document.createElement('div');
  root.className = 'dash-hud-root';
  root.innerHTML = `
    <div class="dash-score"></div>
    <div class="dash-flash" hidden></div>
    <div class="dash-msg" hidden></div>
    <div class="dash-bubble" hidden></div>
    <div class="dash-over" hidden>
      <div class="dash-over-title">GAME OVER</div>
      <div class="dash-over-score"></div>
      <div class="dash-over-restart">PRESS X 다시하기</div>
    </div>`;
  container.appendChild(root);

  const el = (cls) => root.querySelector('.' + cls);
  const scoreEl = el('dash-score');
  const msgEl = el('dash-msg');
  const bubbleEl = el('dash-bubble');
  const overEl = el('dash-over');
  const overScoreEl = el('dash-over-score');
  const flashEl = el('dash-flash');
  let bubbleTimer = null, flashTimer = null;

  const fmt = (n) => String(Math.max(0, Math.floor(n))).padStart(5, '0');

  return {
    setScore(score, hi) { scoreEl.textContent = `HI ${fmt(hi)}  ${fmt(score)}`; },
    showMsg(text) { msgEl.innerHTML = text; msgEl.hidden = false; },
    hideMsg() { msgEl.hidden = true; },
    showOver(score, hi, isNew) {
      overScoreEl.textContent = isNew ? `NEW RECORD! ${fmt(score)}` : `SCORE ${fmt(score)}`;
      overEl.hidden = false;
    },
    hideOver() { overEl.hidden = true; },
    bubble(text, sec = 1.2) {
      bubbleEl.textContent = text;
      bubbleEl.hidden = false;
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => { bubbleEl.hidden = true; }, sec * 1000);
    },
    hideBubble() { clearTimeout(bubbleTimer); bubbleEl.hidden = true; },
    flash(text, sec = 1.0) {
      flashEl.textContent = text;
      flashEl.hidden = false;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => { flashEl.hidden = true; }, sec * 1000);
    },
    setNight(on) { root.classList.toggle('is-night', on); },
    destroy() { clearTimeout(bubbleTimer); clearTimeout(flashTimer); root.remove(); },
  };
}
