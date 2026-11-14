const test = require("node:test");
const assert = require("node:assert/strict");
const validate = require("../src/middlewares/validate.middleware");
const authSchemas = require("../src/validators/auth.validator");

function runValidation(schemas, req) {
  let error = null;
  let continued = false;
  validate(schemas)(req, {}, (nextError) => {
    error = nextError || null;
    continued = !nextError;
  });
  return { error, continued };
}

test("registration validation normalizes email and supplies the public USER role default", () => {
  const req = { body: {
    fullName: "  Fit Nerve User  ",
    email: "  PERSON@EXAMPLE.COM ",
    password: "SecurePass1",
    privacyNoticeAccepted: true,
    privacyNoticeVersion: "2026-11",
    termsAccepted: true,
    termsVersion: "terms-2026-11"
  } };
  const result = runValidation(authSchemas.register, req);

  assert.equal(result.error, null);
  assert.equal(result.continued, true);
  assert.equal(req.body.fullName, "Fit Nerve User");
  assert.equal(req.body.email, "person@example.com");
  assert.equal(req.body.role, "USER");
});

test("registration returns a readable affirmative privacy notice error", () => {
  const req = { body: {
    fullName: "Fit Nerve User",
    email: "person@example.com",
    password: "SecurePass1",
    privacyNoticeAccepted: false,
    privacyNoticeVersion: "2026-11",
    termsAccepted: true,
    termsVersion: "terms-2026-11"
  } };
  const result = runValidation(authSchemas.register, req);

  assert.equal(result.continued, false);
  assert.equal(result.error.statusCode, 400);
  assert.equal(result.error.details[0].field, "privacyNoticeAccepted");
  assert.equal(result.error.details[0].message, "Please review and accept the FitNerve privacy notice to create an account.");
});

test("registration requires affirmative acceptance of the current terms", () => {
  const req = { body: {
    fullName: "Fit Nerve User", email: "person@example.com", password: "SecurePass1",
    privacyNoticeAccepted: true, privacyNoticeVersion: "2026-11",
    termsAccepted: false, termsVersion: "terms-2026-11"
  } };
  const result = runValidation(authSchemas.register, req);
  assert.equal(result.continued, false);
  assert.equal(result.error.statusCode, 400);
  assert.equal(result.error.details[0].field, "termsAccepted");
});
