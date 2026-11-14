const test = require("node:test");
const assert = require("node:assert/strict");
const { createSocketAuthenticator } = require("../src/sockets/chat.socket");

const fixedNow = new Date("2026-11-13T10:00:00.000Z");
const activeUser = { id: "user-1", role: "USER", isActive: true };

function makeAuth(options = {}) {
  const { payload = { sub: activeUser.id, sid: "session-1" }, user = activeUser } = options;
  const session = Object.hasOwn(options, "session")
    ? options.session
    : { id: "session-1", userId: activeUser.id, revoked: false, expiresAt: new Date("2026-11-14T10:00:00.000Z"), user };
  return createSocketAuthenticator({
    verifyToken: () => payload,
    findUser: async () => user,
    findSession: async () => session,
    now: () => fixedNow
  });
}

test("Socket.IO accepts a valid, active refresh-token session", async () => {
  assert.deepEqual(await makeAuth()("valid-token"), { id: "user-1", role: "USER" });
});

test("Socket.IO rejects a revoked, expired, or mismatched session", async (t) => {
  for (const [name, session] of [
    ["revoked", { id: "session-1", userId: "user-1", revoked: true, expiresAt: new Date("2026-11-14"), user: activeUser }],
    ["expired", { id: "session-1", userId: "user-1", revoked: false, expiresAt: new Date("2026-11-13T09:59:59.000Z"), user: activeUser }],
    ["belongs to another user", { id: "session-1", userId: "user-2", revoked: false, expiresAt: new Date("2026-11-14"), user: activeUser }],
    ["missing", null]
  ]) {
    await t.test(name, async () => {
      await assert.rejects(makeAuth({ session })("valid-token"), /Session has ended/);
    });
  }
});

test("Socket.IO accepts a legacy short-lived token and rejects inactive users", async () => {
  const legacy = makeAuth({ payload: { sub: activeUser.id, sid: undefined } });
  assert.deepEqual(await legacy("legacy-token"), { id: "user-1", role: "USER" });
  await assert.rejects(makeAuth({ user: { ...activeUser, isActive: false } })("valid-token"), /User is inactive/);
});
