// dog.js — 몽구 컨트롤러: GLB 로드·정규화 + 걷기 1클립 위 프로시저럴 레이어
// 좌표계: 몽구는 x=0 고정(월드가 흐름), +x가 진행 방향. track.js 박스 규약 사용.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { toRetroMaterial } from './materials.js';

const HEIGHT = 0.9;                 // 정규화 목표 키
const JUMP = { V0: 3.4, V0_HOLD_BONUS: 0.5, GRAVITY: 12, CUT: 0.45 };  // 홀드 = 초기 속도 보너스, 조기 release = 상승 컷
const SQUASH_SEC = 0.16;
const TAIL_BONES = ['tailstart', 'tail1', 'tail2', 'tail3'];
const EAR_BONES = ['earend', 'R_earend'];

export async function loadDog(url) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);

  const model = gltf.scene;
  const bones = {};
  model.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh) { o.frustumCulled = false; o.material = toRetroMaterial(o.material); }
  });

  // 믹서·클립 (단일 걷기 클립, in-place)
  const mixer = new THREE.AnimationMixer(model);
  const clip = gltf.animations[0];
  const action = mixer.clipAction(clip);
  action.play();
  mixer.update(0.001);              // 첫 포즈 적용 (바인드 포즈 회피)
  model.updateMatrixWorld(true);

  // 정규화 — 스킨 메시는 precise bbox 필수 (아니면 바인드 포즈 기준으로 어긋남)
  const box = new THREE.Box3().setFromObject(model, true);
  const size = box.getSize(new THREE.Vector3());
  const s = HEIGHT / size.y;
  model.scale.setScalar(s);
  model.updateMatrixWorld(true);
  box.setFromObject(model, true);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
  const length = (box.max.z - box.min.z);   // 회전 전 몸길이(원래 forward = +z)

  // root: 요(진행 방향 +x) — pitch는 model.rotation.x 로 (요 이후 로컬 x = 화면 좌우축)
  const root = new THREE.Group();
  root.add(model);
  root.rotation.y = Math.PI / 2;

  // blob shadow — 착지점 가독성
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 14),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1.3, 0.8, 1);
  shadow.position.y = 0.012;
  const object3d = new THREE.Group();
  object3d.add(root, shadow);

  // Hips에 상수 scale 키(0.9248)가 있어 오버라이드는 항상 "곱"으로
  const hipsBaseScale = new THREE.Vector3();

  // 상태
  const st = {
    mode: 'attract',        // attract | run | dead
    jumpY: 0, vy: 0, airborne: false, holdingJump: false,
    duck: false,
    squashT: 0,             // 착지 스쿼시 잔여 시간
    barkT: 0,
    t: 0,                   // 누적 시간(웨이브용)
    speedNorm: 0,
    lookAt: null,           // {nx, ny} -1..1 (attract 시선)
  };

  const qTmp = new THREE.Quaternion();
  const AX = new THREE.Vector3(1, 0, 0);
  const AZ = new THREE.Vector3(0, 0, 1);
  const AY = new THREE.Vector3(0, 1, 0);

  function applyBoneOverrides(dt) {
    // 반드시 mixer.update() 직후 호출
    const idle = st.mode === 'attract' ? 1 : Math.max(0, 0.35 - st.speedNorm);
    if (bones.chest) {
      bones.chest.quaternion.multiply(qTmp.setFromAxisAngle(AX, Math.sin(st.t * Math.PI * 0.7) * 0.035 * idle));
    }
    const wagSpeed = st.mode === 'attract' ? 2.5 : 1.2 + st.speedNorm;
    TAIL_BONES.forEach((n, i) => {
      if (bones[n]) bones[n].quaternion.multiply(qTmp.setFromAxisAngle(AZ, Math.sin(st.t * Math.PI * 2 * wagSpeed - i * 0.7) * 0.25));
    });
    EAR_BONES.forEach((n, i) => {
      if (bones[n]) bones[n].quaternion.multiply(qTmp.setFromAxisAngle(AX, Math.sin(st.t * 7 + i * 1.3) * 0.05 * (0.3 + st.speedNorm + (st.airborne ? 0.6 : 0))));
    });
    if (bones.head) {
      if (st.mode === 'attract' && st.lookAt) {
        bones.head.quaternion.multiply(qTmp.setFromAxisAngle(AY, THREE.MathUtils.clamp(-st.lookAt.nx, -1, 1) * 0.45));
        bones.head.quaternion.multiply(qTmp.setFromAxisAngle(AX, THREE.MathUtils.clamp(-st.lookAt.ny, -1, 1) * 0.3));
      } else if (st.mode === 'attract') {
        bones.head.quaternion.multiply(qTmp.setFromAxisAngle(AY, Math.sin(st.t * 0.9) * 0.25));
      }
      if (st.duck) bones.head.quaternion.multiply(qTmp.setFromAxisAngle(AX, 0.5));
      if (st.barkT > 0) bones.head.quaternion.multiply(qTmp.setFromAxisAngle(AX, -Math.sin(st.barkT * Math.PI / 0.25) * 0.35));
    }
    if (bones.Hips) {
      if (hipsBaseScale.lengthSq() === 0) hipsBaseScale.copy(bones.Hips.scale);
      if (st.mode === 'attract') bones.Hips.scale.multiplyScalar(1 + Math.sin(st.t * Math.PI * 0.7) * 0.02);
    }
  }

  const dog = {
    object3d,
    bones,

    jump(hold = false) {
      if (st.mode !== 'run' || st.airborne || st.duck) return false;
      st.airborne = true;
      st.holdingJump = hold;
      st.vy = JUMP.V0 + (hold ? JUMP.V0_HOLD_BONUS : 0);
      action.paused = true;
      action.time = 0.25;           // 앞다리 든 프레임에 프리즈
      return true;
    },
    jumpEnd() {
      st.holdingJump = false;
      if (st.airborne && st.vy > 0) st.vy *= JUMP.CUT;   // 조기 release = 낮은 점프
    },
    duck(on) {
      if (st.mode !== 'run' || st.airborne) { st.duck = false; return; }
      st.duck = !!on;
    },
    bark() { st.barkT = 0.25; },
    die() {
      st.mode = 'dead';
      action.paused = true;
      st.duck = false;
    },
    reset(mode = 'attract') {
      st.mode = mode;
      st.jumpY = 0; st.vy = 0; st.airborne = false; st.duck = false;
      st.squashT = 0; st.barkT = 0;
      action.paused = false;
      action.time = 0;
      root.position.y = 0;
      model.rotation.x = 0;
      root.scale.set(1, 1, 1);
    },
    setMode(mode) { st.mode = mode; if (mode === 'run') action.paused = false; },
    setLookAt(nxny) { st.lookAt = nxny; },
    get airborne() { return st.airborne; },
    get ducking() { return st.duck; },
    get mode() { return st.mode; },

    // track.collide용 박스 {x(중심)=0, y(바닥), w, h}
    box() {
      const h = HEIGHT * (st.duck ? 0.6 : 1);
      return { x: 0, y: st.jumpY, w: length * 0.8, h };
    },

    update(dt, { speedNorm = 0, lookAt = null } = {}) {
      st.t += dt;
      st.speedNorm = speedNorm;
      if (lookAt !== undefined) st.lookAt = lookAt;
      if (st.barkT > 0) st.barkT -= dt;

      if (st.mode === 'run') {
        action.timeScale = 2.2 + speedNorm * 0.8;   // 트롯 → 질주
        if (st.mode === 'run' && !st.airborne) action.paused = false;
      } else if (st.mode === 'attract') {
        action.timeScale = 0;                        // 정지 포즈 + 프로시저럴만
        action.paused = false;
        action.time = 0.55;                          // 네 발 착지 프레임
      }

      // 점프 물리 (12fps 스텝 그대로 적분 — 계단식 궤적이 곧 레트로 감)
      if (st.airborne) {
        st.vy -= JUMP.GRAVITY * dt;
        st.jumpY += st.vy * dt;
        model.rotation.x = st.vy > 0 ? -0.26 : 0.17;   // 상승 −15° / 하강 +10°
        if (st.jumpY <= 0) {
          st.jumpY = 0; st.airborne = false; st.vy = 0;
          st.squashT = SQUASH_SEC;
          model.rotation.x = 0;
          if (st.mode === 'run') action.paused = false;
        }
      }
      root.position.y = st.jumpY;

      // 스쿼시&스트레치
      if (st.mode === 'dead') {
        root.scale.set(1.25, 0.28, 1.25);
      } else if (st.squashT > 0) {
        st.squashT -= dt;
        root.scale.set(1.12, 0.85, 1.12);
      } else if (st.airborne && st.vy > 1.5) {
        root.scale.set(0.95, 1.08, 0.95);
      } else if (st.duck) {
        root.scale.set(1.05, 0.6, 1.05);
      } else {
        root.scale.set(1, 1, 1);
      }

      // 그림자 — 점프 높이에 따라 축소
      const sh = 1 / (1 + st.jumpY * 1.2);
      shadow.scale.set(1.3 * sh, 0.8 * sh, 1);
      shadow.material.opacity = 0.35 * sh;

      mixer.update(dt);
      applyBoneOverrides(dt);
    },
  };

  return dog;
}
