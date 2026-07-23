import { useEffect, useState } from 'react';
import { getAuthenticatedPreviewObjectUrl } from '../../utils/downloadFile';

/** Image that loads Platform file previews with Bearer auth. */
export function AuthPreviewImage({
  fileId,
  alt = '',
  className,
}: {
  fileId: string;
  alt?: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAuthenticatedPreviewObjectUrl(fileId)
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  if (!src) {
    return <div className={`bg-slate-200 ${className || ''}`} aria-hidden />;
  }

  return <img src={src} alt={alt} className={className} />;
}
