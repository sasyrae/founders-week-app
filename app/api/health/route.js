import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/* Lightweight setup check: reports which integrations are configured
   (booleans only — never any secret values). Handy for confirming a
   deploy picked up its environment variables. */
export function GET() {
  return NextResponse.json({
    ok: true,
    supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    resend: !!(process.env.RESEND_API_KEY && process.env.CONFIRM_FROM_EMAIL),
    adminAuth: !!(process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET),
    slack: !!process.env.SLACK_WEBHOOK_URL,
  });
}
