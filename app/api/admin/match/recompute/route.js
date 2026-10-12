import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { recomputeAllMatches } from "@/lib/matchCompute";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // allow a longer run for the full recompute

/* Admin-only: recompute matches for everyone opted in. */
export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await recomputeAllMatches();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Recompute failed." }, { status: 500 });
  }
}
