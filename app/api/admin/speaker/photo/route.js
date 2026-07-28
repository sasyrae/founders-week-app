import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { uploadSpeakerPhoto } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // 4MB

/* Upload a speaker headshot (multipart form: file + speakerId). Admin-only. */
export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const form = await req.formData();
    const speakerId = form.get("speakerId");
    const file = form.get("file");
    if (!speakerId || typeof speakerId !== "string") {
      return NextResponse.json({ error: "Missing speakerId." }, { status: 400 });
    }
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
    }
    if (!String(file.type || "").startsWith("image/")) {
      return NextResponse.json({ error: "That file isn't an image." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image is too large — keep it under 4MB." }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const photoUrl = await uploadSpeakerPhoto(speakerId, bytes, file.type);
    return NextResponse.json({ photoUrl });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Upload failed." }, { status: 500 });
  }
}
