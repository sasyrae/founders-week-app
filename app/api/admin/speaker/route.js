import { NextResponse } from "next/server";
import { isAdminRequest, speakerToken } from "@/lib/auth";
import { upsertSpeaker, deleteSpeaker, getSpeakers } from "@/lib/db";
import { uid } from "@/lib/utils";

export const dynamic = "force-dynamic";

/* Create or update a single speaker. Admin-only. */
export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  try {
    const sp = body.speaker || body;
    if (!sp?.firstName?.trim() && !sp?.name?.trim()) {
      return NextResponse.json({ error: "First name is required." }, { status: 400 });
    }
    if (!sp.id) {
      sp.id = uid();
      // New speaker sorts to the end.
      const existing = await getSpeakers();
      sp.sortOrder = existing.length;
    }
    const saved = await upsertSpeaker(sp);
    return NextResponse.json({ speaker: { ...saved, token: speakerToken(saved.id) } });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't save speaker." }, { status: 500 });
  }
}

/* Delete a speaker. Admin-only. */
export async function DELETE(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await deleteSpeaker(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't delete." }, { status: 500 });
  }
}
