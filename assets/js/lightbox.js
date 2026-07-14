// 포스트 본문 이미지 라이트박스 — 클릭하면 DOS 윈도우 프레임으로 확대.
// 아무 곳이나 클릭 / ✕ / Esc 로 닫는다. 키보드(Enter/Space)로도 열 수 있다.
document.addEventListener('DOMContentLoaded', function () {
  var imgs = document.querySelectorAll('.post-content img');
  if (!imgs.length) return;

  var overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', '이미지 확대 보기');
  overlay.innerHTML =
    '<div class="lightbox-frame">'
    + '<div class="lightbox-titlebar">'
    + '<span class="lightbox-title"></span>'
    + '<button type="button" class="lightbox-close" aria-label="닫기">✕</button>'
    + '</div>'
    + '<img class="lightbox-img" alt="">'
    + '</div>';
  document.body.appendChild(overlay);

  var frameImg = overlay.querySelector('.lightbox-img');
  var title = overlay.querySelector('.lightbox-title');
  var closeBtn = overlay.querySelector('.lightbox-close');
  var lastFocus = null;

  function open(img) {
    lastFocus = document.activeElement;
    frameImg.src = img.currentSrc || img.src;
    frameImg.alt = img.alt || '';
    title.textContent = img.alt || decodeURIComponent((img.src.split('/').pop() || 'image').split('?')[0]);
    overlay.classList.add('is-open');
    document.body.classList.add('lightbox-open');
    closeBtn.focus(); // 포커스를 다이얼로그 안으로 — 배경이 키보드로 조작되지 않게
  }

  function close() {
    overlay.classList.remove('is-open');
    document.body.classList.remove('lightbox-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  imgs.forEach(function (img) {
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.addEventListener('click', function () { open(img); });
    img.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(img);
      }
    });
  });

  overlay.addEventListener('click', close);

  // 포커스 가능한 요소가 ✕ 하나뿐이라 Tab을 고정하는 것으로 충분한 포커스 트랩
  overlay.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      closeBtn.focus();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
  });
});
