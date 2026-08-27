# 「몽구랑 산책가자」(dash) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 CRT 콘솔의 우디+Backrooms를 몽구 측면 러너 「몽구랑 산책가자」로 교체 (스펙: `docs/plans/2026-08-27-monggu-dash-design.md`).

**Architecture:** Three.js 0.185.1(로컬 벤더링, WebGLRenderer)로 182×131 렌더타깃에 그려 nearest 업스케일하는 하이브리드 레트로 파이프라인. 게임 로직(`track.js`)은 render 비의존 순수 모듈로 분리해 node로 테스트. 기존 `game-dpad`/`game-button` DOM 이벤트를 intent 어댑터로 재사용.

**Tech Stack:** Jekyll(GitHub Pages) · Three.js 0.185.1 ESM + importmap · gltf-transform 빌드 에셋(완료) · playwright-core + 로컬 Chrome 검증 하네스 · node 스모크 테스트

**실행 주의사항 (이 환경 고유):**
- **소스 파일은 반드시 Write/Edit 도구로 작성** — Bash heredoc이 백슬래시를 제거함(이 세션에서 재현됨). 셸에서는 다운로드·복사·실행만.
- 브랜치: `feature/monggu-dash` (스펙 커밋 59506b6 위에서 계속). main 직접 수정 금지.
- 커밋 메시지에 Claude co-author 트레일러 금지 (사용자 선호).
- 스킨 메시 bbox는 `Box3.setFromObject(model, true)` — precise 아니면 바인드 포즈 기준으로 어긋남(검증됨).
- 검증 하네스: `scratchpad`의 `shot.js` 패턴(playwright-core + `C:/Program Files/Google/Chrome/Application/chrome.exe`, `page.route`로 파일 서빙). Jekyll 페이지 검증은 `bundle exec jekyll build` 후 `_site`를 서빙.

**파일 구조(스펙 §6 확정):** 추가 `assets/vendor/three-0.185.1/`, `assets/glb/monggu.glb`, `assets/images/crt/logo-dash.webp`, `assets/js/dash/{main,pixelpass,materials,dog,track,input,hud,audio,attract}.js`, `scripts/dash-test.mjs` · 수정 `_layouts/home.html`, `assets/main.scss` · 삭제 `assets/js/{game,backrooms-game,dodge-game}.js`, `assets/glb/woody_final.glb`

---

### Task 1: 에셋 반입 (GLB + 로고)

**Files:**
- Create: `assets/glb/monggu.glb` (202KB 빌드본 복사)
- Create: `assets/images/crt/logo-dash.webp` (Logo.png 482→360px WebP)

- [ ] **Step 1: GLB 복사** — `cp E:/Downloads/backupglb/monggu_512_webp_meshopt.glb assets/glb/monggu.glb` (스크래치패드 `final/monggu_512_webp.glb`와 동일본, 201,684B 확인)
- [ ] **Step 2: 로고 WebP 생성** — Pillow: `Image.open('assets/images/crt/Logo.png').resize((360, 386), Image.LANCZOS).save('assets/images/crt/logo-dash.webp', quality=90)` → 목표 ≤60KB
- [ ] **Step 3: 검증** — `ls -la` 두 파일 크기 확인(monggu.glb 201,684B / logo ≤60KB), 스크래치패드 glbinfo.py로 monggu.glb 파싱(클립 1개·512² webp 확인)
- [ ] **Step 4: Commit** — `git add assets/glb/monggu.glb assets/images/crt/logo-dash.webp && git commit -m "몽구 GLB(meshopt+webp 202KB)·타이틀 로고 webp 반입"`

### Task 2: Three.js 0.185.1 벤더링 + importmap 교체

**Files:**
- Create: `assets/vendor/three-0.185.1/three.module.min.js`, `three.core.min.js`
- Create: `assets/vendor/three-0.185.1/jsm/loaders/GLTFLoader.js`, `jsm/utils/BufferGeometryUtils.js`, `jsm/utils/SkeletonUtils.js`, `jsm/libs/meshopt_decoder.module.js`
- Modify: `_layouts/home.html` (importmap 블록, 하단 script 태그)

