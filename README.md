# Drama Club Management System (DCMS)

A centralized web platform for managing the complete lifecycle of a drama club — from member registration and department management to productions, club announcements, media galleries, and promotion workflows.

**Version:** 1.1 | **Status:** MVP Complete

## Tech Stack

| Layer      | Choice                              |
| ---------- | ----------------------------------- |
| Framework  | Next.js 16 (App Router), TypeScript |
| Database   | PostgreSQL                          |
| ORM        | Prisma 7                            |
| Auth       | NextAuth.js v5 (credentials)        |
| Storage    | Cloudflare R2 (S3-compatible)       |
| Styling    | Tailwind CSS v4                     |
| Email      | Resend                              |
| Validation | Zod 3                               |

## Features

### Core Modules (PRD §16 MVP Scope)

| Module                          | Description                                                                |
| ------------------------------- | -------------------------------------------------------------------------- |
| **Authentication**        | Credentials login, JWT sessions, 5-min permission refresh                  |
| **RBAC Permissions**      | 16 permission keys, admin-defined roles, department-scoped access          |
| **Member Management**     | CRUD with profile, status (Pending/Active/Alumni/Inactive/Suspended)       |
| **Committee Management**  | Yearly committees with historical archive, role assignment                 |
| **Department Management** | Unlimited departments, coordinators, member assignment                     |
| **Registration Windows**  | Configurable forms, public application, admin review, CSV export           |
| **Promotion Workflow**    | Draft → Submitted → Pending → Approved/Rejected; old role soft-ended with history |
| **Events & Productions**  | CRUD with type filtering, department notifications                         |
| **Club Updates**          | Rich text announcements with media attachments                             |
| **Gallery**               | Cloudflare R2 storage, albums by category, presigned uploads               |
| **Dashboards**            | Admin, Department, and Member dashboards with real data                    |
| **Notifications**         | In-app notifications + email for applicant status changes                  |
| **Public API**            | Home, About, Committee, Departments, Events, Productions, Updates, Gallery, Recruitment |
| **System Settings**       | Club info, theme, R2 config with key whitelist                             |

### Permission Keys (16 exact keys per PRD §3a)

```
member.view, member.create, member.edit,
department.view, department.manage,
committee.manage,
registration.manage, registration.review,
promotion.submit, promotion.approve,
gallery.upload, gallery.manage,
updates.publish,
events.manage,
permissions.manage,
settings.manage
```

## Getting Started

### Prerequisites

- Node.js 20.9+ (required by Next.js 16)
- PostgreSQL database
- Cloudflare R2 account (for media storage)
- Resend API key (for email notifications)

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dcms
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://your-bucket.r2.dev
RESEND_API_KEY=your-resend-key
EMAIL_FROM=noreply@yourdomain.com
```

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed database
npx tsx prisma/seed.ts

# Start development server
npm run dev
```

### Seed Data

The seed script creates:

- 16 permissions (exact PRD keys)
- Admin user: `admin@dcms.local` / `admin123` (all permissions)
- Demo user: `demo@dcms.local` / `demo123` (4 permissions)
- Current committee (2025-2026)
- 5 departments (Creative Arts, Technical, Performance, Publicity, Logistics)
- Sample tasks, events, registration window, club update, gallery album

## API Routes (53 route modules, 79 handlers)

### Authentication

| Method | Route                       | Auth   | Description       |
| ------ | --------------------------- | ------ | ----------------- |
| POST   | `/api/auth/register`      | Public | Create account    |
| POST   | `/api/auth/[...nextauth]` | Public | NextAuth handlers |
| GET    | `/api/session`            | Auth   | Current session   |

### Members

| Method | Route                             | Permission        | Description                          |
| ------ | --------------------------------- | ----------------- | ------------------------------------ |
| GET    | `/api/members`                  | `member.view`   | List members (filter by status/dept) |
| POST   | `/api/members`                  | `member.create` | Create member                        |
| GET    | `/api/members/[id]`             | `member.view`   | Get member                           |
| PATCH  | `/api/members/[id]`             | `member.edit`   | Update member                        |
| POST   | `/api/members/[id]/departments` | `member.edit`   | Add to department                    |
| DELETE | `/api/members/[id]/departments` | `member.edit`   | Remove from department               |

### Committees

