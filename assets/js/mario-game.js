import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOOPING_ANIMATIONS = new Set([
  'idle', 'walk', 'walk_loop', 'walk2', 'run',
  'Idle', 'Run', 'Dance', 'MoonWalk',
]);

const CROSSFADE_DURATION = 0.3;
const IDLE_ROTATION_SPEED = 0.15; // radians per second when idle
const BACKGROUND_COLOR = 0x0a0a0a;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let scene, camera, renderer, mixer, clock;
let model = null;
let animationActions = {};  // name -> THREE.AnimationAction
let currentActionName = '';
let currentAction = null;
let previousLoopActionName = 'Idle';
let screenOn = true;
let isIdleRotating = true;
let animationFrameId = null;

// Idle/MoonWalk 번갈아 재생
let idleCycleTimer = null;
let idleCycleState = 'Idle'; // 'Idle' or 'MoonWalk'
let moonwalkLoopCount = 0;
const MOONWALK_LOOPS = 5;

// ---------------------------------------------------------------------------
// Scene setup
// ---------------------------------------------------------------------------

function createScene(canvas) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND_COLOR);

  const container = canvas.parentElement || canvas;
  const width = container.clientWidth || 320;
  const height = container.clientHeight || 260;

  // Camera at a slight angle, not perfectly front-on
  camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(0, 5.0, 10.0);
  camera.lookAt(0, 4.5, 0);

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.8;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
  dirLight.position.set(3, 4, 5);
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
  fillLight.position.set(-2, 1, -3);
  scene.add(fillLight);

  clock = new THREE.Clock();
}

// ---------------------------------------------------------------------------
// Resize handler
// ---------------------------------------------------------------------------

