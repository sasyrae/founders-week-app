/* ─────────────────────────────────────────────────────────────
   Deterministic tag scoring — fast, pure, no DB or network. Scores how
   well two opted-in attendees fit, used to build a shortlist before the
   (optional) AI ranking step. Higher = better fit.

   A profile here is the minimal shape: { email, attendeeType,
   lookingFor: string[], canHelpWith: string[] }.
   ───────────────────────────────────────────────────────────── */

const INVESTOR_TYPES = new Set(["LP", "Guest", "Sponsor"]);
// Tags where a founder <-> investor pairing is especially apt.
const CAPITAL_TAGS = new Set(["Fundraising intros", "Co-investment", "LP perspective"]);

function overlap(aWants, bOffers) {
  if (!aWants?.length || !bOffers?.length) return 0;
  const offer = new Set(bOffers);
  let n = 0;
  for (const t of aWants) if (offer.has(t)) n++;
  return n;
}

/* Symmetric fit score for a pair. Each satisfied "looking for" ↔ "can help
   with" match is worth 2 (counted in both directions), plus a small bonus
   for complementary founder/investor pairings. */
export function scorePair(a, b) {
  const aFromB = overlap(a.lookingFor, b.canHelpWith); // what A wants, B offers
  const bFromA = overlap(b.lookingFor, a.canHelpWith); // what B wants, A offers
  let score = (aFromB + bFromA) * 2;

  const aFounder = a.attendeeType === "Founder";
  const bFounder = b.attendeeType === "Founder";
  const aInvestor = INVESTOR_TYPES.has(a.attendeeType);
  const bInvestor = INVESTOR_TYPES.has(b.attendeeType);
  if ((aFounder && bInvestor) || (bFounder && aInvestor)) {
    score += 1;
    // Extra nudge when the founder is actually seeking capital-side help.
    const founderWants = aFounder ? a.lookingFor : b.lookingFor;
    if ((founderWants || []).some((t) => CAPITAL_TAGS.has(t))) score += 1;
  }
  return score;
}

/* A plain-language reason for a pair, from overlapping tags only — used
   when the AI step is unavailable or declines. Addressed to "me". */
export function explainPair(me, other) {
  const name = other.firstName || "They";
  const iWant = (me.lookingFor || []).filter((t) => (other.canHelpWith || []).includes(t));
  const theyWant = (other.lookingFor || []).filter((t) => (me.canHelpWith || []).includes(t));
  const parts = [];
  if (iWant.length) parts.push(`${name} can help with ${joinTags(iWant)}, which you're looking for`);
  if (theyWant.length) parts.push(`you can help with ${joinTags(theyWant)}, which ${name} is looking for`);
  if (parts.length) {
    const s = parts.join("; and ");
    return s.charAt(0).toUpperCase() + s.slice(1) + ".";
  }
  const meFounder = me.attendeeType === "Founder";
  const otherInvestor = INVESTOR_TYPES.has(other.attendeeType);
  if (meFounder && otherInvestor) return `${name} is here on the investor side — worth a conversation.`;
  return `You've got overlapping focus areas — worth comparing notes.`;
}

function joinTags(tags) {
  const lower = tags.map((t) => t.toLowerCase());
  if (lower.length === 1) return lower[0];
  if (lower.length === 2) return `${lower[0]} and ${lower[1]}`;
  return `${lower.slice(0, -1).join(", ")}, and ${lower[lower.length - 1]}`;
}

/* Rank everyone else against `me`, returning the top `limit` with score > 0.
   Deterministic tie-break by email so results are stable across runs. */
export function buildShortlist(me, others, limit = 15) {
  const scored = [];
  for (const other of others) {
    if (!other || other.email === me.email) continue;
    const score = scorePair(me, other);
    if (score > 0) scored.push({ email: other.email, score });
  }
  scored.sort((x, y) => y.score - x.score || x.email.localeCompare(y.email));
  return scored.slice(0, limit);
}
