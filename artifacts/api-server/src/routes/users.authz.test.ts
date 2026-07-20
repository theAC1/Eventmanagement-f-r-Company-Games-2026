import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import type { Server } from "http";

process.env.SESSION_SECRET = "test-secret-for-users-authz-suite-1234567890";

vi.mock("../lib/prisma", () => ({
  prisma: {
    person: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "../lib/prisma";
import { signToken } from "../middlewares/auth";
import usersRouter from "./users";

const mocked = prisma as unknown as {
  person: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

let server: Server;
let baseUrl: string;

const adminToken = () =>
  signToken({ id: "admin-1", name: "Admin", email: null, rolle: "ADMIN" });
const ownerToken = () =>
  signToken({ id: "owner-1", name: "Owner", email: null, rolle: "OWNER" });

async function call(method: string, path: string, token: string, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/users", usersRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  if (addr && typeof addr === "object") baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterEach(() => vi.clearAllMocks());

describe("user-management authorization", () => {
  it("forbids a non-owner ADMIN from creating users (403)", async () => {
    const res = await call("POST", "/api/users", adminToken(), {
      name: "X", username: "xx", rolle: "SCHIEDSRICHTER",
    });
    expect(res.status).toBe(403);
  });

  it("forbids a non-owner ADMIN from resetting activation (403)", async () => {
    const res = await call("POST", "/api/users/some-id/reset-activation", adminToken());
    expect(res.status).toBe(403);
  });

  it("forbids a non-owner ADMIN from updating a user (403)", async () => {
    const res = await call("PUT", "/api/users/some-id", adminToken(), { istAktiv: false });
    expect(res.status).toBe(403);
    expect(mocked.person.update).not.toHaveBeenCalled();
  });

  it("forbids a non-owner ADMIN from deleting a user (403)", async () => {
    const res = await call("DELETE", "/api/users/some-id", adminToken());
    expect(res.status).toBe(403);
    expect(mocked.person.delete).not.toHaveBeenCalled();
  });

  it("blocks deactivating the OWNER account even as OWNER (400)", async () => {
    mocked.person.findUnique.mockResolvedValue({
      id: "owner-1", rolle: "OWNER", username: "owner", istAktiv: true,
    });
    const res = await call("PUT", "/api/users/owner-1", ownerToken(), { istAktiv: false });
    expect(res.status).toBe(400);
    expect(mocked.person.update).not.toHaveBeenCalled();
  });

  it("blocks deleting the OWNER account even as OWNER (400)", async () => {
    mocked.person.findUnique.mockResolvedValue({ id: "owner-1", rolle: "OWNER" });
    const res = await call("DELETE", "/api/users/owner-1", ownerToken());
    expect(res.status).toBe(400);
    expect(mocked.person.delete).not.toHaveBeenCalled();
  });

  it("rejects a weak password on update as OWNER (400)", async () => {
    mocked.person.findUnique.mockResolvedValue({
      id: "u-2", rolle: "SCHIEDSRICHTER", username: "sr", istAktiv: true,
    });
    const res = await call("PUT", "/api/users/u-2", ownerToken(), { password: "weak" });
    expect(res.status).toBe(400);
    expect(mocked.person.update).not.toHaveBeenCalled();
  });

  it("allows OWNER to create a user and returns a one-time activation code (201)", async () => {
    mocked.person.findUnique.mockResolvedValue(null);
    mocked.person.findFirst.mockResolvedValue(null);
    mocked.person.create.mockResolvedValue({
      id: "new-1", name: "N", email: null, username: "newsr", rolle: "SCHIEDSRICHTER",
      istAktiv: true, mussPasswortAendern: true, createdAt: new Date().toISOString(),
    });
    const res = await call("POST", "/api/users", ownerToken(), {
      name: "N", username: "newsr", rolle: "SCHIEDSRICHTER",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(typeof body.aktivierungsCode).toBe("string");
    expect(body.aktivierungsCode.length).toBe(12);
  });
});
