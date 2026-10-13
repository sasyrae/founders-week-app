import { NextResponse } from "next/server";
import { meetEmailFromRequest } from "@/lib/auth";
import { getDirectory } from "@/lib/db";

export const dynamic = "force-dynamic";

/* The opted-in attendee directory (everyone but me), with my request state
   per person. Contact details appear only on accepted connections. The
   client handles search/filtering. */
export async function GET(req) {
  const email = meetEmailFromRequest(req);
  if (!email) return NextResponse.json({ error: "Open your personal link first." }, { status: 401 });
  try {
    const result = await getDirectory(email);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't load the directory." }, { status: 500 });
  }
}
