// 글 목록 페이징 — .post-list 안의 post-card를 6개 단위로 나눈다 (category/tag 페이지).
// 페이지 상태는 #p=N 해시로 유지되어 뒤로가기/새로고침에도 남는다.
document.addEventListener('DOMContentLoaded', function () {
  var PER_PAGE = 6;
  var list = document.querySelector('.post-list');
  if (!list) return;

  var cards = Array.prototype.filter.call(list.children, function (node) {
    return node.classList && node.classList.contains('post-card');
  });
  if (cards.length <= PER_PAGE) return;

  var totalPages = Math.ceil(cards.length / PER_PAGE);
  var current = 0;

  var nav = document.createElement('nav');
  nav.className = 'daily-pager post-list-pager';
  nav.setAttribute('aria-label', '글 목록 페이지');

  var prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'daily-pager-btn';
  prevBtn.textContent = '◀ 이전';

  var info = document.createElement('span');
  info.className = 'daily-pager-info';

  var nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'daily-pager-btn';
  nextBtn.textContent = '다음 ▶';

  nav.appendChild(prevBtn);
  nav.appendChild(info);
  nav.appendChild(nextBtn);
  list.parentNode.insertBefore(nav, list.nextSibling);

  function show(idx, scroll) {
    current = Math.max(0, Math.min(idx, totalPages - 1));
    cards.forEach(function (card, i) {
      card.classList.toggle('is-paged-out', Math.floor(i / PER_PAGE) !== current);
    });
    info.textContent = (current + 1) + ' / ' + totalPages;
    prevBtn.disabled = current <= 0;
    nextBtn.disabled = current >= totalPages - 1;
    if (history.replaceState) {
      history.replaceState(null, '',
        current > 0 ? '#p=' + (current + 1) : window.location.pathname + window.location.search);
    }
    if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  prevBtn.addEventListener('click', function () { show(current - 1, true); });
  nextBtn.addEventListener('click', function () { show(current + 1, true); });

  var m = window.location.hash.match(/^#p=(\d+)$/);
  show(m ? parseInt(m[1], 10) - 1 : 0, false);
});
