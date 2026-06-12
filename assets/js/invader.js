// README.txt 창 안 3D ASCII 스페이스 인베이더 — 복셀 압출 + z-buffer 포인트 렌더
// 자동 회전(턴테이블) + 마우스/터치 드래그로 직접 회전
(function () {
  'use strict';

  var pre = document.getElementById('ascii-invader');
  if (!pre) return;

  var W = 42, H = 19;             // 문자 그리드
  var SCALE_X = 50, SCALE_Y = 26; // 문자 종횡비 보정 투영 스케일
  var K2 = 20;                    // 카메라 거리 (원근 약하게)
  var CHARS = '.,-~:;=!*#$@';

  // 클래식 스페이스 인베이더 스프라이트 (11×8)
  var SPRITE = [
    '..#.....#..',
    '...#...#...',
    '..#######..',
    '.##.###.##.',
    '###########',
    '#.#######.#',
    '#.#.....#.#',
    '...##.##...'
  ];
  var COLS = 11, ROWS = 8, DEPTH = 2;

  function filled(c, r) {
    return r >= 0 && r < ROWS && c >= 0 && c < COLS && SPRITE[r].charAt(c) === '#';
  }

  // 노출된 복셀 면만 샘플링한 포인트 클라우드 (오브젝트 공간, 1회 생성)
  var pts = [];
  var STEP = 0.25; // 면당 4×4 샘플
  function addFace(cx, cy, cz, nx, ny, nz) {
    var tx, ty; // 면의 접선축 2개
    if (nx !== 0) { tx = [0, 1, 0]; ty = [0, 0, 1]; }
    else if (ny !== 0) { tx = [1, 0, 0]; ty = [0, 0, 1]; }
    else { tx = [1, 0, 0]; ty = [0, 1, 0]; }
    for (var u = -0.375; u < 0.5; u += STEP) {
      for (var v = -0.375; v < 0.5; v += STEP) {
        pts.push({
          x: cx + nx * 0.5 + tx[0] * u + ty[0] * v,
          y: cy + ny * 0.5 + tx[1] * u + ty[1] * v,
          z: cz + nz * 0.5 + tx[2] * u + ty[2] * v,
          nx: nx, ny: ny, nz: nz
        });
      }
    }
  }
  (function buildPoints() {
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (!filled(c, r)) continue;
        for (var d = 0; d < DEPTH; d++) {
          var cx = c - (COLS - 1) / 2, cy = (ROWS - 1) / 2 - r, cz = d - (DEPTH - 1) / 2;
          if (!filled(c + 1, r)) addFace(cx, cy, cz, 1, 0, 0);
          if (!filled(c - 1, r)) addFace(cx, cy, cz, -1, 0, 0);
          if (!filled(c, r - 1)) addFace(cx, cy, cz, 0, 1, 0);
          if (!filled(c, r + 1)) addFace(cx, cy, cz, 0, -1, 0);
          if (d === DEPTH - 1) addFace(cx, cy, cz, 0, 0, 1);
          if (d === 0) addFace(cx, cy, cz, 0, 0, -1);
        }
      }
    }
  })();

  // 광원 방향 (정규화됨) — 좌상단 + 카메라 쪽
  var LX = -0.33, LY = 0.46, LZ = -0.82;

  var A = 0.2, B = 0.5;  // X축 기울기 / Y축 턴테이블 회전
  // 자동 회전: 기울기는 ±0.32 대역에서 진동(실루엣 유지), 턴테이블은 연속 회전.
  // 드래그로 벗어나도 놓으면 서서히 대역으로 복귀.
  var tau = 0;
  var dragging = false, lastX = 0, lastY = 0;
  var visible = true;

  function frame() {
    var buf = new Array(W * H);
    var zb = new Array(W * H);
    for (var i = 0; i < W * H; i++) { buf[i] = ' '; zb[i] = 0; }

    var cA = Math.cos(A), sA = Math.sin(A);
    var cB = Math.cos(B), sB = Math.sin(B);

    for (var k = 0; k < pts.length; k++) {
      var p = pts[k];
      // Y축 회전(B) → X축 회전(A)
      var x1 = p.x * cB + p.z * sB, z1 = -p.x * sB + p.z * cB;
      var y2 = p.y * cA - z1 * sA, z2 = p.y * sA + z1 * cA;
      var D = 1 / (z2 + K2);
      var px = Math.floor(W / 2 + SCALE_X * D * x1);
      var py = Math.floor(H / 2 - SCALE_Y * D * y2);
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      var o = px + W * py;
      if (D <= zb[o]) continue;

      // 노멀 회전 + 램버트 음영
      var nx1 = p.nx * cB + p.nz * sB, nz1 = -p.nx * sB + p.nz * cB;
      var ny2 = p.ny * cA - nz1 * sA, nz2 = p.ny * sA + nz1 * cA;
      var lum = nx1 * LX + ny2 * LY + nz2 * LZ;
      var idx = Math.floor(lum * 8) + 3; // 약한 ambient
      if (idx < 0) idx = 0;
      if (idx > 11) idx = 11;

      zb[o] = D;
      buf[o] = CHARS[idx];
    }

    var rows = [];
    for (var r = 0; r < H; r++) {
      rows.push(buf.slice(r * W, (r + 1) * W).join(''));
    }
    pre.textContent = rows.join('\n');
  }

  // ~30fps 루프 (탭 비활성 시 rAF가 알아서 멈춤)
  var last = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!visible) return;
    if (ts - last < 33) return;
    last = ts;
    if (!dragging) {
      tau += 0.012;
      A += (0.32 * Math.sin(tau) - A) * 0.04;
      B += 0.024;
    }
    frame();
  }
  requestAnimationFrame(loop);

  // 화면 밖이면 연산 중지
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }).observe(pre);
  }

  // ── 드래그 회전 ──
  function dragStart(x, y) { dragging = true; lastX = x; lastY = y; }
  function dragMove(x, y) {
    if (!dragging) return;
    // 드래그 방향대로 따라오게 — 두 축 모두 반전
    A -= (y - lastY) * 0.01;
    B -= (x - lastX) * 0.01;
    lastX = x; lastY = y;
    frame();
  }
  function dragEnd() { dragging = false; }

  pre.addEventListener('mousedown', function (e) { e.preventDefault(); dragStart(e.clientX, e.clientY); });
  window.addEventListener('mousemove', function (e) { dragMove(e.clientX, e.clientY); });
  window.addEventListener('mouseup', dragEnd);

  pre.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    dragStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  pre.addEventListener('touchmove', function (e) {
    if (!dragging || e.touches.length !== 1) return;
    e.preventDefault();
    dragMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  pre.addEventListener('touchend', dragEnd);
})();
