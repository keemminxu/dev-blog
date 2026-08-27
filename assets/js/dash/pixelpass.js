// pixelpass.js — 저해상도 렌더타깃 + NEAREST 업스케일 blit(Bayer 디더 + 5bit 양자화)
import * as THREE from 'three';
import { INTERNAL } from './materials.js';

export function createPixelPass(renderer, w = INTERNAL.W, h = INTERNAL.H) {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });

  const material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: rt.texture },
      uRes: { value: new THREE.Vector2(w, h) },
      uDither: { value: 0.6 },   // 0 = 디더 없음
      uLevels: { value: 32.0 },  // 5bit/채널
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uDither; uniform float uLevels;
      varying vec2 vUv;
      const mat4 BAYER = mat4( 0., 8., 2., 10.,  12., 4., 14., 6.,  3., 11., 1., 9.,  15., 7., 13., 5. ) / 16.0;
      void main() {
        gl_FragColor = texture2D(tDiffuse, vUv);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        vec2 p = mod(floor(vUv * uRes), 4.0);
        float d = (BAYER[int(p.x)][int(p.y)] - 0.5) * uDither;
        gl_FragColor.rgb = floor(gl_FragColor.rgb * uLevels + d + 0.5 * (1.0 - uDither)) / uLevels;
      }`,
    depthTest: false,
    depthWrite: false,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    rt,
    uniforms: material.uniforms,
    render(scene, camera) {
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCam);
    },
    dispose() {
      rt.dispose();
      material.dispose();
      quad.geometry.dispose();
    },
  };
}
