// Lab 3 sessions require one application origin, including existing local .env setups.
const API_URL = "";

// Lab 1 Types
export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export interface HealthResponse {
  status: string;
  service: string;
}

// Safe requester identity, supplied by the authenticated server session.
export interface RequesterIdentity {
  id: string;
  name: string;
  email: string;
}

export interface ApiErrorDetails {
  field: string;
  message: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    correlationId?: string;
    details?: ApiErrorDetails[];
    fields?: Record<string, unknown>;
  };
}

export class ApiError extends Error {
  code: string;
  correlationId?: string;
  status: number;
  fields: Record<string, string>;

  constructor(code: string, message: string, status: number, correlationId?: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.correlationId = correlationId;
    this.fields = fields;
  }
}

// Issue 2 — check backend API health (Lab 1)
export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  return res.json();
}

// Issue 4 — call the backend for system status and categories (Lab 1)
export async function checkSystem(): Promise<SystemStatus> {
  await checkHealth();
  const res = await fetch(`${API_URL}/api/categories`);
  if (!res.ok) {
    throw new Error(`Categories fetch failed with status ${res.status}`);
  }
  const categories: Category[] = await res.json();
  return { online: true, categories };
}

// ---------------------------------------------------------------------------
// Lab 2 Feature-D — Create Ticket
// ---------------------------------------------------------------------------

export interface TicketReferenceCategory {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: string;
  name: string;
}

export type RequestedPriority = "Low" | "Medium" | "High" | "Urgent";

export interface CreateTicketInput {
  categoryId: number;
  relatedSystemId: string;
  requestedPriority?: RequestedPriority;
  summary: string;
  description: string;
  clientRequestId: string;
}

export interface CreatedTicket {
  id: string;
  ticketNumber: string;
  ticketDate: string;
  currentStatus: "New";
  requestedPriority: RequestedPriority;
  summary: string;
  description: string;
  requesterId: string;
  categoryId: number;
  relatedSystemId: string;
}

interface CategoriesResponse {
  data: TicketReferenceCategory[];
}

interface RelatedSystemsResponse {
  data: RelatedSystem[];
}

interface CreateTicketResponse {
  data: CreatedTicket;
}

async function readApiError(
  res: Response,
  fallbackMessage: string,
  authenticationEndpoint = false
): Promise<ApiError> {
  let errorData: ApiErrorEnvelope | null = null;

  try {
    errorData = await res.json();
  } catch {
    // Use safe fallback below.
  }

  if (!authenticationEndpoint && (res.status === 401 || errorData?.error?.code === "PASSWORD_CHANGE_REQUIRED")) {
    window.dispatchEvent(new CustomEvent("session-access-changed", {detail: errorData?.error?.code}));
  }
  return new ApiError(
    errorData?.error?.code ?? "INTERNAL_SERVER_ERROR",
    errorData?.error?.message ?? fallbackMessage,
    res.status,
    errorData?.error?.correlationId,
    // Only the documented auth validation fields are needed by these forms.
    authenticationEndpoint && res.status === 400 && errorData?.error?.code === "VALIDATION_ERROR"
      ? Object.fromEntries(Object.entries(errorData.error.fields ?? {}).filter(([key, value]) =>
          ["email", "password", "currentPassword", "newPassword", "confirmPassword"].includes(key) && typeof value === "string")) as Record<string, string>
      : {}
  );
}

export async function getTicketCategories(
): Promise<TicketReferenceCategory[]> {
  const res = await fetch(`${API_URL}/api/v1/categories`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw await readApiError(
      res,
      "Unable to load ticket categories."
    );
  }

  const json: CategoriesResponse = await res.json();
  return json.data ?? [];
}

export async function getRelatedSystems(
): Promise<RelatedSystem[]> {
  const res = await fetch(`${API_URL}/api/v1/related-systems`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw await readApiError(
      res,
      "Unable to load related systems."
    );
  }

  const json: RelatedSystemsResponse = await res.json();
  return json.data ?? [];
}

export async function createTicket(
  input: CreateTicketInput
): Promise<CreatedTicket> {
  const res = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw await readApiError(
      res,
      "Unable to create ticket."
    );
  }

  const json: CreateTicketResponse = await res.json();
  return json.data;
}

