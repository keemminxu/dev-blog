// main.js — 「몽구랑 산책가자」 엔트리: 씬·월드·픽셀 패스·12fps 루프·상태 머신
import * as THREE from 'three';
import { INTERNAL, PALETTE, makeToon, pixelTexture } from './materials.js';
import { createPixelPass } from './pixelpass.js';
import { RAMP } from './track.js';

const STEP = 1 / 12;                 // 12fps 스텝(시뮬·렌더 동기)
const CAMERA = { pos: new THREE.Vector3(0.9, 1.0, 4.4), look: new THREE.Vector3(0.9, 0.45, 0) };
const FOG = { near: 8, far: 18 };

let renderer, scene, camera, pixelPass;
let hemiLight, dirLight;
let world = null;                    // 지면·패럴랙스
let screenOn = true;
let running = false;
let acc = 0, lastT = 0, rafId = null;

// ---------------------------------------------------------------------------
// 월드(지면 스크롤 + 실루엣 패럴랙스)
// ---------------------------------------------------------------------------

function seededRng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

function buildWorld() {
  const g = new THREE.Group();
  const rnd = seededRng(7);

  // 잔디 지면 — 텍스처 offset 스크롤 (60 unit / repeat 30 → 1타일 = 2 unit)
  const grassTex = pixelTexture(32, (ctx, s) => {
    ctx.fillStyle = '#4f9a3a'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#5cae44';
    for (let i = 0; i < 40; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 2, 1);
    ctx.fillStyle = '#448a30';
    for (let i = 0; i < 14; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 2, 1);
  }, 30, 10);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), applyGround(new THREE.MeshToonMaterial({ map: grassTex })));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(10, 0, -4);
  g.add(grass);

  // 흙길(몽구가 달리는 골목) — z=0 스트립
  const dirtTex = pixelTexture(32, (ctx, s) => {
    ctx.fillStyle = '#9a7a4a'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#8a6a3c';
    for (let i = 0; i < 30; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 3, 1);
    ctx.fillStyle = '#b08a55';
    for (let i = 0; i < 16; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 2, 1);
  }, 30, 1);
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(60, 1.8), applyGround(new THREE.MeshToonMaterial({ map: dirtTex })));
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.set(10, 0.005, 0);
  g.add(dirt);

  // 담장(가까운 배경) + 집 실루엣(먼 배경) — 세그먼트 반복, 패럴랙스 팩터로 이동
  const wall = new THREE.Group();
  const WALL_SEG = 24;
  for (let x = 0; x < WALL_SEG; x += 1.6) {
    if (rnd() < 0.18) continue;   // 드문 개구부
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.15), makeToon(0xb8a888));
    b.position.set(x, 0.25, -2.6);
    wall.add(b);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.18), makeToon(0x9a8a6a));
    post.position.set(x + 0.75, 0.31, -2.6);
    wall.add(post);
  }
  const wall2 = wall.clone(); wall2.position.x = WALL_SEG;
  g.add(wall, wall2);

  const houses = new THREE.Group();
  const HOUSE_SEG = 36;
  const silMat = makeToon(PALETTE.day.silhouette);
  for (let x = 0; x < HOUSE_SEG; x += 3 + rnd() * 2) {
    const hgt = 1.2 + rnd() * 1.6;
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.2 + rnd(), hgt, 0.4), silMat);
    b.position.set(x, hgt / 2, -6.5);
    houses.add(b);
    if (rnd() < 0.6) {   // 지붕
      const r = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.7, 4), silMat);
      r.rotation.y = Math.PI / 4;
      r.position.set(x, hgt + 0.34, -6.5);
      houses.add(r);
    }
  }
  const houses2 = houses.clone(); houses2.position.x = HOUSE_SEG;
  g.add(houses, houses2);

  scene.add(g);
  let dist = 0;
  return {
    group: g,
    grassTex, dirtTex, grass, dirt, silMat,
    update(dt, speed) {
      dist += speed * dt;
      grassTex.offset.x = (dist / 2) % 1;
      dirtTex.offset.x = (dist / 2) % 1;
      for (const [grp, twin, seg, factor] of [[wall, wall2, WALL_SEG, 0.75], [houses, houses2, HOUSE_SEG, 0.4]]) {
        grp.position.x -= speed * factor * dt;
        twin.position.x = grp.position.x + seg;
        if (grp.position.x < -seg) { grp.position.x += seg; twin.position.x = grp.position.x + seg; }
      }
    },
  };
}

