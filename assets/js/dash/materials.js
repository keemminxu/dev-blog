// materials.js — 하이브리드 레트로 머티리얼: MeshToon 3단 램프 + PS1 정점 스냅
import * as THREE from 'three';

export const INTERNAL = { W: 182, H: 131 };   // 내부 렌더 해상도 (스냅 격자와 공유)

// 낮/야간 팔레트 (main.js에서 night 이벤트에 스왑)
export const PALETTE = {
  day:   { sky: 0x6fb7d9, hemi: 1.5, dir: 1.3, groundTint: 0xffffff, silhouette: 0x8a97a6 },
  night: { sky: 0x241a0e, hemi: 0.7, dir: 0.5, groundTint: 0x6b5a3a, silhouette: 0x3a3226 },
};

let _ramp = null;
export function toonRamp() {
  if (_ramp) return _ramp;
  const c = document.createElement('canvas');
  c.width = 4; c.height = 1;
  const g = c.getContext('2d');
  ['#5a4a3a', '#9a7a5a', '#e8d8c8', '#ffffff'].forEach((col, i) => { g.fillStyle = col; g.fillRect(i, 0, 1, 1); });
  _ramp = new THREE.CanvasTexture(c);
  _ramp.minFilter = _ramp.magFilter = THREE.NearestFilter;
  _ramp.colorSpace = THREE.SRGBColorSpace;
  return _ramp;
}

// 정점 스냅 강도 — 모든 레트로 머티리얼이 공유(런타임에 0으로 두면 확대 시 깔끔)
export const SNAP = { value: 1.0 };
export function setSnap(on) { SNAP.value = on ? 1.0 : 0.0; }

// PS1 정점 스냅 — #include <project_vertex> 뒤(= skinning_vertex 이후)에 주입, w>0 가드, uSnap으로 on/off
const SNAP_CHUNK = `
#include <project_vertex>
{
  vec2 snapGrid = vec2(${INTERNAL.W}.0, ${INTERNAL.H}.0) * 0.5;
  if (uSnap > 0.5 && gl_Position.w > 0.0) {
    vec3 ndc = gl_Position.xyz / gl_Position.w;
    ndc.xy = floor(ndc.xy * snapGrid + 0.5) / snapGrid;
    gl_Position = vec4(ndc * gl_Position.w, gl_Position.w);
  }
}`;

export function applySnap(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = SNAP;                                   // 공유 참조
    shader.vertexShader = 'uniform float uSnap;\n' + shader.vertexShader
      .replace('#include <project_vertex>', SNAP_CHUNK);
  };
  material.customProgramCacheKey = () => 'dash-snap-v2';
  return material;
}

// 소품용 단색 툰
export function makeToon(color) {
  return applySnap(new THREE.MeshToonMaterial({ color, gradientMap: toonRamp() }));
}

// GLB 머티리얼 교체용 — Meshy 함정(emissive=baseColor 2배 밝기·specular [2,2,2]·doubleSided) 소거
export function toRetroMaterial(srcMat) {
  const map = srcMat.map || null;
  if (map) {
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    map.needsUpdate = true;   // colorSpace는 GLTFLoader가 이미 sRGB로 설정 — 건드리지 않음
  }
  const m = new THREE.MeshToonMaterial({ map, gradientMap: toonRamp() });
  applySnap(m);
  srcMat.dispose();
  return m;
}

// 픽셀 캔버스 텍스처 헬퍼 (지면·소품 무늬)
export function pixelTexture(size, painter, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  painter(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}
