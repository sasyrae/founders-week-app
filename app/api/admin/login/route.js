import { NextResponse } from "next/server";
import { checkPassword, createSessionToken, cookieOptions, ADMIN_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "Admin password isn't set up yet (ADMIN_PASSWORD env var)." },
      { status: 500 }
    );
  }
  if (!checkPassword(body.password)) {
    return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createSessionToken(), cookieOptions);
  return res;
}
