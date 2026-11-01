let ctx: AudioContext | null = null;
const KEY = 'nq_sound';

export const soundEnabled = () => localStorage.getItem(KEY) !== 'off';
export const setSoundEnabled = (on: boolean) => localStorage.setItem(KEY, on ? 'on' : 'off');

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.08) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime + start);
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.05);
}

function ready(): boolean {
  if (!soundEnabled()) return false;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return true;
  } catch {
    return false;
  }
}

export const sfx = {
  correct(combo = 1) {
    if (!ready()) return;
    const base = 523 * Math.pow(1.06, Math.min(combo, 10));
    tone(base, 0, 0.12, 'triangle');
    tone(base * 1.26, 0.08, 0.14, 'triangle');
    tone(base * 1.5, 0.16, 0.22, 'triangle');
  },
  wrong() {
    if (!ready()) return;
    tone(220, 0, 0.18, 'sawtooth', 0.05);
    tone(165, 0.12, 0.28, 'sawtooth', 0.05);
  },
  tick() {
    if (!ready()) return;
    tone(1200, 0, 0.04, 'square', 0.02);
  },
  click() {
    if (!ready()) return;
    tone(660, 0, 0.05, 'sine', 0.04);
  },
  levelUp() {
    if (!ready()) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.3, 'triangle', 0.07));
  },
  unlock() {
    if (!ready()) return;
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.25, 'sine', 0.06));
  },
};