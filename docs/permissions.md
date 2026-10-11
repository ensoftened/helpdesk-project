# Permissions Matrix — Helpdesk/Ticketing System

## What this document is

This document defines exactly what each user role is allowed to do in the system.
Think of it like a security guard's checklist at a building entrance: for every door
(an action), it tells you which badge colors (roles) can go through.

The three roles are:

| Role | Symbol | Who they are |
|------|--------|-------------|
| **Requester** | R | The person asking for help. Like a customer filing a support ticket. |
| **Agent** | A | The person providing help. Works on tickets assigned to their team. |
| **Admin** | Ad | The system manager. Controls users, teams, and configuration. |

**Key principle:** The backend is the source of truth. The frontend may hide buttons
or links, but every permission is enforced on the server. If a requester somehow
sends a request to delete a user, the server rejects it even if the frontend has no
"delete user" button.

---

## How to read the matrices

Each table below covers one resource. Each row is one action. Each column is one role.

- ✅ = allowed
- ❌ = forbidden
- ⚠️ = allowed with a restriction (read the note)

---

## 1. Authentication (no resource, just the login/logout system)

These are the actions anyone can take just to get into the system (or stay in).
They don't require a role — they happen before a role is even checked.

| Action | Guest (no token) | Requester | Agent | Admin | Notes |
|--------|:---:|:---:|:---:|:---:|-------|
| **Register** (create account) | ✅ | ✅ | ✅ | ✅ | Anyone can register. The `role` defaults to `Requester` on self-registration. Only an Admin can later promote someone. |
| **Login** | ✅ | ✅ | ✅ | ✅ | Deactivated users (`isActive = false`) are rejected even with correct password. |
| **Refresh token** | ✅ | ✅ | ✅ | ✅ | If the refresh token is valid, not expired, and the user is still active, issue a new access token. |
| **Logout** | ❌ | ✅ | ✅ | ✅ | Requires a valid token. Revokes the refresh token so it can't be used again. |
| **View own profile** | ❌ | ✅ | ✅ | ✅ | Any authenticated user can see their own `id`, `email`, `name`, `role`, `teamId`. |

**Special rules for authentication:**
- A deactivated user (`isActive = false`) cannot log in — the server returns an error before even checking the password.
- If a user is deactivated *after* they have logged in, any existing refresh tokens for that user are rejected immediately. The access token is short-lived and will expire naturally (or the middleware can check `isActive` on every request).
- Self-registration always creates a `Requester`. There is no way for a new user to register as an Agent or Admin through the public API.
---

## 2. Tickets

Tickets are the central resource. Most actions have scope rules — not just "can you
do this action," but "can you do it *on this specific ticket*."

| Action | Requester | Agent | Admin | Scope rule |
|--------|:---:|:---:|:---:|------------|
| **Create ticket** | ✅ | ✅ | ✅ | Requesters create tickets for themselves. Agents and Admins can create tickets on behalf of any requester. |
| **View all tickets** | ❌ | ❌ | ✅ | Only Admins see every ticket in the system. |
| **View team tickets** | ❌ | ✅ | ✅ | Agents see tickets where `teamId` matches *their* team. |
| **View own tickets** | ✅ | ✅ | ✅ | Every user sees tickets where `requesterId` = their own user ID. |
| **View one ticket** | ⚠️ | ⚠️ | ✅ | Requester: only if `requesterId` is them. Agent: only if `teamId` matches their team. Admin: any ticket. |
| **Update ticket status** | ⚠️ | ✅ | ✅ | **Requester:** can only close their own tickets (status → `Closed` from `Resolved` or `Waiting on Requester`). **Agent:** can transition any ticket in their team, following workflow rules. **Admin:** any ticket, any transition. |
| **Assign ticket to self** | ❌ | ✅ | ✅ | Agent on team tickets. Admin on any ticket. |
| **Reassign ticket** | ❌ | ⚠️ | ✅ | Agent: only within own team. Admin: cross-team to any agent. |
| **Change ticket team** | ❌ | ❌ | ✅ | Only Admins. |
| **Change ticket priority** | ❌ | ❌ | ✅ | Only Admins. |
| **Change ticket category** | ❌ | ❌ | ✅ | Only Admins. |
| **Edit title/description** | ⚠️ | ✅ | ✅ | Requester: only own ticket when status is `Open`. Agent/Admin: any ticket in scope. |
| **Delete ticket** | ❌ | ❌ | ✅ | Only Admins. |

