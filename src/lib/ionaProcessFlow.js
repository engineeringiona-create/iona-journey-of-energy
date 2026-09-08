/** Two process lines connect the plant to the page without crossing reading columns. */
export function initIonaProcessFlow() {
  const origin = document.querySelector('.hero-model-column');
  const finish = document.getElementById('biogaz-hesaplayici');
  if (!origin || !finish) return;
  const ns = 'http://www.w3.org/2000/svg';
  const layer = document.createElement('div');
  layer.className = 'iona-process-flow'; layer.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('fill', 'none');
  layer.append(svg); document.body.append(layer);
  let frame = 0, signature = '';
  function element(tag, attributes) {
    const node = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    svg.append(node); return node;
  }
  function draw() {
    frame = 0;
    const body = document.body.getBoundingClientRect();
    const start = origin.getBoundingClientRect();
    const end = finish.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const height = Math.ceil(end.bottom - body.top - 24);
    const y = Math.round(start.bottom - body.top - 65);
    const sections = [...document.querySelectorAll('body > section')].map(section => Math.round(section.getBoundingClientRect().top - body.top)).filter(top => top > y + 100 && top < height - 80);
    const next = [width, height, y, ...sections].join(':');
    if (signature === next) return; signature = next;
    layer.style.height = `${height}px`; svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.replaceChildren();
    const compact = width < 760;
    const rail = width - (compact ? 9 : Math.max(20, width * .022));
    const separation = compact ? 5 : 9;
    const startX = compact ? rail - 30 : Math.min(start.right - body.left - 70, rail - 60);
    ['#4c8153', '#ce942f'].forEach((color, i) => {
      const x = rail - i * separation;
      const sy = y + i * separation;
      let d = `M ${startX} ${sy} H ${x - 24} Q ${x} ${sy} ${x} ${sy + 24}`;
      sections.forEach(top => {
        const inset = compact ? 3 : 10;
        d += ` V ${top - 22} Q ${x} ${top - 8} ${x - inset} ${top} Q ${x} ${top + 8} ${x} ${top + 22}`;
      });
      d += ` V ${height - 20} Q ${x} ${height} ${x - 20} ${height} H ${x - (compact ? 35 : 90)}`;
      element('path', { d, stroke: color, 'stroke-width': compact ? 1 : 1.25, opacity: .35 });
      element('path', { d, stroke: color, 'stroke-width': compact ? 1.5 : 2, 'stroke-dasharray': '18 580', 'stroke-linecap': 'round', class: `iona-process-pulse pulse-${i}` });
      element('circle', {cx: startX, cy: sy, r: compact ? 2 : 3, fill: '#fffdf8', stroke: color, 'stroke-width': 1.5});
      sections.forEach(top => element('circle', {cx: x - (compact ? 3 : 10), cy: top, r: compact ? 2 : 3.5, fill: '#fffdf8', stroke: color, 'stroke-width': 1}));
    });
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
  const resize = new ResizeObserver(schedule); resize.observe(document.body); resize.observe(origin); resize.observe(finish);
  window.addEventListener('resize', schedule, {passive: true});
  const mutation = new MutationObserver(schedule); mutation.observe(document.body, {childList: true});
  document.addEventListener('visibilitychange', () => layer.classList.toggle('is-paused', document.hidden));
  const intersection = new IntersectionObserver(entries => { layer.classList.toggle('is-outside', !entries[0].isIntersecting); });
  intersection.observe(layer); draw();
}
