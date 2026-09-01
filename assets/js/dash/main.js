// main.js — 「몽구랑 산책가자」 엔트리: 상태 머신·장애물 풀·12fps 루프
import * as THREE from 'three';
import { INTERNAL, PALETTE, makeToon, pixelTexture, setSnap } from './materials.js';
import { createPixelPass } from './pixelpass.js';
import { createTrack, RAMP, TYPES, DIMS, TREAT } from './track.js';
import { loadDog } from './dog.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createAttract } from './attract.js';
import { createZoom } from './zoom.js';

const STEP = 1 / 12;                 // 12fps 스텝(시뮬·렌더 동기)
const CAMERA = { pos: new THREE.Vector3(2.0, 1.1, 6.0), look: new THREE.Vector3(2.0, 0.5, 0) };
// 대기화면 카메라 시퀀스 — 타이틀 샷(로고 ON) ↔ 3D 쇼케이스 샷(로고 OFF) 교대 (아케이드 어트랙트)
const ATTRACT_SHOTS = [
  { dur: 5.0, logo: true,  from: { pos: [2.2, 1.15, 6.4], look: [2.0, 0.5, 0] }, to: { pos: [2.0, 1.1, 6.0], look: [2.0, 0.5, 0] } },  // 타이틀(게임 카메라, 미세 푸시)
  { dur: 4.0, logo: false, from: { pos: [1.2, 0.9, 2.0], look: [0.1, 0.45, 0] }, to: { pos: [2.0, 0.8, 1.1], look: [0.1, 0.45, 0] } },  // 3/4 오빗
  { dur: 3.5, logo: false, from: { pos: [-1.7, 0.3, 2.4], look: [0, 0.5, 0] }, to: { pos: [-0.5, 0.35, 2.4], look: [0, 0.5, 0] } },     // 저각 측면 돌리
  { dur: 3.5, logo: false, from: { pos: [1.6, 0.8, 1.25], look: [0.45, 0.6, 0] }, to: { pos: [1.15, 0.7, 0.85], look: [0.45, 0.6, 0] } }, // 얼굴 클로즈업
];
let shotIdx = 0, shotT = 0;
const FOG = { near: 8, far: 18 };
const HI_KEY = 'monggu.best.dash';
const BARK_COOLDOWN = 1.5;
const BARK_RANGE = 3.2;

let renderer, scene, camera, pixelPass, hud, dog, input, attract, audio;
const reducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let hemiLight, dirLight;
let world = null;
let track = null;
let sfx = () => {};                  // Task 8에서 audio.js로 교체
let mode = 'loading';                // loading | attract | play | over
let paused = false;
let screenOn = true;
let overTimer = 0, barkCd = 0;
let hi = 0;
let acc = 0, lastT = 0, rafId = null;