function handleResize(canvas) {
  const container = canvas.parentElement || canvas;
  const width = container.clientWidth || 320;
  const height = container.clientHeight || 260;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// ---------------------------------------------------------------------------
// GLB loader
// ---------------------------------------------------------------------------

function loadModel() {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      '/assets/glb/woody_final.glb',
      (gltf) => {
        model = gltf.scene;

        // Center and scale the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetHeight = 2.0;
        const scale = targetHeight / maxDim;
        model.scale.setScalar(scale);

        // Recalculate after scaling
        box.setFromObject(model);
        box.getCenter(center);
        model.position.sub(center);
        model.position.y += (size.y * scale) / 2;

        // Face the camera initially
        model.rotation.y = Math.PI * 0.1;

        scene.add(model);

        // Extract animations
        mixer = new THREE.AnimationMixer(model);

        const clipMap = {};
        gltf.animations.forEach((clip) => {
          clipMap[clip.name] = clip;
        });

        // Create actions for all clips
        Object.keys(clipMap).forEach((name) => {
          const action = mixer.clipAction(clipMap[name]);
          if (LOOPING_ANIMATIONS.has(name)) {
            action.loop = THREE.LoopRepeat;
          } else {
            action.loop = THREE.LoopOnce;
            action.clampWhenFinished = true;
          }
          animationActions[name] = action;
        });

        // Listen for one-shot animations finishing
        mixer.addEventListener('finished', onAnimationFinished);

        // Start with idle cycle
        startIdleCycle();

        resolve(model);
      },
      undefined,
      (error) => {
        console.error('Failed to load model:', error);
        reject(error);
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Animation blending
// ---------------------------------------------------------------------------

function playAnimation(name, duration) {
  if (duration === undefined) duration = CROSSFADE_DURATION;

  // Skip if same animation is already playing
  if (name === currentActionName) return;

  const newAction = animationActions[name];
  if (!newAction) return;

  // Track looping animations for return-after-oneshot
  if (LOOPING_ANIMATIONS.has(name)) {
    previousLoopActionName = name;
  }

  // Track idle state for auto-rotation
  isIdleRotating = (name === 'idle');

  // Reset the new action so it plays from the start
  newAction.reset();
  newAction.play();

  // Crossfade from current to new
  if (currentAction) {
    currentAction.crossFadeTo(newAction, duration, true);
  }

  currentAction = newAction;
  currentActionName = name;
}

function onAnimationFinished(event) {
  const finishedClip = event.action.getClip();
  const finishedName = finishedClip.name;

  if (finishedName === 'MoonWalk') {
    startIdleCycle();
    return;
  }

  // If the finished animation is a one-shot, return to idle cycle
  if (!LOOPING_ANIMATIONS.has(finishedName)) {
    startIdleCycle();
  }
}

// Idle ↔ MoonWalk 번갈아 재생
function startIdleCycle() {
  stopIdleCycle();
  idleCycleState = 'Idle';
  moonwalkLoopCount = 0;
  playAnimation(resolveAnim('Idle', 'idle'), 0.3);

  // Idle 재생 후 일정 시간 뒤 MoonWalk로 전환
  idleCycleTimer = setTimeout(() => {
    switchToMoonWalk();
  }, 10000); // Idle 10초 후 MoonWalk
}

function switchToMoonWalk() {
  if (currentActionName !== 'Idle' && currentActionName !== 'idle') return;

  idleCycleState = 'MoonWalk';

  const moonAction = animationActions['MoonWalk'];
  if (!moonAction) { startIdleCycle(); return; }

  moonAction.loop = THREE.LoopRepeat;
  moonAction.repetitions = MOONWALK_LOOPS;
  moonAction.clampWhenFinished = true;
  playAnimation('MoonWalk', 0.3);
}

function stopIdleCycle() {
  if (idleCycleTimer) {
    clearTimeout(idleCycleTimer);
    idleCycleTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Gamepad event handlers
// ---------------------------------------------------------------------------

function setupGamepadControls() {
  // D-pad events
  document.addEventListener('mario-dpad', (event) => {
    const direction = event.detail && event.detail.direction;

    switch (direction) {
      case 'right':
        if (model) model.rotation.y = Math.PI * 0.5;
        isIdleRotating = false;
        stopIdleCycle();
        playAnimation(resolveAnim('Run', 'run'), 0.2);
        break;

      case 'left':
        if (model) model.rotation.y = -Math.PI * 0.5;
        isIdleRotating = false;
        stopIdleCycle();
        playAnimation(resolveAnim('Run', 'run'), 0.2);
        break;

      case 'up':
        if (model) model.rotation.y = Math.PI;
        isIdleRotating = false;
        stopIdleCycle();
        playAnimation(resolveAnim('Run', 'run'), 0.2);
        break;

      case 'down':
        if (model) model.rotation.y = 0;
        isIdleRotating = false;
        stopIdleCycle();
        playAnimation(resolveAnim('Run', 'run'), 0.2);
        break;

      case 'none':
      default:
        if (model) model.rotation.y = Math.PI * 0.1;
        startIdleCycle();
        break;
    }
  });

  // Button events
  document.addEventListener('mario-button', (event) => {
    const button = event.detail && event.detail.button;

    switch (button) {
      case 'a':
        stopIdleCycle();
        playAnimation(resolveAnim('Jump', 'jump'), 0.15);
        break;

      case 'b':
        stopIdleCycle();
        playAnimation(resolveAnim('Punch', 'attack'), 0.15);
        break;

      case 'x':
        stopIdleCycle();
        playAnimation(resolveAnim('Dance', 'pose1'), 0.15);
        break;

      case 'y':
        stopIdleCycle();
        playAnimation(resolveAnim('Hit', 'hit'), 0.15);
        break;

      case 'option':
        document.dispatchEvent(new CustomEvent('mario-screen-toggle'));
        break;
    }
  });
}

/**
 * Resolve the first available animation name from the given candidates.
 * Falls back to the first available animation if none match.
 */
function resolveAnim(...names) {
  for (const name of names) {
    if (animationActions[name]) return name;
  }
  return currentActionName || Object.keys(animationActions)[0] || 'idle';
}

// ---------------------------------------------------------------------------
// Screen on/off
// ---------------------------------------------------------------------------
// Analog stick controls
// ---------------------------------------------------------------------------

let cameraBasePos = { x: 0, y: 5.0, z: 10.0 };
let cameraBaseLookAt = { x: 0, y: 4.5, z: 0 };

function setupAnalogSticks() {
  setupStick('analog-left', 'analog-cap-left', onLeftStick, onLeftStickRelease);
  setupStick('analog-right', 'analog-cap-right', onRightStick, onRightStickRelease);
}

function setupStick(containerId, capId, onMove, onRelease) {
  const container = document.getElementById(containerId);
  const cap = document.getElementById(capId);
  if (!container || !cap) return;

  let dragging = false;
  let centerX = 0, centerY = 0;
  const maxDist = 15;

  function startDrag(clientX, clientY) {
    dragging = true;
    const rect = container.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
  }

  function moveDrag(clientX, clientY) {
    if (!dragging) return;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }
    cap.style.transform = `translate(${dx}px, ${dy}px)`;
    onMove(dx / maxDist, dy / maxDist);
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    cap.style.transform = '';
    onRelease();
  }

  // Mouse
  container.addEventListener('mousedown', (e) => { e.preventDefault(); startDrag(e.clientX, e.clientY); });
  window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
  window.addEventListener('mouseup', endDrag);

  // Touch
  container.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY);
  });
  window.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const t = e.touches[0];
    moveDrag(t.clientX, t.clientY);
  });
  window.addEventListener('touchend', endDrag);
}

