import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const p = new PrismaClient({ adapter });

const tables = [
  "User", "Member", "Role", "Permission", "RolePermission", "Committee",
  "CommitteeMemberRole", "Department", "MemberDepartment", "Task",
  "RegistrationWindow", "Applicant", "ContactSubmission", "PromotionRequest",
  "Event", "EventRsvp", "ClubUpdate", "GalleryAlbum", "GalleryItem",
  "Notification", "AuditLog", "SystemSetting",
];

(async () => {
  const counts: Record<string, number> = {};
  for (const t of tables) {
    try {
      const r = await p.$queryRawUnsafe(`SELECT count(*)::int AS c FROM "${t}"`);
      counts[t] = (r as { c: number }[])[0].c;
    } catch (e) {
      counts[t] = -1;
      console.log(`TABLE ${t} MISSING: ${(e as Error).message.slice(0, 120)}`);
    }
  }
  console.log("ROW COUNTS:", JSON.stringify(counts, null, 1));

  const perms = await p.$queryRawUnsafe<{ key: string }[]>(
    'SELECT key FROM "Permission" ORDER BY key'
  );
  console.log("PERMISSIONS (" + perms.length + "):", perms.map((x) => x.key).join(", "));

  const users = await p.$queryRawUnsafe<{ email: string }[]>('SELECT email FROM "User" ORDER BY email');
  console.log("USERS:", JSON.stringify(users));

  const orphans = await p.$queryRawUnsafe<{ table: string }[]>(`
    SELECT 'Member->User' AS table FROM "Member" m LEFT JOIN "User" u ON u.id = m."userId" WHERE u.id IS NULL
    UNION ALL SELECT 'MemberDepartment->Member' FROM "MemberDepartment" md LEFT JOIN "Member" m ON m.id = md."memberId" WHERE m.id IS NULL
    UNION ALL SELECT 'MemberDepartment->Department' FROM "MemberDepartment" md LEFT JOIN "Department" d ON d.id = md."departmentId" WHERE d.id IS NULL
    UNION ALL SELECT 'CommitteeMemberRole->Member' FROM "CommitteeMemberRole" c LEFT JOIN "Member" m ON m.id = c."memberId" WHERE m.id IS NULL
    UNION ALL SELECT 'CommitteeMemberRole->Committee' FROM "CommitteeMemberRole" c LEFT JOIN "Committee" k ON k.id = c."committeeId" WHERE k.id IS NULL
    UNION ALL SELECT 'CommitteeMemberRole->Role' FROM "CommitteeMemberRole" c LEFT JOIN "Role" r ON r.id = c."roleId" WHERE r.id IS NULL
    UNION ALL SELECT 'RolePermission->Role' FROM "RolePermission" rp LEFT JOIN "Role" r ON r.id = rp."roleId" WHERE r.id IS NULL
    UNION ALL SELECT 'RolePermission->Permission' FROM "RolePermission" rp LEFT JOIN "Permission" pm ON pm.id = rp."permissionId" WHERE pm.id IS NULL
    UNION ALL SELECT 'Department->Committee' FROM "Department" d LEFT JOIN "Committee" k ON k.id = d."committeeId" WHERE k.id IS NULL
    UNION ALL SELECT 'Department->Coordinator' FROM "Department" d LEFT JOIN "Member" m ON m.id = d."coordinatorId" WHERE d."coordinatorId" IS NOT NULL AND m.id IS NULL
    UNION ALL SELECT 'Task->Department' FROM "Task" t LEFT JOIN "Department" d ON d.id = t."departmentId" WHERE d.id IS NULL
    UNION ALL SELECT 'Applicant->Window' FROM "Applicant" a LEFT JOIN "RegistrationWindow" w ON w.id = a."registrationWindowId" WHERE w.id IS NULL
    UNION ALL SELECT 'Promotion->Member' FROM "PromotionRequest" pr LEFT JOIN "Member" m ON m.id = pr."memberId" WHERE m.id IS NULL
    UNION ALL SELECT 'Promotion->CurrentRole' FROM "PromotionRequest" pr LEFT JOIN "Role" r ON r.id = pr."currentRoleId" WHERE r.id IS NULL
    UNION ALL SELECT 'Promotion->ProposedRole' FROM "PromotionRequest" pr LEFT JOIN "Role" r ON r.id = pr."proposedRoleId" WHERE r.id IS NULL
    UNION ALL SELECT 'Event->Department' FROM "Event" e LEFT JOIN "Department" d ON d.id = e."departmentId" WHERE e."departmentId" IS NOT NULL AND d.id IS NULL
    UNION ALL SELECT 'GalleryAlbum->Department' FROM "GalleryAlbum" ga LEFT JOIN "Department" d ON d.id = ga."departmentId" WHERE ga."departmentId" IS NOT NULL AND d.id IS NULL
    UNION ALL SELECT 'GalleryItem->Album' FROM "GalleryItem" gi LEFT JOIN "GalleryAlbum" ga ON ga.id = gi."albumId" WHERE ga.id IS NULL
  `);
  console.log("ORPHANED FK ROWS:", orphans.length === 0 ? "NONE (integrity OK)" : JSON.stringify(orphans));

  const demo = await p.$queryRawUnsafe<{ email: string; name: string }[]>(
    "SELECT email, name FROM \"User\" WHERE email IN ('admin@dcms.local','demo@dcms.local')"
  );
  console.log("DEMO ACCOUNTS PRESENT:", JSON.stringify(demo));
  await p.$disconnect();
})();
