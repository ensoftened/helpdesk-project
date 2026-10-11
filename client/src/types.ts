// TypeScript types that match the backend API response shapes.
// Every API response is wrapped in { data: ... } and errors in { error: { code, message } }.

export interface User {
  id: string;
  name: string;
  email: string;
  role: "Requester" | "Agent" | "Admin";
  teamId?: string | null;
  team?: { id: string; name: string } | null;
}

export interface Priority {
  id: string;
  name: string;
  level: number;
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface Team {
  id: string;
  name: string;
}

// Represents a single ticket as returned by the API (includes isOverdue).
export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priorityId: string;
  categoryId: string;
  requesterId: string;
  assigneeId?: string | null;
  teamId?: string | null;
  dueAt?: string | null;
  isOverdue?: boolean;
  createdAt: string;
  updatedAt: string;
  priority: Priority;
  category: Category;
  requester: { id: string; name: string; email: string };
  assignee?: { id: string; name: string; email: string } | null;
  team?: Team | null;
  comments?: Comment[];
  auditLogs?: AuditLog[];
}

export type TicketStatus =
  | "Open"
  | "In_Progress"
  | "Waiting_on_Requester"
  | "Reopened"
  | "Resolved"
  | "Closed";

export interface Comment {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  ticketId: string;
  userId: string;
  user: { id: string; name: string; role: string };
}

export interface AuditLog {
  id: string;
  ticketId: string;
  field: string;
  oldValue?: string | null;
  newValue: string;
  createdAt: string;
  changedByUser: { id: string; name: string };
}

export interface AttachmentMeta {
  id: string;
  ticketId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TicketListResponse {
  data: Ticket[];
  pagination: Pagination;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}