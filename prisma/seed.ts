import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PERMISSIONS_LIST = [
  "member.view",
  "member.create",
  "member.edit",
  "department.view",
  "department.manage",
  "committee.manage",
  "registration.manage",
  "registration.review",
  "promotion.submit",
  "promotion.approve",
  "gallery.upload",
  "gallery.manage",
  "updates.publish",
  "events.manage",
  "permissions.manage",
  "settings.manage",
];

async function main() {
  console.log("Seeding database...");

  // 1. Seed permissions
  console.log("Seeding permissions...");
  for (const key of PERMISSIONS_LIST) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }
  console.log(`Seeded ${PERMISSIONS_LIST.length} permissions`);

  // 2. Create admin user
  console.log("Creating admin user...");
  const adminPassword = await bcrypt.hash("admin123", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@dcms.local" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@dcms.local",
      passwordHash: adminPassword,
    },
  });

  // 3. Create admin role with all permissions
  console.log("Creating admin role...");
  const allPermissions = await prisma.permission.findMany();
  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {},
    create: {
      name: "Admin",
      description: "Full system administrator",
    },
  });

  // Assign all permissions to admin role
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }

  // 4. Create admin member
  console.log("Creating admin member...");
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

  // 5. Create current committee
  console.log("Creating current committee...");
  const committee = await prisma.committee.upsert({
    where: { id: "current-committee" },
    update: {},
    create: {
      id: "current-committee",
      year: "2025-2026",
      startDate: new Date("2025-01-01"),
      isCurrent: true,
    },
  });

  // 6. Assign admin role to admin member in current committee
  await prisma.committeeMemberRole.upsert({
    where: {
      committeeId_memberId_roleId: {
        committeeId: committee.id,
        memberId: adminMember.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      committeeId: committee.id,
      memberId: adminMember.id,
      roleId: adminRole.id,
    },
  });

  // 7. Create PRD-specified departments (5 departments)
  console.log("Creating departments...");
  const creativeArtsDept = await prisma.department.upsert({
    where: { id: "dept-creative-arts" },
    update: {},
    create: {
      id: "dept-creative-arts",
      name: "Creative Arts",
      description: "Script writing, directing, and creative design",
      committeeId: committee.id,
      coordinatorId: adminMember.id,
    },
  });

  const technicalDept = await prisma.department.upsert({
    where: { id: "dept-technical" },
    update: {},
    create: {
      id: "dept-technical",
      name: "Technical",
      description: "Stage design, lighting, and sound",
      committeeId: committee.id,
    },
  });

  const performanceDept = await prisma.department.upsert({
    where: { id: "dept-performance" },
    update: {},
    create: {
      id: "dept-performance",
      name: "Performance",
      description: "Acting, rehearsals, and stage performance",
      committeeId: committee.id,
    },
  });

  const publicityDept = await prisma.department.upsert({
    where: { id: "dept-publicity" },
    update: {},
    create: {
      id: "dept-publicity",
      name: "Publicity",
      description: "Marketing, social media, and outreach",
      committeeId: committee.id,
    },
  });

  const logisticsDept = await prisma.department.upsert({
    where: { id: "dept-logistics" },
    update: {},
    create: {
      id: "dept-logistics",
      name: "Logistics",
      description: "Event coordination, venue, and equipment management",
      committeeId: committee.id,
    },
  });

  // 8. Assign admin to Creative Arts department
  await prisma.memberDepartment.upsert({
    where: { memberId_departmentId: { memberId: adminMember.id, departmentId: creativeArtsDept.id } },
    update: {},
    create: { memberId: adminMember.id, departmentId: creativeArtsDept.id },
  });

  // 9. Create sample tasks
  console.log("Creating sample tasks...");
  const task1 = await prisma.task.findFirst({ where: { title: "Script reading session", departmentId: creativeArtsDept.id } });
  if (!task1) {
    await prisma.task.createMany({
      data: [
        {
          departmentId: creativeArtsDept.id,
          title: "Script reading session",
          description: "Read through the new play script",
          assigneeId: adminMember.id,
          status: "DONE",
        },
        {
          departmentId: technicalDept.id,
          title: "Design stage layout",
          description: "Create technical drawings for the stage",
          status: "TODO",
          dueDate: new Date("2026-09-01"),
        },
        {
          departmentId: publicityDept.id,
          title: "Create social media posts",
          description: "Design promotional content for upcoming show",
          status: "IN_PROGRESS",
          dueDate: new Date("2026-08-15"),
        },
      ],
    });
  }

  // 10. Create sample events
  console.log("Creating sample events...");
  const event1 = await prisma.event.findFirst({ where: { title: "Drama Workshop" } });
  if (!event1) {
    await prisma.event.createMany({
      data: [
        {
          title: "Drama Workshop",
          type: "WORKSHOP",
          departmentId: creativeArtsDept.id,
          startAt: new Date("2026-08-15T14:00:00Z"),
          endAt: new Date("2026-08-15T17:00:00Z"),
          location: "Main Hall",
          description: "Beginner acting workshop",
        },
        {
          title: "Auditions for Fall Play",
          type: "AUDITION",
          departmentId: performanceDept.id,
          startAt: new Date("2026-09-01T10:00:00Z"),
          endAt: new Date("2026-09-01T16:00:00Z"),
          location: "Stage",
          description: "Open auditions for the fall production",
        },
        {
          title: "Tech Rehearsal",
          type: "REHEARSAL",
          departmentId: technicalDept.id,
          startAt: new Date("2026-09-10T18:00:00Z"),
          endAt: new Date("2026-09-10T22:00:00Z"),
          location: "Main Stage",
        },
      ],
    });
  }

  // 11. Create sample registration window
  console.log("Creating sample registration window...");
  const regWindow = await prisma.registrationWindow.findFirst({ where: { title: "Fall 2026 Recruitment" } });
  if (!regWindow) {
    await prisma.registrationWindow.create({
      data: {
        title: "Fall 2026 Recruitment",
        description: "Join our drama club for the fall semester!",
        startDate: new Date("2026-08-01"),
        endDate: new Date("2026-08-31"),
        status: "LIVE",
        formSchema: {
          fields: [
            { name: "whyJoin", type: "textarea", label: "Why do you want to join?", required: true },
            { name: "experience", type: "textarea", label: "Previous experience", required: false },
          ],
        },
      },
    });
  }

  // 12. Create sample club update
  console.log("Creating sample club update...");
  const update = await prisma.clubUpdate.findFirst({ where: { title: "Welcome to the New Semester!" } });
  if (!update) {
    await prisma.clubUpdate.create({
      data: {
        title: "Welcome to the New Semester!",
        bodyRichText: "<p>We are excited to announce the start of a new drama season. Stay tuned for auditions and workshops!</p>",
        category: "ANNOUNCEMENT",
        publishedAt: new Date(),
        authorId: adminUser.id,
      },
    });
  }

  // 13. Create sample gallery album
  console.log("Creating sample gallery album...");
  await prisma.galleryAlbum.upsert({
    where: { id: "album-spring-2026" },
    update: {},
    create: {
      id: "album-spring-2026",
      name: "Spring 2026 Production",
      category: "PRODUCTIONS",
      departmentId: creativeArtsDept.id,
    },
  });

  // 14. Create demo member
  console.log("Creating demo member...");
  const demoPassword = await bcrypt.hash("demo123", 12);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@dcms.local" },
    update: {},
    create: {
      name: "Demo Member",
      email: "demo@dcms.local",
      passwordHash: demoPassword,
    },
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

  // Assign member role
  const memberRole = await prisma.role.upsert({
    where: { name: "Member" },
    update: {},
    create: {
      name: "Member",
      description: "Regular club member",
    },
  });

  // Add basic permissions to member role
  const memberPermissions = [
    "member.view",
    "department.view",
    "events.manage",
    "gallery.upload",
    "promotion.submit",
  ];
  for (const key of memberPermissions) {
    const perm = await prisma.permission.findUnique({ where: { key } });
    if (perm) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: memberRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: memberRole.id, permissionId: perm.id },
      });
    }
  }

  await prisma.committeeMemberRole.upsert({
    where: {
      committeeId_memberId_roleId: {
        committeeId: committee.id,
        memberId: demoMember.id,
        roleId: memberRole.id,
      },
    },
    update: {},
    create: {
      committeeId: committee.id,
      memberId: demoMember.id,
      roleId: memberRole.id,
    },
  });

  await prisma.memberDepartment.upsert({
    where: { memberId_departmentId: { memberId: demoMember.id, departmentId: creativeArtsDept.id } },
    update: {},
    create: { memberId: demoMember.id, departmentId: creativeArtsDept.id },
  });

  // 15. Additional roles for the committee (President, Production Coordinator, Executive Member)
  console.log("Creating additional roles...");
  const presidentRole = await prisma.role.upsert({
    where: { name: "President" },
    update: {},
    create: { name: "President", description: "Club president and executive lead" },
  });
  const productionCoordinatorRole = await prisma.role.upsert({
    where: { name: "Production Coordinator" },
    update: {},
    create: { name: "Production Coordinator", description: "Coordinates productions and events" },
  });
  const executiveRole = await prisma.role.upsert({
    where: { name: "Executive Member" },
    update: {},
    create: { name: "Executive Member", description: "Executive committee member" },
  });

  const presidentPerms = ["member.view", "member.edit", "department.view", "department.manage", "committee.manage", "registration.manage", "registration.review", "promotion.submit", "promotion.approve", "gallery.upload", "gallery.manage", "updates.publish", "events.manage", "settings.manage"];
  const coordinatorPerms = ["member.view", "department.view", "promotion.submit", "events.manage", "gallery.upload", "updates.publish"];
  const executivePerms = ["member.view", "department.view", "promotion.submit", "events.manage", "gallery.upload", "updates.publish"];
  for (const [role, keys] of [
    [presidentRole, presidentPerms],
    [productionCoordinatorRole, coordinatorPerms],
    [executiveRole, executivePerms],
  ] as const) {
    for (const key of keys) {
      const perm = await prisma.permission.findUnique({ where: { key } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    }
  }

  // 16. Additional members across departments
  console.log("Creating additional members...");
  const memberSeeds = [
    { name: "Sarah Chen", email: "sarah.chen@university.edu", code: "DCMS-001", phone: "+14155550112", status: "ACTIVE", joined: new Date("2024-09-01"), dept: performanceDept },
    { name: "James Okafor", email: "james.okafor@university.edu", code: "DCMS-002", phone: "+14155550113", status: "ACTIVE", joined: new Date("2024-09-01"), dept: publicityDept },
    { name: "Priya Sharma", email: "priya.sharma@university.edu", code: "DCMS-003", phone: "+14155550114", status: "ACTIVE", joined: new Date("2023-09-01"), dept: creativeArtsDept },
    { name: "Mei Tanaka", email: "mei.tanaka@university.edu", code: "DCMS-004", phone: "+14155550115", status: "PENDING", joined: new Date("2026-08-02"), dept: technicalDept },
    { name: "Alex Rivera", email: "alex.rivera@university.edu", code: "DCMS-005", phone: "+14155550116", status: "ALUMNI", joined: new Date("2022-09-01"), dept: performanceDept },
    { name: "Tom Becker", email: "tom.becker@university.edu", code: "DCMS-006", phone: "+14155550117", status: "INACTIVE", joined: new Date("2023-09-01"), dept: logisticsDept },
  ] as const;

  const createdMembers: Record<string, { id: string }> = { demo: demoMember };
  for (const seed of memberSeeds) {
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: {},
      create: { name: seed.name, email: seed.email },
    });
    const member = await prisma.member.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        memberCode: seed.code,
        phone: seed.phone,
        status: seed.status as never,
        joiningDate: seed.joined,
      },
    });
    createdMembers[seed.code] = member;
    await prisma.memberDepartment.upsert({
      where: { memberId_departmentId: { memberId: member.id, departmentId: seed.dept.id } },
      update: {},
      create: { memberId: member.id, departmentId: seed.dept.id },
    });
  }

  // 17. Committee roles for the new members
  console.log("Assigning committee roles...");
  const committeeRoles = [
    { member: createdMembers["DCMS-003"] as { id: string }, role: presidentRole },
    { member: createdMembers["DCMS-001"] as { id: string }, role: productionCoordinatorRole },
    { member: createdMembers["DCMS-002"] as { id: string }, role: executiveRole },
  ];
  for (const { member, role } of committeeRoles) {
    await prisma.committeeMemberRole.upsert({
      where: {
        committeeId_memberId_roleId: { committeeId: committee.id, memberId: member.id, roleId: role.id },
      },
      update: {},
      create: { committeeId: committee.id, memberId: member.id, roleId: role.id },
    });
  }

  // 18. Applicants for the live window (multiple states)
  console.log("Creating sample applicants...");
  const regWindowRow = await prisma.registrationWindow.findFirst({ where: { title: "Fall 2026 Recruitment" } });
  const applicantSeeds = [
    {
      name: "Lena Fischer", email: "lena.fischer@university.edu", phone: "+4915112345678", studentId: "S-88213",
      prefs: ["dept-performance", "dept-creative-arts"], skills: ["Acting", "Improv"], experience: "High school theatre club, 2 years",
      status: "SUBMITTED",
      responses: { whyJoin: "I've always loved storytelling and want to grow as a performer.", experience: "School plays and improv nights." },
    },
    {
      name: "Daniel Kim", email: "daniel.kim@university.edu", phone: "+821012345678", studentId: "S-77102",
      prefs: ["dept-technical"], skills: ["Lighting", "Sound"], experience: "Helped run tech for a local festival",
      status: "SUBMITTED",
      responses: { whyJoin: "Backstage work fascinates me — lights, sound, atmosphere.", experience: "Volunteered at 3 local shows." },
    },
    {
      name: "Amara Osei", email: "amara.osei@university.edu", phone: "+233201234567", studentId: "S-55431",
      prefs: ["dept-creative-arts", "dept-publicity"], skills: ["Writing", "Directing"], experience: "Directed a one-act play in high school",
      status: "UNDER_REVIEW",
      responses: { whyJoin: "I want to direct and write for the stage.", experience: "Directed 'Twelve Angry Jurors' in senior year." },
    },
    {
      name: "Ravi Patel", email: "ravi.patel@university.edu", phone: "+14155550988", studentId: "S-33210",
      prefs: ["dept-performance"], skills: ["Acting", "Singing"], experience: "Sang in choir and acted in musicals",
      status: "ACCEPTED",
      responses: { whyJoin: "Musical theatre is my passion.", experience: "Lead in two school musicals." },
    },
    {
      name: "Grace Liu", email: "grace.liu@university.edu", phone: "+8613812345678", studentId: "S-99876",
      prefs: ["dept-publicity"], skills: ["Design", "Social media"], experience: "Ran a 10k-follower theatre account",
      status: "REJECTED",
      responses: { whyJoin: "Wanted to manage club socials.", experience: "Content creation for theatre pages." },
    },
  ] as const;

  if (regWindowRow) {
    for (const a of applicantSeeds) {
      await prisma.applicant.upsert({
        where: { registrationWindowId_email: { registrationWindowId: regWindowRow.id, email: a.email } },
        update: {},
        create: {
          registrationWindowId: regWindowRow.id,
          name: a.name,
          email: a.email,
          phone: a.phone,
          studentId: a.studentId,
          departmentPrefs: [...a.prefs],
          skills: [...a.skills],
          actingExperience: a.experience,
          customResponses: a.responses,
          status: a.status as never,
        },
      });
    }

    // Second + third windows in other states
    await prisma.registrationWindow.upsert({
      where: { id: "window-winter-2027" },
      update: {},
      create: {
        id: "window-winter-2027",
        title: "Winter 2027 Recruitment",
        description: "Mid-year intake for the winter production season.",
        startDate: new Date("2027-01-01"),
        endDate: new Date("2027-01-31"),
        status: "DRAFT",
        formSchema: {
          fields: [
            { name: "whyJoin", type: "textarea", label: "Why do you want to join?", required: true },
          ],
        },
      },
    });
    await prisma.registrationWindow.upsert({
      where: { id: "window-spring-2027" },
      update: {},
      create: {
        id: "window-spring-2027",
        title: "Spring 2027 Recruitment",
        description: "Spring intake for the gala season.",
        startDate: new Date("2027-04-01"),
        endDate: new Date("2027-04-30"),
        status: "SCHEDULED",
        formSchema: {
          fields: [
            { name: "whyJoin", type: "textarea", label: "Why do you want to join?", required: true },
          ],
        },
      },
    });
  }

  // 19. Promotion requests in several states
  console.log("Creating sample promotions...");
  interface PromotionSeed {
    member: { id: string };
    current: { id: string };
    proposed: { id: string };
    reason: string;
    achievements: string;
    status: "DRAFT" | "SUBMITTED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
    submittedBy: { id: string };
    reviewedBy: { id: string } | null;
  }

  const promotionSeeds: PromotionSeed[] = [
    {
      member: demoMember, current: memberRole, proposed: productionCoordinatorRole,
      reason: "Consistently led workshop sessions and mentored new members all semester.",
      achievements: "Organized 4 beginner workshops; ran onboarding for 12 new members.",
      status: "DRAFT", submittedBy: demoUser, reviewedBy: null,
    },
    {
      member: createdMembers["DCMS-001"], current: memberRole, proposed: executiveRole,
      reason: "Took ownership of the fall production's costume department without supervision.",
      achievements: "Delivered costumes for the fall play 2 weeks ahead of schedule.",
      status: "SUBMITTED", submittedBy: demoUser, reviewedBy: null,
    },
    {
      member: createdMembers["DCMS-002"], current: executiveRole, proposed: productionCoordinatorRole,
      reason: "Led the publicity campaign that sold out the spring gala.",
      achievements: "Campaign reached 50k impressions; gala sold out in 3 days.",
      status: "PENDING_APPROVAL", submittedBy: demoUser, reviewedBy: null,
    },
    {
      member: createdMembers["DCMS-003"], current: executiveRole, proposed: presidentRole,
      reason: "Stepped in as acting president during the midterm reorganization.",
      achievements: "Ran committee meetings and balanced the club budget.",
      status: "APPROVED", submittedBy: demoUser, reviewedBy: adminUser,
    },
    {
      member: createdMembers["DCMS-006"], current: memberRole, proposed: executiveRole,
      reason: "Requested executive role despite limited recent involvement.",
      achievements: "",
      status: "REJECTED", submittedBy: demoUser, reviewedBy: adminUser,
    },
  ];

  for (const p of promotionSeeds) {
    const exists = await prisma.promotionRequest.findFirst({
      where: { memberId: p.member.id, status: p.status, currentRoleId: p.current.id, proposedRoleId: p.proposed.id },
    });
    if (exists) continue;
    await prisma.promotionRequest.create({
      data: {
        memberId: p.member.id,
        currentRoleId: p.current.id,
        proposedRoleId: p.proposed.id,
        reason: p.reason,
        achievements: p.achievements,
        status: p.status,
        submittedById: p.submittedBy.id,
        ...(p.reviewedBy
          ? { reviewedById: p.reviewedBy.id, reviewedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          : {}),
      },
    });
  }

  // 20. Notifications for the demo user
  console.log("Creating sample notifications...");
  const notifSeeds = [
    { type: "PROMOTION", title: "Promotion update", message: "Your promotion to Production Coordinator was submitted for review.", link: "/dashboard/promotions", read: false },
    { type: "EVENT", title: "New event", message: "Auditions for Fall Play were added to the calendar.", link: "/dashboard/events", read: true },
    { type: "ANNOUNCEMENT", title: "New announcement", message: "Welcome to the New Semester! was published.", link: "/dashboard/updates", read: false },
    { type: "GALLERY", title: "New media", message: "New photos were added to the Spring 2026 Production album.", link: "/dashboard/gallery", read: true },
    { type: "REGISTRATION", title: "Recruitment update", message: "Fall 2026 Recruitment is now live.", link: "/dashboard/registration", read: false },
  ] as const;

  const existingNotifCount = await prisma.notification.count({ where: { userId: demoUser.id } });
  if (existingNotifCount === 0) {
    for (const n of notifSeeds) {
      await prisma.notification.create({
        data: {
          userId: demoUser.id,
          type: n.type as never,
          title: n.title,
          message: n.message,
          link: n.link,
          readAt: n.read ? new Date() : null,
        },
      });
    }
  }

  // 21. Audit log entries
  console.log("Creating audit log entries...");
  const auditEntries = [
    { action: "role.created", entityType: "Role", entityId: presidentRole.id, metadata: { name: "President" } },
    { action: "role.updated", entityType: "Role", entityId: executiveRole.id, metadata: { name: "Executive Member", permissions: 6 } },
    { action: "committee.created", entityType: "Committee", entityId: committee.id, metadata: { year: "2025-2026" } },
    { action: "promotion.approved", entityType: "PromotionRequest", entityId: "seed", metadata: { memberId: createdMembers["DCMS-003"].id } },
    { action: "applicant.accepted", entityType: "Applicant", entityId: "seed", metadata: { name: "Ravi Patel" } },
    { action: "member.updated", entityType: "Member", entityId: demoMember.id, metadata: { status: "ACTIVE" } },
  ] as const;

  const auditCount = await prisma.auditLog.count({ where: { actorId: adminUser.id } });
  if (auditCount === 0) {
    for (const entry of auditEntries) {
      await prisma.auditLog.create({
        data: {
          actorId: adminUser.id,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: entry.metadata as never,
        },
      });
    }
  }

  // 22. System settings (club identity + contact info)
  console.log("Creating system settings...");
  const settings: [string, unknown][] = [
    ["clubName", "Drama Club"],
    ["clubDescription", "Where passion meets the stage — join a community of storytellers, performers and creators."],
    ["contactEmail", "dramaclub@university.edu"],
    ["contactPhone", "+1 (555) 010-2030"],
    ["socialLinks", { instagram: "https://instagram.com/dramaclub", facebook: "https://facebook.com/dramaclub" }],
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

  // 23. More events (productions, festivals, ongoing)
  console.log("Creating more sample events...");
  const eventSeeds = [
    {
      title: "Romeo & Juliet — Opening Night", type: "PERFORMANCE", status: "UPCOMING",
      departmentId: performanceDept.id, startAt: new Date("2026-09-20T19:00:00Z"), endAt: new Date("2026-09-20T21:30:00Z"),
      location: "Main Theatre", description: "The fall production opens to the public. Tickets at the door.",
    },
    {
      title: "Spring Gala", type: "PERFORMANCE", status: "COMPLETED",
      departmentId: performanceDept.id, startAt: new Date("2026-05-10T19:00:00Z"), endAt: new Date("2026-05-10T22:00:00Z"),
      location: "Grand Hall", description: "Our annual showcase of the year's best work.",
    },
    {
      title: "Backstage Tour & Open House", type: "FESTIVAL", status: "UPCOMING",
      departmentId: creativeArtsDept.id, startAt: new Date("2026-08-29T11:00:00Z"), endAt: new Date("2026-08-29T15:00:00Z"),
      location: "Theatre Building", description: "Peek behind the curtain with guided backstage tours.",
    },
    {
      title: "Acting Intensive", type: "TRAINING", status: "UPCOMING",
      departmentId: performanceDept.id, startAt: new Date("2026-08-22T10:00:00Z"), endAt: new Date("2026-08-22T17:00:00Z"),
      location: "Studio B", description: "A full-day acting masterclass with guest director.",
    },
    {
      title: "Dress Rehearsal — Romeo & Juliet", type: "REHEARSAL", status: "ONGOING",
      departmentId: performanceDept.id, startAt: new Date("2026-08-07T18:00:00Z"), endAt: new Date("2026-08-07T22:00:00Z"),
      location: "Main Theatre", description: "Full dress rehearsal with costumes and lighting.",
    },
  ] as const;

  for (const e of eventSeeds) {
    const exists = await prisma.event.findFirst({ where: { title: e.title } });
    if (exists) continue;
    await prisma.event.create({ data: { ...e, type: e.type as never, status: e.status as never } });
  }

  // 24. More club updates
  console.log("Creating more club updates...");
  const updateSeeds = [
    {
      title: "Cast Announced for Romeo & Juliet",
      bodyRichText: "<p>We are thrilled to announce the full cast for this fall's production. Rehearsals begin August 10th — see you on stage!</p>",
      category: "PRODUCTION", publishedAt: new Date("2026-07-25"),
    },
    {
      title: "Summer Workshop Series",
      bodyRichText: "<p>Join us every Saturday in August for our open workshop series. Beginners welcome, no experience needed.</p>",
      category: "EVENT", publishedAt: new Date("2026-07-20"),
    },
    {
      title: "Congratulations, Graduates!",
      bodyRichText: "<p>Best of luck to our graduating members. The stage will miss you — but the alumni network is always open.</p>",
      category: "ACHIEVEMENT", publishedAt: new Date("2026-06-15"),
    },
  ] as const;

  for (const u of updateSeeds) {
    const exists = await prisma.clubUpdate.findFirst({ where: { title: u.title } });
    if (exists) continue;
    await prisma.clubUpdate.create({
      data: { ...u, category: u.category as never, authorId: adminUser.id },
    });
  }

  // 25. More gallery albums across categories
  console.log("Creating more gallery albums...");
  const albumSeeds = [
    { id: "album-workshops-2026", name: "Summer Workshops", category: "WORKSHOPS", departmentId: creativeArtsDept.id },
    { id: "album-behind-scenes", name: "Behind the Scenes", category: "BEHIND_THE_SCENES", departmentId: technicalDept.id },
    { id: "album-festivals", name: "Campus Festivals", category: "FESTIVALS", departmentId: publicityDept.id },
    { id: "album-club-life", name: "Club Life", category: "CLUB_LIFE", departmentId: null },
    { id: "album-rehearsals", name: "Rehearsal Room", category: "REHEARSALS", departmentId: performanceDept.id },
  ] as const;
  for (const a of albumSeeds) {
    await prisma.galleryAlbum.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        name: a.name,
        category: a.category as never,
        departmentId: a.departmentId,
      },
    });
  }

  // 26. A sample contact submission
  console.log("Creating sample contact submission...");
  const contactCount = await prisma.contactSubmission.count();
  if (contactCount === 0) {
    await prisma.contactSubmission.create({
      data: {
        name: "Faculty Adviser",
        email: "faculty@university.edu",
        message: "Could the club reserve the Main Theatre for the welcome week showcase?",
      },
    });
  }

  console.log("Seed complete!");
  console.log("\nDemo accounts:");
  console.log("  Admin: admin@dcms.local / admin123");
  console.log("  Member: demo@dcms.local / demo123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
