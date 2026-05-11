import { useEffect, useRef, useState } from 'react';

type FlagKind =
  | 'wrong-prereq'
  | 'missing-prereq'
  | 'wrong-direction'
  | 'factual-error'
  | 'source-issue'
  | 'other';

const KIND_OPTIONS: { value: FlagKind; label: string; help: string }[] = [
  { value: 'wrong-prereq', label: 'This prerequisite is wrong', help: 'The linked topic is not actually required.' },
  { value: 'missing-prereq', label: 'A prerequisite is missing', help: 'Something needed to read this topic is not listed.' },
  { value: 'wrong-direction', label: 'Wrong direction', help: 'The dependency goes the other way.' },
  { value: 'factual-error', label: 'Factual error in the text', help: 'A statement, definition, or formula is incorrect.' },
  { value: 'source-issue', label: 'Source / citation issue', help: 'A cited paper is wrong, missing, or misattributed.' },
  { value: 'other', label: 'Something else', help: 'Anything not covered above.' },
];

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
  const [submitting, setSubmitting] = useState(false);
  const [kind, setKind] = useState<FlagKind>(defaultKind);
  const [comment, setComment] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [contextValue, setContextValue] = useState(context ?? '');
  const [success, setSuccess] = useState<{ url: string; number: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [open]);

  async function submit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId,
          kind,
          comment,
          context: contextValue || undefined,
          reporterEmail: reporterEmail || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Submission failed (${res.status})`);
      }
      const data = (await res.json()) as { issueUrl: string; issueNumber: number };
      setSuccess({ url: data.issueUrl, number: data.issueNumber });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setOpen(false);
    setSuccess(null);
    setError(null);
    setComment('');
    setReporterEmail('');
    setKind(defaultKind);
    setContextValue(context ?? '');
  }

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
            className="w-full max-w-lg bg-surface-0 border border-surface-300 shadow-xl text-left"
          >
            {success ? (
              <div className="p-6">
                <h2 id="flag-title" className="text-xl mb-2">Thanks — review received</h2>
                <p className="text-sm text-surface-600 mb-4">
                  We opened a tracking issue. A maintainer will read it shortly.
                </p>
                <div className="font-mono text-xs text-surface-500 mb-6 break-all">
                  <a className="underline decoration-dotted hover:text-accent-600" href={success.url} target="_blank" rel="noopener noreferrer">
                    Issue #{success.number} →
                  </a>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={reset} className="font-mono text-xs uppercase tracking-wider px-4 py-2 border border-surface-300 hover:border-accent-500 transition-colors">
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="p-6">
                <header className="mb-4">
                  <h2 id="flag-title" className="text-xl mb-1">Review this topic</h2>
                  <p className="text-xs font-mono text-surface-400 break-all">{topicId}</p>
                </header>

                <fieldset className="mb-4">
                  <legend className="font-mono text-[10px] uppercase tracking-wider text-surface-500 mb-2">What's wrong?</legend>
                  <div className="space-y-1.5">
                    {KIND_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="flag-kind"
                          value={opt.value}
                          checked={kind === opt.value}
                          onChange={() => setKind(opt.value)}
                          className="mt-1 accent-accent-600"
                          data-autofocus={opt.value === defaultKind ? '' : undefined}
                        />
                        <span>
                          <span className="block">{opt.label}</span>
                          <span className="block text-xs text-surface-500">{opt.help}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="block mb-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-surface-500 mb-1 block">Context (optional)</span>
                  <input
                    type="text"
                    value={contextValue}
                    onChange={(e) => setContextValue(e.target.value)}
                    placeholder='e.g. "edge: linear-algebra → self-attention"'
                    className="w-full text-sm border border-surface-300 px-3 py-2 focus:outline-none focus:border-accent-500"
                  />
                </label>

                <label className="block mb-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-surface-500 mb-1 block">Details</span>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                    minLength={5}
                    maxLength={4000}
                    rows={5}
                    placeholder="Be specific. What's wrong, and how would you fix it?"
                    className="w-full text-sm border border-surface-300 px-3 py-2 focus:outline-none focus:border-accent-500 font-sans"
                  />
                </label>

                <label className="block mb-6">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-surface-500 mb-1 block">Email (optional, for follow-up)</span>
                  <input
                    type="email"
                    value={reporterEmail}
                    onChange={(e) => setReporterEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full text-sm border border-surface-300 px-3 py-2 focus:outline-none focus:border-accent-500"
                  />
                </label>

                {error && <p className="text-sm text-accent-700 mb-4">{error}</p>}

                <div className="flex justify-between items-center">
                  <p className="text-xs text-surface-400">Public — reviews become GitHub issues.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setOpen(false)} className="font-mono text-xs uppercase tracking-wider px-3 py-2 border border-surface-200 hover:border-surface-400 transition-colors">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || comment.trim().length < 5}
                      className="font-mono text-xs uppercase tracking-wider px-4 py-2 border border-accent-500 bg-accent-500 text-surface-0 hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? 'Submitting…' : 'Submit review'}
                    </button>
                  </div>
                </div>
              </form>
            )}
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
