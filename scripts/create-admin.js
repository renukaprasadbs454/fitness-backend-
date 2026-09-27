/**
 * One-time script: create an ADMIN user in the database.
 * Usage: node scripts/create-admin.js
 *
 * Credentials created:
 *   Email:    admin@fitnerve.in
 *   Password: Admin@1234
 */

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { generateUniqueUsername } = require("../src/utils/username");

const prisma = new PrismaClient();

const ADMIN_EMAIL    = "admin@fitnerve.in";
const ADMIN_PASSWORD = "Admin@1234";
const ADMIN_NAME     = "Super Admin";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  if (existing) {
    console.log(`\n⚠️  Admin already exists: ${ADMIN_EMAIL}`);
    console.log("   If you forgot the password, delete the user from the DB and re-run.\n");
    return;
  }

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);
  const username = await generateUniqueUsername(ADMIN_EMAIL);

  const user = await prisma.user.create({
    data: {
      fullName:        ADMIN_NAME,
      email:           ADMIN_EMAIL,
      username,
      passwordHash,
      role:            "ADMIN",
      isActive:        true,
      isEmailVerified: true,
      profile:         { create: {} },   // required by schema relation
    },
  });

  console.log("\n✅  Admin user created successfully!");
  console.log(`   Email   : ${user.email}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   Role    : ${user.role}`);
  console.log(`   ID      : ${user.id}\n`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
