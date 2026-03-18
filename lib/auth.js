import { getServerSession } from "next-auth";
import { authOptions } from "../app/api/auth/[...nextauth]/route.js";

export async function getAppSession() {
  return getServerSession(authOptions);
}

export function requireAdmin(session) {
  return session && session.user && session.user.role === "admin";
}

