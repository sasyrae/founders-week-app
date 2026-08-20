/* ─────────────────────────────────────────────────────────────
   Optional: append each NEW registration to a Google Sheet, via a
   Google Apps Script web app URL stored in GSHEET_WEBHOOK_URL.
   Fire-and-forget with a timeout — it must never block or fail a
   registration. Server-only.
   ───────────────────────────────────────────────────────────── */
export async function logRegistrationToSheet(attendee, config) {
  const url = process.env.GSHEET_WEBHOOK_URL;
  if (!url) return;

  const days = (attendee.attending || [])
    .map((id) => (config.days || []).findIndex((d) => d.id === id) + 1)
    .filter((n) => n > 0)
    .sort()
    .join(" ");

  const payload = {
    registeredAt: attendee.createdAt || new Date().toISOString(),
    firstName: attendee.firstName || "",
    lastName: attendee.lastName || "",
    email: attendee.email || "",
    company: attendee.company || "",
    type: attendee.type || "",
    days,
    hotel: attendee.hotel === "yes" ? "Yes" : attendee.hotel === "no" ? "No" : "",
    hotelNights: (attendee.hotelNights || []).join("; "),
    dietary: (attendee.dietary || []).join("; "),
    dietaryOther: attendee.dietaryOther || "",
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
  } catch {
    /* never block registration on a logging failure */
  } finally {
    clearTimeout(timer);
  }
}
