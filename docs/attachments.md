# Attachments — Helpdesk/Ticketing System

## What this document is

This document explains how file attachments work in the helpdesk system: how they're stored,
who can upload/list/download them, the API endpoints, and the technical decisions behind
the implementation.

**Simple analogy:** Attachments are like sticky notes you attach to a paper form. You
can add photos, PDFs, or text files to a ticket so the person working on it has all the
context they need.

---

## How attachments work (high-level)

1. **Frontend:** The user picks a file in the browser using a standard `<input type="file">`.
   The file is sent to the server as `multipart/form-data` using `FormData`.

2. **Multer (middleware):** On the server, a library called Multer intercepts the request
   before the controller. It extracts the binary file bytes from the multipart request
   and puts them into `req.file.buffer` (a byte array in memory, not written to disk).

3. **Service layer:** The `attachment.service.ts` checks:
   - Is the file under 10 MB?
   - Does the ticket exist?
   - Does the user have permission to upload to this ticket?
   If all checks pass, it inserts a row into the `Attachment` table. The file bytes
   are stored directly in the `data` column as a BLOB (Binary Large OBject).

4. **Listing:** When listing attachments, only metadata is returned (id, fileName,
   mimeType, sizeBytes, createdAt). The actual file bytes are never sent in a list
   response — that would be wasteful. The user clicks "Download" to get the bytes.

5. **Downloading:** The download endpoint loads the attachment row (including the `data`
   column), sets `Content-Disposition: attachment` and `Content-Type` headers, and
   sends the raw bytes. The browser then triggers a file save dialog.

---

## Data model

The `Attachment` table lives in `server/prisma/schema.prisma`:

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | UUID | Yes | Unique identifier for each attachment |
| `ticketId` | UUID | Yes | Foreign key — which ticket this file belongs to |
| `userId` | UUID | Yes | Foreign key — who uploaded this file |
| `fileName` | VARCHAR | Yes | Original filename from the client (e.g. `screenshot.png`) |
| `mimeType` | VARCHAR | Yes | MIME type like `image/png` or `application/pdf` |
| `sizeBytes` | Int | Yes | File size in bytes |
| `data` | Bytes (BLOB) | Yes | The actual file content stored as binary |
| `createdAt` | DateTime | Yes | When the file was uploaded |

**Relationships:**
- `Attachment.ticketId` → `Ticket.id` (one ticket can have many attachments)
- `Attachment.userId` → `User.id` (one user can upload many attachments)

**Index:**
- `@@index([ticketId])` — fast lookup when listing all attachments for a ticket
---

## API endpoints

All three endpoints are mounted under `/api/tickets/:ticketId/attachments` and require
authentication (the `authenticate` middleware runs at the ticket router level).

---

### 1. Upload — `POST /api/tickets/:ticketId/attachments`

Uploads a file and attaches it to the specified ticket.

**Middleware pipeline:**
```
authenticate → requireTicketAccess → multer (parse file) → controller
```

**Request format:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | binary | Yes | The file content. Must be under 10 MB. |
| `fileName` | string | Yes | Original filename. Max 255 chars, only safe characters (a-z, 0-9, `.`, `-`, `_`, spaces, parentheses). |
| `mimeType` | string | Yes | MIME type. Max 100 chars, only alphanumeric and `.`, `-`, `+`, `/`. |

**Example (JavaScript/FormData):**
```js
const formData = new FormData();
formData.append("file", file);
formData.append("fileName", file.name);
formData.append("mimeType", file.type || "application/octet-stream");
await axios.post(`/api/tickets/${ticketId}/attachments`, formData);
```

**Success response (201):**
```json
{
  "data": {
    "id": "a1b2c3d4-...",
    "ticketId": "e5f6g7h8-...",
    "userId": "i9j0k1l2-...",
    "fileName": "screenshot.png",
    "mimeType": "image/png",
    "sizeBytes": 245760,
    "createdAt": "2026-10-06T12:00:00.000Z"
  }
}
```

### 2. List — `GET /api/tickets/:ticketId/attachments`

Returns metadata for all attachments on a ticket. Does NOT return file bytes.

**Middleware pipeline:**
```
authenticate → requireTicketAccess → controller
```

