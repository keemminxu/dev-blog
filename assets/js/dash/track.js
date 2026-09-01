// track.js — 「몽구랑 산책가자」 순수 게임 로직 (three.js 비의존)
// 좌표계: x = 몽구 기준 전방 거리(+, 몽구는 x=0), y = 바닥에서 높이. 단위 = 씬 unit(몽구 키 0.9), 초.
// 박스 규약: { x: 중심, y: 바닥, w: 전체 폭, h: 전체 높이 }

export const RAMP = {
  START_SPEED: 4.2,      // unit/s — 초반은 여유롭게(피드백: 시작이 너무 빨랐음)
  MAX_SPEED: 12.5,
  ACCEL: 0.03,           // unit/s² — 더 완만한 가속(점점 빨라지게)
  GRACE_SEC: 3.5,        // 시작 무장애 구간
  NIGHT_EVERY: 700,      // 이 점수마다 야간 반전 토글
  SCORE_PER_SEC: 10,
};

// 간식(collectible) — 달리는 길과 점프 궤적 위에 뿌려짐, 먹으면 보너스 점수
export const COLLECT = {
  GAP_MIN: 2.6,          // 간식 줄 사이 최소 거리(unit)
  GAP_MAX: 4.6,
  SPACING: 0.62,         // 한 줄 안 간식 간격
  RUN_Y: 0.42,           // 땅 줄 높이(몽구가 달리며 먹는 높이)
  ARC_PEAK: 0.95,        // 점프 아치 최고 높이
  RADIUS: 0.3,           // 수집 반경(넉넉하게)
  POINTS: 5,             // 개당 보너스 점수
};

export const TYPES = {
  FENCE: 'fence', FENCE2: 'fence2', HYDRANT: 'hydrant',
  LINE: 'line', PIGEON: 'pigeon', BIKE: 'bike',
};

// 타입별 크기·특성. vx = 자체 접근 속도(음수 = 몽구 쪽으로 추가 이동). warn = 스폰 시 사운드 훅.
export const DIMS = {
  [TYPES.FENCE]:   { w: 0.35, h: 0.55, y: 0 },
  [TYPES.FENCE2]:  { w: 0.80, h: 0.55, y: 0 },
  [TYPES.HYDRANT]: { w: 0.30, h: 0.38, y: 0 },
  [TYPES.LINE]:    { w: 0.50, h: 0.25, y: 0.62 },            // 상단 장애(숙이기)
  [TYPES.PIGEON]:  { w: 0.40, h: 0.30, y: 0.55, vx: -1.5 },  // 중공 비행 — 숙이기(또는 짖기)로 회피
  [TYPES.BIKE]:    { w: 1.20, h: 0.80, y: 0, vx: -2.5, warn: 'horn' },
};

const SPAWN_X = 9;        // 전방 스폰 거리
const DESPAWN_X = -3;     // 이 뒤로 지나가면 제거
const HITBOX_SHRINK = 0.7; // 관대한 히트박스(중심 기준 70%)

// 겹침 검사(축소 적용): a·b는 박스 규약 객체
function overlap(a, b) {
  const ax = a.w * HITBOX_SHRINK / 2, bx = b.w * HITBOX_SHRINK / 2;
  if (Math.abs(a.x - b.x) >= ax + bx) return false;
  const ac = a.y + a.h / 2, bc = b.y + b.h / 2;
  const ay = a.h * HITBOX_SHRINK / 2, by = b.h * HITBOX_SHRINK / 2;
  return Math.abs(ac - bc) < ay + by;
}

