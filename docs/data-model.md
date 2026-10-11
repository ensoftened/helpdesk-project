# Data Model - Helpdesk/Ticketing System

## What this document is

This document describes every table, column, relationship, constraint, and index in the helpdesk database. Think of it like a blueprint for a house - before we pour concrete, we need to agree on where every room, door, and window goes.

Once this document is finalized, we will turn it into a Prisma schema file and create the real database tables through migrations.

---

## Overview: What tables exist and why

| Table | Purpose (simple analogy) |
|---|---|
| **User** | A person who uses the system. Like an employee badge - it identifies you and says what you are allowed to do. |
| **Team** | A group of agents. Like a department: "Support Team", "IT Team". |
| **Category** | What kind of problem the ticket is about. Like folders in a filing cabinet: "Hardware", "Software", "Network". |
| **Priority** | How urgent the ticket is. Like a triage tag at a hospital: Low, Medium, High, Urgent. |
| **Ticket** | A single help request. Like a support case or work order. This is the central table - everything revolves around it. |
| **Comment** | A message added to a ticket. Can be public (visible to the requester) or internal (agents only). |
| **AuditLog** | A record of every change made to a ticket. Like a security camera recording - you can always look back and see who changed what and when. |
| **RefreshToken** | Stores long-lived tokens that let users stay logged in without re-entering their password. |
| **SLA** | Service Level Agreement rules. Defines how fast a ticket must be responded to and resolved. |

---

## User

Stores everyone who uses the system — requesters, agents, and admins. The `role`
column determines what a user is allowed to do. Permissions are enforced in code,
not in this table, so the table just stores the role name.

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | Yes | auto (uuid v4) | Unique identifier for every user. |
| `email` | VARCHAR(255) | Yes | — | Login email. Must be unique across all users. |
| `passwordHash` | VARCHAR(255) | Yes | — | The hashed (scrambled) password. We never store the raw password. |
| `name` | VARCHAR(255) | Yes | — | The user's full name (visible on tickets and comments). |
| `role` | ENUM('Requester', 'Agent', 'Admin') | Yes | — | What this person can do in the system. |
| `teamId` | UUID | No | NULL | If the user is an Agent, which team they belong to. NULL for Requesters. |
| `isActive` | BOOLEAN | Yes | `true` | If `false`, the user cannot log in and their existing tokens are rejected. |
| `createdAt` | TIMESTAMPTZ | Yes | `now()` | When the user account was created. |
| `updatedAt` | TIMESTAMPTZ | Yes | `now()` | When the user was last modified (auto-updated by Prisma). |

**Indexes:**
- Unique index on `email` (fast login lookups, prevents duplicate emails)

**Relationships:**
- `teamId` → `Team.id` (a User optionally belongs to one Team)
- One User can create many Tickets (`requesterId`)
- One User can be assigned many Tickets (`assigneeId`)
- One User can write many Comments
- One User can have many RefreshTokens
- One User can cause many AuditLog entries

**Business rules (enforced in code):**
- If `role` is 'Agent', `teamId` must be set.
- If `isActive` is `false`, authentication is rejected regardless of password.
---

### Team

Groups agents together. Tickets can be assigned to a team before a specific
agent picks them up. This is how agents see "our team's tickets" on their dashboard.

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | Yes | auto (uuid v4) | Unique identifier. |
| `name` | VARCHAR(100) | Yes | — | Team name, e.g. "IT Support", "Facilities". Must be unique. |
| `description` | TEXT | No | NULL | Optional description of what the team handles. |
| `createdAt` | TIMESTAMPTZ | Yes | `now()` | When the team was created. |
| `updatedAt` | TIMESTAMPTZ | Yes | `now()` | When the team was last modified. |

**Indexes:**
- Unique index on `name`

**Relationships:**
- One Team has many Users (agents who belong to this team)
- One Team has many Tickets (tickets routed to this team)

---

### Category

Describes the type of issue a ticket is about. Admins can create, edit, and
delete categories. Examples: "Hardware", "Software", "Network", "Access Request".

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | Yes | auto (uuid v4) | Unique identifier. |
| `name` | VARCHAR(100) | Yes | — | Category name, must be unique. |
| `description` | TEXT | No | NULL | Optional longer description. |
| `createdAt` | TIMESTAMPTZ | Yes | `now()` | When created. |
| `updatedAt` | TIMESTAMPTZ | Yes | `now()` | When last modified. |

**Indexes:**
- Unique index on `name`

**Relationships:**
- One Category has many Tickets
- One Category can have many SLA rules

---

### Priority

How urgent a ticket is. Admin-managed. The `level` column provides numeric
ordering so "High" (3) always sorts above "Medium" (2).

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | Yes | auto (uuid v4) | Unique identifier. |
| `name` | VARCHAR(50) | Yes | — | Priority name: "Low", "Medium", "High", "Urgent". Must be unique. |
| `level` | INTEGER | Yes | — | Numeric rank. Higher number = more urgent. Must be unique. |
| `createdAt` | TIMESTAMPTZ | Yes | `now()` | When created. |
| `updatedAt` | TIMESTAMPTZ | Yes | `now()` | When last modified. |