// 왼쪽 스틱: 캐릭터 이동 (방향 반전)
function onLeftStick(nx, ny) {
  const dist = Math.sqrt(nx * nx + ny * ny);
  if (dist < 0.2) return;

  stopIdleCycle();
  isIdleRotating = false;

  // 방향 반전: nx, ny 부호 뒤집기
  const angle = Math.atan2(nx, ny);
  if (model) model.rotation.y = angle;

  playAnimation(resolveAnim('Run', 'run'), 0.2);
}

function onLeftStickRelease() {
  if (model) model.rotation.y = Math.PI * 0.1;
  startIdleCycle();
}

// 오른쪽 스틱: 카메라 orbital 회전 (연속)
let cameraOrbitAngle = 0;
let cameraOrbitPitch = 0.3;
const CAMERA_ORBIT_RADIUS = 10.0;
const CAMERA_PITCH_MIN = -0.2;
const CAMERA_PITCH_MAX = 1.2;
let rightStickNx = 0, rightStickNy = 0;
let rightStickInterval = null;

function updateCameraOrbit() {
  if (!camera) return;

  cameraOrbitAngle += rightStickNx * 0.03;
  cameraOrbitPitch += rightStickNy * -0.02;
  cameraOrbitPitch = Math.max(CAMERA_PITCH_MIN, Math.min(CAMERA_PITCH_MAX, cameraOrbitPitch));

  const x = CAMERA_ORBIT_RADIUS * Math.sin(cameraOrbitAngle) * Math.cos(cameraOrbitPitch);
  const y = CAMERA_ORBIT_RADIUS * Math.sin(cameraOrbitPitch) + cameraBaseLookAt.y;
  const z = CAMERA_ORBIT_RADIUS * Math.cos(cameraOrbitAngle) * Math.cos(cameraOrbitPitch);

  camera.position.set(x, y, z);
  camera.lookAt(cameraBaseLookAt.x, cameraBaseLookAt.y, cameraBaseLookAt.z);
}

function onRightStick(nx, ny) {
  rightStickNx = nx;
  rightStickNy = ny;
  if (!rightStickInterval) {
    rightStickInterval = setInterval(updateCameraOrbit, 16);
  }
}

function onRightStickRelease() {
  rightStickNx = 0;
  rightStickNy = 0;
  if (rightStickInterval) {
    clearInterval(rightStickInterval);
    rightStickInterval = null;
  }
}

// ---------------------------------------------------------------------------
// Screen on/off
// ---------------------------------------------------------------------------

function setupScreenToggle() {
  document.addEventListener('mario-screen-toggle', () => {
    screenOn = !screenOn;

    const overlay = document.getElementById('crt-screen-off');
    const led = document.getElementById('crt-led');
    const redLed = document.querySelector('.crt-led-dot.red');
    const touchLight = document.querySelector('.touchpad-light');

    if (!screenOn) {
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      if (overlay) overlay.classList.add('is-off');
      if (led) led.classList.add('is-off');
      if (redLed) redLed.classList.add('is-off');
      if (touchLight) touchLight.classList.add('is-off');
    } else {
      renderer.setClearColor(BACKGROUND_COLOR, 1);
      if (overlay) overlay.classList.remove('is-off');
      if (led) led.classList.remove('is-off');
      if (redLed) redLed.classList.remove('is-off');
      if (touchLight) touchLight.classList.remove('is-off');
    }
  });
}

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------

function animate() {
  animationFrameId = requestAnimationFrame(animate);

  if (!screenOn) return;

  const delta = clock.getDelta();

  // Subtle idle auto-rotation
  if (isIdleRotating && model) {
    model.rotation.y += IDLE_ROTATION_SPEED * delta;
  }

  if (mixer) {
    mixer.update(delta);
  }

  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initMarioGame() {
  const canvas = document.getElementById('mario-canvas');
  if (!canvas) return;

  // 기존 scene이 있으면 정리
  if (renderer) return;

  createScene(canvas);

  window.addEventListener('resize', () => handleResize(canvas));

  setupGamepadControls();
  setupScreenToggle();
  setupAnalogSticks();

  loadModel()
    .then(() => {
      animate();
    })
    .catch((err) => {
      console.error('Mario game initialization failed:', err);
    });
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMarioGame);
} else {
  initMarioGame();
}
