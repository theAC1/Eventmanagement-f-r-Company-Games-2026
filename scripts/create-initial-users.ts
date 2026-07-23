// Einmal-Script: legt die persönlichen Accounts mit Aktivierungscodes an.
// Bestehende Accounts werden nicht überschrieben, aber ihre Rolle wird auf
// die konfigurierte Ziel-Rolle angehoben (z.B. juan: ADMIN → OWNER).
//
// Ausführen (lokal oder auf dem Server im app-Container):
//   npm run users:init
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../src/lib/prisma";

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
      if (existing.rolle !== u.rolle) {
        await prisma.person.update({ where: { id: existing.id }, data: { rolle: u.rolle } });
        console.log(`UPGRADED ${u.username}: ${existing.rolle} → ${u.rolle} (Passwort unverändert)`);
      } else {
        console.log(`SKIP ${u.username} (existiert bereits als ${u.rolle})`);
      }
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
