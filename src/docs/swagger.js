const swaggerJsdoc = require("swagger-jsdoc");
const env = require("../config/env");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "FitNerve API — Phase 1 + Phase 2 + Phase 3 (Admin)",
      version: "1.3.0",
      description:
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

module.exports = swaggerJsdoc(options);