try { hi = parseInt(localStorage.getItem(HI_KEY) || '0', 10) || 0; } catch (e) { /* private mode */ }

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

  const grassTex = pixelTexture(32, (ctx, s) => {
    ctx.fillStyle = '#4f9a3a'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#5cae44';
    for (let i = 0; i < 40; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 2, 1);
    ctx.fillStyle = '#448a30';
    for (let i = 0; i < 14; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 2, 1);
  }, 30, 10);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), new THREE.MeshToonMaterial({ map: grassTex }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(10, 0, -4);
  g.add(grass);

  const dirtTex = pixelTexture(32, (ctx, s) => {
    ctx.fillStyle = '#9a7a4a'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#8a6a3c';
    for (let i = 0; i < 30; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 3, 1);
    ctx.fillStyle = '#b08a55';
    for (let i = 0; i < 16; i++) ctx.fillRect((rnd() * s) | 0, (rnd() * s) | 0, 2, 1);
  }, 30, 1);
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(60, 1.8), new THREE.MeshToonMaterial({ map: dirtTex }));
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.set(10, 0.005, 0);
  g.add(dirt);

  const wall = new THREE.Group();
  const WALL_SEG = 24;
  for (let x = 0; x < WALL_SEG; x += 1.6) {
    if (rnd() < 0.18) continue;
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
    if (rnd() < 0.6) {
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
    grassTex, dirtTex, grass, dirt, silMat,
    update(dt, speed) {
      dist += speed * dt;
      grassTex.offset.x = (dist / 2) % 1;
      dirtTex.offset.x = (dist / 2) % 1;
      for (const [grp, twin, seg, factor] of [[wall, wall2, WALL_SEG, 0.75], [houses, houses2, HOUSE_SEG, 0.4]]) {
        grp.position.x -= speed * factor * dt;
        if (grp.position.x < -seg) grp.position.x += seg;
        twin.position.x = grp.position.x + seg;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 장애물 메시 — 히트박스(track DIMS)에 시각을 맞춘 procedural 소품
// ---------------------------------------------------------------------------

const propMats = {};
function propMat(color) {
  if (!propMats[color]) propMats[color] = makeToon(color);
  return propMats[color];
}

function buildObstacleMesh(type) {
  const d = DIMS[type];
  const g = new THREE.Group();
  const box = (w, h, dep, color, x, y, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), propMat(color));
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  if (type === TYPES.FENCE || type === TYPES.FENCE2) {
    const w = d.w;
    box(0.07, d.h, 0.07, 0x8a5a30, -w / 2 + 0.04, d.h / 2);
    box(0.07, d.h, 0.07, 0x8a5a30, w / 2 - 0.04, d.h / 2);
    if (type === TYPES.FENCE2) box(0.07, d.h, 0.07, 0x8a5a30, 0, d.h / 2);
    box(w, 0.07, 0.05, 0x9a6a3a, 0, d.h - 0.06);
    box(w, 0.07, 0.05, 0x9a6a3a, 0, d.h * 0.5);
  } else if (type === TYPES.HYDRANT) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, d.h * 0.8, 8), propMat(0xc84a3a));
    body.position.y = d.h * 0.4;
    g.add(body);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.09, d.h * 0.25, 8), propMat(0xa83a2c));
    cap.position.y = d.h * 0.9;
    g.add(cap);
    box(0.26, 0.06, 0.08, 0xc84a3a, 0, d.h * 0.55);
  } else if (type === TYPES.LINE) {
    box(0.06, 0.9, 0.06, 0x6a6a72, -d.w / 2 - 0.18, 0.45);
    box(0.06, 0.9, 0.06, 0x6a6a72, d.w / 2 + 0.18, 0.45);
    const midY = d.y + d.h / 2;
    box(d.w * 0.45, 0.035, 0.03, 0xe8e8e8, -d.w * 0.26, midY + 0.045);
    box(d.w * 0.45, 0.035, 0.03, 0xe8e8e8, d.w * 0.26, midY + 0.045);
    box(d.w * 0.5, 0.035, 0.03, 0xe8e8e8, 0, midY - 0.02);
    box(0.16, 0.2, 0.02, 0xf0e0d0, 0.1, midY + 0.02);      // 널린 빨래
    box(0.14, 0.16, 0.02, 0xa8c8e0, -0.14, midY - 0.04);
  } else if (type === TYPES.PIGEON) {
    const cy = d.y + d.h / 2;
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.32, 6), propMat(0x9a9aa5));
    body.rotation.z = Math.PI / 2;                           // 머리가 -x(몽구 쪽)
    body.position.y = cy;
    g.add(body);
    box(0.07, 0.07, 0.07, 0x7a7a85, -0.18, cy + 0.04);
    const wingL = box(0.16, 0.03, 0.22, 0x8a8a95, 0.02, cy + 0.05, 0.1);
    const wingR = box(0.16, 0.03, 0.22, 0x8a8a95, 0.02, cy + 0.05, -0.1);
    g.userData.wings = [wingL, wingR];
  } else if (type === TYPES.BIKE) {
    box(d.w * 0.8, 0.16, 0.24, 0xd94b3d, 0, 0.42);          // 프레임
    box(0.34, 0.3, 0.3, 0x8a5a30, 0.12, 0.62);              // 배달통
    box(0.16, 0.24, 0.16, 0x3a3a42, -0.3, 0.68);            // 라이더
    box(0.14, 0.1, 0.14, 0xe8c23a, -0.3, 0.84);             // 헬멧
    const wheel = (x) => {
      const wm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10), propMat(0x2a2a30));
      wm.rotation.x = Math.PI / 2;
      wm.position.set(x, 0.16, 0);
      g.add(wm);
      return wm;
    };
    g.userData.wheels = [wheel(-d.w * 0.32), wheel(d.w * 0.32)];
  }
  return g;
}

