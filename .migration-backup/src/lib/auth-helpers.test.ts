import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock auth.ts
vi.mock("./auth", () => ({
  authOptions: {},
  hasMinRole: (userRole: string, requiredRole: string) => {
    const hierarchy: Record<string, number> = {
      ADMIN: 100, ORGA: 50, SCHIEDSRICHTER: 20, HELFER: 10,
    };
    const userLevel = hierarchy[userRole];
    const requiredLevel = hierarchy[requiredRole];
    if (userLevel === undefined || requiredLevel === undefined) return false;
    return userLevel >= requiredLevel;
  },
}));

import { getServerSession } from "next-auth";
import { getSession, requireRole, getCurrentUserId } from "./auth-helpers";

const mockGetServerSession = vi.mocked(getServerSession);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSession", () => {
  it("sollte Session zurückgeben wenn eingeloggt", async () => {
    const mockSession = { user: { id: "u1", name: "Juan", rolle: "ADMIN" } };
    mockGetServerSession.mockResolvedValue(mockSession);

    const session = await getSession();
    expect(session).toEqual(mockSession);
  });

  it("sollte null zurückgeben wenn nicht eingeloggt", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const session = await getSession();
    expect(session).toBeNull();
  });
});

describe("requireRole", () => {
  it("sollte Session zurückgeben wenn Rolle ausreicht", async () => {
    const mockSession = { user: { id: "u1", name: "Juan", rolle: "ADMIN" } };
    mockGetServerSession.mockResolvedValue(mockSession);

    const result = await requireRole("ORGA");

    expect(result.error).toBeNull();
    expect(result.session).toEqual(mockSession);
  });

  it("sollte 401 zurückgeben wenn nicht eingeloggt", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const result = await requireRole("ORGA");

    expect(result.error).not.toBeNull();
    expect(result.session).toBeNull();
    // NextResponse.json gibt ein Response-Objekt zurück
    const body = await result.error!.json();
    expect(body.error).toBe("Nicht eingeloggt");
  });

  it("sollte 403 zurückgeben wenn Rolle nicht ausreicht", async () => {
    const mockSession = { user: { id: "u1", name: "Lea", rolle: "HELFER" } };
    mockGetServerSession.mockResolvedValue(mockSession);

    const result = await requireRole("ORGA");

    expect(result.error).not.toBeNull();
    expect(result.session).toBeNull();
    const body = await result.error!.json();
    expect(body.error).toBe("Keine Berechtigung");
  });

  it("sollte SCHIEDSRICHTER für SCHIEDSRICHTER-Rolle erlauben", async () => {
    const mockSession = { user: { id: "u1", name: "Ref", rolle: "SCHIEDSRICHTER" } };
    mockGetServerSession.mockResolvedValue(mockSession);

    const result = await requireRole("SCHIEDSRICHTER");

    expect(result.error).toBeNull();
    expect(result.session).toEqual(mockSession);
  });
});

describe("getCurrentUserId", () => {
  it("sollte User-ID zurückgeben wenn eingeloggt", async () => {
    const mockSession = { user: { id: "user-123", name: "Juan", rolle: "ADMIN" } };
    mockGetServerSession.mockResolvedValue(mockSession);

    const userId = await getCurrentUserId();
    expect(userId).toBe("user-123");
  });

  it("sollte null zurückgeben wenn nicht eingeloggt", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const userId = await getCurrentUserId();
    expect(userId).toBeNull();
  });
});
