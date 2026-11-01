const clients = new Set();
const MAX_CLIENTS = 500;

export function sseHandler(req, res) {
  if (clients.size >= MAX_CLIENTS) return res.status(503).end();
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 5000\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
}

export function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) c.write(msg);
}

setInterval(() => {
  for (const c of clients) c.write(': ping\n\n');
}, 25_000).unref();