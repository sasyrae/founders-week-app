import { Resend } from "resend";
import { DEFAULT_SUBJECT, DEFAULT_TEMPLATE } from "./constants";

/* ─────────────────────────────────────────────────────────────
   Transactional email via Resend. Sends the confirmation instantly
   on registration. Server-only.

   The template is authored in plain text with a simple markdown-style
   link syntax — [label](url) — so hosts can edit it safely in Host
   tools without writing HTML. We render an HTML version (real
   hyperlinks) plus a plain-text fallback for every send.
   ───────────────────────────────────────────────────────────── */

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/* Public URL of the app, used for the in-email links. On Vercel,
   VERCEL_PROJECT_PRODUCTION_URL is provided automatically; set
   NEXT_PUBLIC_SITE_URL once the custom domain is live. */
export function appUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "";
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* [label](url) -> <a href="url">label</a>; newlines -> <br>. */
export function toHtml(text) {
  const body = escapeHtml(text)
    .replace(LINK_RE, (_m, label, url) => `<a href="${url}" style="color:#1F49E0;text-decoration:underline;">${label}</a>`)
    .replace(/\n/g, "<br>");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0E1B2C;max-width:600px;">${body}</div>`;
}

/* [label](url) -> "label (url)" for the plain-text fallback. */
export function toPlain(text) {
  return text.replace(LINK_RE, (_m, label, url) => `${label} (${url})`);
}

/* Hotel paragraph. Rate depends on attendee type: Founders get the
   founder rate, LPs/Guests/Team get the standard rate. */
function buildHotelNote(config, a) {
  if (a.hotel !== "yes") {
    return "Staying elsewhere? No problem — everything happens at The William Vale, an easy trip from anywhere in Williamsburg.";
  }
  const nights = a.hotelNights || [];
  const count = nights.length;
  const nightWord = count === 1 ? "night" : "nights";
  const dates = nights.join(", ");
  const isFounder = a.type === "Founder";
  const rate = isFounder
    ? config.hotelRateFounder ?? 349
    : config.hotelRateStandard ?? 549;

  const base = `Hotel: you'll be staying at the host hotel The William Vale in Williamsburg for ${count} ${nightWord} (${dates}). We have negotiated a room rate of $${rate}/night`;

  return config.hotelBookingUrl
    ? `${base}, please use [this link](${config.hotelBookingUrl}) to book your stay.`
    : `${base} — a booking link is coming in a separate email.`;
}

/* Fill the confirmation template. `config._sessions` should hold the
   full sessions list so {sessions} can resolve titles. */
export function fillConfirmation(config, a, template) {
  const url = appUrl();

  const days =
    (a.attending || [])
      .map((id) => {
        const d = (config.days || []).find((x) => x.id === id);
        return d ? `• ${d.label} (${d.date})` : "";
      })
      .filter(Boolean)
      .join("\n") || "• (no days selected)";

  const sessions =
    (a.sessions || [])
      .map((sid) => {
        const s = (config._sessions || []).find((x) => x.id === sid);
        return s ? `• ${s.title}` : "";
      })
      .filter(Boolean)
      .join("\n") ||
    (url
      ? `• None yet — [browse the agenda](${url}) to add sessions`
      : "• None yet — browse the agenda to add sessions");

  const slackChannel = config.slackChannel || "#founders-week-2026";
  const slackUrl = config.slackInviteUrl || "";

  return template
    .replaceAll("{firstName}", a.firstName || (a.name || "").split(" ")[0] || "there")
    .replaceAll("{days}", days)
    .replaceAll("{sessions}", sessions)
    .replaceAll("{hotelNote}", buildHotelNote(config, a))
    .replaceAll("{slackChannel}", slackChannel)
    .replaceAll("{slackUrl}", slackUrl)
    .replaceAll("{appUrl}", url)
    .replaceAll("{slack}", slackUrl); // legacy placeholder
}

/* Send the confirmation email (HTML + plain-text fallback).
   Returns { sent, skipped?, error? }. */
export async function sendConfirmation(config, attendee) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONFIRM_FROM_EMAIL;
  if (!apiKey || !from) {
    return { sent: false, skipped: true, error: "Resend not configured" };
  }
  const subject = config.confirmSubject || DEFAULT_SUBJECT;
  const template = config.confirmTemplate || DEFAULT_TEMPLATE;
  const filled = fillConfirmation(config, attendee, template);
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: attendee.email,
      subject,
      html: toHtml(filled),
      text: toPlain(filled),
    });
    if (error) return { sent: false, error: error.message || String(error) };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e.message || String(e) };
  }
}
