import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  emitChange,
  emitNotification,
  emitNotificationToMany,
} from "@/lib/realtime";

const WRITE_OPS = new Set([
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]);

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is not set. Please configure it in your .env file."
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ model, operation, args, query }: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (query as (a: any) => Promise<any>)(args);
          try {
            if (WRITE_OPS.has(operation)) {
              emitChange(model, operation);
            }
            // Targeted push: new notifications reach the owning user's sockets.
            if (model === "Notification") {
              if (operation === "create") {
                const rec = result as { userId?: string } | null;
                if (rec?.userId) {
                  emitNotification(rec.userId, result as Record<string, unknown>);
                }
              } else if (operation === "createMany") {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = (args?.data ?? []) as any;
                const list = Array.isArray(data) ? data : [data];
                const userIds = list
                  .map((d: { userId?: string }) => d?.userId)
                  .filter(Boolean) as string[];
                if (userIds.length) emitNotificationToMany(userIds);
              }
            }
          } catch {
            // Realtime emission must never break the underlying write.
          }
          return result;
        },
      },
    },
  });
}

type PrismaWithRealtime = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaWithRealtime | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;

export default prisma;
