import { useEffect, useState } from 'react';

const FALLBACK = {
  brand: '#22703c',
  brandHover: '#2c8a4a',
  brandOrange: '#ff751f'
};

function readBrandColors() {
  if (typeof document === 'undefined') return FALLBACK;
  const styles = getComputedStyle(document.documentElement);
  const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  return {
    brand: read('--brand', FALLBACK.brand),
    brandHover: read('--brand-hover', FALLBACK.brandHover),
    brandOrange: read('--brand-orange', FALLBACK.brandOrange)
  };
}

/* Mirrors src/styles/base.css's --brand/--brand-hover/--brand-orange
   custom properties into React state, instead of duplicating their hex
   values as literals inside this React island. Re-reads them whenever
   the site's light/dark toggle flips the .dark class on <html> (see
   common.js initThemeToggle), via a MutationObserver, so React-rendered
   UI here stays in sync with the same tokens the rest of the site uses. */
export default function useBrandColors() {
  const [colors, setColors] = useState(readBrandColors);

  useEffect(() => {
    const update = () => setColors(readBrandColors());
    update();

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return colors;
}
