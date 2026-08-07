import { z } from "zod";

// Auth
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Member
export const memberSchema = z.object({
  userId: z.string().cuid(),
  memberCode: z.string().min(1, "Member code is required"),
  phone: z.string().optional(),
  dateOfBirth: z.string().refine((v) => !isNaN(Date.parse(v)), { message: "Invalid date" }).optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  photoUrl: z.string().url().optional(),
  status: z
    .enum(["PENDING", "ACTIVE", "ALUMNI", "INACTIVE", "SUSPENDED"])
    .optional(),
});

export const memberUpdateSchema = memberSchema.partial().omit({ userId: true });

// Role & Permission
export const roleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).optional(),
});

export const roleUpdateSchema = roleSchema.partial();

// Committee
export const committeeSchema = z.object({
  year: z.string().min(1, "Year is required"),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  isCurrent: z.boolean().optional(),
});

// Department
export const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  description: z.string().optional(),
  committeeId: z.string().cuid(),
  coordinatorId: z.string().cuid().optional(),
});

export const departmentUpdateSchema = departmentSchema.partial();

// Task
export const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  assigneeId: z.string().cuid().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  dueDate: z.string().datetime().optional(),
});

// Registration Window
export const registrationWindowSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  bannerUrl: z.string().url().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  status: z
    .enum(["DRAFT", "SCHEDULED", "LIVE", "CLOSED"])
    .optional(),
  formSchema: z.record(z.unknown()).default({}),
});

// Applicant
export const applicantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(1, "Phone is required"),
  studentId: z.string().min(1, "Student ID is required"),
  departmentPrefs: z.array(z.string()).min(1, "Select at least one department"),
  skills: z.array(z.string()).optional(),
  actingExperience: z.string().max(2000).optional(),
  portfolioUrl: z.string().url().optional(),
  customResponses: z.record(z.unknown()).optional(),
});

export const applicantDecisionSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "ACCEPTED", "REJECTED"]),
});

// Promotion
export const promotionRequestSchema = z.object({
  memberId: z.string().cuid(),
  currentRoleId: z.string().cuid(),
  proposedRoleId: z.string().cuid(),
  reason: z.string().min(1, "Reason is required"),
  achievements: z.string().optional(),
  documentUrls: z.array(z.string().url()).optional(),
});

export const promotionDecisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

// Event
export const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum([
    "WORKSHOP",
    "REHEARSAL",
    "PERFORMANCE",
    "AUDITION",
    "FESTIVAL",
    "TRAINING",
  ]),
  status: z.enum(["DRAFT", "UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"]).optional(),
  departmentId: z.string().cuid().nullish(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
});

// Club Update
export const clubUpdateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  bodyRichText: z.string().min(1, "Content is required"),
  category: z.enum([
    "ANNOUNCEMENT",
    "NOTICE",
    "ACHIEVEMENT",
    "PRODUCTION",
    "RECRUITMENT",
    "EVENT",
  ]),
  mediaUrls: z.array(z.string().url()).optional(),
  publishedAt: z.string().datetime().optional(),
});

// Gallery
export const galleryAlbumSchema = z.object({
  name: z.string().min(1, "Album name is required"),
  category: z.enum([
    "PRODUCTIONS",
    "WORKSHOPS",
    "BEHIND_THE_SCENES",
    "FESTIVALS",
    "REHEARSALS",
    "CLUB_LIFE",
  ]),
  departmentId: z.string().cuid().optional(),
});

export const galleryItemSchema = z.object({
  albumId: z.string().cuid(),
  r2Key: z.string().min(1),
  fileName: z.string().min(1),
  type: z.enum(["IMAGE", "VIDEO"]),
  caption: z.string().max(500).optional(),
});

export const presignedUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().int().positive("File size must be a positive number"),
  folder: z.string().optional(),
  departmentId: z.string().cuid().optional(),
});

// Contact
export const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email"),
  message: z.string().min(10, "Message must be at least 10 characters").max(5000),
});

// Settings - whitelist of allowed setting keys
export const settingsSchema = z.record(
  z.enum([
    "clubName",
    "clubDescription",
    "contactEmail",
    "contactPhone",
    "socialLinks",
    "theme",
    "logoUrl",
    "bannerUrl",
    "registrationEnabled",
    "maintenanceMode",
  ]),
  z.unknown()
);

// Committee Role
export const committeeRoleSchema = z.object({
  memberId: z.string().cuid("Invalid member ID"),
  roleId: z.string().cuid("Invalid role ID"),
});

// Member Department
export const memberDepartmentSchema = z.object({
  departmentId: z.string().cuid("Invalid department ID"),
});

// Applicant Convert
export const applicantConvertSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});
