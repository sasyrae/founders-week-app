import { NextResponse } from "next/server";
import { getConfig, getSessions, getAttendee, upsertAttendee } from "@/lib/db";
import { sendConfirmation } from "@/lib/email";
import { logRegistrationToSheet } from "@/lib/sheet";
import { validateRegistration } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  try {
    const config = await getConfig();
    const v = validateRegistration(body, config);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    // If already registered, mirror the prototype: return the existing
    // record, don't duplicate, and DON'T resend the confirmation email.
    const existing = await getAttendee(v.fields.email);
    if (existing) {
      return NextResponse.json({ attendee: existing, existed: true });
    }

    const att = {
      ...v.fields,
      sessions: [],
      checkins: {},
      createdAt: new Date().toISOString(),
    };
    const saved = await upsertAttendee(att);

    // Instant confirmation email via Resend + optional Google Sheet log,
    // run together so neither adds serial latency. Neither may block/fail
    // the registration.
    const sessions = await getSessions();
    const [emailRes] = await Promise.all([
      sendConfirmation({ ...config, _sessions: sessions }, saved),
      logRegistrationToSheet(saved, config),
    ]);

    let finalAtt = saved;
    if (emailRes.sent) {
      finalAtt = { ...saved, confirmedAt: new Date().toISOString() };
      await upsertAttendee(finalAtt);
    }

    return NextResponse.json({ attendee: finalAtt, existed: false, email: emailRes });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't save — try again." }, { status: 500 });
  }
}
