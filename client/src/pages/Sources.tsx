import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Database, RefreshCw, ShieldAlert, WifiOff, XCircle, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PageHeader, Skeleton, Spinner, sectionLabel } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../lib/api';
import { cx, timeAgo } from '../lib/format';
import type { FeedInfo, PipelineStatus } from '../lib/types';

const STATUS: Record<FeedInfo['status'], { icon: LucideIcon; cls: string; label: string }> = {
  ok: { icon: CheckCircle2, cls: 'text-emerald-300', label: 'OK' },
  blocked: { icon: ShieldAlert, cls: 'text-amber-300', label: 'Blocked' },
  error: { icon: XCircle, cls: 'text-rose-300', label: 'Error' },
  offline: { icon: WifiOff, cls: 'text-slate-400', label: 'Offline' },
  pending: { icon: CircleDashed, cls: 'text-sky-300', label: 'Pending' },
};

export function SourcesPage() {
  const { ensureUser } = useAuth();
  const { toast } = useToast();
  const { status: liveStatus, newsVersion } = useLive();
  const [data, setData] = useState<{ feeds: FeedInfo[]; status: PipelineStatus } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.sources().then(setData, () => {}), []);
  useEffect(() => {
    void load();
  }, [load, newsVersion]);

  const status = liveStatus ?? data?.status;

  const refresh = async () => {
    setBusy(true);
    try {
      await ensureUser();
      const r = await api.refresh();
      toast(r.skipped ? 'A fetch is already running.' : `Fetch complete - ${r.added ?? 0} new stories.`, 'success');
      await load();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const blocked = status && status.feeds.blocked > 0 && status.feeds.ok === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Pipeline"
        title={
          <>
            News <span className="text-accent">sources</span>
          </>
        }
        actions={
          <button onClick={refresh} disabled={busy || status?.running} className="btn-primary">
            {busy || status?.running ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />} Fetch now
          </button>
        }
      >
        NewsQuest polls the public RSS feeds of the Press Information Bureau (PIB), Government of India, and News On AIR (Prasar Bharati), summarises each release
        and generates exam-style questions automatically. Every story credits its source and links to the original. NewsQuest is not affiliated with either.
      </PageHeader>

      {status ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { icon: Database, label: 'Mode', value: status.mode === 'live' ? 'Live' : status.mode === 'demo' ? 'Demo archive' : 'Empty', color: status.mode === 'live' ? 'text-emerald-300' : 'text-amber-300' },
            { icon: Clock, label: 'Last run', value: status.lastRun ? timeAgo(status.lastRun) : 'never', color: 'text-sky-300' },
            { icon: RefreshCw, label: 'Interval', value: `${status.intervalMinutes} min`, color: 'text-violet-300' },
            { icon: CheckCircle2, label: 'Live stories', value: String(status.liveCount), color: 'text-emerald-300' },
          ].map((t, i) => (
            <motion.div key={t.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-4">
              <t.icon className={cx('h-5 w-5', t.color)} />
              <div className="mt-2 font-display text-xl font-bold text-white">{t.value}</div>
              <div className="text-xs text-slate-500">{t.label}</div>
            </motion.div>
          ))}
        </div>
      ) : (
        <Skeleton className="h-24 w-full rounded-2xl" />
      )}

      {blocked && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 rounded-2xl border-2 border-border-mauve bg-peach p-5 text-sm text-mauve shadow-hard-sm">
          <AlertTriangle className="-mt-0.5 h-5 w-5 shrink-0 text-mauve" />
          <div>
            <b>The news feeds are blocked on this network.</b> A corporate proxy or firewall is returning a block page instead of the RSS feed.
            NewsQuest keeps working on its built-in demo archive and will
            switch to live news automatically as soon as a fetch succeeds (for example on a home network). Nothing needs to change in the app.
          </div>
        </motion.div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-mauve text-[11px] font-bold uppercase tracking-wider text-peach">
            <tr className="border-b-2 border-border-mauve">
              <th className="px-5 py-3">Feed</th>
              <th className="px-3 py-3">Section</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Items</th>
              <th className="px-3 py-3">Last attempt</th>
              <th className="px-5 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-mauve/15">
            {(data?.feeds ?? []).map((f, i) => {
              const s = STATUS[f.status];
              return (
                <motion.tr key={f.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.4) }} className="transition-colors hover:bg-bronze/30">
                  <td className="px-5 py-3">
                    <div className="font-medium text-white">{f.sourceName}</div>
                    <div className="max-w-[260px] truncate text-[11px] text-slate-500" title={f.url}>
                      {f.url}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-300">{f.section === 'auto' ? 'Auto-detect' : sectionLabel(f.section)}</td>
                  <td className="px-3 py-3">
                    <span className={cx('flex items-center gap-1.5', s.cls)}>
                      <s.icon className="h-4 w-4" /> {s.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-slate-300">{f.items}</td>
                  <td className="px-3 py-3 text-slate-400">{f.lastAttempt ? timeAgo(f.lastAttempt) : '-'}</td>
                  <td className="max-w-[280px] truncate px-5 py-3 text-xs text-slate-500" title={f.message}>
                    {f.message || (f.ms ? `${f.ms} ms` : '')}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
        {!data && <Skeleton className="m-5 h-40" />}
      </div>
    </div>
  );
}