**Ticket scope summary:**
- **Requester** — only their own tickets. Create, view, comment, close (limited), edit (only when `Open`).
- **Agent** — tickets in their team. View team tickets, update status, assign to self, reassign within team, edit, comment.
- **Admin** — all tickets. Everything, plus cross-team reassignment, priority/category/team changes, deletion.

---

## 3. Comments

Comments live on tickets, so comment permissions inherit the ticket's scope rules
*plus* additional rules around internal vs. public comments.

| Action | Requester | Agent | Admin | Notes |
|--------|:---:|:---:|:---:|-------|
| **Add public comment** | ⚠️ | ✅ | ✅ | Requester: only on their own tickets. |
| **Add internal comment** | ❌ | ✅ | ✅ | The `isInternal` flag is set to `true`. Requesters must never see these. |
| **View comments on a ticket** | ⚠️ | ⚠️ | ✅ | Requester: only public comments on own tickets. Agent: all comments on team tickets. Admin: all comments on any ticket. |
| **Edit own comment** | ⚠️ | ✅ | ✅ | Requester: own public comments on own tickets. Agent/Admin: own comments in scope. |
| **Delete any comment** | ❌ | ❌ | ✅ | Only Admin. |
| **Delete own comment** | ❌ | ✅ | ✅ | Agent/Admin can delete own. Requesters cannot. |

**Hard rule — internal comment filtering:**
When the server builds a response that includes comments, it **must** check the
requesting user's role:
- If `role = Requester`: filter out all comments where `isInternal = true`.
- If `role = Agent` or `role = Admin`: include all comments.
---

## 4. Users

User management is mostly an Admin responsibility. Regular users can only manage
their own profile (name, password).

| Action | Requester | Agent | Admin | Notes |
|--------|:---:|:---:|:---:|-------|
| **List all users** | ❌ | ❌ | ✅ | Admins see all users, including deactivated ones. |
| **View one user** | ❌ | ❌ | ✅ | Admins can view any user's full details (except password hash). |
| **Create user** | ❌ | ❌ | ✅ | Admins create users directly. Can set any role. |
| **Update own profile** | ✅ | ✅ | ✅ | Name, email, password. Changing email requires current password. |
| **Update any user** | ❌ | ❌ | ✅ | Admins can change name, email, role, team, active status. |
| **Deactivate user** | ❌ | ❌ | ✅ | Sets `isActive = false`. Existing tokens are revoked. |
| **Reactivate user** | ❌ | ❌ | ✅ | Sets `isActive = true`. |
| **Change user role** | ❌ | ❌ | ✅ | Promote/demote. Cannot change your own role. |
| **Delete user** | ❌ | ❌ | ✅ | Permanent deletion. Orphaned records must be handled. |

**Self-service rules:**
- Any authenticated user can update their own `name`, `email`, and `password`.
- Changing email requires the current password as confirmation.
- Changing password requires the current password. New password: minimum 8 characters.
- A user cannot change their own role or active status.

---

## 5. Teams

Teams are Admin-managed. Agents are placed into teams by Admins.

| Action | Requester | Agent | Admin | Notes |
|--------|:---:|:---:|:---:|-------|
| **List all teams** | ❌ | ✅ | ✅ | Agents see all teams. Admins too. |
| **View one team** | ❌ | ✅ | ✅ | Includes the list of agents in that team. |
| **Create team** | ❌ | ❌ | ✅ | Name must be unique. |
| **Update team** | ❌ | ❌ | ✅ | Change name or description. |
| **Delete team** | ❌ | ❌ | ✅ | Cannot delete a team with agents still assigned. |

