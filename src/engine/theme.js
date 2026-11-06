// src/engine/theme.js
// Site-wide theme selection, mirroring the Codio PHP reference app's theme.php:
// an admin-selectable theme, or "auto" to follow the season by UK calendar date.

export const THEMES = {
  crimson: "Classic (Crimson and Black)",
  spring: "Spring",
  summer: "Summer",
  autumn: "Autumn",
  winter: "Winter",
  halloween: "Halloween",
  christmas: "Christmas",
};
export const STORABLE_THEMES = { auto: "Automatic (by season and date, UK time)", ...THEMES };

const SEASONAL_MESSAGES = {
  spring: "Spring term: a fresh start. Target your weakest topics first.",
  summer: "Summer revision: keep your momentum going before results day.",
  autumn: "Autumn term is here. Build strong revision habits early.",
  winter: "Winter revision: steady practice through the colder months.",
  halloween: "Halloween week: do not let the tricky topics haunt you.",
  christmas: "Festive revision: finish strong before the break.",
};

/** UK calendar month/day for `date`, independent of the server's own timezone. */
function ukMonthDay(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", day: "numeric", month: "numeric",
  }).formatToParts(date);
  return {
    month: Number(parts.find((p) => p.type === "month").value),
    day: Number(parts.find((p) => p.type === "day").value),
  };
}

export function seasonForDate(date = new Date()) {
  const { month, day } = ukMonthDay(date);
  if (month === 10 && day >= 24) return "halloween";
  if (month === 12) return "christmas";
  if ([3, 4, 5].includes(month)) return "spring";
  if ([6, 7, 8].includes(month)) return "summer";
  if ([9, 10, 11].includes(month)) return "autumn";
  return "winter";
}

export function effectiveTheme(stored, date = new Date()) {
  if (stored === "auto") return seasonForDate(date);
  if (Object.prototype.hasOwnProperty.call(THEMES, stored)) return stored;
  return "crimson";
}

export function seasonalMessage(theme) {
  return SEASONAL_MESSAGES[theme] || "";
}
