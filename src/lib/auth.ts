import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

// Rollen-Hierarchie: ADMIN > ORGA > SCHIEDSRICHTER > HELFER
export const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN: 100,
  ORGA: 50,
  SCHIEDSRICHTER: 20,
  HELFER: 10,
};

export function hasMinRole(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole];
  const requiredLevel = ROLE_HIERARCHY[requiredRole];
  // Unbekannte Rollen werden NICHT durchgelassen
  if (userLevel === undefined || requiredLevel === undefined) return false;
  return userLevel >= requiredLevel;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Login",
      credentials: {
        username: { label: "Benutzername", type: "text" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const person = await prisma.person.findUnique({
          where: { username: credentials.username },
        });

        if (!person || !person.passwordHash || !person.istAktiv) return null;

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
    maxAge: 24 * 60 * 60, // 24 Stunden
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rolle = (user as any).rolle;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).rolle = token.rolle;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