**Indexes:**
- Unique index on `name`
- Unique index on `level`

**Relationships:**
- One Priority has many Tickets
- One Priority can have many SLA rules

---

### Ticket

The heart of the system. Every help request becomes a ticket. This table tracks
who asked for help, what they need, who's working on it, and what state it's in.

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | Yes | auto (uuid v4) | Unique ticket identifier. |
| `title` | VARCHAR(255) | Yes | — | Short summary of the issue. |
| `description` | TEXT | Yes | — | Full details of the problem. |
| `status` | ENUM('Open', 'In Progress', 'Waiting on Requester', 'Resolved', 'Closed', 'Reopened') | Yes | `'Open'` | Current state in the workflow. |
| `priorityId` | UUID | Yes | — | How urgent this ticket is. |
| `categoryId` | UUID | Yes | — | What type of issue this is. |
| `requesterId` | UUID | Yes | — | The user who filed this ticket. |
| `assigneeId` | UUID | No | NULL | The agent currently working on it. NULL = unassigned. |
| `teamId` | UUID | No | NULL | The team responsible. Assigned when the ticket is routed. |
| `dueAt` | TIMESTAMPTZ | No | NULL | Deadline calculated from SLA rules. NULL if no SLA applies. |
| `createdAt` | TIMESTAMPTZ | Yes | `now()` | When the ticket was filed. |
| `updatedAt` | TIMESTAMPTZ | Yes | `now()` | When last modified. |

**Indexes:**
- Index on `requesterId` (fast lookup: "show me my tickets")
- Index on `assigneeId` (fast lookup: "show me tickets assigned to me")
- Index on `teamId` (fast lookup: "show me my team's tickets")
- Index on `status` (filtering by status)
- Index on `priorityId` (sorting/filtering by urgency)
- Index on `categoryId` (filtering by category)
- Composite index on `(status, teamId)` (agent dashboard: "open tickets for my team")

**Status transitions allowed:**
See `docs/workflow.md` for the full transition map. In short:
- Open → In Progress, Waiting on Requester
- In Progress → Waiting on Requester, Resolved
- Waiting on Requester → In Progress, Resolved
- Resolved → Closed
- Closed → Reopened
- Reopened → In Progress, Waiting on Requester

Any other transition is rejected.

