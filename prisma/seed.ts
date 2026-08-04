import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

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

  await prisma.department.upsert({
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
  const memberPermissions = ["member.view", "department.view", "events.manage", "gallery.upload"];
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
