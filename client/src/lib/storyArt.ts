import type { SectionKey } from './types';

const TAU = Math.PI * 2;
const INK = '#16161A';
const PAPER = '#FFFDF6';
const LN = 1.8;
const OFF = 2.4;

const PALETTES: readonly (readonly string[])[] = [
  ['#FFD23F', '#EE4266', '#540D6E', '#38CEAC', '#0EAD69'],
  ['#F4F1DE', '#E07A5F', '#3D405B', '#81B29A', '#F2CC8F'],
  ['#264653', '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51'],
  ['#FFBE0B', '#FB5607', '#FF006E', '#8338EC', '#3A86FF'],
  ['#06D6A0', '#118AB2', '#073B4C', '#FFD166', '#EF476F'],
  ['#003049', '#D62828', '#F77F00', '#FCBF49', '#EAE2B7'],
  ['#BECAE6', '#219EBC', '#023047', '#FFB703', '#FB8500'],
  ['#F72585', '#7209B7', '#3A0CA3', '#4361EE', '#4CC9F0'],
  ['#E63946', '#F1FAEE', '#A8DADC', '#457B9D', '#1D3557'],
  ['#6B6C38', '#283618', '#FEFAE0', '#DDA15E', '#BC6C25'],
  ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93'],
  ['#FFCDB2', '#FFB4A2', '#E5989B', '#B5838D', '#6D6875'],
  ['#EDF2F4', '#8D99AE', '#2B2D42', '#EF233C', '#D90429'],
  ['#CAD2C5', '#84A98C', '#52796F', '#354F52', '#2F3E46'],
  ['#FFF1E6', '#F0A6CA', '#9C89B8', '#B8BED0', '#5E548E'],
  ['#001524', '#3A506B', '#5C80E6', '#FFD166', '#F25F5C'],
  ['#2EC4B6', '#CBF3F0', '#FFBF69', '#FF9F1C', '#011627'],
  ['#9B5DE5', '#F15BB5', '#FEE440', '#00BBF9', '#00F5D4'],
];

type Ctx = CanvasRenderingContext2D;
type Path = (ctx: Ctx) => void;

