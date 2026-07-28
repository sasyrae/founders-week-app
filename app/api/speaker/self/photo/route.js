import { NextResponse } from "next/server";
import { verifySpeakerToken } from "@/lib/auth";
import { uploadSpeakerPhoto } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 6 * 1024 * 1024; // 6MB

/* A speaker uploads their own headshot via their link token. */
export async function POST(req) {
  try {
    const form = await req.formData();
    const token = form.get("token");
    const file = form.get("file");
    const id = verifySpeakerToken(typeof token === "string" ? token : "");
    if (!id) return NextResponse.json({ error: "This link isn't valid." }, { status: 401 });
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
    }
    if (!String(file.type || "").startsWith("image/")) {
      return NextResponse.json({ error: "That file isn't an image." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image is too large — keep it under 6MB." }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const photoUrl = await uploadSpeakerPhoto(id, bytes, file.type);
    return NextResponse.json({ photoUrl });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Upload failed." }, { status: 500 });
  }
}
