const LAYER_ID = 'iona-hotspot-layer';

/* Pins are plain percentage x/y over a fixed, full-viewport layer — never
   projected from real Three.js world coordinates.

   DİKKAT (2026-09-19): bunlar teknoloji.html'deki 3 makinelik WebGL
   vitrinini işaret etmek için yazılmıştı; o vitrin kaldırıldı. Kod
   olduğu gibi duruyor ve liste boşken (varsayılan) hiçbir şey çizmiyor,
   ama admin panelindeki "3D Bilgi Noktaları" ile pin eklenirse artık
   bir model yerine sayfanın üstünde boşluğa yerleşir. Özellik yeniden
   kullanılacaksa hedefini de yeniden tanımlamak gerekir. */
export function applyHotspots(list) {
  const existing = document.getElementById(LAYER_ID);
  if (!list || list.length === 0) {
    existing?.remove();
    return;
  }

  const layer = existing || document.createElement('div');
  layer.id = LAYER_ID;
  layer.style.position = 'fixed';
  layer.style.inset = '0';
  layer.style.zIndex = '5';
  layer.style.pointerEvents = 'none';
  layer.innerHTML = '';

  list.forEach((spot) => {
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.setAttribute('aria-label', spot.title || 'Bilgi noktası');
    pin.style.position = 'absolute';
    pin.style.left = `${spot.x ?? 50}%`;
    pin.style.top = `${spot.y ?? 50}%`;
    pin.style.transform = 'translate(-50%, -50%)';
    pin.style.pointerEvents = 'auto';
    pin.style.width = '18px';
    pin.style.height = '18px';
    pin.style.borderRadius = '50%';
    pin.style.background = 'rgba(255,117,31,0.9)';
    pin.style.border = '2px solid white';
    pin.style.boxShadow = '0 0 0 4px rgba(255,117,31,0.25)';
    pin.style.cursor = 'pointer';

    const tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.left = '50%';
    tooltip.style.bottom = 'calc(100% + 10px)';
    tooltip.style.transform = 'translateX(-50%)';
    tooltip.style.minWidth = '180px';
    tooltip.style.maxWidth = '240px';
    tooltip.style.background = 'rgba(14,18,16,0.95)';
    tooltip.style.color = '#fff';
    tooltip.style.borderRadius = '8px';
    tooltip.style.padding = '10px 12px';
    tooltip.style.fontSize = '13px';
    tooltip.style.display = 'none';
    tooltip.style.pointerEvents = 'none';
    tooltip.innerHTML = `<strong style="display:block;margin-bottom:2px;">${escapeHtml(spot.title || '')}</strong><span style="opacity:0.75;">${escapeHtml(spot.description || '')}</span>`;

    pin.appendChild(tooltip);
    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = tooltip.style.display === 'block';
      layer.querySelectorAll('div').forEach((t) => { t.style.display = 'none'; });
      tooltip.style.display = isOpen ? 'none' : 'block';
    });

    layer.appendChild(pin);
  });

  document.addEventListener('click', () => {
    layer.querySelectorAll('div').forEach((t) => { t.style.display = 'none'; });
  });

  if (!existing) document.body.appendChild(layer);
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
