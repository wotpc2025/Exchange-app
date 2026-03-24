import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { ACCESS_ROLE, resolveAccessPolicy } from "@/lib/access-policy.js";

function unauthorizedApi() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbiddenApi() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function redirectToLogin(req) {
  const loginUrl = new URL("/login", req.url);
  const pathWithQuery = `${req.nextUrl.pathname}${req.nextUrl.search || ""}`;
  loginUrl.searchParams.set("callbackUrl", pathWithQuery);
  return NextResponse.redirect(loginUrl);
}

function redirectToHome(req) {
  return NextResponse.redirect(new URL("/", req.url));
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const policy = resolveAccessPolicy(pathname, req.method);

  if (!policy || policy.role === ACCESS_ROLE.PUBLIC) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isApi = pathname.startsWith("/api/");

  if (!token) {
    return isApi ? unauthorizedApi() : redirectToLogin(req);
  }

  if (policy.role === ACCESS_ROLE.ADMIN && token.role !== "admin") {
    return isApi ? forbiddenApi() : redirectToHome(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$).*)",
  ],
};