interface Art {
  ctx: Ctx;
  rnd: () => number;
  bg: string;
  c: string[];
  L: number;
  R: number;
  T: number;
  B: number;
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function paint(a: Art, path: Path, fill: string, opts: { shadow?: boolean; stroke?: boolean } = {}) {
  const { ctx } = a;
  if (opts.shadow !== false) {
    ctx.save();
    ctx.translate(OFF, OFF);
    ctx.beginPath();
    path(ctx);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  path(ctx);
  ctx.fillStyle = fill;
  ctx.fill();
  if (opts.stroke !== false) {
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

function line(a: Art, path: Path, color: string, width: number, casing = true) {
  const { ctx } = a;
  if (casing) {
    ctx.beginPath();
    path(ctx);
    ctx.strokeStyle = INK;
    ctx.lineWidth = width + 2.2;
    ctx.stroke();
  }
  ctx.beginPath();
  path(ctx);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.lineWidth = LN;
}

const rect =
  (x: number, y: number, w: number, h: number): Path =>
  (ctx) => {
    ctx.rect(x, y, w, h);
  };

const circle =
  (x: number, y: number, r: number): Path =>
  (ctx) => {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, TAU);
  };

const poly =
  (pts: any[]): Path =>
  (ctx) => {
    const flat = pts.flat();
    for (let i = 0; i < flat.length; i += 2) {
      if (i) ctx.lineTo(flat[i], flat[i + 1]);
      else ctx.moveTo(flat[i], flat[i + 1]);
    }
    ctx.closePath();
  };

function rrect(x: number, y: number, w: number, h: number, r: number): Path {
  return (ctx) => {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
}

function star(x: number, y: number, r: number, points = 5, inner = 0.45): Path {
  return (ctx) => {
    for (let i = 0; i < points * 2; i++) {
      const rad = i % 2 ? r * inner : r;
      const ang = (i * Math.PI) / points - Math.PI / 2;
      const px = x + Math.cos(ang) * rad;
      const py = y + Math.sin(ang) * rad;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  };
}

function blob(x: number, y: number, r: number, rnd: () => number, n = 9): Path {
  const pts = Array.from({ length: n }, (_, i) => {
    const ang = (i / n) * TAU;
    const rr = r * (0.65 + rnd() * 0.5);
    return [x + Math.cos(ang) * rr, y + Math.sin(ang) * rr] as const;
  });
  return (ctx) => {
    const mid = (p: readonly number[], q: readonly number[]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const start = mid(pts[n - 1], pts[0]);
    ctx.moveTo(start[0], start[1]);
    for (let i = 0; i < n; i++) {
      const m = mid(pts[i], pts[(i + 1) % n]);
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
    }
    ctx.closePath();
  };
}

function glyph(a: Art, ch: string, x: number, y: number, size: number, color: string, shadow = true) {
  const { ctx } = a;
  ctx.font = `900 ${size}px "Playfair Display Variable", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (shadow) {
    ctx.fillStyle = INK;
    ctx.fillText(ch, x + OFF, y + OFF);
  }
  ctx.fillStyle = color;
  ctx.fillText(ch, x, y);
}

function background(a: Art, title: string) {
  const { ctx, rnd, c, L, R, T, B } = a;
  ctx.fillStyle = a.bg;
  ctx.fillRect(L, T, R - L, B - T);
  const far = Math.hypot(Math.max(-L, R), Math.max(-T, B));
  const variant = Math.floor(rnd() * 6);
  ctx.save();
  if (variant === 0) {
    const n = 2 * (9 + Math.floor(rnd() * 6));
    ctx.fillStyle = c[3];
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < n; i += 2) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, far, (i / n) * TAU, ((i + 1) / n) * TAU);
      ctx.closePath();
      ctx.fill();
    }
  } else if (variant === 1) {
    ctx.strokeStyle = c[3];
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 7;
    for (let r = 14; r < far; r += 16) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
    }
  } else if (variant === 2) {
    ctx.fillStyle = c[3];
    ctx.globalAlpha = 0.25;
    ctx.rotate(-0.6);
    for (let x = -far; x < far; x += 28) ctx.fillRect(x, -far, 14, far * 2);
  } else if (variant === 3) {
    ctx.fillStyle = c[2];
    ctx.globalAlpha = 0.45;
    const step = 6;
    for (let y = T; y < B; y += step)
      for (let x = L; x < R; x += step) {
        const t = (x - L) / (R - L);
        const r = step * 0.46 * t * t;
        if (r < 0.3) continue;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
  } else if (variant === 4) {
    ctx.fillStyle = c[3];
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(L, B);
    ctx.lineTo(R, T + (B - T) * 0.15);
    ctx.lineTo(R, B);
    ctx.closePath();
    ctx.fill();
  } else {
    const ch = (title.trim()[0] ?? 'N').toUpperCase();
    ctx.fillStyle = c[3];
    ctx.globalAlpha = 0.4;
    ctx.font = `italic 900 ${ Math.round((B - T) * 1.25) }px "Playfair Display Variable", Georgia, serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(ch, L + 6, B + (B - T) * 0.12);
  }
  ctx.restore();
}

function sprinkle(a: Art, n: number) {
  const { rnd, c, L, R, T, B } = a;
  for (let i = 0; i < n; i++) {
    const x = L + 6 + rnd() * (R - L - 12);
    const y = T + 6 + rnd() * (B - T - 12);
    const col = c[1 + Math.floor(rnd() * 3)];
    const k = rnd();
    if (k < 0.4) paint(a, circle(x, y, 1.6 + rnd() * 2), col, { shadow: false });
    else if (k < 0.75) paint(a, star(x, y, 3 + rnd() * 2.5, 4, 0.38), col, { shadow: false });
    else
      line(
        a,
        (ctx) => {
          ctx.moveTo(x - 3, y);
          ctx.lineTo(x + 3, y);
          ctx.moveTo(x, y - 3);
          ctx.lineTo(x, y + 3);
        },
        col,
        1.8,
        false,
      );
  }
}

function grain(ctx: Ctx, w: number, h: number, rnd: () => number) {
  const n = Math.round((w * h) / 140);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(22,22,26,0.07)' : 'rgba(255,253,246,0.09)';
    ctx.fillRect(rnd() * w, rnd() * h, 1.2, 1.2);
  }
}

function national(a: Art) {
  const { rnd, c } = a;
  paint(a, circle(26, -24, 15), c[3], { shadow: false });
  paint(a, rect(-46, 48, 92, 7), c[0]);
  paint(a, rect(-40, 33, 80, 7), c[1]);
  paint(a, rect(-35, 26, 70, 7), c[0]);
  const n = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) paint(a, rect(-28 + (56 * i) / (n - 1) - 3, -5, 6, 31), PAPER);
  paint(a, rect(-38, -13, 76, 8), c[1]);
  if (rnd() < 0.6) {
    paint(a, rect(-17, -21, 34, 8), c[0]);
    paint(
      a,
      (ctx) => {
        ctx.moveTo(-17, -21);
        ctx.arc(0, -21, 17, Math.PI, 0);
        ctx.closePath();
      },
      c[2],
    );
    paint(a, rect(-3, -44, 6, 6), c[0]);
    line(
      a,
      (ctx) => {
        ctx.moveTo(0, -44);
        ctx.lineTo(0, -52);
      },
      INK,
      1.6,
      false,
    );
    paint(
      a,
      (ctx) => {
        ctx.moveTo(0, -52);
        ctx.quadraticCurveTo(6, -54, 12, -51);
        ctx.lineTo(12, -45);
        ctx.quadraticCurveTo(6, -48, 0, -46);
        ctx.closePath();
      },
      c[3],
      { shadow: false },
    );
  } else {
    paint(a, poly([[-42, -13, 0, -38, 42, -13]]), c[2]);
    paint(a, circle(0, -21, 4.5), PAPER, { shadow: false });
  }
}

function world(a: Art) {
  const { ctx, rnd, c } = a;
  const R0 = 34;
  paint(a, circle(0, 0, R0), c[0]);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R0, 0, TAU);
  ctx.clip();
  const n = 3 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const ang = rnd() * TAU;
    const d = rnd() * 20;
    paint(a, blob(Math.cos(ang) * d, Math.sin(ang) * d, 9 + rnd() * 9, rnd), c[1], { shadow: false });
  }
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  for (const k of [0.38, 0.78]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, R0 * k, R0, 0, 0, TAU);
    ctx.stroke();
  }
  for (const y of [-17, 0, 17]) {
    ctx.beginPath();
    ctx.moveTo(-R0, y);
    ctx.lineTo(R0, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = LN;
  ctx.beginPath();
  ctx.arc(0, 0, R0, 0, TAU);
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha = 0.6;
  line(a, (x) => x.arc(0, 0, R0 - 6, Math.PI * 1.12, Math.PI * 1.45), PAPER, 3, false);
  ctx.restore();
  ctx.save();
  ctx.rotate(-0.38);
  ctx.setLineDash([4, 3]);
  line(a, (x) => x.ellipse(0, 0, 48, 13, 0, 0, TAU), c[2], 1.8, false);
  ctx.setLineDash([]);
  const t = rnd() * Math.PI;
  paint(a, star(Math.cos(t) * 48, Math.sin(t) * 13, 5.5, 4, 0.4), c[3]);
  ctx.restore();
  for (let i = 0; i < 2; i++) {
    const ang = rnd() * TAU;
    const d = rnd() * 20;
    const x = Math.cos(ang) * d;
    const y = Math.sin(ang) * d - 4;
    paint(
      a,
      (p) => {
        p.moveTo(x, y + 8);
        p.bezierCurveTo(x - 7, y, x - 5, y - 7, x, y - 7);
        p.bezierCurveTo(x + 5, y - 7, x + 7, y, x, y + 8);
        p.closePath();
      },
      c[3],
    );
    paint(a, circle(x, y - 2, 2), PAPER, { shadow: false, stroke: false });
  }
}

function business(a: Art) {
  const { rnd, c } = a;
  paint(a, circle(-34, -28, 10), c[3]);
  paint(a, circle(-34, -28, 6.5), c[3], { shadow: false });
  glyph(a, 't', -34, -27.5, 10, INK, false);
  const tops: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const x = -26 + i * 13;
    const h = 14 + i * 11 + rnd() * 8;
    paint(a, rect(x - 5, 36 - h, 10, h), c[1 % 2]);
    tops.push([x, 36 - h - 7]);
  }
  line(
    a,
    (ctx) => {
      ctx.moveTo(-46, 36);
      ctx.lineTo(46, 36);
    },
    INK,
    2,
    false,
  );
  line(a, (ctx) => tops.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))), c[2], 3);
  const [x1, y1] = tops[4];
  const [x0, y0] = tops[3];
  const ang = Math.atan2(y1 - y0, x1 - x0);
  paint(
    a,
    poly([
      x1 + Math.cos(ang) * 8,
      y1 + Math.sin(ang) * 8,
      x1 + Math.cos(ang + 2.4) * 7,
      y1 + Math.sin(ang + 2.4) * 7,
      x1 + Math.cos(ang - 2.4) * 7,
      y1 + Math.sin(ang - 2.4) * 7,
    ]),
    c[2],
    { shadow: false },
  );
}

