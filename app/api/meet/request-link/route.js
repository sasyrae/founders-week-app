import { NextResponse } from "next/server";
import { attendeeToken } from "@/lib/auth";
import { getMatchMe } from "@/lib/db";
import { sendMeetLink } from "@/lib/email";
import { normalizeEmail } from "@/lib/utils";

export const dynamic = "force-dynamic";

/* Self-serve recovery: email an attendee their own personal link. Always
   returns the same generic message so it never reveals who is on the list;
   only actually sends when the email matches a known attendee. */
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const email = normalizeEmail(body?.email || "");
  if (!email.includes("@")) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  const generic = { ok: true, message: "If that email is on our list, we've emailed your link — check your inbox." };
  try {
    const me = await getMatchMe(email);
    if (me) {
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
      const proto = req.headers.get("x-forwarded-proto") || "https";
      const origin = process.env.NEXT_PUBLIC_SITE_URL || (host ? `${proto}://${host}` : "");
      const link = `${origin}/?m=${encodeURIComponent(attendeeToken(email))}`;
      const name = [me.identity.firstName, me.identity.lastName].filter(Boolean).join(" ");
      await sendMeetLink({ email, name, link });
    }
  } catch {
    /* never surface existence or errors */
  }
  return NextResponse.json(generic);
}
