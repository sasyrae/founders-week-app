import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { getConfig, getSessions, listAttendees, getAttendee, upsertAttendee } from "@/lib/db";
import { sendConfirmation } from "@/lib/email";
import { normalizeEmail } from "@/lib/utils";

export const dynamic = "force-dynamic";

/* Confirmation emails send instantly at registration. This endpoint
   re-sends to anyone whose send failed (no confirmedAt) — or to a
   single attendee when an email is given. Admin-only. */
export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body = {};
  try {
    body = await req.json();
  } catch {
    /* body optional */
  }
  try {
    const config = await getConfig();
    const sessions = await getSessions();
    const cfg = { ...config, _sessions: sessions };

    let targets;
    if (body.email) {
      const one = await getAttendee(normalizeEmail(body.email));
      targets = one ? [one] : [];
    } else {
      const all = await listAttendees();
      targets = all.filter((a) => !a.confirmedAt);
    }

    let sent = 0;
    const failures = [];
    for (const a of targets) {
      const r = await sendConfirmation(cfg, a);
      if (r.sent) {
        await upsertAttendee({ ...a, confirmedAt: new Date().toISOString() });
        sent += 1;
      } else {
        failures.push({ email: a.email, error: r.error || "unknown" });
      }
    }
    return NextResponse.json({ attempted: targets.length, sent, failures });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't send." }, { status: 500 });
  }
}
