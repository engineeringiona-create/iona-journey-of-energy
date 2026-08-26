/* Phase 63 first tried to detect "this <img> is stretched to fill a
   dedicated aspect-ratio wrapper div" by checking for a literal `h-full`
   class on the img. That missed any wrapped image whose fill behavior
   comes from plain CSS instead of that one Tailwind utility — exactly
   what Phase 64's new .bento-card-media img { width:100%; height:100%; }
   is, which is why aspect-ratio/radius/width/placement silently did
   nothing there (Phase 65).

   This replaces the class-name guess with the actual geometric condition
   that matters: does the img's rendered box exactly fill a parent that
   clips overflow? That's true regardless of whether "fill" came from a
   utility class, a scoped CSS rule, or anything else — and it's false
   for images that size themselves naturally (ionaflux_panel's h-auto) or
   deliberately overflow their immediate parent (.parallax-media's 124%
   height, for scroll parallax overhang), so both keep targeting
   themselves as before. */
export function pickFrameTarget(el, isImg) {
  if (!isImg || !el?.parentElement) return el;
  const view = el.ownerDocument?.defaultView;
  if (!view) return el;

  const parent = el.parentElement;
  const parentOverflow = view.getComputedStyle(parent).overflow;
  if (parentOverflow !== 'hidden' && parentOverflow !== 'clip') return el;

  const elRect = el.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  const fillsParent = Math.abs(elRect.width - parentRect.width) < 2 && Math.abs(elRect.height - parentRect.height) < 2;
  return fillsParent ? parent : el;
}
