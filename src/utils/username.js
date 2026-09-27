const userRepository = require("../repositories/user.repository");

// Instagram-style handle derived from the email local-part (before the @):
// lowercased, stripped to [a-z0-9_.], falling back to "user" if that leaves
// nothing (e.g. an email starting with only symbols).
function baseUsernameFromEmail(email) {
  const localPart = String(email).split("@")[0].toLowerCase();
  const cleaned = localPart.replace(/[^a-z0-9_.]/g, "");
  return cleaned || "user";
}

// Appends the first free numeric suffix (2, 3, 4, ...) when the base handle
// is already taken, same as Instagram suggesting "name2" over "name".
async function generateUniqueUsername(email) {
  const base = baseUsernameFromEmail(email);
  let candidate = base;
  let suffix = 1;

  // eslint-disable-next-line no-await-in-loop
  while (await userRepository.findByUsername(candidate)) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }

  return candidate;
}

module.exports = { generateUniqueUsername, baseUsernameFromEmail };
