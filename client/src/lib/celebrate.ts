import confetti from 'canvas-confetti';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const COLORS = ['#111111', '#3B3A37', '#8A857B', '#D5D0C4', '#FFFFFF'];

export function burst(x = 0.5, y = 0.6, power = 1) {
  if (reduced()) return;
  confetti({ particleCount: Math.round(60 * power), spread: 70, startVelocity: 38, origin: { x, y }, colors: COLORS, shapes: ['square'], scalar: 1.1 });
}

export function celebrate() {
  if (reduced()) return;
  const end = Date.now() + 1400;
  (function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: COLORS, shapes: ['square'] });
    confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: COLORS, shapes: ['square'] });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function stars() {
  if (reduced()) return;
  confetti({ particleCount: 40, spread: 360, startVelocity: 25, ticks: 90, shapes: ['star'], colors: ['#111111', '#3B3A37', '#8A857B'], origin: { x: 0.5, y: 0.4 } });
}