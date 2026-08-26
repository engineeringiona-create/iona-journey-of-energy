/* Same lazy-mount pattern as src/components/DigitalTwin/mount.jsx: no
   top-level React import here (this eagerly-loaded entry is referenced
   directly from index.html), React/ReactDOM/PhoneMockup only pulled in
   once the section is actually about to enter the viewport. */
const container = document.getElementById('ionaflux-phone-mockup-root');

if (container) {
  let mounted = false;

  const mount = () => {
    if (mounted) return;
    mounted = true;
    Promise.all([import('react'), import('react-dom/client'), import('./PhoneMockup.jsx')]).then(
      ([React, { createRoot }, { default: PhoneMockup }]) => {
        createRoot(container).render(
          React.createElement(React.StrictMode, null, React.createElement(PhoneMockup))
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
