import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import EditableText from './EditableText.jsx';

export default function SortableSectionCard({ section, content, onFieldChange }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex gap-4 shadow-[0_15px_40px_-25px_rgba(20,24,20,0.35)]"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 self-stretch flex items-center px-2 text-[var(--text-muted)] hover:text-[var(--brand)] cursor-grab active:cursor-grabbing touch-none"
        aria-label={`${section.label} bölümünü sürükle`}
        title="Sürükle, sırala"
      >
        <span className="material-symbols-outlined text-[22px]">drag_indicator</span>
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <span className="font-label-caps text-[12px] font-bold tracking-[0.08em] text-[var(--brand)] uppercase">
          {section.label}
        </span>

        {section.fields.map((field) => (
          <EditableText
            key={field.i18nKey}
            label={field.key}
            value={content[field.i18nKey] ?? ''}
            multiline={field.key === 'body' || field.key === 'subtitle'}
            onChange={(next) => onFieldChange(field.i18nKey, next)}
          />
        ))}
      </div>
    </div>
  );
}
