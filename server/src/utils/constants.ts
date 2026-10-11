// This file holds constants (fixed values) used across the application.
// Having them in one place means: change once, update everywhere.
// Think of it like a reference chart on the wall — anyone who needs to know
// "is this allowed?" looks here instead of guessing or having their own copy.
// NEW CONCEPT: "Record<string, UserRole[]>" means a dictionary where each
// key (like "Open:In_Progress") maps to an array of UserRole values.

import { UserRole } from "@prisma/client";

// ALLOWED_TRANSITIONS is a map of every valid status change.
// The key format is "currentStatus:newStatus" — easy to look up.
// The value is the list of roles that can perform this transition.
// If a key is missing here, the transition is rejected by default.
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

// Helper function: checks if a transition is allowed for a given role.
// Returns true if the role can do it, false otherwise.
// If the key doesn't exist, it's automatically not allowed.
export function isTransitionAllowed(
  currentStatus: string,      // e.g. "Open"
  newStatus: string,          // e.g. "In_Progress"
  role: UserRole              // e.g. UserRole.Agent
): boolean {
  // Build the lookup key by joining the two statuses with a colon
  const key = `${currentStatus}:${newStatus}`;
  // Look it up in the map; if missing, allowedRoles is undefined
  const allowedRoles = ALLOWED_TRANSITIONS[key];
  // If allowedRoles exists, check if the user's role is in the list
  return allowedRoles ? allowedRoles.includes(role) : false;
}