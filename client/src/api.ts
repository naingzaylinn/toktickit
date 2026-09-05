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