// ---------------------------------------------------------------------------
// Lab 2 Feature-E — My Tickets
// ---------------------------------------------------------------------------

export type TicketSort =
  | "newest"
  | "oldest"
  | "recentlyUpdated"
  | "ticketNumberAsc";

export interface MyTicketsQuery {
  q?: string;
  categoryId?: number;
  relatedSystemId?: string;
  requestedPriority?: RequestedPriority;
  currentStatus?: "New";
  sortBy?: TicketSort;
  page?: number;
  pageSize?: 10 | 20 | 50;
}

export interface TicketListItem {
  id: string;
  ticketNumber: string;
  ticketDate: string;
  currentStatus: "New";
  requestedPriority: RequestedPriority;
  summary: string;
  category: {
    id: number;
    name: string;
  };
  relatedSystem: {
    id: string;
    name: string;
  };
  activeAttachmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TicketPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface MyTicketsResponse {
  data: TicketListItem[];
  pagination: TicketPagination;
}

export function buildMyTicketsQuery(
  query: MyTicketsQuery = {}
): string {
  const params = new URLSearchParams();

  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 10));
  params.set("sortBy", query.sortBy ?? "newest");

  const trimmedSearch = query.q?.trim();
  if (trimmedSearch) {
    params.set("q", trimmedSearch);
  }

  if (query.categoryId !== undefined) {
    params.set("categoryId", String(query.categoryId));
  }

  if (query.relatedSystemId) {
    params.set("relatedSystemId", query.relatedSystemId);
  }

  if (query.requestedPriority) {
    params.set("requestedPriority", query.requestedPriority);
  }

  if (query.currentStatus) {
    params.set("currentStatus", query.currentStatus);
  }

  return params.toString();
}

