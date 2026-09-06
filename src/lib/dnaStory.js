/** One document-space SVG. Section order remains editable by the CMS. */
export function initDnaStory() {
  const origin = document.getElementById('ionaflux-teaser');
  const end = document.getElementById('biogaz-hesaplayici');
  if (!origin || !end) return () => {};
  const ns = 'http://www.w3.org/2000/svg';
  const layer = document.createElement('div');
  layer.id = 'ionaflux-dna-origin';
  layer.className = 'dna-story';
  layer.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('fill', 'none');
  layer.append(svg);
  document.body.append(layer);
  let frame = 0;
  let previous = '';
  const draw = () => {
    frame = 0;
    const body = document.body.getBoundingClientRect();
    const start = origin.getBoundingClientRect();
    const finish = end.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const top = Math.round(start.top - body.top);
    const height = Math.max(0, Math.round(finish.bottom - start.top));
    const signature = `${width}:${top}:${height}`;
    if (signature === previous) return;
    previous = signature;
    layer.style.top = `${top}px`;
    layer.style.height = `${height}px`;
    layer.hidden = height <= 0;
    if (!height) return;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.replaceChildren();
    const steps = Math.max(180, Math.ceil(height / 12));
    const turns = height / Math.max(480, width * .55);
    const strands = ['', ''];
    const point = (t, strand) => {
      const phase = t * Math.PI * 2 * turns + strand * Math.PI;
      const x = width * (.85 - .62 * t) + Math.sin(phase) * width * .15;
      const y = 80 + t * (height - 140) + Math.cos(phase) * 22;
      return [x, y];
    };
    const path = (d, opacity, strokeWidth = 1) => {
      const node = document.createElementNS(ns, 'path');
      node.setAttribute('d', d);
      node.setAttribute('stroke', 'currentColor');
      node.setAttribute('stroke-width', String(strokeWidth));
      node.setAttribute('opacity', String(opacity));
      svg.append(node);
    };
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = point(t, 0), b = point(t, 1);
      for (const strand of [0, 1]) {
        const p = strand ? b : a;
        strands[strand] += `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)} `;
      }
      if (i % 3 === 0) path(`M${a[0]},${a[1]}L${b[0]},${b[1]}`, .22);
    }
    strands.forEach(d => path(d, .72, 1.35));
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
  const observer = new ResizeObserver(schedule);
  observer.observe(document.body);
  observer.observe(origin);
  observer.observe(end);
  window.addEventListener('resize', schedule, { passive: true });
  document.addEventListener('i18nchange', schedule);
  const orderObserver = new MutationObserver(schedule);
  orderObserver.observe(document.body, { childList: true });
  draw();
  return () => {
    observer.disconnect(); orderObserver.disconnect(); cancelAnimationFrame(frame);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('i18nchange', schedule);
    layer.remove();
  };
}

