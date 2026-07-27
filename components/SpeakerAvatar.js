"use client";

/* A speaker's headshot if uploaded, otherwise a monogram of their initials
   in the app's house style. `size` is in pixels. */
export default function SpeakerAvatar({ speaker, size = 64 }) {
  const initials =
    (speaker.name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "•";

  if (speaker.photoUrl) {
    return (
      <img
        className="fw-spkimg"
        src={speaker.photoUrl}
        alt={speaker.name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="fw-spkmono"
      aria-label={speaker.name}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </div>
  );
}
