import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Backrooms — grid cell prototype
// - 플레이어 원점 고정, 셀(바닥/천장/벽)이 반대로 흘러 월드 이동감 연출
// - 2D 그리드 셀. 각 셀 4방향 엣지는 "open/closed"로 미로 생성
// - 플레이어 기준 window 내 셀만 유지 (활성 셀이 window 밖으로 나가면 폐기)
// - 양쪽 셀이 모두 폐기된 엣지는 캐시에서 제거 → 재방문 시 새 랜덤 엣지 생성
//   (= 뒤돌아 다시 오면 다른 미로가 나옴)
// ---------------------------------------------------------------------------

const CELL_SIZE = 10;
const WALL_HEIGHT = 8;
const WALL_THICKNESS = 0.25;
const FLOOR_Y = 0.3;
const WINDOW_CELLS = 3;          // ±3 → 7×7 = 최대 49 셀 로드
const EDGE_OPEN_CHANCE = 0.55;   // 랜덤 엣지 개방 확률
const PLAYER_HALF = 1;

const FOG_COLOR = 0xb48d34;
const FOG_NEAR = 4;
const FOG_FAR = 24;

const PORTAL_COLOR = 0x3da0ff;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let gameScene = null;
const activeCells = new Map();   // "cx,cz" → { group, cx, cz, worldX, worldZ }
const activeEdges = new Map();   // edgeKey → boolean (open?)
const virtualPos = new THREE.Vector3();
const worldVel = new THREE.Vector3();
let running = false;
let portalTime = 0;

let hud = null;
let startOverlay = null;
let originalFog = null;
let originalBg = null;

let wallTex = null, floorTex = null, ceilTex = null;
let sharedFloorMat = null, sharedCeilMat = null, sharedWallMat = null;
let sharedFloorGeo = null, sharedCeilGeo = null;
let sharedWallGeoEW = null;   // +X/-X 향한 벽 (남북으로 긴 박스)
let sharedWallGeoNS = null;   // +Z/-Z 향한 벽 (동서로 긴 박스)

let spawnPortal = null;

// ---------------------------------------------------------------------------
// Init / Start
// ---------------------------------------------------------------------------

export function initBackrooms(scene) {
  if (gameScene) return;
  gameScene = scene;

  wallTex = buildWallTex();
  floorTex = buildFloorTex();
  ceilTex = buildCeilTex();

  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(2, 2);
  ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping;
  ceilTex.repeat.set(2, 2);
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(2.5, 1.2);

  sharedFloorMat = new THREE.MeshBasicMaterial({ map: floorTex, fog: true });
  sharedCeilMat = new THREE.MeshBasicMaterial({ map: ceilTex, fog: true });
  sharedWallMat = new THREE.MeshBasicMaterial({ map: wallTex, fog: true });

  sharedFloorGeo = new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE);
  sharedCeilGeo = new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE);
  // Box로 바꿔서 실제 두께 있는 벽 — 모서리/엣지에서도 벽 내부가 보여 몰입감↑
  sharedWallGeoEW = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, CELL_SIZE);
  sharedWallGeoNS = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, WALL_THICKNESS);

  const canvas = document.getElementById('game-canvas');
  const parent = canvas && canvas.parentElement;
  if (!parent) return;
  if (getComputedStyle(parent).position === 'static') {
    parent.style.position = 'relative';
  }

  hud = document.createElement('div');
  hud.className = 'backrooms-hud';
  Object.assign(hud.style, {
    position: 'absolute',
    top: '8px',
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#f4d97e',
    font: 'bold 13px "Courier New", monospace',
    textShadow: '0 0 6px #000, 0 0 2px #000',
    pointerEvents: 'none',
    zIndex: '5',
    letterSpacing: '0.08em',
    display: 'none',
  });
  hud.textContent = '0.0 m';
  parent.appendChild(hud);

  startOverlay = document.createElement('div');
  startOverlay.className = 'backrooms-start';
  Object.assign(startOverlay.style, {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#fff',
    font: 'bold 13px "Courier New", monospace',
    textShadow: '0 0 6px #000, 0 0 2px #000',
    pointerEvents: 'none',
    zIndex: '6',
    textAlign: 'center',
    letterSpacing: '0.12em',
  });
  startOverlay.innerHTML =
    `<div style="color:#f4d97e;font-size:16px">BACKROOMS</div>` +
    `<div style="margin-top:10px;opacity:.85">PRESS <b>O</b> TO ENTER</div>`;
  parent.appendChild(startOverlay);
}

