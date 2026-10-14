import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { addAnnouncement, deleteAnnouncement, listAttendees } from "@/lib/db";
import { postToSlack } from "@/lib/slack";
import { uid, broadcastRecipients } from "@/lib/utils";
import { sendBroadcast } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // emailing every guest can take a while

/* Publish an update to the in-app feed, optionally cross-posting to
   Slack via the webhook and/or emailing every guest. Admin-only. */
export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  try {
    const text = (body.text || "").trim();
    if (!text) return NextResponse.json({ error: "Write the update first." }, { status: 400 });
    const author = (body.author || "Flybridge team").trim() || "Flybridge team";
    const item = { id: uid(), text, author, ts: new Date().toISOString() };
    await addAnnouncement(item);

    let slack = null;
    if (body.toSlack) {
      slack = await postToSlack(text);
    }
    let email = null;
    if (body.toEmail) {
      const subject = (body.subject || "").trim() || "Founders Week update";
      const recipients = broadcastRecipients(await listAttendees());
      email = await sendBroadcast({ recipients, subject, text, author });
    }
    return NextResponse.json({ item, slack, email });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't publish." }, { status: 500 });
  }
}

/* Delete a published update. Admin-only. */
export async function DELETE(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await deleteAnnouncement(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Couldn't delete." }, { status: 500 });
  }
}
