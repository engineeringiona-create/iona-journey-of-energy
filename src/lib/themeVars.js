/* Phase 61: single source of truth for theme/typography CSS var
   application, shared by the real site (i18n.js, applied to `document`)
   and the admin "Tipografi & Tema" modal's live iframe preview — same
   function, two different target documents, so the two can never drift
   the way the old duplicated applyPreview()/applyThemeOverrides() pair
   risked. */

export const FONT_OPTIONS = [
  { id: 'arial', label: 'Orijinal (Arial)', cssStack: 'Arial, sans-serif', google: null },
  { id: 'jakarta', label: 'Plus Jakarta Sans', cssStack: '"Plus Jakarta Sans", sans-serif', google: 'Plus+Jakarta+Sans:wght@400;500;600;700;800' },
  { id: 'inter', label: 'Inter', cssStack: '"Inter", sans-serif', google: 'Inter:wght@400;500;600;700;800' },
  { id: 'outfit', label: 'Outfit', cssStack: '"Outfit", sans-serif', google: 'Outfit:wght@400;500;600;700;800' },
  { id: 'montserrat', label: 'Montserrat', cssStack: '"Montserrat", sans-serif', google: 'Montserrat:wght@400;500;600;700;800' },
  { id: 'syne', label: 'Syne', cssStack: '"Syne", sans-serif', google: 'Syne:wght@500;600;700;800' }
];

const FONT_LINK_ID = 'iona-google-font-link';
const THEME_STYLE_ID = 'iona-theme-vars';

function fontStackFor(fontId) {
  return FONT_OPTIONS.find((f) => f.id === fontId)?.cssStack || null;
}

function ensureFontLink(doc, fontId) {
  const font = FONT_OPTIONS.find((f) => f.id === fontId);
  if (!font?.google) return;
  let link = doc.getElementById(FONT_LINK_ID);
  if (!link) {
    link = doc.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    doc.head.appendChild(link);
  }
  const href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
}

/* theme shape: { brand, cta, surface, fontFamily, fontScale, borderOpacity,
   surfaceTint }. Every key is optional — only the ones actually set by an
   admin get a rule; the rest keep base.css's defaults untouched. */
export function applyThemeVars(doc, theme) {
  if (!doc) return;
  const root = doc.documentElement;
  const t = theme || {};

  if (t.fontFamily && t.fontFamily !== 'arial') {
    ensureFontLink(doc, t.fontFamily);
    root.dataset.fontOverride = '1';
    root.style.setProperty('--font-family-override', fontStackFor(t.fontFamily));
  } else {
    delete root.dataset.fontOverride;
    root.style.removeProperty('--font-family-override');
  }

  const hasScale = t.fontScale && t.fontScale !== 1;
  const hasBorder = t.borderOpacity !== undefined && t.borderOpacity !== null;
  const hasTint = !!t.surfaceTint;
  const commonRules = [];
  if (t.cta) commonRules.push(`--color-accent: ${t.cta};`, `--brand-orange: ${t.cta};`);
  if (t.brand) commonRules.push(`--brand: ${t.brand};`);
  if (t.surface) commonRules.push(`--border-green: color-mix(in srgb, ${t.surface} 24%, transparent);`);
  if (hasScale) commonRules.push(`--font-scale: ${t.fontScale};`);

  let style = doc.getElementById(THEME_STYLE_ID);
  if (commonRules.length === 0 && !hasBorder && !hasTint) {
    style?.remove();
    return;
  }
  if (!style) {
    style = doc.createElement('style');
    style.id = THEME_STYLE_ID;
    doc.head.appendChild(style);
  }

  let css = '';
  if (commonRules.length) css += `:root, :root.dark { ${commonRules.join(' ')} } `;
  if (hasBorder) {
    const strong = Math.min(t.borderOpacity * 1.6, 1);
    css += `:root { --border: rgba(0, 0, 0, ${t.borderOpacity}); --border-strong: rgba(0, 0, 0, ${strong}); } `;
    css += `:root.dark { --border: rgba(255, 255, 255, ${t.borderOpacity}); --border-strong: rgba(255, 255, 255, ${strong}); } `;
  }
  if (hasTint) {
    css += `:root { --surface-2: color-mix(in srgb, var(--brand) ${t.surfaceTint}%, #f2f0ea); --section-alt: color-mix(in srgb, var(--brand) ${t.surfaceTint}%, #f9fafb); } `;
    css += `:root.dark { --surface-2: color-mix(in srgb, var(--brand) ${t.surfaceTint}%, #1a1f1b); } `;
  }
  style.textContent = css;
}
