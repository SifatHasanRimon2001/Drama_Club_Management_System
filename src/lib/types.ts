export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  memberId?: string | null;
  permissions: string[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/* ------- public API payloads ------- */

export interface PublicAbout {
  clubName: string;
  clubDescription: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  socialLinks: Record<string, string> | null;
  departmentCount: number;
  activeMemberCount: number;
  registrationEnabled: boolean;
  maintenanceMode: boolean;
}

export interface PublicHomeData {
  committee: CommitteeWithRoles | null;
  departments: PublicDepartment[];
  recentUpdates: ClubUpdate[];
  upcomingEvents: EventWithDepartment[];
}

export interface CommitteeWithRoles {
  id: string;
  year: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  memberRoles: CommitteeMemberRole[];
  departments?: Department[];
}

export interface CommitteeMemberRole {
  id: string;
  committeeId: string;
  memberId: string;
  roleId: string;
  startedAt: string;
  endedAt: string | null;
  member: { id: string; user: { id: string; name: string; image: string | null } };
  role: { id: string; name: string; description?: string | null };
  committee?: { id: string; year: string; isCurrent: boolean };
}

export interface PublicDepartment {
  id: string;
  name: string;
  description: string | null;
  coordinator: { id: string; user: { id: string; name: string; image: string | null } } | null;
  _count: { members: number; events: number };
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  committeeId: string;
  coordinatorId: string | null;
  coordinator?: Coordinator | null;
  committee?: { id: string; year: string; isCurrent: boolean };
  members?: MemberDepartment[];
  events?: Event[];
  tasks?: Task[];
  _count?: { members: number; events: number; tasks: number };
}

export interface Coordinator {
  id: string;
  user: { id: string; name: string; email: string; image?: string | null };
}

export interface MemberDepartment {
  memberId: string;
  departmentId: string;
  member?: Member;
  department?: { id: string; name: string } | Department;
}

export interface Member {
  id: string;
  userId: string;
  memberCode: string;
  phone: string | null;
  dateOfBirth: string | null;
  address: string | null;
  emergencyContact: string | null;
  photoUrl: string | null;
  joiningDate: string;
  status: string;
  user: { id: string; name: string; email: string; image?: string | null };
  departments?: MemberDepartment[];
  committeeRoles?: CommitteeMemberRole[];
  sourceApplicant?: Applicant | null;
}

export interface CommitteeMemberRoleFull {
  id: string;
  committeeId: string;
  memberId: string;
  roleId: string;
  startedAt: string;
  endedAt: string | null;
  member: { id: string; user: { id: string; name: string; email?: string; image?: string | null } };
  role: { id: string; name: string };
  committee?: Committee;
}

export interface Committee {
  id: string;
  year: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  status: string;
  memberRoles: CommitteeMemberRoleFull[];
  departments: Department[];
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: RolePermission[];
}

export interface RolePermission {
  roleId: string;
  permissionId: string;
  permission: Permission;
}

export interface Permission {
  id: string;
  key: string;
  description: string | null;
}

export interface Task {
  id: string;
  departmentId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
  assignee?: { id: string; user: { id: string; name: string; email?: string } } | null;
}

export interface RegistrationWindow {
  id: string;
  title: string;
  description: string;
  bannerUrl: string | null;
  startDate: string;
  endDate: string;
  status: string;
  formSchema: Record<string, unknown>;
  createdAt: string;
  _count?: { applicants: number };
}

export interface Applicant {
  id: string;
  registrationWindowId: string;
  name: string;
  email: string;
  phone: string;
  studentId: string;
  departmentPrefs: string[];
  skills: string[];
  actingExperience: string | null;
  portfolioUrl: string | null;
  customResponses: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  registrationWindow?: { id: string; title: string };
  convertedMember?: { id: string; memberCode: string } | null;
  convertedMemberId?: string | null;
}

export interface PromotionRequest {
  id: string;
  memberId: string;
  currentRoleId: string;
  proposedRoleId: string;
  reason: string;
  achievements: string | null;
  documentUrls: string[];
  status: string;
  submittedById: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  member?: { id: string; user: { id: string; name: string; email: string } };
  currentRole?: { id: string; name: string } | null;
  proposedRole?: { id: string; name: string } | null;
}

export interface EventWithDepartment {
  id: string;
  title: string;
  type: string;
  status: string;
  departmentId: string | null;
  startAt: string;
  endAt: string | null;
  location: string | null;
  description: string | null;
  department: { id: string; name: string } | null;
}

export type Event = EventWithDepartment;

export interface ClubUpdate {
  id: string;
  title: string;
  bodyRichText: string;
  category: string;
  mediaUrls: string[];
  publishedAt: string | null;
  authorId: string;
  author?: { id: string; name: string; email: string };
  createdAt: string;
}

export interface GalleryAlbum {
  id: string;
  name: string;
  category: string;
  departmentId: string | null;
  createdAt: string;
  department?: { id: string; name: string } | null;
  _count?: { items: number };
  items?: GalleryItem[];
}

export interface GalleryItem {
  id: string;
  albumId: string;
  r2Key: string;
  fileName: string;
  type: string;
  caption: string | null;
  uploadedById: string;
  createdAt: string;
  album?: { id: string; name: string; category: string; departmentId: string | null };
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  payload: Record<string, unknown> | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AdminDashboardData {
  members: { total: number; byStatus: Record<string, number> };
  registrations: {
    id: string;
    title: string;
    status: string;
    applicantCount: number;
    conversionCount: number;
    conversionRate: number;
  }[];
  pendingPromotions: {
    count: number;
    list: PromotionRequest[];
  };
  upcomingEvents: EventWithDepartment[];
  recentGalleryItems: GalleryItem[];
}

export interface DepartmentDashboardData {
  department: { id: string; name: string } | null;
  members: {
    id: string;
    memberCode: string;
    name: string;
    email: string;
    image: string | null;
    status: string;
  }[];
  memberCount: number;
  events: EventWithDepartment[];
  tasks: Task[];
  taskCounts: Record<string, number>;
  recruitment: { total: number; byStatus: Record<string, number> };
}

export interface MemberDashboardData {
  user: { id: string; name: string; email: string; image: string | null };
  member: {
    id: string;
    memberCode: string;
    phone: string | null;
    photoUrl: string | null;
    status: string;
    joiningDate: string;
    currentRole: { id: string; name: string } | null;
    committee: { id: string; year: string } | null;
  } | null;
  departments: Department[];
  upcomingEvents: EventWithDepartment[];
  recentNotifications: NotificationItem[];
}

export interface FormFieldSpec {
  name: string;
  type: "text" | "textarea" | "select" | "checkbox" | "number";
  label?: string;
  required?: boolean;
  options?: string[];
}
