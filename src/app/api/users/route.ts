import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { UserCreateSchema, zodValidationError } from "@/lib/schemas";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  rolle: true,
  istAktiv: true,
  createdAt: true,
} as const;

// GET /api/users
export async function GET() {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  const users = await prisma.person.findMany({
    select: USER_SELECT,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

// POST /api/users
export async function POST(req: Request) {
  const { error } = await requireRole("ADMIN");
  if (error) return error;

  const body = await req.json();
  const parsed = UserCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(zodValidationError(parsed.error), { status: 400 });
  }

  const { name, email, username, password, rolle } = parsed.data;

  const existing = await prisma.person.findUnique({
    where: { username },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Benutzername ist bereits vergeben." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.person.create({
    data: {
      name,
      email: email || null,
      username,
      passwordHash,
      rolle,
    },
    select: USER_SELECT,
  });

  return NextResponse.json(user, { status: 201 });
}
