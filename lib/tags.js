/* ─────────────────────────────────────────────────────────────
   Matchmaking vocabulary — edit this list to change the tags offered
   in profiles and used for scoring. Keep tag labels stable once people
   have saved profiles (renaming a tag orphans the saved value).

   ATTENDEE_TYPES mirror the `attendee_type` field in data/attendees.json.
   ───────────────────────────────────────────────────────────── */

export const ATTENDEE_TYPES = ["Founder", "Guest", "LP", "Sponsor", "Flybridge team"];

/* One shared tag list, used for both "looking for" and "can help with". */
export const MATCH_TAGS = [
  "Fundraising intros",
  "Customer intros and design partners",
  "Engineering hiring",
  "GTM hiring",
  "Sales and GTM strategy",
  "Pricing",
  "Product and design",
  "AI infrastructure and models",
  "Agents and agentic workflows",
  "Brand and storytelling",
  "Press and media",
  "Partnerships",
  "Enterprise sales",
  "International expansion",
  "M&A and exits",
  "Board and governance",
  "Co-investment",
  "LP perspective",
];

const TAG_SET = new Set(MATCH_TAGS);

/* Keep only recognized tags (drops anything stale/injected). */
export function cleanTags(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const t of list) {
    if (TAG_SET.has(t) && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

export function isAttendeeType(t) {
  return ATTENDEE_TYPES.includes(t);
}
