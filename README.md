# Drama Club Management System (DCMS)

A centralized web platform for managing the complete lifecycle of a drama club — from member registration and department management to productions, club announcements, media galleries, and promotion workflows — now with **real-time updates** via Socket.IO.

**Version:** 1.2 | **Status:** MVP Complete + Realtime

## Tech Stack

| Layer      | Choice                              |
| ---------- | ----------------------------------- |
| Framework  | Next.js 16 (App Router), TypeScript |
| Database   | PostgreSQL                          |
| ORM        | Prisma 7 (PrismaPg driver adapter)  |
| Auth       | NextAuth.js v5 (credentials, JWT)   |
| Realtime   | Socket.IO 4 (custom `server.js`)    |
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
| **Realtime (Socket.IO)**  | Every page live-refreshes on data changes; notification bell pushes        |
| **Audit Log**             | Full paginated audit trail with filters                                    |
| **Contact Inbox**         | Public contact form with open/handled management                          |
| **Public API**            | Home, About, Committee, Departments, Events, Productions, Updates, Gallery, Recruitment |
| **System Settings**       | Club info, theme, R2 config with key whitelist                             |

### Realtime (Socket.IO)

The app runs on a custom server (`server.js`) that mounts Socket.IO on the same
HTTP server as Next.js, so **every page updates live without a refresh**.

**How it works**

1. **Broadcast layer** — `src/lib/prisma.ts` extends the Prisma client with a
   `$allOperations` hook that emits a `change` event for **every**
   create/update/delete across all models (including inside `$transaction`).
2. **Server** — `src/lib/realtime.ts` exposes `emitChange` /
   `emitNotification` / `emitNotificationToMany`; authenticated sockets join a
   `user:<id>` room so notifications reach only their owner.
3. **Client** — `src/lib/client/socket.tsx` provides a singleton socket
   provider, `useRealtimeRefresh(entities, refresh)` (debounced refetch on
   matching entity changes) and `useRealtimeNotification(handler)`.
4. **Wiring** — every dashboard page calls `useRealtimeRefresh` for its
   entities; the notification bell in `app-shell` updates on push; public pages
   re-render server components via `<LivePageRefresh />` in the public layout.

**Verify it live**

```bash
npx tsx scripts/realtime-smoke.ts    # broadcast: API mutation → change event
npx tsx scripts/realtime-tx-check.ts # transaction-scoped writes → change event
```

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
- Cloudflare R2 account (for media storage — optional for local dev)
- Resend API key (for email notifications — optional for local dev)

### Quick start (one command, Windows)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\project\run-website.ps1"
```

`run-website.ps1` clears the console, checks Node/npm, creates `.env` from
`.env.example` if missing, installs deps, runs `prisma generate` + `db push`,
seeds the demo data, opens the browser and starts the server on
`http://localhost:3000`. Flags: `-Prod`, `-SkipInstall`, `-SkipDb`,
`-SkipSeed`, `-NoBrowser`, `-Port <n>`.

### Manual setup

```bash
# Install dependencies
npm install

# Environment
cp .env.example .env        # then set DATABASE_URL (+ NEXTAUTH_SECRET)

# Generate Prisma client + push schema
npx prisma generate
npx prisma db push

# Seed the rich demo dataset
npm run db:seed

# Start development server (custom server.js with Socket.IO realtime)
npm run dev                  # http://localhost:3000
```

> `npm run dev` and `npm start` both boot `server.js` (Next.js + Socket.IO).
> `npm run dev:next` runs plain `next dev` if you ever need it.

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/dcms?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-change-in-production"
# Required for Auth.js v5 on self-hosted deployments (production builds)
AUTH_TRUST_HOST="true"

# Cloudflare R2
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME=""
R2_PUBLIC_URL=""
NEXT_PUBLIC_R2_PUBLIC_URL=""   # public CDN base, exposed to the browser

