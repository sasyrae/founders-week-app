"use client";
import SpeakerAvatar from "./SpeakerAvatar";

export default function Speakers({ config, onSpeakerClick }) {
  const speakers = config.speakers || [];

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
          {speakers.map((s) => (
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
                <div className="fw-spkrole">{[s.title, s.company].filter(Boolean).join(" · ")}</div>
              )}
              {s.bio && <div className="fw-spkbio">{s.bio}</div>}
              {s.link && (
                <a
                  className="fw-spklink"
                  href={s.link}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  Profile ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
