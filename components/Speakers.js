"use client";
import SpeakerAvatar from "./SpeakerAvatar";
import { profileCta } from "@/lib/utils";

export default function Speakers({ config, onSpeakerClick, onSessionClick }) {
  // Alphabetical by last name (then first) for the public lineup.
  const speakers = [...(config.speakers || [])].sort((a, b) => {
    const al = (a.lastName || a.name || "").toLowerCase();
    const bl = (b.lastName || b.name || "").toLowerCase();
    return (
      al.localeCompare(bl) ||
      (a.firstName || "").toLowerCase().localeCompare((b.firstName || "").toLowerCase())
    );
  });

  const sessionsFor = (id) =>
    (config.sessions || [])
      .filter((s) => (s.speakerIds || []).includes(id))
      .sort((a, b) => (a.day + a.start).localeCompare(b.day + b.start));

  return (
    <main className="fw-main">
      <h2 className="fw-h2">Speakers</h2>
      <p className="fw-p">
        The founders, operators, and investors joining us in Brooklyn. More announced as we lock
        them in.
      </p>
      {speakers.length === 0 ? (
        <p className="fw-p">Our lineup is coming together — check back soon.</p>
      ) : (
        <div className="fw-spkgrid">
          {speakers.map((s) => {
            const their = sessionsFor(s.id);
            return (
              <div
                className={"fw-spkcard" + (onSpeakerClick ? " fw-clickable" : "")}
                key={s.id}
                onClick={onSpeakerClick ? () => onSpeakerClick(s) : undefined}
                role={onSpeakerClick ? "button" : undefined}
                tabIndex={onSpeakerClick ? 0 : undefined}
                onKeyDown={
                  onSpeakerClick
                    ? (e) => (e.key === "Enter" || e.key === " ") && onSpeakerClick(s)
                    : undefined
                }
              >
                <SpeakerAvatar speaker={s} size={72} />
                <div className="fw-spkname">{s.name}</div>
                {(s.title || s.company) && (
                  <div className="fw-spkrole">
                    {[s.title, s.company].filter(Boolean).join(" · ")}
                  </div>
                )}
                {s.bio && <div className="fw-spkbio">{s.bio}</div>}
                {their.length > 0 && (
                  <div className="fw-spksess">
                    <span className="fw-spksesslabel">Speaking</span>
                    {their.map((x) =>
                      onSessionClick ? (
                        <button
                          type="button"
                          className="fw-spksesstitle fw-spksesslink"
                          key={x.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSessionClick(x.id);
                          }}
                        >
                          {x.title}
                        </button>
                      ) : (
                        <div className="fw-spksesstitle" key={x.id}>
                          {x.title}
                        </div>
                      )
                    )}
                  </div>
                )}
                {s.link && (
                  <a
                    className="fw-spklink"
                    href={s.link}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {profileCta(s.link)} ↗
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
