const test = require("node:test");
const assert = require("node:assert/strict");
const { isOriginAllowed } = require("../src/utils/corsPolicy");

test("CORS allows non-browser requests without an Origin header", () => {
  assert.equal(isOriginAllowed(undefined), true);
});

test("CORS fails closed when production has no allow-list", () => {
  assert.equal(isOriginAllowed("https://attacker.example", { allowedOrigins: [], allowLocalhost: false }), false);
  assert.equal(isOriginAllowed("http://localhost:3000", { allowedOrigins: [], allowLocalhost: false }), false);
});

test("CORS allows only exact configured origins", () => {
  assert.equal(isOriginAllowed("https://app.fitnerve.com", { allowedOrigins: ["https://app.fitnerve.com"] }), true);
  assert.equal(isOriginAllowed("https://evil.fitnerve.com", { allowedOrigins: ["https://app.fitnerve.com"] }), false);
});

test("CORS supports opted-in loopback previews without opening other origins", () => {
  const policy = { allowedOrigins: [], allowLocalhost: true };
  assert.equal(isOriginAllowed("http://localhost:8081", policy), true);
  assert.equal(isOriginAllowed("https://127.0.0.1:5050", policy), true);
  assert.equal(isOriginAllowed("https://attacker.example", policy), false);
});
