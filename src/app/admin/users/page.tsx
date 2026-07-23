import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.rolle === "OWNER";

  return <UsersClient isOwner={isOwner} />;
}
