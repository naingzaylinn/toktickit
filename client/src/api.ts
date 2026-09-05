const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const REQUESTER_STORAGE_KEY = "toktickit_requester_id";

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

// Lab 2 Feature-A Types
export interface DevelopmentRequester {
  id: string;
  name: string;
  email: string;
}

export interface DevelopmentRequestersResponse {
  data: DevelopmentRequester[];
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
  };
}

export class ApiError extends Error {
  code: string;
  correlationId?: string;
  status: number;

  constructor(code: string, message: string, status: number, correlationId?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.correlationId = correlationId;
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

// Lab 2 Feature-A — Get active development requesters
export async function getDevelopmentRequesters(): Promise<DevelopmentRequester[]> {
  const res = await fetch(`${API_URL}/api/v1/development-requesters`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    let errorData: ApiErrorEnvelope | null = null;
    try {
      errorData = await res.json();
    } catch {
      // Ignored
    }
    const code = errorData?.error?.code ?? "INTERNAL_SERVER_ERROR";
    const message = errorData?.error?.message ?? "Unable to load development requesters.";
    throw new ApiError(code, message, res.status, errorData?.error?.correlationId);
  }

  const json: DevelopmentRequestersResponse = await res.json();
  return json.data || [];
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
  fallbackMessage: string
): Promise<ApiError> {
  let errorData: ApiErrorEnvelope | null = null;

  try {
    errorData = await res.json();
  } catch {
    // Use safe fallback below.
  }

  return new ApiError(
    errorData?.error?.code ?? "INTERNAL_SERVER_ERROR",
    errorData?.error?.message ?? fallbackMessage,
    res.status,
    errorData?.error?.correlationId
  );
}

export async function getTicketCategories(
  requesterId: string
): Promise<TicketReferenceCategory[]> {
  const res = await fetch(`${API_URL}/api/v1/categories`, {
    headers: {
      Accept: "application/json",
      "X-Development-Requester-Id": requesterId,
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
  requesterId: string
): Promise<RelatedSystem[]> {
  const res = await fetch(`${API_URL}/api/v1/related-systems`, {
    headers: {
      Accept: "application/json",
      "X-Development-Requester-Id": requesterId,
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
  requesterId: string,
  input: CreateTicketInput
): Promise<CreatedTicket> {
  const res = await fetch(`${API_URL}/api/v1/tickets`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Development-Requester-Id": requesterId,
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
  requesterId: string,
  query: MyTicketsQuery = {}
): Promise<MyTicketsResponse> {
  const queryString = buildMyTicketsQuery(query);

  const res = await fetch(
    `${API_URL}/api/v1/tickets?${queryString}`,
    {
      headers: {
        Accept: "application/json",
        "X-Development-Requester-Id": requesterId,
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
  requesterId: string,
  ticketId: string
): Promise<TicketDetail> {
  const res = await fetch(
    `${API_URL}/api/v1/tickets/${encodeURIComponent(ticketId)}`,
    {
      headers: {
        Accept: "application/json",
        "X-Development-Requester-Id": requesterId,
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
  requesterId: string,
  ticketId: string,
  files: File[]
): Promise<AttachmentUploadResult> {
  const formData = new FormData();

  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetch(
    `${API_URL}/api/v1/tickets/${encodeURIComponent(ticketId)}/attachments`,
    {
      method: "POST",
      headers: {
        "X-Development-Requester-Id": requesterId,
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
    `${API_URL}/api/v1/tickets/` +
    `${encodeURIComponent(ticketId)}/attachments/` +
    `${encodeURIComponent(attachmentId)}/download` +
    `?inline=${inline ? "true" : "false"}`
  );
}

export async function getAttachmentContent(
  requesterId: string,
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
        "X-Development-Requester-Id": requesterId,
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
  requesterId: string,
  ticketId: string,
  attachmentId: string,
  reason: string
): Promise<TicketAttachment> {
  const res = await fetch(
    `${API_URL}/api/v1/tickets/` +
    `${encodeURIComponent(ticketId)}/attachments/` +
    `${encodeURIComponent(attachmentId)}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Development-Requester-Id": requesterId,
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