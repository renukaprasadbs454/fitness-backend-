const swaggerJsdoc = require("swagger-jsdoc");
const env = require("../config/env");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "FitNerve API — Phase 1 + Phase 2 + Phase 3 (Admin)",
      version: "1.3.0",
      description:
        "**How to authorize:** call `POST /auth/login` below with your email and password (use Try it out). " +
        "The access token from the response is applied automatically and kept across page reloads, so every " +
        "lock-icon endpoint can then be tried directly. You can also click **Authorize** and paste a token " +
        "yourself (paste the token only, without the word `Bearer`). Access tokens expire after 15 minutes; " +
        "calling `POST /auth/refresh` re-authorizes automatically. Admin-only endpoints need an ADMIN account.\n\n" +
        "Authentication, User Profile, Coach Module, Uploads (Phase 1); BMI, Calorie, Activity/Steps, Progress Tracker, Workouts, Appointments, Calendar (Phase 2); Real-time Chat (Socket.io), Push Notifications (FCM), Content Management, Admin Analytics Dashboard, and an enhanced Workout Recommendation engine (Phase 3); plus admin-only user/coach management, dashboard stats, and audit logging (Admin Portal) for the FitNerve fitness platform."
    },
    servers: [{ url: `/api/${env.apiVersion}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
      },
      schemas: {
        RegisterRequest: {
          type: "object",
          required: ["fullName", "email", "password"],
          properties: {
            fullName: { type: "string", example: "Bobby Mathews" },
            email: { type: "string", example: "bobby@example.com" },
            phone: { type: "string", example: "+919876543210" },
            password: { type: "string", example: "StrongPass1" },
            role: { type: "string", enum: ["USER", "COACH"], example: "USER" }
          }
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string" },
            password: { type: "string" }
          }
        },
        RefreshRequest: {
          type: "object",
          required: ["refreshToken"],
          properties: { refreshToken: { type: "string" } }
        },
        ForgotPasswordRequest: {
          type: "object",
          required: ["email"],
          properties: { email: { type: "string" } }
        },
        ResetPasswordRequest: {
          type: "object",
          required: ["email", "code", "newPassword"],
          properties: {
            email: { type: "string" },
            code: { type: "string", example: "123456" },
            newPassword: { type: "string" }
          }
        },
        VerifyEmailRequest: {
          type: "object",
          required: ["email", "code"],
          properties: {
            email: { type: "string" },
            code: { type: "string", example: "123456" }
          }
        },
        ResendOtpRequest: {
          type: "object",
          required: ["email", "purpose"],
          properties: {
            email: { type: "string" },
            purpose: { type: "string", enum: ["REGISTRATION", "PASSWORD_RESET"] }
          }
        },
        PackageRequest: {
          type: "object",
          required: ["name", "durationMonths", "price", "originalPrice"],
          properties: {
            name: { type: "string", example: "Quarterly" },
            tagline: { type: "string", example: "Build the habit" },
            durationMonths: { type: "integer", example: 3 },
            price: { type: "number", example: 3499 },
            originalPrice: { type: "number", example: 5997 },
            features: { type: "array", items: { type: "string" }, example: ["2 coach sessions included"] },
            badge: { type: "string", example: "MOST POPULAR" },
            isActive: { type: "boolean" },
            sortOrder: { type: "integer" }
          }
        },
        UpdateProfileRequest: {
          type: "object",
          properties: {
            fullName: { type: "string" },
            heightCm: { type: "number", example: 173 },
            weightKg: { type: "number", example: 88 },
            age: { type: "integer", example: 27 },
            gender: {
              type: "string",
              enum: ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]
            },
            goal: {
              type: "string",
              enum: [
                "WEIGHT_LOSS",
                "MUSCLE_GAIN",
                "STRENGTH",
                "ENDURANCE",
                "GENERAL_FITNESS",
                "REHAB"
              ]
            }
          }
        }
      }
    }
  },
  apis: ["./src/routes/v1/*.js"]
};

const spec = swaggerJsdoc(options);

// Every endpoint requires a Bearer token unless it is explicitly public.
// Applying this globally (instead of relying on each route's own `security`
// annotation) means no protected endpoint can be left without the lock icon,
// and Swagger UI attaches the Authorize token to all of them.
const PUBLIC_PATHS = [/^\/auth\//, /^\/health$/];

spec.security = [{ bearerAuth: [] }];
for (const [route, operations] of Object.entries(spec.paths || {})) {
  if (!PUBLIC_PATHS.some((re) => re.test(route))) continue;
  for (const operation of Object.values(operations)) {
    if (operation && typeof operation === "object") operation.security = [];
  }
}

module.exports = spec;