// 지면 머티리얼: 스냅은 지면 같은 큰 폴리곤에서 출렁임이 커서 제외(PS1도 바닥은 잘게 쪼갰음)
function applyGround(mat) { return mat; }

// ---------------------------------------------------------------------------
// 씬·렌더러
// ---------------------------------------------------------------------------

function sizeRenderer(canvas) {
  const box = canvas.parentElement;
  const w = box.clientWidth || 320, h = box.clientHeight || 230;
  renderer.setSize(w, h, false);    // updateStyle=false — CSS 크기는 scss가 관리
}

function createScene(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  sizeRenderer(canvas);

  camera = new THREE.PerspectiveCamera(40, INTERNAL.W / INTERNAL.H, 0.1, 60);
  camera.position.copy(CAMERA.pos);
  camera.lookAt(CAMERA.look);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.day.sky);
  scene.fog = new THREE.Fog(PALETTE.day.sky, FOG.near, FOG.far);

  hemiLight = new THREE.HemisphereLight(0xffffff, 0x556633, PALETTE.day.hemi);
  dirLight = new THREE.DirectionalLight(0xffffff, PALETTE.day.dir);
  dirLight.position.set(3, 4, 5);
  scene.add(hemiLight, dirLight);

  pixelPass = createPixelPass(renderer);
  world = buildWorld();
}

// 야간 반전 (track 'night' 이벤트에서 호출)
export function setNight(on) {
  const p = on ? PALETTE.night : PALETTE.day;
  scene.background.setHex(p.sky);
  scene.fog.color.setHex(p.sky);
  hemiLight.intensity = p.hemi;
  dirLight.intensity = p.dir;
  world.silMat.color.setHex(p.silhouette);
  const tint = new THREE.Color(p.groundTint);
  world.grass.material.color.copy(tint);
  world.dirt.material.color.copy(tint);
}

// ---------------------------------------------------------------------------
// 루프 — 12fps 스텝 (시뮬과 렌더를 같은 스텝으로)
// ---------------------------------------------------------------------------

function frame(t) {
  rafId = requestAnimationFrame(frame);
  if (!running || !screenOn) { lastT = t; return; }
  acc += Math.min((t - lastT) / 1000, 0.25);
  lastT = t;
  let stepped = false;
  while (acc >= STEP) { acc -= STEP; simStep(STEP); stepped = true; }
  if (stepped) pixelPass.render(scene, camera);
}

// Task 7에서 상태 머신으로 확장. 지금은 월드 스크롤만.
function simStep(dt) {
  world.update(dt, RAMP.START_SPEED);
}

// ---------------------------------------------------------------------------
// 전원 토글 (기존 game-screen-toggle 이벤트·CSS 오버레이 유지)
// ---------------------------------------------------------------------------

function setupScreenToggle() {
  document.addEventListener('game-screen-toggle', () => {
    screenOn = !screenOn;
    const overlay = document.getElementById('crt-screen-off');
    const led = document.getElementById('crt-led');
    const redLed = document.querySelector('.crt-led-dot.red');
    for (const [el, cls] of [[overlay, 'is-off'], [led, 'is-off'], [redLed, 'is-off']]) {
      if (el) el.classList.toggle(cls, !screenOn);
    }
    if (!screenOn) { renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1); renderer.clear(); }
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initGame() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas || renderer) return;
  createScene(canvas);
  setupScreenToggle();
  window.addEventListener('resize', () => sizeRenderer(canvas));
  running = true;
  lastT = performance.now();
  rafId = requestAnimationFrame(frame);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
