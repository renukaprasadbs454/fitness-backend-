// Centralizes IST (Asia/Kolkata, UTC+05:30, no DST) timestamp formatting so
// every log line and API response represents time the same way.
//
// Overriding Date#toJSON only changes how a Date is *rendered* when
// JSON.stringify'd (i.e. every `res.json(...)` response) — the underlying
// instant (Date#getTime()) is untouched, so Prisma queries/comparisons and
// JWT's numeric exp/iat timestamps are unaffected.
function toIstIsoString(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const ms = String(date.getMilliseconds()).padStart(3, "0");

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}.${ms}+05:30`;
}

// eslint-disable-next-line no-extend-native
Date.prototype.toJSON = function toJSON() {
  return toIstIsoString(this);
};

module.exports = { toIstIsoString };
