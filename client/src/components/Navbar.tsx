import { AnimatePresence, motion } from 'framer-motion';
import { Bookmark, Coins, Flame, Gamepad2, Home, LogIn, LogOut, Menu, Newspaper, Swords, Trophy, User as UserIcon, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { cx, fmtNum } from '../lib/format';
import { setSoundEnabled, soundEnabled } from '../lib/sound';
import { ProgressRing } from './ui';

const LINKS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/news', label: 'News', icon: Newspaper },
  { to: '/arena', label: 'Arena', icon: Gamepad2 },
  { to: '/vault', label: 'Vault', icon: Bookmark },
  { to: '/leaderboard', label: 'Ranks', icon: Trophy },
];

export function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2.5" aria-label="NewsQuest home">
      <motion.div whileHover={{ rotate: -8, scale: 1.08 }} className="hidden h-9 w-9 place-items-center border-2 border-mauve bg-mauve shadow-hard-sm sm:grid">
        <span className="font-masthead text-2xl font-bold leading-none text-peach">N</span>
      </motion.div>
      <div className="leading-none">
        <div className="nameplate text-xl">NewsQuest</div>
        <div className="mt-1 hidden font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500 sm:block">Read today . Rank tomorrow</div>
      </div>
    </Link>
  );
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const NAMEPLATE = 'The NewsQuest';

export function Masthead() {
  const { connected, status, meta } = useLive();
  const today = new Date();
  const date = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const issue = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86_400_000);
  const vol = ROMAN[today.getFullYear() - 2026] ?? String(today.getFullYear() - 2025);
  const stories = meta?.sections.reduce((s, x) => s + x.articles, 0) ?? 0;
  const questions = meta?.sections.reduce((s, x) => s + x.questions, 0) ?? 0;
  const live = status?.mode === 'live';

  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 pt-4 sm:px-6">
      <div className="dateline flex items-center justify-between gap-4 border-b border-mauve pb-1.5 !text-slate-300">
        <span>
          Vol. {vol} . No. {issue}
        </span>
        <span className="hidden sm:inline">{date}</span>
        <span>{live ? 'Live edition' : 'Demo edition'} . Free</span>
      </div>
      <div className="grid items-center gap-4 py-3 md:py-4 lg:grid-cols-[1fr_auto_1fr]">
        <div className="hidden max-w-[210px] border-2 border-mauve p-2 text-center lg:block">
          <div className="font-display text-sm font-bold italic leading-tight text-mauve">"Read today. Rank tomorrow."</div>
          <div className="dateline mt-1 !text-[11px] !tracking-[0.06em]">Est. 2026 . India edition</div>
        </div>
        <Link to="/" aria-label="NewsQuest front page" className="nameplate justify-self-center text-[length:clamp(1.75rem,9.5vw,2.7rem)] sm:text-7xl lg:text-[5.5rem]">
          {NAMEPLATE.split('').map((ch, i) => (
            <motion.span
              key={i}
              aria-hidden
              initial={{ opacity: 0, y: -28, rotate: -10, scale: 1.4 }}
              animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.045, type: 'spring', stiffness: 420, damping: 16 }}
              className="inline-block"
            >
              {ch === ' ' ? '\u00a0' : ch}
            </motion.span>
          ))}
        </Link>
        <Link
          to="/sources"
          title={connected ? 'Connected to live updates' : 'Reconnecting...'}
          className="group hidden max-w-[210px] justify-self-end border-2 border-mauve p-2 text-center text-mauve transition hover:bg-mauve hover:text-peach lg:block"
        >
          <div className="flex items-center justify-center gap-1.5 font-condensed text-[11px] font-semibold uppercase tracking-[0.2em]">
            <span className="relative flex h-2 w-2">
              {connected && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />}
              <span className={cx('relative inline-flex h-2 w-2 rounded-full', connected ? 'bg-current' : 'border border-current')} />
            </span>
            {status?.running ? 'Printing...' : live ? 'Live wires' : 'Demo archive'}
          </div>
          <div className="dateline mt-1 !text-[11px] !tracking-[0.06em] group-hover:!text-peach">
            {stories} stories . {questions} questions
          </div>
        </Link>
      </div>
      <div className="border-t-[3px] border-mauve" />
      <div className="mt-[3px] border-t border-mauve" />
    </div>
  );
}

