import App from "@/components/App";
import {
  ensureSeeded,
  getConfig,
  getSessions,
  getSessionCounts,
  getSpeakers,
  publicSession,
} from "@/lib/db";

// Render per-request so the agenda is always current.
export const dynamic = "force-dynamic";

/* Pre-load the event on the server so the page arrives already populated —
   no "Loading the event…" flash. If anything fails (e.g. the database is
   briefly unreachable), we pass nulls and the client fetches on mount,
   exactly as it did before. So this is strictly an improvement. */
export default async function Page() {
  let initialConfig = null;
  let initialSessions = null;

  try {
    await ensureSeeded();
    const [config, sessions, counts, speakers] = await Promise.all([
      getConfig(),
      getSessions(),
      getSessionCounts(),
      getSpeakers({ publishedOnly: true }).catch(() => []),
    ]);
    const { confirmSubject, confirmTemplate, ...pub } = config || {};
    initialConfig = { ...pub, speakers };
    initialSessions = sessions.map((s) => ({
      ...publicSession(s),
      taken: s.capacity > 0 ? counts[s.id] || 0 : 0,
    }));
  } catch {
    // Fall back to client-side loading.
  }

  return <App initialConfig={initialConfig} initialSessions={initialSessions} />;
}

/* redeploy nudge */
