import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { createCuratedIntrosBulk } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // many intros = many writes

/* Admin-only: bulk-create curated intros. Body: { items: [{a, b, reason}] }
   where a/b are attendee names. */
export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const items = Array.isArray(body?.items) ? body.items : null;
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "No intros to create." }, { status: 400 });
  }
  try {
    const result = await createCuratedIntrosBulk(items);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Bulk create failed." }, { status: 500 });
  }
}
