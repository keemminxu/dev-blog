// audio.js — WebAudio 합성 효과음 (에셋 0, 기본 음소거)
// 정책: 사용자 제스처 핸들러 안에서만 AudioContext 생성/resume (iOS 자동재생 정책)
export function createAudio() {
  let ctx = null;
  let muted = true;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 단일 오실레이터 블립: f0 → f1 스윕
  function blip({ type = 'square', f0 = 220, f1 = f0, dur = 0.08, gain = 0.045, delay = 0 }) {
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const SFX = {
    jump: () => blip({ type: 'square', f0: 240, f1: 470, dur: 0.09 }),
    duck: () => blip({ type: 'triangle', f0: 180, f1: 120, dur: 0.05, gain: 0.03 }),
    bark: () => { blip({ type: 'sawtooth', f0: 150, f1: 95, dur: 0.07, gain: 0.06 }); blip({ type: 'sawtooth', f0: 165, f1: 100, dur: 0.07, gain: 0.055, delay: 0.09 }); },
    hit: () => blip({ type: 'sawtooth', f0: 210, f1: 55, dur: 0.24, gain: 0.07 }),
    score: () => { blip({ type: 'triangle', f0: 880, dur: 0.06, gain: 0.035 }); blip({ type: 'triangle', f0: 1318, dur: 0.07, gain: 0.03, delay: 0.06 }); },
    horn: () => { blip({ type: 'square', f0: 620, dur: 0.09, gain: 0.04 }); blip({ type: 'square', f0: 620, dur: 0.12, gain: 0.04, delay: 0.13 }); },
  };

  return {
    play(name) { if (!muted && SFX[name]) SFX[name](); },
    toggleMute() { muted = !muted; if (!muted) ensure(); return muted; },
    get muted() { return muted; },
  };
}
