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
  const rate = isFounder ? config.hotelRateFounder ?? 399 : config.hotelRateStandard ?? 549;

  const base = `Hotel: you'll be staying at the host hotel The William Vale in Williamsburg for ${count} ${nightWord} (${dates}). Your group rate is $${rate}/night.`;

  if (!config.hotelBookingUrl) {
    return `${base} A booking link is coming in a separate email.`;
  }
  return `${base} Book your room here: [reserve your stay](${config.hotelBookingUrl}). One heads-up: the booking page won't display a price — that's expected. Your $${rate}/night rate is arranged directly with the hotel and applied to your final bill.`;
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
/* Send an attendee their personal matchmaking ("Meet people") link — used by
   the self-serve "email me my link" recovery flow. */
export async function sendMeetLink({ email, name, link }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONFIRM_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false, skipped: true, error: "Resend not configured" };
  const hi = name ? `Hi ${name.split(" ")[0]},` : "Hi,";
  const text = `${hi}

Here's your personal link to set up your Founders Week profile and see who to meet:

${link}

This link is just for you — it signs you in, so please don't forward it.

See you in Brooklyn,
The Flybridge team`;
  const html = `<p>${hi}</p><p>Here's your personal link to set up your Founders Week profile and see who to meet:</p><p><a href="${link}">Open my Meet People page</a></p><p>This link is just for you — it signs you in, so please don't forward it.</p><p>See you in Brooklyn,<br>The Flybridge team</p>`;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: "Your Founders Week connections link",
      html,
      text,
    });
    if (error) return { sent: false, error: error.message || String(error) };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e.message || String(e) };
  }
}

/* Auto email when someone receives a meeting request. */
export async function sendMeetRequestEmail({ email, name, fromName, link }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONFIRM_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false, skipped: true };
  const hi = name ? `Hi ${name.split(" ")[0]},` : "Hi,";
  const who = fromName ? `${fromName} would like to meet you` : "Someone would like to meet you";
  const text = `${hi}

${who} at Founders Week. Open your link to see the request and say yes:

${link}

See you in Brooklyn,
The Flybridge team`;
  const html = `<p>${hi}</p><p>${who} at Founders Week. Open your link to see the request and say yes:</p><p><a href="${link}">See who wants to meet you</a></p><p>See you in Brooklyn,<br>The Flybridge team</p>`;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: `${fromName || "Someone"} wants to meet you at Founders Week`,
      html,
      text,
    });
    return error ? { sent: false, error: error.message || String(error) } : { sent: true };
  } catch (e) {
    return { sent: false, error: e.message || String(e) };
  }
}

/* "You've got intros waiting" nudge (admin-triggered). */
export async function sendMatchNudge({ email, name, link }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONFIRM_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false, skipped: true };
  const hi = name ? `Hi ${name.split(" ")[0]},` : "Hi,";
  const text = `${hi}

The Flybridge team lined up a few people for you to meet at Founders Week. Open your link to see your matches, set up your profile, and say hello:

${link}

See you in Brooklyn,
The Flybridge team`;
  const html = `<p>${hi}</p><p>The Flybridge team lined up a few people for you to meet at Founders Week. Open your link to see your matches, set up your profile, and say hello:</p><p><a href="${link}">See who you should meet</a></p><p>See you in Brooklyn,<br>The Flybridge team</p>`;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: "You've got intros waiting at Founders Week",
      html,
      text,
    });
    return error ? { sent: false, error: error.message || String(error) } : { sent: true };
  } catch (e) {
    return { sent: false, error: e.message || String(e) };
  }
}

/* "New matches for you" nudge for people already opted in (admin-triggered). */
export async function sendMatchUpdate({ email, name, link }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONFIRM_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false, skipped: true };
  const hi = name ? `Hi ${name.split(" ")[0]},` : "Hi,";
  const text = `${hi}

More people have opted in since you set up your profile, so you've got new people worth meeting at Founders Week. Open your link to see your latest matches:

${link}

See you in Brooklyn,
The Flybridge team`;
  const html = `<p>${hi}</p><p>More people have opted in since you set up your profile, so you've got new people worth meeting at Founders Week. Open your link to see your latest matches:</p><p><a href="${link}">See your latest matches</a></p><p>See you in Brooklyn,<br>The Flybridge team</p>`;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: "New matches for you at Founders Week",
      html,
      text,
    });
    return error ? { sent: false, error: error.message || String(error) } : { sent: true };
  } catch (e) {
    return { sent: false, error: e.message || String(e) };
  }
}

