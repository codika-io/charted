import { useEffect, useRef, useState } from 'react';
import FlagForm, { type FlagKind } from './FlagForm';

const STORAGE_KEY = 'charted:lastReviewPath';

export type ReviewChooserProps = {
  topicId: string;
  /** Repo file path used to build the GitHub edit URL. */
  filePath: string;
  /** GitHub repo, e.g. "codika-io/charted". */
  repo?: string;
  /** GitHub branch, e.g. "main". */
  branch?: string;
  label?: string;
  /** Visual variant for the trigger button.
   *  - `badge`: prominent inline pill sized a notch above tier badges (top of topic page).
   *  - `cta-large`: filled-accent block button (bottom review card). */
  variant?: 'badge' | 'cta-large';
  defaultKind?: FlagKind;
};

type View = 'chooser' | 'flag';

export default function ReviewChooser({
  topicId,
  filePath,
  repo = 'codika-io/charted',
  branch = 'main',
  label = 'Review this topic',
  variant = 'badge',
  defaultKind = 'factual-error',
}: ReviewChooserProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('chooser');
  const dialogRef = useRef<HTMLDivElement>(null);
  const editHref = `https://github.com/${repo}/edit/${branch}/${filePath}`;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (view === 'flag') setView('chooser');
        else setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, view]);

  useEffect(() => {
    if (open && view === 'chooser') {
      dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
  }, [open, view]);

  function rememberPath(path: 'flag' | 'edit') {
    try {
      localStorage.setItem(STORAGE_KEY, path);
    } catch {
      /* localStorage unavailable — non-fatal */
    }
  }

  function openChooser() {
    setView('chooser');
    setOpen(true);
  }

  function openEdit() {
    rememberPath('edit');
    window.open(editHref, '_blank', 'noopener,noreferrer');
    setOpen(false);
  }

  function openFlag() {
    rememberPath('flag');
    setView('flag');
  }

  const trigger =
    variant === 'cta-large' ? (
      <button
        type="button"
        onClick={openChooser}
        className="inline-flex items-center gap-2 font-mono text-sm uppercase tracking-wider text-surface-0 bg-accent-600 hover:bg-accent-700 px-5 py-3 transition-colors"
      >
        <ReviewIcon size={16} />
        {label}
      </button>
    ) : (
      <button
        type="button"
        onClick={openChooser}
        className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-surface-0 bg-accent-600 hover:bg-accent-700 px-3.5 py-2 transition-colors"
      >
        <ReviewIcon size={13} />
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
            aria-labelledby="review-chooser-title"
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-0 border border-surface-300 shadow-xl text-left"
          >
            {view === 'chooser' ? (
              <div className="p-6">
                <header className="mb-6">
                  <h2 id="review-chooser-title" className="text-xl mb-1">Review this topic</h2>
                  <p className="text-sm text-surface-600">Two ways to contribute. Pick whichever fits.</p>
                </header>

                <div className="grid sm:grid-cols-2 gap-3 mb-6">
                  <button
                    type="button"
                    onClick={openFlag}
                    data-autofocus
                    className="group text-left border border-surface-300 hover:border-accent-500 p-5 transition-colors focus:outline-none focus:border-accent-500"
                  >
                    <div className="flex items-center gap-2 mb-2 text-surface-700 group-hover:text-accent-700">
                      <FlagIcon size={16} />
                      <span className="font-mono text-xs uppercase tracking-wider">Flag an issue</span>
                    </div>
                    <p className="text-sm text-surface-700 mb-3">
                      Tell us what's wrong in 30 seconds. Opens a tracked GitHub issue — no account needed.
                    </p>
                    <p className="text-xs text-surface-500">
                      Best for: a wrong prerequisite, a missing concept, a factual slip, a misattributed source.
                    </p>
                    <div className="mt-4 font-mono text-[10px] uppercase tracking-wider text-accent-600 group-hover:text-accent-700">
                      Open form →
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={openEdit}
                    className="group text-left border border-surface-300 hover:border-accent-500 p-5 transition-colors focus:outline-none focus:border-accent-500"
                  >
                    <div className="flex items-center gap-2 mb-2 text-surface-700 group-hover:text-accent-700">
                      <EditIcon size={16} />
                      <span className="font-mono text-xs uppercase tracking-wider">Edit the page</span>
                    </div>
                    <p className="text-sm text-surface-700 mb-3">
                      Rewrite a section or fix prose directly. Opens a pull request on GitHub.
                    </p>
                    <p className="text-xs text-surface-500">
                      Best for: substantive rewrites, clearer phrasing, additional nuance you'd rather write than describe.
                    </p>
                    <div className="mt-4 font-mono text-[10px] uppercase tracking-wider text-accent-600 group-hover:text-accent-700">
                      Edit on GitHub →
                    </div>
                  </button>
                </div>

                <div className="border-t border-surface-200 pt-4">
                  <p className="text-xs text-surface-500">
                    Cited as an author here?{' '}
                    <a
                      href={`/api/orcid/login?returnTo=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`}
                      className="underline decoration-dotted hover:text-accent-600"
                    >
                      Sign in with ORCID
                    </a>{' '}
                    to claim attribution and review under your name.
                  </p>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="font-mono text-xs uppercase tracking-wider px-3 py-2 border border-surface-200 hover:border-surface-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <FlagForm
                topicId={topicId}
                defaultKind={defaultKind}
                onCancel={() => setOpen(false)}
                onBack={() => setView('chooser')}
              />
            )}
          </div>
        </div>
      )}
    </>
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

function FlagIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function EditIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
