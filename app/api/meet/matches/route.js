import { NextResponse } from "next/server";
import { meetEmailFromRequest } from "@/lib/auth";
import { getMatchesResolved } from "@/lib/db";

export const dynamic = "force-dynamic";

/* My precomputed matches, resolved to display cards (no contact details).
   Read-only — never triggers a computation. */
export async function GET(req) {
  const email = meetEmailFromRequest(req);
  if (!email) return NextResponse.json({ error: "Open your personal link first." }, { status: 401 });
  try {
    const result = await getMatchesResolved(email);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't load your matches." }, { status: 500 });
  }
}
