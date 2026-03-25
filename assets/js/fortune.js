document.addEventListener('DOMContentLoaded', function() {
  // ── Fortune Button (무제한, 1% 확률 100점) ──
  var container = document.getElementById('fortune-container');
  if (container) {
    container.innerHTML =
      '<div class="fortune-section">' +
      '  <button class="fortune-btn" id="fortune-btn">오늘의 운빨은?!</button>' +
      '  <div class="fortune-result" id="fortune-result"></div>' +
      '</div>';

    var btn = document.getElementById('fortune-btn');
    var result = document.getElementById('fortune-result');

    btn.addEventListener('click', function() {
      var isJackpot = Math.random() < 0.01;
      var score = isJackpot ? 100 : Math.floor(Math.random() * 99) + 1;

      result.textContent = score + '점';

      if (isJackpot) {
        result.classList.add('jackpot');
        btn.classList.add('jackpot');
      } else {
        result.classList.remove('jackpot');
        btn.classList.remove('jackpot');
      }
    });
  }

  // ── Visitor Counter (localStorage 기반) ──
  var todayEl = document.getElementById('today-count');
  var totalEl = document.getElementById('total-count');
  if (todayEl && totalEl) {
    var todayDate = new Date().toISOString().slice(0, 10);
    var todayKey = 'visit-' + todayDate;
    var isNewVisit = !sessionStorage.getItem('visited');

    if (isNewVisit) {
      sessionStorage.setItem('visited', '1');
      var total = parseInt(localStorage.getItem('visit-total') || '0') + 1;
      localStorage.setItem('visit-total', String(total));
      var todayVal = parseInt(localStorage.getItem(todayKey) || '0') + 1;
      localStorage.setItem(todayKey, String(todayVal));
    }

    todayEl.textContent = localStorage.getItem(todayKey) || '0';
    totalEl.textContent = localStorage.getItem('visit-total') || '0';
  }
});
