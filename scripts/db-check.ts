import dotenv from "dotenv";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set in .env");
    process.exitCode = 1;
    return;
  }
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
  try {
    const result = await prisma.$queryRawUnsafe("SELECT 1 AS ok");
    console.log("DB OK:", JSON.stringify(result));
    const tables = await prisma.$queryRawUnsafe(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    );
    console.log("Tables:", (tables as { tablename: string }[]).map((t) => t.tablename).join(", "));
    const counts = await Promise.all(
      [
        "User",
        "Member",
        "Role",
        "Permission",
        "Committee",
        "Department",
        "RegistrationWindow",
        "Applicant",
        "PromotionRequest",
        "Event",
        "ClubUpdate",
        "GalleryAlbum",
        "GalleryItem",
        "Notification",
        "AuditLog",
        "SystemSetting",
        "ContactSubmission",
        "Task",
        "CommitteeMemberRole",
        "MemberDepartment",
        "RolePermission",
      ].map(async (table) => {
        try {
          const c = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM "${table}"`);
          return `${table}=${(c as { c: bigint }[])[0].c}`;
        } catch {
          return `${table}=ERR`;
        }
      })
    );
    console.log("Row counts:", counts.join(", "));
  } catch (e) {
    console.error("DB ERROR:", (e as Error).message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
