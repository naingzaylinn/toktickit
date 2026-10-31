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
    reasonCodes?: unknown;
  };
}

export class ApiError extends Error {
  attachmentResult?: AttachmentUploadResult;
  code: string;
  correlationId?: string;
  status: number;
  fields: Record<string, string>;

  reasonCodes: ResolutionReason[];

  constructor(code: string, message: string, status: number, correlationId?: string, fields: Record<string, string> = {}, reasonCodes: ResolutionReason[] = []) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.correlationId = correlationId;
    this.fields = fields;
    this.reasonCodes = reasonCodes;
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

// Request owners invalidate this context on supersession, access loss and unmount.
// Check it after parsing the error body, immediately before the global side effect.
export interface ApiReadContext {
  signal?: AbortSignal;
  isCurrent: () => boolean;
}

async function readApiError(
  res: Response,
  fallbackMessage: string,
  authenticationEndpoint = false,
  context?: ApiReadContext
): Promise<ApiError> {
  let errorData: ApiErrorEnvelope | null = null;

  try {
    errorData = await res.json();
  } catch {
    // Use safe fallback below.
  }

  if (!authenticationEndpoint && !context?.signal?.aborted && (context?.isCurrent() ?? true) && (res.status === 401 || errorData?.error?.code === "PASSWORD_CHANGE_REQUIRED")) {
    window.dispatchEvent(new CustomEvent("session-access-changed", {detail: errorData?.error?.code}));
  }
  return new ApiError(
    errorData?.error?.code ?? "INTERNAL_SERVER_ERROR",
    errorData?.error?.message ?? fallbackMessage,
    res.status,
    errorData?.error?.correlationId,
    // Map only documented string field errors used by the forms.
    authenticationEndpoint && res.status === 400 && errorData?.error?.code === "VALIDATION_ERROR"
      ? Object.fromEntries(Object.entries(errorData.error.fields ?? {}).filter(([key, value]) =>
          ["email", "password", "currentPassword", "newPassword", "confirmPassword"].includes(key) && typeof value === "string")) as Record<string, string>
      : Object.fromEntries(Object.entries(errorData?.error?.fields ?? {}).filter(([key, value]) =>
          ["actionDescription", "actionResult", "followUpRequired", "followUpNote", "attachmentNotes", "assigneeId"].includes(key) && typeof value === "string")) as Record<string, string>,
    Array.isArray(errorData?.error?.reasonCodes) ? errorData.error.reasonCodes.filter((code): code is ResolutionReason =>
        typeof code === "string" && ["NO_COMPLETED_ACTIONS", "PENDING_ACTIONS", "FOLLOW_UP_REQUIRED"].includes(code)) : []
  );
}

export async function getTicketCategories(
  context?: ApiReadContext
): Promise<TicketReferenceCategory[]> {
  const res = await fetch(`${API_URL}/api/v1/categories`, {
    ...(context ? { signal: context.signal } : {}),
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw await readApiError(
      res,
      "Unable to load ticket categories.", false, context
    );
  }

  const json: CategoriesResponse = await res.json();
  return json.data ?? [];
}

export async function getRelatedSystems(
  context?: ApiReadContext
): Promise<RelatedSystem[]> {
  const res = await fetch(`${API_URL}/api/v1/related-systems`, {
    ...(context ? { signal: context.signal } : {}),
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw await readApiError(
      res,
      "Unable to load related systems.", false, context
    );
  }

  const json: RelatedSystemsResponse = await res.json();
  return json.data ?? [];
}

export async function createTicket(
  input: CreateTicketInput,
  context?: ApiReadContext
): Promise<CreatedTicket> {
  const res = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    ...(context ? { signal: context.signal } : {}),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw await readApiError(
      res,
      "Unable to create ticket.", false, context
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
  currentStatus?: RequesterTicketStatus;
  statusGroup?: "active";
  sortBy?: TicketSort;
  page?: number;
  pageSize?: 10 | 20 | 50;
}

export interface TicketListItem {
  id: string;
  ticketNumber: string;
  ticketDate: string;
  currentStatus: RequesterTicketStatus;
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

  if (query.statusGroup) params.set("statusGroup", query.statusGroup);
  return params.toString();
}

export async function getMyTickets(
  query: MyTicketsQuery = {},
  context?: ApiReadContext
): Promise<MyTicketsResponse> {
  const queryString = buildMyTicketsQuery(query);

  const res = await fetch(
    `${API_URL}/api/tickets?${queryString}`,
    {
      ...(context ? { signal: context.signal } : {}),
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    throw await readApiError(
      res,
      "Unable to load tickets.", false, context
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
  currentStatus: RequesterTicketStatus;
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
  ticketId: string,
  context?: ApiReadContext
): Promise<TicketDetail> {
  const res = await fetch(
    `${API_URL}/api/tickets/${encodeURIComponent(ticketId)}`,
    {
      ...(context ? { signal: context.signal } : {}),
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    throw await readApiError(
      res,
      "Failed to load ticket details.", false, context
    );
  }

  const body = await res.json();
  return body.data as TicketDetail;
}

export async function uploadTicketAttachments(
  ticketId: string,
  files: File[],
  context?: ApiReadContext
): Promise<AttachmentUploadResult> {
  const formData = new FormData();

  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetch(
    `${API_URL}/api/tickets/${encodeURIComponent(ticketId)}/attachments`,
    {
      method: "POST",
      ...(context ? { signal: context.signal } : {}),
      headers: {
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const body = await res.clone().json().catch(() => null);
    const error = await readApiError(
      res,
      "Unable to upload attachments.", false, context
    );
    if (Array.isArray(body?.data?.accepted) && Array.isArray(body?.data?.rejected)) error.attachmentResult = body.data;
    throw error;
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
  inline = false,
  context?: ApiReadContext
): Promise<Blob> {
  const res = await fetch(
    getAttachmentContentUrl(
      ticketId,
      attachmentId,
      inline
    ),
    {
      ...(context ? { signal: context.signal } : {}),
      headers: {
      },
    }
  );

  if (!res.ok) {
    throw await readApiError(
      res,
      "Unable to load attachment.", false, context
    );
  }

  return res.blob();
}

export async function removeTicketAttachment(
  ticketId: string,
  attachmentId: string,
  reason: string,
  context?: ApiReadContext
): Promise<TicketAttachment> {
  const res = await fetch(
    `${API_URL}/api/tickets/` +
    `${encodeURIComponent(ticketId)}/attachments/` +
    `${encodeURIComponent(attachmentId)}`,
    {
      method: "DELETE",
      ...(context ? { signal: context.signal } : {}),
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
      "Unable to remove attachment.", false, context
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
export async function sessionRequest<T>(path: string, body?: unknown, context?: ApiReadContext): Promise<T> {
  const res = await fetch(path, { ...(context ? { signal: context.signal } : {}), method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!res.ok) throw await readApiError(res, "Unable to complete the request.", path.startsWith("/api/auth/"), context);
  return (await res.json()).data;
}
export const getCurrentUser = () => sessionRequest<AuthUser>("/api/auth/me");
export const login = (email: string, password: string) => sessionRequest<{user: AuthUser}>("/api/auth/login", {email,password});
export const logout = () => sessionRequest("/api/auth/logout", {});
export const changePassword = (currentPassword: string, newPassword: string, confirmPassword: string) => sessionRequest("/api/auth/change-password", {currentPassword,newPassword,confirmPassword});
export type UserRole = AuthUser["role"];
export type ManagedUser = AuthUser;
export type UserDraft = Pick<ManagedUser, "name" | "email" | "role" | "isActive">;
async function adminRequest<T>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown, context?: ApiReadContext): Promise<T> {
  const res = await fetch(path, { ...(context ? { signal: context.signal } : {}), method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!res.ok) throw await readApiError(res, "Unable to manage users.", false, context);
  return (await res.json()).data;
}
export const getManagedUsers = (search = "", role = "", context?: ApiReadContext) => adminRequest<ManagedUser[]>("/api/admin/users?" + new URLSearchParams({ search, ...(role ? { role } : {}) }), "GET", undefined, context);
export const createManagedUser = (input: UserDraft & { initialPassword: string }) => adminRequest<ManagedUser>("/api/admin/users", "POST", input);
export const updateManagedUser = (id: string, input: UserDraft) => adminRequest<ManagedUser>("/api/admin/users/" + encodeURIComponent(id), "PATCH", input);
export const setManagedInitialPassword = (id: string, initialPassword: string) => adminRequest<ManagedUser>("/api/admin/users/" + encodeURIComponent(id) + "/initial-password", "POST", { initialPassword });
export interface PublicComment { id: string; ticketId: string; content: string; author: {id: string; name: string; role: string}; createdAt: string; }
export const getComments = (id: string, context?: ApiReadContext) => sessionRequest<PublicComment[]>("/api/tickets/"+encodeURIComponent(id)+"/comments", undefined, context);
export const postComment = (id: string, content: string, context?: ApiReadContext) => sessionRequest<PublicComment>("/api/tickets/"+encodeURIComponent(id)+"/comments", {content}, context);
export const indicateResolved = (id: string, context?: ApiReadContext) => sessionRequest<{ticketId:string; problemAppearsResolvedAt:string}>("/api/tickets/"+encodeURIComponent(id)+"/problem-appears-resolved", {}, context);

export type ResolutionReason = "NO_COMPLETED_ACTIONS" | "PENDING_ACTIONS" | "FOLLOW_UP_REQUIRED";
export interface StaffTicketDetail extends StaffTicketQueueItem {
  workflowVersion: number;
  actionsTakenSummary: { totalItems: number; pendingItems: number; completedItems: number; cancelledItems: number; followUpRequiredItems: number };
  resolutionEligibility: { eligible: boolean; reasonCodes: ResolutionReason[] };
  description: string;
  ticketDate: string;
  relatedSystem: { id: string; name: string };
  problemAppearsResolvedAt: string | null;
  attachments: { id: string; originalFilename: string; mimeType: string; sizeBytes: number; createdAt: string }[];
  publicComments: PublicComment[];
  internalNotes: PublicComment[];
}
export interface EligibleOwner { id: string; name: string; role: "IT_STAFF" | "ADMINISTRATOR" }
async function staffRequest<T>(path: string, method: "GET" | "PATCH" | "POST" = "GET", body?: unknown, context?: ApiReadContext): Promise<T> {
  const res = await fetch(path, { ...(context ? { signal: context.signal } : {}), method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!res.ok) throw await readApiError(res, "Unable to complete the request.", false, context);
  return (await res.json()).data;
}
export const getStaffTicket = (id: string, context?: ApiReadContext) => staffRequest<StaffTicketDetail>("/api/staff/tickets/" + encodeURIComponent(id), "GET", undefined, context);
export const getEligibleOwners = (context?: ApiReadContext) => staffRequest<EligibleOwner[]>("/api/staff/tickets/owners", "GET", undefined, context);

export type ActionStatus = "PENDING" | "COMPLETED" | "CANCELLED";
export interface ActionContent {
  actionDescription: string;
  actionResult: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
}
export interface ActionTaken extends ActionContent {
  id: string; ticketId: string; actionDateTime: string;
  performedBy: { id: string; name: string; role: string };
  assignee: { id: string; name: string; role: string; isActive: boolean };
  status: ActionStatus; version: number; createdAt: string; updatedAt: string;
}
export interface ActionHistory {
  data: ActionTaken[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
export interface ActionMutation { data: ActionTaken; meta: { workflowVersion: number }; replay: boolean }
export type CreateActionInput = ActionContent & { assigneeId: string; clientRequestId: string };
export type UpdateActionInput = Partial<ActionContent> & { expectedVersion: number; assigneeId?: string; status?: ActionStatus };
const actionPath = (ticketId: string, staff: boolean) => `/api/${staff ? "staff/" : ""}tickets/${encodeURIComponent(ticketId)}/actions`;
export async function getActions(ticketId: string, staff: boolean, query: { page?: number; pageSize?: 10 | 20 | 50; focusActionId?: string } = {}, context?: ApiReadContext): Promise<ActionHistory> {
  const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
  const res = await fetch(`${actionPath(ticketId, staff)}?${params}`, { ...(context ? { signal: context.signal } : {}), headers: { Accept: "application/json" } });
  if (!res.ok) throw await readApiError(res, "Unable to load Actions Taken.", false, context);
  return res.json();
}
async function mutateAction(path: string, method: "POST" | "PATCH", input: CreateActionInput | UpdateActionInput): Promise<ActionMutation> {
  const res = await fetch(path, { method, headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!res.ok) throw await readApiError(res, "Unable to save Action.");
  return { ...await res.json(), replay: res.headers.get("Idempotent-Replay") === "true" };
}
export const createAction = (ticketId: string, input: CreateActionInput) => mutateAction(actionPath(ticketId, true), "POST", input);
export const updateAction = (ticketId: string, actionId: string, input: UpdateActionInput) => mutateAction(`${actionPath(ticketId, true)}/${encodeURIComponent(actionId)}`, "PATCH", input);
export const updateStaffOwner = (id: string, ownerId: string | null) => staffRequest<{ owner: StaffTicketDetail["owner"] }>("/api/staff/tickets/" + encodeURIComponent(id) + "/owner", "PATCH", { ownerId });
export const updateStaffPriority = (id: string, itPriority: StaffTicketPriority) => staffRequest<{ itPriority: StaffTicketPriority }>("/api/staff/tickets/" + encodeURIComponent(id) + "/priority", "PATCH", { itPriority });
export const updateStaffStatus = (id: string, status: StaffTicketStatus, expectedWorkflowVersion: number) => staffRequest<{ status: StaffTicketStatus; workflowVersion: number }>("/api/staff/tickets/" + encodeURIComponent(id) + "/status", "PATCH", { status, expectedWorkflowVersion });
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
  statusGroup?: "active";
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
  query: StaffTicketQueueQuery = {},
  context?: ApiReadContext
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
  if (query.statusGroup) params.set("statusGroup", query.statusGroup);

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
      ...(context ? { signal: context.signal } : {}),
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    throw await readApiError(
      res,
      "Unable to load the staff ticket queue.", false, context
    );
  }

  return res.json();
}

export interface StaffDashboardResponse {
  data: {
    totalTickets: number; activeTickets: number; unassignedActiveTickets: number; myActiveTickets: number;
    byStatus: Record<StaffTicketStatus, number>;
    activeByItPriority: Record<StaffTicketPriority, number>;
    recentTickets: Array<{ id: string; ticketNumber: string; summary: string; status: StaffTicketStatus;
      itPriority: StaffTicketPriority; owner: { id: string; name: string } | null; updatedAt: string }>;
    myActions: { totalItems: number; items: Array<{ id: string; ticketId: string; ticketNumber: string;
      actionDateTime: string; actionDescription: string; followUpRequired: boolean; status: ActionStatus;
      assignee: { id: string; name: string; role: AuthUser["role"]; isActive: boolean } }> };
  };
  meta: { generatedAt: string };
}

export async function getStaffDashboard(context?: ApiReadContext): Promise<StaffDashboardResponse> {
  const res = await fetch("/api/staff/dashboard", { ...(context ? { signal: context.signal } : {}), headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw await readApiError(res, "Unable to load the staff dashboard.", false, context);
  return res.json();
}

export type DashboardTicketStatus = StaffTicketStatus;
export type RequesterTicketStatus = "New" | "Open" | "InProgress" | "WaitingForRequester" | "Resolved" | "Closed" | "Reopened" | "Cancelled";
export const requesterStatusFromDashboard: Record<DashboardTicketStatus, RequesterTicketStatus> = {
  NEW: "New", OPEN: "Open", IN_PROGRESS: "InProgress", WAITING_FOR_REQUESTER: "WaitingForRequester",
  RESOLVED: "Resolved", CLOSED: "Closed", REOPENED: "Reopened", CANCELLED: "Cancelled",
};
export interface RequesterDashboardTicket {
  id: string; ticketNumber: string; summary: string; status: DashboardTicketStatus; updatedAt: string;
}
export interface RequesterDashboardResponse {
  data: { totalTickets: number; activeTickets: number; waitingForRequesterTickets: number; resolvedTickets: number;
    byStatus: Record<DashboardTicketStatus, number>; recentTickets: RequesterDashboardTicket[]; resolvedTicketsRecent: RequesterDashboardTicket[] };
  meta: { generatedAt: string };
}
export async function getRequesterDashboard(context?: ApiReadContext): Promise<RequesterDashboardResponse> {
  const res = await fetch("/api/requester/dashboard", { ...(context ? { signal: context.signal } : {}), headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw await readApiError(res, "Unable to load your dashboard.", false, context);
  return res.json();
}
