import { NextResponse } from "next/server";
import { meetEmailFromRequest } from "@/lib/auth";
import { respondMeetRequest } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Accept or decline an incoming meeting request. On accept, both people can
   then see each other's contact details via /api/meet/requests. */
export async function POST(req) {
  const email = meetEmailFromRequest(req);
  if (!email) return NextResponse.json({ error: "Open your personal link first." }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  try {
    const result = await respondMeetRequest(email, body?.requestId, body?.action);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't update the request." }, { status: 400 });
  }
}
