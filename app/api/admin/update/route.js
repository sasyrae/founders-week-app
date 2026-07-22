import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { addAnnouncement, deleteAnnouncement } from "@/lib/db";
import { postToSlack } from "@/lib/slack";
import { uid } from "@/lib/utils";

export const dynamic = "force-dynamic";

/* Publish an update to the in-app feed, optionally cross-posting to
   Slack via the webhook. Admin-only. */
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
    return NextResponse.json({ item, slack });
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
