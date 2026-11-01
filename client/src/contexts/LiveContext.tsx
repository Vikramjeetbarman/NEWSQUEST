import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { Meta, PipelineStatus, SectionKey } from '../lib/types';

export interface NewsEvent {
  added: number;
  headlines: { id: string; title: string; section: SectionKey }[];
  at: number;
}

interface LiveApi {
  meta: Meta | null;
  metaError: string | null;
  connected: boolean;
  status: PipelineStatus | null;
  newsVersion: number;
  lastNews: NewsEvent | null;
  refreshMeta: () => Promise<void>;
}

const Ctx = createContext<LiveApi | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [newsVersion, setNewsVersion] = useState(0);
  const [lastNews, setLastNews] = useState<NewsEvent | null>(null);
  const retry = useRef(1000);

  const refreshMeta = useCallback(async () => {
    try {
      const m = await api.meta();
      setMeta(m);
      setStatus(m.status);
      setMetaError(null);
    } catch (e) {
      setMetaError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refreshMeta();
  }, [refreshMeta]);

  useEffect(() => {
    let es: EventSource | null = null;
    let timer: number | undefined;
    let closed = false;
    const connect = () => {
      es = new EventSource('/api/stream');
      es.onopen = () => {
        setConnected(true);
        retry.current = 1000;
      };
      es.onerror = () => {
        setConnected(false);
        es?.close();
        if (!closed) timer = window.setTimeout(connect, (retry.current = Math.min(retry.current * 2, 30_000)));
      };
      es.addEventListener('status', (ev) => {
        try {
          setStatus(JSON.parse((ev as MessageEvent).data));
        } catch {
        }
      });
      es.addEventListener('news', (ev) => {
        try {
          const d = JSON.parse((ev as MessageEvent).data);
          setLastNews({ ...d, at: Date.now() });
          setNewsVersion((v) => v + 1);
          void refreshMeta();
        } catch {
        }
      });
    };
    connect();
    return () => {
      closed = true;
      window.clearTimeout(timer);
      es?.close();
    };
  }, [refreshMeta]);

  const value = useMemo(
    () => ({ meta, metaError, connected, status, newsVersion, lastNews, refreshMeta }),
    [meta, metaError, connected, status, newsVersion, lastNews, refreshMeta],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLive() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLive outside provider');
  return c;
}