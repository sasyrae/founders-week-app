import Anthropic from "@anthropic-ai/sdk";

/* ─────────────────────────────────────────────────────────────
   AI ranking of a shortlist into the top matches, with a warm, specific
   reason for each. SERVER-ONLY. Works strictly from the approved profile
   fields passed in — never from drafts or anything the person didn't
   approve. Returns [{ email, reason }] (<=5) or null on any failure, so
   the caller can fall back to the deterministic tag-score order.
   ───────────────────────────────────────────────────────────── */

const MODEL = "claude-sonnet-5-5";

const SYSTEM = `You are the matchmaker for Flybridge Founders Week, helping attendees find the few people most worth meeting.

You will get one attendee ("me") and a shortlist of candidates, each with: name, company, attendee type, a short "working on" line, what they're looking for, and what they can help with. Pick the best up to 5 candidates for "me" to meet and write a reason for each.

Rules you must follow:
- Use ONLY the fields provided. Never invent facts, titles, mutual connections, or history.
- Never mention or imply fundraising status, revenue, runway, valuation, churn, layoffs, or other sensitive company details unless that exact information appears in a person's own provided text.
- Each reason is 1-2 warm, specific sentences addressed to "me", naming the concrete overlap (e.g. what one is looking for that the other can help with). No fluff, no hype.
- Prefer genuinely complementary matches over superficial ones. Fewer great matches beat five weak ones.
- Return ONLY a JSON array, no prose, no code fences. Each item: {"email": "<candidate email>", "reason": "<1-2 sentences>"}. Use emails exactly as given. At most 5 items, best first.`;

function compact(p) {
  return {
    name: [p.firstName, p.lastName].filter(Boolean).join(" "),
    company: p.company || "",
    type: p.attendeeType || "",
    working_on: p.workingOn || "",
    looking_for: p.lookingFor || [],
    can_help_with: p.canHelpWith || [],
  };
}

export async function rankMatches(mine, candidates) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!candidates || candidates.length === 0) return [];

  const allowed = new Set(candidates.map((c) => c.email));
  const payload = {
    me: compact(mine),
    candidates: candidates.map((c) => ({ email: c.email, ...compact(c) })),
  };

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });
    if (res.stop_reason === "refusal") return null;

    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const parsed = parseJsonArray(text);
    if (!Array.isArray(parsed)) return null;

    const seen = new Set();
    const out = [];
    for (const item of parsed) {
      const email = typeof item?.email === "string" ? item.email.trim().toLowerCase() : "";
      const reason = typeof item?.reason === "string" ? item.reason.trim() : "";
      if (!allowed.has(email) || seen.has(email) || !reason) continue;
      seen.add(email);
      out.push({ email, reason: reason.slice(0, 400) });
      if (out.length >= 5) break;
    }
    return out;
  } catch {
    return null;
  }
}

/* Tolerant extraction: handles a bare array or one wrapped in ```json fences. */
function parseJsonArray(text) {
  if (!text) return null;
  let s = text.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}
