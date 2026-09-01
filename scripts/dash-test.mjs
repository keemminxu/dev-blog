// node scripts/dash-test.mjs — track.js 순수 로직 스모크 테스트 (의존성 없음)
import assert from 'node:assert/strict';
import { createTrack, RAMP, TYPES, COLLECT, TREAT } from '../assets/js/dash/track.js';

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('ok -', name); }
  catch (e) { console.error('FAIL -', name, '\n ', e.message); process.exitCode = 1; }
}

const fixedRng = () => 0.5;
function run(track, seconds, dt = 1 / 60) {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...track.tick(dt));
  return events;
}

test('시작 3초(GRACE)는 무장애', () => {
  const tr = createTrack(fixedRng);
  const ev = run(tr, RAMP.GRACE_SEC - 0.05);
  assert.equal(ev.filter(e => e.type === 'spawn').length, 0);
  assert.equal(tr.obstacles.length, 0);
});

test('GRACE 이후에는 스폰이 시작된다', () => {
  const tr = createTrack(fixedRng);
  const ev = run(tr, RAMP.GRACE_SEC + 4);
  assert.ok(ev.filter(e => e.type === 'spawn').length >= 1);
});

test('속도는 단조 증가하고 MAX_SPEED에서 캡', () => {
  const tr = createTrack(fixedRng);
  let prev = tr.speed;
  for (let i = 0; i < 60 * 340; i++) {
    tr.tick(1 / 60);
    assert.ok(tr.speed >= prev - 1e-9, 'speed decreased');
    prev = tr.speed;
  }
  assert.ok(Math.abs(tr.speed - RAMP.MAX_SPEED) < 1e-6, 'not capped: ' + tr.speed);
});

test('스폰 간 거리 간격은 속도가 빨라져도 반응 시간을 보장(시간 간격 ≥ 0.55s)', () => {
  const tr = createTrack(fixedRng);
  const times = [];
  let t = 0;
  for (let i = 0; i < 60 * 120; i++) {
    t += 1 / 60;
    for (const e of tr.tick(1 / 60)) if (e.type === 'spawn') times.push(t);
  }
  assert.ok(times.length > 10, 'too few spawns: ' + times.length);
  for (let i = 1; i < times.length; i++) {
    assert.ok(times[i] - times[i - 1] >= 0.55, `gap too small at #${i}: ${(times[i] - times[i - 1]).toFixed(2)}s`);
  }
});

test('collide: 겹치면 장애물 반환, 70% 히트박스라 살짝 스치면 null', () => {
  const tr = createTrack(fixedRng);
  tr._debugSpawn(TYPES.FENCE, 1.0); // x=1.0 전방
  const ob = tr.obstacles[0];
  // 정통으로 겹침
  assert.ok(tr.collide({ x: 1.0, y: 0, w: 0.8, h: 0.9 }));
  // 몽구가 장애물 못 미침 (전혀 안 겹침)
  assert.equal(tr.collide({ x: -0.5, y: 0, w: 0.8, h: 0.9 }), null);
  // 가장자리 30% 스침: full box는 겹치지만 70% box는 안 겹침
  const grazeX = ob.x + ob.w * 0.5 * 0.99 + 0.8 * 0.5 * 0.75;
  assert.equal(tr.collide({ x: grazeX, y: 0, w: 0.8, h: 0.9 }), null, 'graze should not hit');
});

test('빨랫줄(LINE)은 상단 장애라 숙인 박스(h 0.5)와 안 부딪힘', () => {
  const tr = createTrack(fixedRng);
  tr._debugSpawn(TYPES.LINE, 0.0);
  assert.ok(tr.collide({ x: 0, y: 0, w: 0.8, h: 0.9 }), 'standing should hit');
  assert.equal(tr.collide({ x: 0, y: 0, w: 0.8, h: 0.5 }), null, 'ducking should pass');
});

test('700점마다 night 이벤트가 정확히 한 번씩', () => {
  const tr = createTrack(fixedRng);
  const nights = run(tr, 200).filter(e => e.type === 'night');
  const expected = Math.floor(tr.score / RAMP.NIGHT_EVERY);
  assert.ok(expected >= 2, 'test too short, score=' + tr.score);
  assert.equal(nights.length, expected);
});

test('pigeon/bike는 vx만큼 추가로 다가온다', () => {
  const tr = createTrack(fixedRng);
  tr._debugSpawn(TYPES.PIGEON, 5.0);
  tr._debugSpawn(TYPES.FENCE, 5.0);
  const [pigeon, fence] = tr.obstacles;
  tr.tick(1 / 60);
  assert.ok(pigeon.x < fence.x, 'pigeon should approach faster');
});

