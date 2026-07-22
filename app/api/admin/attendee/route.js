import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { upsertAttendee, deleteAttendee } from "@/lib/db";
import { normalizeEmail } from "@/lib/utils";

export const dynamic = "force-dynamic";

/* Save an attendee record (check-in toggles, walk-in add). Admin-only. */
export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  try {
    const att = body.attendee || body;
    if (!att?.email) return NextResponse.json({ error: "Missing email." }, { status: 400 });
    const saved = await upsertAttendee(att);
    return NextResponse.json({ attendee: saved });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't save." }, { status: 500 });
  }
}

/* Remove an attendee. Admin-only. */
export async function DELETE(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const email = normalizeEmail(new URL(req.url).searchParams.get("email") || "");
    if (!email) return NextResponse.json({ error: "Missing email." }, { status: 400 });
    await deleteAttendee(email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't remove." }, { status: 500 });
  }
}
