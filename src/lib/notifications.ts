import prisma from "@/lib/prisma";
import { NotificationType, Prisma } from "@prisma/client";

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  link?: string;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        payload: params.payload ? (params.payload as Prisma.InputJsonValue) : undefined,
        link: params.link ?? undefined,
      },
    });
  } catch (error) {
    console.error("[Notification] Failed to create:", error);
  }
}

export async function notifyDepartmentMembers(params: {
  departmentId: string;
  type: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  link?: string;
  excludeUserId?: string;
}): Promise<void> {
  try {
    const [memberDepts, coordinator] = await Promise.all([
      prisma.memberDepartment.findMany({
        where: { departmentId: params.departmentId },
        include: { member: { select: { userId: true } } },
      }),
      prisma.department.findUnique({
        where: { id: params.departmentId },
        select: { coordinator: { select: { userId: true } } },
      }),
    ]);

    const userIdSet = new Set<string>();
    for (const md of memberDepts) {
      userIdSet.add(md.member.userId);
    }
    // Also include the department coordinator if they exist
    if (coordinator?.coordinator?.userId) {
      userIdSet.add(coordinator.coordinator.userId);
    }

    const userIds = Array.from(userIdSet)
      .filter((uid) => !params.excludeUserId || uid !== params.excludeUserId);

    if (userIds.length === 0) return;

    // Batch in chunks of 100 to avoid Prisma limits
    const CHUNK_SIZE = 100;
    for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
      const chunk = userIds.slice(i, i + CHUNK_SIZE);
      await prisma.notification.createMany({
        data: chunk.map((userId) => ({
          userId,
          type: params.type,
          title: params.title,
          message: params.message,
          payload: params.payload ? (params.payload as Prisma.InputJsonValue) : undefined,
          link: params.link ?? undefined,
        })),
      });
    }
  } catch (error) {
    console.error("[Notification] Failed to notify department members:", error);
  }
}

export async function notifyAllActiveMembers(params: {
  type: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  link?: string;
  excludeUserId?: string;
}): Promise<void> {
  try {
    const where: Record<string, unknown> = { status: "ACTIVE" };
    if (params.excludeUserId) {
      where.userId = { not: params.excludeUserId };
    }

    const members = await prisma.member.findMany({
      where,
      select: { userId: true },
    });

    if (members.length === 0) return;

    // Batch in chunks of 100
    const CHUNK_SIZE = 100;
    const allUserIds = members.map((m) => m.userId);
    for (let i = 0; i < allUserIds.length; i += CHUNK_SIZE) {
      const chunk = allUserIds.slice(i, i + CHUNK_SIZE);
      await prisma.notification.createMany({
        data: chunk.map((userId) => ({
          userId,
          type: params.type,
          title: params.title,
          message: params.message,
          payload: params.payload ? (params.payload as Prisma.InputJsonValue) : undefined,
          link: params.link ?? undefined,
        })),
      });
    }
  } catch (error) {
    console.error("[Notification] Failed to notify all active members:", error);
  }
}
