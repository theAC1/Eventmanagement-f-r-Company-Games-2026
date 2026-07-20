import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import type { Server } from "http";

vi.mock("../lib/prisma", () => ({
  prisma: {
    gamePosition: { update: vi.fn() },
    customFeld: { update: vi.fn(), create: vi.fn() },
    infrastrukturElement: { create: vi.fn() },
    situationsplan: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("../middlewares/auth", () => ({
  requireRole: vi.fn(() => ({ id: "admin-1", role: "ADMIN" })),
  getAuthUser: vi.fn(),
}));

import { prisma } from "../lib/prisma";
import situationsplanRouter from "./situationsplan";

const mocked = prisma as unknown as {
  gamePosition: { update: ReturnType<typeof vi.fn> };
  customFeld: { update: ReturnType<typeof vi.fn> };
  infrastrukturElement: { create: ReturnType<typeof vi.fn> };
};

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  vi.clearAllMocks();
  const app = express();
  app.use(express.json());
  app.use("/api/situationsplan", situationsplanRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  if (typeof addr === "object" && addr) baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

describe("PUT /api/situationsplan/position/:id — partial updates preserve rotation", () => {
  it("a drag (x/y only) must NOT reset rotation", async () => {
    mocked.gamePosition.update.mockResolvedValue({ id: "gp1", x: 10, y: 20, rotation: 45 });

    const res = await fetch(`${baseUrl}/api/situationsplan/position/gp1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x: 10, y: 20 }),
    });
    expect(res.status).toBe(200);

    const call = mocked.gamePosition.update.mock.calls[0][0];
    expect(call.data).toEqual({ x: 10, y: 20 });
    expect(call.data).not.toHaveProperty("rotation");
  });

  it("an explicit rotation change IS applied", async () => {
    mocked.gamePosition.update.mockResolvedValue({ id: "gp1", x: 10, y: 20, rotation: 90 });

    await fetch(`${baseUrl}/api/situationsplan/position/gp1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotation: 90 }),
    });

    const call = mocked.gamePosition.update.mock.calls[0][0];
    expect(call.data).toEqual({ rotation: 90 });
  });

  it("a nummer edit persists and does NOT touch position/rotation", async () => {
    mocked.gamePosition.update.mockResolvedValue({ id: "gp1", nummer: "7" });

    await fetch(`${baseUrl}/api/situationsplan/position/gp1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nummer: "7" }),
    });

    const call = mocked.gamePosition.update.mock.calls[0][0];
    expect(call.data).toEqual({ nummer: "7" });
    expect(call.data).not.toHaveProperty("x");
    expect(call.data).not.toHaveProperty("rotation");
  });

  it("a visibility toggle (oeffentlich) persists and does NOT touch position/rotation", async () => {
    mocked.gamePosition.update.mockResolvedValue({ id: "gp1", oeffentlich: false });

    await fetch(`${baseUrl}/api/situationsplan/position/gp1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oeffentlich: false }),
    });

    const call = mocked.gamePosition.update.mock.calls[0][0];
    expect(call.data).toEqual({ oeffentlich: false });
    expect(call.data).not.toHaveProperty("x");
    expect(call.data).not.toHaveProperty("rotation");
  });
});

describe("PUT /api/situationsplan/custom/:id — partial updates preserve other fields", () => {
  it("a resize (breiteM/laengeM only) must NOT reset rotation/label/nummer/farbe", async () => {
    mocked.customFeld.update.mockResolvedValue({ id: "cf1" });

    const res = await fetch(`${baseUrl}/api/situationsplan/custom/cf1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ breiteM: 12, laengeM: 8 }),
    });
    expect(res.status).toBe(200);

    const call = mocked.customFeld.update.mock.calls[0][0];
    expect(call.data).toEqual({ breiteM: 12, laengeM: 8 });
    expect(call.data).not.toHaveProperty("rotation");
    expect(call.data).not.toHaveProperty("label");
  });

  it("a metadata edit (label only) must NOT reset rotation or position", async () => {
    mocked.customFeld.update.mockResolvedValue({ id: "cf1" });

    await fetch(`${baseUrl}/api/situationsplan/custom/cf1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Verpflegung" }),
    });

    const call = mocked.customFeld.update.mock.calls[0][0];
    expect(call.data).toEqual({ label: "Verpflegung" });
    expect(call.data).not.toHaveProperty("rotation");
    expect(call.data).not.toHaveProperty("x");
  });
});

describe("POST /api/situationsplan — infra type validation", () => {
  it("rejects an invalid infra typ with 400 and does not create", async () => {
    const res = await fetch(`${baseUrl}/api/situationsplan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "p1", typ: "STROM", x: 1, y: 2 }),
    });
    expect(res.status).toBe(400);
    expect(mocked.infrastrukturElement.create).not.toHaveBeenCalled();
  });

  it("accepts a valid infra typ from the current enum", async () => {
    mocked.infrastrukturElement.create.mockResolvedValue({ id: "i1", typ: "TOILETTE" });

    const res = await fetch(`${baseUrl}/api/situationsplan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "p1", typ: "TOILETTE", x: 1, y: 2 }),
    });
    expect(res.status).toBe(201);
    expect(mocked.infrastrukturElement.create).toHaveBeenCalledTimes(1);
  });
});
