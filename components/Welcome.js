"use client";

export default function Welcome({ config, me, goAgenda }) {
  return (
    <main className="fw-main fw-narrow">
      <h2 className="fw-h2">You're in, {me?.firstName || me?.name?.split(" ")[0] || "friend"}. 🎉</h2>
      <p className="fw-p">Two things worth doing right now while you're here:</p>

      <div className="fw-slackcard">
        <div className="fw-slackglyph">#</div>
        <div style={{ flex: 1 }}>
          <div className="fw-sesstitle">Join the community</div>
          <p className="fw-p" style={{ margin: "4px 0 10px" }}>
            {config.slackChannel || "#founders-week"} is where attendees meet before the event,
            coordinate dinner crews, and get real-time updates. Already in the Flybridge founders
            Slack? Just search for the channel.
          </p>
          {config.slackInviteUrl && (
            <a
              className="fw-primary fw-slackbtn"
              href={config.slackInviteUrl}
              target="_blank"
              rel="noreferrer"
            >
              Join the Slack
            </a>
          )}
        </div>
      </div>

      <div className="fw-slackcard" style={{ boxShadow: "4px 4px 0 var(--green-soft)" }}>
        <div className="fw-slackglyph" style={{ background: "var(--green)" }}>
          ✓
        </div>
        <div style={{ flex: 1 }}>
          <div className="fw-sesstitle">Build your schedule</div>
          <p className="fw-p" style={{ margin: "4px 0 10px" }}>
            Browse all three days and register for the sessions you want — breakouts and a few events
            have limited seats.
          </p>
          <button className="fw-primary fw-slackbtn" onClick={goAgenda}>
            Browse the agenda
          </button>
        </div>
      </div>
    </main>
  );
}
