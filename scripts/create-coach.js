/**
 * One-time script: create the main COACH user in the database, matching
 * the credentials shown on the /coach portal login screen.
 * Usage: node scripts/create-coach.js
 *
 * Credentials created:
 *   Email:    coach@fitnerve.in
 *   Password: Coach@1234
 */

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

const COACH_EMAIL    = "coach@fitnerve.in";
const COACH_PASSWORD = "Coach@1234";
const COACH_NAME     = "Main Coach";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: COACH_EMAIL } });

  if (existing) {
    console.log(`\n⚠️  Coach already exists: ${COACH_EMAIL}`);
    console.log("   If you forgot the password, delete the user from the DB and re-run.\n");
    return;
  }

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
  const passwordHash = await bcrypt.hash(COACH_PASSWORD, saltRounds);

  const user = await prisma.user.create({
    data: {
      fullName:        COACH_NAME,
      email:           COACH_EMAIL,
      passwordHash,
      role:            "COACH",
      isActive:        true,
      isEmailVerified: true,
      profile:         { create: {} },   // required by schema relation
      coach:           { create: { isAcceptingClients: true } },
    },
  });

  console.log("\n✅  Coach user created successfully!");
  console.log(`   Email   : ${user.email}`);
  console.log(`   Password: ${COACH_PASSWORD}`);
  console.log(`   Role    : ${user.role}`);
  console.log(`   ID      : ${user.id}\n`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
