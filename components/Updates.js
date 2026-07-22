"use client";
import { useState, useEffect } from "react";
import { api } from "./api";
import { fmtWhen } from "@/lib/utils";

export default function Updates({ config }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    (async () => {
      const r = await api.updates();
      setItems(r.ok ? r.items || [] : []);
    })();
  }, []);
  return (
    <main className="fw-main fw-narrow2">
      <h2 className="fw-h2">Updates</h2>

      <div className="fw-slackcard">
        <div className="fw-slackglyph">#</div>
        <div style={{ flex: 1 }}>
          <div className="fw-sesstitle">Join the conversation on Slack</div>
          <p className="fw-p" style={{ margin: "4px 0 10px" }}>
            Meet other attendees, coordinate dinners, and get real-time updates in{" "}
            {config.slackChannel || "our event channel"}. Already in the Flybridge founders Slack?
            Just search for {config.slackChannel || "the event channel"} and hop in — otherwise, join
            below and you'll land there automatically.
          </p>
          {config.slackInviteUrl ? (
            <a
              className="fw-primary fw-slackbtn"
              href={config.slackInviteUrl}
              target="_blank"
              rel="noreferrer"
            >
              Join the Slack
            </a>
          ) : (
            <span className="fw-muted">The invite link is coming soon — check back here.</span>
          )}
        </div>
      </div>

      {items === null && <p className="fw-p">Loading updates…</p>}
      {items && items.length === 0 && (
        <p className="fw-p">No updates yet. Announcements from the Flybridge team will appear here.</p>
      )}
      {items &&
        [...items]
          .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""))
          .map((a) => (
            <div className="fw-announce" key={a.id}>
              <div className="fw-announcemeta">
                {a.author || "Flybridge team"} · {fmtWhen(a.ts)}
              </div>
              <div className="fw-announcetext">{a.text}</div>
            </div>
          ))}
    </main>
  );
}