test('화면 뒤(x < -3)로 지나간 장애물은 despawn', () => {
  const tr = createTrack(fixedRng);
  tr._debugSpawn(TYPES.FENCE, 0.5);
  const id = tr.obstacles[0].id;
  const ev = run(tr, 10);
  assert.ok(ev.some(e => e.type === 'despawn' && e.id === id));
  assert.ok(tr.obstacles.every(o => o.id !== id));
});

test('PIGEON은 최고속의 2/3 전에는 안 나온다', () => {
  const tr = createTrack(() => 0.99); // 항상 희귀 타입 쪽을 뽑도록
  let t = 0;
  for (let i = 0; i < 60 * 300; i++) {
    t += 1 / 60;
    for (const e of tr.tick(1 / 60)) {
      if (e.type === 'spawn' && e.obstacle.type === TYPES.PIGEON) {
        assert.ok(tr.speed >= RAMP.MAX_SPEED * 2 / 3 - 1e-6, 'pigeon too early at speed ' + tr.speed);
      }
    }
  }
});

test('reset 후 초기 상태로 복귀', () => {
  const tr = createTrack(fixedRng);
  run(tr, 30);
  tr.reset();
  assert.equal(tr.score, 0);
  assert.equal(tr.obstacles.length, 0);
  assert.equal(tr.speed, RAMP.START_SPEED);
  assert.equal(tr.night, false);
});

test('간식은 GRACE 이후 줄 단위로 스폰된다', () => {
  const tr = createTrack(fixedRng);
  const ev = run(tr, RAMP.GRACE_SEC + 6).filter(e => e.type === 'treat-spawn');
  assert.ok(ev.length >= 3, '너무 적음: ' + ev.length);
  assert.ok(tr.treats.length > 0);
});

test('collect: 겹친 간식은 먹히고 POINTS만큼 점수 가산', () => {
  const tr = createTrack(fixedRng);
  run(tr, RAMP.GRACE_SEC + 5);
  const before = tr.score;
  // 간식 하나를 몽구 위치로 끌어와 먹이기
  const t = tr.treats.find(x => !x.taken);
  assert.ok(t, '간식 없음');
  t.x = 0; t.y = 0.42;
  const eaten = tr.collect({ x: 0, y: 0, w: 0.8, h: 0.9 });
  assert.equal(eaten.length >= 1, true);
  assert.ok(tr.score >= before + COLLECT.POINTS);
  assert.equal(t.taken, true);
});

test('먹은 간식은 다음 tick에 despawn 이벤트로 제거', () => {
  const tr = createTrack(fixedRng);
  run(tr, RAMP.GRACE_SEC + 5);
  const t = tr.treats.find(x => !x.taken); t.x = 0; t.y = 0.42;
  tr.collect({ x: 0, y: 0, w: 0.8, h: 0.9 });
  const ev = tr.tick(1/60).filter(e => e.type === 'treat-despawn' && e.id === t.id);
  assert.equal(ev.length, 1);
  assert.ok(tr.treats.every(x => x.id !== t.id));
});

test('난이도: 시작 속도가 완만하고(≤5) reset이 간식도 비운다', () => {
  const tr = createTrack(fixedRng);
  assert.ok(RAMP.START_SPEED <= 5, 'START_SPEED 너무 빠름');
  run(tr, 10);
  tr.reset();
  assert.equal(tr.treats.length, 0);
  assert.equal(tr.score, 0);
});

test('간식은 kibble/tuna 종류를 가지며 tuna는 큰 점수', () => {
  const tr = createTrack(() => 0.05);   // 낮은 rng → tuna 확률 통과
  run(tr, RAMP.GRACE_SEC + 3);
  const tuna = tr.treats.find(t => t.kind === TREAT.TUNA);
  assert.ok(tuna, 'tuna 스폰 안 됨');
  tuna.x = 0; tuna.y = 0.42;
  const before = tr.score;
  tr.collect({ x: 0, y: 0, w: 0.8, h: 0.9 });
  assert.ok(tr.score >= before + COLLECT.TUNA_POINTS);
});

test('일반 간식은 kibble이고 POINTS만큼만', () => {
  const tr = createTrack(() => 0.5);    // 높은 rng → tuna 회피, kibble 줄
  run(tr, RAMP.GRACE_SEC + 3);
  const k = tr.treats.find(t => t.kind === TREAT.KIBBLE);
  assert.ok(k, 'kibble 없음');
  tr.treats.forEach(t => { if (t !== k) t.taken = true; });   // 하나만 남기고 격리
  k.x = 0; k.y = 0.42;
  const before = tr.score;
  tr.collect({ x: 0, y: 0, w: 0.8, h: 0.9 });
  assert.equal(tr.score, before + COLLECT.POINTS);
});

console.log(process.exitCode ? 'SOME TESTS FAILED' : `all ${passed} tests passed`);
