import { motion } from 'framer-motion';
import { Info, Sparkles } from 'lucide-react';
import { Suspense, useEffect, useRef } from 'react';
import { Link, useLocation, useOutlet } from 'react-router-dom';
import { useLive } from '../contexts/LiveContext';
import { useToast } from '../contexts/ToastContext';
import { AnimatedBackground } from './AnimatedBackground';
import { Logo, Masthead, Navbar } from './Navbar';
import { Ticker } from './Ticker';

function DemoBanner() {
  const { meta, status } = useLive();
  if (!meta || status?.mode === 'live') return null;
  return (
    <div className="border-b-2 border-mauve bg-sage">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 text-xs text-mauve sm:flex-nowrap sm:px-6">
        <span className="flex shrink-0 items-center gap-1.5 bg-mauve px-2 py-0.5 font-condensed text-[11px] font-semibold uppercase tracking-[0.16em] text-peach">
          <Info className="h-3 w-3" /> Notice to readers
        </span>
        <span className="order-last w-full italic sm:order-none sm:w-auto">
          Live feeds from PIB & News On AIR are not reachable from this network, so you are reading the{' '}
          <b className="not-italic">Demo Archive</b>. NewsQuest keeps retrying every {status?.intervalMinutes ?? 15} min and switches to live news automatically.
        </span>
        <Link to="/sources" className="ml-auto shrink-0 border-2 border-mauve px-2 py-0.5 font-condensed text-[11px] font-semibold uppercase tracking-[0.16em] text-mauve transition hover:bg-mauve hover:text-peach">
          Feed status
        </Link>
      </div>
    </div>
  );
}

export function Layout() {
  const location = useLocation();
  const outlet = useOutlet();
  const { lastNews } = useLive();
  const { toast } = useToast();
  const seen = useRef<number | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  useEffect(() => {
    if (!lastNews || seen.current === lastNews.at) return;
    seen.current = lastNews.at;
    toast(`${lastNews.added} fresh ${lastNews.added === 1 ? 'story' : 'stories'} just landed - new questions are ready!`, 'success');
  }, [lastNews, toast]);

  const immersive = location.pathname.startsWith('/play/');

  return (
    <div className="noise relative flex min-h-screen flex-col">
      <AnimatedBackground />
      {!immersive && <Ticker />}
      {!immersive && <Masthead />}
      <Navbar compact={immersive} />
      {!immersive && <DemoBanner />}
      <motion.div
        key={`wipe-${location.pathname}`}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[70] origin-bottom bg-mauve"
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0 }}
        transition={{ duration: 0.5, ease: [0.76, 0, 0.24, 1] }}
      />
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10"
      >
        <Suspense fallback={null}>{outlet}</Suspense>
      </motion.main>
      {!immersive && (
        <footer className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6">
          <div className="border-t border-mauve" />
          <div className="mt-[3px] border-t-[3px] border-mauve" />
          <div className="grid items-center gap-5 pt-6 text-xs text-slate-500 md:grid-cols-[auto_1fr_auto]">
            <Logo />
            <p className="flex items-start justify-center gap-1.5 text-center italic md:px-6">
              <Sparkles className="-mt-0.5 h-3.5 w-3.5 shrink-0 text-mauve" />
              Stories are summarised from releases of the Press Information Bureau (PIB), Government of India, and News On AIR (Prasar Bharati), with a link to each original. NewsQuest is an independent app and is not affiliated with or endorsed by the Government of India or Prasar Bharati. Summaries and questions are generated automatically - verify before you rely on them.
            </p>
            <p className="dateline text-center md:text-right">
              Printed in your browser
              <br />© {new Date().getFullYear()} NewsQuest
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}