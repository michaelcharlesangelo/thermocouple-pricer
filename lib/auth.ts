import crypto from "crypto";

// A single shared admin password (not per-user accounts), so a lightweight
// SHA-256 hash with a static app-specific salt is appropriate here - no
// need for bcrypt/argon2 given the low stakes of this internal tool.
const SALT = "thermocouple-pricer-v1";

// Starting team (view-only) password before anyone's changed it via the
// admin Security tab. Meant to be changed immediately - this is just so
// the tool works out of the box without extra env var setup, unlike the
// admin password which has no baked-in default for security reasons.
export const DEFAULT_TEAM_PASSWORD = "tempsens";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(SALT + password).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}
