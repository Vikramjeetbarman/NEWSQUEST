import { useEffect, useRef } from 'react';

const GLYPHS = ['A', 'Q', 'N', 'R', 'S', 'E', 'M', '&', '5', '9', 'W', '?', '!', '"', '#', '*', '+', '%', '1', '7'];
const FONTS = ['900 {s}px "Playfair Display Variable", Georgia, serif', 'italic 700 {s}px "Playfair Display Variable", Georgia, serif', '{s}px UnifrakturMaguntia, serif'];

export function AnimatedBackground() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    type G = { x: number; y: number; vy: number; vx: number; rot: number; vr: number; size: number; ch: string; font: string; alpha: number };
    let glyphs: G[] = [];
    const mouse = { x: -9999, y: -9999 };

    const make = (y?: number): G => {
      const size = 18 + Math.random() * 58;
      return {
        x: Math.random() * w,
        y: y ?? Math.random() * h,
        vy: -(0.08 + Math.random() * 0.22),
        vx: (Math.random() - 0.5) * 0.08,
        rot: (Math.random() - 0.5) * 0.8,
        vr: (Math.random() - 0.5) * 0.003,
        size,
        ch: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        font: FONTS[Math.floor(Math.random() * FONTS.length)].replace('{s}', String(Math.round(size))),
        alpha: 0.03 + Math.random() * 0.04,
      };
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(46, (w * h) / 32000));
      glyphs = Array.from({ length: n }, () => make());
    };

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const cols = w < 768 ? 4 : 12;
      const colW = Math.min(w, 1280) / cols;
      const left = (w - Math.min(w, 1280)) / 2;
      ctx.fillStyle = 'rgba(17,17,17,0.035)';
      for (let i = 1; i < cols; i++) ctx.fillRect(Math.round(left + i * colW), 0, 1, h);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const g of glyphs) {
        if (!reduced) {
          g.y += g.vy;
          g.x += g.vx;
          g.rot += g.vr;
          const dx = g.x - mouse.x;
          const dy = g.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 140 * 140) {
            g.x += dx * 0.02;
            g.y += dy * 0.02;
          }
          if (g.y < -g.size) Object.assign(g, make(h + g.size));
        }
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.rot);
        ctx.font = g.font;
        ctx.fillStyle = `rgba(17,17,17,${g.alpha})`;
        ctx.fillText(g.ch, 0, 0);
        ctx.restore();
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    void document.fonts?.ready.then(() => reduced && draw());
    const onResize = () => {
      resize();
      if (reduced) draw();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) raf = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-950" aria-hidden>
      <canvas ref={canvas} className="absolute inset-0" />
    </div>
  );
}