function scitech(a: Art) {
const { ctx, rnd, c } = a;
  for (let i = 0; i < 6; i++) paint(a, star(-44 + rnd() * 88, -44 + rnd() * 50, 2 + rnd() * 2.5, 4, 0.35), i % 2 ? PAPER : c[3], { shadow: false });
  if (rnd() < 0.65) {
    paint(a, circle(30, -26, 11), c[2]);
    line(a, (x) => x.ellipse(30, -26, 19, 5, -0.4, 0, TAU), c[3], 2.2);
    ctx.save();
    ctx.translate(-6, 4);
    ctx.rotate(0.6);
    paint(a, (x) => {
      x.moveTo(-7, 24);
      x.quadraticCurveTo(-4, 38, 0, 46);
      x.quadraticCurveTo(4, 38, 7, 24);
      x.closePath();
    }, c[3]);
    paint(a, (x) => {
      x.moveTo(-3.5, 24);
      x.quadraticCurveTo(-2, 33, 0, 38);
      x.quadraticCurveTo(2, 33, 3.5, 24);
      x.closePath();
    }, PAPER, { shadow: false, stroke: false });
    paint(a, poly([[-10, 6, -19, 24, -10, 20]]), c[1]);
    paint(a, poly([[10, 6, 19, 24, 10, 20]]), c[1]);
    paint(a, (x) => {
      x.moveTo(0, -36);
      x.bezierCurveTo(12, -26, 11, -6, 10, 20);
      x.lineTo(-10, 20);
      x.bezierCurveTo(-11, -6, -12, -26, 0, -36);
      x.closePath();
    }, c[0]);
    paint(a, (x) => {
      x.moveTo(0, -36);
      x.bezierCurveTo(6, -31, 8.5, -25, 9.3, -20);
      x.lineTo(-9.3, -20);
      x.bezierCurveTo(-8.5, -25, -6, -31, 0, -36);
      x.closePath();
    }, c[2], { shadow: false });
    paint(a, circle(0, -6, 6.5), PAPER, { shadow: false });
    paint(a, circle(0, -6, 3.8), c[1], { shadow: false });
    paint(a, rect(-6, 20, 12, 4), INK, { shadow: false });
    ctx.restore();
  } else {
    for (let i = 0; i < 3; i++) line(a, (x) => x.ellipse(0, 0, 40, 13, (i * Math.PI) / 3, 0, TAU), c[0], 2.4);
    for (let i = 0; i < 3; i++) {
      const ang = (i * Math.PI) / 3;
      const t = rnd() * TAU;
      const ex = Math.cos(t) * 40;
      const ey = Math.sin(t) * 13;
      paint(a, circle(ex * Math.cos(ang) - ey * Math.sin(ang), ex * Math.sin(ang) + ey * Math.cos(ang), 3.6), c[2]);
    }
    paint(a, circle(0, 0, 8), c[1]);
  }
}

