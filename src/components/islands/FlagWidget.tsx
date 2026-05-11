import { useEffect, useRef, useState } from 'react';
import FlagForm, { type FlagKind } from './FlagForm';

export type FlagWidgetProps = {
  topicId: string;
  /** Initial label for the trigger. */
  label?: string;
  /** Visual variant.
   *  - `cta`: compact filled-accent button — sits beside badges at top of topic page.
   *  - `cta-large`: prominent filled-accent button — centerpiece of bottom review card.
   *  - `block`: dashed-border secondary affordance.
   *  - `inline` (default): tiny per-prereq / per-source flag. */
  variant?: 'inline' | 'block' | 'cta' | 'cta-large';
  /** Optional pre-filled context (e.g. "edge: linear-algebra → self-attention"). */
  context?: string;
  /** Default flag kind selection. */
  defaultKind?: FlagKind;
};

export default function FlagWidget({
  topicId,
  label = 'Flag',
  variant = 'inline',
  context,
  defaultKind = 'factual-error',
}: FlagWidgetProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const trigger =
    variant === 'cta' ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-surface-0 bg-accent-600 hover:bg-accent-700 px-2.5 py-1 transition-colors"
      >
        <ReviewIcon size={11} />
        {label}
      </button>
    ) : variant === 'cta-large' ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 font-mono text-sm uppercase tracking-wider text-surface-0 bg-accent-600 hover:bg-accent-700 px-5 py-3 transition-colors"
      >
        <ReviewIcon size={16} />
        {label}
      </button>
    ) : variant === 'block' ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-surface-500 hover:text-accent-600 border border-dashed border-surface-300 hover:border-accent-400 px-3 py-1.5 transition-colors"
      >
        <FlagIcon />
        {label}
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Flag an issue with this topic"
        aria-label="Flag an issue with this topic"
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-surface-400 hover:text-accent-600 transition-colors"
      >
        <FlagIcon size={11} />
        {label}
      </button>
    );

  return (
    <>
      {trigger}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/40 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="flag-title"
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface-0 border border-surface-300 shadow-xl text-left"
          >
            <FlagForm
              topicId={topicId}
              defaultKind={defaultKind}
              context={context}
              onCancel={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}

function FlagIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function ReviewIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="m9 13 2 2 4-4" />
    </svg>
  );
}