| Method | Route                          | Permission                                   | Description      |
| ------ | ------------------------------ | -------------------------------------------- | ---------------- |
| GET    | `/api/committees`            | Public (current) /`committee.manage` (all) | List committees  |
| POST   | `/api/committees`            | `committee.manage`                         | Create committee |
| GET    | `/api/committees/[id]`       | Public (current) /`committee.manage` (all) | Get committee    |
| PATCH  | `/api/committees/[id]`       | `committee.manage`                         | Update committee |
| POST   | `/api/committees/[id]/roles` | `committee.manage`                         | Assign role      |
| DELETE | `/api/committees/[id]/roles` | `committee.manage`                         | Remove role      |

### Departments

| Method | Route                                    | Permission            | Description       |
| ------ | ---------------------------------------- | --------------------- | ----------------- |
| GET    | `/api/departments`                     | `department.view`   | List departments  |
| POST   | `/api/departments`                     | `department.manage` | Create department |
| GET    | `/api/departments/[id]`                | `department.view`   | Get department    |
| PATCH  | `/api/departments/[id]`                | `department.manage` | Update department |
| GET    | `/api/departments/[id]/tasks`          | `department.manage` | List tasks        |
| POST   | `/api/departments/[id]/tasks`          | `department.manage` | Create task       |
| PATCH  | `/api/departments/[id]/tasks/[taskId]` | `department.manage` | Update task       |
| DELETE | `/api/departments/[id]/tasks/[taskId]` | `department.manage` | Delete task       |

### Registration

| Method | Route                                                       | Permission                     | Description        |
| ------ | ----------------------------------------------------------- | ------------------------------ | ------------------ |
| GET    | `/api/registration-windows`                               | `registration.manage`        | List windows       |
| POST   | `/api/registration-windows`                               | `registration.manage`        | Create window      |
| GET    | `/api/registration-windows/[id]`                          | Admin: all / Public: LIVE only | Get window         |
| PATCH  | `/api/registration-windows/[id]`                          | `registration.manage`        | Update window      |
| POST   | `/api/registration-windows/[id]/apply`                    | Public                         | Submit application |
| GET    | `/api/registration-windows/[id]/applicants`               | `registration.review`        | List applicants    |
| PATCH  | `/api/registration-windows/[id]/applicants/[applicantId]` | `registration.review`        | Accept/reject      |

### Applicants

| Method | Route                            | Permission              | Description         |
| ------ | -------------------------------- | ----------------------- | ------------------- |
| GET    | `/api/applicants`              | `registration.review` | List all applicants |
| GET    | `/api/applicants/[id]`         | `registration.review` | Get applicant       |
| GET    | `/api/applicants/export`       | `registration.review` | Export CSV          |
| PATCH  | `/api/applicants/[id]`         | `registration.review` | Update status       |
| POST   | `/api/applicants/[id]/convert` | `member.create`       | Convert to member   |

### Promotions

| Method | Route                             | Permission            | Description       |
| ------ | --------------------------------- | --------------------- | ----------------- |
| GET    | `/api/promotions`               | `promotion.submit`  | List promotions   |
| POST   | `/api/promotions`               | `promotion.submit`  | Create promotion  |
| GET    | `/api/promotions/[id]`          | `promotion.submit`  | Get promotion     |
| POST   | `/api/promotions/[id]/submit`   | `promotion.submit`  | Submit for review |
| POST   | `/api/promotions/[id]/decision` | `promotion.approve` | Approve/reject    |

### Events

| Method | Route                | Permission         | Description  |
| ------ | -------------------- | ------------------ | ------------ |
| GET    | `/api/events`      | Public (published) | List events  |
| POST   | `/api/events`      | `events.manage`  | Create event |
| GET    | `/api/events/[id]` | Public (published) | Get event    |
| PATCH  | `/api/events/[id]` | `events.manage`  | Update event |
| DELETE | `/api/events/[id]` | `events.manage`  | Delete event |

### Updates

| Method | Route                 | Permission          | Description   |
| ------ | --------------------- | ------------------- | ------------- |
| GET    | `/api/updates`      | Public (published)  | List updates  |
| POST   | `/api/updates`      | `updates.publish` | Create update |
| GET    | `/api/updates/[id]` | Public (published)  | Get update    |
| PATCH  | `/api/updates/[id]` | `updates.publish` | Update        |
| DELETE | `/api/updates/[id]` | `updates.publish` | Delete update |

### Gallery

