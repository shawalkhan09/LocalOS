import bcrypt from "bcryptjs";

// bcryptjs over a fast hash (sha256, etc.) or plaintext: bcrypt is an
// adaptive hash purpose-built for passwords — deliberately slow, salted
// per-hash, and tunable via cost factor as hardware gets faster. Picked
// bcryptjs over argon2 specifically because it's pure JS (no native
// addon/build step), which matters for a small single-tenant deploy that
// shouldn't need a C++ toolchain just to install dependencies.
const SALT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