# Resend (Email)
RESEND_API_KEY=""
EMAIL_FROM="noreply@dcms.local"
```

### Seed Data

The idempotent seed (`prisma/seed.ts`) creates a rich, realistic dataset:

| Data                          | Count / Notes                                                        |
| ----------------------------- | -------------------------------------------------------------------- |
| Permissions                   | 16 exact PRD keys                                                     |
| Roles                         | 13 (Admin, Member, President, VP, Treasurer, Secretary, coordinators…) |
| Committees                    | 3 (2023–24, 2024–25 dissolved + current 2025–26 ACTIVE)              |
| Departments                   | 10 current + 4 past-committee departments, with coordinators          |
| Members                       | 30 named members (Active/Pending/Alumni/Inactive/Suspended) + admin + demo + converted applicants |
| Committee roles               | Officers assigned on current + past committees with history           |
| Tasks                         | 16 department tasks across TODO / IN_PROGRESS / DONE                  |
| Events                        | 29 (completed, ongoing, upcoming, drafts, cancelled)                  |
| Registration windows          | 5 (closed, LIVE Fall 2026, draft, scheduled)                          |
| Applicants                    | 52 submissions across windows with responses & skills                |
| Club updates                  | 16 rich-text announcements                                           |
| Gallery                       | 8 albums / 34 items                                                  |
| Promotions                    | 14 requests in every workflow state                                  |
| Notifications / Audit logs    | Seeded per user + audit trail                                        |

**Test accounts**

| Role   | Email                 | Password     |
| ------ | --------------------- | ------------ |
| Admin  | `admin@dcms.local`    | `admin123`   |
| Member | `demo@dcms.local`     | `demo123`    |
| Members| any `DCMS-xxx` member (e.g. `sarah.chen@university.edu`) | `member123` |

> ⚠️ **`npm test` truncates the dev database** (unit tests share the
> `DATABASE_URL` in `.env`). After running tests, re-seed with `npm run db:seed`.

## API Routes (62 route modules)

### Authentication & Session

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
| GET    | `/api/users`                   | `member.create` | Users without member profiles (search) |

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
| GET    | `/api/gallery/[id]`       | `gallery.manage` | Get album              |
| PATCH  | `/api/gallery/[id]`       | `gallery.manage` | Update album           |
| DELETE | `/api/gallery/[id]`       | `gallery.manage` | Delete album (+ R2)    |
| GET    | `/api/gallery/items`      | Public             | List items (paginated) |
| POST   | `/api/gallery/items`      | `gallery.upload` | Add item               |
| DELETE | `/api/gallery/items/[id]` | `gallery.manage` | Delete item (+ R2)     |
| POST   | `/api/gallery/upload-url` | `gallery.upload` | Get presigned URL      |

### Roles & Permissions

| Method | Route                | Permission             | Description         |
| ------ | -------------------- | ---------------------- | ------------------- |
| GET    | `/api/roles`       | `permissions.manage` | List roles          |
| POST   | `/api/roles`       | `permissions.manage` | Create role         |
| GET    | `/api/roles/[id]`  | `permissions.manage` | Get role            |
| PATCH  | `/api/roles/[id]`  | `permissions.manage` | Update role         |
| DELETE | `/api/roles/[id]`  | `permissions.manage` | Delete role         |
| GET    | `/api/permissions` | `permissions.manage` | List permissions    |
| POST   | `/api/permissions` | `permissions.manage` | Re-seed permissions |

### Settings, Audit, Notifications & Contacts

| Method | Route                            | Permission             | Description        |
| ------ | -------------------------------- | ---------------------- | ------------------ |
| GET    | `/api/settings`                | `settings.manage`    | Get settings       |
| PATCH  | `/api/settings`                | `settings.manage`    | Update settings    |
| GET    | `/api/settings/storage`        | `settings.manage`    | R2 storage status  |
| GET    | `/api/audit-log`               | `permissions.manage` | Paginated audit log|
| GET    | `/api/notifications`           | Auth                  | List notifications |
| POST   | `/api/notifications/[id]/read` | Auth                  | Mark as read       |
| GET    | `/api/contacts`                | `settings.manage`    | Contact inbox      |
| PATCH  | `/api/contacts/[id]`           | `settings.manage`    | Mark handled/reopen|
| DELETE | `/api/contacts/[id]`           | `settings.manage`    | Delete message     |

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
| GET    | `/api/public/events/[id]`  | Event detail              |
| GET    | `/api/public/productions`  | Performances              |
| GET    | `/api/public/updates`      | Published updates         |
| GET    | `/api/public/updates/[id]` | Update detail             |
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

24 models total (including NextAuth tables).

## Security

- **Passwords:** bcrypt with cost factor 12
- **Sessions:** JWT with 24-hour expiry, 5-minute permission refresh
- **Rate Limiting:** Contact form (5/15min), Registration apply (3/hour), Account signup (3/hour), Login throttling (10 failed attempts / 15 min per account)
- **Input Validation:** Zod schemas on all mutating endpoints
- **Audit Trail:** All state changes logged to AuditLog
- **Email Safety:** Subject injection prevention, HTML escaping
- **R2 Security:** Presigned URLs with 1-hour expiry, path traversal prevention
- **RBAC:** Permission-based, not role-based; department-scoped access
- **Realtime:** Socket.IO broadcasts are read-only change *hints* (no data payloads);
  targeted notifications are room-scoped to the owning user's session

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
npm run dev             # Start dev server (custom server.js + Socket.IO realtime)
npm run build           # Production build
npm start               # Run production build (server.js)
npm run lint            # ESLint
npx tsc --noEmit        # Type check
npm test                # Vitest unit tests   ⚠️ truncates the dev DB — re-seed after
npm run test:coverage   # Unit tests with coverage report
npm run test:e2e        # Playwright E2E suite (see E2E.md)
npm run test:e2e:http   # Standalone HTTP E2E smoke suite (see E2E.md)
npm run db:generate     # Regenerate Prisma client
npm run db:push         # Push schema changes
npm run db:migrate      # Create/apply a migration (prisma migrate dev)
npm run db:seed         # Seed rich demo data (idempotent)
npm run db:reset        # Reset + seed database
npm run db:studio       # Open Prisma Studio
npx tsx scripts/realtime-smoke.ts    # Live realtime broadcast check (server must be running)
npx tsx scripts/realtime-tx-check.ts # Live transaction-scoped realtime check
npx tsx scripts/responsive-check.ts  # UI overflow/console audit @ 375/768/1440px
npx tsx scripts/ui-shots.ts          # Responsive screenshots + grid column check
```

