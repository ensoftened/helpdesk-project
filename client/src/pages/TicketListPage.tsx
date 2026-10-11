// Ticket list page: the main dashboard showing all tickets the user can see.
// Supports filtering by status/priority/category, text search, pagination,
// and sorting. Each ticket card links to the detail page.

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import * as api from "../api/client";
import type { Ticket, Pagination } from "../types";
import TicketCard from "../components/TicketCard";
import CreateTicketModal from "../components/CreateTicketModal";

export default function TicketListPage() {
  const { user: _user } = useAuth();
  // Data state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  // Create ticket modal
  const [showCreate, setShowCreate] = useState(false);

  // Fetch tickets whenever filters/page change.
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listTickets({
        search: search || undefined,
        status: statusFilter || undefined,
        priorityId: priorityFilter || undefined,
        sortBy,
        sortOrder,
        page,
        limit: 20,
      });
      setTickets(res.data);
      setPagination(res.pagination);
    } catch {
      // Silently failed; error handling is in the interceptor.
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, sortBy, sortOrder, page]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tickets</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + New Ticket
        </button>
      </div>

      {/* Search & Filters bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 flex-1 min-w-[200px]"
        />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2">
          <option value="">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In_Progress">In Progress</option>
          <option value="Waiting_on_Requester">Waiting</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
          <option value="Reopened">Reopened</option>
        </select>
        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2">
          <option value="">All Priorities</option>
          <option value="pr-low">Low</option>
          <option value="pr-med">Medium</option>
          <option value="pr-high">High</option>
          <option value="pr-urg">Urgent</option>
        </select>
        <select value={`${sortBy}-${sortOrder}`} onChange={(e) => {
          const [s, o] = e.target.value.split("-");
          setSortBy(s); setSortOrder(o as "asc" | "desc"); setPage(1);
        }} className="border rounded px-3 py-2">
          <option value="createdAt-desc">Newest First</option>
          <option value="createdAt-asc">Oldest First</option>
          <option value="title-asc">Title A-Z</option>
          <option value="title-desc">Title Z-A</option>
        </select>
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No tickets found.</div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link key={ticket.id} to={`/tickets/${ticket.id}`}>
              <TicketCard ticket={ticket} />
            </Link>
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            className="px-3 py-1 border rounded disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}

      {/* Create ticket modal */}
      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchTickets(); }}
        />
      )}
    </div>
  );
}