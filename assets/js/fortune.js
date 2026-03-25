document.addEventListener('DOMContentLoaded', function() {
  // ── Fortune Button ──
  var container = document.getElementById('fortune-container');
  if (container) {
    var fortunes = [
      { score: 100, msg: "대박! 오늘 커밋하면 버그 제로!" },
      { score: 95, msg: "PR이 한 번에 머지되는 날!" },
      { score: 90, msg: "Stack Overflow 없이 코딩 성공!" },
      { score: 85, msg: "오늘 작성한 코드가 미래의 나를 감동시킨다." },
      { score: 80, msg: "컴파일 한 번에 성공하는 상서로운 기운!" },
      { score: 75, msg: "좋은 기운. 리팩토링하기 좋은 날." },
      { score: 70, msg: "무난한 하루. 테스트 코드 쓰기 딱 좋은 날." },
      { score: 65, msg: "나쁘지 않아. 문서 정리하면 보람찬 하루." },
      { score: 60, msg: "조금 주의. 프로덕션 배포는 내일로." },
      { score: 55, msg: "git stash 해두는 게 좋겠어." },
      { score: 50, msg: "보통. 새 기능보다는 버그 수정에 집중." },
      { score: 45, msg: "rm -rf는 오늘 쓰지 마." },
      { score: 40, msg: "force push 금지의 날." },
      { score: 35, msg: "세그폴트 조심. 저장 자주 하세요." },
      { score: 30, msg: "오늘은 코딩 대신 산책이 답." },
      { score: 20, msg: "undefined is not a function의 기운이..." },
      { score: 10, msg: "모니터 끄고 쉬세요. 진심으로." }
    ];

    var today = new Date().toISOString().slice(0, 10);
    var seed = 0;
    for (var i = 0; i < today.length; i++) {
      seed = ((seed << 5) - seed) + today.charCodeAt(i);
      seed = seed & seed;
    }

    container.innerHTML =
      '<div class="fortune-section">' +
      '  <div class="fortune-label">오늘의 운빨은?!</div>' +
      '  <button class="fortune-btn" id="fortune-btn">확인하기</button>' +
      '  <div class="fortune-result" id="fortune-result"></div>' +
      '  <div class="fortune-counter" id="fortune-counter"></div>' +
      '</div>';

    var btn = document.getElementById('fortune-btn');
    var result = document.getElementById('fortune-result');
    var counter = document.getElementById('fortune-counter');

    var checked = localStorage.getItem('fortune-date') === today;
    if (checked) {
      var saved = JSON.parse(localStorage.getItem('fortune-data'));
      if (saved) {
        result.innerHTML = '<strong>' + saved.score + '점</strong> — ' + saved.msg;
        btn.textContent = '확인 완료';
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.animation = 'none';
      }
    }

    btn.addEventListener('click', function() {
      var idx = Math.abs(seed + navigator.userAgent.length) % fortunes.length;
      var fortune = fortunes[idx];

      result.innerHTML = '<strong>' + fortune.score + '점</strong> — ' + fortune.msg;
      localStorage.setItem('fortune-date', today);
      localStorage.setItem('fortune-data', JSON.stringify(fortune));

      btn.textContent = '확인 완료';
      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.style.animation = 'none';

      fetch('https://api.countapi.xyz/hit/keemminxu-dev-blog/fortune-' + today)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          counter.textContent = '오늘 ' + data.value + '명이 운세를 확인했어요';
        })
        .catch(function() {});
    });

    fetch('https://api.countapi.xyz/get/keemminxu-dev-blog/fortune-' + today)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.value > 0) {
          counter.textContent = '오늘 ' + data.value + '명이 운세를 확인했어요';
        }
      })
      .catch(function() {});
  }

  // ── Visitor Counter ──
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

    totalEl.textContent = localStorage.getItem('visit-total') || '1';
    todayEl.textContent = localStorage.getItem(todayKey) || '1';
  }
});
