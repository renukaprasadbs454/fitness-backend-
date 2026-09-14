const { z } = require("zod");

const exchange = {
  body: z.object({
    platform: z.enum(["ANDROID", "IOS", "WEB"]),
    code: z.string().min(1, "code is required"),
    codeVerifier: z.string().min(1, "codeVerifier is required"),
    redirectUri: z.string().url()
  })
};

module.exports = { exchange };
