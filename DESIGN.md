---
name: Iona Editorial
colors:
  bg: '#ffffff'
  surface: '#ffffff'
  surface-2: '#f2f0ea'
  section-alt: '#ffffff'
  text: '#14181a'
  text-muted: '#565f58'
  border: 'rgba(0,0,0,0.06)'
  border-strong: 'rgba(0,0,0,0.1)'
  nav-bg: 'rgba(255,255,255,0.62)'
  brand: '#2D9937'
  brand-hover: '#3AB347'
  brand-yellow: '#FFC700'
  brand-orange: '#FF751F'
  invert-bg: '#09090b'
  dark-bg: '#0e1210'
  dark-surface: '#171b18'
  dark-text: '#eef1ec'
  dark-brand: '#3FBF4C'
typography:
  display-hero:
    fontFamily: Inter
    fontSize: 120px
    fontWeight: '700'
    lineHeight: 110%
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Inter
    fontSize: 64px
    fontWeight: '600'
    lineHeight: 120%
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 120%
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 140%
  body-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 160%
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 160%
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 100%
    letterSpacing: 0.1em
rounded:
  none: 0
  sm: 0.25rem
  md: 0.5rem
  full: 9999px
spacing:
  container-max: 1440px
  edge-margin: 80px
  gutter: 32px
  section-gap: 96px
  element-gap: 24px
---

## Brand & Style

**Iona Editorial** — a light-by-default (dark-mode-toggleable) corporate/product site for a biogas engineering company, redirected in Phase 114 toward a museum/architectural editorial register (MNBAQ, Dezeen-style publications): extreme whitespace, hairline 1px rules instead of card chrome, large confident type, asymmetric grids, and the occasional pitch-dark inversion for a metric, quote, or CTA. This supersedes the older "Obsidian & Emerald" dark-cinematic direction documented here previously, which was never actually shipped — the real site has run a pure-white light theme (with a separate, non-oppressive dark toggle) since Phase 91.

- **Editorial / Cardless (the default):** text-heavy and feature/catalog sections read as one continuous ruled sheet — a numeral or small icon, a headline, copy, a hairline `border-b` — never a grid of identical shadow+rounded-corner boxes. This is the site's now-established signature: see the "index list" pattern reused across Hakkımızda, Hizmetler, Sektörler, IonaFlux and the homepage's Explore/Services sections.
- **High-Contrast Inversion (used sparingly):** one, at most two, sections per page invert to `bg-zinc-950`/`#0a0a0a` with white type and the brand green/yellow as the only color, reserved for a page's real climax — a CTA, a metric block, a quote. IonaFlux is the one page that runs this treatment end-to-end, because the product itself (a dark SCADA dashboard) is the subject.
- **Photography keeps a soft shadow, never a card does.** Full-bleed and framed photos may carry a soft ambient `box-shadow` for lift; content boxes do not.

## Colors

- **Primary Green `#2D9937`** (hover `#3AB347`) — the brand's official primary, used for CTAs, active states, index numerals, thin accent bars.
- **Accent Yellow `#FFC700`** — telemetry/highlight accent, alternates with green in numbered lists and dark-inversion sections; not a general CTA color.
- **Brand Orange `#FF751F`** — the light-theme's own CTA/eyebrow color, distinct from the yellow accent; kept exactly as-is, not touched by the Phase 114 pass.
- **Light theme:** pure white `#ffffff` background and surfaces, no off-white tint (sections separate by hairline `border-t`, not by alternating tone).
- **Dark theme (site-wide toggle):** `#0e1210` background, brightened brand tints for contrast (`#3FBF4C` green).
- **Inversion sections (Phase 114):** `bg-zinc-950`/`#0a0a0a`, independent of the light/dark toggle — a deliberate one-off "shock" surface, not the dark theme.

## Typography

Inter throughout (display/headline/body/label-caps scale unchanged from the original spec — see the frontmatter). Large, confident headline sizes carry the editorial pages; `label-caps` (12px, 700 weight, wide tracking) marks eyebrows, index numerals, and technical specs.

## Layout & Spacing

12-column grid, `container-max` 1440px, generous section padding (`py-20 md:py-24`, inversion sections go up to `py-32`). Sections separate with a single hairline `border-t`, never a background-color band unless it's a deliberate inversion. Index lists use `lg:grid-cols-[numeral-width_1fr]` rows with a `border-b` between entries, not gutters between boxes.

## Elevation & Depth

No card shadows. `border` (1px, `--border`/`slate-200`/`white/10` depending on light-vs-inversion) is the only framing device for grouped content. Photography and video keep soft ambient shadows for lift; buttons may carry a colored glow on hover (`hover:shadow-[0_0_20px_...]`) as a deliberate, sparingly-used accent — not a default.

## Shapes

Sharp-to-modest rounding. Photo frames and large media containers stay square-cornered (no `rounded-xl` on hero/gallery images). Small UI chrome (pills, buttons, badges) keeps `rounded-full`. Bento-style asymmetric grids (`.bento-card`, About page) keep a small `0.5rem` radius, no shadow.

## Components

- **Index list row** (this phase's signature component): numeral or small icon in a fixed-width column, headline + copy + optional bullet list in the remaining space, `border-b` divider, repeated down the section. Used for service catalogs, partner lists, feature grids, and page-navigation indexes — replaces the old same-size icon+heading+text card grid everywhere it appeared.
- **Inversion section:** `bg-zinc-950`, white headline/body, `#ffc700` eyebrow, brand-green accents on numerals/icons/bars/buttons. One per page, at the page's real climax.
- **Buttons:** solid brand-green or brand-orange fill, white text, `rounded-full` for pills / `rounded-none` for the contact form's primary CTA — unchanged from the pre-114 system.
- **Photography:** full-bleed or framed with a soft ambient shadow, square corners, no rounded card treatment.