- [ ] **Step 1: 다운로드** — jsdelivr `three@0.185.1`에서 위 6개 파일을 curl로 받아 배치. `three.module.min.js`가 `./three.core.min.js`를 상대 import하므로 같은 디렉터리 필수.
- [ ] **Step 2: GLTFLoader 의존 확인** — `grep "from" jsm/loaders/GLTFLoader.js` → `'three'`와 `'../utils/BufferGeometryUtils.js'`만인지 확인(다른 상대 import 있으면 그 파일도 벤더링)
- [ ] **Step 3: home.html importmap 교체**

```html
<script type="importmap">
  {"imports":{
    "three":"{{ '/assets/vendor/three-0.185.1/three.module.min.js' | relative_url }}",
    "three/addons/":"{{ '/assets/vendor/three-0.185.1/jsm/' | relative_url }}"
  }}
</script>
<script type="module" src="{{ '/assets/js/dash/main.js' | relative_url }}"></script>
```

- [ ] **Step 4: 로드 스모크** — 스크래치패드에 테스트 페이지(`import * as THREE from 'three'; import {GLTFLoader}...; console.log(THREE.REVISION)`)를 만들어 하네스로 `185` 출력 확인
- [ ] **Step 5: Commit** — `feat: three.js 0.185.1 로컬 벤더링(min 빌드+애드온 4종), importmap 로컬 전환`

### Task 3: track.js 순수 게임 로직 (TDD)

**Files:**
- Create: `assets/js/dash/track.js`
- Create: `scripts/dash-test.mjs` (node:assert, Jekyll exclude 영역)

**API (고정):**

```js
// track.js — three 비의존. 단위: 씬 unit(몽구 높이=0.9), 초.
export const RAMP = { START_SPEED: 6, MAX_SPEED: 13, ACCEL: 0.06, GRACE_SEC: 3, NIGHT_EVERY: 700, SCORE_PER_SEC: 10 };
export const TYPES = { FENCE:'fence', FENCE2:'fence2', HYDRANT:'hydrant', LINE:'line', PIGEON:'pigeon', BIKE:'bike' };
export function createTrack(rng = Math.random) => {
  reset(),
  tick(dt) => { events: [{type:'spawn'|'despawn'|'night'|'score100', ...}] },   // 내부에서 speed·score·obstacles 갱신
  obstacles,            // [{id,type,x,y,w,h, vx}] — x는 몽구 기준 전방 거리(+), vx는 자체 속도(bike·pigeon)
  speed, score, night,  // getter
  collide(dogBox) => obstacle|null,   // dogBox {x,y,w,h}, 히트박스 70% 축소는 track이 적용
}
```

- [ ] **Step 1: 실패하는 테스트 작성** — `scripts/dash-test.mjs`: ① 3초 무장애(GRACE 동안 spawn 이벤트 0) ② 속도 램프 단조증가·13 캡 ③ 결정적 rng(()=>0.5)에서 스폰 간격이 속도에 비례(빠를수록 시간 간격 유지=거리 증가) ④ `collide`: 겹치는 박스 → 장애물 반환, 70% 히트박스 경계 케이스는 null ⑤ 700점 도달 시 night 이벤트 1회·1400점에 두 번째 ⑥ pigeon/bike의 vx 반영 ⑦ 화면 밖(x<-3) despawn
- [ ] **Step 2: 실행 → 실패 확인** — `node scripts/dash-test.mjs` → `ERR_MODULE_NOT_FOUND`
- [ ] **Step 3: track.js 구현** — 스폰: 누적 거리 기반(`nextGap = lerp(2.2, 1.1, speedNorm) * speed` unit, rng로 ±30% + 타입 가중 추첨; 최고속 2/3 미만에서는 PIGEON 제외). 장애물 크기 상수표 포함(fence 0.55h, hydrant 0.35h, line y=0.62 상단물, pigeon 저공 y=0.35 vx=-1.5, bike vx=-2.5 + 스폰 시 `warn:'horn'` 필드)
- [ ] **Step 4: 테스트 통과 확인** — `node scripts/dash-test.mjs` → `all N tests passed`
- [ ] **Step 5: Commit** — `feat(dash): track 순수 로직(스폰·램프·충돌·야간) + node 테스트`