| Method | Route                       | Permission         | Description            |
| ------ | --------------------------- | ------------------ | ---------------------- |
| GET    | `/api/gallery`            | Auth               | List albums            |
| POST   | `/api/gallery`            | `gallery.manage` | Create album           |
| GET    | `/api/gallery/items`      | Public             | List items (paginated) |
| POST   | `/api/gallery/items`      | `gallery.upload` | Add item               |
| POST   | `/api/gallery/upload-url` | `gallery.upload` | Get presigned URL      |

### Roles & Permissions

| Method | Route                | Permission             | Description         |
| ------ | -------------------- | ---------------------- | ------------------- |
| GET    | `/api/roles`       | `permissions.manage` | List roles          |
| POST   | `/api/roles`       | `permissions.manage` | Create role         |
| GET    | `/api/roles/[id]`  | `permissions.manage` | Get role            |
| PATCH  | `/api/roles/[id]`  | `permissions.manage` | Update role         |
| GET    | `/api/permissions` | `permissions.manage` | List permissions    |
| POST   | `/api/permissions` | `permissions.manage` | Re-seed permissions |

### Settings & Notifications

| Method | Route                            | Permission          | Description        |
| ------ | -------------------------------- | ------------------- | ------------------ |
| GET    | `/api/settings`                | `settings.manage` | Get settings       |
| PATCH  | `/api/settings`                | `settings.manage` | Update settings    |
| GET    | `/api/notifications`           | Auth                | List notifications |
| POST   | `/api/notifications/[id]/read` | Auth                | Mark as read       |

### Contact

| Method | Route            | Permission | Description         |
| ------ | ---------------- | ---------- | ------------------- |
| POST   | `/api/contact` | Public     | Submit contact form |

### Public Website

| Method | Route                        | Description               |
| ------ | ---------------------------- | ------------------------- |
| GET    | `/api/public/home`         | Home page data            |
| GET    | `/api/public/about`        | About page data           |
| GET    | `/api/public/committee`    | Current committee         |
| GET    | `/api/public/departments`  | All departments           |
| GET    | `/api/public/events`       | Published events          |
| GET    | `/api/public/productions`  | Performances              |
| GET    | `/api/public/updates`      | Published updates         |
| GET    | `/api/public/gallery`      | Gallery albums            |
| GET    | `/api/public/gallery/[id]` | Album items               |
| GET    | `/api/public/recruitment`  | LIVE registration windows |

### Dashboards

| Method | Route                         | Permission          | Description          |
| ------ | ----------------------------- | ------------------- | -------------------- |
| GET    | `/api/dashboard/admin`      | `member.view`     | Admin dashboard      |
| GET    | `/api/dashboard/department` | `department.view` | Department dashboard |
| GET    | `/api/dashboard/member`     | Auth                | Member dashboard     |

## Data Models

### Core Entities

- **User** — Authentication, linked to Member profile
- **Account / Session / VerificationToken** — NextAuth.js adapter tables (OAuth-ready)
- **Member** — Profile with status, departments, committee roles
- **Role** — Admin-defined with permission array
- **Permission** — 16 exact keys from PRD
- **RolePermission** — Join table between roles and permissions
- **Committee** — Yearly with `isCurrent` flag
- **CommitteeMemberRole** — Member-role-committee assignment with history (`startedAt`/`endedAt`)
- **Department** — Linked to committee, optional coordinator
- **MemberDepartment** — Many-to-many membership
- **Task** — Department-scoped tasks with assignee

### Workflow Entities

- **RegistrationWindow** — Configurable form schema, status lifecycle (DRAFT/SCHEDULED/LIVE/CLOSED)
- **Applicant** — Submission with state machine (SUBMITTED → UNDER_REVIEW → ACCEPTED/REJECTED/CONVERTED)
- **PromotionRequest** — DRAFT → SUBMITTED/PENDING_APPROVAL → APPROVED/REJECTED; approval soft-ends the old CommitteeMemberRole (sets `endedAt`) instead of deleting history
- **Event** — Typed (WORKSHOP/REHEARSAL/PERFORMANCE/AUDITION/FESTIVAL/TRAINING) with status lifecycle (DRAFT/UPCOMING/ONGOING/COMPLETED/CANCELLED)
- **ClubUpdate** — Rich text with category
- **GalleryAlbum** — Category-scoped, optional department
- **GalleryItem** — R2-stored media with type (IMAGE/VIDEO)
- **Notification** — In-app with type and read state
- **AuditLog** — Full audit trail for compliance
- **ContactSubmission** — Public contact form entries with handled flag
- **SystemSetting** — Key/value store for club info, theme, R2 config