export async function getMyTickets(
  query: MyTicketsQuery = {}
): Promise<MyTicketsResponse> {
  const queryString = buildMyTicketsQuery(query);

  const res = await fetch(
    `${API_URL}/api/tickets?${queryString}`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    throw await readApiError(
      res,
      "Unable to load tickets."
    );
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Feature-G — Attachments
// ---------------------------------------------------------------------------

export interface TicketAttachment {
  id: string;
  ticketId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  isRemoved: boolean;
  removedAt: string | null;
  removalReason: string | null;
  removedByRequesterId: string | null;
}

export interface AttachmentUploadRejected {
  filename: string;
  reason: string;
}

export interface AttachmentUploadResult {
  accepted: TicketAttachment[];
  rejected: AttachmentUploadRejected[];
  activeAttachmentCount: number;
}

// ---------------------------------------------------------------------------
// Feature-F — Requester Ticket Detail
// ---------------------------------------------------------------------------

export interface TicketDetail {
  problemAppearsResolvedAt?: string | null;
  id: string;
  ticketNumber: string;
  ticketDate: string;
  currentStatus: "New";
  requestedPriority: RequestedPriority;
  summary: string;
  description: string;

  requester: {
    id: string;
    name: string;
    email: string;
  };

  category: {
    id: number;
    name: string;
    isActive: boolean;
  };

  relatedSystem: {
    id: string;
    name: string;
    isActive: boolean;
  };

  activeAttachments: TicketAttachment[];
  removedAttachments: TicketAttachment[];

  createdAt: string;
  updatedAt: string;
}

export async function getTicketDetail(
  ticketId: string
): Promise<TicketDetail> {
  const res = await fetch(
    `${API_URL}/api/tickets/${encodeURIComponent(ticketId)}`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    throw await readApiError(
      res,
      "Failed to load ticket details."
    );
  }

  const body = await res.json();
  return body.data as TicketDetail;
}

export async function uploadTicketAttachments(
  ticketId: string,
  files: File[]
): Promise<AttachmentUploadResult> {
  const formData = new FormData();

  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetch(
    `${API_URL}/api/tickets/${encodeURIComponent(ticketId)}/attachments`,
    {
      method: "POST",
      headers: {
      },
      body: formData,
    }
  );

  if (!res.ok) {
    throw await readApiError(
      res,
      "Unable to upload attachments."
    );
  }

  const body = await res.json();
  return body.data as AttachmentUploadResult;
}

export function getAttachmentContentUrl(
  ticketId: string,
  attachmentId: string,
  inline = false
): string {
  return (
    `${API_URL}/api/tickets/` +
    `${encodeURIComponent(ticketId)}/attachments/` +
    `${encodeURIComponent(attachmentId)}/download` +
    `?inline=${inline ? "true" : "false"}`
  );
}

export async function getAttachmentContent(
  ticketId: string,
  attachmentId: string,
  inline = false
): Promise<Blob> {
  const res = await fetch(
    getAttachmentContentUrl(
      ticketId,
      attachmentId,
      inline
    ),
    {
      headers: {
      },
    }
  );

  if (!res.ok) {
    throw await readApiError(
      res,
      "Unable to load attachment."
    );
  }

  return res.blob();
}

export async function removeTicketAttachment(
  ticketId: string,
  attachmentId: string,
  reason: string
): Promise<TicketAttachment> {
  const res = await fetch(
    `${API_URL}/api/tickets/` +
    `${encodeURIComponent(ticketId)}/attachments/` +
    `${encodeURIComponent(attachmentId)}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason,
      }),
    }
  );

  if (!res.ok) {
    throw await readApiError(
      res,
      "Unable to remove attachment."
    );
  }

  const body = await res.json();
  return body.data as TicketAttachment;
}

export interface AuthUser extends RequesterIdentity {
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  isActive: boolean;
  mustChangePassword: boolean;
}
export async function sessionRequest<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!res.ok) throw await readApiError(res, "Unable to complete the request.", path.startsWith("/api/auth/"));
  return (await res.json()).data;
}
export const getCurrentUser = () => sessionRequest<AuthUser>("/api/auth/me");
export const login = (email: string, password: string) => sessionRequest<{user: AuthUser}>("/api/auth/login", {email,password});
export const logout = () => sessionRequest("/api/auth/logout", {});
export const changePassword = (currentPassword: string, newPassword: string, confirmPassword: string) => sessionRequest("/api/auth/change-password", {currentPassword,newPassword,confirmPassword});
export type UserRole = AuthUser["role"];
export type ManagedUser = AuthUser;
export type UserDraft = Pick<ManagedUser, "name" | "email" | "role" | "isActive">;
async function adminRequest<T>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown): Promise<T> {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!res.ok) throw await readApiError(res, "Unable to manage users.");
  return (await res.json()).data;
}
export const getManagedUsers = (search = "", role = "") => adminRequest<ManagedUser[]>("/api/admin/users?" + new URLSearchParams({ search, ...(role ? { role } : {}) }));
export const createManagedUser = (input: UserDraft & { initialPassword: string }) => adminRequest<ManagedUser>("/api/admin/users", "POST", input);
export const updateManagedUser = (id: string, input: UserDraft) => adminRequest<ManagedUser>("/api/admin/users/" + encodeURIComponent(id), "PATCH", input);
export const setManagedInitialPassword = (id: string, initialPassword: string) => adminRequest<ManagedUser>("/api/admin/users/" + encodeURIComponent(id) + "/initial-password", "POST", { initialPassword });
export interface PublicComment { id: string; ticketId: string; content: string; author: {id: string; name: string; role: string}; createdAt: string; }
export const getComments = (id: string) => sessionRequest<PublicComment[]>("/api/tickets/"+encodeURIComponent(id)+"/comments");
export const postComment = (id: string, content: string) => sessionRequest<PublicComment>("/api/tickets/"+encodeURIComponent(id)+"/comments", {content});
export const indicateResolved = (id: string) => sessionRequest<{ticketId:string; problemAppearsResolvedAt:string}>("/api/tickets/"+encodeURIComponent(id)+"/problem-appears-resolved", {});

export interface StaffTicketDetail extends StaffTicketQueueItem {
  description: string;
  ticketDate: string;
  relatedSystem: { id: string; name: string };
  problemAppearsResolvedAt: string | null;
  attachments: { id: string; originalFilename: string; mimeType: string; sizeBytes: number; createdAt: string }[];
  publicComments: PublicComment[];
  internalNotes: PublicComment[];
}
export interface EligibleOwner { id: string; name: string; role: "IT_STAFF" | "ADMINISTRATOR" }
async function staffRequest<T>(path: string, method: "GET" | "PATCH" | "POST" = "GET", body?: unknown): Promise<T> {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!res.ok) throw await readApiError(res, "Unable to complete the request.");
  return (await res.json()).data;
}
export const getStaffTicket = (id: string) => staffRequest<StaffTicketDetail>("/api/staff/tickets/" + encodeURIComponent(id));
export const getEligibleOwners = () => staffRequest<EligibleOwner[]>("/api/staff/tickets/owners");
export const updateStaffOwner = (id: string, ownerId: string | null) => staffRequest<{ owner: StaffTicketDetail["owner"] }>("/api/staff/tickets/" + encodeURIComponent(id) + "/owner", "PATCH", { ownerId });
export const updateStaffPriority = (id: string, itPriority: StaffTicketPriority) => staffRequest<{ itPriority: StaffTicketPriority }>("/api/staff/tickets/" + encodeURIComponent(id) + "/priority", "PATCH", { itPriority });
export const updateStaffStatus = (id: string, status: StaffTicketStatus) => staffRequest<{ status: StaffTicketStatus }>("/api/staff/tickets/" + encodeURIComponent(id) + "/status", "PATCH", { status });
export const postInternalNote = (id: string, content: string) => staffRequest<PublicComment>("/api/staff/tickets/" + encodeURIComponent(id) + "/notes", "POST", { content });


// ---------------------------------------------------------------------------
// Lab 3 — Staff Ticket Queue
// ---------------------------------------------------------------------------

export type StaffTicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

export type StaffTicketPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "URGENT";

export type StaffTicketSort =
  | "ticketNumber"
  | "createdAt"
  | "updatedAt"
  | "status"
  | "requestedPriority"
  | "itPriority";

export type StaffTicketOrder = "asc" | "desc";

export interface StaffTicketQueueItem {
  id: string;
  ticketNumber: string;
  summary: string;

  category: {
    id: number;
    name: string;
  };

  requester: {
    id: string;
    name: string;
    email: string;
  };

  requestedPriority: StaffTicketPriority;
  itPriority: StaffTicketPriority;
  status: StaffTicketStatus;

  owner: {
    id: string;
    name: string;
    email: string;
  } | null;

  createdAt: string;
  updatedAt: string;
}

export interface StaffTicketQueueMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface StaffTicketQueueResponse {
  data: StaffTicketQueueItem[];
  meta: StaffTicketQueueMeta;
}

export interface StaffTicketQueueQuery {
  search?: string;
  status?: StaffTicketStatus;
  requestedPriority?: StaffTicketPriority;
  itPriority?: StaffTicketPriority;
  owner?: "assigned" | "unassigned" | string;
  sort?: StaffTicketSort;
  order?: StaffTicketOrder;
  page?: number;
  pageSize?: 10 | 20 | 50;
}

export async function getStaffTickets(
  query: StaffTicketQueueQuery = {}
): Promise<StaffTicketQueueResponse> {
  const params = new URLSearchParams();

  if (query.search) {
    params.set("search", query.search);
  }

  if (query.status) {
    params.set("status", query.status);
  }

  if (query.requestedPriority) {
    params.set("requestedPriority", query.requestedPriority);
  }

  if (query.itPriority) {
    params.set("itPriority", query.itPriority);
  }

  if (query.owner) {
    params.set("owner", query.owner);
  }

  if (query.sort) {
    params.set("sort", query.sort);
  }

  if (query.order) {
    params.set("order", query.order);
  }

  if (query.page !== undefined) {
    params.set("page", String(query.page));
  }

  if (query.pageSize !== undefined) {
    params.set("pageSize", String(query.pageSize));
  }

  const queryString = params.toString();

  const res = await fetch(
    `/api/staff/tickets${queryString ? `?${queryString}` : ""}`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    throw await readApiError(
      res,
      "Unable to load the staff ticket queue."
    );
  }

  return res.json();
}
