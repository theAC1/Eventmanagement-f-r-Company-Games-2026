import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    rolle: string;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string | null;
      rolle: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    rolle: string;
  }
}
