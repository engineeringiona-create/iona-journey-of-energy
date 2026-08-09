/* Replaces the old React/R3F Digital Twin scene (DigitalTwinScene.jsx
   and friends — left in place, unwired, in case any of it is reused
   later) with Google's <model-viewer> web component. No React, no
   Three.js/R3F/drei/gsap for this section anymore: model-viewer is a
   self-contained custom element, so the whole dependency graph that
   used to load here is gone. */
const MODEL_SRC = '/models/iona-tesis-3d.glb';

/* unpkg without a pinned version resolves to whatever is currently
   "latest" — a real stability risk (a future major bump could silently
   break this on an unrelated site visit with no code change on our
   side). Pinned to 4.3.1, the current latest stable release as of this
   writing; bump deliberately, not by surprise. */
const MODEL_VIEWER_SRC = 'https://unpkg.com/@google/model-viewer@4.3.1/dist/model-viewer.min.js';

const container = document.getElementById('iona-digital-twin-root');

function readAltText() {
  const dict = window.__ionaDict;
  return dict?.['home.digitaltwin.title'] ?? 'Iona biyogaz tesisinin 3B modeli';
}

function loadModelViewerScript() {
  if (customElements.get('model-viewer')) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = MODEL_VIEWER_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('model-viewer script failed to load'));
    document.head.appendChild(script);
  });
}

if (container) {
  let mounted = false;

  const mount = () => {
    if (mounted) return;
    mounted = true;

    loadModelViewerScript()
      .then(() => {
        const viewer = document.createElement('model-viewer');
        viewer.setAttribute('src', MODEL_SRC);
        viewer.setAttribute('alt', readAltText());
        viewer.setAttribute('camera-controls', '');
        viewer.setAttribute('auto-rotate', '');
        viewer.setAttribute('auto-rotate-delay', '3000');
        viewer.setAttribute('rotation-per-second', '18deg');
        viewer.setAttribute('shadow-intensity', '1');
        viewer.setAttribute('exposure', '0.9');
        viewer.setAttribute('environment-image', 'neutral');
        viewer.setAttribute('ar', '');
        viewer.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
        viewer.setAttribute('loading', 'eager'); // already lazy-mounted by the observer below; no need for model-viewer's own lazy mode on top
        viewer.style.width = '100%';
        viewer.style.height = '100%';
        viewer.style.setProperty('--poster-color', 'transparent');
        container.appendChild(viewer);

        document.addEventListener('i18nchange', () => viewer.setAttribute('alt', readAltText()));
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('[DigitalTwin] model-viewer failed to load', error);
      });
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
