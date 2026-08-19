/**
 * One-time script: promote an existing USER account to COACH and create
 * the matching Coach profile row (registration normally does both together;
 * a plain role UPDATE alone leaves the account without a Coach row, which
 * breaks GET /coaches/me).
 *
 * Usage: node scripts/make-coach.js <email>
 */

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: node scripts/make-coach.js <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { coach: true } });

  if (!user) {
    console.error(`❌ No user found with email: ${email}`);
    process.exit(1);
  }

  if (user.role !== "COACH") {
    await prisma.user.update({ where: { id: user.id }, data: { role: "COACH" } });
  }

  if (!user.coach) {
    await prisma.coach.create({ data: { userId: user.id, specialties: [] } });
  }

  console.log("\n✅  Account is now a COACH");
  console.log(`   Email: ${email}`);
  console.log(`   Role : COACH`);
  console.log(`   Coach profile: ${user.coach ? "already existed" : "created"}\n`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