export function createTrack(rng = Math.random) {
  let speed, score, night, elapsed, distSinceSpawn, nextGap, nextId, lastHundred, nightsSeen;
  let distSinceCollect, nextCollectGap, treats;
  let obstacles;

  function reset() {
    speed = RAMP.START_SPEED; score = 0; night = false; elapsed = 0;
    distSinceSpawn = 0; nextGap = 0; nextId = 1; lastHundred = 0; nightsSeen = 0;
    distSinceCollect = 0; nextCollectGap = 0; treats = [];
    obstacles = [];
    track.obstacles = obstacles;
    track.treats = treats;
  }

  // 간식 한 줄 생성: 땅 줄(RUN_Y 근처) 또는 점프 아치(포물선). count개.
  function spawnTreatRow() {
    const count = 3 + Math.floor(rng() * 4);            // 3~6개
    const arc = rng() < 0.4;                            // 40%는 점프 아치
    const startX = SPAWN_X;
    const row = [];
    for (let i = 0; i < count; i++) {
      const x = startX + i * COLLECT.SPACING;
      let y;
      if (arc) {
        const u = count > 1 ? i / (count - 1) : 0.5;    // 0..1
        y = COLLECT.RUN_Y + (COLLECT.ARC_PEAK - COLLECT.RUN_Y) * 4 * u * (1 - u);  // 포물선
      } else {
        y = COLLECT.RUN_Y + (rng() - 0.5) * 0.1;
      }
      const t = { id: nextId++, x, y, taken: false };
      treats.push(t);
      row.push(t);
    }
    return row;
  }

  function speedNorm() {
    return (speed - RAMP.START_SPEED) / (RAMP.MAX_SPEED - RAMP.START_SPEED);
  }

  // 스폰 간 "시간" 간격이 속도와 무관하게 2.2s → 1.1s(±30%)로 줄도록 거리 간격을 속도에 비례시킴
  function rollGap() {
    const baseSec = 2.2 + (1.25 - 2.2) * speedNorm();
    const jitter = 1 + (rng() - 0.5) * 0.5; // 0.75 ~ 1.25 (최고속에서도 최소 ~0.94s 반응 시간)
    return baseSec * jitter * speed;
  }

  function rollType() {
    const r = rng();
    let type;
    if (r < 0.30) type = TYPES.FENCE;
    else if (r < 0.45) type = TYPES.FENCE2;
    else if (r < 0.65) type = TYPES.HYDRANT;
    else if (r < 0.85) type = TYPES.LINE;
    else if (r < 0.92) type = TYPES.BIKE;
    else type = TYPES.PIGEON;
    // 등장 게이트: 비둘기는 최고속의 2/3부터, 오토바이는 speed 9부터
    if (type === TYPES.PIGEON && speed < RAMP.MAX_SPEED * 2 / 3) type = TYPES.FENCE;
    if (type === TYPES.BIKE && speed < 9) type = TYPES.HYDRANT;
    return type;
  }

  function makeObstacle(type, x) {
    const d = DIMS[type];
    return { id: nextId++, type, x, y: d.y, w: d.w, h: d.h, vx: d.vx || 0, warn: d.warn || null };
  }

  const track = {
    obstacles: [],
    get speed() { return speed; },
    get score() { return Math.floor(score); },
    get night() { return night; },
    reset,

    // dt초 진행. 발생 이벤트 배열 반환.
    tick(dt) {
      const events = [];
      elapsed += dt;
      speed = Math.min(RAMP.MAX_SPEED, speed + RAMP.ACCEL * dt);
      score += RAMP.SCORE_PER_SEC * dt;

      // 100점 단위 효과음 훅
      const hundred = Math.floor(score / 100);
      if (hundred > lastHundred) { lastHundred = hundred; events.push({ type: 'score100', value: hundred * 100 }); }

      // 야간 반전 토글 (NIGHT_EVERY마다 정확히 1회)
      const nightsDue = Math.floor(score / RAMP.NIGHT_EVERY);
      while (nightsSeen < nightsDue) {
        nightsSeen++;
        night = !night;
        events.push({ type: 'night', on: night });
      }

      // 장애물 이동·제거 (월드가 speed로 다가오고, vx는 장애물 자체 속도 — 음수면 더 빨리 접근)
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x += (o.vx - speed) * dt;
        if (o.x < DESPAWN_X) { obstacles.splice(i, 1); events.push({ type: 'despawn', id: o.id }); }
      }

      // 간식 이동·제거
      for (let i = treats.length - 1; i >= 0; i--) {
        const t = treats[i];
        t.x -= speed * dt;
        if (t.x < DESPAWN_X || t.taken) { treats.splice(i, 1); events.push({ type: 'treat-despawn', id: t.id }); }
      }
      // 간식 줄 스폰 (GRACE 이후)
      if (elapsed >= RAMP.GRACE_SEC) {
        distSinceCollect += speed * dt;
        if (nextCollectGap === 0) nextCollectGap = COLLECT.GAP_MIN + rng() * (COLLECT.GAP_MAX - COLLECT.GAP_MIN);
        if (distSinceCollect >= nextCollectGap) {
          distSinceCollect = 0;
          nextCollectGap = COLLECT.GAP_MIN + rng() * (COLLECT.GAP_MAX - COLLECT.GAP_MIN);
          for (const t of spawnTreatRow()) events.push({ type: 'treat-spawn', treat: t });
        }
      }

      // 스폰 (GRACE 이후, 거리 누적 기반)
      if (elapsed >= RAMP.GRACE_SEC) {
        distSinceSpawn += speed * dt;
        if (nextGap === 0) nextGap = rollGap();
        if (distSinceSpawn >= nextGap) {
          distSinceSpawn = 0;
          nextGap = rollGap();
          const ob = makeObstacle(rollType(), SPAWN_X);
          obstacles.push(ob);
          events.push({ type: 'spawn', obstacle: ob });
        }
      }
      return events;
    },

    // 몽구 박스와 충돌한 장애물(없으면 null)
    collide(dogBox) {
      for (const o of obstacles) if (overlap(o, dogBox)) return o;
      return null;
    },

    // 몽구가 먹은 간식들: taken 처리 후 반환(점수는 여기서 가산). 개수를 반환값으로도 알 수 있음.
    collect(dogBox) {
      const eaten = [];
      const cx = dogBox.x, cy = dogBox.y + dogBox.h / 2;
      const rx = dogBox.w / 2 + COLLECT.RADIUS, ry = dogBox.h / 2 + COLLECT.RADIUS;
      for (const t of treats) {
        if (t.taken) continue;
        if (Math.abs(t.x - cx) < rx && Math.abs(t.y - cy) < ry) {
          t.taken = true;
          score += COLLECT.POINTS;
          eaten.push(t);
        }
      }
      return eaten;
    },

    // 테스트/디버그용 강제 스폰
    _debugSpawn(type, x) {
      const ob = makeObstacle(type, x);
      obstacles.push(ob);
      return ob;
    },
  };

  reset();
  return track;
}
