import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { ROLE_HIERARCHY, hasMinRole } from "./roles";

export { ROLE_HIERARCHY, hasMinRole };

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
