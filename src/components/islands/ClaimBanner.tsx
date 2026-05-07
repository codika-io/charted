import { useEffect, useState } from 'react';

type Eligibility =
  | { state: 'loading' }
  | { state: 'eligible'; authorName: string; orcid: string }
  | { state: 'ineligible'; reason: string }
  | { state: 'hidden' };

export type ClaimBannerProps = { topicId: string };

export default function ClaimBanner({ topicId }: ClaimBannerProps) {
  const [status, setStatus] = useState<Eligibility>({ state: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [github, setGithub] = useState('');
  const [note, setNote] = useState('');
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/claim-eligibility?topicId=${encodeURIComponent(topicId)}`, { credentials: 'same-origin' });
        const data = await res.json();
        if (cancelled) return;
        if (data.eligible) {
          setStatus({ state: 'eligible', authorName: data.authorName, orcid: data.session.orcid });
        } else if (data.reason === 'no-session') {
          setStatus({ state: 'hidden' });
        } else if (data.reason === 'orcid-not-in-authors' || data.reason === 'not-cited-here' || data.reason === 'already-reviewer') {
          setStatus({ state: 'ineligible', reason: data.reason });
        } else {
          setStatus({ state: 'hidden' });
        }
      } catch {
        if (!cancelled) setStatus({ state: 'hidden' });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  async function submit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ topicId, github: github || undefined, note: note || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Claim failed (${res.status})`);
      }
      const data = (await res.json()) as { prUrl: string };
      setPrUrl(data.prUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  if (status.state === 'loading' || status.state === 'hidden' || status.state === 'ineligible') return null;

  if (prUrl) {
    return (
      <aside className="border border-accent-300 bg-accent-50 px-4 py-3 mb-6">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent-700 mb-1">Claim submitted</p>
        <p className="text-sm text-surface-700">
          A PR was opened on your behalf — a maintainer will review and merge.
        </p>
        <a href={prUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline decoration-dotted hover:text-accent-700">
          View PR →
        </a>
      </aside>
    );
  }

  return (
    <aside className="border border-accent-300 bg-accent-50 px-4 py-3 mb-6">
      <p className="font-mono text-[10px] uppercase tracking-wider text-accent-700 mb-1">You're cited here</p>
      <p className="text-sm text-surface-700 mb-3">
        Welcome, <strong>{status.authorName}</strong>. Your ORCID matches an author cited on this topic. Claim it to be listed as a reviewer.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2 max-w-xl">
        <label className="text-xs">
          <span className="font-mono text-[10px] uppercase tracking-wider text-surface-500 block mb-1">GitHub handle (optional)</span>
          <input
            type="text"
            value={github}
            onChange={(e) => setGithub(e.target.value)}
            placeholder="your-handle"
            pattern="[A-Za-z0-9-]{1,39}"
            className="w-full text-sm border border-surface-300 px-3 py-2 focus:outline-none focus:border-accent-500"
          />
        </label>
        <label className="text-xs">
          <span className="font-mono text-[10px] uppercase tracking-wider text-surface-500 block mb-1">Note for maintainers (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={1000}
            className="w-full text-sm border border-surface-300 px-3 py-2 focus:outline-none focus:border-accent-500"
          />
        </label>
        {error && <p className="text-sm text-accent-700">{error}</p>}
        <div className="flex gap-2 items-center">
          <button
            type="submit"
            disabled={submitting}
            className="font-mono text-xs uppercase tracking-wider px-4 py-2 border border-accent-500 bg-accent-500 text-surface-0 hover:bg-accent-600 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Submitting…' : 'Claim authorship'}
          </button>
          <span className="text-xs text-surface-500 font-mono">ORCID {status.orcid}</span>
        </div>
      </form>
    </aside>
  );
}
