import { useEffect, useRef, useState } from 'react';

export type FlagKind =
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

export type FlagFormProps = {
  topicId: string;
  defaultKind?: FlagKind;
  context?: string;
  onCancel: () => void;
  onBack?: () => void;
};

export default function FlagForm({ topicId, defaultKind = 'factual-error', context, onCancel, onBack }: FlagFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [kind, setKind] = useState<FlagKind>(defaultKind);
  const [comment, setComment] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [contextValue, setContextValue] = useState(context ?? '');
  const [success, setSuccess] = useState<{ url: string; number: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autofocusRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    autofocusRef.current?.focus();
  }, []);

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

  if (success) {
    return (
      <div className="p-6">
        <h2 className="text-xl mb-2">Thanks — review received</h2>
        <p className="text-sm text-surface-600 mb-4">
          We opened a tracking issue. A maintainer will read it shortly.
        </p>
        <div className="font-mono text-xs text-surface-500 mb-6 break-all">
          <a className="underline decoration-dotted hover:text-accent-600" href={success.url} target="_blank" rel="noopener noreferrer">
            Issue #{success.number} →
          </a>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onCancel} className="font-mono text-xs uppercase tracking-wider px-4 py-2 border border-surface-300 hover:border-accent-500 transition-colors">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="p-6">
      <header className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="font-mono text-[10px] uppercase tracking-wider text-surface-500 hover:text-accent-600 transition-colors"
              aria-label="Back to review options"
            >
              ← Back
            </button>
          )}
        </div>
        <h2 className="text-xl mb-1">Flag an issue</h2>
        <p className="text-xs font-mono text-surface-400 break-all">{topicId}</p>
      </header>

      <fieldset className="mb-4">
        <legend className="font-mono text-[10px] uppercase tracking-wider text-surface-500 mb-2">What's wrong?</legend>
        <div className="space-y-1.5">
          {KIND_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                ref={opt.value === defaultKind ? autofocusRef : undefined}
                type="radio"
                name="flag-kind"
                value={opt.value}
                checked={kind === opt.value}
                onChange={() => setKind(opt.value)}
                className="mt-1 accent-accent-600"
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
          aria-describedby="flag-details-help"
          placeholder="Be specific. What's wrong, and how would you fix it?"
          className="w-full text-sm border border-surface-300 px-3 py-2 focus:outline-none focus:border-accent-500 font-sans"
        />
        <span
          id="flag-details-help"
          className={`text-xs mt-1 block ${
            comment.trim().length > 0 && comment.trim().length < 5
              ? 'text-accent-700'
              : 'text-surface-400'
          }`}
        >
          {comment.trim().length === 0
            ? 'At least 5 characters.'
            : comment.trim().length < 5
              ? `${5 - comment.trim().length} more character${5 - comment.trim().length === 1 ? '' : 's'} needed to submit.`
              : `${comment.trim().length} / 4000 characters.`}
        </span>
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
        <p className="text-xs text-surface-400">Public — flags become GitHub issues.</p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="font-mono text-xs uppercase tracking-wider px-3 py-2 border border-surface-200 hover:border-surface-400 transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || comment.trim().length < 5}
            title={comment.trim().length < 5 ? 'Add at least 5 characters in Details to submit' : undefined}
            className="font-mono text-xs uppercase tracking-wider px-4 py-2 border border-accent-500 bg-accent-500 text-surface-0 hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit flag'}
          </button>
        </div>
      </div>
    </form>
  );
}
