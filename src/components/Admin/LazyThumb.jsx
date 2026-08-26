import { useState } from 'react';

/* Grid-card thumbnail with a shimmer placeholder until the image paints —
   used by MediaPickerModal so the "Medya Kütüphanesi" grid never pops in
   raw/blank while _thumb.webp files (tens of KB) load. */
export default function LazyThumb({ src, alt, className = '' }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative w-full h-full">
      {!loaded && <div className="thumb-shimmer absolute inset-0" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`${className} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
