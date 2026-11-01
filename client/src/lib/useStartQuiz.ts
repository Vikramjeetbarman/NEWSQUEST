import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from './api';

type StartOpts = Parameters<typeof api.startQuiz>[0];

export function useStartQuiz() {
  const { ensureUser } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [starting, setStarting] = useState(false);

  const start = useCallback(
    async (opts: StartOpts) => {
      if (starting) return;
      setStarting(true);
      try {
        await ensureUser();
        const view = await api.startQuiz(opts);
        nav(`/play/${view.sessionId}`, { state: { view } });
      } catch (e) {
        toast((e as Error).message, 'error');
      } finally {
        setStarting(false);
      }
    },
    [ensureUser, nav, toast, starting],
  );

  return { start, starting };
}