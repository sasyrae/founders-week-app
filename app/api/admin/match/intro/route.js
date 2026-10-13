import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { createCuratedIntro, removeCuratedIntro } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Create an admin-curated intro between two attendees. */
export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  try {
    const { id } = await createCuratedIntro(body?.aEmail, body?.bEmail, body?.reason);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't create the intro." }, { status: 400 });
  }
}

/* Remove a curated intro by id (clears it from both people). */
export async function DELETE(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  try {
    await removeCuratedIntro(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't remove the intro." }, { status: 500 });
  }
}