export function startBackrooms() {
  if (!gameScene || running) return;
  running = true;
  virtualPos.set(0, 0, 0);
  worldVel.set(0, 0, 0);
  portalTime = 0;

  originalBg = gameScene.background;
  originalFog = gameScene.fog;
  gameScene.background = new THREE.Color(FOG_COLOR);
  gameScene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);

  createSpawnPortal();
  updateCellWindow();

  if (startOverlay) startOverlay.style.display = 'none';
  if (hud) { hud.style.display = 'block'; hud.textContent = '0.0 m'; }
}

// ---------------------------------------------------------------------------
// Public input / accessors
// ---------------------------------------------------------------------------

export function setWorldVelocity(vx, vz) {
  worldVel.set(vx, 0, vz);
}

export function getPlayerY() { return 0; }
export function isBackroomsRunning() { return running; }

// 카메라를 "플레이어와 같은 쪽"으로 clamp. 로드된 모든 닫힌 엣지를 순회.
// 플레이어가 cell (pcx,pcz)에 있을 때:
//   - cx < pcx 셀의 east wall: 플레이어는 wall의 동쪽 → 카메라도 동쪽이어야
//   - cx >= pcx 셀의 east wall: 플레이어는 서쪽 → 카메라도 서쪽
//   - cz 쪽도 동일 로직
// 벽의 범위(Z 또는 X 한 셀 분량) 내에 있을 때만 유효.
// 매 프레임 ideal 위치에서 시작하므로 "복귀 안 됨" 현상 해소.
export function clampCameraInCorridor(pos, margin) {
  if (!running) return;
  const m = margin === undefined ? 0.3 : margin;
  const halfC = CELL_SIZE / 2;
  const pcx = Math.round(virtualPos.x / CELL_SIZE);
  const pcz = Math.round(virtualPos.z / CELL_SIZE);

  for (const cell of activeCells.values()) {
    const { cx, cz } = cell;

    // East wall (셀 cx,cz와 cx+1,cz 사이). worldX = (cx+0.5)*CELL_SIZE
    if (!isEdgeOpen(cx, cz, cx + 1, cz)) {
      const wallRX = (cx + 0.5) * CELL_SIZE - virtualPos.x;
      const zMin = cz * CELL_SIZE - halfC - virtualPos.z;
      const zMax = cz * CELL_SIZE + halfC - virtualPos.z;
      if (pos.z >= zMin - m && pos.z <= zMax + m) {
        if (pcx <= cx && pos.x > wallRX - m) pos.x = wallRX - m;      // 플레이어 서쪽 → 카메라도 서쪽
        if (pcx > cx && pos.x < wallRX + m) pos.x = wallRX + m;       // 플레이어 동쪽 → 카메라도 동쪽
      }
    }

    // North wall (셀 cx,cz와 cx,cz-1 사이). worldZ = (cz-0.5)*CELL_SIZE
    if (!isEdgeOpen(cx, cz, cx, cz - 1)) {
      const wallRZ = (cz - 0.5) * CELL_SIZE - virtualPos.z;
      const xMin = cx * CELL_SIZE - halfC - virtualPos.x;
      const xMax = cx * CELL_SIZE + halfC - virtualPos.x;
      if (pos.x >= xMin - m && pos.x <= xMax + m) {
        if (pcz >= cz && pos.z < wallRZ + m) pos.z = wallRZ + m;      // 플레이어 남쪽 → 카메라도 남쪽
        if (pcz < cz && pos.z > wallRZ - m) pos.z = wallRZ - m;       // 플레이어 북쪽 → 카메라도 북쪽
      }
    }
  }

  const minY = FLOOR_Y + m;
  const maxY = FLOOR_Y + WALL_HEIGHT - m;
  if (pos.y < minY) pos.y = minY;
  if (pos.y > maxY) pos.y = maxY;
}

// ---------------------------------------------------------------------------
// Update loop
// ---------------------------------------------------------------------------

