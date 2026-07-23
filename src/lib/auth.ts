import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { ROLE_HIERARCHY, hasMinRole } from "./roles";
import { checkRateLimit } from "./rate-limit";

export { ROLE_HIERARCHY, hasMinRole };

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Login",
      credentials: {
        username: { label: "Benutzername", type: "text" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) return null;

        // Brute-Force-Schutz: pro IP (hinter Nginx via x-forwarded-for)
        // und pro Benutzername limitieren
        const ip =
          (req?.headers?.["x-forwarded-for"] as string | undefined)
            ?.split(",")[0]
            ?.trim() ?? "unknown";
        if (
          !checkRateLimit(`login-ip:${ip}`) ||
          !checkRateLimit(`login-user:${credentials.username.toLowerCase()}`)
        ) {
          throw new Error("Zu viele Anmeldeversuche. Bitte später erneut versuchen.");
        }

        const person = await prisma.person.findUnique({
          where: { username: credentials.username },
        });

        if (!person || !person.istAktiv) return null;

        // Account noch nicht aktiviert: Eingabe des Aktivierungscodes als
        // Passwort leitet zur Aktivierungsseite (Erstanmeldung)
        if (person.mussPasswortAendern && person.aktivierungsCode) {
          const codeValid = await bcrypt.compare(
            credentials.password,
            person.aktivierungsCode,
          );
          if (codeValid) {
            throw new Error("ACTIVATION_REQUIRED");
          }
          return null;
        }

        if (!person.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password, person.passwordHash);
        if (!valid) return null;

        return {
          id: person.id,
          name: person.name,
          email: person.email,
          rolle: person.rolle,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rolle = user.rolle;
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id,
          rolle: token.rolle,
        },
      };
    },
  },
  pages: {
    signIn: "/login",
  },
};
