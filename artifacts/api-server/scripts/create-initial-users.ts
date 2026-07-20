// One-off script: create initial user accounts with activation codes.
// Run: node scripts/create-initial-users.ts (from artifacts/api-server)
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../src/lib/prisma.ts";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
function generateActivationCode(): string {
  const bytes = crypto.randomBytes(12);
  let code = "";
  for (let i = 0; i < 12; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

const users: { name: string; username: string; rolle: "OWNER" | "ADMIN" }[] = [
  { name: "Juan", username: "juan", rolle: "OWNER" },
  { name: "Luca", username: "luca", rolle: "ADMIN" },
  { name: "Gian", username: "gian", rolle: "ADMIN" },
  { name: "Levin", username: "levin", rolle: "ADMIN" },
  { name: "Roger", username: "roger", rolle: "ADMIN" },
  { name: "Rahel", username: "rahel", rolle: "ADMIN" },
  { name: "Lea", username: "lea", rolle: "ADMIN" },
  { name: "Sven", username: "sven", rolle: "ADMIN" },
];

async function main() {
  for (const u of users) {
    const existing = await prisma.person.findUnique({ where: { username: u.username } });
    if (existing) {
      console.log(`SKIP ${u.username} (existiert bereits)`);
      continue;
    }
    const code = generateActivationCode();
    const codeHash = await bcrypt.hash(code, 12);
    await prisma.person.create({
      data: {
        name: u.name,
        username: u.username,
        rolle: u.rolle,
        aktivierungsCode: codeHash,
        mussPasswortAendern: true,
      },
    });
    console.log(`CREATED ${u.name} (${u.username}, ${u.rolle}) — Aktivierungscode: ${code}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
