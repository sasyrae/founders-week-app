import { NextResponse } from "next/server";
import { isAdminRequest, attendeeToken } from "@/lib/auth";
import { getNudgeTargets, markNudged } from "@/lib/db";
import { sendMatchNudge, sendMatchUpdate } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function originFrom(req) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return process.env.NEXT_PUBLIC_SITE_URL || (host ? `${proto}://${host}` : "");
}
const linkFor = (origin, email) => `${origin}/?m=${encodeURIComponent(attendeeToken(email))}`;
const RECENT_MS = 18 * 60 * 60 * 1000; // don't re-nudge within 18h

/* Admin-only reminders. Body:
   { segment: "pending" | "opted", mode: "count" | "test" | "send", testEmail? } */
export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const segment = body?.segment === "opted" ? "opted" : "pending";
  const mode = body?.mode || "count";
  const sendOne = segment === "opted" ? sendMatchUpdate : sendMatchNudge;
  const origin = originFrom(req);

  try {
    if (mode === "test") {
      const email = String(body?.testEmail || "").trim().toLowerCase();
      if (!email.includes("@")) return NextResponse.json({ error: "Enter a valid test email." }, { status: 400 });
      const r = await sendOne({ email, name: "", link: linkFor(origin, email) });
      return NextResponse.json({ ok: !!r.sent, test: true, error: r.error });
    }

    const targets = await getNudgeTargets(segment);
    if (mode === "count") return NextResponse.json({ ok: true, total: targets.length });

    // mode === "send"
    const now = Date.now();
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const t of targets) {
      if (t.nudgedAt && now - new Date(t.nudgedAt).getTime() < RECENT_MS) {
        skipped++;
        continue;
      }
      const r = await sendOne({ email: t.email, name: t.name, link: linkFor(origin, t.email) });
      if (r.sent) {
        sent++;
        await markNudged(t.email);
      } else {
        failed++;
      }
    }
    return NextResponse.json({ ok: true, sent, skipped, failed, total: targets.length });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Reminder send failed." }, { status: 500 });
  }
}