const obMeshes = new Map();          // id → group
function addObstacle(o) {
  const m = buildObstacleMesh(o.type);
  m.position.x = o.x;
  obMeshes.set(o.id, m);
  scene.add(m);
}
function disposeGroup(g) {
  g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });   // 머티리얼은 propMat 공유라 유지
}
function removeObstacle(id) {
  const m = obMeshes.get(id);
  if (m) { scene.remove(m); disposeGroup(m); obMeshes.delete(id); }
}
function clearObstacles() {
  for (const m of obMeshes.values()) { scene.remove(m); disposeGroup(m); }
  obMeshes.clear();
}
function syncObstacles(t) {
  for (const o of track.obstacles) {
    const m = obMeshes.get(o.id);
    if (!m) continue;
    m.position.x = o.x;
    m.position.y = o.flee ? o.y - DIMS[o.type].y : 0;      // 비둘기 fly-away
    if (m.userData.wings) {
      const a = Math.sin(t * 22 + o.id) * 0.6;
      m.userData.wings[0].rotation.x = a;
      m.userData.wings[1].rotation.x = -a;
    }
    if (m.userData.wheels) for (const w of m.userData.wheels) w.rotation.z = t * -9;
  }
}

// ---------------------------------------------------------------------------
// 간식(treat) — 뼈다귀, 회전하며 떠 있음
// ---------------------------------------------------------------------------

let kibbleGeo = null, kibbleMat = null;                    // 동그란 먹이
let canGeo = null, canBodyMat = null, canLidMat = null;    // 참치캔
function treatAssets() {
  if (!kibbleGeo) {
    kibbleGeo = new THREE.SphereGeometry(0.11, 10, 8);
    kibbleMat = makeToon(0xd9a441);                        // 갈색빛 사료
    canGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.14, 14);
    canBodyMat = makeToon(0x9fb8c4);                       // 은색 캔
    canLidMat = makeToon(0xe8563a);                        // 빨간 라벨 뚜껑
  }
}
function buildTreatMesh(kind) {
  treatAssets();
  const g = new THREE.Group();
  if (kind === TREAT.TUNA) {
    const body = new THREE.Mesh(canGeo, canBodyMat);
    g.add(body);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.04, 14), canLidMat);
    lid.position.y = 0.08;
    g.add(lid);
    g.userData.tuna = true;
  } else {
    g.add(new THREE.Mesh(kibbleGeo, kibbleMat));
  }
  return g;
}

const treatMeshes = new Map();
function addTreat(t) {
  const m = buildTreatMesh(t.kind);
  m.position.set(t.x, t.y, 0);
  treatMeshes.set(t.id, m);
  scene.add(m);
}
function removeTreat(id) {
  const m = treatMeshes.get(id);
  if (m) { scene.remove(m); treatMeshes.delete(id); }
}
function clearTreats() {
  for (const m of treatMeshes.values()) scene.remove(m);
  treatMeshes.clear();
}
function syncTreats(t) {
  for (const tr of track.treats) {
    const m = treatMeshes.get(tr.id);
    if (!m) continue;
    m.position.x = tr.x;
    m.position.y = tr.y + (m.userData.tuna ? 0 : Math.sin(t * 5 + tr.id) * 0.04);
    m.rotation.y = t * (m.userData.tuna ? 1.6 : 3.2);
  }
}

// 먹은 간식 팝 이펙트 (짧은 확대 후 사라짐)
function popTreat(id) {
  const m = treatMeshes.get(id);
  if (!m) return;
  m.scale.setScalar(1.6);
}

// ---------------------------------------------------------------------------
// 씬·렌더러
// ---------------------------------------------------------------------------

let hdMode = false;                   // 전체화면(확대) 시 고화질 렌더
let dogRef = null;

function sizeRenderer(canvas) {
  const box = canvas.parentElement;
  const w = box.clientWidth || 320, h = box.clientHeight || 230;
  if (hdMode) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    if (pixelPass) pixelPass.setQuality('hd', w * dpr, h * dpr);
  } else {
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);    // updateStyle=false — CSS 크기는 scss가 관리
    if (pixelPass) pixelPass.setQuality('retro');
  }
}

// 전체화면 확대 시 고화질(정점 스냅·디더 off, 텍스처 부드럽게) / 닫으면 레트로 복귀
function setHd(on, canvas) {
  hdMode = on;
  setSnap(!on);
  if (dogRef) dogRef.setSmooth(on);
  sizeRenderer(canvas);
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
  if (hud) hud.setNight(on);
}

// ---------------------------------------------------------------------------
// 상태 머신
// ---------------------------------------------------------------------------

function speedNorm() {
  return (track.speed - RAMP.START_SPEED) / (RAMP.MAX_SPEED - RAMP.START_SPEED);
}

function startGame() {
  mode = 'play';
  paused = false;
  resetCamera();
  track.reset();
  clearObstacles();
  clearTreats();
  dog.reset('run');
  dog.setMode('run');
  barkCd = 0;
  setNight(false);
  attract.hide();
  hud.hideOver();
  hud.hideMsg();
  hud.hideBubble();
  hud.setScore(0, hi);
}

