import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';

/* Ported 1:1 from the old public/tailwind-config.js (the Play CDN's
   runtime config) — same darkMode/theme.extend values, same two plugins
   the CDN script loaded via `?plugins=forms,container-queries`. Nothing
   in the "Iona Luminal" token set changed, only how it gets compiled. */

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  /* Every real HTML entry at the project root, not just index.html —
     this is a multi-page site (six pages ship: index, hakkimizda,
     teknoloji, etki, iletisim, ionaflux; see vite.config.js's
     rollupOptions.input), so scanning only index.html would purge every
     utility class that's only used on the other five pages. code.html
     exists but isn't a Vite build entry and isn't deployed, so it's
     left on the CDN script it already has rather than pulled into this
     glob. public/models/*.html are separate, self-styled standalone
     demo pages with their own <style> block, not Tailwind consumers. */
  content: ['./*.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'surface-bright': '#ffffff',
        'on-secondary-fixed': '#eef1ec',
        'surface-variant': '#ece8de',
        'glow-green': 'rgba(34, 112, 60, 0.22)',
        'brand-orange': '#ff751f',
        'on-secondary': '#3b423d',
        'on-primary-container': '#0b2e12',
        'on-secondary-fixed-variant': '#454747',
        'primary-container': '#22703c',
        'inverse-on-surface': '#f7f6f1',
        'surface-container-low': '#fbfaf7',
        'secondary-container': '#e4e1d6',
        outline: '#767f78',
        'surface-container-highest': '#e2ded2',
        'surface-container': '#f2f0ea',
        'secondary-fixed-dim': '#4b544d',
        'surface-tint': '#22703c',
        'text-muted': '#6b6b63',
        'on-tertiary-container': '#690034',
        'primary-fixed': '#0b2e12',
        'error-container': '#93000a',
        'surface-elevated': '#ffffff',
        'on-surface-variant': '#565f58',
        'tertiary-fixed-dim': '#ffb1c7',
        'on-primary': '#ffffff',
        primary: '#22703c',
        'secondary-fixed': '#2f342f',
        'on-error': '#690005',
        error: '#ba1a1a',
        'surface-container-high': '#eae7de',
        'on-primary-fixed': '#eef9ec',
        'on-background': '#14181a',
        'outline-variant': '#d8d2c4',
        'on-tertiary-fixed-variant': '#861948',
        secondary: '#4b544d',
        'on-tertiary': '#650032',
        'on-error-container': '#ffdad6',
        'tertiary-fixed': '#ffd9e2',
        'on-surface': '#14181a',
        'on-tertiary-fixed': '#3e001c',
        'surface-container-lowest': '#ffffff',
        'surface-dim': '#efece4',
        background: '#f7f6f1',
        'tertiary-container': '#f26f9d',
        tertiary: '#a4144f',
        surface: '#f7f6f1',
        'on-primary-fixed-variant': '#eef9ec',
        'primary-fixed-dim': '#4caf50',
        'inverse-surface': '#14181a',
        'inverse-primary': '#94f990',
        'on-secondary-container': '#2f342f',
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.25rem',
        xl: '0.5rem',
        full: '0.75rem',
      },
      spacing: {
        gutter: '32px',
        'element-gap': '24px',
        'section-gap': '96px',
        'edge-margin': '80px',
        'container-max': '1440px',
        'safe-margin-desktop': '80px',
        'stack-xl': '120px',
        'safe-margin-mobile': '24px',
        'stack-sm': '16px',
        'section-padding': '10vh',
        'stack-md': '40px',
      },
      /* Phase 82: brand identity manual sets the site's global font to
         Montserrat — Arial stays as the fallback (same role it always
         played here) for the split second before the webfont loads, or
         if it fails to. Every one of these 8 tokens feeds a class used
         sitewide (font-body-md alone is the base text on every page),
         so this one edit is the actual site-wide lever, not per-element
         overrides. Font weights (700/600 headings, 500/400/300 body)
         are set per fontSize step below, not here — fontFamily doesn't
         carry weight. */
      fontFamily: {
        'label-caps': ['Montserrat', 'Arial', 'sans-serif'],
        'headline-md': ['Montserrat', 'Arial', 'sans-serif'],
        'headline-lg-mobile': ['Montserrat', 'Arial', 'sans-serif'],
        'headline-lg': ['Montserrat', 'Arial', 'sans-serif'],
        'body-md': ['Montserrat', 'Arial', 'sans-serif'],
        'display-hero': ['Montserrat', 'Arial', 'sans-serif'],
        'body-lg': ['Montserrat', 'Arial', 'sans-serif'],
        'display-hero-mobile': ['Montserrat', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'label-caps': ['12px', { lineHeight: '100%', letterSpacing: '0.1em', fontWeight: '700' }],
        'headline-md': ['32px', { lineHeight: '140%', fontWeight: '600' }],
        'headline-lg-mobile': ['40px', { lineHeight: '120%', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-lg': ['64px', { lineHeight: '120%', letterSpacing: '-0.02em', fontWeight: '600' }],
        'body-md': ['16px', { lineHeight: '160%', fontWeight: '400' }],
        'display-hero': ['120px', { lineHeight: '110%', letterSpacing: '-0.04em', fontWeight: '700' }],
        'body-lg': ['20px', { lineHeight: '160%', fontWeight: '400' }],
        'display-hero-mobile': ['56px', { lineHeight: '110%', letterSpacing: '-0.02em', fontWeight: '800' }],
      },
    },
  },
  plugins: [forms, containerQueries],
};