**Success response (200):**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "ticketId": "e5f6g7h8-...",
      "userId": "i9j0k1l2-...",
      "fileName": "screenshot.png",
      "mimeType": "image/png",
      "sizeBytes": 245760,
      "createdAt": "2026-10-06T12:00:00.000Z"
    },
    {
      "id": "m3n4o5p6-...",
      "ticketId": "e5f6g7h8-...",
      "userId": "q7r8s9t0-...",
      "fileName": "error.log",
      "mimeType": "text/plain",
      "sizeBytes": 1240,
      "createdAt": "2026-10-06T13:00:00.000Z"
    }
  ]
}
```

Note: The list is ordered by `createdAt` descending (newest first). The `data` column
(BLOB) is never included in the list response.

---

### 3. Download — `GET /api/tickets/:ticketId/attachments/:attachmentId`

Downloads the actual file bytes for a single attachment.

---

## Permissions matrix

Permission checks happen in the service layer (`attachment.service.ts`), not just the
middleware. Even if `requireTicketAccess` passes, the service re-checks for safety.

**Upload permissions:**

| Role | Own ticket | Team ticket (same team) | Any ticket |
|------|:----------:|:-----------------------:|:----------:|
| Requester | ✅ | ❌ | ❌ |
| Agent | ✅ | ✅ | ❌ |
| Admin | ✅ | ✅ | ✅ |

**List permissions:**

| Role | Own ticket | Team ticket (same team) | Any ticket |
|------|:----------:|:-----------------------:|:----------:|
| Requester | ✅ | ❌ | ❌ |
| Agent | ✅ | ✅ | ❌ |
| Admin | ✅ | ✅ | ✅ |

**Download permissions:**

| Role | Own ticket | Team ticket (same team) | Any ticket |
|------|:----------:|:-----------------------:|:----------:|
| Requester | ✅ | ❌ | ❌ |
| Agent | ✅ | ✅ | ❌ |
| Admin | ✅ | ✅ | ✅ |

**Rule summary:**
---

## Validation rules

Enforced in two layers — Multer (route level) and service (business logic):

| Rule | Where enforced | Limit |
|------|---------------|-------|
| Max file size | Multer (`limits.fileSize`) | 10 MB (10,485,760 bytes) |
| Max file size | Service (`uploadAttachment`) | 10 MB (double-check) |
| Filename length | Zod schema | 1–255 characters |
| Filename characters | Zod schema regex | `a-z`, `A-Z`, `0-9`, `.`, `-`, `_`, spaces, parentheses |
| MIME type length | Zod schema | 1–100 characters |
| MIME type format | Zod schema regex | Alphanumeric, `.`, `-`, `+`, `/` |

---

## Technical decisions

### Why BLOB storage instead of filesystem?

**Decision:** Store files directly in the database as BLOBs.

**Pros:**
- Zero filesystem dependency — the database is the single source of truth
- Backups capture everything (files + data in one dump)
- No need to sync file paths across environments or deal with directory permissions
- Docker-friendly: no volume mounts needed for uploaded files

**Cons:**
- Database can grow large with many big attachments
- Slower than filesystem for very large files
- Won't scale to huge files (but we cap at 10 MB)

**Why it fits this project:** This is a portfolio/demo project. Self-contained simplicity
beats production-grade scalability. For a real system with thousands of users and large
files, you'd use S3 or a dedicated file storage service.

### Why Multer memory storage?

**Decision:** Use `multer.memoryStorage()` (RAM) instead of `multer.diskStorage()` (disk).

**Reason:** Since files go straight into the database as BLOBs, there's no reason to
write them to disk first. The file bytes stay in RAM as a `Buffer`, then get stored
in the database in one step. This avoids temporary file cleanup and disk I/O.

### Why 10 MB limit?

- Keeps database BLOB sizes reasonable
- Keeps API response times fast
- Prevents abuse (someone uploading a 1 GB file to crash the server)
- 10 MB covers most practical attachments: screenshots, PDFs, short videos, logs

---

## Frontend integration

### API client (`client/src/api/client.ts`)

- `uploadAttachment(ticketId, file)` — Creates a `FormData` with the file and metadata,
  sends as `multipart/form-data` via axios.
- `listAttachments(ticketId)` — Returns metadata array for the attachment list UI.
- `attachmentDownloadUrl(ticketId, attachmentId)` — Builds the download URL with the
  access token as a query parameter (see Known Issues below).

### UI (`client/src/pages/TicketDetailPage.tsx`)

The ticket detail page has an "Attachments" section that shows:
1. A file picker (`<input type="file">`) for uploading
2. A list of existing attachments with filename, size (in KB), and a "Download" link
3. After upload, the list refreshes automatically

File download uses a simple `<a href="..." download>` link for downloads, which triggers
the browser's native save dialog.

---

## Known issues & future improvements

### 🔴 Token in URL for downloads (security concern)

**Current behavior:** The download URL includes the access token as a query parameter:
`/api/tickets/:ticketId/attachments/:attachmentId?token=eyJhbG...`

**Why it's a problem:**
- Tokens in URLs are logged in server access logs
- URLs appear in browser history
- URLs are sent in the `Referer` header when navigating away
- If the token is `null` (page refresh before re-auth), the download link is broken

**Why it was done this way:** The browser's `<a href>` download click is a simple
navigation — it doesn't go through axios so the interceptor can't add the
`Authorization` header. The token-in-URL was a workaround.

**Recommended fix:** Switch to a programmatic download using `fetch` or axios with the
`Authorization` header, then create a blob URL to trigger the download. This keeps
tokens out of URLs entirely.

### 🟡 No file type whitelist

**Current behavior:** Any file type can be uploaded, including executables (`.exe`,
`.sh`, `.bat`), which are common attack vectors.

**Recommended improvement:** Add an allowlist of safe MIME types (e.g., images, PDFs,
office documents, text files, archives). Reject anything else. At minimum, block
executable types.

### 🟡 No per-ticket attachment limit

**Current behavior:** There's no limit on how many attachments a ticket can have.

**Recommended improvement:** Add a configurable limit (e.g., 20 attachments per ticket)
to prevent database bloat and abuse.

### 🟡 No attachment-on-create support

**Current behavior:** Attachments can only be added after a ticket is created. The
`CreateTicketModal` has no file input.

**Recommended improvement:** Add a file upload field to the "Create Ticket" form so
users can attach files immediately (e.g., a screenshot of the error).

### 🟢 No duplicate detection

Files with the same name can be uploaded multiple times to the same ticket.
---

## How to test attachments

### Backend tests

```bash
cd server
npx jest tests/attachments.test.ts
```

The test file covers:
- Requester uploads to own ticket ✅
- Agent uploads to team ticket ✅
- Listing returns metadata only (no BLOB data leaked) ✅
- Download returns correct bytes (round-trip test) ✅
- Files over 10 MB are rejected ✅

### Manual testing

1. Start the backend (`npm run dev` in `/server`)
2. Start the frontend (`npm run dev` in `/client`)
3. Log in as `requester@helpdesk.com` / `password123`
4. Open any ticket from the list
5. Scroll to the "Attachments" section
6. Click the file picker, select a file (under 10 MB)
7. Verify the file appears in the list with name and size
8. Click "Download" to verify the file round-trips correctly

---

## Files involved

| Layer | File | Purpose |
|-------|------|---------|
| Schema | `server/prisma/schema.prisma` | Attachment model definition (lines 188–202) |
| Routes | `server/src/routes/ticket.routes.ts` | Wires the three attachment endpoints with multer |
| Controller | `server/src/controllers/attachment.controller.ts` | HTTP handlers: upload, list, download |
| Service | `server/src/services/attachment.service.ts` | Business logic: validation + DB queries |
| Validator | `server/src/validators/ticket.validator.ts` | Zod schema for fileName/mimeType (lines 43–54) |
| Error handling | `server/src/middleware/errorHandler.ts` | Catches Multer errors (lines 27–36) |
| Tests | `server/tests/attachments.test.ts` | Integration tests for all three operations |
| API client | `client/src/api/client.ts` | Frontend functions: uploadAttachment, listAttachments, attachmentDownloadUrl (lines 107–124) |
| Types | `client/src/types.ts` | AttachmentMeta interface (lines 82–90) |
| UI | `client/src/pages/TicketDetailPage.tsx` | Upload input + attachment list in the detail page |

---

## Revision history

| Date | Change | Author |
|------|--------|--------|
| 2026-10-06 | Initial attachment documentation | Phase — Attachments |