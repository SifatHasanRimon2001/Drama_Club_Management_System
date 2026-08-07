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
  await assignPerms(roles.Member.id, ["member.view", "department.view", "events.manage", "gallery.upload", "promotion.submit"]);
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

  // 5. Users + members
  console.log("Creating users and members...");
  type SeedMember = {
    name: string;
    email: string;
    code: string;
    status: "PENDING" | "ACTIVE" | "ALUMNI" | "INACTIVE" | "SUSPENDED";
    joined: string;
    phone: string;
    depts: string[]; // department keys, resolved later
    role?: string; // current committee role name
    pastRoles?: { committee: "c2023" | "c2024"; role: string }[];
  };

  const memberSeeds: SeedMember[] = [
    { name: "Sarah Chen", email: "sarah.chen@university.edu", code: "DCMS-001", status: "ACTIVE", joined: "2024-09-01", phone: "+14155550112", depts: ["performance"], role: "Production Coordinator" },
    { name: "James Okafor", email: "james.okafor@university.edu", code: "DCMS-002", status: "ACTIVE", joined: "2024-09-01", phone: "+14155550113", depts: ["publicity"], role: "Publicity Lead" },
    { name: "Priya Sharma", email: "priya.sharma@university.edu", code: "DCMS-003", status: "ACTIVE", joined: "2023-09-01", phone: "+14155550114", depts: ["creative-arts"], role: "President", pastRoles: [{ committee: "c2024", role: "Vice President" }, { committee: "c2023", role: "Secretary" }] },
    { name: "Mei Tanaka", email: "mei.tanaka@university.edu", code: "DCMS-004", status: "PENDING", joined: "2026-08-02", phone: "+14155550115", depts: ["technical"] },
    { name: "Alex Rivera", email: "alex.rivera@university.edu", code: "DCMS-005", status: "ALUMNI", joined: "2022-09-01", phone: "+14155550116", depts: ["performance"], pastRoles: [{ committee: "c2023", role: "Stage Manager" }] },
    { name: "Tom Becker", email: "tom.becker@university.edu", code: "DCMS-006", status: "INACTIVE", joined: "2023-09-01", phone: "+14155550117", depts: ["logistics"] },
    { name: "Elena Petrova", email: "elena.petrova@university.edu", code: "DCMS-007", status: "ACTIVE", joined: "2025-09-01", phone: "+14155550118", depts: ["creative-arts", "publicity"], role: "Vice President" },
    { name: "Marcus Webb", email: "marcus.webb@university.edu", code: "DCMS-008", status: "ACTIVE", joined: "2025-09-01", phone: "+14155550119", depts: ["technical"], role: "Tech Lead" },
    { name: "Fatima Al-Hassan", email: "fatima.alhassan@university.edu", code: "DCMS-009", status: "ACTIVE", joined: "2024-09-01", phone: "+14155550120", depts: ["stage-management"], role: "Stage Manager" },
    { name: "Diego Santos", email: "diego.santos@university.edu", code: "DCMS-010", status: "ACTIVE", joined: "2025-09-01", phone: "+14155550121", depts: ["publicity"], role: "Workshop Lead" },
    { name: "Hannah Lee", email: "hannah.lee@university.edu", code: "DCMS-011", status: "ACTIVE", joined: "2024-09-01", phone: "+14155550122", depts: ["costumes"], role: "Treasurer" },
    { name: "Omar Farouk", email: "omar.farouk@university.edu", code: "DCMS-012", status: "ACTIVE", joined: "2023-09-01", phone: "+14155550123", depts: ["music-sound"], role: "Secretary" },
    { name: "Lucy Bennett", email: "lucy.bennett@university.edu", code: "DCMS-013", status: "ACTIVE", joined: "2025-09-01", phone: "+14155550124", depts: ["performance", "creative-arts"] },
    { name: "Noah Williams", email: "noah.williams@university.edu", code: "DCMS-014", status: "ACTIVE", joined: "2025-09-01", phone: "+14155550125", depts: ["technical", "stage-management"] },
    { name: "Ingrid Larsen", email: "ingrid.larsen@university.edu", code: "DCMS-015", status: "ACTIVE", joined: "2024-09-01", phone: "+14155550126", depts: ["costumes", "makeup-hair"] },
    { name: "Samuel Adeyemi", email: "samuel.adeyemi@university.edu", code: "DCMS-016", status: "ACTIVE", joined: "2025-09-01", phone: "+14155550127", depts: ["music-sound"] },
    { name: "Yuki Sato", email: "yuki.sato@university.edu", code: "DCMS-017", status: "ACTIVE", joined: "2025-01-15", phone: "+14155550128", depts: ["creative-arts"] },
    { name: "Amelie Dubois", email: "amelie.dubois@university.edu", code: "DCMS-018", status: "ACTIVE", joined: "2024-09-01", phone: "+14155550129", depts: ["publicity"] },
    { name: "Rajesh Nair", email: "rajesh.nair@university.edu", code: "DCMS-019", status: "ACTIVE", joined: "2025-09-01", phone: "+14155550130", depts: ["logistics", "finance-records"] },
    { name: "Chloe Martin", email: "chloe.martin@university.edu", code: "DCMS-020", status: "ACTIVE", joined: "2025-09-01", phone: "+14155550131", depts: ["performance"] },
    { name: "Ahmed Raza", email: "ahmed.raza@university.edu", code: "DCMS-021", status: "PENDING", joined: "2026-07-20", phone: "+14155550132", depts: ["technical"] },
    { name: "Isabella Rossi", email: "isabella.rossi@university.edu", code: "DCMS-022", status: "ACTIVE", joined: "2023-09-01", phone: "+14155550133", depts: ["creative-arts", "music-sound"] },
    { name: "Kenji Nakamura", email: "kenji.nakamura@university.edu", code: "DCMS-023", status: "ACTIVE", joined: "2025-09-01", phone: "+14155550134", depts: ["stage-management"] },
    { name: "Sophie Turner", email: "sophie.turner@university.edu", code: "DCMS-024", status: "ACTIVE", joined: "2024-09-01", phone: "+14155550135", depts: ["makeup-hair", "costumes"] },
    { name: "Liam O'Connor", email: "liam.oconnor@university.edu", code: "DCMS-025", status: "ALUMNI", joined: "2021-09-01", phone: "+14155550136", depts: ["performance"], pastRoles: [{ committee: "c2023", role: "President" }] },
    { name: "Zara Ahmed", email: "zara.ahmed@university.edu", code: "DCMS-026", status: "ACTIVE", joined: "2025-09-01", phone: "+14155550137", depts: ["finance-records", "logistics"] },
    { name: "Peter Novak", email: "peter.novak@university.edu", code: "DCMS-027", status: "ACTIVE", joined: "2025-09-01", phone: "+14155550138", depts: ["technical"] },
    { name: "Nina Kovač", email: "nina.kovac@university.edu", code: "DCMS-028", status: "SUSPENDED", joined: "2024-09-01", phone: "+14155550139", depts: ["performance"] },
    { name: "George Frimpong", email: "george.frimpong@university.edu", code: "DCMS-029", status: "ACTIVE", joined: "2026-01-15", phone: "+14155550140", depts: ["creative-arts"] },
    { name: "Mia Johansson", email: "mia.johansson@university.edu", code: "DCMS-030", status: "PENDING", joined: "2026-08-05", phone: "+14155550141", depts: ["publicity"] },
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
    update: {},
    create: { name: "Admin User", email: "admin@dcms.local", passwordHash: adminPassword },
  });
  const adminMember = await prisma.member.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      memberCode: "DCMS-ADMIN01",
      phone: "+1234567890",
      status: "ACTIVE",
      joiningDate: new Date("2024-01-01"),
    },
  });
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@dcms.local" },
    update: {},
    create: { name: "Demo Member", email: "demo@dcms.local", passwordHash: await bcrypt.hash("demo123", 12) },
  });
  const demoMember = await prisma.member.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      memberCode: "DCMS-DEMO01",
      phone: "+0987654321",
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
    // update keeps the demo password deterministic on re-seeds.
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: { passwordHash: memberPassword },
      create: { name: s.name, email: s.email, passwordHash: memberPassword },
    });
    const member = await prisma.member.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        memberCode: s.code,
        phone: s.phone,
        status: s.status,
        joiningDate: new Date(s.joined),
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
  for (const code of ["DCMS-013", "DCMS-014", "DCMS-015", "DCMS-016", "DCMS-017", "DCMS-018", "DCMS-020", "DCMS-022", "DCMS-023", "DCMS-026", "DCMS-029"]) {
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
    { dept: "creative-arts", title: "Script reading session", description: "Read through the new play script", assignee: "DCMS-003", status: "DONE" },
    { dept: "technical", title: "Design stage layout", description: "Create technical drawings for the stage", status: "TODO", due: "2026-09-01" },
    { dept: "publicity", title: "Create social media posts", description: "Design promotional content for upcoming show", assignee: "DCMS-002", status: "IN_PROGRESS", due: "2026-08-15" },
    { dept: "creative-arts", title: "Draft audition monologues", description: "Prepare sides for the fall auditions", assignee: "DCMS-007", status: "DONE", due: "2026-07-30" },
    { dept: "performance", title: "Cast table read", description: "Full read-through with the cast", assignee: "DCMS-001", status: "DONE", due: "2026-08-03" },
    { dept: "stage-management", title: "Props inventory", description: "Catalog and repair existing props", assignee: "DCMS-009", status: "IN_PROGRESS", due: "2026-08-20" },
    { dept: "costumes", title: "Costume fittings week", description: "Book fittings for the full cast", assignee: "DCMS-011", status: "IN_PROGRESS", due: "2026-08-25" },
    { dept: "music-sound", title: "Score selection", description: "Pick underscore for the balcony scene", assignee: "DCMS-012", status: "TODO", due: "2026-09-05" },
    { dept: "makeup-hair", title: "Character makeup design", description: "Concept boards for the five leads", assignee: "DCMS-024", status: "TODO", due: "2026-09-10" },
    { dept: "finance-records", title: "Membership fee reconciliation", description: "Match payments to member records", assignee: "DCMS-019", status: "IN_PROGRESS", due: "2026-08-31" },
    { dept: "logistics", title: "Reserve Main Theatre dates", description: "Book venue for tech week and shows", assignee: "DCMS-006", status: "DONE", due: "2026-07-15" },
    { dept: "technical", title: "Lighting plot for Act 1", description: "Program cues for the first act", assignee: "DCMS-008", status: "TODO", due: "2026-09-12" },
    { dept: "publicity", title: "Design show poster", description: "Poster for Romeo & Juliet opening", assignee: "DCMS-018", status: "IN_PROGRESS", due: "2026-08-28" },
    { dept: "creative-arts", title: "Rewrite ending scene", description: "Tighten the final monologue", assignee: "DCMS-029", status: "TODO", due: "2026-09-02" },
    { dept: "stage-management", title: "Rehearsal schedule", description: "Publish weekly rehearsal schedule", assignee: "DCMS-023", status: "DONE", due: "2026-08-01" },
    { dept: "music-sound", title: "Mic check for musical numbers", description: "Wire and test lavalier mics", assignee: "DCMS-016", status: "TODO", due: "2026-09-15" },
  ];
  for (const t of taskSeeds) {
    const exists = await prisma.task.findFirst({ where: { title: t.title, departmentId: departmentKeys[t.dept] } });
    if (exists) continue;
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
    { title: "Spring Gala 2024", type: "PERFORMANCE", status: "COMPLETED", dept: "performance", start: "2024-05-10T19:00:00Z", end: "2024-05-10T22:00:00Z", location: "Grand Hall", description: "Our annual showcase of the year's best work." },
    { title: "Freshman Welcome Workshop", type: "WORKSHOP", status: "COMPLETED", dept: "creative-arts", start: "2024-09-07T14:00:00Z", end: "2024-09-07T17:00:00Z", location: "Studio A" },
    { title: "Romeo & Juliet — Fall 2024", type: "PERFORMANCE", status: "COMPLETED", dept: "performance", start: "2024-11-15T19:00:00Z", end: "2024-11-15T21:30:00Z", location: "Main Theatre" },
    { title: "Winter Improv Night", type: "FESTIVAL", status: "COMPLETED", dept: "performance", start: "2024-12-12T20:00:00Z", end: "2024-12-12T22:00:00Z", location: "Common Room" },
    { title: "Spring Gala", type: "PERFORMANCE", status: "COMPLETED", dept: "performance", start: "2026-05-10T19:00:00Z", end: "2026-05-10T22:00:00Z", location: "Grand Hall", description: "Our annual showcase of the year's best work." },
    { title: "One-Act Festival", type: "FESTIVAL", status: "COMPLETED", dept: "creative-arts", start: "2026-03-14T18:00:00Z", end: "2026-03-14T21:00:00Z", location: "Black Box" },
    { title: "Student Playwright Showcase", type: "AUDITION", status: "COMPLETED", dept: "creative-arts", start: "2026-04-02T16:00:00Z", end: "2026-04-02T19:00:00Z", location: "Studio B" },
    { title: "Costume Parade", type: "FESTIVAL", status: "COMPLETED", dept: "costumes", start: "2026-02-20T15:00:00Z", end: "2026-02-20T17:00:00Z", location: "Main Hall" },
    // Ongoing (August 2026)
    { title: "Dress Rehearsal — Romeo & Juliet", type: "REHEARSAL", status: "ONGOING", dept: "performance", start: "2026-08-07T18:00:00Z", end: "2026-08-07T22:00:00Z", location: "Main Theatre", description: "Full dress rehearsal with costumes and lighting." },
    { title: "Backstage Setup Week", type: "WORKSHOP", status: "ONGOING", dept: "stage-management", start: "2026-08-03T09:00:00Z", end: "2026-08-10T17:00:00Z", location: "Main Theatre" },
    // Upcoming
    { title: "Drama Workshop", type: "WORKSHOP", status: "UPCOMING", dept: "creative-arts", start: "2026-08-15T14:00:00Z", end: "2026-08-15T17:00:00Z", location: "Main Hall", description: "Beginner acting workshop — no experience needed." },
    { title: "Acting Intensive", type: "TRAINING", status: "UPCOMING", dept: "performance", start: "2026-08-22T10:00:00Z", end: "2026-08-22T17:00:00Z", location: "Studio B", description: "A full-day acting masterclass with a guest director." },
    { title: "Backstage Tour & Open House", type: "FESTIVAL", status: "UPCOMING", dept: "creative-arts", start: "2026-08-29T11:00:00Z", end: "2026-08-29T15:00:00Z", location: "Theatre Building", description: "Peek behind the curtain with guided backstage tours." },
    { title: "Auditions for Fall Play", type: "AUDITION", status: "UPCOMING", dept: "performance", start: "2026-09-01T10:00:00Z", end: "2026-09-01T16:00:00Z", location: "Stage", description: "Open auditions for the fall production." },
    { title: "Tech Rehearsal", type: "REHEARSAL", status: "UPCOMING", dept: "technical", start: "2026-09-10T18:00:00Z", end: "2026-09-10T22:00:00Z", location: "Main Stage" },
    { title: "Romeo & Juliet — Opening Night", type: "PERFORMANCE", status: "UPCOMING", dept: "performance", start: "2026-09-20T19:00:00Z", end: "2026-09-20T21:30:00Z", location: "Main Theatre", description: "The fall production opens to the public. Tickets at the door." },
    { title: "Romeo & Juliet — Matinee", type: "PERFORMANCE", status: "UPCOMING", dept: "performance", start: "2026-09-26T14:00:00Z", end: "2026-09-26T16:30:00Z", location: "Main Theatre" },
    { title: "Stage Combat Workshop", type: "WORKSHOP", status: "UPCOMING", dept: "performance", start: "2026-10-03T13:00:00Z", end: "2026-10-03T16:00:00Z", location: "Studio A" },
    { title: "Halloween One-Acts", type: "PERFORMANCE", status: "UPCOMING", dept: "performance", start: "2026-10-30T19:00:00Z", end: "2026-10-30T21:00:00Z", location: "Black Box" },
    { title: "Audio Engineering Basics", type: "TRAINING", status: "UPCOMING", dept: "music-sound", start: "2026-11-07T14:00:00Z", end: "2026-11-07T17:00:00Z", location: "Tech Booth" },
    { title: "Winter Showcase Auditions", type: "AUDITION", status: "UPCOMING", dept: "creative-arts", start: "2026-11-21T10:00:00Z", end: "2026-11-21T15:00:00Z", location: "Studio B" },
    { title: "Winter Showcase", type: "PERFORMANCE", status: "UPCOMING", dept: "performance", start: "2026-12-11T19:00:00Z", end: "2026-12-11T21:30:00Z", location: "Main Theatre" },
    { title: "New Year Improv Jam", type: "FESTIVAL", status: "UPCOMING", dept: "performance", start: "2027-01-15T20:00:00Z", end: "2027-01-15T22:00:00Z", location: "Common Room" },
    { title: "Makeup Masterclass", type: "TRAINING", status: "UPCOMING", dept: "makeup-hair", start: "2027-02-06T14:00:00Z", end: "2027-02-06T17:00:00Z", location: "Studio A" },
    { title: "Spring 2027 Gala", type: "PERFORMANCE", status: "UPCOMING", dept: "performance", start: "2027-05-08T19:00:00Z", end: "2027-05-08T22:00:00Z", location: "Grand Hall" },
    // Drafts + cancelled
    { title: "TBA: Podcast Pilot", type: "WORKSHOP", status: "DRAFT", dept: "publicity", start: "2027-03-01T18:00:00Z", end: "2027-03-01T20:00:00Z", location: "Office" },
    { title: "TBA: Improv Retreat", type: "TRAINING", status: "DRAFT", dept: "performance", start: "2027-04-10T09:00:00Z", end: "2027-04-10T17:00:00Z", location: "Off-campus" },
    { title: "Cancelled: Outdoor Film Night", type: "FESTIVAL", status: "CANCELLED", dept: "logistics", start: "2026-09-04T19:00:00Z", end: "2026-09-04T22:00:00Z", location: "Quad" },
    { title: "Cancelled: Guest Director Talk", type: "WORKSHOP", status: "CANCELLED", dept: "creative-arts", start: "2026-07-18T17:00:00Z", end: "2026-07-18T19:00:00Z", location: "Main Hall" },
  ];
  for (const e of eventSeeds) {
    const exists = await prisma.event.findFirst({ where: { title: e.title } });
    if (exists) continue;
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
      id: "window-fall-2025", title: "Fall 2025 Recruitment", description: "Join our drama club for the fall semester!",
      start: "2025-09-01", end: "2025-09-30", status: "CLOSED",
    },
    {
      id: "window-spring-2026", title: "Spring 2026 Recruitment", description: "Mid-year intake for the spring production season.",
      start: "2026-02-01", end: "2026-02-28", status: "CLOSED",
    },
    {
      id: "window-fall-2026", title: "Fall 2026 Recruitment", description: "Join our drama club for the fall semester!",
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
    await prisma.registrationWindow.upsert({
      where: { id: w.id },
      update: {},
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
    "Lena Fischer", "Daniel Kim", "Amara Osei", "Ravi Patel", "Grace Liu", "Owen Clarke", "Maya Singh", "Leo Martins",
    "Aisha Bello", "Jonas Weber", "Clara Schmidt", "Nadia Haddad", "Felix Braun", "Sofia Costa", "Ethan Park",
    "Ruby Nguyen", "Adam Kowalski", "Leila Rahimi", "Victor Hugo", "Marta Silva", "Ivan Petrov", "Hana Kimura",
    "Oliver Gray", "Freya Hall", "Diego Moreno", "Elif Yilmaz", "Arjun Mehta", "Tara Doyle",
  ];
  const statusPool = ["SUBMITTED", "SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "REJECTED"] as const;
  const skillsPool = ["Acting", "Singing", "Dancing", "Lighting", "Sound", "Writing", "Design", "Improv", "Costume", "Stage Management"];

  const applyPerWindow = async (windowId: string, startIdx: number, count: number, statuses: readonly (typeof statusPool)[number][]) => {
    for (let i = 0; i < count; i++) {
      const idx = startIdx + i;
      const name = applicantNamePool[idx % applicantNamePool.length];
      const email = `${name.toLowerCase().replace(/[^a-z]+/g, ".")}.${idx + 1}@university.edu`;
      const status = statuses[i % statuses.length];
      const exists = await prisma.applicant.findUnique({
        where: { registrationWindowId_email: { registrationWindowId: windowId, email } },
      });
      if (exists) continue;
      const prefs = [departmentKeys["performance"], departmentKeys["creative-arts"]].slice(0, 1 + (idx % 2));
      await prisma.applicant.create({
        data: {
          registrationWindowId: windowId,
          name,
          email,
          phone: `+1555${String(1000000 + idx * 137).slice(0, 7)}`,
          studentId: `S-${String(10000 + idx * 977)}`,
          departmentPrefs: prefs,
          skills: [skillsPool[idx % skillsPool.length], skillsPool[(idx + 3) % skillsPool.length]].slice(0, 1 + (idx % 2)),
          actingExperience: idx % 3 === 0 ? "High school theatre club, 2 years." : undefined,
          customResponses: {
            whyJoin: "I've always loved storytelling and want to grow as a performer.",
            experience: idx % 2 === 0 ? "School plays and improv nights." : "No formal experience yet.",
          },
          status,
        },
      });
    }
  };

  const fall2025 = await prisma.registrationWindow.findUnique({ where: { id: "window-fall-2025" } });
  const spring2026 = await prisma.registrationWindow.findUnique({ where: { id: "window-spring-2026" } });
  const fall2026 = await prisma.registrationWindow.findUnique({ where: { id: "window-fall-2026" } });
  if (fall2025) await applyPerWindow(fall2025.id, 0, 14, ["ACCEPTED", "CONVERTED", "ACCEPTED", "REJECTED", "CONVERTED"] as never);
  if (spring2026) await applyPerWindow(spring2026.id, 14, 16, ["ACCEPTED", "CONVERTED", "UNDER_REVIEW", "REJECTED", "SUBMITTED"] as never);
  if (fall2026) await applyPerWindow(fall2026.id, 30, 22, statusPool as never);

  // Link every unlinked CONVERTED applicant to a real member profile.
  // (Idempotent: once convertedMemberId is set, the applicant is skipped.)
  const convertedApplicants = await prisma.applicant.findMany({
    where: { status: "CONVERTED", convertedMemberId: null },
  });
  for (const a of convertedApplicants) {
    const existing = await prisma.member.findFirst({ where: { user: { email: a.email } } });
    if (existing) continue;
    const user = await prisma.user.upsert({
      where: { email: a.email },
      update: {},
      create: { name: a.name, email: a.email, passwordHash: memberPassword },
    });
    const member = await prisma.member.create({
      data: {
        userId: user.id,
        memberCode: `DCMS-CONV-${a.email.slice(0, 2).toUpperCase()}-${a.id.slice(-4)}`,
        status: "ACTIVE",
        joiningDate: new Date("2025-10-01"),
        sourceApplicant: { connect: { id: a.id } },
      },
    });
    await assignDept(member.id, "performance");
  }

  // 11. Club updates
  console.log("Creating club updates...");
  const updateSeeds = [
    { title: "Welcome to the New Semester!", body: "<p>We are excited to announce the start of a new drama season. Stay tuned for auditions and workshops!</p>", category: "ANNOUNCEMENT", at: "2026-08-01" },
    { title: "Cast Announced for Romeo & Juliet", body: "<p>We are thrilled to announce the full cast for this fall's production. Rehearsals begin August 10th — see you on stage!</p>", category: "PRODUCTION", at: "2026-07-25" },
    { title: "Summer Workshop Series", body: "<p>Join us every Saturday in August for our open workshop series. Beginners welcome, no experience needed.</p>", category: "EVENT", at: "2026-07-20" },
    { title: "Congratulations, Graduates!", body: "<p>Best of luck to our graduating members. The stage will miss you — but the alumni network is always open.</p>", category: "ACHIEVEMENT", at: "2026-06-15" },
    { title: "Spring Gala Recap", body: "<p>Thank you to everyone who made the Spring Gala unforgettable. Photos are up in the gallery!</p>", category: "ACHIEVEMENT", at: "2026-05-15" },
    { title: "Audition Tips from Our Director", body: "<p>Preparing for fall auditions? Our director shares a few tips: be off-book, make bold choices, and have fun.</p>", category: "NOTICE", at: "2026-08-10" },
    { title: "New Workshop Lead Appointed", body: "<p>Please welcome Diego Santos as our new Workshop Lead. Diego will run the Saturday series.</p>", category: "ANNOUNCEMENT", at: "2026-07-05" },
    { title: "Recruitment is Open!", body: "<p>The Fall 2026 recruitment window is live. Applications close August 31st — apply on the Recruitment page.</p>", category: "RECRUITMENT", at: "2026-08-01" },
    { title: "Costume Drive", body: "<p>We're collecting vintage clothing for the costume department. Drop-offs welcome at the office.</p>", category: "NOTICE", at: "2026-07-12" },
    { title: "Behind the Scenes: Tech Week", body: "<p>Follow along as our tech crew builds the world of Romeo & Juliet in the theatre this week.</p>", category: "PRODUCTION", at: "2026-08-08" },
    { title: "Member Spotlight: Priya Sharma", body: "<p>This month we celebrate Priya Sharma, our president, who has led the club through two banner seasons.</p>", category: "ACHIEVEMENT", at: "2026-06-01" },
    { title: "Holiday Break Hours", body: "<p>The theatre office will close for the winter break from December 20 to January 5.</p>", category: "NOTICE", at: "2026-12-10" },
    { title: "Spring 2027 Season Announcement", body: "<p>Our spring season will feature the gala, a one-act festival, and a student-written showcase.</p>", category: "PRODUCTION", at: "2027-01-10" },
    { title: "Volunteer Call: Front of House", body: "<p>We need ushers and ticket scanners for the fall run. Sign up by emailing the logistics team.</p>", category: "RECRUITMENT", at: "2026-08-20" },
    { title: "Alumni Night Invitation", body: "<p>All alumni are invited to the December showcase. RSVP through the contact page.</p>", category: "EVENT", at: "2026-11-01" },
    { title: "Thanksgiving Potluck", body: "<p>Join the club for our annual potluck on the Wednesday before the break. Bring a dish!</p>", category: "EVENT", at: "2026-11-15" },
  ] as const;
  for (const u of updateSeeds) {
    const exists = await prisma.clubUpdate.findFirst({ where: { title: u.title } });
    if (exists) continue;
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
    { id: "album-spring-2026", name: "Spring 2026 Production", category: "PRODUCTIONS", dept: "creative-arts" },
    { id: "album-workshops-2026", name: "Summer Workshops", category: "WORKSHOPS", dept: "creative-arts" },
    { id: "album-behind-scenes", name: "Behind the Scenes", category: "BEHIND_THE_SCENES", dept: "technical" },
    { id: "album-festivals", name: "Campus Festivals", category: "FESTIVALS", dept: "publicity" },
    { id: "album-club-life", name: "Club Life", category: "CLUB_LIFE", dept: null },
    { id: "album-rehearsals", name: "Rehearsal Room", category: "REHEARSALS", dept: "performance" },
    { id: "album-music-night", name: "Music Night", category: "FESTIVALS", dept: "music-sound" },
    { id: "album-graduation", name: "Graduation 2026", category: "CLUB_LIFE", dept: null },
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
  const captions = ["Opening night curtain call", "Backstage hustle", "First read-through", "Set build in progress", "Costume fittings", "Candid moments", "Tech check", "Post-show celebration"];
  const albums = await prisma.galleryAlbum.findMany();
  const itemCount = await prisma.galleryItem.count();
  if (itemCount === 0) {
    for (const album of albums) {
      const n = album.id === "album-spring-2026" ? 6 : 4;
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
  }

  // 13. Promotions
  console.log("Creating promotion requests...");
  const promotionSeeds = [
    { member: "demo", current: "Member", proposed: "Production Coordinator", reason: "Consistently led workshop sessions and mentored new members all semester.", achievements: "Organized 4 beginner workshops; ran onboarding for 12 new members.", status: "DRAFT" },
    { member: "DCMS-001", current: "Member", proposed: "Executive Member", reason: "Took ownership of the fall production's costume department without supervision.", achievements: "Delivered costumes for the fall play 2 weeks ahead of schedule.", status: "SUBMITTED" },
    { member: "DCMS-002", current: "Executive Member", proposed: "Production Coordinator", reason: "Led the publicity campaign that sold out the spring gala.", achievements: "Campaign reached 50k impressions; gala sold out in 3 days.", status: "PENDING_APPROVAL" },
    { member: "DCMS-003", current: "Executive Member", proposed: "President", reason: "Stepped in as acting president during the midterm reorganization.", achievements: "Ran committee meetings and balanced the club budget.", status: "APPROVED" },
    { member: "DCMS-006", current: "Member", proposed: "Executive Member", reason: "Requested executive role despite limited recent involvement.", achievements: "", status: "REJECTED" },
    { member: "DCMS-007", current: "Member", proposed: "Vice President", reason: "Showed strong leadership in planning the summer workshop series.", achievements: "Coordinated the 8-week summer series with 90+ attendances.", status: "SUBMITTED" },
    { member: "DCMS-008", current: "Member", proposed: "Tech Lead", reason: "Single-handedly rebuilt the lighting rig before the gala.", achievements: "New LED rig; zero technical faults during the gala.", status: "PENDING_APPROVAL" },
    { member: "DCMS-009", current: "Stage Manager", proposed: "Production Coordinator", reason: "Ran two smooth productions back to back as stage manager.", achievements: "Both shows opened on time with flawless scene changes.", status: "APPROVED" },
    { member: "DCMS-010", current: "Member", proposed: "Workshop Lead", reason: "Created an accessible workshop curriculum for beginners.", achievements: "Wrote 12 lesson plans; retention up 40%.", status: "APPROVED" },
    { member: "DCMS-011", current: "Member", proposed: "Treasurer", reason: "Balanced the books for the costume department all year.", achievements: "Tracked a $4k budget with zero discrepancies.", status: "SUBMITTED" },
    { member: "DCMS-012", current: "Member", proposed: "Secretary", reason: "Took flawless minutes at every committee meeting.", achievements: "Never missed a meeting in 14 months.", status: "DRAFT" },
    { member: "DCMS-013", current: "Member", proposed: "Executive Member", reason: "Consistent presence and reliability across all productions.", achievements: "Cast in 3 productions; helped in 5 crew roles.", status: "REJECTED" },
    { member: "DCMS-014", current: "Member", proposed: "Stage Manager", reason: "Ran assistant stage management for the gala flawlessly.", achievements: "Cue book praised by the director.", status: "SUBMITTED" },
    { member: "DCMS-015", current: "Member", proposed: "Costumes & Wardrobe Lead", reason: "Designed costumes for the one-act festival on her own.", achievements: "12 costumes in 3 weeks.", status: "PENDING_APPROVAL" },
  ] as const;
  for (const p of promotionSeeds) {
    const memberId = memberMap[p.member].id;
    const exists = await prisma.promotionRequest.findFirst({
      where: { memberId, status: p.status as never, currentRoleId: roles[p.current].id, proposedRoleId: roles[p.proposed].id },
    });
    if (exists) continue;
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
    ["EVENT", "New event", "Auditions for Fall Play were added to the calendar.", "/dashboard/events", true],
    ["ANNOUNCEMENT", "New announcement", "Welcome to the New Semester! was published.", "/dashboard/updates", false],
    ["GALLERY", "New media", "New photos were added to the Spring 2026 Production album.", "/dashboard/gallery", true],
    ["REGISTRATION", "Recruitment update", "Fall 2026 Recruitment is now live.", "/dashboard/registration", false],
    ["EVENT", "Reminder", "Drama Workshop starts tomorrow at 2 PM in Main Hall.", "/dashboard/events", false],
    ["GALLERY", "New media", "Behind the Scenes album just got 4 new photos.", "/dashboard/gallery", true],
    ["PROMOTION", "Promotion approved", "Great news — your promotion was approved!", "/dashboard/promotions", false],
    ["ANNOUNCEMENT", "Cast announced", "The full cast for Romeo & Juliet has been announced.", "/dashboard/updates", false],
    ["REGISTRATION", "New applicant", "A new application arrived for Fall 2026 Recruitment.", "/dashboard/registration", false],
    ["EVENT", "New event", "Backstage Tour & Open House was added to the calendar.", "/dashboard/events", true],
    ["GENERAL", "Welcome", "Welcome to the Drama Club management console!", "/dashboard", false],
  ];
  const mkNotifs = async (userId: string, count: number) => {
    const existing = await prisma.notification.count({ where: { userId } });
    if (existing > 0) return;
    const picked = [...notifPool].sort(() => Math.random() - 0.5).slice(0, count);
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
  await mkNotifs(demoUser.id, 9);
  await mkNotifs(adminUser.id, 8);
  for (const code of ["DCMS-001", "DCMS-002", "DCMS-003", "DCMS-007", "DCMS-008", "DCMS-013", "DCMS-017"]) {
    await mkNotifs(memberMap[code].userId, 4);
  }

  // 15. Contact submissions
  console.log("Creating contact submissions...");
  const contactCount = await prisma.contactSubmission.count();
  if (contactCount === 0) {
    const contacts = [
      { name: "Faculty Adviser", email: "faculty@university.edu", message: "Could the club reserve the Main Theatre for the welcome week showcase?" },
      { name: "Amara Osei", email: "amara.osei@university.edu", message: "Hi! I'd love to volunteer backstage for the fall production. Who should I contact?" },
      { name: "Campus Events Office", email: "events.office@university.edu", message: "Your costume storage room request has been approved. Pick up the key at the office.", handled: true },
      { name: "Local Theatre Co.", email: "hello@littletheatre.org", message: "We'd love to host a joint workshop with your club in October. Are you interested?" },
      { name: "Parent of Member", email: "parent@university.edu", message: "How do I get a copy of the show program for the fall production?" },
      { name: "Press Office", email: "press@university.edu", message: "We'd like to feature the club in the campus newsletter. Who can we interview?" },
      { name: "Alumni Network", email: "alumni@university.edu", message: "The alumni association can sponsor costume rental this semester.", handled: true },
      { name: "Venue Manager", email: "venue@university.edu", message: "The Black Box is free for your one-act festival — confirm by Friday.", handled: true },
      { name: "New Applicant", email: "curious.student@university.edu", message: "Do I need any experience to join? I've never acted before." },
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
  }

  // 16. Audit log
  console.log("Creating audit log entries...");
  const auditCount = await prisma.auditLog.count();
  if (auditCount < 10) {
    const auditSeeds = [
      ["role.created", "Role", roles.President.id, { name: "President" }],
      ["role.updated", "Role", roles["Executive Member"].id, { name: "Executive Member", permissions: 6 }],
      ["committee.created", "Committee", committee.id, { year: "2025-2026" }],
      ["promotion.approved", "PromotionRequest", "seed", { memberId: memberMap["DCMS-003"].id }],
      ["applicant.accepted", "Applicant", "seed", { name: "Ravi Patel" }],
      ["member.updated", "Member", demoMember.id, { status: "ACTIVE" }],
      ["member.created", "Member", memberMap["DCMS-007"].id, { code: "DCMS-007" }],
      ["event.created", "Event", "seed", { title: "Romeo & Juliet — Opening Night" }],
      ["event.updated", "Event", "seed", { status: "UPCOMING" }],
      ["update.published", "ClubUpdate", "seed", { title: "Welcome to the New Semester!" }],
      ["galleryAlbum.created", "GalleryAlbum", "album-spring-2026", { name: "Spring 2026 Production" }],
      ["applicant.converted", "Applicant", "seed", { name: "Elena Petrova" }],
      ["registrationWindow.updated", "RegistrationWindow", "window-fall-2026", { status: "LIVE" }],
      ["department.updated", "Department", departmentKeys["technical"], { coordinatorId: memberMap["DCMS-008"].id }],
      ["rolePermission.granted", "Role", roles["Tech Lead"].id, { permission: "events.manage" }],
      ["committeeMemberRole.created", "CommitteeMemberRole", "seed", { member: "Priya Sharma", role: "President" }],
      ["notification.sent", "Notification", "seed", { users: 7 }],
      ["settings.updated", "SystemSetting", "seed", { key: "clubName" }],
      ["member.suspended", "Member", memberMap["DCMS-028"].id, { status: "SUSPENDED" }],
      ["task.updated", "Task", "seed", { status: "DONE" }],
      ["contact.handled", "ContactSubmission", "seed", { handled: true }],
      ["promotion.rejected", "PromotionRequest", "seed", { memberId: memberMap["DCMS-006"].id }],
      ["committee.dissolved", "Committee", committee2023.id, { year: "2023-2024" }],
      ["galleryItem.deleted", "GalleryItem", "seed", { fileName: "photo-3.jpg" }],
      ["user.created", "User", memberMap["DCMS-030"].userId, { email: "mia.johansson@university.edu" }],
      ["event.cancelled", "Event", "seed", { title: "Outdoor Film Night" }],
      ["update.deleted", "ClubUpdate", "seed", { title: "Old Post" }],
      ["applicant.rejected", "Applicant", "seed", { name: "Grace Liu" }],
      ["member.reactivated", "Member", memberMap["DCMS-021"].id, { status: "PENDING" }],
      ["role.deleted", "Role", "seed", { name: "Legacy Role" }],
    ] as const;
    for (const [action, entityType, entityId, metadata] of auditSeeds) {
      await prisma.auditLog.create({
        data: { actorId: adminUser.id, action, entityType, entityId, metadata: metadata as never },
      });
    }
  }

  // 17. System settings
  console.log("Creating system settings...");
  const settings: [string, unknown][] = [
    ["clubName", "Drama Club"],
    ["clubDescription", "Where passion meets the stage — join a community of storytellers, performers and creators."],
    ["contactEmail", "dramaclub@university.edu"],
    ["contactPhone", "+1 (555) 010-2030"],
    ["socialLinks", { instagram: "https://instagram.com/dramaclub", facebook: "https://facebook.com/dramaclub", youtube: "https://youtube.com/@dramaclub" }],
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
  console.log("  Members: any DCMS-xxx member / member123 (e.g. sarah.chen@university.edu)");
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
    tasks: await prisma.task.count(),
    auditLogs: await prisma.auditLog.count(),
    contacts: await prisma.contactSubmission.count(),
  };
  console.log("Dataset:", JSON.stringify(counts));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
