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
      var isJackpot = Math.random() < 0.01; // 1% 확률
      var score = isJackpot ? 100 : Math.floor(Math.random() * 99) + 1;

      result.textContent = score + '점';

      // 100점이면 황금빛 효과
      if (isJackpot) {
        result.classList.add('jackpot');
        btn.classList.add('jackpot');
      } else {
        result.classList.remove('jackpot');
        btn.classList.remove('jackpot');
      }
    });
  }

  // ── Visitor Counter (CountAPI로 공유 카운터) ──
  var todayEl = document.getElementById('today-count');
  var totalEl = document.getElementById('total-count');
  if (todayEl && totalEl) {
    var todayDate = new Date().toISOString().slice(0, 10);
    var isNewVisit = !sessionStorage.getItem('visited');

    if (isNewVisit) {
      sessionStorage.setItem('visited', '1');

      // 오늘 카운터 증가
      fetch('https://api.countapi.xyz/hit/keemminxu-dev-blog/visit-' + todayDate)
        .then(function(r) { return r.json(); })
        .then(function(data) { todayEl.textContent = data.value; })
        .catch(function() { todayEl.textContent = '-'; });

      // 토탈 카운터 증가
      fetch('https://api.countapi.xyz/hit/keemminxu-dev-blog/visit-total')
        .then(function(r) { return r.json(); })
        .then(function(data) { totalEl.textContent = data.value; })
        .catch(function() { totalEl.textContent = '-'; });
    } else {
      // 이미 방문한 세션 - 값만 조회
      fetch('https://api.countapi.xyz/get/keemminxu-dev-blog/visit-' + todayDate)
        .then(function(r) { return r.json(); })
        .then(function(data) { todayEl.textContent = data.value || 0; })
        .catch(function() { todayEl.textContent = '-'; });

      fetch('https://api.countapi.xyz/get/keemminxu-dev-blog/visit-total')
        .then(function(r) { return r.json(); })
        .then(function(data) { totalEl.textContent = data.value || 0; })
        .catch(function() { totalEl.textContent = '-'; });
    }
  }
});
