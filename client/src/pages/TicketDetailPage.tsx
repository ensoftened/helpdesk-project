// Ticket detail page: description, status, comments, attachments, and audit log.

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import * as api from "../api/client";
import type { Ticket, Comment, AttachmentMeta } from "../types";

const statusOptions = ["Open", "In_Progress", "Waiting_on_Requester", "Resolved", "Closed", "Reopened"];

export default function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { user: _user, isAgent } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const loadTicket = useCallback(async () => {
    if (!ticketId) return; setLoading(true);
    try {
      const res = await api.getTicket(ticketId);
      setTicket(res.data); setComments(res.data.comments || []);
      setNewStatus(res.data.status); setNewPriority(res.data.priorityId);
      setNewCategory(res.data.categoryId);
      const attRes = await api.listAttachments(ticketId);
      setAttachments(attRes.data);
    } catch { navigate("/tickets"); }
    finally { setLoading(false); }
  }, [ticketId, navigate]);
  useEffect(() => { loadTicket(); }, [loadTicket]);

  const handleTransition = async () => {
    if (!ticketId || !ticket) return;
    try {
      const res = await api.transitionStatus(ticketId, {
        status: newStatus,
        priorityId: newPriority !== ticket.priorityId ? newPriority : undefined,
        categoryId: newCategory !== ticket.categoryId ? newCategory : undefined,
      });
      setTicket(res.data);
    } catch (err: any) { alert(err.response?.data?.error?.message || "Transition failed"); }
  };
  const handleAddComment = async () => {
    if (!ticketId || !commentBody.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await api.addComment(ticketId, { body: commentBody, isInternal });
      setComments([...comments, res.data]); setCommentBody("");
    } catch (err: any) { alert(err.response?.data?.error?.message || "Could not add comment"); }
    finally { setSubmittingComment(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !ticketId) return;
    try {
      await api.uploadAttachment(ticketId, file);
      const attRes = await api.listAttachments(ticketId);
      setAttachments(attRes.data);
    } catch (err: any) { alert(err.response?.data?.error?.message || "Upload failed"); }
  };

  if (loading) return <div className="max-w-4xl mx-auto p-4 text-center">Loading...</div>;
  if (!ticket) return null;
  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate("/tickets")} className="text-blue-600 hover:underline text-sm">&larr; Back</button>
        <h1 className="text-2xl font-bold flex-1">{ticket.title}</h1>
        {ticket.isOverdue && <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">OVERDUE</span>}
      </div>
      <div className="flex flex-wrap gap-3 mb-4 text-sm">
        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{ticket.status.replace(/_/g, " ")}</span>
        <span className="text-gray-600">Priority: {ticket.priority.name}</span>
        <span className="text-gray-600">Category: {ticket.category.name}</span>
        <span className="text-gray-600">By: {ticket.requester.name}</span>
        {ticket.assignee && <span className="text-gray-600">Assigned: {ticket.assignee.name}</span>}
        {ticket.team && <span className="text-gray-600">Team: {ticket.team.name}</span>}
        {ticket.dueAt && <span className="text-gray-500">Due: {new Date(ticket.dueAt).toLocaleString()}</span>}
      </div>
      <div className="bg-white border rounded p-4 mb-6">
        <h2 className="font-semibold mb-2">Description</h2>
        <p className="whitespace-pre-wrap text-gray-700">{ticket.description}</p>
      </div>
      {isAgent && (
        <div className="bg-gray-50 border rounded p-4 mb-6">
          <h2 className="font-semibold mb-3">Update Ticket</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="border rounded px-2 py-1 text-sm">
                {statusOptions.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Priority</label>
              <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} className="border rounded px-2 py-1 text-sm">
                <option value="pr-low">Low</option><option value="pr-med">Medium</option>
                <option value="pr-high">High</option><option value="pr-urg">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="border rounded px-2 py-1 text-sm">
                <option value="cat-hw">Hardware</option><option value="cat-sw">Software</option>
                <option value="cat-net">Network</option><option value="cat-acct">Account</option>
                <option value="cat-other">Other</option>
              </select>
            </div>
            <button onClick={handleTransition} className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700">Update</button>
          </div>
        </div>
      )}
      <div className="mb-6">
        <h2 className="font-semibold mb-3">Comments ({comments.length})</h2>
        {comments.length === 0 ? <p className="text-gray-500 text-sm">No comments yet.</p> : (
          <div className="space-y-3 mb-4">
            {comments.map((c) => (
              <div key={c.id} className={`border rounded p-3 ${c.isInternal ? "bg-yellow-50 border-yellow-200" : "bg-white"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{c.user.name}</span>
                  <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString()}</span>
                  {c.isInternal && <span className="text-xs bg-yellow-300 px-1 rounded">Internal</span>}
                </div>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>
        )}
        <div className="border rounded p-3 bg-white">
          <textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Add a comment..." className="w-full border rounded px-3 py-2 text-sm h-20 mb-2" />
          <div className="flex items-center gap-3">
            {isAgent && <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} /> Internal note</label>}
            <button onClick={handleAddComment} disabled={submittingComment || !commentBody.trim()}
              className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {submittingComment ? "Posting..." : "Comment"}
            </button>
          </div>
        </div>
      </div>
      <div className="mb-6">
        <h2 className="font-semibold mb-3">Attachments ({attachments.length})</h2>
        <div className="mb-3"><input type="file" onChange={handleFileUpload} className="text-sm" /></div>
        {attachments.length > 0 && (
          <div className="space-y-2">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 border rounded p-2 text-sm">
                <span className="font-medium">{a.fileName}</span>
                <span className="text-gray-400">({(a.sizeBytes / 1024).toFixed(1)} KB)</span>
                <a href={api.attachmentDownloadUrl(ticketId!, a.id)} className="text-blue-600 hover:underline ml-auto" download>Download</a>
              </div>
            ))}
          </div>
        )}
      </div>
      {ticket.auditLogs && ticket.auditLogs.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3">History</h2>
          <div className="space-y-1 text-sm text-gray-600">
            {ticket.auditLogs.map((log) => (
              <div key={log.id} className="flex gap-3">
                <span className="text-gray-400 w-32">{new Date(log.createdAt).toLocaleString()}</span>
                <span><strong>{log.changedByUser.name}</strong> changed {log.field}: {log.oldValue ? `${log.oldValue} -> ` : ""}{log.newValue}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