### Task 4: 렌더 파이프라인 골격 (pixelpass + materials + main 씬)

**Files:**
- Create: `assets/js/dash/pixelpass.js`, `assets/js/dash/materials.js`, `assets/js/dash/main.js`
- Modify: `assets/main.scss` (`.console-screen #game-canvas { image-rendering: pixelated; }`)

**핵심 코드(검증된 형태):**

```js
// pixelpass.js
export function createPixelPass(renderer, w = 182, h = 131) {
  const rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  const quad = /* PlaneGeometry(2,2) + ShaderMaterial */
  // frag: color = texture2D(t, vUv); #include <tonemapping_fragment>; #include <colorspace_fragment>;
  //       그 뒤 Bayer4x4(강도 uDither=0.5) + floor(c*32+d)/32
  return { render(scene, camera){ rt에 렌더 → null 타깃에 quad blit }, setSize, uniforms };
}
// materials.js
export function toRetroMaterial(srcMat, snapRes) {   // MeshToonMaterial(3단 Nearest 램프) + onBeforeCompile 정점 스냅(w>0 가드)
export function makeToon(color)                      // 소품용
export const NIGHT = { sky: 0x2a1f0e, fog: ..., amber: 0xcba040 };  // 야간 반전 팔레트
```

- [ ] **Step 1: main.js 골격** — renderer(`antialias:false, NoToneMapping, setPixelRatio(1)`, CSS 크기 `setSize(w,h,false)`), 카메라(퍼스펙티브 40°, `(3.2, 0.8, 0)`에서 `(0,0.42,0)` 측면·저각), 씬(하늘 0x6fb7d9 · Fog(8,18) · 잔디 캔버스 텍스처 지면 · 담장/집 실루엣 패럴랙스 2겹), 12fps 스텝 루프(`acc>=1/12`일 때만 시뮬+렌더), 리사이즈 핸들러(기존 `handleResize` 대체, RT는 182×131 고정)
- [ ] **Step 2: 하네스 검증** — jekyll build 없이 스크래치패드 서빙으로 씬 스크린샷 1장: 지면·안개·픽셀화 확인, 콘솔 에러 0
- [ ] **Step 3: scss 수정 + jekyll build** — `bundle exec jekyll build` 성공, `_site/assets/js/dash/` 산출 확인
- [ ] **Step 4: Commit** — `feat(dash): 저해상도 픽셀 패스·툰/스냅 머티리얼·씬 골격`

### Task 5: dog.js 몽구 컨트롤러

**Files:**
- Create: `assets/js/dash/dog.js`

**API (고정):**

```js
export async function loadDog(url) => dog
dog.object3d                      // 씬에 add
dog.update(dt, state)             // state: {mode:'attract'|'run'|'jump'|'duck'|'dead', speedNorm, lookAt:{x,y}|null, t}
dog.box()                         // 월드 AABB {x,y,w,h} (2D 측면 투영)
dog.jump(holdSec), dog.duck(on), dog.die(), dog.bark(), dog.reset()
```

- [ ] **Step 1: 로드·정규화** — GLTFLoader+MeshoptDecoder, `Box3.setFromObject(model, true)`로 높이 0.9 정규화·바닥 y=0, `rotation.y = π/2`(+X 진행 방향), `frustumCulled=false`, 머티리얼 `toRetroMaterial` 교체(emissive·specular 소거), blob shadow(반경 0.45 검은 원, opacity 0.35) 부착
- [ ] **Step 2: 프로시저럴 레이어** — 걷기 클립 `timeScale = 2.2 + speedNorm*0.8` · 점프: 클립 `paused=true`(t=0.25 프리즈) + 루트 `y = h·4u(1−u)`(h = 0.3 + min(holdSec,0.25)*1.2, dur 0.45~0.6) + pitch(상승 −15°/하강 +10°) · 착지 80ms squash(1.12, 0.85, 1.12) · duck: `scale.y 0.6` + head 본 X축 down · die: `scale (1.3, 0.25, 1.3)` 납작 + 'ㅠㅠ' 스프라이트는 hud 담당 · attract: 클립 pause + 호흡 scale.y ±2% + head look-at(lookAt 스크린 좌표→각도, ±0.4rad 클램프) + 꼬리 4본 sin wag(위상 지연 0.7) + 귀 flop — **모든 본 오버라이드는 `mixer.update()` 직후**, Hips scale은 곱 처리(클립 상수 0.9248 보존)
- [ ] **Step 3: 하네스 검증** — 3프레임 스크린샷(run t=0.4 / jump 정점 / duck): 포즈·그림자·툰 램프 확인, `dog.box()` 값이 시각과 일치(±10%) 로그 확인
- [ ] **Step 4: Commit** — `feat(dash): 몽구 컨트롤러(걷기 1클립 + 프로시저럴 점프·숙이기·꼬리·시선)`

