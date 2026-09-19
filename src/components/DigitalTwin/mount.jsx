/* No top-level React import on purpose: this file is the eagerly-loaded
   entry (referenced directly from index.html), so anything imported
   here statically ships in the initial page load regardless of whether
   the visitor ever scrolls to the Digital Twin section. React, R3F,
   drei, three and gsap are all pulled in transitively by
   GltfTwinScene.jsx — deferring that import until the section is
   actually about to enter the viewport keeps that whole (large) graph
   out of the critical path for visitors who never reach it.

   Points at GltfTwinScene.jsx (loads the real facility GLB at
   iona-tesis-3d.draco.glb, see modelAssets.js) rather than the older
   DigitalTwinScene.jsx (hand-built procedural stations, no GLB) — the
   latter is left in the repo unwired, same as before.

   #iona-digital-twin-root is an always-visible box on every viewport
   size (Phase 97: a borderless `absolute inset-0` layer spanning the
   whole hero section, not a grid column — see index.html), not
   `hidden md:block`, so this same IntersectionObserver mounts the twin
   for both mobile and desktop — no separate mobile mount path needed. */
import { remoteModelOrigin } from '../../lib/modelAssets.js';

/* modelAssets.js dışında bu dosyanın statik importu yok ve olmamalı — o da
   birkaç satırlık, bağımlılıksız bir env okuyucu.

   GLB Supabase Storage'dan geliyorsa ayrı bir origin demektir: DNS + TLS
   el sıkışması, model gerçekten istenene kadar (IntersectionObserver
   tetiklenene kadar) beklerse o maliyet doğrudan modelin görünme süresine
   eklenir. preconnect'i şimdi kurup el sıkışmayı kullanıcının scroll'uyla
   paralel hale getiriyoruz. crossorigin şart: GLB'yi fetch eden three
   CORS modunda istiyor, bağlantı havuzları ayrı — crossorigin'siz
   preconnect bu isteğe hiç yaramaz. */
const modelCdnOrigin = remoteModelOrigin();
if (modelCdnOrigin) {
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = modelCdnOrigin;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

const container = document.getElementById('iona-digital-twin-root');

if (container) {
  let mounted = false;

  const mount = () => {
    if (mounted) return;
    mounted = true;
    Promise.all([import('react'), import('react-dom/client'), import('./GltfTwinScene.jsx')]).then(
      ([React, { createRoot }, { default: GltfTwinScene }]) => {
        createRoot(container).render(
          React.createElement(React.StrictMode, null, React.createElement(GltfTwinScene))
        );
      }
    );
  };

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      mount();
    },
    { rootMargin: '200px 0px', threshold: 0 }
  );
  observer.observe(container);
}
