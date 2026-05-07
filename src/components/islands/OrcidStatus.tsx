import { useEffect, useState } from 'react';

type Session = { orcid: string; name?: string } | null;

/**
 * Tiny "Sign in with ORCID" pill shown next to the contribute button.
 * Becomes a "signed in" indicator (with a sign-out form) once authed.
 */
export default function OrcidStatus({ returnTo }: { returnTo?: string }) {
  const [session, setSession] = useState<Session>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/orcid/me', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setSession(d.session ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;

  if (session) {
    return (
      <form method="post" action="/api/orcid/logout" className="inline-flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-surface-500">
          ORCID {session.orcid}
        </span>
        <button
          type="submit"
          className="font-mono text-[10px] uppercase tracking-wider text-surface-400 hover:text-accent-600 underline decoration-dotted"
        >
          sign out
        </button>
      </form>
    );
  }

  const href = `/api/orcid/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-surface-400 hover:text-accent-600 transition-colors border border-dashed border-surface-300 hover:border-accent-400 px-3 py-1.5"
    >
      <OrcidIcon />
      Sign in with ORCID
    </a>
  );
}

function OrcidIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 256 256" aria-hidden="true">
      <path fill="currentColor" d="M128 0C57.3 0 0 57.3 0 128s57.3 128 128 128 128-57.3 128-128S198.7 0 128 0zM86 186.2H70.5V79.6H86v106.6zM78.2 67.7c-5.1 0-9.2-4.1-9.2-9.2s4.1-9.2 9.2-9.2 9.2 4.1 9.2 9.2-4.1 9.2-9.2 9.2zM192 156.3c0 17-13.8 30.8-30.8 30.8H115V79.6h46.2c17 0 30.8 13.8 30.8 30.8V156.3z" />
      <path fill="currentColor" d="M161.2 94.7H130v77h31.2c14 0 25.4-11.4 25.4-25.4v-26.2c0-14-11.4-25.4-25.4-25.4z" />
    </svg>
  );
}