### Task 6: input.js + home.html release 패치

**Files:**
- Create: `assets/js/dash/input.js`
- Modify: `_layouts/home.html` (ABXY 버튼 release 디스패치)

- [ ] **Step 1: home.html 패치** — 기존 `.hit[data-btn]` 리스너에 추가:

```js
['mouseup','mouseleave'].forEach(ev => btn.addEventListener(ev, () => {
  document.dispatchEvent(new CustomEvent('game-button-release', {detail: {button: btn.dataset.btn}}));
}));
btn.addEventListener('touchend', (e) => { e.preventDefault();
  document.dispatchEvent(new CustomEvent('game-button-release', {detail: {button: btn.dataset.btn}}));
});
```

- [ ] **Step 2: input.js** — 스펙 §3 표 그대로 intent 콜백(`onJumpStart/onJumpEnd/onDuck(bool)/onBark/onMute/onPause/onStart`)으로 변환. 키보드(Space/W/↑, Shift/S/↓, E, F — editable 포커스 무시, 기존 `isEditableFocused` 로직 복제), `game-dpad`(up/down/none), `game-button`+`game-button-release`(a/b/x/y), 왼스틱(ny<−0.5 flick=점프, ny>0.5 hold=duck), CRT 화면 터치(상단 ⅔=점프·하단 ⅓=duck, 이동<10px=탭, `touch-action: pan-y` 보존 — PLAY 중 기존 오빗 드래그 핸들러 비활성 플래그)
- [ ] **Step 3: 하네스 검증** — synthetic 이벤트 디스패치(keydown Space·game-button a·touchstart 좌표별)로 intent 로그 순서 확인
- [ ] **Step 4: Commit** — `feat(dash): 입력 어댑터(키보드·패드·터치 존) + ABXY release 이벤트`

### Task 7: 게임 루프 통합 (state machine + 장애물 렌더 + HUD)

**Files:**
- Create: `assets/js/dash/hud.js`
- Modify: `assets/js/dash/main.js`

- [ ] **Step 1: 장애물 메시 풀** — 타입별 procedural 지오메트리(fence=박스+가로대, hydrant=실린더+캡, line=기둥2+처진 라인(CatmullRom 아님, 3세그먼트 직선), pigeon=콘+날개 2tri, bike=박스 2+원통 바퀴+운전자 박스, 전부 `makeToon` 팔레트) · track.obstacles ↔ 메시 풀 동기화(spawn/despawn 이벤트), x축 = 몽구 전방
- [ ] **Step 2: 상태 머신** — OFF(기존 전원 이벤트 연동)/ATTRACT/PLAY/GAMEOVER. PLAY: `track.tick` → `dog.box()` 충돌 → GAMEOVER(dog.die + hud). 점수·HI(`localStorage['monggu.best.dash']` try/catch), `score100`마다 삑 사운드 훅, `night` 이벤트에 팔레트 스왑(하늘·안개·지면 tint ↔ NIGHT)
- [ ] **Step 3: hud.js** — `.console-screen` 안 DOM 오버레이(기존 backrooms HUD 스타일 답습): 우상단 `HI 00000  00000`(NeoDunggeunmo, main.scss의 실제 font-family명 확인 후 사용), 게임오버 패널(점수 + "Ⓐ 다시하기"), 'ㅠㅠ' 말풍선, 짖기 'WOOF!' 스프라이트
- [ ] **Step 4: 하네스 자동 플레이 검증** — 스크립트로 600프레임(50초 상당) 시뮬: 주기적 점프 intent 주입 → 콘솔 에러 0 · 점수 증가 · 최소 1회 게임오버·재시작 동작 · 스크린샷 4장(초반/야간 전환/게임오버/재시작)
- [ ] **Step 5: Commit** — `feat(dash): 게임 루프·장애물 풀·HUD·야간 반전·로컬 최고점`

