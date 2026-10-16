"use client";

import { useEffect, useRef, useState } from "react";

/** Invalidate pending compression when the input or authenticated owner changes. */
export function useManualImageUpload(input: {
  compress: (file: File) => Promise<string>;
  append: (images: string[]) => void;
  onError: () => void;
}) {
  const epoch = useRef(0);
  const pending = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  useEffect(() => () => { epoch.current++; pending.current = false; }, []);

  const cancel = () => {
    epoch.current++;
    pending.current = false;
    setIsUploading(false);
  };
  const upload = async (files: File[]) => {
    if (pending.current || !files.length) return;
    const requestEpoch = ++epoch.current;
    pending.current = true;
    setIsUploading(true);
    try {
      const images = await Promise.all(files.map(async file => `${await input.compress(file)}#name=${encodeURIComponent(file.name)}`));
      if (epoch.current === requestEpoch) input.append(images);
    } catch {
      if (epoch.current === requestEpoch) input.onError();
    } finally {
      if (epoch.current === requestEpoch) {
        pending.current = false;
        setIsUploading(false);
      }
    }
  };

  return { upload, cancel, isUploading, isPending: () => pending.current };
}
