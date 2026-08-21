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

function openModal() {
  if (document.getElementById(MODAL_ID)) return;

  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '90';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.background = 'rgba(5,7,6,0.7)';
  overlay.style.padding = '24px';

  const card = document.createElement('div');
  card.style.width = '100%';
  card.style.maxWidth = '440px';
  card.style.maxHeight = '85vh';
  card.style.overflowY = 'auto';
  card.style.background = '#171b18';
  card.style.borderRadius = '16px';
  card.style.boxShadow = '0 40px 80px -20px rgba(0,0,0,0.5)';

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  }
  function onKeyDown(e) {
    if (e.key === 'Escape') close();
  }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKeyDown);

  renderForm(card, close);
}

function renderForm(card, close) {
  card.innerHTML = `
    <div style="padding:28px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <h3 style="color:#fff;font-weight:800;font-size:20px;margin:0;">Teklif Talebi</h3>
        <button type="button" id="iona-qm-close" style="background:none;border:0;color:rgba(255,255,255,0.4);font-size:20px;line-height:1;cursor:pointer;">×</button>
      </div>
      <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0 0 20px;">Bilgilerinizi bırakın, mühendislik ekibimiz size dönsün.</p>
      <form id="iona-qm-form" style="display:flex;flex-direction:column;gap:14px;">
        ${field('name', 'Ad Soyad', 'text', true)}
        ${field('email', 'E-posta', 'email', true)}
        ${field('phone', 'Telefon', 'tel', false)}
        ${field('project', 'Proje / Atık Türü veya Tesis Kapasitesi', 'text', false)}
        ${textarea('notes', 'Ek Açıklama')}
        <p id="iona-qm-error" style="color:#f87171;font-size:12px;margin:0;display:none;"></p>
        <button type="submit" id="iona-qm-submit" style="display:flex;align-items:center;justify-content:center;gap:8px;background:var(--brand-orange,#ff751f);color:#fff;font-weight:700;font-size:13px;padding:13px;border-radius:999px;border:0;cursor:pointer;">
          <span id="iona-qm-submit-label">Talebi Gönder</span>
        </button>
      </form>
    </div>
  `;

  card.querySelector('#iona-qm-close').addEventListener('click', close);

  const form = card.querySelector('#iona-qm-form');
  form.addEventListener('submit', (e) => handleSubmit(e, card, close));
}

function field(name, label, type, required) {
  return `
    <label style="display:flex;flex-direction:column;gap:5px;">
      <span style="font-size:11px;font-weight:700;letter-spacing:0.06em;color:rgba(255,255,255,0.5);text-transform:uppercase;">${label}${required ? ' *' : ''}</span>
      <input name="${name}" type="${type}" ${required ? 'required' : ''} style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 12px;color:#fff;font-size:13px;">
    </label>
  `;
}

function textarea(name, label) {
  return `
    <label style="display:flex;flex-direction:column;gap:5px;">
      <span style="font-size:11px;font-weight:700;letter-spacing:0.06em;color:rgba(255,255,255,0.5);text-transform:uppercase;">${label}</span>
      <textarea name="${name}" rows="3" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 12px;color:#fff;font-size:13px;resize:none;"></textarea>
    </label>
  `;
}

async function handleSubmit(e, card, close) {
  e.preventDefault();
  const form = e.target;
  const errorEl = card.querySelector('#iona-qm-error');
  const submitBtn = card.querySelector('#iona-qm-submit');
  const submitLabel = card.querySelector('#iona-qm-submit-label');
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
  submitLabel.textContent = 'Gönderiliyor...';

  const { data: inserted, error } = await supabase
    .from('contact_submissions')
    .insert([{ name, email, phone, message: fullDetails, page_source: 'teklif_talebi', is_read: false }])
    .select()
    .single();

  submitBtn.disabled = false;
  submitBtn.style.opacity = '1';
  submitLabel.textContent = 'Talebi Gönder';

  if (error) {
    errorEl.textContent = 'Bir hata oluştu, lütfen tekrar deneyin.';
    errorEl.style.display = 'block';
    return;
  }

  renderSuccess(card, close, inserted);
}

function renderSuccess(card, close, inserted) {
  const ref = inserted?.id ? inserted.id.slice(0, 8).toUpperCase() : '';
  const timestamp = new Date(inserted?.created_at || Date.now()).toLocaleString('tr-TR');

  card.innerHTML = `
    <div style="padding:40px 32px;text-align:center;">
      <div style="width:64px;height:64px;border-radius:50%;background:rgba(34,112,60,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;animation:iona-qm-pop 400ms ease;">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
          <path d="M4 12.5L9.5 18L20 6" stroke="#3fae66" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="30" stroke-dashoffset="30" style="animation:iona-qm-draw 500ms ease 150ms forwards;"/>
        </svg>
      </div>
      <h3 style="color:#fff;font-weight:800;font-size:20px;margin:0 0 12px;">Teklif Talebiniz Başarıyla Alındı!</h3>
      <p style="color:rgba(255,255,255,0.6);font-size:13px;line-height:1.6;margin:0 0 20px;">Uzman mühendislik ekibimiz bilgilerinizi inceleyip en kısa sürede sizinle iletişime geçecektir.</p>
      ${ref ? `<p style="color:rgba(255,255,255,0.35);font-size:11px;margin:0 0 24px;">Referans No: #${ref} · ${timestamp}</p>` : ''}
      <button type="button" id="iona-qm-done" style="background:var(--brand-orange,#ff751f);color:#fff;font-weight:700;font-size:13px;padding:12px 28px;border-radius:999px;border:0;cursor:pointer;">Kapat / Anasayfaya Dön</button>
    </div>
    <style>
      @keyframes iona-qm-pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      @keyframes iona-qm-draw { to { stroke-dashoffset: 0; } }
    </style>
  `;

  card.querySelector('#iona-qm-done').addEventListener('click', () => {
    close();
    window.location.href = '/';
  });
}