export function Navbar({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(soundEnabled());
  const [scrolled, setScrolled] = useState(false);
  const nav = useNavigate();
  const { pathname } = useLocation();
  const showPlay = !compact && !pathname.startsWith('/arena');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 170);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const showLogo = compact || scrolled;

  const toggleSound = () => {
    setSoundEnabled(!sound);
    setSound(!sound);
  };

  return (
    <header className="sticky top-0 z-40 border-b-2 border-mauve bg-ink-950">
      <div className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6">
        <div className="min-w-0">
          <AnimatePresence initial={false}>
            {showLogo && (
              <motion.div key="logo" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="w-fit">
                <Logo />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <nav className="hidden items-center lg:flex">
          {LINKS.map((l, i) => (
            <div key={l.to} className="flex items-center">
              {i > 0 && <span aria-hidden className="mx-1 h-4 w-px bg-mauve/40" />}
              <NavLink
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cx(
                    'group relative px-3 py-1.5 font-condensed text-[13px] font-semibold uppercase tracking-[0.18em] transition-colors',
                    isActive ? 'text-peach' : 'text-slate-300 hover:text-white',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span layoutId="nav-pill" className="absolute inset-0 bg-mauve" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                    )}
                    <span className={cx('relative', isActive && 'headline-link')}>{l.label}</span>
                  </>
                )}
              </NavLink>
            </div>
          ))}
        </nav>

        <div className="col-start-3 flex items-center justify-end gap-2">
          {showPlay && (
            <Link to="/arena?mode=daily" className="btn-cta !min-h-0 !px-3 !py-1.5 !text-xs !tracking-[0.16em]" title="Play today's challenge">
              <Swords className="h-4 w-4" /> Play
            </Link>
          )}
          <button onClick={toggleSound} className="btn-subtle !p-2" aria-label={sound ? 'Mute sounds' : 'Enable sounds'}>
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          {user ? (
            <>
              <div className="hidden items-center gap-3 border-2 border-mauve bg-sage py-0.5 pl-3 pr-0.5 shadow-hard-sm sm:flex">
                <span
                  className={cx('flex items-center gap-1 font-mono text-xs font-bold text-mauve', !user.activeToday && 'opacity-50')}
                  title={user.activeToday ? 'Day streak - today is done' : 'Day streak - answer any question today to keep it'}
                >
                  <Flame className="h-3.5 w-3.5" />
                  {user.streak}
                </span>
                <span className="flex items-center gap-1 font-mono text-xs font-bold text-mauve" title="Coins">
                  <Coins className="h-3.5 w-3.5" />
                  {fmtNum(user.coins)}
                </span>
                <Link to="/profile" title={`Level ${user.level.level} · ${user.level.title}`}>
                  <ProgressRing value={user.level.progress} size={34} stroke={3}>
                    <span className="text-base leading-none">{user.avatar}</span>
                  </ProgressRing>
                </Link>
              </div>

              {user.isGuest ? (
                <Link to="/login" className="btn-ghost hidden !px-2.5 !py-1.5 !text-xs lg:inline-flex" title="Sign in, or create an account to keep your guest progress">
                  <LogIn className="h-4 w-4" /> Sign in
                </Link>
              ) : (
                <button
                  onClick={async () => {
                    await logout();
                    nav('/');
                  }}
                  className="btn-subtle hidden !p-2 lg:inline-flex"
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </>
          ) : (
            <Link to="/login" className="btn-ghost hidden !py-2 sm:inline-flex">
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
          )}

          <button className="btn-subtle !p-2 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t-2 border-mauve lg:hidden"
          >
            <div className="flex flex-col gap-1 p-3">
              {[
                ...LINKS,
                ...(user ? [{ to: '/profile', label: 'Profile', icon: UserIcon }] : []),
                ...(user && user.isGuest ? [{ to: '/login', label: 'Sign in', icon: LogIn }] : []),
              ].map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-3 px-3 py-2.5 font-condensed text-sm font-semibold uppercase tracking-[0.18em]',
                      isActive ? 'bg-mauve text-peach' : 'text-slate-300',
                    )
                  }
                >
                  <l.icon className="h-4 w-4" /> {l.label}
                </NavLink>
              ))}

              {user && !user.isGuest && (
                <button
                  onClick={async () => {
                    setOpen(false);
                    await logout();
                    nav('/');
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 text-left font-condensed text-sm font-semibold uppercase tracking-[0.18em] text-slate-300"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}