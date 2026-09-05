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
