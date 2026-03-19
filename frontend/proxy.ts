import { NextRequest, NextResponse } from "next/server";

const ROLE_PREFIXES: Record<string, string> = {
  patient: "/patient",
  doctor: "/doctor",
  pharmacist: "/pharmacist",
  admin: "/admin",
};

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/pending-approval",
];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Root path passes through (redirected to /login by page.tsx)
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Public routes pass through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for auth_session cookie (contains role, set by frontend after login)
  // NOTE: This is NOT the access token. The access token lives in memory only.
  // Real auth verification happens at the API layer via Bearer token.
  const authSession = request.cookies.get("auth_session")?.value;
  if (!authSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = authSession; // auth_session cookie value IS the role string

  // Block wrong-role access
  const isWrongRole = Object.entries(ROLE_PREFIXES).some(
    ([r, prefix]) => r !== role && pathname.startsWith(prefix)
  );
  if (isWrongRole) {
    return NextResponse.redirect(new URL(`/${role}/dashboard`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
