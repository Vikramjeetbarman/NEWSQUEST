import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { newsRouter } from './routes/news.js';
import { quizRouter } from './routes/quiz.js';
import { attachUser } from './services/auth.js';
import { startScheduler } from './services/pipeline.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(attachUser);

app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.get('origin');
    if (origin) {
      let host = null;
      try {
        host = new URL(origin).host;
      } catch {
        host = null;
      }
      if (host !== req.get('host')) return res.status(403).json({ error: 'Cross-origin request blocked' });
    }
    const hasBody = Number(req.headers['content-length'] || 0) > 0 || Boolean(req.headers['transfer-encoding']);
    if (hasBody && !req.is('application/json')) return res.status(415).json({ error: 'Send JSON' });
  }
  next();
});

app.use('/api/auth', authRouter);
app.use('/api', newsRouter);
app.use('/api', quizRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

if (fs.existsSync(path.join(config.clientDist, 'index.html'))) {
  app.use(express.static(config.clientDist, { maxAge: '1h', index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
} else {
  app.get('/', (_req, res) =>
    res.type('text').send("NewsQuest API is running. Start the web app with \"npm run dev\" (http://localhost:5173) or build it with \"npm run build\"."),
  );
}

app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500 && !err.expose) console.error('[error]', err);
  const message = err.expose || status < 500 ? err.message : 'Something went wrong on our side';
  res.status(status).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`NewsQuest API listening on http://localhost:${config.port}`);
  startScheduler().catch((err) => console.error('[scheduler] failed to start:', err));
});