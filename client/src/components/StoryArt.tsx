import { useEffect, useRef } from 'react';
import { cx } from '../lib/format';
import { paintStoryArt } from '../lib/storyArt';
import type { SectionKey } from '../lib/types';

export function StoryArt({ seed, section, title = '', className }: { seed: string; section: SectionKey; title?: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    let alive = true;
    let last = '';
    const draw = (force = false) => {
      if (!alive) return;
      const { width, height } = c.getBoundingClientRect();
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const key = `${Math.round(width)}x${Math.round(height)}@${dpr}`;
      if (key === last && !force) return;
      last = key;
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      paintStoryArt(ctx, width, height, seed, section, title);
    };
    const ro = new ResizeObserver(() => draw());
    ro.observe(c);
    draw();
    void document.fonts?.ready.then(() => draw(true));
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [seed, section, title]);

  return <canvas ref={ref} aria-hidden className={cx('block h-full w-full', className)} />;
}