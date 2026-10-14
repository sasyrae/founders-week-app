/* Pure helpers safe for both client and server (no secrets, no db). */

export const fmtTime = (t) => {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
};

export const fmtWhen = (iso) => {
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

export const uid = () => "x" + Math.random().toString(36).slice(2, 9);

export const normalizeEmail = (email) => (email || "").trim().toLowerCase();

/* Label a speaker's profile link based on where it points, so the CTA is
   accurate whether they gave LinkedIn (what we ask for), X, or a site. */
export function profileCta(link) {
  const u = (link || "").toLowerCase();
  if (u.includes("linkedin.com")) return "Connect on LinkedIn";
  if (u.includes("x.com") || u.includes("twitter.com")) return "Follow on X";
  return "View profile";
}

/* Who an emailed update goes to. audience "all" = every guest record
   with a real address (registrants and roster imports); a day id ("d1")
   = only people whose registration includes that day. Skips the
   @example.com sample profiles used to test matchmaking. Shared so the
   admin UI's count matches what the server actually sends. */
export function broadcastRecipients(attendees, audience = "all") {
  const seen = new Set();
  const out = [];
  for (const a of attendees || []) {
    const email = normalizeEmail(a.email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.endsWith("@example.com") || seen.has(email)) continue;
    if (audience !== "all" && !(a.attending || []).includes(audience)) continue;
    seen.add(email);
    out.push(a);
  }
  return out;
}