**Why Agents can list teams:** Agents may need to know about other teams when
escalating or transferring tickets (even though only Admins can actually transfer).

---

## 6. Categories

Categories classify what type of issue a ticket is. Admin-managed only.

| Action | Requester | Agent | Admin | Notes |
|--------|:---:|:---:|:---:|-------|
| **List categories** | ✅ | ✅ | ✅ | Everyone needs to pick a category when creating a ticket. |
| **View one category** | ✅ | ✅ | ✅ | Public read access. |
| **Create category** | ❌ | ❌ | ✅ | Name must be unique. |
| **Update category** | ❌ | ❌ | ✅ | Change name or description. |
| **Delete category** | ❌ | ❌ | ✅ | Cannot delete if tickets exist in that category. |

---

## 7. Priorities

Priorities define urgency. Admin-managed only, but everyone can read them.

| Action | Requester | Agent | Admin | Notes |
|--------|:---:|:---:|:---:|-------|
| **List priorities** | ✅ | ✅ | ✅ | Everyone needs to pick a priority when creating a ticket. |
| **View one priority** | ✅ | ✅ | ✅ | Public read access. |
| **Create priority** | ❌ | ❌ | ✅ | Name and level must both be unique. |
| **Update priority** | ❌ | ❌ | ✅ | Change name or level. |
| **Delete priority** | ❌ | ❌ | ✅ | Cannot delete if tickets exist with that priority. |

---

## 8. SLA Rules

SLA rules define response and resolution time targets. Admin-managed only.

| Action | Requester | Agent | Admin | Notes |
|--------|:---:|:---:|:---:|-------|
| **List SLA rules** | ❌ | ✅ | ✅ | Agents see SLA rules (useful for understanding deadlines). |
| **View one SLA rule** | ❌ | ✅ | ✅ | |
| **Create SLA rule** | ❌ | ❌ | ✅ | Unique on `(categoryId, priorityId)`. |
| **Update SLA rule** | ❌ | ❌ | ✅ | |
| **Delete SLA rule** | ❌ | ❌ | ✅ | |

---

## 9. Attachments

Attachments are files uploaded to tickets. Permissions follow the same ticket-scoping
rules as comments and status changes.

| Action | Requester | Agent | Admin | Notes |
|--------|:---:|:---:|:---:|-------|
| **Upload file** | ⚠️ | ⚠️ | ✅ | Requester: only own tickets. Agent: only team tickets. Max 10 MB. |
| **List attachments** | ⚠️ | ⚠️ | ✅ | Requester: only own tickets. Agent: only team tickets. Returns metadata only (no file bytes). |
| **Download file** | ⚠️ | ⚠️ | ✅ | Requester: only own tickets. Agent: only team tickets. Requires valid auth token. |

**Special rules for attachments:**
- Files over 10 MB are rejected at both the Multer middleware layer and the service layer.
- Filenames are validated against a safe-character regex to prevent path traversal attacks.
- File bytes are stored as BLOBs directly in the database — no filesystem dependency.
- The list endpoint never returns file bytes; only metadata (id, fileName, mimeType, sizeBytes, createdAt).
- The download endpoint checks the parent ticket's access rules, not just the attachment record itself.

---

## 10. Audit Log

The audit log is a read-only record of all changes. Nobody can create, edit, or
delete audit log entries directly — they are created by the system when tickets change.

| Action | Requester | Agent | Admin | Notes |
|--------|:---:|:---:|:---:|-------|
| **View audit log for a ticket** | ❌ | ✅ | ✅ | Agents: team tickets. Admins: any ticket. |
| **View all audit logs** | ❌ | ❌ | ✅ | System-wide audit view. |
| **Create/edit/delete entries** | ❌ | ❌ | ❌ | Not even Admins can modify audit log. Append-only. |
---

