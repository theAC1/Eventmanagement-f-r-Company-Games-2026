export const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 200,
  ADMIN: 100,
  ORGA: 50,
  SCHIEDSRICHTER: 20,
  HELFER: 10,
};

export type PersonRolle = "OWNER" | "ADMIN" | "ORGA" | "SCHIEDSRICHTER" | "HELFER";

export function hasMinRole(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole];
  const requiredLevel = ROLE_HIERARCHY[requiredRole];
  if (userLevel === undefined || requiredLevel === undefined) return false;
  return userLevel >= requiredLevel;
}
