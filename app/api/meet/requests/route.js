import { NextResponse } from "next/server";
import { meetEmailFromRequest } from "@/lib/auth";
import { getRequestsResolved } from "@/lib/db";

export const dynamic = "force-dynamic";

/* My incoming + outgoing meeting requests (and a pending-incoming count for
   the nav badge). Contact details appear only on accepted requests. */
export async function GET(req) {
  const email = meetEmailFromRequest(req);
  if (!email) return NextResponse.json({ error: "Open your personal link first." }, { status: 401 });
  try {
    const result = await getRequestsResolved(email);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't load your requests." }, { status: 500 });
  }
}
