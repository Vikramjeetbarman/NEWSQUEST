export function paintFavicon() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, 64, 64);
  ['#00AEEF', '#EC008C', '#FFF200', '#ECE0DE'].forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(4 + i * 14, 53, 14, 7);
  });
  ctx.fillStyle = '#ECE0DE';
  ctx.font = '900 46px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('N', 32, 46);

  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/png';
  link.href = c.toDataURL('image/png');
}