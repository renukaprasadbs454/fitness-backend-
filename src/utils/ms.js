const UNITS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

/**
 * Parses simple duration strings like "15m", "30d", "12h" into milliseconds.
 * Falls back to treating a plain number string as milliseconds.
 */
function ms(input) {
  if (typeof input === "number") return input;
  const match = /^(\d+)([smhd])$/.exec(String(input).trim());
  if (!match) {
    const asNumber = Number(input);
    if (!Number.isNaN(asNumber)) return asNumber;
    throw new Error(`Invalid duration string: ${input}`);
  }
  const [, amount, unit] = match;
  return Number(amount) * UNITS[unit];
}

module.exports = ms;
