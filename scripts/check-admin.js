require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const p = new PrismaClient();

async function run() {
  const u = await p.user.findUnique({ where: { email: "admin@fitnerve.in" } });
  if (!u) {
    console.log("❌ User NOT FOUND in database");
    return;
  }
  console.log("✅ User found:", JSON.stringify({ id: u.id, email: u.email, role: u.role, isActive: u.isActive, hasHash: !!u.passwordHash }));

  const match = await bcrypt.compare("Admin@1234", u.passwordHash);
  console.log("🔐 Password 'Admin@1234' matches hash:", match);
}

run().catch(console.error).finally(() => p.$disconnect());