## Project Structure

```
Drama_Club_Management_System/
├── server.js                         # Custom server: Next.js + Socket.IO realtime
├── run-website.ps1                   # One-command Windows launcher (execution-policy bypass)
├── prisma/
│   ├── schema.prisma                 # 24 models with relations
│   └── seed.ts                       # Idempotent rich seed script
├── prisma.config.ts                  # Prisma 7 config
├── playwright.config.ts              # Playwright E2E config (webServer on :3310)
├── vitest.config.ts / eslint.config.mjs / next.config.ts
├── scripts/                          # e2e.ts, e2e-server.ts, smoke-test.ts, reset-db.ts,
│                                     # realtime-smoke.ts, realtime-tx-check.ts,
│                                     # responsive-check.ts, ui-shots.ts, verify-db.ts…
├── e2e/                              # Playwright specs (HTTP request-level, no browser)
├── src/
│   ├── app/
│   │   ├── api/                      # 62 API route modules
│   │   │   ├── auth/                 # NextAuth + registration
│   │   │   ├── members/ users/       # Member CRUD, user lookup, dept assignment
│   │   │   ├── committees/           # Committee + role management
│   │   │   ├── departments/          # Department + task CRUD
│   │   │   ├── registration-windows/ # Window + applicant flow
│   │   │   ├── applicants/           # Review, CSV export, conversion
│   │   │   ├── promotions/           # Promotion workflow
│   │   │   ├── events/ updates/      # Events + club updates
│   │   │   ├── gallery/              # Album/item management + R2
│   │   │   ├── roles/ permissions/   # RBAC
│   │   │   ├── settings/             # System settings + storage status
│   │   │   ├── notifications/ audit-log/ contacts/   # Inbox & trail
│   │   │   ├── session/ dashboard/   # Session + dashboards
│   │   │   ├── public/               # Public website endpoints
│   │   │   └── contact/              # Contact form
│   │   ├── (public)/                 # Public site pages (responsive)
│   │   └── (dashboard)/              # Admin dashboard pages
│   ├── components/
│   │   ├── live-refresh.tsx          # Public pages live re-render
│   │   ├── app-shell.tsx             # Dashboard shell + live notification bell
│   │   ├── public-nav.tsx / public-footer.tsx / apply-form.tsx
│   │   └── ui/                       # Design system (Card, Grid presets, Modal, …)
│   └── lib/
│       ├── realtime.ts               # emitChange / emitNotification helpers
│       ├── client/                   # api.ts (fetch wrapper), session.tsx, socket.tsx
│       ├── server.ts                 # publicFetch / R2 URL helpers
│       ├── auth.ts                   # NextAuth v5 config
│       ├── permissions.ts            # RBAC engine (can, getUserPermissions)
│       ├── prisma.ts                 # Prisma client + realtime change-emission extension
│       ├── audit.ts / notifications.ts / email.ts / r2.ts
│       ├── rate-limit.ts / registration-form.ts
│       ├── registration-window-transitions.ts / applicant-transitions.ts
│       ├── validations.ts / api-helpers.ts
│       └── …                         # cn, format, sanitize, types, theme
└── README.md
```

## License

MIT
