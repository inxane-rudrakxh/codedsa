'use client';

import { useEffect, useState } from 'react';
import { inAppClipboard, IN_APP_CLIPBOARD_MIME } from '@/lib/inAppClipboard';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function ExamLayout({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' } | null>(null);

  useEffect(() => {
    // Listen for clipboard alerts from anywhere within the exam
    const unsubscribe = inAppClipboard.onNotification((message, type) => {
      setToast({ message, type });
      const timer = setTimeout(() => {
        setToast(prev => (prev?.message === message ? null : prev));
      }, 3500);
      return () => clearTimeout(timer);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const blockContextMenu = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const handleCopyCut = (e: ClipboardEvent) => {
      const selection = window.getSelection()?.toString();
      if (selection) {
        inAppClipboard.recordCopy(selection);
        try {
          e.clipboardData?.setData(IN_APP_CLIPBOARD_MIME, '1');
          e.clipboardData?.setData('text/plain', selection);
        } catch {}
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain') || '';
      if (!text) return;

      // Allow if copied inside the exam session
      if (inAppClipboard.isInternal(text, e.clipboardData)) {
        return;
      }

      // Block external paste
      e.preventDefault();
      e.stopPropagation();
      inAppClipboard.notify('External paste blocked: Only code/text copied within this exam is allowed.', 'error');
    };

    // Disable right click across all exam pages
    window.addEventListener('contextmenu', blockContextMenu, { capture: true });
    document.addEventListener('contextmenu', blockContextMenu, { capture: true });
    document.body?.addEventListener('contextmenu', blockContextMenu, { capture: true });

    // Track in-app copy/cut and gate paste across exam pages
    window.addEventListener('copy', handleCopyCut, { capture: true });
    document.addEventListener('copy', handleCopyCut, { capture: true });
    window.addEventListener('cut', handleCopyCut, { capture: true });
    document.addEventListener('cut', handleCopyCut, { capture: true });
    window.addEventListener('paste', handlePaste, { capture: true });
    document.addEventListener('paste', handlePaste, { capture: true });

    return () => {
      window.removeEventListener('contextmenu', blockContextMenu, { capture: true });
      document.removeEventListener('contextmenu', blockContextMenu, { capture: true });
      document.body?.removeEventListener('contextmenu', blockContextMenu, { capture: true });
      window.removeEventListener('copy', handleCopyCut, { capture: true });
      document.removeEventListener('copy', handleCopyCut, { capture: true });
      window.removeEventListener('cut', handleCopyCut, { capture: true });
      document.removeEventListener('cut', handleCopyCut, { capture: true });
      window.removeEventListener('paste', handlePaste, { capture: true });
      document.removeEventListener('paste', handlePaste, { capture: true });
    };
  }, []);

  return (
    <>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 18px',
            borderRadius: '10px',
            background: toast.type === 'error' ? 'rgba(229, 83, 75, 0.95)' : 'rgba(34, 197, 94, 0.95)',
            color: '#ffffff',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(8px)',
            fontSize: '13px',
            fontFamily: 'StyreneB, Inter, sans-serif',
            fontWeight: 500,
            letterSpacing: '0.01em',
            animation: 'fadeInDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'none',
          }}
        >
          {toast.type === 'error' ? (
            <AlertCircle size={17} strokeWidth={2.2} />
          ) : (
            <CheckCircle size={17} strokeWidth={2.2} />
          )}
          <span>{toast.message}</span>
        </div>
      )}
      {children}
    </>
  );
}

