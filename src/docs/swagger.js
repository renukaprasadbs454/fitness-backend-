const swaggerJsdoc = require("swagger-jsdoc");
const env = require("../config/env");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "FitNerve API — Phase 1",
      version: "1.0.0",
      description:
        "Authentication, User Profile, Coach Module, and Image Upload endpoints for the FitNerve fitness platform (Phase 1 scope only)."
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
          required: ["token", "newPassword"],
          properties: {
            token: { type: "string" },
            newPassword: { type: "string" }
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
