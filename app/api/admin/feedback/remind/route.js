import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { listAttendees, upsertAttendee } from "@/lib/db";
import { sendSurveyReminder, getEmailOpened } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* A person "checked in" if any check-in key (an event day: key or a
   session id) is truthy. */
const hasCheckin = (a) => !!a && a.checkins && Object.values(a.checkins).some(Boolean);
const firstNameOf = (a) => a.firstName || (a.name || "").split(" ")[0] || "there";

/* Run async fn over items with limited concurrency, preserving order. */
async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const ROUNDS = {
  all: {
    subject: "Reminder: Founders Week + AGM Feedback (takes 2 min)",
    intro:
      "Thank you for joining us at Flybridge Founders Week + AGM. We'd love your honest take so next year is even better. It's completely anonymous and takes about two minutes.",
    key: "surveyReminder",
  },
  nonopeners: {
    subject: "Last call: Founders Week + AGM feedback (takes 2 min)",
    intro:
      "Quick nudge in case this slipped by. Your feedback shapes what we do next year, and it's anonymous and takes about two minutes.",
    key: "surveyReminder2",
  },
};

/* Admin: send a survey reminder to checked-in attendees.
   body: { mode: "all" | "nonopeners", dryRun?: boolean }
   - "all"        → every checked-in attendee
   - "nonopeners" → checked-in attendees who didn't open the "all" send
   dryRun returns the recipient counts without sending. */
export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const mode = body.mode === "nonopeners" ? "nonopeners" : "all";
  const dryRun = !!body.dryRun;
  const round = ROUNDS[mode];

  try {
    const all = await listAttendees();
    const checkedIn = all.filter((a) => a.email && hasCheckin(a));

    let recipients = checkedIn;
    let opened = 0;
    if (mode === "nonopeners") {
      const openedFlags = await mapPool(checkedIn, 15, async (a) =>
        a.surveyReminder?.id ? getEmailOpened(a.surveyReminder.id) : false
      );
      opened = openedFlags.filter(Boolean).length;
      // Non-openers = checked-in people who didn't open round one (which
      // includes anyone who was never sent it, e.g. checked in afterward).
      recipients = checkedIn.filter((_, i) => !openedFlags[i]);
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        mode,
        dryRun: true,
        total: checkedIn.length,
        opened,
        recipients: recipients.length,
      });
    }

    const results = await mapPool(recipients, 8, async (a) => {
      const r = await sendSurveyReminder({
        email: a.email,
        firstName: firstNameOf(a),
        subject: round.subject,
        intro: round.intro,
      });
      if (r.sent && r.id) {
        try {
          await upsertAttendee({ ...a, [round.key]: { id: r.id, ts: new Date().toISOString() } });
        } catch {
          /* non-fatal: the email went out even if we couldn't record the id */
        }
      }
      return r;
    });

    const sent = results.filter((r) => r.sent).length;
    const failed = results.length - sent;
    return NextResponse.json({
      ok: true,
      mode,
      total: checkedIn.length,
      opened,
      attempted: recipients.length,
      sent,
      failed,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't send reminders." }, { status: 500 });
  }
}
