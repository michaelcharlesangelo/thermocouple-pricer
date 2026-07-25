import crypto from "crypto";

// A single shared admin password (not per-user accounts), so a lightweight
// SHA-256 hash with a static app-specific salt is appropriate here - no
// need for bcrypt/argon2 given the low stakes of this internal tool.
const SALT = "thermocouple-pricer-v1";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(SALT + password).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}
