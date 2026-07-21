const { z } = require("zod");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number");

const register = {
  body: z.object({
    fullName: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email(),
    phone: z.string().trim().min(7).max(20).optional(),
    password: passwordSchema,
    role: z.enum(["USER", "COACH"]).optional().default("USER")
  })
};

const login = {
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1, "Password is required")
  })
};

const refresh = {
  body: z.object({
    refreshToken: z.string().min(1, "refreshToken is required")
  })
};

const logout = {
  body: z.object({
    refreshToken: z.string().min(1, "refreshToken is required")
  })
};

const forgotPassword = {
  body: z.object({
    email: z.string().trim().toLowerCase().email()
  })
};

const resetPassword = {
  body: z.object({
    token: z.string().min(1, "token is required"),
    newPassword: passwordSchema
  })
};

module.exports = { register, login, refresh, logout, forgotPassword, resetPassword };