function gameOver() {
  mode = 'over';
  overTimer = 0;
  dog.die();
  sfx('hit');
  const score = track.score;
  const isNew = score > hi;
  if (isNew) {
    hi = score;
    try { localStorage.setItem(HI_KEY, String(hi)); } catch (e) { /* ignore */ }
  }
  hud.bubble('ㅠㅠ', 2.0);
  hud.showOver(score, hi, isNew);
}

function updateAttractCamera(dt) {
  shotT += dt;
  if (shotT >= ATTRACT_SHOTS[shotIdx].dur) {
    shotT = 0;
    shotIdx = (shotIdx + 1) % ATTRACT_SHOTS.length;
    if (ATTRACT_SHOTS[shotIdx].logo) attract.show(); else attract.hide();
  }
  const sh = ATTRACT_SHOTS[shotIdx];
  const u0 = shotT / sh.dur;
  const u = u0 * u0 * (3 - 2 * u0);   // smoothstep
  camera.position.set(
    sh.from.pos[0] + (sh.to.pos[0] - sh.from.pos[0]) * u,
    sh.from.pos[1] + (sh.to.pos[1] - sh.from.pos[1]) * u,
    sh.from.pos[2] + (sh.to.pos[2] - sh.from.pos[2]) * u
  );
  camera.lookAt(
    sh.from.look[0] + (sh.to.look[0] - sh.from.look[0]) * u,
    sh.from.look[1] + (sh.to.look[1] - sh.from.look[1]) * u,
    sh.from.look[2] + (sh.to.look[2] - sh.from.look[2]) * u
  );
}

function resetCamera() {
  camera.position.copy(CAMERA.pos);
  camera.lookAt(CAMERA.look);
}

function showAttract() {
  mode = 'attract';
  shotIdx = 0; shotT = 0;
  dog.reset('attract');
  clearObstacles();
  clearTreats();
  track.reset();
  setNight(false);
  attract.show();
  hud.hideOver();
  hud.hideBubble();
  hud.setScore(0, hi);
  hud.showMsg('Press X / Click');
}

function tryStart() {
  if (mode === 'attract') { startGame(); return true; }
  if (mode === 'over' && overTimer > 0.5) { startGame(); return true; }
  return false;
}

function doBark() {
  if (mode !== 'play' || barkCd > 0) return;
  barkCd = BARK_COOLDOWN;
  dog.bark();
  sfx('bark');
  hud.bubble('WOOF!', 0.7);
  for (const o of track.obstacles) {
    if (o.type === TYPES.PIGEON && o.x > 0 && o.x < BARK_RANGE && !o.flee) {
      o.flee = true;                 // 위로 날아올라 화면 밖으로
    }
  }
}

// ---------------------------------------------------------------------------
// 시뮬 스텝 (12fps)
// ---------------------------------------------------------------------------

let simT = 0;

function simStep(dt) {
  simT += dt;
  if (mode === 'play' && !paused) {
    barkCd = Math.max(0, barkCd - dt);
    const events = track.tick(dt);
    for (const e of events) {
      if (e.type === 'spawn') { addObstacle(e.obstacle); if (e.obstacle.warn) sfx('horn'); }
      else if (e.type === 'despawn') removeObstacle(e.id);
      else if (e.type === 'night') setNight(e.on);
      else if (e.type === 'score100') sfx('score');
      else if (e.type === 'treat-spawn') addTreat(e.treat);
      else if (e.type === 'treat-despawn') removeTreat(e.id);
    }
    for (const o of track.obstacles) if (o.flee) o.y = Math.min(2.6, o.y + 3.5 * dt);
    world.update(dt, track.speed);
    dog.update(dt, { speedNorm: speedNorm() });
    syncObstacles(simT);
    syncTreats(simT);
    const eaten = track.collect(dog.box());
    if (eaten.length) {
      let tuna = false;
      for (const t of eaten) { popTreat(t.id); if (t.kind === TREAT.TUNA) tuna = true; }
      if (tuna) { sfx('score'); hud.bubble('참치캔! +50', 0.9); } else { sfx('nom'); }
    }
    hud.setScore(track.score, hi);
    const hit = track.collide(dog.box());
    if (hit && !dbgInvincible) gameOver();
  } else if (mode === 'attract') {
    dog.update(reducedMotion ? 0 : dt, {});
    if (!reducedMotion) updateAttractCamera(dt);   // reduced-motion은 고정 게임 카메라
  } else if (mode === 'over') {
    overTimer += dt;
    dog.update(dt, { speedNorm: 0 });
    if (overTimer >= 3) showAttract();             // 3초 방치 시 시작화면 복귀
  }
}

