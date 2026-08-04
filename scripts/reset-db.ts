/**
 * Resets the dev database: truncates all tables, then re-runs the seed.
 * Usage: npx tsx scripts/reset-db.ts
 */
import dotenv from "dotenv";
import path from "path";
import { execSync } from "child_process";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const tableNames = [
    "AuditLog",
    "GalleryItem",
    "GalleryAlbum",
    "Notification",
    "EventRsvp",
    "Event",
    "ClubUpdate",
    "Applicant",
    "RegistrationWindow",
    "ContactSubmission",
    "Task",
    "MemberDepartment",
    "CommitteeMemberRole",
    "PromotionRequest",
    "RolePermission",
    "Role",
    "Department",
    "Committee",
    "Member",
    "SystemSetting",
    "User",
    "Session",
    "Account",
    "VerificationToken",
  ];

  console.log("Truncating all tables...");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "${tableNames.join('","')}" RESTART IDENTITY CASCADE`
  );
  await prisma.$disconnect();
  console.log("Truncate complete. Running seed...");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", cwd: path.resolve(__dirname, "..") });
  console.log("Database reset complete ✅");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
