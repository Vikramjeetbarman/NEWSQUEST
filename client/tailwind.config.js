const PALETTE = { mauve: '#111111', wood: '#383A37', screen: '#8A8578', bronze: '#D5D0C4', peach: '#ECE8DE', sage: '#F9F7F1' };
const LIGHT = '#FFFFFF';
const DARK = '#000000';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) =>
  '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const scale = (base) => ({
  DEFAULT: base,
  50: mix(base, LIGHT, 0.85),
  100: mix(base, LIGHT, 0.7),
  200: mix(base, LIGHT, 0.5),
  300: mix(base, LIGHT, 0.3),
  400: mix(base, LIGHT, 0.14),
  500: base,
  600: mix(base, DARK, 0.18),
  700: mix(base, DARK, 0.36),
  800: mix(base, DARK, 0.54),
  900: mix(base, DARK, 0.7),
  950: mix(base, DARK, 0.82),
});

const mono = {
  DEFAULT: PALETTE.mauve,
  50: '#111111',
  100: '#141414',
  200: '#1A1A1A',
  300: '#222222',
  400: '#3B3A37',
  500: '#55524C',
  600: '#2E2D2A',
  700: '#242321',
  800: '#1B1A19',
  900: '#141413',
  950: '#0E0E0D',
};

const SUCCESS = '#FFFFFF';
const DANGER = '#B5B0A5';
const neutral = {
  50: '#000000',
  100: '#111111',
  200: '#1A1A1A',
  300: '#2B2A28',
  400: '#43413D',
  500: '#4F4C47',
  600: '#5A5751',
  700: '#9C978D',
  800: '#C2B0B2',
  900: '#D6D1C6',
  950: '#E20002',
};

const hollow = (n) => `${n}px ${n}px 0 -2px ${PALETTE.peach}, ${n}px ${n}px 0 0 ${PALETTE.mauve}`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    borderRadius: {
      none: '0',
      sm: '0',
      DEFAULT: '0',
      md: '1px',
      lg: '2px',
      xl: '2px',
      '2xl': '3px',
      '3xl': '4px',
      full: '9999px',
    },
    extend: {
      fontFamily: {
        sans: ['"Source Serif 4 Variable"', 'Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        display: ['"Playfair Display Variable"', 'Georgia', '"Times New Roman"', 'serif'],
        masthead: ['"Oswald Variable"', '"Franklin Gothic Medium"', '"Arial Narrow"', 'sans-serif'],
        condensed: ['"Oswald Variable"', '"Franklin Gothic Medium"', '"Arial Narrow"', 'sans-serif'],
        mono: ['"Courier Prime"', '"Courier New"', 'ui-monospace', 'monospace'],
      },
      colors: {
        mauve: scale(PALETTE.mauve),
        wood: scale(PALETTE.wood),
        screen: scale(PALETTE.screen),
        bronze: scale(PALETTE.bronze),
        peach: scale(PALETTE.peach),
        sage: scale(PALETTE.sage),
        success: scale(SUCCESS),
        danger: scale(DANGER),
        ink: {
          950: PALETTE.peach,
          900: '#FFFFFF',
          850: PALETTE.sage,
          800: '#00DBCC',
          700: '#C9C3B6',
          600: PALETTE.wood,
        },
        white: PALETTE.mauve,
        black: DARK,
        slate: neutral,
        violet: mono,
        indigo: mono,
        purple: mono,
        orange: mono,
        fuchsia: mono,
        pink: mono,
        amber: mono,
        yellow: mono,
        sky: mono,
        cyan: mono,
        teal: mono,
        emerald: mono,
        green: mono,
        lime: mono,
        rose: mono,
      },
      boxShadow: {
        'hard-sm': `2px 2px 0 0 ${PALETTE.mauve}`,
        hard: `4px 4px 0 0 ${PALETTE.mauve}`,
        'hard-lg': `7px 7px 0 0 ${PALETTE.mauve}`,
        hollow: hollow(5),
        'hollow-lg': hollow(8),
        'hard-bronze': hollow(6),
        glow: `4px 4px 0 0 ${PALETTE.mauve}`,
        'glow-amber': `4px 4px 0 0 ${PALETTE.mauve}`,
        card: `4px 4px 0 0 ${PALETTE.mauve}`,
      },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        pulseRing: { '0%': { transform: 'scale(0.8)', opacity: '0.8' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
        blink: { '0%,49%': { opacity: '1' }, '50%,100%': { opacity: '0' } },
        press: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(3px)' } },
      },
      animation: {
        marquee: 'marquee 60s linear infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        float: 'float 6s ease-in-out infinite',
        'spin-slow': 'spin-slow 18s linear infinite',
        'pulse-ring': 'pulseRing 1.8s ease-out infinite',
        blink: 'blink 1s step-end infinite',
        press: 'press 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};