/* No top-level React import on purpose: this file is the eagerly-loaded
   entry (referenced directly from index.html), so anything imported
   here statically ships in the initial page load regardless of whether
   the visitor ever scrolls to the Digital Twin section. React, R3F,
   drei, three and gsap are all pulled in transitively by
   GltfTwinScene.jsx — deferring that import until the section is
   actually about to enter the viewport keeps that whole (large) graph
   out of the critical path for visitors who never reach it.

   Points at GltfTwinScene.jsx (loads the real facility GLB at
   public/models/iona-tesis-3d.glb) rather than the older
   DigitalTwinScene.jsx (hand-built procedural stations, no GLB) — the
   latter is left in the repo unwired, same as before.

   #iona-digital-twin-root is a normal-flow, always-visible box on every
   viewport size (Phase 83's 2-column grid stacks it below the copy on
   mobile, not `hidden md:block`), so this same IntersectionObserver
   mounts the twin for both mobile and desktop — no separate mobile
   mount path needed. */
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
