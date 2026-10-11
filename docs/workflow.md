# Ticket Workflow — Helpdesk/Ticketing System

## What this document is

This document defines every valid path a ticket can take through its lifecycle,
from creation to closure. Think of it like a board game: each status is a space
on the board, and the arrows between them are the only moves you're allowed to make.
If you try to make an illegal move, the server says "no."

## The six statuses

| # | Status | What it means (simple analogy) |
|---|--------|-------------------------------|
| 1 | Open | The ticket has been filed. Waiting for someone to pick it up. |
| 2 | In Progress | An agent is actively working on the problem. |
| 3 | Waiting on Requester | The agent needs more information from the requester. |
| 4 | Resolved | The agent believes the issue is fixed. |
| 5 | Closed | The requester confirmed the fix. Ticket is done. |
| 6 | Reopened | The requester says the fix didn't work. Back into the workflow. |

## The state diagram

```
                        ┌─────────┐
                        │  Open   │
                        └────┬────┘
                             │
              ┌──────────────┼──────────────┐
              ▼                             ▼
      ┌──────────────┐       ┌─────────────────────┐
      │ In Progress  │       │ Waiting on Requester│
      └──────┬───────┘       └──────────┬──────────┘
             │                          │
             │        ┌───────────┐     │
             ├───────►│ Resolved  │◄────┘
             │        └─────┬─────┘
             │              │
             │        ┌─────▼─────┐
             │        │   Closed  │
             │        └─────┬─────┘
             │              │
             │        ┌─────▼─────┐
             └────────┤ Reopened  │
                      └───────────┘
```

Once a ticket hits Closed, the only way out is Reopened.
No ticket stays in Reopened — it must transition to In Progress or Waiting on Requester.

## Allowed transitions

R = Requester, A = Agent, Ad = Admin. ⚠️ = allowed with restriction (read the note).

| # | From → To | R | A | Ad | Notes |
|---|-----------|---|----|----|-------|
| T1 | Open → In Progress | ❌ | ✅ | ✅ | Agent picks up the ticket. |
| T2 | Open → Waiting on Requester | ❌ | ✅ | ✅ | Agent needs info before starting. |
| T3 | In Progress → Waiting on Requester | ❌ | ✅ | ✅ | Agent is blocked. |
| T4 | In Progress → Resolved | ❌ | ✅ | ✅ | Agent fixed the problem. |
| T5 | Waiting on Requester → In Progress | ❌ | ✅ | ✅ | Requester replied, agent resumes. |
| T6 | Waiting on Requester → Resolved | ❌ | ✅ | ✅ | Agent has enough to resolve. |
| T7 | Resolved → Closed | ⚠️ | ✅ | ✅ | Requester: only own ticket. |
| T8 | Closed → Reopened | ⚠️ | ❌ | ✅ | Requester: only own ticket. Agents cannot reopen. |
| T9 | Reopened → In Progress | ❌ | ✅ | ✅ | Agent picks back up. |
| T10 | Reopened → Waiting on Requester | ❌ | ✅ | ✅ | Agent needs more info after reopen. |

## Examples of rejected transitions

| From → To | Why it's rejected |
|-----------|-------------------|
| Open → Closed | Skipping all the work. |
| Open → Resolved | Must be worked on first. |
| In Progress → Closed | Must be resolved before closing. |
| In Progress → Open | No going backward to Open. |
| Resolved → In Progress | Use Reopen via Closed instead. |
| Closed → Resolved | Use Reopen instead. |
| Closed → Open | Must go: Closed → Reopened → In Progress. |
| Any → same status | No-op. Nothing changed. |

## Who can do what

- Requester: Close own ticket (Resolved → Closed), Reopen own ticket (Closed → Reopened).
- Agent: All work-forward transitions on team tickets (T1-T7, T9, T10). Cannot reopen.
- Admin: Everything, all transitions on any ticket.

## The atomic transaction rule

Every status change does two things as one unit in a Prisma transaction:
1. Update the status field on the Ticket row.
2. Insert a row into AuditLog (field: "status", oldValue, newValue, changedByUserId).

## Transition validation flow

```
1. Authenticated? No → 401
2. Ticket exists? No → 404
3. User has access? (Requester: owns? Agent: same team? Admin: always) No → 403
4. newStatus === currentStatus? Yes → 400
5. Transition key in ALLOWED_TRANSITIONS? No → 422
6. User's role in allowed roles? No → 403
7. Execute transaction → 200 or 500
```

## Where this lives in code

- docs/workflow.md (this file) — human reference
- server/src/utils/constants.ts — machine-readable map

```typescript
// server/src/utils/constants.ts
export const ALLOWED_TRANSITIONS: Record<string, UserRole[]> = {
  "Open:In_Progress":              [UserRole.Agent, UserRole.Admin],
  "Open:Waiting_on_Requester":     [UserRole.Agent, UserRole.Admin],
  "In_Progress:Waiting_on_Requester": [UserRole.Agent, UserRole.Admin],
  "In_Progress:Resolved":          [UserRole.Agent, UserRole.Admin],
  "Waiting_on_Requester:In_Progress": [UserRole.Agent, UserRole.Admin],
  "Waiting_on_Requester:Resolved":    [UserRole.Agent, UserRole.Admin],
  "Resolved:Closed":               [UserRole.Requester, UserRole.Agent, UserRole.Admin],
  "Closed:Reopened":               [UserRole.Requester, UserRole.Admin],
  "Reopened:In_Progress":          [UserRole.Agent, UserRole.Admin],
  "Reopened:Waiting_on_Requester": [UserRole.Agent, UserRole.Admin],
};
```

## Auto-assignment of team on ticket creation

1. If request body has explicit teamId, use it.
2. If categoryId is provided, look up category.defaultTeamId (future column).
3. If no team can be determined, leave teamId as NULL.
4. Agents can assign tickets to themselves if ticket is in their team.

## Revision history

| Date | Change | Author |
|------|--------|--------|
| 2026-10-05 | Initial workflow document | Phase 3 — Step 1 |