function environment(a: Art) {
  const { rnd, c, L, R, B } = a;
  paint(a, circle(20 + rnd() * 16, -24, 13), c[3], { shadow: false });
  for (let i = 0; i < 3; i++) {
    const x = -32 + rnd() * 40;
    const y = -36 + rnd() * 14;
    const s = 3 + rnd() * 2;
    line(
      a,
      (p) => {
        p.moveTo(x - s, y - s * 0.6);
        p.quadraticCurveTo(x - s * 0.4, y - s * 0.6, x, y);
        p.quadraticCurveTo(x + s * 0.4, y - s * 0.6, x + s, y - s * 0.6);
      },
      INK,
      1.4,
      false,
    );
  }
  const hill = (base: number, amp: number, freq: number, phase: number) => (x: number) => base + Math.sin(x * freq + phase) * amp;
  const back = hill(4, 9, 0.045, rnd() * 6);
  const mid = hill(18, 7, 0.06, rnd() * 6);
  const front = hill(33, 5, 0.08, rnd() * 6);
  const ground = (f: (x: number) => number, col: string) =>
    paint(
      a,
      (p) => {
        p.moveTo(L - 2, B + 2);
        for (let x = L - 2; x <= R + 3; x += 3) p.lineTo(x, f(x));
        p.lineTo(R + 3, B + 2);
        p.closePath();
      },
      col,
      { shadow: false },
    );
  ground(back, c[2]);
  ground(mid, c[1]);
  const trees = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < trees; i++) {
    const x = -42 + rnd() * 84;
    const y = mid(x) + 2;
    paint(a, rect(x - 1.5, y - 7, 3, 8), INK, { shadow: false, stroke: false });
    paint(a, poly([[x, y - 24, x - 7.5, y - 7, x + 7.5, y - 7]]), c[0]);
    paint(a, poly([[x, y - 30, x - 5.5, y - 16, x + 5.5, y - 16]]), c[0]);
  }
  ground(front, c[0]);
}

