import { db, users } from "@localos/db";
import { hashPassword } from "./auth/password.js";

export async function bootstrapOwnerAccount(): Promise<void> {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) {
    return;
  }

  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password) {
    console.warn(
      "No users exist and OWNER_EMAIL/OWNER_PASSWORD are not set — " +
        "the dashboard has no login yet and is inaccessible until an owner account is bootstrapped.",
    );
    return;
  }

  const passwordHash = await hashPassword(password);
  await db.insert(users).values({ email, passwordHash, role: "owner" });
  console.log(`Bootstrapped owner account for ${email}.`);
}
