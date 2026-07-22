/* Pure helpers safe for both client and server (no secrets, no db). */

export const fmtTime = (t) => {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
};

export const fmtWhen = (iso) => {
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

export const uid = () => "x" + Math.random().toString(36).slice(2, 9);

export const normalizeEmail = (email) => (email || "").trim().toLowerCase();
