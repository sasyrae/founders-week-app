import { NextResponse } from "next/server";
import { getAnnouncements } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await getAnnouncements();
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Failed to load updates." }, { status: 500 });
  }
}
