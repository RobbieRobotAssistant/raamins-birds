import "server-only";

import crypto from "node:crypto";

// Admin auth for the moderation console. The password lives only in the
// ADMIN_PASSWORD env var; the session cookie holds an HMAC derived from it
// (never the password itself), so it can be verified without storing secrets
// client-side.

export const ADMIN_COOKIE = "bird_admin";

const PASSWORD = process.env.ADMIN_PASSWORD || "";

export function adminEnabled(): boolean {
  return PASSWORD.length > 0;
}

function sameString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function checkPassword(pw: string): boolean {
  return PASSWORD.length > 0 && sameString(pw, PASSWORD);
}

// The value stored in the session cookie after a successful login.
export function sessionToken(): string {
  return crypto
    .createHmac("sha256", PASSWORD)
    .update("birds-admin-v1")
    .digest("hex");
}

export function isValidSession(cookieValue: string | undefined): boolean {
  if (!PASSWORD || !cookieValue) return false;
  return sameString(cookieValue, sessionToken());
}
