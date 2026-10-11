// TicketCard: a summary card shown in the ticket list.
// Shows title, status badge, priority, requester, and SLA overdue indicator.

import type { Ticket } from "../types";

// Helper: human-readable status label.
const statusLabel: Record<string, string> = {
  Open: "Open", In_Progress: "In Progress", Waiting_on_Requester: "Waiting",
  Resolved: "Resolved", Closed: "Closed", Reopened: "Reopened",
};

const statusColor: Record<string, string> = {
  Open: "bg-blue-100 text-blue-800", In_Progress: "bg-yellow-100 text-yellow-800",
  Waiting_on_Requester: "bg-purple-100 text-purple-800",
  Resolved: "bg-green-100 text-green-800", Closed: "bg-gray-100 text-gray-800",
  Reopened: "bg-red-100 text-red-800",
};

const priorityColor: Record<string, string> = {
  Low: "text-gray-500", Medium: "text-blue-600",
  High: "text-orange-600", Urgent: "text-red-600 font-semibold",
};

export default function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <div className="border rounded p-4 bg-white hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4">
      {/* Left side: title and description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 truncate">{ticket.title}</h3>
          {ticket.isOverdue && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">OVERDUE</span>
          )}
        </div>
        <p className="text-sm text-gray-500 truncate">{ticket.description}</p>
        <div className="text-xs text-gray-400 mt-1">
          By {ticket.requester.name} • {new Date(ticket.createdAt).toLocaleDateString()}
        </div>
      </div>

      {/* Right side: badges */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-xs px-2 py-1 rounded-full ${statusColor[ticket.status] || "bg-gray-100"}`}>
          {statusLabel[ticket.status] || ticket.status}
        </span>
        <span className={`text-xs ${priorityColor[ticket.priority.name] || ""}`}>
          {ticket.priority.name}
        </span>
        {ticket.assignee && (
          <span className="text-xs text-gray-500">👤 {ticket.assignee.name}</span>
        )}
      </div>
    </div>
  );
}