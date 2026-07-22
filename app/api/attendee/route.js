import { NextResponse } from "next/server";
import { getConfig, getAttendee, upsertAttendee } from "@/lib/db";
import { validateRegistration } from "@/lib/validate";
import { normalizeEmail } from "@/lib/utils";

export const dynamic = "force-dynamic";

/* Find my registration by email (returning flow). */
export async function GET(req) {
  try {
    const email = normalizeEmail(new URL(req.url).searchParams.get("email") || "");
    if (!email.includes("@")) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    const attendee = await getAttendee(email);
    if (!attendee) {
      return NextResponse.json(
        { error: "No registration found for that email." },
        { status: 404 }
      );
    }
    return NextResponse.json({ attendee });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Something went wrong." }, { status: 500 });
  }
}

/* Edit an existing registration. Email is locked; sessions/checkins are
   untouched; NO confirmation email is (re)sent. */
export async function PUT(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  try {
    const email = normalizeEmail(body.email);
    const existing = await getAttendee(email);
    if (!existing) {
      return NextResponse.json({ error: "No registration found for that email." }, { status: 404 });
    }
    const config = await getConfig();
    const v = validateRegistration({ ...body, email }, config);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const updated = {
      ...existing,
      ...v.fields,
      email: existing.email, // locked
      sessions: existing.sessions || [],
      checkins: existing.checkins || {},
      createdAt: existing.createdAt,
      confirmedAt: existing.confirmedAt,
    };
    const saved = await upsertAttendee(updated);
    return NextResponse.json({ attendee: saved });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't save — try again." }, { status: 500 });
  }
}
