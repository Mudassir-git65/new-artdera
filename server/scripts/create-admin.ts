import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../db";
import { UserModel } from "../models";
import { normalizeEmail } from "../lib/security";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const email = normalizeEmail(required("ADMIN_EMAIL"));
  const password = required("ADMIN_PASSWORD");
  if (password.length < 14) throw new Error("ADMIN_PASSWORD must be at least 14 characters");
  const fullName = process.env.ADMIN_NAME?.trim() || "ArtDera Administrator";
  await connectDatabase();
  const existing = await UserModel.findOne({ emailNormalized: email });
  if (existing) {
    existing.role = "admin";
    existing.status = "active";
    existing.emailVerified = true;
    existing.passwordHash = await bcrypt.hash(password, 12);
    existing.passwordChangedAt = new Date();
    await existing.save();
  } else {
    await UserModel.create({
      fullName,
      email,
      emailNormalized: email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "admin",
      status: "active",
      emailVerified: true,
      city: "",
      country: "Pakistan",
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
    });
  }
  process.stdout.write("Admin account created or updated.\n");
  await disconnectDatabase();
}

void main().catch(async () => {
  process.stderr.write(
    "Admin creation failed. Check ADMIN_EMAIL, ADMIN_PASSWORD, and database configuration.\n",
  );
  await disconnectDatabase();
  process.exitCode = 1;
});
