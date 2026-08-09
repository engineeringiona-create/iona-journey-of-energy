import { useEffect, useState } from 'react';
import trFallback from '../../i18n/tr.json';

/* Bridges this React island to the vanilla i18n system in
   src/i18n.js. That module already sets window.__ionaDict on load and
   on every language change, and already dispatches 'i18nready'
   (initI18n) / 'i18nchange' (setLang) on `document` — both listened to
   here, nothing added or changed on the vanilla side.

   t(key) resolution order: current language's dict -> the bundled
   tr.json (so a key that hasn't been translated into the active
   language yet still shows real Turkish copy, not English or a raw
   key) -> the key itself, as a last-resort so the UI never renders
   blank. */
function readDict() {
  return typeof window !== 'undefined' ? (window.__ionaDict ?? null) : null;
}

export default function useI18n() {
  const [dict, setDict] = useState(readDict);

  useEffect(() => {
    const update = () => setDict(readDict());
    update();
    document.addEventListener('i18nready', update);
    document.addEventListener('i18nchange', update);
    return () => {
      document.removeEventListener('i18nready', update);
      document.removeEventListener('i18nchange', update);
    };
  }, []);

  return (key) => dict?.[key] ?? trFallback[key] ?? key;
}
