import { vi } from "vitest";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Mock NextAuth auth() - tests override this per-file
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Mock notifications to avoid side effects in unit tests
vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  notifyDepartmentMembers: vi.fn().mockResolvedValue(undefined),
  notifyAllActiveMembers: vi.fn().mockResolvedValue(undefined),
}));

// Mock email to avoid sending in tests
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: "mock-email-id" }),
  applicantStatusEmail: vi.fn().mockReturnValue({
    subject: "Mock Subject",
    html: "<p>Mock</p>",
  }),
  _setResendForTesting: vi.fn(),
}));
