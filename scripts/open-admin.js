/**
 * Admin Panel Entry Point:
 * Verifies admin account, starts backend server (if not already running),
 * displays login credentials, and automatically launches the Admin Panel in the browser.
 *
 * Usage:
 *   npm run admin
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const net = require("net");
const { exec } = require("child_process");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { generateUniqueUsername } = require("../src/utils/username");

const prisma = new PrismaClient();
const PORT = parseInt(process.env.PORT || "5050", 10);
const ADMIN_URL = `http://localhost:${PORT}/admin`;
const ADMIN_EMAIL = "admin@fitnerve.in";
const ADMIN_PASSWORD = "Admin@1234";

function openBrowser(url) {
  const platform = process.platform;
  let command = "";
  if (platform === "win32") {
    command = `start "" "${url}"`;
  } else if (platform === "darwin") {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }
  exec(command, () => {});
}

function printAdminBanner() {
  console.log("\n=======================================================");
  console.log("             FITNERVE ADMIN PANEL READY                ");
  console.log("=======================================================");
  console.log(`  Admin URL : ${ADMIN_URL}`);
  console.log(`  Email     : ${ADMIN_EMAIL}`);
  console.log(`  Password  : ${ADMIN_PASSWORD}`);
  console.log("=======================================================\n");
}

async function ensureAdminUser() {
  try {
    const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (!existing) {
      console.log(`Creating default admin user (${ADMIN_EMAIL})...`);
      const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);
      const username = await generateUniqueUsername(ADMIN_EMAIL);
      await prisma.user.create({
        data: {
          fullName: "Super Admin",
          email: ADMIN_EMAIL,
          username,
          passwordHash,
          role: "ADMIN",
          isActive: true,
          isEmailVerified: true,
          profile: { create: {} }
        }
      });
      console.log("Default admin account created successfully.");
    } else {
      console.log(`Admin user confirmed: ${ADMIN_EMAIL}`);
    }
  } catch (err) {
    console.warn("⚠️  Could not verify/create admin user in database:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

function checkPortRunning(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      resolve(false);
    });
    socket.connect(port, "127.0.0.1");
  });
}

async function main() {
  await ensureAdminUser();

  const isRunning = await checkPortRunning(PORT);
  if (isRunning) {
    console.log(`FitNerve backend is already running on port ${PORT}.`);
    printAdminBanner();
    console.log(`Opening ${ADMIN_URL} in browser...`);
    openBrowser(ADMIN_URL);
    return;
  }

  printAdminBanner();
  console.log(`Starting FitNerve Backend and opening Admin portal...`);

  // Start the server
  require("../src/server");

  // Give server a moment to bind and open browser
  setTimeout(() => {
    openBrowser(ADMIN_URL);
  }, 1000);
}

main().catch((err) => {
  console.error("Error launching admin entry point:", err);
  process.exit(1);
});
