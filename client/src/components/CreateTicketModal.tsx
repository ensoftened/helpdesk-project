// Modal dialog for creating a new ticket. Shows a form with title, description,
// priority, category, and optional team selection (for agents/admins).

import { useState, FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";
import * as api from "../api/client";

interface Props { onClose: () => void; onCreated: () => void; }

export default function CreateTicketModal({ onClose, onCreated }: Props) {
  const { isAgent: _agent } = useAuth(); // Reserved for agent-only field
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.createTicket({ title, description, priorityId, categoryId });
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4">Create Ticket</h2>
        {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-3 text-sm">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2" required />
          </div>
          <div className="mb-3">
            <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded px-3 py-2 h-24" required />
          </div>
          <div className="flex gap-3 mb-4">
            <select value={priorityId} onChange={(e) => setPriorityId(e.target.value)}
              className="flex-1 border rounded px-3 py-2" required>
              <option value="">Priority</option>
              <option value="pr-low">Low</option>
              <option value="pr-med">Medium</option>
              <option value="pr-high">High</option>
              <option value="pr-urg">Urgent</option>
            </select>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="flex-1 border rounded px-3 py-2" required>
              <option value="">Category</option>
              <option value="cat-hw">Hardware</option>
              <option value="cat-sw">Software</option>
              <option value="cat-net">Network</option>
              <option value="cat-acct">Account</option>
              <option value="cat-other">Other</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {submitting ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}