/* Email a published update to many guests at once. Each guest gets
   their own message (no shared To: list), sent through Resend's batch
   API 100 at a time. Returns { attempted, sent, failures }. */
export async function sendBroadcast({ recipients, subject, text, author }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONFIRM_FROM_EMAIL;
  if (!apiKey || !from) return { attempted: 0, sent: 0, failures: [], error: "Resend not configured" };
  const url = appUrl();
  const resend = new Resend(apiKey);
  const messages = recipients.map((a) => {
    const first = a.firstName || a.roster?.firstName || (a.name || "").split(" ")[0] || "";
    const body =
      `${first ? `Hi ${first},` : "Hi,"}\n\n${text}\n\n— ${author}` +
      (url ? `\n\n[Open the Founders Week app](${url})` : "");
    return { from, to: a.email, subject, html: toHtml(body), text: toPlain(body) };
  });

  let sent = 0;
  const failures = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const { error } = await resend.batch.send(chunk);
      if (error) chunk.forEach((m) => failures.push({ email: m.to, error: error.message || String(error) }));
      else sent += chunk.length;
    } catch (e) {
      chunk.forEach((m) => failures.push({ email: m.to, error: e.message || String(e) }));
    }
  }
  return { attempted: messages.length, sent, failures };
}

/* Survey-reminder email to a checked-in attendee. Returns the Resend
   message id on success so the follow-up ("non-openers") send can look
   up who opened it. `intro` is the one editable paragraph; the greeting,
   link and sign-off are standard. */
export async function sendSurveyReminder({ email, firstName, subject, intro }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONFIRM_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false, skipped: true, error: "Resend not configured" };
  const url = appUrl();
  const link = `${url}/?view=feedback`;
  const hi = firstName ? `Hi ${firstName},` : "Hi,";
  const text = `${hi}\n\n${intro}\n\n[Share your feedback](${link})\n\n— The Flybridge team`;
  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: email,
      subject,
      html: toHtml(text),
      text: toPlain(text),
    });
    if (error) return { sent: false, error: error.message || String(error) };
    return { sent: true, id: data?.id || null };
  } catch (e) {
    return { sent: false, error: e.message || String(e) };
  }
}

/* Send the survey reminder to many recipients through Resend's batch
   API (up to 100 per request), which keeps us well under the per-second
   rate limit. `recipients` is [{ email, firstName }]. Returns a result
   per recipient in the same order: { email, sent, id?, error? }. */
export async function sendSurveyReminderBatch({ recipients, subject, intro }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONFIRM_FROM_EMAIL;
  if (!apiKey || !from) {
    return recipients.map((r) => ({ email: r.email, sent: false, error: "Resend not configured" }));
  }
  const link = `${appUrl()}/?view=feedback`;
  const resend = new Resend(apiKey);
  const build = (r) => {
    const hi = r.firstName ? `Hi ${r.firstName},` : "Hi,";
    const text = `${hi}\n\n${intro}\n\n[Share your feedback](${link})\n\n— The Flybridge team`;
    return { from, to: r.email, subject, html: toHtml(text), text: toPlain(text) };
  };
  const out = [];
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100);
    if (i > 0) await new Promise((res) => setTimeout(res, 700)); // stay under 2 req/s
    try {
      const { data, error } = await resend.batch.send(chunk.map(build));
      if (error) {
        chunk.forEach((r) => out.push({ email: r.email, sent: false, error: error.message || String(error) }));
      } else {
        const ids = (data && data.data) || [];
        chunk.forEach((r, j) => out.push({ email: r.email, sent: true, id: ids[j]?.id || null }));
      }
    } catch (e) {
      chunk.forEach((r) => out.push({ email: r.email, sent: false, error: e.message || String(e) }));
    }
  }
  return out;
}

/* Did a previously-sent Resend message get opened? Uses the message id
   returned at send time. Requires "Open tracking" enabled on the Resend
   domain — otherwise last_event never reaches "opened" and this returns
   false (so the follow-up would treat everyone as a non-opener). */
export async function getEmailOpened(id) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !id) return false;
  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.get(id);
    if (error || !data) return false;
    const ev = String(data.last_event || "").toLowerCase();
    return ev === "opened" || ev === "clicked";
  } catch {
    return false;
  }
}

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