function health(a: Art) {
  const { ctx, c } = a;
  ctx.save();
  ctx.translate(-34, 28);
  ctx.rotate(-0.6);
  paint(a, rrect(-12, -5, 24, 10, 5), c[2]);
  paint(a, (x) => {
    x.moveTo(0, -5);
    x.lineTo(7, -5);
    x.arcTo(12, -5, 12, 0, 5);
    x.arcTo(12, 5, 7, 5, 5);
    x.lineTo(0, 5);
    x.closePath();
  }, PAPER, { shadow: false });
  ctx.restore();
  paint(a, poly([[26, -44, 34, -44, 34, -37, 41, -37, 41, -29, 34, -29, 34, -22, 26, -22, 26, -29, 19, -29, 19, -37, 26, -37]]), c[3]);
  paint(a, (x) => {
    x.moveTo(0, 26);
    x.bezierCurveTo(-42, -2, -24, -40, 0, -19);
    x.bezierCurveTo(24, -40, 42, -2, 0, 26);
    x.closePath();
  }, c[0]);
  line(
    a,
    (x) => {
      x.moveTo(-48, 2);
      x.lineTo(-18, 2);
      x.lineTo(-12, -10);
      x.lineTo(-6, 16);
      x.lineTo(0, -22);
      x.lineTo(6, 12);
      x.lineTo(11, 2);
      x.lineTo(48, 2);
    },
    PAPER,
    2.6,
  );
}

function sports(a: Art) {
  const { ctx, rnd, c, L, R, B } = a;
  paint(a, rect(L - 2, 26, R - L + 4, B - 24), c[1], { shadow: false });
  ctx.save();
  ctx.globalAlpha = 0.8;
  for (const y of [32, 39, 46])
    line(
      a,
      (p) => {
        p.moveTo(L, y);
        p.lineTo(R, y);
      },
      PAPER,
      1.3,
      false,
    );
  ctx.restore();
  if (rnd() < 0.5) {
    for (const [y, len] of [
      [-10, 30],
      [0, 40],
      [10, 26],
    ])
      line(
        a,
        (p) => {
          p.moveTo(-28 - len, y);
          p.lineTo(-30, y);
        },
        INK,
        2.4,
        false,
      );
    paint(a, circle(-4, 0, 22), c[0]);
    line(
      a,
      (p) => {
        p.moveTo(-4, -22);
        p.quadraticCurveTo(10, 0, -4, 22);
        p.quadraticCurveTo(10, 0, -4, -22);
      },
      PAPER,
      2,
      false,
    );
    line(
      a,
      (p) => {
        p.moveTo(-26, 0);
        p.quadraticCurveTo(-4, 12, 18, 0);
      },
      PAPER,
      2,
      false,
    );
  } else {
    for (const side of [-1, 1])
      line(
        a,
        (p) => {
          p.moveTo(side * 17, -28);
          p.bezierCurveTo(side * 32, -28, side * 30, -6, side * 12, -6);
        },
        c[3],
        3,
      );
    paint(a, (p) => {
      p.moveTo(-18, -34);
      p.lineTo(18, -34);
      p.quadraticCurveTo(19, 0, 0, 4);
      p.quadraticCurveTo(-19, 0, -18, -34);
      p.closePath();
    }, c[3]);
    paint(a, star(0, -17, 7), PAPER, { shadow: false });
    paint(a, rect(-4, 4, 8, 10), c[3]);
    paint(a, rect(-15, 14, 30, 9), c[0]);
    paint(a, rect(-9, 16.5, 18, 4), PAPER, { shadow: false });
  }
}

