'use client';

import { useEffect } from 'react';

export default function ExamLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const blockEvent = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // Disable right click across all exam pages
    window.addEventListener('contextmenu', blockEvent, { capture: true });
    document.addEventListener('contextmenu', blockEvent, { capture: true });
    document.body?.addEventListener('contextmenu', blockEvent, { capture: true });

    // Disable copy, cut, paste globally across all exam pages
    window.addEventListener('copy', blockEvent, { capture: true });
    document.addEventListener('copy', blockEvent, { capture: true });
    window.addEventListener('cut', blockEvent, { capture: true });
    document.addEventListener('cut', blockEvent, { capture: true });
    window.addEventListener('paste', blockEvent, { capture: true });
    document.addEventListener('paste', blockEvent, { capture: true });

    return () => {
      window.removeEventListener('contextmenu', blockEvent, { capture: true });
      document.removeEventListener('contextmenu', blockEvent, { capture: true });
      document.body?.removeEventListener('contextmenu', blockEvent, { capture: true });
      window.removeEventListener('copy', blockEvent, { capture: true });
      document.removeEventListener('copy', blockEvent, { capture: true });
      window.removeEventListener('cut', blockEvent, { capture: true });
      document.removeEventListener('cut', blockEvent, { capture: true });
      window.removeEventListener('paste', blockEvent, { capture: true });
      document.removeEventListener('paste', blockEvent, { capture: true });
    };
  }, []);

  return <>{children}</>;
}