## 11. Quick Reference: Role summary

### Requester
- ✅ Create tickets
- ✅ View, comment on, and close **only their own** tickets
- ✅ Edit own tickets when `Open`
- ✅ Manage own profile (name, email, password)
- ✅ View categories and priorities (read-only)
- ✅ Upload and download files on own tickets
- ❌ Everything else

### Agent
- ✅ Everything a Requester can do
- ✅ View tickets assigned to **their team**
- ✅ Update ticket status (within workflow rules)
- ✅ Assign tickets to themselves
- ✅ Reassign tickets within their team
- ✅ Add public and internal comments
- ✅ Edit/delete own comments
- ✅ View audit log for team tickets
- ✅ View SLA rules and all teams
- ✅ Upload and download files on team tickets
- ❌ Manage users, teams, categories, priorities, SLA rules
- ❌ Cross-team reassignment
- ❌ Delete tickets or other users' comments

### Admin
- ✅ Everything
- ✅ View and manage all tickets (any team, any requester)
- ✅ Create, update, delete users, teams, categories, priorities, SLA rules
- ✅ Cross-team and cross-agent reassignment
- ✅ Change ticket priority, category, team
- ✅ Delete tickets and comments
- ✅ View system-wide audit log
- ❌ Cannot manually modify audit log entries (append-only)
- ❌ Cannot deactivate or change role of themselves

---

## 12. Permission enforcement architecture

Permissions are enforced in two layers in the backend:

1. **Authentication middleware (`authenticate`):** Runs on every protected route.
   Reads the JWT from the `Authorization` header, verifies it, and attaches the
   user's `id`, `role`, `teamId`, and `isActive` to the request object. If the
   token is missing, expired, or invalid, the request is rejected with a `401`
   error. If the user is deactivated, the request is rejected with a `403` error.

2. **Authorization middleware (`requireRole`, `requireOwnership`, etc.):** Runs
   after authentication on routes that need specific role checks. Examples:
   - `requireRole('Admin')` — rejects if the user's role is not Admin.
   - `requireTicketAccess({ owner: true })` — checks if the requester owns the ticket.
   - `requireTeamAccess()` — checks if the agent belongs to the ticket's team.

   These middleware functions read the user from `req.user` (set by the
   authenticate middleware) and compare against the resource being accessed.

**Order matters:** Routes always run `authenticate` first, then role/scope checks,
then the actual route handler. If any middleware fails, the request stops and an
error response is returned.

---

## Revision history

| Date | Change | Author |
|------|--------|--------|
| 2026-10-05 | Initial permissions matrix | Phase 2 — Step 1 |
| 2026-10-06 | Added Attachments section (#9) + role summaries | Phase — Attachments |

This filtering must happen on every endpoint that returns comments.
| **Register** (create account) | ✅ | ✅ | ✅ | ✅ | Anyone can register. The `role` defaults to `Requester` on self-registration. Only an Admin can later promote someone. |
| **Login** | ✅ | ✅ | ✅ | ✅ | Deactivated users (`isActive = false`) are rejected even with correct password. |
| **Refresh token** | ✅ | ✅ | ✅ | ✅ | If the refresh token is valid, not expired, and the user is still active, issue a new access token. |
| **Logout** | ❌ | ✅ | ✅ | ✅ | Requires a valid token. Revokes the refresh token so it can't be used again. |
| **View own profile** | ❌ | ✅ | ✅ | ✅ | Any authenticated user can see their own `id`, `email`, `name`, `role`, `teamId`. |

**Special rules for authentication:**
- A deactivated user (`isActive = false`) cannot log in — the server returns an error before even checking the password.
- If a user is deactivated *after* they have logged in, any existing refresh tokens for that user are rejected immediately. The access token is short-lived and will expire naturally (or the middleware can check `isActive` on every request).
- Self-registration always creates a `Requester`. There is no way for a new user to register as an Agent or Admin through the public API.