function education(a: Art) {
  const { ctx, c } = a;
  const books = [
    { x: -34, y: 22, w: 66, col: c[0], r: 0.02 },
    { x: -28, y: 10, w: 58, col: c[1], r: -0.04 },
    { x: -36, y: -2, w: 64, col: c[2], r: 0.03 },
  ];
  for (const b of books) {
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + 6);
    ctx.rotate(b.r);
    paint(a, rect(-b.w / 2, -6, b.w, 12), b.col);
    paint(a, rect(b.w / 2 - 9, -4, 7, 8), PAPER, { shadow: false });
    paint(a, rect(-b.w / 2 + 6, -3, 2 + 6, -12), INK, { shadow: false, stroke: false });
    ctx.restore();
  }
  paint(a, rect(-14, -11, 24, 9), INK, { shadow: false });
  paint(a, poly([[-2, -27, 26, -17, -2, -7, -30, -17]]), c[3]);
  line(
    a,
    (p) => {
      p.moveTo(-2, -17);
      p.lineTo(20, -13);
      p.lineTo(20, -1);
    },
    c[0],
    1.6,
    false,
  );
  paint(a, rect(18, -1, 4, 6), c[0], { shadow: false });
  ctx.save();
  ctx.translate(38, 4);
  ctx.rotate(0.5);
  paint(a, rect(-3.5, -24, 7, 34), c[1]);
  paint(a, poly([[-3.5, 10, 0, 18, 3.5, 10]]), PAPER);
  paint(a, rect(-3.5, -30, 7, 6), c[3]);
  ctx.restore();
}

function opinion(a: Art) {
  const { c } = a;
  glyph(a, '"', -30, -6, 84, c[2]);
  paint(a, poly([[-16, -6, -24, 6, -4, -6]]), c[0]);
  paint(a, rrect(-26, -34, 60, 30, 7), c[0]);
  for (const [y, w] of [
    [-25, 40],
    [-18, 32],
    [-11, 24],
  ])
    line(
      a,
      (p) => {
        p.moveTo(-18, y);
        p.lineTo(-18 + w, y);
      },
      PAPER,
      2.6,
      false,
    );
  paint(a, poly([[22, 30, 38, 42, 34, 30]]), c[1]);
  paint(a, rrect(-4, 4, 50, 28, 7), c[1]);
  for (const [y, w] of [
    [13, 34],
    [21, 26],
  ])
    line(
      a,
      (p) => {
        p.moveTo(4, y);
        p.lineTo(4 + w, y);
      },
      INK,
      2.2,
      false,
    );
}

function entertainment(a: Art) {
  const { ctx, rnd, c, T } = a;
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.moveTo(34, T);
  ctx.lineTo(-36, 46);
  ctx.lineTo(14, 50);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.rotate(-0.22);
  paint(a, rect(-50, -16, 100, 32), INK);
  for (let x = -46; x < 48; x += 8) {
    paint(a, rect(x, -13, 4, 4), PAPER, { shadow: false, stroke: false });
    paint(a, rect(x, 9, 4, 4), PAPER, { shadow: false, stroke: false });
  }
  for (let i = 0; i < 3; i++) paint(a, rect(-44 + i * 31, -7, 26, 14), c[i], { shadow: false });
  ctx.restore();
  for (let i = 0; i < 3; i++) paint(a, star(-38 + rnd() * 76, -42 + rnd() * 14, 4, 4 + rnd() * 3), c[3]);
}

const MOTIFS: Record<SectionKey, (a: Art) => void> = {
  national,
  world,
  business,
  scitech,
  environment,
  health,
  sports,
  education,
  opinion,
  entertainment,
};

export function paintStoryArt(ctx: Ctx, w: number, h: number, seed: string, section: SectionKey, title = '') {
  const rnd = mulberry32(hash(seed));
  const pal = PALETTES[Math.floor(rnd() * PALETTES.length)];
  const bg = pal[Math.floor(rnd() * pal.length)];
  const c = pal.filter((x) => x !== bg).sort((p, q) => contrast(p, bg) - contrast(q, bg));
  const s = Math.min(w * 0.62, h * 0.86);
  const u = s / 100;
  const cx = w / 2 + 1.6 * w * 0.03;
  const cy = h * 0.54;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(u, u);
  ctx.lineWidth = LN;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const a: Art = { ctx, rnd, bg, c, L: -cx / u, R: (w - cx) / u, T: -cy / u, B: (h - cy) / u };
  background(a, title);
  sprinkle(a, 5 + Math.floor(rnd() * 6));
  (MOTIFS[section] ?? national)(a);
  ctx.restore();
  grain(ctx, w, h, rnd);
}