**Relationships:**
- `requesterId` → `User.id` (who filed it)
- `assigneeId` → `User.id` (who's working on it)
- `teamId` → `Team.id` (which team)
- `priorityId` → `Priority.id`
- `categoryId` → `Category.id`
- One Ticket has many Comments
- One Ticket has many AuditLog entries
---

### Comment

Messages on a ticket — like replies in an email thread. Comments can be public
(requester can see) or internal (only agents and admins can see).

**Important:** The backend must filter out `isInternal = true` comments when
a Requester requests a ticket's comments. This is a hard security rule.

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | Yes | auto (uuid v4) | Unique comment identifier. |
| `body` | TEXT | Yes | — | The comment text. |
| `isInternal` | BOOLEAN | Yes | `false` | `true` = only agents/admins see this. `false` = requester can also see. |
| `ticketId` | UUID | Yes | — | Which ticket this comment belongs to. |
| `userId` | UUID | Yes | — | Who wrote the comment. |
| `createdAt` | TIMESTAMPTZ | Yes | `now()` | When written. |
| `updatedAt` | TIMESTAMPTZ | Yes | `now()` | When last edited. |

**Indexes:**
- Index on `ticketId` (fast lookup of all comments on a ticket)
- Index on `userId` (lookup by author)
- Composite index on `(ticketId, createdAt)` (display in chronological order)

**Relationships:**
- `ticketId` → `Ticket.id`
- `userId` → `User.id`

---

### AuditLog

A record of every change made to a ticket. This is how we track accountability
— like a paper trail that shows who did what, when. Every entry is created at
the moment a change happens, in the same database transaction as the change itself.

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | Yes | auto (uuid v4) | Unique log entry identifier. |
| `ticketId` | UUID | Yes | — | Which ticket was changed. |
| `changedByUserId` | UUID | Yes | — | Who made the change. |
| `field` | VARCHAR(100) | Yes | — | What was changed, e.g. "status", "assignee", "priority". |
| `oldValue` | VARCHAR(255) | No | NULL | What it was before. NULL for first-time assignments. |
| `newValue` | VARCHAR(255) | Yes | — | What it became. |
| `createdAt` | TIMESTAMPTZ | Yes | `now()` | When the change happened. |

**Indexes:**
- Index on `ticketId` (show history for a ticket)
- Index on `changedByUserId` (audit: what changes did a user make?)
- Index on `(ticketId, createdAt)` (view history in order)

**Relationships:**
- `ticketId` → `Ticket.id`
- `changedByUserId` → `User.id`

---

### RefreshToken

Stores long-lived refresh tokens so users don't have to log in every time their
access token expires. Access tokens are short-lived (e.g. 15 minutes) and never
stored. Refresh tokens are stored here so we can validate them and also revoke them.

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | Yes | auto (uuid v4) | Unique identifier. |
| `token` | VARCHAR(512) | Yes | — | The hashed refresh token string. The raw token is sent to the client and never stored. |
| `userId` | UUID | Yes | — | Who this token belongs to. |
| `expiresAt` | TIMESTAMPTZ | Yes | — | When this token stops working. |
| `createdAt` | TIMESTAMPTZ | Yes | `now()` | When the token was issued. |

**Indexes:**
- Unique index on `token` (fast token lookup during refresh)
- Index on `userId` (find all tokens for a user)

**Relationships:**
- `userId` → `User.id`

---

### SLA (Service Level Agreement)

Defines how quickly tickets must be responded to and resolved, based on their
category and priority. For example: "a High-priority Hardware ticket must get a
first response within 2 hours and be resolved within 8 hours."

Admin-managed. Admins create and edit SLA rules.

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | Yes | auto (uuid v4) | Unique identifier. |
| `categoryId` | UUID | No | NULL | Which category this SLA applies to. NULL = applies to all categories. |
| `priorityId` | UUID | Yes | — | Which priority this SLA applies to. |
| `responseHours` | INTEGER | Yes | — | Maximum hours until first response. |
| `resolutionHours` | INTEGER | Yes | — | Maximum hours until resolution. |
| `createdAt` | TIMESTAMPTZ | Yes | `now()` | When created. |
| `updatedAt` | TIMESTAMPTZ | Yes | `now()` | When last modified. |

**Constraints:**
- Unique constraint on `(categoryId, priorityId)`. You can't have two SLA rules
  for the same category-priority combination.

**Indexes:**
- Unique composite index on `(categoryId, priorityId)` (enforced by constraint)

**Relationships:**
- `categoryId` → `Category.id`
- `priorityId` → `Priority.id`
---

## How SLA works with Tickets

When a ticket is created:
1. Look up the SLA rule matching the ticket's `categoryId` + `priorityId`.
2. If a specific rule exists for that category+priority, use it.
3. If no specific rule exists, look for a rule with `categoryId = NULL` and the matching priority (a "default" rule for that priority).
4. If a rule is found, calculate `dueAt = now() + resolutionHours` and set it on the Ticket.
5. If no rule exists, `dueAt` stays NULL (no deadline).

---

## Entity Relationship Summary

```
User ──1:N── Ticket (requester)
User ──1:N── Ticket (assignee)
User ──1:N── Comment
User ──1:N── AuditLog
User ──1:N── RefreshToken
Team ──1:N── User
Team ──1:N── Ticket
Category ──1:N── Ticket
Category ──1:N── SLA
Priority ──1:N── Ticket
Priority ──1:N── SLA
Ticket ──1:N── Comment
Ticket ──1:N── AuditLog
```

---

## Folder Structure (planned)

```
helpdesk-project/
├── .clinerules
├── .gitignore
├── .env.example
├── docker-compose.yml
│
├── docs/
│   ├── data-model.md     ← this file
│   ├── permissions.md
│   ├── workflow.md
│   └── api.md
│
├── server/               ← Node.js + Express + TypeScript backend
│   ├── tsconfig.json
│   ├── package.json
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma          ← turns this data model into code
│   │   └── migrations/            ← auto-generated migration files
│   └── src/
│       ├── index.ts               ← application entry point
│       ├── config/                ← database connection, environment variables
│       │   └── env.ts
│       ├── routes/                ← Express route definitions (URL → handler wiring)
│       │   ├── auth.routes.ts
│       │   ├── user.routes.ts
│       │   ├── ticket.routes.ts
│       │   └── ...
│       ├── controllers/           ← request handlers (parse request, call service, send response)
│       ├── services/              ← business logic (the "what to do" code)
│       ├── middleware/             ← auth checks, role checks, rate limiting
│       │   ├── authenticate.ts
│       │   ├── authorize.ts
│       │   └── errorHandler.ts
│       ├── validators/            ← Zod schemas for every endpoint
│       └── utils/                 ← constants, helpers, shared types
│           ├── constants.ts
│           └── errors.ts
│
├── client/               ← React + TypeScript + Vite frontend
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── main.tsx              ← React entry point
│       ├── App.tsx               ← root component with routing
│       ├── api/                  ← functions that call the backend API
│       │   └── client.ts
│       ├── components/           ← reusable UI pieces (buttons, modals, etc.)
│       ├── pages/                ← full-page components (Login, Dashboard, TicketDetail)
│       ├── hooks/                ← custom React hooks (useAuth, useTickets)
│       ├── contexts/             ← React contexts (AuthContext, etc.)
│       └── utils/                ← helpers and constants
│
└── tests/               ← (integration / e2e tests if needed)
```

---

## Next steps (after Phase 1 approval)

1. Phase 2: Write the Prisma schema (`server/prisma/schema.prisma`) based on this model.
2. Phase 3: Run the first migration to create the tables in PostgreSQL.
3. Phase 4+: Build auth, tickets, comments, etc.

---

## Revision history

| Date | Change | Author |
|---|---|---|
| 2026-10-05 | Initial proposal | Phase 1 |
