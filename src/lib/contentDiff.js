/* Computes a real, structural diff between two site_content.content
   snapshots (see supabase/schema.sql) for the revision history modal.
   No fabricated field-name dictionary exists anywhere in this codebase
   (i18n keys are free-form strings like "home.hero.slide1_title"), so
   labels are derived mechanically from the key itself rather than
   invented — good enough to tell an admin *which* field changed without
   pretending to know a display name that isn't tracked anywhere. */

const SEO_LABELS = { title: 'SEO Başlık', description: 'SEO Açıklama', ogImage: 'SEO Paylaşım Görseli' };

function prettify(key) {
  const last = String(key).split(/[.:/]/).pop();
  return last.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function describeImagePatch(cfg) {
  if (!cfg || Object.keys(cfg).length === 0) return '(orijinal)';
  const parts = [];
  if (cfg.src) parts.push('yeni görsel');
  if (cfg.posX !== undefined || cfg.posY !== undefined) parts.push(`konum ${cfg.posX ?? 50}%/${cfg.posY ?? 50}%`);
  if (cfg.scale !== undefined) parts.push(`${cfg.scale}x`);
  return parts.join(', ') || '(orijinal)';
}

export function diffContent(oldContent, newContent) {
  const oldC = oldContent || {};
  const newC = newContent || {};
  const changes = [];
  const buckets = new Set([...Object.keys(oldC), ...Object.keys(newC)]);

  buckets.forEach((bucket) => {
    const oldBucket = oldC[bucket];
    const newBucket = newC[bucket];
    if (oldBucket === newBucket) return;

    if (bucket === 'seo') {
      Object.entries(SEO_LABELS).forEach(([k, label]) => {
        const ov = oldBucket?.[k];
        const nv = newBucket?.[k];
        if (ov !== nv && (ov !== undefined || nv !== undefined)) {
          changes.push({ label, oldValue: ov || '(boş)', newValue: nv || '(boş)' });
        }
      });
      return;
    }

    if (bucket === 'sections') {
      const ids = new Set([...Object.keys(oldBucket || {}), ...Object.keys(newBucket || {})]);
      ids.forEach((id) => {
        const ov = !!oldBucket?.[id];
        const nv = !!newBucket?.[id];
        if (ov !== nv) {
          changes.push({ label: `Bölüm: ${prettify(id)}`, oldValue: ov ? 'Gizli' : 'Görünür', newValue: nv ? 'Gizli' : 'Görünür' });
        }
      });
      return;
    }

    if (bucket === 'images') {
      const keys = new Set([...Object.keys(oldBucket || {}), ...Object.keys(newBucket || {})]);
      keys.forEach((imgKey) => {
        const ov = oldBucket?.[imgKey] || {};
        const nv = newBucket?.[imgKey] || {};
        if (JSON.stringify(ov) !== JSON.stringify(nv)) {
          changes.push({ label: `Görsel: ${prettify(imgKey)}`, oldValue: describeImagePatch(ov), newValue: describeImagePatch(nv) });
        }
      });
      return;
    }

    /* Anything else is a per-language text bucket (tr, en, de, ...). */
    const keys = new Set([...Object.keys(oldBucket || {}), ...Object.keys(newBucket || {})]);
    keys.forEach((k) => {
      const ov = oldBucket?.[k];
      const nv = newBucket?.[k];
      if (ov !== nv) {
        changes.push({ label: `Metin (${bucket}): ${prettify(k)}`, oldValue: ov || '(boş)', newValue: nv || '(boş)' });
      }
    });
  });

  return changes;
}
