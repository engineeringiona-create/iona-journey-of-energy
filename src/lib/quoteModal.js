import { getSupabase } from './supabaseClient.js';

const MODAL_ID = 'iona-quote-modal';

/* Every "Teklif Alın" button across the site (nav CTA, mobile nav CTA,
   etki.html's hero "Teklif İsteyin") carries data-quote-cta instead of
   navigating to iletisim.html or a mailto: link — clicking any of them
   opens this same modal in place, on whichever page the visitor is
   already on. */
export function initQuoteModal() {
  document.querySelectorAll('[data-quote-cta]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  });
}

/* Lets a caller outside this module (the ROI calculator's CTA) open the
   same modal pre-filled with its own computed values, instead of
   duplicating the whole overlay/form/submit machinery for one extra
   entry point. `project`/`notes` map onto renderForm's existing fields
   — nothing else needed pre-filling. */
export function openQuoteModal(prefill = {}) {
  openModal(prefill);
}

function openModal(prefill = {}) {
  if (document.getElementById(MODAL_ID)) return;

  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '11000';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.background = 'rgba(5,7,6,0.7)';
  overlay.style.padding = '24px';

  const card = document.createElement('div');
  card.style.width = '100%';
  card.style.maxWidth = '620px';
  card.style.maxHeight = '85vh';
  card.style.overflowY = 'auto';
  card.style.background = '#fffdf7';
  card.style.borderRadius = '28px';
  card.style.boxShadow = '0 40px 80px -20px rgba(0,0,0,0.5)';
  card.style.transform = 'translateZ(0)';
  card.style.backfaceVisibility = 'hidden';

  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Teklif talebi');
  overlay.setAttribute('data-lenis-prevent', '');
  const previousFocus = document.activeElement;
  const previousOverflow = document.body.style.overflow;
  const siblings = [...document.body.children].map(el => [el, el.inert]);
  siblings.forEach(([el]) => { el.inert = true; });
  document.body.style.overflow = 'hidden';
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
    siblings.forEach(([el, inert]) => { el.inert = inert; });
    document.body.style.overflow = previousOverflow;
    previousFocus?.focus({preventScroll: true});
    document.removeEventListener('keydown', onKeyDown, true);
  }
  function onKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    if (e.key === 'Tab') {
      const nodes = [...overlay.querySelectorAll('button:not(:disabled),input,textarea,a[href]')].filter(el => el.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKeyDown, true);

  renderForm(card, overlay, close, prefill);
  card.querySelector('#iona-qm-close').focus();
}

function renderForm(card, overlay, close, prefill = {}) {
  card.innerHTML = `
    <div style="padding:28px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <h3 style="color:#193322;font-weight:600;font-size:28px;margin:0;">Teklif Talebi</h3>
        <button type="button" id="iona-qm-close" aria-label="Teklif penceresini kapat" style="background:none;border:0;color:#52634f;font-size:20px;line-height:1;cursor:pointer;">×</button>
      </div>
      <p style="color:#52634f;font-size:13px;margin:0 0 20px;">Bilgilerinizi bırakın, mühendislik ekibimiz size dönsün.</p>
      <form id="iona-qm-form" style="display:flex;flex-direction:column;gap:14px;">
        ${field('name', 'Ad Soyad', 'text', true)}
        ${field('email', 'E-posta', 'email', true)}
        ${field('phone', 'Telefon', 'tel', false)}
        ${field('project', 'Proje / Atık Türü veya Tesis Kapasitesi', 'text', false, prefill.project)}
        ${textarea('notes', 'Ek Açıklama', prefill.notes)}
        <p id="iona-qm-error" role="alert" style="color:#a32727;font-size:12px;margin:0;display:none;"></p>
        <button type="submit" id="iona-qm-submit" style="display:flex;align-items:center;justify-content:center;gap:8px;background:#198837;color:#fff;font-weight:700;font-size:13px;padding:13px;border-radius:999px;border:0;cursor:pointer;">
          <span id="iona-qm-spinner" style="display:none;width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,0.35);border-top-color:#193322;animation:iona-qm-spin 700ms linear infinite;"></span>
          <span id="iona-qm-submit-label">Talebi Gönder</span>
        </button>
      </form>
    </div>
    <style>@keyframes iona-qm-spin { to { transform: rotate(360deg); } }</style>
  `;

  card.querySelector('#iona-qm-close').addEventListener('click', close);

  const form = card.querySelector('#iona-qm-form');
  form.addEventListener('submit', (e) => handleSubmit(e, card, overlay, close));
}

function field(name, label, type, required, value) {
  const escapedValue = value ? escapeHtml(value) : '';
  return `
    <label style="display:flex;flex-direction:column;gap:5px;">
      <span style="font-size:11px;font-weight:700;letter-spacing:0.06em;color:#52634f;text-transform:uppercase;">${label}${required ? ' *' : ''}</span>
      <input name="${name}" type="${type}" ${required ? 'required' : ''} value="${escapedValue}" style="background:#f5f7ef;border:1px solid #cddbc6;border-radius:12px;padding:13px 14px;color:#193322;font-size:13px;">
    </label>
  `;
}

function textarea(name, label, value) {
  const escapedValue = value ? escapeHtml(value) : '';
  return `
    <label style="display:flex;flex-direction:column;gap:5px;">
      <span style="font-size:11px;font-weight:700;letter-spacing:0.06em;color:#52634f;text-transform:uppercase;">${label}</span>
      <textarea name="${name}" rows="3" style="background:#f5f7ef;border:1px solid #cddbc6;border-radius:12px;padding:13px 14px;color:#193322;font-size:13px;resize:none;">${escapedValue}</textarea>
    </label>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function handleSubmit(e, card, overlay, close) {
  e.preventDefault();
  const form = e.target;
  const errorEl = card.querySelector('#iona-qm-error');
  const submitBtn = card.querySelector('#iona-qm-submit');
  const submitLabel = card.querySelector('#iona-qm-submit-label');
  const spinner = card.querySelector('#iona-qm-spinner');
  errorEl.style.display = 'none';

  const data = new FormData(form);
  const name = (data.get('name') || '').toString().trim();
  const email = (data.get('email') || '').toString().trim();
  const phone = (data.get('phone') || '').toString().trim();
  const project = (data.get('project') || '').toString().trim();
  const notes = (data.get('notes') || '').toString().trim();

  const supabase = getSupabase();
  if (!supabase) {
    errorEl.textContent = 'Şu anda talep alınamıyor, lütfen daha sonra tekrar deneyin.';
    errorEl.style.display = 'block';
    return;
  }

  const fullDetails = [
    project ? `Proje / Atık Türü veya Tesis Kapasitesi: ${project}` : null,
    notes ? `Ek Açıklama: ${notes}` : null
  ].filter(Boolean).join('\n\n');

  submitBtn.disabled = true;
  submitBtn.style.opacity = '0.7';
  spinner.style.display = 'inline-block';
  submitLabel.textContent = 'Gönderiliyor...';

  const { data: inserted, error } = await supabase
    .from('contact_submissions')
    .insert([{ name, email, phone, message: fullDetails, page_source: 'teklif_talebi', is_read: false }])
    .select()
    .single();

  submitBtn.disabled = false;
  submitBtn.style.opacity = '1';
  spinner.style.display = 'none';
  submitLabel.textContent = 'Talebi Gönder';

  if (error) {
    errorEl.textContent = 'Bir hata oluştu, lütfen tekrar deneyin.';
    errorEl.style.display = 'block';
    return;
  }

  renderSuccess(overlay, close, inserted);
}

/* Phase 36: success is a full-bleed takeover of the whole overlay (not
   just a swap inside the small 440px card) — the card is removed
   entirely and this renders straight into the fixed inset-0 overlay,
   so it reads as an immersive confirmation screen instead of "a form
   that changed its mind". */
function renderSuccess(overlay, close, inserted) {
  const ref = inserted?.id ? inserted.id.slice(0, 8).toUpperCase() : '';
  const timestamp = new Date(inserted?.created_at || Date.now()).toLocaleString('tr-TR');

  overlay.style.background = 'rgba(5,7,6,0.7)';
  overlay.style.padding = '24px';
  overlay.innerHTML = `
    <div style="position:relative;max-width:540px;width:100%;text-align:center;background:#fffdf7;border-radius:28px;padding:40px 28px;">
      <button type="button" id="iona-qm-success-close" aria-label="Kapat" style="position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.16);color:#193322;font-size:16px;line-height:1;cursor:pointer;">×</button>
      <div style="width:88px;height:88px;border-radius:50%;background:rgba(63,174,102,0.15);border:1px solid rgba(63,174,102,0.3);display:flex;align-items:center;justify-content:center;margin:0 auto 28px;animation:iona-qm-pop 450ms ease;">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
          <path d="M4 12.5L9.5 18L20 6" stroke="#3fae66" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="30" stroke-dashoffset="30" style="animation:iona-qm-draw 550ms ease 200ms forwards;"/>
        </svg>
      </div>
      <h3 style="color:#193322;font-weight:800;font-size:28px;line-height:1.25;margin:0 0 16px;">Teklif Talebiniz Başarıyla Alındı!</h3>
      <p style="color:#52634f;font-size:15px;line-height:1.65;margin:0 0 24px;">Uzman mühendislik ekibimiz bilgilerinizi inceleyip en kısa sürede sizinle iletişime geçecektir.</p>
      ${ref ? `<p style="color:#52634f;font-size:12px;letter-spacing:0.04em;margin:0 0 32px;">Referans No: #${ref} · ${timestamp}</p>` : ''}
      <button type="button" id="iona-qm-done" style="background:#198837;color:#fff;font-weight:700;font-size:14px;padding:14px 32px;border-radius:999px;border:0;cursor:pointer;">Kapat / Anasayfaya Dön</button>
    </div>
    <style>
      @keyframes iona-qm-pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      @keyframes iona-qm-draw { to { stroke-dashoffset: 0; } }
    </style>
  `;

  overlay.querySelector('#iona-qm-done').addEventListener('click', () => {
    close();
    window.location.href = '/';
  });
  overlay.querySelector('#iona-qm-success-close').addEventListener('click', close);
  overlay.querySelector('#iona-qm-done').focus();
}