let frozen = false;                  // 하네스 수동 스텝용
let dbgInvincible = false;           // 하네스 전용 무적 (야간 등 장시간 재현)
let visible = true;                  // IntersectionObserver — 화면 밖이면 루프 정지
let pageHidden = false;              // visibilitychange
let ctxLost = false;                 // webglcontextlost

function frame(t) {
  rafId = requestAnimationFrame(frame);
  if (!screenOn || frozen || ctxLost || pageHidden || !visible || mode === 'loading') { lastT = t; return; }
  acc += Math.min((t - lastT) / 1000, 0.25);
  lastT = t;
  let stepped = false;
  while (acc >= STEP) { acc -= STEP; simStep(STEP); stepped = true; }
  if (stepped) pixelPass.render(scene, camera);
}

// 검증 하네스 훅 — 수동 스텝·상태 조회 (게임 동작에는 영향 없음)
if (typeof window !== 'undefined') {
  window.__dash = {
    freeze(v) { frozen = !!v; },
    invincible(v) { dbgInvincible = !!v; },
    toAttract() { if (dog) showAttract(); },
    step(n = 1) {
      for (let i = 0; i < n; i++) simStep(STEP);
      if (renderer) pixelPass.render(scene, camera);
    },
    get state() {
      return {
        mode, paused, hi,
        score: track ? track.score : 0,
        speed: track ? track.speed : 0,
        night: track ? track.night : false,
        obstacles: track ? track.obstacles.map((o) => ({ type: o.type, x: +o.x.toFixed(2), y: +o.y.toFixed(2) })) : [],
        treats: track ? track.treats.length : 0,
        hd: hdMode,
        dog: dog ? { airborne: dog.airborne, ducking: dog.ducking, mode: dog.mode } : null,
      };
    },
  };
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
    for (const el of [overlay, led, redLed]) if (el) el.classList.toggle('is-off', !screenOn);
    if (!screenOn && renderer) {
      renderer.setRenderTarget(null);
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
    }
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

// WebGL·GLB 실패 시 정적 포스터(로고) 폴백
function showPoster(container) {
  const img = document.createElement('img');
  img.className = 'dash-logo dash-poster';
  img.alt = '몽구랑 산책가자';
  img.src = new URL('../../images/crt/logo-dash.webp', import.meta.url).href;
  container.appendChild(img);
}

export async function initGame() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas || renderer) return;
  try {
    createScene(canvas);
  } catch (err) {
    console.error('dash: WebGL 초기화 실패', err);
    showPoster(canvas.parentElement);
    return;
  }
  setupScreenToggle();
  hud = createHud(canvas.parentElement);
  attract = createAttract(canvas.parentElement);
  audio = createAudio();
  sfx = (name) => audio.play(name);
  sfx.toggleMute = () => audio.toggleMute();
  track = createTrack();
  window.addEventListener('resize', () => sizeRenderer(canvas));

  input = createInput({
    jumpStart() { if (!tryStart() && mode === 'play' && !paused && dog.jump(true)) sfx('jump'); },
    jumpEnd() { if (mode === 'play') dog.jumpEnd(); },
    duck(on) { if (on && tryStart()) return; if (mode === 'play' && !paused) dog.duck(on); },
    bark() { doBark(); },
    mute() { const muted = sfx.toggleMute ? sfx.toggleMute() : true; hud.flash(muted ? 'SOUND OFF' : 'SOUND ON'); },
    pause() {
      if (mode !== 'play') return;
      paused = !paused;
      if (paused) hud.showMsg('PAUSE'); else hud.hideMsg();
    },
  });
  input.attach();
  createZoom({
    screen: canvas.parentElement,
    onResize: () => sizeRenderer(canvas),
    onOpen: () => setHd(true, canvas),
    onClose: () => setHd(false, canvas),
  });

  try {
    const glbUrl = new URL('../../glb/monggu.glb', import.meta.url).href;
    dog = await loadDog(glbUrl);
    dogRef = dog;
    scene.add(dog.object3d);
    showAttract();
  } catch (err) {
    console.error('dash: GLB 로드 실패', err);
    hud.showMsg('LOAD ERROR');
    showPoster(canvas.parentElement);
    return;
  }

  // 가시성·컨텍스트 위생
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries.some((en) => en.isIntersecting);
    }).observe(canvas.parentElement);
  }
  document.addEventListener('visibilitychange', () => { pageHidden = document.hidden; });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ctxLost = true; });
  canvas.addEventListener('webglcontextrestored', () => { ctxLost = false; });

  lastT = performance.now();
  rafId = requestAnimationFrame(frame);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
