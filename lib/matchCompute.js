import crypto from "crypto";
import { getOptedInProfiles, saveMatches } from "./db";
import { buildShortlist, explainPair } from "./score";
import { rankMatches } from "./aiMatch";

/* ─────────────────────────────────────────────────────────────
   Orchestrates match computation: deterministic shortlist → optional AI
   ranking with reasons → deterministic fallback. SERVER-ONLY. Caches the
   result on the attendee record. Never call this from a page view —
   trigger it on opt-in / profile edit, or the admin "recompute all".
   ───────────────────────────────────────────────────────────── */

/* Recompute one person's matches. `pool` may be passed in to avoid a DB
   read when recomputing many at once. Returns the saved items. */
export async function recomputeMatchesFor(email, pool = null) {
  const profiles = pool || (await getOptedInProfiles());
  const me = profiles.find((p) => p.email === email);
  if (!me) {
    // Not opted in (or opted out) → clear any stale matches.
    await saveMatches(email, []);
    return [];
  }
  const others = profiles.filter((p) => p.email !== email);
  const shortlist = buildShortlist(me, others, 15);
  if (shortlist.length === 0) {
    await saveMatches(email, []);
    return [];
  }

  const byEmail = new Map(profiles.map((p) => [p.email, p]));
  const candidates = shortlist.map((s) => byEmail.get(s.email)).filter(Boolean);

  // Deterministic fallback, ready regardless of the AI step.
  const fallback = shortlist.slice(0, 5).map((s) => ({
    id: crypto.randomUUID(),
    email: s.email,
    score: s.score,
    reason: explainPair(me, byEmail.get(s.email)),
  }));

  let items = fallback;
  const ranked = await rankMatches(me, candidates); // null on failure, [] if nothing
  if (Array.isArray(ranked) && ranked.length > 0) {
    const scoreOf = new Map(shortlist.map((s) => [s.email, s.score]));
    items = ranked.map((r) => ({
      id: crypto.randomUUID(),
      email: r.email,
      score: scoreOf.get(r.email) || 0,
      reason: r.reason,
    }));
  }

  await saveMatches(email, items);
  return items;
}

/* Recompute everyone opted in (admin action). One shared pool read; AI
   calls run sequentially so we don't hammer the API. Returns a summary. */
export async function recomputeAllMatches() {
  const pool = await getOptedInProfiles();
  let ok = 0;
  for (const p of pool) {
    try {
      await recomputeMatchesFor(p.email, pool);
      ok++;
    } catch {
      /* skip a single failure, keep going */
    }
  }
  return { people: pool.length, recomputed: ok };
}
