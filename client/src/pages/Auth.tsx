import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, KeyRound, LogIn, LogOut, UserPlus, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../components/Navbar';
import { Spinner } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { cx } from '../lib/format';

const USERNAME = /^[a-zA-Z0-9_.-]{3,24}$/;

export function AuthPage() {
  const [sp, setSp] = useSearchParams();
  const mode = sp.get('mode') === 'register' ? 'register' : 'login';
  const { user, login, register, logout, ensureUser } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playAsGuest = async () => {
    setBusy(true);
    setError(null);
    try {
      await ensureUser();
      nav('/arena');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setMode = (m: 'login' | 'register') => {
    setError(null);
    setSp(m === 'register' ? { mode: 'register' } : {}, { replace: true });
  };

  const validate = () => {
    if (!USERNAME.test(username)) return 'Username must be 3-24 characters: letters, numbers, _ . -';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (password.length > 128) return 'Password is too long';
    return null;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) return setError(v);
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') {
        await register(username, password, displayName.trim() || undefined);
        toast(user?.isGuest ? 'Account created - your guest progress was kept!' : 'Welcome to NewsQuest!', 'success');
      } else {
        await login(username, password);
        toast('Welcome back!', 'success');
      }
      nav('/profile');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (user && !user.isGuest) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card p-8 text-center">
          <div className="text-6xl">{user.avatar}</div>
          <h1 className="mt-3 font-display text-2xl font-bold text-white">Signed in as {user.displayName}</h1>
          <p className="mt-1 text-sm text-slate-400">@{user.username}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link to="/profile" className="btn-primary">
              View profile
            </Link>
            <button
              onClick={async () => {
                await logout();
                toast('Signed out', 'info');
              }}
              className="btn-ghost"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="hidden lg:block">
        <Logo />
        <h1 className="mt-6 font-display text-6xl font-black leading-tight text-white">
          Read today.
          <br />
          <span className="text-accent">Rank tomorrow.</span>
        </h1>
        <p className="mt-4 max-w-md text-slate-400">
          Save your XP, streaks, achievements and question vault across devices. Already playing as a guest? Register and everything carries over.
        </p>
        <div className="mt-8 grid max-w-sm grid-cols-3 gap-3">
          {['Streaks', 'Badges', 'Vault'].map((t, i) => (
            <motion.div key={t} animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, delay: i * 0.4 }} className={cx('rounded-2xl border-2 border-mauve px-3 py-4 text-center text-sm font-bold shadow-hard-sm', ['bg-bronze text-mauve', 'bg-mauve text-peach', 'bg-sage text-mauve'][i])}>
              {t}
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card mx-auto w-full max-w-md p-8">
        <div className="relative mb-6 grid grid-cols-2 rounded-xl border-2 border-mauve bg-ink-900 p-1 text-sm">
          {(['login', 'register'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={cx('relative z-10 rounded-lg py-2 font-bold transition-colors', mode === m ? 'text-peach' : 'text-slate-300')}>
              {mode === m && <motion.span layoutId="auth-tab" className="absolute inset-0 -z-10 rounded-lg bg-mauve" />}
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        {user?.isGuest && mode === 'register' && (
          <p className="mb-4 rounded-xl border-2 border-mauve bg-success p-3 text-xs font-medium text-mauve">
            You're playing as <b>{user.displayName}</b>. Registering upgrades this guest profile - XP, coins and vault are kept.
          </p>
        )}
        {user?.isGuest && mode === 'login' && (
          <p className="mb-4 rounded-xl border-2 border-mauve bg-peach p-3 text-xs font-medium text-mauve">
            Signing in switches from your guest profile <b>{user.displayName}</b> to your account. Guest progress is not merged - to keep it, choose <b>Create account</b> instead.
          </p>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate>
          <label className="block">
            <span className="label mb-1.5 block">Username</span>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" maxLength={24} autoFocus />
          </label>
          <AnimatePresence initial={false}>
            {mode === 'register' && (
              <motion.label initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="block overflow-hidden">
                <span className="label mb-1.5 block">Display name (optional)</span>
                <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={32} />
              </motion.label>
            )}
          </AnimatePresence>
          <label className="block">
            <span className="label mb-1.5 block">Password</span>
            <div className="relative">
              <input
                className="input pr-10"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                maxLength={128}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {mode === 'register' && (
              <div className="mt-2 h-2.5 overflow-hidden border-2 border-mauve bg-ink-900">
                <motion.div
                  className={cx('h-full', password.length >= 12 ? 'bg-mauve' : password.length >= 8 ? 'bg-screen' : 'hatch bg-danger')}
                  animate={{ width: `${Math.min(100, (password.length / 12) * 100)}%` }}
                />
              </div>
            )}
          </label>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }} exit={{ opacity: 0 }} className="rounded-xl border-2 border-mauve bg-danger p-3 text-sm font-semibold text-black" role="alert">
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button type="submit" disabled={busy} className="btn-primary w-full !py-3">
            {busy ? <Spinner className="h-4 w-4" /> : mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 font-condensed text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          <span className="h-px flex-1 bg-mauve/30" /> or <span className="h-px flex-1 bg-mauve/30" />
        </div>

        <button type="button" onClick={playAsGuest} disabled={busy} className="btn-ghost w-full !py-3">
          <UserRound className="h-4 w-4" /> {user?.isGuest ? `Continue as ${user.displayName}` : 'Try the demo as a guest'}
        </button>

        <p className="mt-2 text-center text-xs text-slate-500">
          No sign-up needed: play quizzes, save questions and build a streak. Create an account any time to keep your progress and join the leaderboard.
        </p>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <KeyRound className="h-3.5 w-3.5" /> Passwords are hashed with scrypt. No email required.
        </p>
      </motion.div>
    </div>
  );
}