import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PERMISSIONS_LIST: [string, string][] = [
  ["member.view", "View member profiles"],
  ["member.create", "Create new members"],
  ["member.edit", "Edit member profiles"],
  ["department.view", "View departments"],
  ["department.manage", "Manage departments"],
  ["committee.manage", "Manage committees"],
  ["registration.manage", "Manage registration windows"],
  ["registration.review", "Review applicants"],
  ["promotion.submit", "Submit promotion requests"],
  ["promotion.approve", "Approve/reject promotions"],
  ["gallery.upload", "Upload to gallery"],
  ["gallery.manage", "Manage gallery albums"],
  ["updates.publish", "Publish club updates"],
  ["events.manage", "Manage events"],
  ["permissions.manage", "Manage roles & permissions"],
  ["settings.manage", "Manage system settings"],
];

async function main() {
  console.log("Seeding database...");

  // ---------------------------------------------------------------------------
  // 0. Reset seed-owned data (dev seed)
  // ---------------------------------------------------------------------------
  // Re-running the seed must always produce an identical, clean dataset — the
  // old seed only *added* rows (guarded by `count === 0` checks) so partial or
  // stale data (renamed members, half-seeded contact inboxes, audit entries for
  // deleted entities) could never be repaired. We therefore rebuild all
  // user-facing + content data from scratch, while reference data (permissions,
  // roles, committees, departments, windows, albums, settings) is upserted
  // below so stable ids survive re-seeds.
  console.log("Resetting seed-owned data...");
  const contentTables = [
    "AuditLog",
    "Notification",
    "ContactSubmission",
    "GalleryItem",
    "Event",
    "ClubUpdate",
    "Task",
    "PromotionRequest",
    "Applicant",
    "MemberDepartment",
    "CommitteeMemberRole",
  ];
  for (const t of contentTables) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${t}"`);
  }
  await prisma.$executeRawUnsafe(`UPDATE "Department" SET "coordinatorId" = NULL`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Member"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "User"`);

  // 1. Permissions
  for (const [key, description] of PERMISSIONS_LIST) {
    await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
  }
  console.log(`Seeded ${PERMISSIONS_LIST.length} permissions`);

  const adminPassword = await bcrypt.hash("admin123", 12);
  const memberPassword = await bcrypt.hash("member123", 10);

  // 2. Roles
  console.log("Creating roles...");
  const roleDefs = [
    { name: "Admin", description: "Full system administrator" },
    { name: "Member", description: "Regular club member" },
    { name: "President", description: "Club president and executive lead" },
    { name: "Vice President", description: "Deputy executive lead" },
    { name: "Treasurer", description: "Manages the club budget" },
    { name: "Secretary", description: "Minutes, records and correspondence" },
    { name: "Production Coordinator", description: "Coordinates productions and events" },
    { name: "Executive Member", description: "Executive committee member" },
    { name: "Stage Manager", description: "Runs rehearsals and shows" },
    { name: "Workshop Lead", description: "Runs member workshops" },
    { name: "Publicity Lead", description: "Marketing and outreach" },
    { name: "Tech Lead", description: "Lighting, sound and stage tech" },
    { name: "Costumes & Wardrobe Lead", description: "Leads costume design and wardrobe" },
  ] as const;
  const roles: Record<string, { id: string }> = {};
  for (const r of roleDefs) {
    roles[r.name] = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description },
    });
  }

  // 3. Role -> permission mapping
  console.log("Assigning role permissions...");
  const perm = async (key: string) => (await prisma.permission.findUnique({ where: { key } }))!;
  const assignPerms = async (roleId: string, keys: string[]) => {
    for (const key of keys) {
      const p = await perm(key);
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: p.id } },
        update: {},
        create: { roleId, permissionId: p.id },
      });
    }
  };
  const ALL = PERMISSIONS_LIST.map(([k]) => k);
  await assignPerms(roles.Admin.id, ALL);
  // Base member: read the directory and departments, upload to the gallery,
  // raise their own promotion request. Deliberately WITHOUT `events.manage` —
  // that permission is club-wide, so granting it to every member let anyone
  // edit or delete any event on the calendar. Event management belongs to the
  // coordinator/lead roles below.
  await assignPerms(roles.Member.id, ["member.view", "department.view", "gallery.upload", "promotion.submit"]);
  await assignPerms(roles.President.id, ALL);
  await assignPerms(roles["Vice President"].id, ["member.view", "member.edit", "department.view", "department.manage", "committee.manage", "registration.manage", "registration.review", "promotion.submit", "promotion.approve", "gallery.upload", "gallery.manage", "updates.publish", "events.manage"]);
  await assignPerms(roles.Treasurer.id, ["member.view", "department.view", "events.manage", "promotion.submit", "gallery.upload"]);
  await assignPerms(roles.Secretary.id, ["member.view", "department.view", "updates.publish", "events.manage", "promotion.submit", "gallery.upload"]);
  await assignPerms(roles["Production Coordinator"].id, ["member.view", "department.view", "department.manage", "promotion.submit", "events.manage", "gallery.upload", "gallery.manage", "updates.publish"]);
  await assignPerms(roles["Executive Member"].id, ["member.view", "department.view", "promotion.submit", "events.manage", "gallery.upload", "updates.publish"]);
  await assignPerms(roles["Stage Manager"].id, ["member.view", "department.view", "events.manage", "promotion.submit", "gallery.upload"]);
  await assignPerms(roles["Workshop Lead"].id, ["member.view", "department.view", "events.manage", "promotion.submit", "gallery.upload", "updates.publish"]);
  await assignPerms(roles["Publicity Lead"].id, ["member.view", "department.view", "updates.publish", "events.manage", "promotion.submit", "gallery.upload", "gallery.manage"]);
  await assignPerms(roles["Tech Lead"].id, ["member.view", "department.view", "events.manage", "promotion.submit", "gallery.upload"]);
  await assignPerms(roles["Costumes & Wardrobe Lead"].id, ["member.view", "department.view", "events.manage", "promotion.submit", "gallery.upload"]);

  // 4. Committees (two past + current)
  console.log("Creating committees...");
  const committee2023 = await prisma.committee.upsert({
    where: { id: "committee-2023" },
    update: {},
    create: {
      id: "committee-2023",
      year: "2023-2024",
      startDate: new Date("2023-07-01"),
      endDate: new Date("2024-06-30"),
      isCurrent: false,
      status: "DISSOLVED",
    },
  });
  const committee2024 = await prisma.committee.upsert({
    where: { id: "committee-2024" },
    update: {},
    create: {
      id: "committee-2024",
      year: "2024-2025",
      startDate: new Date("2024-07-01"),
      endDate: new Date("2025-06-30"),
      isCurrent: false,
      status: "DISSOLVED",
    },
  });
  const committee = await prisma.committee.upsert({
    where: { id: "current-committee" },
    update: {},
    create: {
      id: "current-committee",
      year: "2025-2026",
      startDate: new Date("2025-07-01"),
      isCurrent: true,
      status: "ACTIVE",
    },
  });
  const committees = { c2023: committee2023, c2024: committee2024, current: committee };

  // 5. Users + members (Bangladeshi names — BRAC University Drama Club)
  console.log("Creating users and members...");
  type SeedMember = {
    name: string;
    email: string;
    code: string;
    status: "PENDING" | "ACTIVE" | "ALUMNI" | "INACTIVE" | "SUSPENDED";
    joined: string;
    phone: string;
    depts: string[]; // department keys, resolved later
    address?: string;
    dob?: string;
    emergencyContact?: string;
    role?: string; // current committee role name
    pastRoles?: { committee: "c2023" | "c2024"; role: string }[];
  };

  const memberSeeds: SeedMember[] = [
    // Officers
    { name: "Rafiqul Islam", email: "rafiqul.islam@bracu.ac.bd", code: "DCMS-001", status: "ACTIVE", joined: "2024-09-01", phone: "+8801711000001", address: "Dhanmondi, Dhaka", depts: ["performance"], role: "Production Coordinator" },
    { name: "Tanvir Hasan", email: "tanvir.hasan@bracu.ac.bd", code: "DCMS-002", status: "ACTIVE", joined: "2024-09-01", phone: "+8801711000002", address: "Mirpur-10, Dhaka", emergencyContact: "+8801811000002", depts: ["publicity"], role: "Publicity Lead" },
    { name: "Farhana Akter", email: "farhana.akter@bracu.ac.bd", code: "DCMS-003", status: "ACTIVE", joined: "2023-09-01", phone: "+8801711000003", address: "Uttara Sector-7, Dhaka", dob: "2002-05-14", depts: ["creative-arts"], role: "President", pastRoles: [{ committee: "c2024", role: "Vice President" }, { committee: "c2023", role: "Secretary" }] },
    { name: "Nusrat Jahan", email: "nusrat.jahan@bracu.ac.bd", code: "DCMS-004", status: "PENDING", joined: "2026-08-02", phone: "+8801711000004", address: "Mohammadpur, Dhaka", depts: ["technical"] },
    { name: "Mahmudul Karim", email: "mahmudul.karim@bracu.ac.bd", code: "DCMS-005", status: "ALUMNI", joined: "2022-09-01", phone: "+8801711000005", address: "Lalbagh, Old Dhaka", depts: ["performance"], pastRoles: [{ committee: "c2023", role: "Stage Manager" }] },
    { name: "Rakib Hossain", email: "rakib.hossain@bracu.ac.bd", code: "DCMS-006", status: "INACTIVE", joined: "2023-09-01", phone: "+8801711000006", address: "Badda, Dhaka", depts: ["logistics"] },
    { name: "Tasnim Rahman", email: "tasnim.rahman@bracu.ac.bd", code: "DCMS-007", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000007", address: "Banani, Dhaka", depts: ["creative-arts", "publicity"], role: "Vice President" },
    { name: "Arif Chowdhury", email: "arif.chowdhury@bracu.ac.bd", code: "DCMS-008", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000008", address: "Gulshan-2, Dhaka", emergencyContact: "+8801811000008", depts: ["technical"], role: "Tech Lead" },
    { name: "Sadia Islam", email: "sadia.islam@bracu.ac.bd", code: "DCMS-009", status: "ACTIVE", joined: "2024-09-01", phone: "+8801711000009", address: "Azimpur, Dhaka", depts: ["stage-management"], role: "Stage Manager" },
    { name: "Saiful Alam", email: "saiful.alam@bracu.ac.bd", code: "DCMS-010", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000010", address: "Wari, Dhaka", depts: ["publicity"], role: "Workshop Lead" },
    { name: "Moushumi Khan", email: "moushumi.khan@bracu.ac.bd", code: "DCMS-011", status: "ACTIVE", joined: "2024-09-01", phone: "+8801711000011", address: "Dhanmondi, Dhaka", depts: ["costumes"], role: "Treasurer" },
    { name: "Rima Sultana", email: "rima.sultana@bracu.ac.bd", code: "DCMS-012", status: "ACTIVE", joined: "2023-09-01", phone: "+8801711000012", address: "Shahbag, Dhaka", dob: "2001-11-02", depts: ["music-sound"], role: "Secretary" },
    // General members
    { name: "Sumaiya Chowdhury", email: "sumaiya.chowdhury@bracu.ac.bd", code: "DCMS-013", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000013", address: "Kakrail, Dhaka", depts: ["performance", "creative-arts"] },
    { name: "Jahid Hasan", email: "jahid.hasan@bracu.ac.bd", code: "DCMS-014", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000014", address: "Mirpur-1, Dhaka", depts: ["technical", "stage-management"] },
    { name: "Jannatul Ferdous", email: "jannatul.ferdous@bracu.ac.bd", code: "DCMS-015", status: "ACTIVE", joined: "2024-09-01", phone: "+8801711000015", address: "Agrabad, Chattogram", depts: ["costumes", "makeup-hair"] },
    { name: "Shakib Ahmed", email: "shakib.ahmed@bracu.ac.bd", code: "DCMS-016", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000016", address: "Sylhet Sadar", depts: ["music-sound"] },
    { name: "Naimur Rahman", email: "naimur.rahman@bracu.ac.bd", code: "DCMS-017", status: "ACTIVE", joined: "2025-01-15", phone: "+8801711000017", address: "Rajshahi City", depts: ["creative-arts"] },
    { name: "Nasrin Akter", email: "nasrin.akter@bracu.ac.bd", code: "DCMS-018", status: "ACTIVE", joined: "2024-09-01", phone: "+8801711000018", address: "Khulna City", depts: ["publicity"] },
    { name: "Sharmin Sultana", email: "sharmin.sultana@bracu.ac.bd", code: "DCMS-019", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000019", address: "Dhanmondi, Dhaka", depts: ["logistics", "finance-records"] },
    { name: "Anika Rahman", email: "anika.rahman@bracu.ac.bd", code: "DCMS-020", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000020", address: "Uttara Sector-3, Dhaka", depts: ["performance"] },
    { name: "Farhan Islam", email: "farhan.islam@bracu.ac.bd", code: "DCMS-021", status: "PENDING", joined: "2026-07-20", phone: "+8801711000021", address: "Jatrabari, Dhaka", depts: ["technical"] },
    { name: "Tabassum Islam", email: "tabassum.islam@bracu.ac.bd", code: "DCMS-022", status: "ACTIVE", joined: "2023-09-01", phone: "+8801711000022", address: "Bashundhara R/A, Dhaka", depts: ["creative-arts", "music-sound"] },
    { name: "Imran Kabir", email: "imran.kabir@bracu.ac.bd", code: "DCMS-023", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000023", address: "Mirpur-12, Dhaka", depts: ["stage-management"] },
    { name: "Fariha Kabir", email: "fariha.kabir@bracu.ac.bd", code: "DCMS-024", status: "ACTIVE", joined: "2024-09-01", phone: "+8801711000024", address: "Banani, Dhaka", emergencyContact: "+8801811000024", depts: ["makeup-hair", "costumes"] },
    { name: "Rubel Mia", email: "rubel.mia@bracu.ac.bd", code: "DCMS-025", status: "ALUMNI", joined: "2021-09-01", phone: "+8801711000025", address: "Comilla City", depts: ["performance"], pastRoles: [{ committee: "c2023", role: "President" }] },
    { name: "Nabila Hossain", email: "nabila.hossain@bracu.ac.bd", code: "DCMS-026", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000026", address: "Mohakhali, Dhaka", depts: ["finance-records", "logistics"] },
    { name: "Kamal Uddin", email: "kamal.uddin@bracu.ac.bd", code: "DCMS-027", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000027", address: "Kotwali, Dhaka", depts: ["technical"] },
    { name: "Israt Jahan", email: "israt.jahan@bracu.ac.bd", code: "DCMS-028", status: "SUSPENDED", joined: "2024-09-01", phone: "+8801711000028", address: "Narayanganj", depts: ["performance"] },
    { name: "Enamul Haque", email: "enamul.haque@bracu.ac.bd", code: "DCMS-029", status: "ACTIVE", joined: "2026-01-15", phone: "+8801711000029", address: "Gazipur City", depts: ["creative-arts"] },
    { name: "Mitu Akter", email: "mitu.akter@bracu.ac.bd", code: "DCMS-030", status: "PENDING", joined: "2026-08-05", phone: "+8801711000030", address: "Savar, Dhaka", depts: ["publicity"] },
    { name: "Rashed Khan", email: "rashed.khan@bracu.ac.bd", code: "DCMS-031", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000031", address: "Motijheel, Dhaka", depts: ["performance"] },
    { name: "Mizanur Rahman", email: "mizanur.rahman@bracu.ac.bd", code: "DCMS-032", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000032", address: "Mymensingh City", depts: ["technical"] },
    { name: "Nargis Sultana", email: "nargis.sultana@bracu.ac.bd", code: "DCMS-033", status: "ACTIVE", joined: "2024-09-01", phone: "+8801711000033", address: "Faridpur City", dob: "2003-02-19", depts: ["costumes"] },
    { name: "Ashraful Islam", email: "ashraful.islam@bracu.ac.bd", code: "DCMS-034", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000034", address: "Rampura, Dhaka", depts: ["logistics"] },
    { name: "Sabbir Hossain", email: "sabbir.hossain@bracu.ac.bd", code: "DCMS-035", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000035", address: "Bogra City", depts: ["music-sound"] },
    { name: "Shanta Rani", email: "shanta.rani@bracu.ac.bd", code: "DCMS-036", status: "ACTIVE", joined: "2024-09-01", phone: "+8801711000036", address: "Pabna City", depts: ["makeup-hair"] },
    { name: "Al Amin", email: "al.amin@bracu.ac.bd", code: "DCMS-037", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000037", address: "Cumilla City", depts: ["publicity"] },
    { name: "Farzana Yasmin", email: "farzana.yasmin@bracu.ac.bd", code: "DCMS-038", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000038", address: "Barishal City", depts: ["creative-arts"] },
    { name: "Hasibul Karim", email: "hasibul.karim@bracu.ac.bd", code: "DCMS-039", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000039", address: "Tejgaon, Dhaka", depts: ["stage-management"] },
    { name: "Tania Islam", email: "tania.islam@bracu.ac.bd", code: "DCMS-040", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000040", address: "Rangpur City", depts: ["performance"] },
    { name: "Tanjim Sakib", email: "tanjim.sakib@bracu.ac.bd", code: "DCMS-041", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000041", address: "Dhaka Cantt", depts: ["technical"] },
    { name: "Urmi Das", email: "urmi.das@bracu.ac.bd", code: "DCMS-042", status: "ACTIVE", joined: "2024-09-01", phone: "+8801711000042", address: "Chittagong Medical Area", depts: ["music-sound"] },
    { name: "Mehedi Hasan", email: "mehedi.hasan@bracu.ac.bd", code: "DCMS-043", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000043", address: "Tongi, Gazipur", depts: ["logistics"] },
    { name: "Puja Roy", email: "puja.roy@bracu.ac.bd", code: "DCMS-044", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000044", address: "Sylhet City", depts: ["costumes"] },
    { name: "Fahim Faisal", email: "fahim.faisal@bracu.ac.bd", code: "DCMS-045", status: "ACTIVE", joined: "2026-01-15", phone: "+8801711000045", address: "Bashundhara R/A, Dhaka", depts: ["performance"] },
    { name: "Nipa Chakma", email: "nipa.chakma@bracu.ac.bd", code: "DCMS-046", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000046", address: "Rangamati", depts: ["creative-arts"] },
    { name: "Abir Hossain", email: "abir.hossain@bracu.ac.bd", code: "DCMS-047", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000047", address: "Bhairab, Kishoreganj", depts: ["technical"] },
    { name: "Ritu Saha", email: "ritu.saha@bracu.ac.bd", code: "DCMS-048", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000048", address: "Jhenaidah City", depts: ["publicity"] },
    // More general members
    { name: "Ayesha Siddiqua", email: "ayesha.siddiqua@bracu.ac.bd", code: "DCMS-049", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000049", address: "Mohakhali, Dhaka", dob: "2003-08-21", depts: ["performance", "creative-arts"], role: "Executive Member" },
    { name: "Rafsan Chowdhury", email: "rafsan.chowdhury@bracu.ac.bd", code: "DCMS-050", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000050", address: "Bashundhara R/A, Dhaka", depts: ["technical"] },
    { name: "Mehjabin Rahman", email: "mehjabin.rahman@bracu.ac.bd", code: "DCMS-051", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000051", address: "Banani, Dhaka", depts: ["costumes"] },
    { name: "Tanjina Akter", email: "tanjina.akter@bracu.ac.bd", code: "DCMS-052", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000052", address: "Uttara Sector-4, Dhaka", depts: ["publicity"] },
    { name: "Sadman Sakib", email: "sadman.sakib@bracu.ac.bd", code: "DCMS-053", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000053", address: "Mirpur-2, Dhaka", depts: ["music-sound"] },
    { name: "Oyshi Roy", email: "oyshi.roy@bracu.ac.bd", code: "DCMS-054", status: "PENDING", joined: "2026-08-07", phone: "+8801711000054", address: "Khilgaon, Dhaka", depts: ["creative-arts"] },
    { name: "Rifat Hossain", email: "rifat.hossain@bracu.ac.bd", code: "DCMS-055", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000055", address: "Lalmatia, Dhaka", depts: ["logistics"] },
    { name: "Disha Chowdhury", email: "disha.chowdhury@bracu.ac.bd", code: "DCMS-056", status: "ACTIVE", joined: "2024-09-01", phone: "+8801711000056", address: "Gulshan-1, Dhaka", emergencyContact: "+8801811000056", depts: ["makeup-hair"] },
    { name: "Fardin Kabir", email: "fardin.kabir@bracu.ac.bd", code: "DCMS-057", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000057", address: "Shyamoli, Dhaka", depts: ["stage-management"] },
    { name: "Sharmin Akter", email: "sharmin.akter@bracu.ac.bd", code: "DCMS-058", status: "ALUMNI", joined: "2022-09-01", phone: "+8801711000058", address: "Feni City", depts: ["finance-records"], pastRoles: [{ committee: "c2023", role: "Treasurer" }] },
    { name: "Azmol Huda", email: "azmol.huda@bracu.ac.bd", code: "DCMS-059", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000059", address: "Agargaon, Dhaka", depts: ["technical"] },
    { name: "Meghla Chowdhury", email: "meghla.chowdhury@bracu.ac.bd", code: "DCMS-060", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000060", address: "Dhanmondi, Dhaka", depts: ["performance"], role: "Executive Member" },
    { name: "Nabil Hasan", email: "nabil.hasan@bracu.ac.bd", code: "DCMS-061", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000061", address: "Demra, Dhaka", depts: ["creative-arts"] },
    { name: "Umme Kulsum", email: "umme.kulsum@bracu.ac.bd", code: "DCMS-062", status: "INACTIVE", joined: "2023-09-01", phone: "+8801711000062", address: "Kadamtali, Chattogram", depts: ["costumes"] },
    { name: "Shahed Khan", email: "shahed.khan@bracu.ac.bd", code: "DCMS-063", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000063", address: "Jashore City", depts: ["publicity"] },
    { name: "Farzana Rahman", email: "farzana.rahman@bracu.ac.bd", code: "DCMS-064", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000064", address: "Tangail City", depts: ["music-sound"] },
    { name: "Emon Chowdhury", email: "emon.chowdhury@bracu.ac.bd", code: "DCMS-065", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000065", address: "Chowkbazar, Old Dhaka", depts: ["logistics"] },
    { name: "Toma Sarker", email: "toma.sarker@bracu.ac.bd", code: "DCMS-066", status: "SUSPENDED", joined: "2024-09-01", phone: "+8801711000066", address: "Dinajpur City", depts: ["performance"] },
    { name: "Zawad Ahmed", email: "zawad.ahmed@bracu.ac.bd", code: "DCMS-067", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000067", address: "Badda, Dhaka", emergencyContact: "+8801811000067", depts: ["technical"] },
    { name: "Brishti Paul", email: "brishti.paul@bracu.ac.bd", code: "DCMS-068", status: "ACTIVE", joined: "2024-09-01", phone: "+8801711000068", address: "Khulna City", depts: ["creative-arts", "music-sound"] },
    { name: "Mithila Islam", email: "mithila.islam@bracu.ac.bd", code: "DCMS-069", status: "PENDING", joined: "2026-08-09", phone: "+8801711000069", address: "Bonosree, Dhaka", depts: ["stage-management"] },
    { name: "Shohan Mia", email: "shohan.mia@bracu.ac.bd", code: "DCMS-070", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000070", address: "Manikganj City", depts: ["finance-records"] },
    { name: "Jarin Tasnim", email: "jarin.tasnim@bracu.ac.bd", code: "DCMS-071", status: "ACTIVE", joined: "2025-09-01", phone: "+8801711000071", address: "Moghbazar, Dhaka", depts: ["makeup-hair"] },
    { name: "Abrar Hossain", email: "abrar.hossain@bracu.ac.bd", code: "DCMS-072", status: "ACTIVE", joined: "2026-01-15", phone: "+8801711000072", address: "Keraniganj, Dhaka", depts: ["performance"] },
  ];

  // Department definitions (fixed ids for stability)
  const deptDefs = [
    { id: "dept-creative-arts", name: "Creative Arts", description: "Script writing, directing, and creative design" },
    { id: "dept-technical", name: "Technical", description: "Stage design, lighting, and sound" },
    { id: "dept-performance", name: "Performance", description: "Acting, rehearsals, and stage performance" },
    { id: "dept-publicity", name: "Publicity", description: "Marketing, social media, and outreach" },
    { id: "dept-logistics", name: "Logistics", description: "Event coordination, venue, and equipment" },
    { id: "dept-stage-management", name: "Stage Management", description: "Backstage coordination and props" },
    { id: "dept-costumes", name: "Costumes & Wardrobe", description: "Costume design, fittings, and upkeep" },
    { id: "dept-music-sound", name: "Music & Sound", description: "Music direction and audio engineering" },
    { id: "dept-makeup-hair", name: "Makeup & Hair", description: "Character makeup and hairstyling" },
    { id: "dept-finance-records", name: "Finance & Records", description: "Budget, membership records, and admin" },
  ] as const;

  const departmentKeys: Record<string, string> = {};
  for (const d of deptDefs) {
    const dept = await prisma.department.upsert({
      where: { id: d.id },
      update: { name: d.name, description: d.description, committeeId: committee.id },
      create: { id: d.id, name: d.name, description: d.description, committeeId: committee.id },
    });
    departmentKeys[d.id.replace("dept-", "")] = dept.id;
  }

  // Departments for past committees (a couple each)
  const pastDeptDefs = [
    { id: "dept-2023-performance", name: "Performance (2023)", committeeId: committee2023.id },
    { id: "dept-2023-tech", name: "Technical (2023)", committeeId: committee2023.id },
    { id: "dept-2024-performance", name: "Performance (2024)", committeeId: committee2024.id },
    { id: "dept-2024-publicity", name: "Publicity (2024)", committeeId: committee2024.id },
  ] as const;
  for (const d of pastDeptDefs) {
    await prisma.department.upsert({
      where: { id: d.id },
      update: {},
      create: { id: d.id, name: d.name, committeeId: d.committeeId },
    });
  }

  // Admin + demo (kept identical to before for e2e/smoke compatibility)
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@dcms.local" },
    update: { name: "Admin User", passwordHash: adminPassword },
    create: { name: "Admin User", email: "admin@dcms.local", passwordHash: adminPassword },
  });
  const adminMember = await prisma.member.upsert({
    where: { userId: adminUser.id },
    update: {
      memberCode: "DCMS-ADMIN01",
      phone: "+8801711000099",
      status: "ACTIVE",
      joiningDate: new Date("2024-01-01"),
    },
    create: {
      userId: adminUser.id,
      memberCode: "DCMS-ADMIN01",
      phone: "+8801711000099",
      status: "ACTIVE",
      joiningDate: new Date("2024-01-01"),
    },
  });
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@dcms.local" },
    update: { name: "Demo Member", passwordHash: await bcrypt.hash("demo123", 12) },
    create: { name: "Demo Member", email: "demo@dcms.local", passwordHash: await bcrypt.hash("demo123", 12) },
  });
  const demoMember = await prisma.member.upsert({
    where: { userId: demoUser.id },
    update: {
      memberCode: "DCMS-DEMO01",
      phone: "+8801711000098",
      status: "ACTIVE",
      joiningDate: new Date("2025-06-01"),
    },
    create: {
      userId: demoUser.id,
      memberCode: "DCMS-DEMO01",
      phone: "+8801711000098",
      status: "ACTIVE",
      joiningDate: new Date("2025-06-01"),
    },
  });

  // Coordinator for Creative Arts (admin)
  await prisma.department.update({
    where: { id: departmentKeys["creative-arts"] },
    data: { coordinatorId: adminMember.id },
  });

  const memberMap: Record<string, { id: string; userId: string; name: string }> = {
    admin: { id: adminMember.id, userId: adminUser.id, name: adminUser.name },
    demo: { id: demoMember.id, userId: demoUser.id, name: demoUser.name },
  };

  for (const s of memberSeeds) {
    // Every seeded member can sign in with member123 (handy for testing the UI).
    // update keeps name + password deterministic on re-seeds.
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: { name: s.name, passwordHash: memberPassword },
      create: { name: s.name, email: s.email, passwordHash: memberPassword },
    });
    const member = await prisma.member.upsert({
      where: { userId: user.id },
      update: {
        memberCode: s.code,
        phone: s.phone,
        status: s.status,
        joiningDate: new Date(s.joined),
        ...(s.address ? { address: s.address } : {}),
        ...(s.dob ? { dateOfBirth: new Date(s.dob) } : {}),
        ...(s.emergencyContact ? { emergencyContact: s.emergencyContact } : {}),
      },
      create: {
        userId: user.id,
        memberCode: s.code,
        phone: s.phone,
        status: s.status,
        joiningDate: new Date(s.joined),
        ...(s.address ? { address: s.address } : {}),
        ...(s.dob ? { dateOfBirth: new Date(s.dob) } : {}),
        ...(s.emergencyContact ? { emergencyContact: s.emergencyContact } : {}),
      },
    });
    memberMap[s.code] = { id: member.id, userId: user.id, name: s.name };
  }

  // 6. Department assignments + coordinators
  console.log("Assigning department memberships...");
  const assignDept = async (memberId: string, deptKey: string) => {
    await prisma.memberDepartment.upsert({
      where: { memberId_departmentId: { memberId, departmentId: departmentKeys[deptKey] } },
      update: {},
      create: { memberId, departmentId: departmentKeys[deptKey] },
    });
  };
  await assignDept(demoMember.id, "creative-arts");
  for (const s of memberSeeds) {
    const m = memberMap[s.code];
    for (const dk of s.depts) await assignDept(m.id, dk);
  }
  // A few coordinators for realism
  const coordinators: [string, string][] = [
    ["technical", "DCMS-008"],
    ["performance", "DCMS-001"],
    ["publicity", "DCMS-002"],
    ["stage-management", "DCMS-009"],
    ["costumes", "DCMS-011"],
    ["music-sound", "DCMS-012"],
    ["makeup-hair", "DCMS-024"],
    ["finance-records", "DCMS-019"],
    ["logistics", "DCMS-034"],
  ];
  for (const [dk, code] of coordinators) {
    await prisma.department.update({
      where: { id: departmentKeys[dk] },
      data: { coordinatorId: memberMap[code].id },
    });
  }

  // 7. Committee roles
  console.log("Assigning committee roles...");
  const assignRole = async (committeeId: string, memberId: string, roleId: string, startedAt: string, endedAt: string | null = null) => {
    await prisma.committeeMemberRole.upsert({
      where: { committeeId_memberId_roleId: { committeeId, memberId, roleId } },
      update: { startedAt: new Date(startedAt), endedAt: endedAt ? new Date(endedAt) : null },
      create: { committeeId, memberId, roleId, startedAt: new Date(startedAt), ...(endedAt ? { endedAt: new Date(endedAt) } : {}) },
    });
  };
  await assignRole(committee.id, adminMember.id, roles.Admin.id, "2025-07-01");
  await assignRole(committee.id, demoMember.id, roles.Member.id, "2025-06-01");
  for (const s of memberSeeds) {
    if (s.role) {
      await assignRole(committee.id, memberMap[s.code].id, roles[s.role].id, "2025-09-01");
    }
    for (const p of s.pastRoles ?? []) {
      const pastCommittee = committees[p.committee];
      // Roles end with their committee year: c2023 ends 2024-06-30, c2024 ends 2025-06-30.
      const end = p.committee === "c2023" ? "2024-06-30" : "2025-06-30";
      await assignRole(pastCommittee.id, memberMap[s.code].id, roles[p.role].id, "2023-09-01", end);
    }
  }
  // Extra current-committee members for a fuller roster
  for (const code of [
    "DCMS-013", "DCMS-014", "DCMS-015", "DCMS-016", "DCMS-017", "DCMS-018",
    "DCMS-020", "DCMS-022", "DCMS-023", "DCMS-026", "DCMS-029", "DCMS-031",
    "DCMS-032", "DCMS-034", "DCMS-035", "DCMS-037", "DCMS-038", "DCMS-040",
    "DCMS-041", "DCMS-043", "DCMS-045", "DCMS-046", "DCMS-047", "DCMS-048",
    "DCMS-050", "DCMS-051", "DCMS-052", "DCMS-053", "DCMS-055", "DCMS-056",
    "DCMS-057", "DCMS-059", "DCMS-061", "DCMS-063", "DCMS-064", "DCMS-065",
    "DCMS-067", "DCMS-068", "DCMS-070", "DCMS-071", "DCMS-072",
  ]) {
    await assignRole(committee.id, memberMap[code].id, roles.Member.id, "2025-09-01");
  }

  // 8. Tasks
  console.log("Creating tasks...");
  type SeedTask = {
    dept: string;
    title: string;
    description: string;
    assignee?: string;
    due?: string;
    status: "TODO" | "IN_PROGRESS" | "DONE";
  };
  const taskSeeds: SeedTask[] = [
    { dept: "creative-arts", title: "Script reading — Kobor", description: "Read through the Liberation War drama script with the full team", assignee: "DCMS-003", status: "DONE" },
    { dept: "technical", title: "Design stage layout for Kobor", description: "Create technical drawings for the bunker set", status: "TODO", due: "2026-09-01" },
    { dept: "publicity", title: "Boishakhi Mela poster campaign", description: "Design promotional content for the Pahela Boishakh fair stall", assignee: "DCMS-002", status: "IN_PROGRESS", due: "2026-08-15" },
    { dept: "creative-arts", title: "Draft audition monologues", description: "Prepare sides from Kobor for the fall auditions", assignee: "DCMS-007", status: "DONE", due: "2026-07-30" },
    { dept: "performance", title: "Cast table read", description: "Full read-through with the Kobor cast", assignee: "DCMS-001", status: "DONE", due: "2026-08-03" },
    { dept: "stage-management", title: "Props inventory", description: "Catalog and repair existing props from the jatra season", assignee: "DCMS-009", status: "IN_PROGRESS", due: "2026-08-20" },
    { dept: "costumes", title: "Costume fittings week", description: "Book fittings for the full Kobor cast", assignee: "DCMS-011", status: "IN_PROGRESS", due: "2026-08-25" },
    { dept: "music-sound", title: "Rabindra sangeet score selection", description: "Pick underscore for the ektara and flute scenes", assignee: "DCMS-012", status: "TODO", due: "2026-09-05" },
    { dept: "makeup-hair", title: "Character makeup design", description: "Concept boards for the five leads — 1971 looks", assignee: "DCMS-024", status: "TODO", due: "2026-09-10" },
    { dept: "finance-records", title: "Membership fee reconciliation (Tk)", description: "Match payments to member records before the fall season", assignee: "DCMS-019", status: "IN_PROGRESS", due: "2026-08-31" },
    { dept: "logistics", title: "Reserve BRAC University Auditorium dates", description: "Book the campus auditorium for tech week and shows", assignee: "DCMS-034", status: "DONE", due: "2026-07-15" },
    { dept: "technical", title: "Lighting plot for Act 1", description: "Program cues for the first act of Kobor", assignee: "DCMS-008", status: "TODO", due: "2026-09-12" },
    { dept: "publicity", title: "Design Kobor show poster", description: "Poster for the opening night at the National Theatre Hall", assignee: "DCMS-018", status: "IN_PROGRESS", due: "2026-08-28" },
    { dept: "creative-arts", title: "Rewrite ending scene", description: "Tighten the final monologue of Kobor", assignee: "DCMS-029", status: "TODO", due: "2026-09-02" },
    { dept: "stage-management", title: "Rehearsal schedule", description: "Publish weekly rehearsal schedule for the Kobor run", assignee: "DCMS-023", status: "DONE", due: "2026-08-01" },
    { dept: "music-sound", title: "Mic check for musical numbers", description: "Wire and test lavalier mics for Rabindra sangeet pieces", assignee: "DCMS-016", status: "TODO", due: "2026-09-15" },
    { dept: "costumes", title: "Vintage saree collection drive", description: "Collect pre-1971 style sarees and panjabis for the costume drive", assignee: "DCMS-015", status: "IN_PROGRESS", due: "2026-08-18" },
    { dept: "publicity", title: "Ekushey tribute video edit", description: "Edit the Feb 21 language day tribute video", assignee: "DCMS-037", status: "TODO", due: "2027-02-10" },
    { dept: "technical", title: "Boishakhi stage sound setup", description: "Full PA setup for the Boishakhi Mela main stage", assignee: "DCMS-027", status: "IN_PROGRESS", due: "2027-04-10" },
    { dept: "creative-arts", title: "Pohela Falgun decoration design", description: "Design the spring decoration theme for Rabindra Sarobar", assignee: "DCMS-038", status: "TODO", due: "2027-02-08" },
    { dept: "logistics", title: "Shahid Minar permission", description: "Get Central Shahid Minar premises approval for Feb 21 program", assignee: "DCMS-043", status: "DONE", due: "2027-01-25" },
    { dept: "performance", title: "Monologue coaching — freshmen", description: "One-on-one coaching for new joiners on audition monologues", assignee: "DCMS-031", status: "IN_PROGRESS", due: "2026-08-22" },
    { dept: "stage-management", title: "Wardrobe track sheet", description: "Build the costume-change track sheet for Kobor", assignee: "DCMS-039", status: "TODO", due: "2026-09-05" },
    { dept: "makeup-hair", title: "Hair rehearsal — matinee double", description: "Practice quick-change hairstyles for the matinee schedule", assignee: "DCMS-036", status: "TODO", due: "2026-09-15" },
    { dept: "finance-records", title: "Natyotsab ticket reconciliation", description: "Reconcile ticket sales from the Spring Natyotsab", assignee: "DCMS-026", status: "DONE", due: "2026-06-01" },
    { dept: "music-sound", title: "Banshi score for Raktakarabi", description: "Record the bamboo flute score for the Raktakarabi revival", assignee: "DCMS-042", status: "DONE", due: "2026-04-20" },
    { dept: "creative-arts", title: "Natyamela one-act selection", description: "Choose student one-acts for the national festival in March", assignee: "DCMS-029", status: "TODO", due: "2027-01-15" },
    { dept: "technical", title: "BRAC University Auditorium rig check", description: "Inspect dimmers and fly bars ahead of the Winter Natyotsab", assignee: "DCMS-050", status: "IN_PROGRESS", due: "2026-11-20" },
    { dept: "performance", title: "Monologue showcase casting", description: "Cast the freshmen monologue showcase for Orientation Week", assignee: "DCMS-049", status: "TODO", due: "2026-09-30" },
    { dept: "publicity", title: "Campus newsletter feature", description: "Pitch a behind-the-scenes story to BRAC University campus media", assignee: "DCMS-052", status: "IN_PROGRESS", due: "2026-10-05" },
    { dept: "logistics", title: "Auditorium booking — Winter Natyotsab", description: "Confirm the BRAC University Auditorium for tech week and the showcase", assignee: "DCMS-055", status: "DONE", due: "2026-10-01" },
    { dept: "costumes", title: "Costume storage audit", description: "Catalog and re-tag the wardrobe room at BRAC University", assignee: "DCMS-051", status: "TODO", due: "2026-10-12" },
    { dept: "music-sound", title: "Borsha Poetry Evening soundscape", description: "Ambient sound design for the monsoon poetry readings", assignee: "DCMS-053", status: "IN_PROGRESS", due: "2026-08-13" },
    { dept: "stage-management", title: "Stage crew roster — Natyotsab", description: "Assign run crews for the Winter Natyotsab at BRAC University Auditorium", assignee: "DCMS-057", status: "TODO", due: "2026-11-25" },
    { dept: "makeup-hair", title: "Raktakarabi character boards", description: "Concept boards for the revival — red-ochre makeup looks", assignee: "DCMS-056", status: "DONE", due: "2026-04-10" },
    { dept: "finance-records", title: "Workshop fee tracking", description: "Track Tk fees from the summer acting camp and workshops", assignee: "DCMS-070", status: "IN_PROGRESS", due: "2026-09-20" },
  ];
  for (const t of taskSeeds) {
    await prisma.task.create({
      data: {
        departmentId: departmentKeys[t.dept],
        title: t.title,
        description: t.description,
        ...(t.assignee ? { assigneeId: memberMap[t.assignee].id } : {}),
        status: t.status as never,
        ...(t.due ? { dueDate: new Date(t.due) } : {}),
      },
    });
  }

  // 9. Events
  console.log("Creating events...");
  type SeedEvent = {
    title: string;
    type: string;
    status: string;
    dept?: string;
    start: string;
    end?: string;
    location?: string;
    description?: string;
  };
  const eventSeeds: SeedEvent[] = [
    // Completed (2024-2026)
    { title: "Pohela Boishakh Mela 2024", type: "FESTIVAL", status: "COMPLETED", dept: "creative-arts", start: "2024-04-14T10:00:00Z", end: "2024-04-14T18:00:00Z", location: "Boishakhi Mela Ground, Ramna Park", description: "Our stall, jatra performance and the Mangal Shobhajatra participation." },
    { title: "Spring Natyotsab 2024", type: "PERFORMANCE", status: "COMPLETED", dept: "performance", start: "2024-05-10T19:00:00Z", end: "2024-05-10T22:00:00Z", location: "BRAC University Auditorium", description: "Annual showcase of the year's best work." },
    { title: "Freshman Welcome Workshop", type: "WORKSHOP", status: "COMPLETED", dept: "creative-arts", start: "2024-09-07T14:00:00Z", end: "2024-09-07T17:00:00Z", location: "Studio A, Shilpakala Academy" },
    { title: "Bisarjon — Fall 2024", type: "PERFORMANCE", status: "COMPLETED", dept: "performance", start: "2024-11-15T19:00:00Z", end: "2024-11-15T21:30:00Z", location: "National Theatre Hall, Shilpakala Academy", description: "Tagore's classic tragedy in a modern staging." },
    { title: "Winter Improv Night", type: "FESTIVAL", status: "COMPLETED", dept: "performance", start: "2024-12-12T20:00:00Z", end: "2024-12-12T22:00:00Z", location: "Student Lounge, BRAC University" },
    { title: "Ekushey February Program 2025", type: "FESTIVAL", status: "COMPLETED", dept: "performance", start: "2025-02-21T09:00:00Z", end: "2025-02-21T12:00:00Z", location: "Central Shahid Minar Premises", description: "Probitro bhasha dibosh tribute — poetry, song and short scenes." },
    { title: "Kobor — Liberation War Drama", type: "PERFORMANCE", status: "COMPLETED", dept: "performance", start: "2025-03-21T19:00:00Z", end: "2025-03-21T21:30:00Z", location: "Mahila Samity Auditorium", description: "Mumtaz Uddin Ahmed's timeless play about the war of 1971." },
    { title: "Nazrul Jayanti 2025", type: "FESTIVAL", status: "COMPLETED", dept: "music-sound", start: "2025-05-25T18:00:00Z", end: "2025-05-25T21:00:00Z", location: "Chhayanaut Auditorium" },
    { title: "Raktakarabi — Spring 2025", type: "PERFORMANCE", status: "COMPLETED", dept: "performance", start: "2025-05-08T19:00:00Z", end: "2025-05-08T21:30:00Z", location: "National Theatre Hall, Shilpakala Academy" },
    { title: "Summer Acting Camp 2025", type: "TRAINING", status: "COMPLETED", dept: "performance", start: "2025-06-15T10:00:00Z", end: "2025-06-15T17:00:00Z", location: "Studio B, Shilpakala Academy" },
    { title: "Jatra Workshop: Rupban", type: "WORKSHOP", status: "COMPLETED", dept: "creative-arts", start: "2025-08-16T15:00:00Z", end: "2025-08-16T18:00:00Z", location: "Shilpakala Academy", description: "Folk jatra techniques with a guest from a touring jatra party." },
    { title: "Boishakhi Mela 2025", type: "FESTIVAL", status: "COMPLETED", dept: "creative-arts", start: "2025-04-14T10:00:00Z", end: "2025-04-14T18:00:00Z", location: "Boishakhi Mela Ground, Ramna Park" },
    { title: "One-Act Natyamela", type: "FESTIVAL", status: "COMPLETED", dept: "creative-arts", start: "2026-03-14T18:00:00Z", end: "2026-03-14T21:00:00Z", location: "Experimental Theatre Hall, Shilpakala Academy" },
    { title: "Student Playwright Showcase", type: "AUDITION", status: "COMPLETED", dept: "creative-arts", start: "2026-04-02T16:00:00Z", end: "2026-04-02T19:00:00Z", location: "Studio B, Shilpakala Academy" },
    { title: "Costume Parade", type: "FESTIVAL", status: "COMPLETED", dept: "costumes", start: "2026-02-20T15:00:00Z", end: "2026-02-20T17:00:00Z", location: "Seminar Room, BRAC University" },
    { title: "Ekushey February Program 2026", type: "FESTIVAL", status: "COMPLETED", dept: "performance", start: "2026-02-21T09:00:00Z", end: "2026-02-21T12:00:00Z", location: "Central Shahid Minar Premises" },
    { title: "Rabindra Jayanti 2026", type: "FESTIVAL", status: "COMPLETED", dept: "music-sound", start: "2026-05-09T18:00:00Z", end: "2026-05-09T21:00:00Z", location: "Rabindra Sarobar, Dhanmondi" },
    { title: "Spring Natyotsab 2026", type: "PERFORMANCE", status: "COMPLETED", dept: "performance", start: "2026-05-10T19:00:00Z", end: "2026-05-10T22:00:00Z", location: "BRAC University Auditorium", description: "Our annual showcase of the year's best work." },
    { title: "Chaka — Selim Al Deen Tribute", type: "PERFORMANCE", status: "COMPLETED", dept: "performance", start: "2026-06-12T19:00:00Z", end: "2026-06-12T21:30:00Z", location: "National Theatre Hall, Shilpakala Academy" },
    { title: "Freshman Orientation Play — BRAC University", type: "PERFORMANCE", status: "COMPLETED", dept: "performance", start: "2026-01-20T14:00:00Z", end: "2026-01-20T16:00:00Z", location: "BRAC University Auditorium", description: "Welcome play for the incoming freshman intake." },
    // Ongoing (August 2026)
    { title: "Dress Rehearsal — Kobor", type: "REHEARSAL", status: "ONGOING", dept: "performance", start: "2026-08-07T18:00:00Z", end: "2026-08-07T22:00:00Z", location: "National Theatre Hall, Shilpakala Academy", description: "Full dress rehearsal with costumes and lighting." },
    { title: "Backstage Setup Week — Kobor", type: "WORKSHOP", status: "ONGOING", dept: "stage-management", start: "2026-08-03T09:00:00Z", end: "2026-08-10T17:00:00Z", location: "National Theatre Hall, Shilpakala Academy" },
    // Upcoming
    { title: "Borsha Poetry Evening", type: "FESTIVAL", status: "UPCOMING", dept: "creative-arts", start: "2026-08-15T18:00:00Z", end: "2026-08-15T21:00:00Z", location: "Rabindra Sarobar, Dhanmondi", description: "Monsoon poetry and short pieces under the rain trees." },
    { title: "Beginner Acting Workshop", type: "WORKSHOP", status: "UPCOMING", dept: "creative-arts", start: "2026-08-22T14:00:00Z", end: "2026-08-22T17:00:00Z", location: "Seminar Room, BRAC University", description: "Beginner acting workshop — no experience needed." },
    { title: "Stage Combat Workshop", type: "WORKSHOP", status: "UPCOMING", dept: "performance", start: "2026-08-29T13:00:00Z", end: "2026-08-29T16:00:00Z", location: "Studio A, Shilpakala Academy" },
    { title: "Auditions for Kobor", type: "AUDITION", status: "UPCOMING", dept: "performance", start: "2026-09-01T10:00:00Z", end: "2026-09-01T16:00:00Z", location: "Stage, Shilpakala Academy", description: "Open auditions for the fall production." },
    { title: "Nuruldiner Sarajibon — Tech Rehearsal", type: "REHEARSAL", status: "UPCOMING", dept: "technical", start: "2026-09-10T18:00:00Z", end: "2026-09-10T22:00:00Z", location: "Main Stage, Shilpakala Academy" },
    { title: "Kobor — Opening Night", type: "PERFORMANCE", status: "UPCOMING", dept: "performance", start: "2026-09-20T19:00:00Z", end: "2026-09-20T21:30:00Z", location: "National Theatre Hall, Shilpakala Academy", description: "The fall production opens to the public. Tickets at the door." },
    { title: "Kobor — Matinee", type: "PERFORMANCE", status: "UPCOMING", dept: "performance", start: "2026-09-26T14:00:00Z", end: "2026-09-26T16:30:00Z", location: "National Theatre Hall, Shilpakala Academy" },
    { title: "Ora Kadam Ali — Backstage Tour", type: "FESTIVAL", status: "UPCOMING", dept: "creative-arts", start: "2026-10-02T11:00:00Z", end: "2026-10-02T15:00:00Z", location: "Theatre Building, Shilpakala Academy", description: "Peek behind the curtain with guided backstage tours." },
    { title: "Halloween One-Acts: Bhut-Bhorong", type: "PERFORMANCE", status: "UPCOMING", dept: "performance", start: "2026-10-30T19:00:00Z", end: "2026-10-30T21:00:00Z", location: "Black Box Theatre, BRAC University" },
    { title: "Audio Engineering Basics", type: "TRAINING", status: "UPCOMING", dept: "music-sound", start: "2026-11-07T14:00:00Z", end: "2026-11-07T17:00:00Z", location: "Tech Booth, Shilpakala Academy" },
    { title: "Winter Showcase Auditions", type: "AUDITION", status: "UPCOMING", dept: "creative-arts", start: "2026-11-21T10:00:00Z", end: "2026-11-21T15:00:00Z", location: "Studio B, Shilpakala Academy" },
    { title: "Winter Natyotsab 2026", type: "PERFORMANCE", status: "UPCOMING", dept: "performance", start: "2026-12-11T19:00:00Z", end: "2026-12-11T21:30:00Z", location: "BRAC University Auditorium" },
    { title: "Bijoy Dibosh Cultural Program", type: "FESTIVAL", status: "UPCOMING", dept: "performance", start: "2026-12-16T16:00:00Z", end: "2026-12-16T20:00:00Z", location: "Suhrawardy Udyan Open Stage", description: "Victory Day celebrations with patriotic song and drama." },
    { title: "Eid Reunion & Cultural Program", type: "FESTIVAL", status: "UPCOMING", dept: "logistics", start: "2027-01-20T16:00:00Z", end: "2027-01-20T20:00:00Z", location: "Shilpakala Academy" },
    { title: "Pohela Falgun Celebration", type: "FESTIVAL", status: "UPCOMING", dept: "creative-arts", start: "2027-02-13T15:00:00Z", end: "2027-02-13T18:00:00Z", location: "Rabindra Sarobar, Dhanmondi", description: "Spring celebration with yellow sarees, song and open mic." },
    { title: "Makeup Masterclass", type: "TRAINING", status: "UPCOMING", dept: "makeup-hair", start: "2027-02-06T14:00:00Z", end: "2027-02-06T17:00:00Z", location: "Studio A, Shilpakala Academy" },
    { title: "Ekushey February Program 2027", type: "FESTIVAL", status: "UPCOMING", dept: "performance", start: "2027-02-21T09:00:00Z", end: "2027-02-21T12:00:00Z", location: "Central Shahid Minar Premises" },
    { title: "Natyamela 2027", type: "FESTIVAL", status: "UPCOMING", dept: "creative-arts", start: "2027-03-20T14:00:00Z", end: "2027-03-20T21:00:00Z", location: "Bangladesh Shilpakala Academy", description: "National drama festival participation across the academy grounds." },
    { title: "Independence Day Program", type: "FESTIVAL", status: "UPCOMING", dept: "performance", start: "2027-03-26T17:00:00Z", end: "2027-03-26T20:00:00Z", location: "Osmani Memorial Hall" },
    { title: "Nabanno Utshob", type: "FESTIVAL", status: "UPCOMING", dept: "creative-arts", start: "2027-04-02T16:00:00Z", end: "2027-04-02T19:00:00Z", location: "BRAC University Playground", description: "Harvest festival with folk song, dance and pitha stalls." },
    { title: "Boishakhi Mela 2027", type: "FESTIVAL", status: "UPCOMING", dept: "creative-arts", start: "2027-04-14T10:00:00Z", end: "2027-04-14T18:00:00Z", location: "Boishakhi Mela Ground, Ramna Park" },
    { title: "Spring Natyotsab 2027 Gala", type: "PERFORMANCE", status: "UPCOMING", dept: "performance", start: "2027-05-08T19:00:00Z", end: "2027-05-08T22:00:00Z", location: "BRAC University Auditorium" },
    { title: "Nazrul Jayanti 2027", type: "FESTIVAL", status: "UPCOMING", dept: "music-sound", start: "2027-05-25T18:00:00Z", end: "2027-05-25T21:00:00Z", location: "Chhayanaut Auditorium" },
    { title: "Rabindra Sangeet Evening", type: "FESTIVAL", status: "UPCOMING", dept: "music-sound", start: "2026-08-28T18:00:00Z", end: "2026-08-28T20:30:00Z", location: "Rabindra Sarobar, Dhanmondi" },
    { title: "Theatre Criticism 101 Seminar", type: "WORKSHOP", status: "UPCOMING", dept: "creative-arts", start: "2026-09-18T14:00:00Z", end: "2026-09-18T17:00:00Z", location: "Seminar Room, BRAC University", description: "How to read and review a production with a guest critic." },
    { title: "Open Mic Night", type: "FESTIVAL", status: "UPCOMING", dept: "creative-arts", start: "2026-10-16T19:00:00Z", end: "2026-10-16T22:00:00Z", location: "BRAC University Green Quad", description: "Poetry, monologues and music under the open sky." },
    { title: "Voice & Diction Workshop", type: "TRAINING", status: "UPCOMING", dept: "performance", start: "2026-11-14T10:00:00Z", end: "2026-11-14T13:00:00Z", location: "Studio B, BRAC University", description: "Breath control, projection and Bangla diction." },
    { title: "Alumni Networking Night", type: "FESTIVAL", status: "UPCOMING", dept: "logistics", start: "2027-01-08T18:00:00Z", end: "2027-01-08T21:00:00Z", location: "Student Lounge, BRAC University", description: "Past members return to mentor the current cast." },
    // Drafts + cancelled
    { title: "TBA: Podcast Pilot — Backstage Chitro", type: "WORKSHOP", status: "DRAFT", dept: "publicity", start: "2027-03-01T18:00:00Z", end: "2027-03-01T20:00:00Z", location: "Club Office, BRAC University" },
    { title: "TBA: Improv Retreat — Boshundhara", type: "TRAINING", status: "DRAFT", dept: "performance", start: "2027-04-10T09:00:00Z", end: "2027-04-10T17:00:00Z", location: "Off-campus" },
    { title: "TBA: International Theatre Day Panel", type: "FESTIVAL", status: "DRAFT", dept: "creative-arts", start: "2027-03-27T15:00:00Z", end: "2027-03-27T18:00:00Z", location: "Seminar Room, BRAC University" },
    { title: "Cancelled: Outdoor Film Night", type: "FESTIVAL", status: "CANCELLED", dept: "logistics", start: "2026-09-04T19:00:00Z", end: "2026-09-04T22:00:00Z", location: "BRAC University Green Quad" },
    { title: "Cancelled: Guest Director Talk", type: "WORKSHOP", status: "CANCELLED", dept: "creative-arts", start: "2026-07-18T17:00:00Z", end: "2026-07-18T19:00:00Z", location: "Seminar Room, BRAC University" },
    { title: "Cancelled: Outdoor Rehearsal — Monsoon Edit", type: "REHEARSAL", status: "CANCELLED", dept: "performance", start: "2026-08-08T16:00:00Z", end: "2026-08-08T19:00:00Z", location: "BRAC University Green Quad" },
  ];
  for (const e of eventSeeds) {
    await prisma.event.create({
      data: {
        title: e.title,
        type: e.type as never,
        status: e.status as never,
        ...(e.dept ? { departmentId: departmentKeys[e.dept] } : {}),
        startAt: new Date(e.start),
        ...(e.end ? { endAt: new Date(e.end) } : {}),
        ...(e.location ? { location: e.location } : {}),
        ...(e.description ? { description: e.description } : {}),
      },
    });
  }

  // 10. Registration windows + applicants
  console.log("Creating registration windows and applicants...");
  type SeedWindow = {
    id: string;
    title: string;
    description: string;
    start: string;
    end: string;
    status: string;
    schema?: { name: string; type: string; label: string; required: boolean }[];
  };
  const windowDefs: SeedWindow[] = [
    {
      id: "window-fall-2025", title: "Fall 2025 Recruitment", description: "Join the BRAC University Drama Club for the fall semester!",
      start: "2025-09-01", end: "2025-09-30", status: "CLOSED",
    },
    {
      id: "window-spring-2026", title: "Spring 2026 Recruitment", description: "Mid-year intake for the spring production season.",
      start: "2026-02-01", end: "2026-02-28", status: "CLOSED",
    },
    {
      id: "window-fall-2026", title: "Fall 2026 Recruitment", description: "Join the BRAC University Drama Club for the fall semester!",
      start: "2026-08-01", end: "2026-08-31", status: "LIVE",
      schema: [
        { name: "whyJoin", type: "textarea", label: "Why do you want to join?", required: true },
        { name: "experience", type: "textarea", label: "Previous experience", required: false },
      ],
    },
    { id: "window-winter-2027", title: "Winter 2027 Recruitment", description: "Mid-year intake for the winter production season.", start: "2027-01-01", end: "2027-01-31", status: "DRAFT" },
    { id: "window-spring-2027", title: "Spring 2027 Recruitment", description: "Spring intake for the gala season.", start: "2027-04-01", end: "2027-04-30", status: "SCHEDULED" },
  ];

  for (const w of windowDefs) {
    // Reference data is upserted so stable ids survive re-seeds; propagate the
    // title/description/dates/status so re-runs keep the dataset identical.
    await prisma.registrationWindow.upsert({
      where: { id: w.id },
      update: {
        title: w.title,
        description: w.description,
        startDate: new Date(w.start),
        endDate: new Date(w.end),
        status: w.status as never,
        formSchema: w.schema ? { fields: w.schema } : { fields: [{ name: "whyJoin", type: "textarea", label: "Why do you want to join?", required: true }] },
      },
      create: {
        id: w.id,
        title: w.title,
        description: w.description,
        startDate: new Date(w.start),
        endDate: new Date(w.end),
        status: w.status as never,
        formSchema: w.schema ? { fields: w.schema } : { fields: [{ name: "whyJoin", type: "textarea", label: "Why do you want to join?", required: true }] },
      },
    });
  }

  const applicantNamePool = [
    "Miraj Hossain", "Samia Afrin", "Shakil Mahmud", "Tonima Akter", "Arpon Ghosh", "Bristy Das", "Chaiti Roy", "Debashish Paul",
    "Eshita Sultana", "Fahim Mahmud", "Golam Mostafa", "Habiba Khan", "Irfan Uddin", "Jui Saha", "Kafi Ahmed", "Liza Rahman",
    "Maruf Hasan", "Naima Sultana", "Omi Chowdhury", "Parvin Akter", "Ratul Islam", "Shafin Kabir", "Tithi Rani", "Uzzal Mia",
    "Waliur Rahman", "Yasmin Akter", "Zubair Karim", "Anonna Sarker", "Bappi Hossain", "Chaity Islam", "Dola Mitra", "Emon Khan",
    "Farabi Chowdhury", "Giyas Uddin", "Hridi Saha", "Ipsita Dutta", "Jannat Mawa", "Keya Parveen", "Labib Hasan", "Mahin Chowdhury",
    "Nafis Ahmed", "Oindrila Saha", "Purnima Das", "Rafiq Mia", "Shirin Akter", "Tanim Hasan", "Urmila Dey", "Wasim Kabir",
    "Yeasir Arafat", "Zarin Tasnim", "Akash Sarker", "Badhon Roy", "Celine Gomes", "Deepa Rani", "Era Chowdhury", "Foysal Ahmed",
  ];
  const skillsPool = ["Acting", "Singing", "Dancing", "Lighting", "Sound", "Writing", "Design", "Improv", "Costume", "Stage Management"];

  type ApplicantStatus = "SUBMITTED" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED" | "CONVERTED";

  const applyPerWindow = async (windowId: string, startIdx: number, count: number, statuses: readonly ApplicantStatus[]) => {
    for (let i = 0; i < count; i++) {
      const idx = startIdx + i;
      const name = applicantNamePool[idx % applicantNamePool.length];
      const email = `${name.toLowerCase().replace(/[^a-z]+/g, ".")}.${idx + 1}@bracu.ac.bd`;
      const status = statuses[i % statuses.length];
      const prefs = [departmentKeys["performance"], departmentKeys["creative-arts"]].slice(0, 1 + (idx % 2));
      await prisma.applicant.create({
        data: {
          registrationWindowId: windowId,
          name,
          email,
          phone: `+8801${String(700000000 + idx * 137013).slice(0, 9)}`,
          studentId: `BU-${2023 + (idx % 3)}-${String(1000 + idx * 13).slice(-4)}`,
          departmentPrefs: prefs,
          skills: [skillsPool[idx % skillsPool.length], skillsPool[(idx + 3) % skillsPool.length]].slice(0, 1 + (idx % 2)),
          actingExperience: idx % 3 === 0 ? "College natok dol, 2 years — performed at district festivals." : undefined,
          customResponses: {
            whyJoin: "I grew up watching jatra and Pohela Boishakh theatre — I want to grow as a performer.",
            experience: idx % 2 === 0 ? "School plays, Boishakhi skits and debate-stage experience." : "No formal experience yet, but I learn fast.",
          },
          status,
        },
      });
    }
  };

  const fall2025 = await prisma.registrationWindow.findUnique({ where: { id: "window-fall-2025" } });
  const spring2026 = await prisma.registrationWindow.findUnique({ where: { id: "window-spring-2026" } });
  const fall2026 = await prisma.registrationWindow.findUnique({ where: { id: "window-fall-2026" } });
  const spring2027 = await prisma.registrationWindow.findUnique({ where: { id: "window-spring-2027" } });
  if (fall2025) await applyPerWindow(fall2025.id, 0, 24, ["ACCEPTED", "CONVERTED", "ACCEPTED", "REJECTED", "CONVERTED"] as never);
  if (spring2026) await applyPerWindow(spring2026.id, 24, 20, ["ACCEPTED", "CONVERTED", "UNDER_REVIEW", "REJECTED", "SUBMITTED"] as never);
  if (fall2026) await applyPerWindow(fall2026.id, 44, 40, ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "REJECTED"] as never);
  if (spring2027) await applyPerWindow(spring2027.id, 84, 12, ["SUBMITTED"] as never);

  // Link every CONVERTED applicant to a real member profile.
  const convertedApplicants = await prisma.applicant.findMany({
    where: { status: "CONVERTED", convertedMemberId: null },
  });
  for (const a of convertedApplicants) {
    const existing = await prisma.member.findFirst({ where: { user: { email: a.email } } });
    if (existing) continue;
    const user = await prisma.user.upsert({
      where: { email: a.email },
      update: { name: a.name },
      create: { name: a.name, email: a.email, passwordHash: memberPassword },
    });
    const seq = a.email.match(/\.(\d+)@/)?.[1] ?? "000";
    const joinDate = a.registrationWindowId === "window-spring-2026" ? "2026-03-15" : "2025-10-01";
    const member = await prisma.member.create({
      data: {
        userId: user.id,
        memberCode: `DCMS-CONV-${String(seq).padStart(3, "0")}`,
        status: "ACTIVE",
        joiningDate: new Date(joinDate),
        sourceApplicant: { connect: { id: a.id } },
      },
    });
    await assignDept(member.id, "performance");
  }

  // 11. Club updates
  console.log("Creating club updates...");
  const updateSeeds = [
    { title: "Welcome to the New Semester!", body: "<p>We are excited to announce the start of a new drama season at BRAC University. Stay tuned for auditions, workshops and the fall production <em>Kobor</em>!</p>", category: "ANNOUNCEMENT", at: "2026-08-01" },
    { title: "Cast Announced for Kobor", body: "<p>We are thrilled to announce the full cast for this fall's Liberation War drama. Rehearsals begin August 10th at the Shilpakala Academy — see you on stage!</p>", category: "PRODUCTION", at: "2026-07-25" },
    { title: "Summer Workshop Series — Borsha Edition", body: "<p>Join us every Saturday in August for our open workshop series under the rain trees at Rabindra Sarobar. Beginners welcome, no experience needed.</p>", category: "EVENT", at: "2026-07-20" },
    { title: "Congratulations, Graduates!", body: "<p>Best of luck to our graduating members of 2026. The stage will miss you — but the alumni network is always open.</p>", category: "ACHIEVEMENT", at: "2026-06-15" },
    { title: "Spring Natyotsab 2026 Recap", body: "<p>Thank you to everyone who made the Spring Natyotsab at the BRAC University Auditorium unforgettable. Photos are up in the gallery!</p>", category: "ACHIEVEMENT", at: "2026-05-15" },
    { title: "Audition Tips from Our Director", body: "<p>Preparing for the Kobor auditions? Our director shares a few tips: be off-book, make bold choices, and have fun.</p>", category: "NOTICE", at: "2026-08-10" },
    { title: "New Workshop Lead Appointed", body: "<p>Please welcome Saiful Alam as our new Workshop Lead. Saiful will run the Saturday series at BRAC University.</p>", category: "ANNOUNCEMENT", at: "2026-07-05" },
    { title: "Fall 2026 Recruitment is Open!", body: "<p>The Fall 2026 recruitment window is live. Applications close August 31st — apply on the Recruitment page.</p>", category: "RECRUITMENT", at: "2026-08-01" },
    { title: "Costume Drive: Vintage Sarees Wanted", body: "<p>We're collecting pre-1971 style sarees, panjabis and chadars for the Kobor costume department. Drop-offs welcome at the club office.</p>", category: "NOTICE", at: "2026-07-12" },
    { title: "Behind the Scenes: Kobor Tech Week", body: "<p>Follow along as our tech crew builds the bunker world of Kobor at the National Theatre Hall this week.</p>", category: "PRODUCTION", at: "2026-08-08" },
    { title: "Member Spotlight: Farhana Akter", body: "<p>This month we celebrate Farhana Akter, our president, who has led the club through two banner seasons including the Ekushey tribute.</p>", category: "ACHIEVEMENT", at: "2026-06-01" },
    { title: "Pohela Boishakh Mela 2026 Recap", body: "<p>Our stall at the Ramna Boishakhi Mela sold out of pitha by noon — and the Mangal Shobhajatra was magnificent!</p>", category: "ACHIEVEMENT", at: "2026-04-20" },
    { title: "Ekushey February Tribute", body: "<p>At the Central Shahid Minar we presented poetry, song and short scenes for International Mother Language Day. Thank you to everyone who joined.</p>", category: "PRODUCTION", at: "2026-02-21" },
    { title: "Holiday Break Hours", body: "<p>The club office at BRAC University will close for the winter break from December 20 to January 5.</p>", category: "NOTICE", at: "2026-12-10" },
    { title: "Spring 2027 Season Announcement", body: "<p>Our spring season will feature the Natyotsab gala, the Natyamela festival, and a student-written showcase.</p>", category: "PRODUCTION", at: "2027-01-10" },
    { title: "Volunteer Call: Front of House", body: "<p>We need ushers and ticket scanners for the Kobor run. Sign up by emailing the logistics team.</p>", category: "RECRUITMENT", at: "2026-08-20" },
    { title: "Alumni Night Invitation", body: "<p>All alumni are invited to the December Natyotsab. RSVP through the contact page.</p>", category: "EVENT", at: "2026-11-01" },
    { title: "Nabanno Potluck", body: "<p>Join the club for our annual Nabanno potluck at BRAC University. Bring a pitha or a dish!</p>", category: "EVENT", at: "2026-11-15" },
    { title: "Rabindra Jayanti Celebration Recap", body: "<p>Rabindra sangeet, poetry and dance under the stars at Rabindra Sarobar — a night to remember.</p>", category: "ACHIEVEMENT", at: "2026-05-12" },
    { title: "Natyamela 2027 — Call for Plays", body: "<p>We are selecting one-act plays for the national drama festival in March. Submit your script by January 15.</p>", category: "RECRUITMENT", at: "2027-02-01" },
    { title: "BRAC University Auditorium Secured for Winter Natyotsab", body: "<p>We have confirmed the BRAC University Auditorium for tech week and the Winter Natyotsab in December. The full schedule is on the Events page.</p>", category: "ANNOUNCEMENT", at: "2026-10-01" },
    { title: "Freshman Orientation Week 2026", body: "<p>New to BRAC University? Come say hello at the club stall on Orientation Day — auditions for the showcase are open to all freshmen.</p>", category: "RECRUITMENT", at: "2026-01-10" },
    { title: "International Theatre Day 2027", body: "<p>Join our panel on the future of Bangladeshi theatre in the digital age at the BRAC University seminar room.</p>", category: "EVENT", at: "2027-03-20" },
    { title: "Guest Critic Visit", body: "<p>A visiting critic from Dhaka will lead our Theatre Criticism 101 seminar. Limited seats — sign up at the club office.</p>", category: "EVENT", at: "2026-09-05" },
    { title: "Alumni Spotlight: Sharmin Akter", body: "<p>Alumna Sharmin Akter now works in television production — she'll be mentoring our finance team this semester.</p>", category: "ACHIEVEMENT", at: "2026-09-15" },
    { title: "New Members Welcome Kit", body: "<p>All new members joining in Fall 2026 will receive the welcome kit — club handbook, rehearsal pass and a BRAC University Drama Club badge.</p>", category: "ANNOUNCEMENT", at: "2026-08-25" },
  ] as const;
  for (const u of updateSeeds) {
    await prisma.clubUpdate.create({
      data: {
        title: u.title,
        bodyRichText: u.body,
        category: u.category as never,
        authorId: adminUser.id,
        publishedAt: new Date(u.at),
        mediaUrls: u.category === "PRODUCTION" || u.category === "ACHIEVEMENT"
          ? [`https://picsum.photos/seed/${u.title.replace(/[^a-z]+/gi, "-").toLowerCase()}/800/450`]
          : [],
      },
    });
  }

  // 12. Gallery albums + items
  console.log("Creating gallery albums and items...");
  const albumSeeds = [
    { id: "album-spring-2026", name: "Kobor — Spring Production", category: "PRODUCTIONS", dept: "performance" },
    { id: "album-workshops-2026", name: "Borsha Workshop Series", category: "WORKSHOPS", dept: "creative-arts" },
    { id: "album-behind-scenes", name: "Behind the Scenes: Kobor", category: "BEHIND_THE_SCENES", dept: "technical" },
    { id: "album-festivals", name: "Boishakhi Mela 2026", category: "FESTIVALS", dept: "publicity" },
    { id: "album-club-life", name: "Club Life", category: "CLUB_LIFE", dept: null },
    { id: "album-rehearsals", name: "Rehearsal Room", category: "REHEARSALS", dept: "performance" },
    { id: "album-music-night", name: "Rabindra Sangeet Evening", category: "FESTIVALS", dept: "music-sound" },
    { id: "album-graduation", name: "Graduation 2026", category: "CLUB_LIFE", dept: null },
    { id: "album-ekushey", name: "Ekushey February 2026", category: "FESTIVALS", dept: null },
    { id: "album-natyamela", name: "Natyamela Festival", category: "FESTIVALS", dept: "creative-arts" },
    { id: "album-natyotsab", name: "Winter Natyotsab", category: "PRODUCTIONS", dept: "performance" },
    { id: "album-camp", name: "Summer Acting Camp", category: "WORKSHOPS", dept: "creative-arts" },
  ] as const;
  for (const a of albumSeeds) {
    await prisma.galleryAlbum.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        name: a.name,
        category: a.category as never,
        ...(a.dept ? { departmentId: departmentKeys[a.dept] } : {}),
      },
    });
  }
  const captions = [
    "Opening night curtain call",
    "Backstage hustle at the National Theatre Hall",
    "First read-through of Kobor",
    "Set build in progress",
    "Costume fittings — 1971 looks",
    "Candid moments at BRAC University",
    "Tech check on the ektara mic",
    "Post-show celebration with the cast",
    "Mangal Shobhajatra participation",
    "Pohela Boishakh stall crowd",
  ];
  const albums = await prisma.galleryAlbum.findMany();
  for (const album of albums) {
    const n = album.id === "album-spring-2026" ? 6 : album.id === "album-ekushey" || album.id === "album-festivals" ? 5 : 4;
    for (let i = 1; i <= n; i++) {
      await prisma.galleryItem.create({
        data: {
          albumId: album.id,
          r2Key: `gallery/seed/${album.id}/photo-${i}.jpg`,
          fileName: `photo-${i}.jpg`,
          type: "IMAGE",
          caption: `${captions[(i - 1) % captions.length]} · ${album.name}`,
          uploadedById: adminUser.id,
        },
      });
    }
  }

  // 13. Promotions
  console.log("Creating promotion requests...");
  const promotionSeeds = [
    { member: "demo", current: "Member", proposed: "Production Coordinator", reason: "Consistently led workshop sessions and mentored new members all semester.", achievements: "Organized 4 beginner workshops; ran onboarding for 12 new members.", status: "DRAFT" },
    { member: "DCMS-001", current: "Member", proposed: "Executive Member", reason: "Took ownership of the Kobor costume department without supervision.", achievements: "Delivered all costumes 2 weeks ahead of schedule.", status: "SUBMITTED" },
    { member: "DCMS-002", current: "Executive Member", proposed: "Production Coordinator", reason: "Led the Boishakhi Mela campaign that drew record crowds to our stall.", achievements: "Campaign reached 100k impressions; stall sold out by noon.", status: "PENDING_APPROVAL" },
    { member: "DCMS-003", current: "Executive Member", proposed: "President", reason: "Stepped in as acting president during the midterm reorganization.", achievements: "Ran committee meetings and balanced the club budget.", status: "APPROVED" },
    { member: "DCMS-006", current: "Member", proposed: "Executive Member", reason: "Requested executive role despite limited recent involvement.", achievements: "", status: "REJECTED" },
    { member: "DCMS-007", current: "Member", proposed: "Vice President", reason: "Showed strong leadership in planning the Borsha workshop series.", achievements: "Coordinated the 8-week series with 90+ attendances.", status: "SUBMITTED" },
    { member: "DCMS-008", current: "Member", proposed: "Tech Lead", reason: "Single-handedly rebuilt the lighting rig before the Natyotsab.", achievements: "New LED rig; zero technical faults during the gala.", status: "PENDING_APPROVAL" },
    { member: "DCMS-009", current: "Stage Manager", proposed: "Production Coordinator", reason: "Ran two smooth productions back to back as stage manager.", achievements: "Bisarjon and Raktakarabi both opened on time.", status: "APPROVED" },
    { member: "DCMS-010", current: "Member", proposed: "Workshop Lead", reason: "Created an accessible workshop curriculum for beginners.", achievements: "Wrote 12 lesson plans; retention up 40%.", status: "APPROVED" },
    { member: "DCMS-011", current: "Member", proposed: "Treasurer", reason: "Balanced the books for the costume department all year.", achievements: "Tracked a Tk 1.2 lakh budget with zero discrepancies.", status: "SUBMITTED" },
    { member: "DCMS-012", current: "Member", proposed: "Secretary", reason: "Took flawless minutes at every committee meeting.", achievements: "Never missed a meeting in 14 months.", status: "DRAFT" },
    { member: "DCMS-013", current: "Member", proposed: "Executive Member", reason: "Consistent presence and reliability across all productions.", achievements: "Cast in 3 productions; helped in 5 crew roles.", status: "REJECTED" },
    { member: "DCMS-014", current: "Member", proposed: "Stage Manager", reason: "Ran assistant stage management for the Natyotsab flawlessly.", achievements: "Cue book praised by the director.", status: "SUBMITTED" },
    { member: "DCMS-015", current: "Member", proposed: "Costumes & Wardrobe Lead", reason: "Designed costumes for the one-act festival on her own.", achievements: "12 costumes in 3 weeks.", status: "PENDING_APPROVAL" },
    { member: "DCMS-017", current: "Member", proposed: "Workshop Lead", reason: "Created a poetry-meets-theatre workshop for Borsha evenings.", achievements: "Ran 6 sold-out sessions at Rabindra Sarobar.", status: "SUBMITTED" },
    { member: "DCMS-018", current: "Member", proposed: "Publicity Lead", reason: "Produced the Ekushey tribute video single-handedly.", achievements: "Video crossed 50k views on the club page.", status: "PENDING_APPROVAL" },
    { member: "DCMS-019", current: "Member", proposed: "Treasurer", reason: "Reconciled all membership fees before the fall season.", achievements: "100% fee collection; clean ledger for two semesters.", status: "APPROVED" },
    { member: "DCMS-020", current: "Member", proposed: "Executive Member", reason: "Steadfast stage presence and volunteer coordination.", achievements: "Co-led front-of-house for the full Kobor run.", status: "SUBMITTED" },
    { member: "DCMS-016", current: "Member", proposed: "Executive Member", reason: "Led the mic and sound checks for every workshop this term.", achievements: "Zero sound faults across 6 events.", status: "SUBMITTED" },
    { member: "DCMS-022", current: "Member", proposed: "Costumes & Wardrobe Lead", reason: "Stepped up for the vintage saree collection drive.", achievements: "Collected 30+ period costumes.", status: "PENDING_APPROVAL" },
    { member: "DCMS-023", current: "Member", proposed: "Stage Manager", reason: "Ran the rehearsal schedule for the full Kobor run.", achievements: "Published 12 weekly schedules on time.", status: "APPROVED" },
    { member: "DCMS-026", current: "Member", proposed: "Treasurer", reason: "Handled Natyotsab ticket reconciliation impeccably.", achievements: "Balanced to the taka.", status: "SUBMITTED" },
    { member: "DCMS-027", current: "Member", proposed: "Tech Lead", reason: "Owned the sound setup for the Boishakhi main stage.", achievements: "Full PA rig deployed in one day.", status: "DRAFT" },
    { member: "DCMS-029", current: "Member", proposed: "Executive Member", reason: "Constant presence at script meetings and rewrites.", achievements: "Contributed to 3 successful scripts.", status: "REJECTED" },
    { member: "DCMS-031", current: "Member", proposed: "Workshop Lead", reason: "Coached 15 freshmen on audition monologues.", achievements: "4 freshmen cast in Kobor.", status: "SUBMITTED" },
    { member: "DCMS-055", current: "Member", proposed: "Executive Member", reason: "Coordinated all venue logistics across two seasons.", achievements: "Booked BRAC University Auditorium without a hitch.", status: "PENDING_APPROVAL" },
  ] as const;
  for (const p of promotionSeeds) {
    const memberId = memberMap[p.member].id;
    const submittedBy = memberMap[p.member] ?? demoUser;
    await prisma.promotionRequest.create({
      data: {
        memberId,
        currentRoleId: roles[p.current].id,
        proposedRoleId: roles[p.proposed].id,
        reason: p.reason,
        achievements: p.achievements || undefined,
        status: p.status as never,
        submittedById: submittedBy.userId,
        ...(["APPROVED", "REJECTED"].includes(p.status)
          ? { reviewedById: adminUser.id, reviewedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) }
          : {}),
      },
    });
  }

  // 14. Notifications
  console.log("Creating notifications...");
  const notifPool: [string, string, string, string, boolean][] = [
    ["PROMOTION", "Promotion update", "Your promotion to Production Coordinator was submitted for review.", "/dashboard/promotions", false],
    ["EVENT", "New event", "Auditions for Kobor were added to the calendar.", "/dashboard/events", true],
    ["ANNOUNCEMENT", "New announcement", "Welcome to the New Semester! was published.", "/dashboard/updates", false],
    ["GALLERY", "New media", "New photos were added to the Kobor Production album.", "/dashboard/gallery", true],
    ["REGISTRATION", "Recruitment update", "Fall 2026 Recruitment is now live.", "/dashboard/registration", false],
    ["EVENT", "Reminder", "Beginner Acting Workshop starts tomorrow at 2 PM in Seminar Room, BRAC University.", "/dashboard/events", false],
    ["GALLERY", "New media", "Behind the Scenes: Kobor album just got 4 new photos.", "/dashboard/gallery", true],
    ["PROMOTION", "Promotion approved", "Great news — your promotion was approved!", "/dashboard/promotions", false],
    ["ANNOUNCEMENT", "Cast announced", "The full cast for Kobor has been announced.", "/dashboard/updates", false],
    ["REGISTRATION", "New applicant", "A new application arrived for Fall 2026 Recruitment.", "/dashboard/registration", false],
    ["EVENT", "New event", "Borsha Poetry Evening was added to the calendar.", "/dashboard/events", true],
    ["GENERAL", "Welcome", "Welcome to the BRAC University Drama Club management console!", "/dashboard", false],
    ["EVENT", "Reminder", "Rabindra Sangeet Evening starts this Friday at Rabindra Sarobar.", "/dashboard/events", false],
    ["ANNOUNCEMENT", "Ekushey tribute", "Our February 21 tribute program schedule is out.", "/dashboard/updates", false],
  ];
  const mkNotifs = async (userId: string, count: number, seedIdx: number) => {
    // Deterministic selection (no Math.random) so every re-seed produces the
    // exact same notifications for the same receiver slot.
    const offset = seedIdx % notifPool.length;
    const picked = [...notifPool.slice(offset), ...notifPool.slice(0, offset)].slice(0, count);
    for (let i = 0; i < picked.length; i++) {
      const [type, title, message, link, read] = picked[i];
      await prisma.notification.create({
        data: {
          userId,
          type: type as never,
          title,
          message,
          link,
          readAt: read ? new Date(Date.now() - i * 3600_000) : null,
        },
      });
    }
  };
  await mkNotifs(demoUser.id, 10, 0);
  await mkNotifs(adminUser.id, 9, 1);
  let notifSlot = 2;
  for (const code of ["DCMS-001", "DCMS-002", "DCMS-003", "DCMS-007", "DCMS-008", "DCMS-013", "DCMS-017", "DCMS-018", "DCMS-024"]) {
    await mkNotifs(memberMap[code].userId, 5, notifSlot++);
  }

  // 15. Contact submissions
  console.log("Creating contact submissions...");
  const contacts = [
    { name: "Faculty Adviser — Dr. Anisur Rahman", email: "faculty@bracu.ac.bd", message: "Could the club reserve the BRAC University Auditorium for the welcome week showcase?" },
    { name: "Samia Afrin", email: "samia.afrin@bracu.ac.bd", message: "Hi! I'd love to volunteer backstage for Kobor. Who should I contact?" },
    { name: "Campus Events Office", email: "events.office@bracu.ac.bd", message: "Your costume storage room request has been approved. Pick up the key at the BRAC University office.", handled: true },
    { name: "Shilpokola Theatre Group", email: "info@shilpokola.org", message: "We'd love to host a joint jatra workshop with your club in October. Are you interested?" },
    { name: "Parent of Member", email: "parent@bracu.ac.bd", message: "How do I get a copy of the show program for the Kobor run?" },
    { name: "Press Office", email: "press@bracu.ac.bd", message: "We'd like to feature the club in the campus newsletter for the Boishakhi season. Who can we interview?" },
    { name: "Alumni Network", email: "alumni@bracu.ac.bd", message: "The alumni association can sponsor costume rental this semester.", handled: true },
    { name: "Venue Manager", email: "venue@shilpakala.gov.bd", message: "The Experimental Theatre Hall is free for your one-act festival — confirm by Friday.", handled: true },
    { name: "New Applicant", email: "curious.student@bracu.ac.bd", message: "Do I need any experience to join? I've never acted before." },
    { name: "Chhayanaut", email: "chhayanaut@chhayanaut.org", message: "We'd love to co-host a Rabindra sangeet evening with your music team in September." },
    { name: "Dhaka Tribune — Culture Desk", email: "culture@dhakatribune.com", message: "Can we do a story on your Liberation War drama season? Happy to visit a rehearsal." },
    { name: "Bondhon Jatra Party", email: "bondhon.jatra@gmail.com", message: "Our jatra troupe can offer a guest workshop on folk performance styles.", handled: true },
    { name: "BRAC University Registrar's Office", email: "registrar@bracu.ac.bd", message: "Your booking request for the BRAC University Auditorium is approved for the winter season.", handled: true },
    { name: "Prothom Alo — Lifestyle Desk", email: "lifestyle@prothomalo.com", message: "We'd like to feature your freshmen orientation play in the campus section." },
    { name: "BRAC University Cultural Society", email: "cult.society@bracu.ac.bd", message: "Joint cultural evening for Pahela Boishakh? Our music circle would love to collaborate.", handled: true },
    { name: "Parent of Applicant", email: "parent.of.oyshi@gmail.com", message: "Is there a registration fee for the acting camp this summer?" },
  ];
  for (const c of contacts) {
    await prisma.contactSubmission.create({
      data: {
        name: c.name,
        email: c.email,
        message: c.message,
        ...("handled" in c ? { handledAt: new Date(Date.now() - 3 * 24 * 3600_000) } : {}),
      },
    });
  }

  // 16. Audit log
  console.log("Creating audit log entries...");
  const auditSeeds = [
    ["role.created", "Role", roles.President.id, { name: "President" }],
    ["role.updated", "Role", roles["Executive Member"].id, { name: "Executive Member", permissions: 6 }],
    ["committee.created", "Committee", committee.id, { year: "2025-2026" }],
    ["promotion.approved", "PromotionRequest", "seed", { memberId: memberMap["DCMS-003"].id }],
    ["applicant.accepted", "Applicant", "seed", { name: "Shakil Mahmud" }],
    ["member.updated", "Member", demoMember.id, { status: "ACTIVE" }],
    ["member.created", "Member", memberMap["DCMS-007"].id, { code: "DCMS-007" }],
    ["event.created", "Event", "seed", { title: "Kobor — Opening Night" }],
    ["event.updated", "Event", "seed", { status: "UPCOMING" }],
    ["update.published", "ClubUpdate", "seed", { title: "Welcome to the New Semester!" }],
    ["galleryAlbum.created", "GalleryAlbum", "album-spring-2026", { name: "Kobor — Spring Production" }],
    ["applicant.converted", "Applicant", "seed", { name: "Tasnim Rahman" }],
    ["registrationWindow.updated", "RegistrationWindow", "window-fall-2026", { status: "LIVE" }],
    ["department.updated", "Department", departmentKeys["technical"], { coordinatorId: memberMap["DCMS-008"].id }],
    ["rolePermission.granted", "Role", roles["Tech Lead"].id, { permission: "events.manage" }],
    ["committeeMemberRole.created", "CommitteeMemberRole", "seed", { member: "Farhana Akter", role: "President" }],
    ["notification.sent", "Notification", "seed", { users: 9 }],
    ["settings.updated", "SystemSetting", "seed", { key: "clubName" }],
    ["member.suspended", "Member", memberMap["DCMS-028"].id, { status: "SUSPENDED" }],
    ["task.updated", "Task", "seed", { status: "DONE" }],
    ["contact.handled", "ContactSubmission", "seed", { handled: true }],
    ["promotion.rejected", "PromotionRequest", "seed", { memberId: memberMap["DCMS-006"].id }],
    ["committee.dissolved", "Committee", committee2023.id, { year: "2023-2024" }],
    ["galleryItem.deleted", "GalleryItem", "seed", { fileName: "photo-3.jpg" }],
    ["user.created", "User", memberMap["DCMS-030"].userId, { email: "mitu.akter@bracu.ac.bd" }],
    ["event.cancelled", "Event", "seed", { title: "Outdoor Film Night" }],
    ["update.deleted", "ClubUpdate", "seed", { title: "Old Post" }],
    ["applicant.rejected", "Applicant", "seed", { name: "Chaiti Roy" }],
    ["member.reactivated", "Member", memberMap["DCMS-021"].id, { status: "PENDING" }],
    ["role.deleted", "Role", "seed", { name: "Legacy Role" }],
    ["event.published", "Event", "seed", { title: "Ekushey February Program 2027" }],
    ["promotion.submitted", "PromotionRequest", "seed", { memberId: memberMap["DCMS-014"].id }],
    ["galleryAlbum.updated", "GalleryAlbum", "album-ekushey", { name: "Ekushey February 2026" }],
    ["department.created", "Department", "seed", { name: "Makeup & Hair" }],
    ["member.status_changed", "Member", memberMap["DCMS-004"].id, { from: "SUBMITTED", to: "PENDING" }],
    ["settings.updated", "SystemSetting", "seed", { key: "socialLinks" }],
    ["applicant.reviewed", "Applicant", "seed", { name: "Bristy Das", status: "UNDER_REVIEW" }],
    ["committeeMemberRole.ended", "CommitteeMemberRole", "seed", { member: "Rubel Mia", role: "President", committee: "2023-2024" }],
    ["event.created", "Event", "seed", { title: "Freshman Orientation Play — BRAC University" }],
    ["applicant.accepted", "Applicant", "seed", { name: "Farabi Chowdhury" }],
    ["galleryAlbum.created", "GalleryAlbum", "album-natyotsab", { name: "Winter Natyotsab" }],
    ["member.created", "Member", memberMap["DCMS-050"].id, { code: "DCMS-050" }],
    ["settings.updated", "SystemSetting", "seed", { key: "clubName", value: "BRAC University Drama Club" }],
    ["event.published", "Event", "seed", { title: "Open Mic Night" }],
  ] as const;
  for (const [action, entityType, entityId, metadata] of auditSeeds) {
    await prisma.auditLog.create({
      data: { actorId: adminUser.id, action, entityType, entityId, metadata: metadata as never },
    });
  }

  // 17. System settings
  console.log("Creating system settings...");
  const settings: [string, unknown][] = [
    ["clubName", "BRAC University Drama Club"],
    ["clubDescription", "BRAC University's own theatre troupe — from the Boishakhi Mela stalls to the Natyamela stage, and the Liberation War drama season."],
    ["contactEmail", "dramaclub@bracu.ac.bd"],
    ["contactPhone", "+880 2-2222-7880"],
    ["socialLinks", { instagram: "https://instagram.com/bracudrama", facebook: "https://facebook.com/bracudrama", youtube: "https://youtube.com/@bracudrama" }],
    ["registrationEnabled", true],
    ["maintenanceMode", false],
  ];
  for (const [key, value] of settings) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as never },
    });
  }

  console.log("Seed complete!");
  console.log("\nDemo accounts:");
  console.log("  Admin:  admin@dcms.local / admin123");
  console.log("  Member: demo@dcms.local / demo123");
  console.log("  Members: any DCMS-xxx member / member123 (e.g. rafiqul.islam@bracu.ac.bd)");
  const counts = {
    members: await prisma.member.count(),
    users: await prisma.user.count(),
    events: await prisma.event.count(),
    updates: await prisma.clubUpdate.count(),
    albums: await prisma.galleryAlbum.count(),
    galleryItems: await prisma.galleryItem.count(),
    applicants: await prisma.applicant.count(),
    promotions: await prisma.promotionRequest.count(),
    notifications: await prisma.notification.count(),
    contacts: await prisma.contactSubmission.count(),
    auditLogs: await prisma.auditLog.count(),
    tasks: await prisma.task.count(),
  };
  console.log("Row counts:", JSON.stringify(counts, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
