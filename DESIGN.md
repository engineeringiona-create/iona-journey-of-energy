---
name: Iona Luminal
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#becab9'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#899484'
  outline-variant: '#3f4a3c'
  surface-tint: '#78dc77'
  primary: '#78dc77'
  on-primary: '#00390a'
  primary-container: '#4caf50'
  on-primary-container: '#003c0b'
  inverse-primary: '#006e1c'
  secondary: '#c6c6c7'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b4b5b5'
  tertiary: '#ffb1c7'
  on-tertiary: '#650032'
  tertiary-container: '#f26f9d'
  on-tertiary-container: '#690034'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#94f990'
  primary-fixed-dim: '#78dc77'
  on-primary-fixed: '#002204'
  on-primary-fixed-variant: '#005313'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#ffd9e2'
  tertiary-fixed-dim: '#ffb1c7'
  on-tertiary-fixed: '#3e001c'
  on-tertiary-fixed-variant: '#861948'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
  surface-elevated: '#141414'
  text-muted: '#888888'
  glow-green: rgba(76, 175, 80, 0.15)
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
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max: 1440px
  edge-margin: 80px
  gutter: 32px
  section-gap: 160px
  element-gap: 24px
---

## Brand & Style

This design system is built for a premium, high-stakes industrial technology narrative. It shifts the brand from "standard engineering" to a "cinematic product launch" aesthetic, echoing the precision of high-end consumer electronics and the depth of aerospace engineering.

The visual direction follows a **Minimalist-Cinematic** approach:
- **Atmospheric Depth:** The UI is designed to disappear, allowing high-fidelity 3D WebGL models to take center stage. 
- **Zero-Boundary Philosophy:** Borders are eliminated in favor of structural alignment and tonal shifts.
- **Apple-Inspired Precision:** Large amounts of negative space (white space) create a sense of luxury and technical confidence.
- **High-End Motion:** The design anticipates fluid, momentum-based scrolling and micro-interactions that feel expensive and deliberate.

## Colors

The palette is strictly "Obsidian & Emerald." By using an almost-black base (#0A0A0A), we ensure that any 3D lighting or WebGL shaders appear vibrant and physically accurate.

- **Primary Green:** Reserved for mission-critical interactions, success states, and key data points. It is the "power" signal.
- **Neutral Base:** The #0A0A0A background is deep enough to hide screen edges on OLED displays, creating a seamless hardware-software transition.
- **Secondary White:** Used exclusively for high-contrast typography and primary actions.
- **Muted Tones:** Grays are kept neutral (desaturated) to prevent clashing with the green accent.

## Typography

The typography uses **Inter** for its technical precision and exceptional legibility in dark modes. 

- **Display Scale:** We use massive font sizes for hero sections to create an editorial, "launch-day" feel. Tight letter-spacing on headlines creates a compact, modern look.
- **Information Hierarchy:** Technical specs and data use `label-caps` to evoke the feel of blueprints or industrial markings.
- **Readability:** Body text is set with generous line-height (160%) to ensure long technical descriptions remain approachable against the high-contrast dark background.

## Layout & Spacing

The layout philosophy is **Fixed-Fluid Hybrid**. Content is contained within a 1440px max-width to maintain readability on ultra-wide monitors, but backgrounds and 3D scenes bleed to the edge of the viewport.

- **Vertical Rhythm:** A massive `section-gap` (160px) is used to separate major narratives, ensuring that only one primary concept is visible at a time.
- **Grid:** A 12-column grid is utilized, but elements often occupy the center 8 columns to maximize negative space on the flanks.
- **Mobile Adaptivity:** Edge margins shrink to 24px on mobile, and the 160px gaps are reduced to 80px to maintain momentum.

## Elevation & Depth

This design system avoids traditional drop shadows. Depth is instead communicated through **Tonal Layering** and **Luminous Bloom**.

- **Surface Tiers:** Background is #0A0A0A. Secondary containers (like cards) use #141414. There are no borders; the change in hex value creates the edge.
- **Luminescence:** Interactive elements use a soft green outer glow (`glow-green`) instead of a shadow, simulating a physical LED light source.
- **Glassmorphism:** Navigation bars use a high-saturation backdrop blur (30px) with a 10% white tint to create a "frosted obsidian" effect over moving 3D content.

## Shapes

The shape language is **Technical-Soft**. We use subtle rounding (0.25rem) to suggest high-precision manufacturing. 

- **Precision Corners:** Sharp enough to feel industrial, but softened just enough to avoid looking "web-default."
- **Interactive Elements:** Buttons and inputs follow the standard roundedness, while 3D viewport containers are kept perfectly sharp (0px) to feel like integrated glass screens.

## Components

- **Buttons:** 
    - *Primary:* Solid white background with black text. On hover, the background turns to the brand green. No border.
    - *Ghost:* No border, white text. Hover triggers a subtle background shift to #141414.
- **Cards:** No borders or shadows. Cards are defined by a slightly lighter background (#141414) than the page. Content inside is heavily inset.
- **Inputs:** Darker than the surface background. Only a bottom-border (1px, muted gray) that glows green on focus. 
- **Chips/Status:** Small, all-caps labels. Successful "Online" or "Quality" statuses feature a pulsing green dot to emphasize the "live" nature of the tech.
- **Lists:** Clean typographic lists with green bullet points. No dividers between items; vertical spacing provides the separation.
- **3D Viewport:** A dedicated component frame with a "Scanline" overlay effect at 5% opacity to give 3D models a futuristic, HUD-like appearance.