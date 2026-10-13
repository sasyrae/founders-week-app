import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { syncSpeakersToMatch } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Admin-only: add speakers to the matchmaking pool (by email). */
export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await syncSpeakersToMatch();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't add speakers." }, { status: 500 });
  }
}
