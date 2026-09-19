/* Phase 61: shared by src/i18n.js (applying a saved order on real page
   load) and LiveEditor's "Sayfa Düzeni & Bölümler" panel (live-reordering
   the iframe preview as an admin clicks ⬆️/⬇️) — same function, two
   target documents, so the two can never drift apart on how a reorder
   actually gets threaded into the DOM. */
export function reorderSections(doc, order) {
  if (!doc || !Array.isArray(order) || order.length < 2) return;
  const els = order.map((id) => doc.getElementById(id)).filter(Boolean);
  if (els.length < 2) return;
  const parent = els[0].parentElement;
  if (!parent || !els.every((el) => el.parentElement === parent)) return;

  /* insertBefore against an anchor immediately after the last of these
     sections in CURRENT DOM order — not appendChild, which would
     relocate them past the footer/scripts that follow every section
     list on this site. */
  const domOrder = Array.from(parent.children).filter((el) => els.includes(el));
  const anchor = domOrder[domOrder.length - 1].nextSibling;
  els.forEach((el) => parent.insertBefore(el, anchor));
}