export function updateBackrooms(delta) {
  if (!running) return;

  // 현재 셀 기준으로 이동 delta를 clamp (이동 후 clamp 방식은 셀 경계에서 teleport 튐)
  const dx = -worldVel.x * delta;
  const dz = -worldVel.z * delta;
  const pcx = Math.round(virtualPos.x / CELL_SIZE);
  const pcz = Math.round(virtualPos.z / CELL_SIZE);
  const cellCX = pcx * CELL_SIZE;
  const cellCZ = pcz * CELL_SIZE;
  const innerHalf = CELL_SIZE / 2 - PLAYER_HALF;

  let newX = virtualPos.x + dx;
  let newZ = virtualPos.z + dz;

  if (newX > cellCX + innerHalf && !isEdgeOpen(pcx, pcz, pcx + 1, pcz)) newX = cellCX + innerHalf;
  if (newX < cellCX - innerHalf && !isEdgeOpen(pcx, pcz, pcx - 1, pcz)) newX = cellCX - innerHalf;
  if (newZ > cellCZ + innerHalf && !isEdgeOpen(pcx, pcz, pcx, pcz + 1)) newZ = cellCZ + innerHalf;
  if (newZ < cellCZ - innerHalf && !isEdgeOpen(pcx, pcz, pcx, pcz - 1)) newZ = cellCZ - innerHalf;

  virtualPos.x = newX;
  virtualPos.z = newZ;

  updateCellWindow();

  for (const cell of activeCells.values()) {
    cell.group.position.set(
      cell.worldX - virtualPos.x,
      0,
      cell.worldZ - virtualPos.z
    );
  }

  portalTime += delta;
  if (spawnPortal) {
    spawnPortal.position.set(
      -virtualPos.x,
      FLOOR_Y + 0.03,
      -virtualPos.z
    );
    spawnPortal.rotation.z = portalTime * 0.6;
  }

  const dist = Math.hypot(virtualPos.x, virtualPos.z);
  if (hud) hud.textContent = dist.toFixed(1) + ' m';
}

// ---------------------------------------------------------------------------
// Random edges (미로 구조)
// ---------------------------------------------------------------------------

function edgeKey(x1, z1, x2, z2) {
  const lx = Math.min(x1, x2), lz = Math.min(z1, z2);
  const hx = Math.max(x1, x2), hz = Math.max(z1, z2);
  return `${lx},${lz}|${hx},${hz}`;
}

function isEdgeOpen(x1, z1, x2, z2) {
  // 스폰 셀(0,0)은 항상 4방향 열림 → 플레이어 최초 위치에서 즉시 이동 가능
  if ((x1 === 0 && z1 === 0) || (x2 === 0 && z2 === 0)) return true;

  const key = edgeKey(x1, z1, x2, z2);
  if (activeEdges.has(key)) return activeEdges.get(key);
  const open = Math.random() < EDGE_OPEN_CHANCE;
  activeEdges.set(key, open);
  return open;
}

// ---------------------------------------------------------------------------
// Cell window (load/dispose)
// ---------------------------------------------------------------------------

function cellKey(cx, cz) { return cx + ',' + cz; }

function updateCellWindow() {
  const pcx = Math.round(virtualPos.x / CELL_SIZE);
  const pcz = Math.round(virtualPos.z / CELL_SIZE);

  const needed = new Set();
  for (let dx = -WINDOW_CELLS; dx <= WINDOW_CELLS; dx++) {
    for (let dz = -WINDOW_CELLS; dz <= WINDOW_CELLS; dz++) {
      const cx = pcx + dx;
      const cz = pcz + dz;
      const key = cellKey(cx, cz);
      needed.add(key);
      if (!activeCells.has(key)) {
        activeCells.set(key, createCell(cx, cz));
      }
    }
  }

  for (const [key, cell] of activeCells) {
    if (!needed.has(key)) {
      gameScene.remove(cell.group);
      activeCells.delete(key);
      // 양쪽 셀이 모두 언로드된 엣지는 캐시 제거 → 다음 방문 시 새 랜덤
      const { cx, cz } = cell;
      forgetEdgeIfIsolated(cx, cz, cx + 1, cz);
      forgetEdgeIfIsolated(cx, cz, cx - 1, cz);
      forgetEdgeIfIsolated(cx, cz, cx, cz + 1);
      forgetEdgeIfIsolated(cx, cz, cx, cz - 1);
    }
  }
}

