import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req) {
  return NextResponse.json({ authed: isAdminRequest(req) });
}
