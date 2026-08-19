import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable';
import LoginScreen from './LoginScreen.jsx';
import { isAuthed, clearAuthed } from './auth.js';
import { HOMEPAGE_SECTIONS } from './sections-data.js';
import SortableSectionCard from './SortableSectionCard.jsx';

function Dashboard({ onLogout }) {
  const [order, setOrder] = useState(HOMEPAGE_SECTIONS.map((s) => s.id));
  const [content, setContent] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    import('../../i18n/tr.json').then((mod) => {
      setContent(mod.default || mod);
      setLoaded(true);
    });
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const sectionsById = Object.fromEntries(HOMEPAGE_SECTIONS.map((s) => [s.id, s]));

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((current) => {
      const oldIndex = current.indexOf(active.id);
      const newIndex = current.indexOf(over.id);
      return arrayMove(current, oldIndex, newIndex);
    });
    setSaved(false);
  }

  function handleFieldChange(i18nKey, value) {
    setContent((current) => ({ ...current, [i18nKey]: value }));
    setSaved(false);
  }

  function handleSave() {
    // TODO(Phase 27): persist to Supabase instead of console.log
    console.log('[IONA Admin] Anasayfa bölüm sırası:', order);
    console.log('[IONA Admin] Metin değişiklikleri:', content);
    setSaved(true);
  }

  return (
    <div className="min-h-screen w-full bg-[var(--bg)]">
      <header className="flex items-center justify-between px-8 py-5 border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <img src="/images/iona-star-mark.png" alt="" width="28" height="28" />
          <span className="text-[16px] font-extrabold tracking-tight text-[var(--text)]">
            IONA <span className="text-[var(--brand)]">Admin</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          {saved && <span className="text-[13px] text-[var(--brand)]">Kaydedildi (konsola yazıldı)</span>}
          <button
            type="button"
            onClick={handleSave}
            className="font-label-caps text-[12px] font-bold tracking-[0.08em] bg-[var(--brand-orange)] text-white px-5 py-2.5 rounded-full hover:brightness-110 transition-all duration-300"
          >
            Değişiklikleri Kaydet
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="font-label-caps text-[12px] font-bold tracking-[0.06em] text-[var(--text-muted)] hover:text-[var(--brand)] transition-colors duration-300"
          >
            Çıkış Yap
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-4">
        <div className="mb-2">
          <h2 className="text-[18px] font-bold text-[var(--text)]">Anasayfa Bölümleri</h2>
          <p className="text-[13px] text-[var(--text-muted)]">Sırala: tut, sürükle. Düzenle: metne tıkla.</p>
        </div>

        {!loaded && <p className="text-[14px] text-[var(--text-muted)]">Yükleniyor...</p>}

        {loaded && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              {order.map((id) => (
                <SortableSectionCard
                  key={id}
                  section={sectionsById[id]}
                  content={content}
                  onFieldChange={handleFieldChange}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  );
}

export default function AdminApp() {
  const [authed, setAuthedState] = useState(isAuthed());

  function handleLogout() {
    clearAuthed();
    setAuthedState(false);
  }

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthedState(true)} />;
  }

  return <Dashboard onLogout={handleLogout} />;
}