function forgetEdgeIfIsolated(x1, z1, x2, z2) {
  const k1 = cellKey(x1, z1);
  const k2 = cellKey(x2, z2);
  if (!activeCells.has(k1) && !activeCells.has(k2)) {
    activeEdges.delete(edgeKey(x1, z1, x2, z2));
  }
}

// ---------------------------------------------------------------------------
// Cell mesh
// ---------------------------------------------------------------------------

function createCell(cx, cz) {
  const group = new THREE.Group();
  const halfC = CELL_SIZE / 2;

  const floor = new THREE.Mesh(sharedFloorGeo, sharedFloorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  group.add(floor);

  const ceil = new THREE.Mesh(sharedCeilGeo, sharedCeilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = FLOOR_Y + WALL_HEIGHT;
  group.add(ceil);

  // 각 셀은 east + south 벽만 렌더. west/north는 인접 셀의 east/south로 중복 없이 커버됨
  // (window 가장자리 셀의 바깥쪽 벽은 fog 너머라 안 보여도 무방)

  // East wall — 셀과 (cx+1,cz) 사이
  if (!isEdgeOpen(cx, cz, cx + 1, cz)) {
    const w = new THREE.Mesh(sharedWallGeoEW, sharedWallMat);
    w.position.set(halfC, FLOOR_Y + WALL_HEIGHT / 2, 0);
    group.add(w);
  }
  // South wall — 셀과 (cx,cz+1) 사이
  if (!isEdgeOpen(cx, cz, cx, cz + 1)) {
    const w = new THREE.Mesh(sharedWallGeoNS, sharedWallMat);
    w.position.set(0, FLOOR_Y + WALL_HEIGHT / 2, halfC);
    group.add(w);
  }

  gameScene.add(group);
  return { group, cx, cz, worldX: cx * CELL_SIZE, worldZ: cz * CELL_SIZE };
}

// ---------------------------------------------------------------------------
// Spawn portal (blue ring at world origin)
// ---------------------------------------------------------------------------

function createSpawnPortal() {
  if (spawnPortal) return;
  const group = new THREE.Group();

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.5, 48),
    new THREE.MeshBasicMaterial({
      color: PORTAL_COLOR,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      fog: true,
    })
  );
  group.add(ring);

  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 1.9, 48),
    new THREE.MeshBasicMaterial({
      color: 0xaadcff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      fog: true,
    })
  );
  group.add(innerRing);

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 32),
    new THREE.MeshBasicMaterial({
      color: 0x0066cc,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
      fog: true,
    })
  );
  group.add(disc);

  group.rotation.x = -Math.PI / 2;
  group.position.set(0, FLOOR_Y + 0.03, 0);

  gameScene.add(group);
  spawnPortal = group;
}

// ---------------------------------------------------------------------------
// Texture builders
// ---------------------------------------------------------------------------

function buildWallTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#c9a34a';
  g.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 6) {
    g.fillStyle = `rgba(90,60,20,${0.04 + Math.random() * 0.05})`;
    g.fillRect(x, 0, 2, 128);
  }
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(60,40,20,${0.08 + Math.random() * 0.2})`;
    g.beginPath();
    g.arc(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 16, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#a07020';
  g.fillRect(0, 112, 128, 3);
  return new THREE.CanvasTexture(c);
}

function buildFloorTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#6a5020';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 600; i++) {
    const r = 50 + Math.random() * 40;
    const gr = 35 + Math.random() * 30;
    const b = 10 + Math.random() * 20;
    g.fillStyle = `rgba(${r|0},${gr|0},${b|0},${0.4 + Math.random() * 0.5})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  for (let i = 0; i < 22; i++) {
    g.fillStyle = `rgba(25,18,10,${0.2 + Math.random() * 0.3})`;
    g.beginPath();
    g.arc(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 9, 0, Math.PI * 2);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}

function buildCeilTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e6d9b0';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#8f7d55';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(64, 0); g.lineTo(64, 128);
  g.moveTo(0, 64); g.lineTo(128, 64);
  g.stroke();
  g.strokeRect(1, 1, 126, 126);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = `rgba(120,100,60,${0.1 + Math.random() * 0.15})`;
    g.beginPath();
    g.arc(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 10, 0, Math.PI * 2);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}