### Task 8: attract.js + audio.js

**Files:**
- Create: `assets/js/dash/attract.js`, `assets/js/dash/audio.js`
- Modify: `assets/js/dash/main.js`, `assets/main.scss` (로고 오버레이 스타일)

- [ ] **Step 1: attract** — 로고 `<img src=".../logo-dash.webp">` 오버레이(상단 중앙 55% 폭) + "PRESS Ⓐ · TAP" 1s 깜빡임 + `HI` 표시. 몽구: 화면 중앙 느린 배회(x ±0.8 사인) + pointermove/touchmove 좌표 look-at + 꼬리 wag. 이 상태에서만 기존 오빗 드래그 허용. `prefers-reduced-motion`: 배회·자동재생 정지(정지 포즈+로고만)
- [ ] **Step 2: audio** — WebAudio 합성: jump(사각파 220→440Hz 80ms), duck(노이즈 40ms), bark(톱니 150Hz 펄스 2회), hit(노이즈+피치다운 200ms), score100(삼각파 880Hz 60ms), horn(사각파 2음). 첫 제스처에서 `resume()`, 기본 `muted=true`, Y/F 토글 시 hud에 🔇/🔊 1초 표시
- [ ] **Step 3: 하네스 검증** — attract 스크린샷(로고+몽구), reduced-motion 에뮬레이션 스크린샷, 콘솔 에러 0
- [ ] **Step 4: Commit** — `feat(dash): 대기 화면(로고·놀아주기)·WebAudio 합성 효과음(기본 음소거)`

### Task 9: 성능·위생 + 레거시 제거

**Files:**
- Modify: `assets/js/dash/main.js`, `_layouts/home.html`
- Delete: `assets/js/game.js`, `assets/js/backrooms-game.js`, `assets/js/dodge-game.js`, `assets/glb/woody_final.glb`

- [ ] **Step 1: lazy init** — home.html에서는 부트 스텁만 즉시 실행: `requestIdleCallback`(폴백 `load`+2s) 또는 콘솔 IntersectionObserver 진입 시 `import('./dash/main.js')`. 로딩 중 attract 자리 로고 정적 표시
- [ ] **Step 2: 위생** — `IntersectionObserver`(화면 밖 루프 정지) + `visibilitychange` + `webglcontextlost/restored`(정지 후 재초기화) + WebGL2/GLB 실패 시 로고 포스터 + 스크린오프 연출. 전원 OFF 시 루프 정지(기존 `game-screen-toggle` 연동)
- [ ] **Step 3: 레거시 삭제** — 위 4개 파일 `git rm`, home.html에서 잔여 참조 grep 0 확인
- [ ] **Step 4: jekyll build + 전체 하네스** — `bundle exec jekyll build` → `_site` 서빙으로 데스크톱 1080p·390px·iPhone SE 3뷰포트 스크린샷 + 자동 플레이, 전송량 합산 로그(gz ≤ 450KB 확인)
- [ ] **Step 5: Commit** — `feat(dash): lazy init·가시성/컨텍스트 위생·폴백 + 우디/백룸 레거시 제거`

### Task 10: 최종 검증·마무리

- [ ] **Step 1: 스펙 대조** — design.md §1~8 각 항목 구현 위치 체크리스트 작성(누락 시 보완)
- [ ] **Step 2: 코드 리뷰** — /code-review 수준 자체 점검(이벤트 리스너 누수·dispose·모바일 예외) 후 수정 커밋
- [ ] **Step 3: 실기 확인 요청** — 사용자에게 로컬 `bundle exec jekyll serve` + 모바일 실기 확인 요청, 완료 후 superpowers:finishing-a-development-branch(merge → main push는 keemminxu 계정 전환 후 사용자 확인)
