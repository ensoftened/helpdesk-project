// API client: centralized HTTP layer for all API calls.
//
// NEW CONCEPT: Axios interceptors — functions that run before every request or response.
// We auto-attach the JWT token and handle 401 errors by refreshing.

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const client = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

let accessToken: string | null = null;
let refreshToken: string | null = localStorage.getItem("refreshToken");

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem("refreshToken", refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem("refreshToken");
}

export function getAccessToken(): string | null { return accessToken; }

// Request interceptor: attaches JWT to every request.
client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken && config.headers) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Response interceptor: on 401, try refreshing the token once.
client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !originalRequest._retry && refreshToken) {
      originalRequest._retry = true;
      try {
        const { data } = await axios.post("/api/auth/refresh", { refreshToken });
        setTokens(data.data.accessToken, data.data.refreshToken);
        if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return client(originalRequest);
      } catch {
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);
export default client;

// ─── API FUNCTIONS ──────────────────────────────────────────────────
// Auth
export async function login(email: string, password: string) {
  const { data } = await client.post("/auth/login", { email, password });
  return data;
}
export async function register(name: string, email: string, password: string) {
  const { data } = await client.post("/auth/register", { name, email, password });
  return data;
}
export async function getMe() {
  const { data } = await client.get("/auth/me");
  return data;
}
export async function logout() {
  await client.post("/auth/logout", { refreshToken });
}

// Tickets
export async function createTicket(body: {
  title: string; description: string; priorityId: string; categoryId: string; teamId?: string;
}) {
  const { data } = await client.post("/tickets", body);
  return data;
}
export async function listTickets(params?: Record<string, string | number | undefined>) {
  const clean: Record<string, string> = {};
  if (params) for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") clean[k] = String(v);
  const { data } = await client.get("/tickets", { params: clean });
  return data;
}
export async function getTicket(ticketId: string) {
  const { data } = await client.get(`/tickets/${ticketId}`);
  return data;
}
export async function transitionStatus(ticketId: string, body: { status: string; priorityId?: string; categoryId?: string; teamId?: string }) {
  const { data } = await client.patch(`/tickets/${ticketId}/status`, body);
  return data;
}
export async function assignTicket(ticketId: string, assigneeId: string) {
  const { data } = await client.patch(`/tickets/${ticketId}/assign`, { assigneeId });
  return data;
}
export async function addComment(ticketId: string, body: { body: string; isInternal: boolean }) {
  const { data } = await client.post(`/tickets/${ticketId}/comments`, body);
  return data;
}

// Attachments
export async function uploadAttachment(ticketId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", file.name);
  formData.append("mimeType", file.type || "application/octet-stream");
  const { data } = await axios.post(`/api/tickets/${ticketId}/attachments`, formData, {
    headers: { Authorization: accessToken ? `Bearer ${accessToken}` : "" },
  });
  return data;
}
export async function listAttachments(ticketId: string) {
  const { data } = await client.get(`/tickets/${ticketId}/attachments`);
  return data;
}
export function attachmentDownloadUrl(ticketId: string, attachmentId: string): string {
  return `/api/tickets/${ticketId}/attachments/${attachmentId}?token=${encodeURIComponent(accessToken || "")}`;
}

// Admin
export async function listUsers() {
  const { data } = await client.get("/admin/users");
  return data;
}
export async function updateUserRole(userId: string, role: string) {
  const { data } = await client.patch(`/admin/users/${userId}/role`, { role });
  return data;
}