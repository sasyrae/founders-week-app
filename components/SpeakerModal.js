"use client";
import { useEffect } from "react";
import SpeakerAvatar from "./SpeakerAvatar";
import { fmtTime, profileCta } from "@/lib/utils";

/* A lightweight bio popover for a speaker, opened from a session chip or
   the Speakers page. Shows their details, the sessions they're on, and a
   profile link. */
export default function SpeakerModal({ speaker, sessions, days, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const theirs = (sessions || [])
    .filter((s) => (s.speakerIds || []).includes(speaker.id))
    .sort((a, b) => (a.day + a.start).localeCompare(b.day + b.start));
  const dayOf = (id) => (days || []).find((d) => d.id === id);

  return (
    <div className="fw-modal-overlay" onClick={onClose}>
      <div className="fw-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="fw-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14 }}>
          <SpeakerAvatar speaker={speaker} size={72} />
          <div>
            <div className="fw-spkname" style={{ fontSize: 20, marginTop: 0 }}>
              {speaker.name}
            </div>
            {(speaker.title || speaker.company) && (
              <div className="fw-spkrole">
                {[speaker.title, speaker.company].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </div>

        {speaker.bio ? (
          <p className="fw-p" style={{ fontSize: 14 }}>
            {speaker.bio}
          </p>
        ) : (
          <p className="fw-muted" style={{ marginBottom: 14 }}>
            Bio coming soon.
          </p>
        )}

        {theirs.length > 0 && (
          <>
            <div className="fw-label" style={{ margin: "6px 0 6px" }}>
              Speaking at
            </div>
            {theirs.map((s) => (
              <div className="fw-editrow" key={s.id} style={{ gridTemplateColumns: "76px 1fr" }}>
                <span className="fw-mono">{fmtTime(s.start)}</span>
                <span>
                  <strong>{s.title}</strong>
                  {dayOf(s.day) && (
                    <span className="fw-muted"> · {dayOf(s.day).date.split(",")[0]}</span>
                  )}
                </span>
              </div>
            ))}
          </>
        )}

        {speaker.link && (
          <a
            className="fw-primary fw-slackbtn"
            href={speaker.link}
            target="_blank"
            rel="noreferrer"
            style={{ marginTop: 18 }}
          >
            {profileCta(speaker.link)} ↗
          </a>
        )}
      </div>
    </div>
  );
}
