/**
 * In-App Clipboard & Fullscreen Management for CodeDSA Exams.
 *
 * Enforces:
 * 1. Safe fullscreen exit upon test completion or submission.
 * 2. In-app only copy/paste:
 *    - Allows copying any code, snippet, function, problem description, or sample case within the exam.
 *    - Allows pasting it anywhere within the exam (e.g. from Question 1 to Question 2).
 *    - Strictly blocks pasting content originating outside the application.
 */

export const IN_APP_CLIPBOARD_MIME = 'application/x-codedsa-internal';

class InAppClipboardService {
  private allowedSnippets = new Set<string>();
  private lastCopiedText = '';
  private listeners = new Set<(msg: string, type: 'error' | 'info') => void>();

  constructor() {
    this.hydrateFromStorage();
  }

  private hydrateFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const stored = sessionStorage.getItem('codedsa_inapp_clipboard');
      if (stored) {
        const list: string[] = JSON.parse(stored);
        for (const item of list) {
          if (typeof item === 'string' && item.length > 0) {
            this.addSnippet(item, false);
          }
        }
      }
    } catch {}
  }

  private persistToStorage() {
    if (typeof window === 'undefined') return;
    try {
      // Keep up to 250 most recent items to avoid quota issues
      const arr = Array.from(this.allowedSnippets).slice(-250);
      sessionStorage.setItem('codedsa_inapp_clipboard', JSON.stringify(arr));
    } catch {}
  }

  private normalizeText(text: string): string {
    return text.replace(/\r\n/g, '\n');
  }

  private addSnippet(text: string, shouldPersist = true) {
    if (!text || text.length === 0) return;
    const normalized = this.normalizeText(text);
    this.allowedSnippets.add(text);
    this.allowedSnippets.add(normalized);
    this.allowedSnippets.add(normalized.trim());

    // Also add non-empty lines if multi-line so partial line/block pastes match
    const lines = normalized.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    for (const line of lines) {
      this.allowedSnippets.add(line);
    }

    if (shouldPersist) {
      this.persistToStorage();
    }
  }

  /**
   * Record text copied or cut within the exam application.
   */
  public recordCopy(text: string) {
    if (!text) return;
    this.lastCopiedText = text;
    this.addSnippet(text, true);
  }

  /**
   * Get the most recently copied in-app text.
   */
  public getLastCopiedText(): string {
    return this.lastCopiedText;
  }

  /**
   * Check if text was copied inside the exam app or exists in the exam context
   * (e.g. current questions' code, problem descriptions, test cases).
   */
  public isInternal(
    text: string,
    clipboardData?: DataTransfer | null,
    getContextTexts?: () => string[]
  ): boolean {
    if (!text || text.length === 0) return false;

    // Check 1: Custom MIME type marker set during in-app copy
    if (clipboardData) {
      try {
        if (
          clipboardData.types &&
          (clipboardData.types.includes(IN_APP_CLIPBOARD_MIME) ||
           Array.from(clipboardData.types).includes(IN_APP_CLIPBOARD_MIME))
        ) {
          // Explicitly marked by in-app copy event
          this.recordCopy(text);
          return true;
        }
      } catch {}
    }

    // Check 2: Direct or normalized match in in-app clipboard store
    const normalized = this.normalizeText(text);
    const trimmed = normalized.trim();

    if (
      this.allowedSnippets.has(text) ||
      this.allowedSnippets.has(normalized) ||
      this.allowedSnippets.has(trimmed)
    ) {
      return true;
    }

    // Check 3: Is it contained within any previously recorded larger snippet?
    for (const snippet of this.allowedSnippets) {
      if (snippet.includes(text) || snippet.includes(normalized) || (trimmed && snippet.includes(trimmed))) {
        return true;
      }
    }

    // Check 4: Context check — is this text part of code written in any question,
    // problem description, or starter code in this exam session?
    if (getContextTexts) {
      try {
        const contexts = getContextTexts();
        for (const ctx of contexts) {
          if (!ctx) continue;
          const normCtx = this.normalizeText(ctx);
          if (normCtx.includes(normalized) || (trimmed && normCtx.includes(trimmed))) {
            // Text was authored or provided inside this exam! Record it for fast lookup next time.
            this.recordCopy(text);
            return true;
          }
        }
      } catch {}
    }

    return false;
  }

  /**
   * Subscribe to notifications (e.g. external paste blocked or copy confirmation).
   */
  public onNotification(listener: (msg: string, type: 'error' | 'info') => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notify(msg: string, type: 'error' | 'info' = 'error') {
    this.listeners.forEach(fn => fn(msg, type));
  }
}

export const inAppClipboard = new InAppClipboardService();

/**
 * Safely exit fullscreen mode across all browsers and unlock keyboard.
 */
export function exitFullscreenSafely() {
  if (typeof document === 'undefined') return;

  // Unlock keyboard if supported
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).keyboard?.unlock) {
      (navigator as any).keyboard.unlock();
    }
  } catch {}

  const doc = document as any;
  if (
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  ) {
    try {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
    } catch {}
  }
}
