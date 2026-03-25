document.addEventListener('DOMContentLoaded', function() {
  var container = document.getElementById('fortune-container');
  if (!container) return;

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
});
