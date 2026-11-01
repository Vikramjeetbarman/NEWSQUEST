import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLive } from '../contexts/LiveContext';
import { api } from '../lib/api';
import type { SectionKey } from '../lib/types';

export function Ticker() {
  const { newsVersion } = useLive();
  const [items, setItems] = useState<{ id: string; title: string; section: SectionKey }[]>([]);

  useEffect(() => {
    api.ticker().then((r) => setItems(r.items), () => {});
  }, [newsVersion]);

  if (!items.length) return null;
  const loop = [...items, ...items];
  return (
    <div className="relative z-30 flex h-9 items-center overflow-hidden bg-mauve">
      <div className="z-10 flex h-full shrink-0 items-center gap-2 bg-peach px-3 font-condensed
        text-[12px] font-bold uppercase tracking-[0.24em] text-mauve [clip-path:polygon(0_0,100%_0,calc(100%_-_10px)_100%,0_100%)] sm:pr-5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mauve opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-mauve" />
        </span>
        Breaking
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="flex w-max animate-marquee gap-8 whitespace-nowrap pl-6 hover:[animation-play-state:paused]">
          {loop.map((it, i) => (
            <Link
              key={`${it.id}-${i}`}
              to={`/article/${it.id}`}
              className="flex items-center gap-8 font-condensed text-[13px] font-medium uppercase tracking-[0.1em] text-peach/80 transition hover:text-peach hover:underline"
            >
              {it.title}
              <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-peach" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}