25 models total (including NextAuth tables).

## Security

- **Passwords:** bcrypt with cost factor 12
- **Sessions:** JWT with 24-hour expiry, 5-minute permission refresh
- **Rate Limiting:** Contact form (5/15min), Registration apply (3/hour), Account signup (3/hour), Login throttling (10 failed attempts / 15 min per account)
- **Input Validation:** Zod schemas on all mutating endpoints
- **Audit Trail:** All state changes logged to AuditLog
- **Email Safety:** Subject injection prevention, HTML escaping
- **R2 Security:** Presigned URLs with 1-hour expiry, path traversal prevention
- **RBAC:** Permission-based, not role-based; department-scoped access

## Notification Triggers (PRD §3c)

| Event                       | Type             | Recipients         | Channel    |
| --------------------------- | ---------------- | ------------------ | ---------- |
| Promotion approved/rejected | `PROMOTION`    | Subject member     | In-app     |
| Applicant status change     | —               | Applicant          | Email only |
| New ClubUpdate published    | `ANNOUNCEMENT` | All active members | In-app     |
| New Event (with dept)       | `EVENT`        | Dept members       | In-app     |
| New Event (no dept)         | `EVENT`        | All active members | In-app     |
| New GalleryItem uploaded    | `GALLERY`      | Dept members       | In-app     |

## Development

```bash
npm run dev             # Start dev server
npm run build           # Production build
npm run lint            # ESLint
npx tsc --noEmit        # Type check
npm test                # Vitest unit tests
npm run test:coverage   # Unit tests with coverage report
npm run test:e2e        # Playwright E2E suite (see E2E.md)
npm run test:e2e:http   # Standalone HTTP E2E smoke suite (see E2E.md)
npx prisma generate     # Regenerate Prisma client
npx prisma db push      # Push schema changes
npx tsx prisma/seed.ts  # Seed database
```

## Project Structure

```
Drama_Club_Management_System/
├── prisma/
│   ├── schema.prisma                 # 25 models with relations
│   └── seed.ts                       # Idempotent seed script
├── prisma.config.ts                  # Prisma 7 config
├── scripts/                          # E2E + DB utility scripts (e2e.ts, smoke-test.ts, reset-db.ts)
├── e2e/                              # Playwright specs (HTTP request-level, no browser)
├── src/
│   ├── app/
│   │   ├── api/                      # 53 API route modules (79 handlers)
│   │   │   ├── auth/                 # NextAuth + registration
│   │   │   ├── members/              # Member CRUD + dept assignment
│   │   │   ├── committees/           # Committee + role management
│   │   │   ├── departments/          # Department + task CRUD
│   │   │   ├── registration-windows/ # Window + applicant flow
│   │   │   ├── applicants/           # Applicant review, CSV export, conversion
│   │   │   ├── promotions/           # Promotion workflow
│   │   │   ├── events/               # Event management
│   │   │   ├── updates/              # Club updates
│   │   │   ├── gallery/              # Album + item management
│   │   │   ├── roles/                # Role CRUD
│   │   │   ├── permissions/          # Permission seed
│   │   │   ├── settings/             # System settings
│   │   │   ├── notifications/        # In-app notifications
│   │   │   ├── session/              # Current session endpoint
│   │   │   ├── dashboard/            # Admin/dept/member dashboards
│   │   │   ├── public/               # Public website endpoints
│   │   │   └── contact/              # Contact form
│   │   └── page.tsx                  # Landing page
│   └── lib/
│       ├── auth.ts                   # NextAuth v5 config
│       ├── permissions.ts            # RBAC engine (can, getUserPermissions)
│       ├── prisma.ts                 # Prisma singleton with PrismaPg
│       ├── audit.ts                  # Audit logging
│       ├── notifications.ts          # In-app notification helpers
│       ├── email.ts                  # Resend email with HTML escaping
│       ├── r2.ts                     # Cloudflare R2 presigned URLs
│       ├── rate-limit.ts             # In-memory rate limiter + client IP keying
│       ├── registration-form.ts      # Dynamic form schema builder
│       ├── registration-window-transitions.ts  # Window status transitions
│       ├── validations.ts            # All Zod schemas
│       └── api-helpers.ts            # requireAuth, getPaginationParams
└── README.md
```

## License

MIT
