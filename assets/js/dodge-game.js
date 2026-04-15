import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Dodge Arena — prototype
// - 플레이어 원점 고정, 월드(ground UV + enemies)가 반대로 이동하여 이동감 연출
// - 원형 경계 안으로 사방에서 투사체가 날아옴 → 회피 생존 시간이 점수
// ---------------------------------------------------------------------------

const ARENA_RADIUS = 8;
const PLAYER_RADIUS = 0.55;
const ENEMY_BASE_SPEED = 5.0;
const SPAWN_INTERVAL_START = 1.2;
const JUMP_DURATION = 0.55;
const JUMP_HEIGHT = 1.2;
const LOW_PROJECTILE_CHANCE = 0.35;
const LOW_DODGE_MIN_Y = 0.55;

let gameScene = null;
let ground = null;
let arenaRing = null;
let hud = null;

const enemies = [];
let spawnTimer = SPAWN_INTERVAL_START;
let elapsed = 0;
let running = false;
let dead = false;

const worldVel = new THREE.Vector3();
let playerY = 0;
let jumpT = 0;

export function initDodgeGame(scene) {
  if (gameScene) return;
  gameScene = scene;

  const tex = buildGridTexture();
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_RADIUS * 5, ARENA_RADIUS * 5),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  ground.rotation.x = -Math.PI / 2;
  gameScene.add(ground);

  arenaRing = new THREE.Mesh(
    new THREE.RingGeometry(ARENA_RADIUS - 0.12, ARENA_RADIUS, 64),
    new THREE.MeshBasicMaterial({
      color: 0xff3355,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    })
  );
  arenaRing.rotation.x = -Math.PI / 2;
  arenaRing.position.y = 0.02;
  gameScene.add(arenaRing);

  hud = document.createElement('div');
  hud.className = 'dodge-hud';
  Object.assign(hud.style, {
    position: 'absolute',
    top: '8px',
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#fff',
    font: 'bold 13px "Courier New", monospace',
    textShadow: '0 0 6px #000, 0 0 2px #000',
    pointerEvents: 'none',
    textAlign: 'center',
    zIndex: '5',
    letterSpacing: '0.05em',
  });
  hud.textContent = '0.0s';

  const canvas = document.getElementById('game-canvas');
  if (canvas && canvas.parentElement) {
    const parent = canvas.parentElement;
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }
    parent.appendChild(hud);
  }

  running = true;
}

function buildGridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#15151f';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#3d3d66';
  g.lineWidth = 2;
  g.strokeRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function setWorldVelocity(vx, vz) {
  worldVel.set(vx, 0, vz);
}

export function triggerJump() {
  if (!running || dead) return;
  if (jumpT <= 0) jumpT = JUMP_DURATION;
}

export function getPlayerY() {
  return playerY;
}

export function isDead() {
  return dead;
}

function spawnEnemy() {
  const angle = Math.random() * Math.PI * 2;
  const dist = ARENA_RADIUS + 1.5;
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;

  const low = Math.random() < LOW_PROJECTILE_CHANCE;
  const yBase = low ? 0.3 : 1.3;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 1.0),
    new THREE.MeshBasicMaterial({ color: low ? 0xffaa33 : 0xff3355 })
  );
  mesh.position.set(x, yBase, z);
  mesh.lookAt(0, yBase, 0);

  const speed = ENEMY_BASE_SPEED + Math.min(elapsed * 0.08, 5.0);
  const vel = new THREE.Vector3(-x, 0, -z).normalize().multiplyScalar(speed);

  gameScene.add(mesh);
  enemies.push({ mesh, vel, low });
}

function disposeEnemy(e) {
  gameScene.remove(e.mesh);
  e.mesh.geometry.dispose();
  e.mesh.material.dispose();
}

export function updateDodgeGame(delta) {
  if (!running) return;

  if (!dead) {
    elapsed += delta;

    spawnTimer -= delta;
    if (spawnTimer <= 0) {
      spawnEnemy();
      spawnTimer = Math.max(0.28, SPAWN_INTERVAL_START - elapsed * 0.02);
    }

    if (jumpT > 0) {
      jumpT -= delta;
      const t = 1 - jumpT / JUMP_DURATION;
      playerY = Math.sin(t * Math.PI) * JUMP_HEIGHT;
    } else {
      playerY = 0;
    }
  }

  if (ground && ground.material.map) {
    ground.material.map.offset.x += -worldVel.x * delta * 0.05;
    ground.material.map.offset.y += worldVel.z * delta * 0.05;
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.mesh.position.addScaledVector(e.vel, delta);
    e.mesh.position.addScaledVector(worldVel, delta);

    if (!dead) {
      const dx = e.mesh.position.x;
      const dz = e.mesh.position.z;
      const d2 = dx * dx + dz * dz;
      const hitR = PLAYER_RADIUS + 0.25;

      if (d2 < hitR * hitR) {
        if (!(e.low && playerY > LOW_DODGE_MIN_Y)) {
          endGame();
        }
      }
    }

    const ox = e.mesh.position.x;
    const oz = e.mesh.position.z;
    if (ox * ox + oz * oz > ARENA_RADIUS * 3 * (ARENA_RADIUS * 3)) {
      disposeEnemy(e);
      enemies.splice(i, 1);
    }
  }

  if (hud && !dead) hud.textContent = elapsed.toFixed(1) + 's';
}

function endGame() {
  dead = true;
  if (hud) {
    hud.innerHTML =
      `<div style="color:#ff5577">GAME OVER</div>` +
      `<div style="font-size:16px;margin-top:2px">${elapsed.toFixed(1)}s</div>` +
      `<div style="font-size:10px;opacity:.7;margin-top:4px">OPTION to restart</div>`;
  }
}

export function restartDodgeGame() {
  while (enemies.length) {
    disposeEnemy(enemies.pop());
  }
  elapsed = 0;
  spawnTimer = SPAWN_INTERVAL_START;
  dead = false;
  running = true;
  playerY = 0;
  jumpT = 0;
  if (hud) hud.textContent = '0.0s';
}
