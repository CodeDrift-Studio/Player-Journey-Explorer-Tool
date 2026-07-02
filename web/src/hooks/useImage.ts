/**
 * Load an image element for a given src. Returns the loaded HTMLImageElement, or
 * null while loading / on error / when src is null. Resets on src change so we
 * never draw a stale (wrong-map) backdrop.
 */

import { useEffect, useState } from 'react';

export function useImage(src: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    setImage(null); // clear previous while the new one loads
    const img = new Image();
    let cancelled = false;
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.onerror = () => {
      if (!cancelled) setImage(null);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return image;
}
