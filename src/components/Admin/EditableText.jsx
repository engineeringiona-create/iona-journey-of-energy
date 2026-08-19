import { useState, useRef, useEffect } from 'react';

export default function EditableText({ label, value, onChange, multiline }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select?.();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    if (ref.current) onChange(ref.current.value);
  }

  if (editing) {
    const Field = multiline ? 'textarea' : 'input';
    return (
      <Field
        ref={ref}
        defaultValue={value}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !multiline) commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        rows={multiline ? 3 : undefined}
        className="w-full bg-[var(--surface-2)] border border-[var(--brand)] rounded-lg px-3 py-2 text-[14px] text-[var(--text)] focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full text-left rounded-lg px-3 py-2 text-[14px] text-[var(--text)] hover:bg-[var(--surface-2)] border border-transparent hover:border-[var(--border)] transition-colors duration-150 cursor-text"
      title={`${label} — tıkla, düzenle`}
    >
      {value || <span className="text-[var(--text-muted)] italic">(boş)</span>}
    </button>
  );
}
