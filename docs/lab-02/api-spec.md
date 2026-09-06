# TokTickIT Lab 2 - REST API Specification

**Version:** 1.0  
**Status:** Approved Engineering Contract
**Sprint:** Lab 2 (Requester Ticketing MVP)  
**Product:** TokTickIT  
**Base Path:** `/api/v1`  
**Data Transport:** JSON (`application/json; charset=utf-8`) / Multipart (`multipart/form-data`) / Binary Streams  

---

## 1. Shared API Conventions

### 1.1 Base URL & Routing Architecture
All new TokTickIT Lab 2 API endpoints are rooted at the base path:
```http
/api/v1
```

Legacy endpoints from Lab 1 (e.g., `GET /api/health`, `GET /api/categories`) are preserved unchanged for backward compatibility and existing automated test suites, but all newly introduced Lab 2 requester features strictly target `/api/v1`.

### 1.2 Entity Primary Identifiers (UUID Standard)
In accordance with the approved TokTickIT System-Level SDS:
- Primary entity identifiers across the system are standard **RFC 4122 UUID v4 strings** (e.g., `3fa85f64-5717-4562-b3fc-2c963f66afa6`).
- This applies to **Tickets**, **Attachments**, **Categories**, and **Related Systems**.
- For the temporary Lab 2 **Development Requester** testing model, using UUID strings is proposed for uniform identifier consistency across all REST contracts and headers (see Section 11).
- Numerical auto-increment IDs are strictly internal persistence artifacts (if used by legacy seed scripts) and are **never** exposed as resource identifiers across the `/api/v1` REST boundary.

### 1.3 Content Negotiation & JSON Serialization
- **Request Payloads:** All JSON request bodies must include the header `Content-Type: application/json`.
- **Response Payloads:** All JSON responses are served with `Content-Type: application/json; charset=utf-8`.
- **Naming Convention:** All JSON keys in request bodies, query parameters, and response DTOs use **camelCase** (e.g., `ticketNumber`, `categoryId`, `sizeBytes`, `isRemoved`, `clientRequestId`).
- **Data Transfer Objects (DTOs):** All endpoints return explicit, decoupled DTO contracts. Direct Prisma database models, internal database column names, foreign keys that should remain private, storage keys, and raw ORM instances are strictly encapsulated and never exposed across the network boundary.

### 1.4 Date and Time Standards
- All timestamps stored and transmitted through the API use the **UTC timezone**.
- Timestamps in JSON DTOs are serialized as standard **ISO 8601** strings with UTC offset designators:
  ```json
  "2026-09-04T15:30:00.000Z"
  ```
- Presentation formatting and timezone localization (e.g., converting UTC to Asia/Bangkok `UTC+7`) are strictly the responsibility of the client UI presentation layer.

### 1.5 Safe Error Response Envelope
Every error response across the API conforms to a uniform, safe error envelope. The envelope guarantees that internal database errors, SQL queries, Prisma engine exceptions, stack traces, filesystem paths, and storage bucket credentials are never leaked to clients.

#### Standard Error Schema
```json
{
  "error": {
    "code": "STRING_ERROR_CODE",
    "message": "Human-readable explanation of the error",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
    "details": [
      {
        "field": "fieldName",
        "message": "Specific validation failure for this field"
      }
    ]
  }
}
```

- `code` (*string, required*): Machine-readable uppercase identifier for client error handling (e.g., `VALIDATION_ERROR`, `TICKET_NOT_FOUND`, `ACTIVE_ATTACHMENT_LIMIT_EXCEEDED`).
- `message` (*string, required*): Safe, human-readable summary of the failure.
- `correlationId` (*string, optional/recommended*): Server-generated UUID tracing identifier for log correlation.
- `details` (*array of objects, optional*): Present on validation failures (`400 Bad Request`) indicating field-specific errors.

### 1.6 Standard HTTP Status Codes
| HTTP Status | Name | Usage in TokTickIT |
|---|---|---|
| `200 OK` | Success | Successful GET requests, search/filter queries, metadata queries, file download streams, idempotent replay, and DELETE tombstone responses. |
| `201 Created` | Resource Created | Successful first-time POST creation for Tickets (`POST /api/v1/tickets`) and Attachments (`POST /api/v1/tickets/:ticketId/attachments`). |
| `400 Bad Request` | Client Input Error | Validation failures (missing required fields, string length violations, whitespace-only strings, invalid enum values, invalid query parameters, or missing/invalid requester headers). |
| `404 Not Found` | Not Found / Neutral Protected | Returned when a requested resource does not exist, or when a protected resource belongs to another Requester (preventing resource existence enumeration). |
| `409 Conflict` | State Conflict | Returned when an operation cannot be completed due to conflicting resource state (e.g., attempting to soft-remove an already removed attachment, or reusing `clientRequestId` with mismatched payload). |
| `413 Payload Too Large` | Entity Too Large | Uploaded attachment file exceeds the individual 5 MB size limit. |
| `415 Unsupported Media Type` | Unsupported Media | Uploaded attachment file MIME type or detected content signature is not among `image/jpeg`, `image/png`, `image/webp`, or `application/pdf`. |
| `500 Internal Server Error` | Server Error | Unhandled server or database exceptions, returning a safe error envelope without internal details. |

### 1.7 Authoritative Backend Validation Boundary
Client-side form validation (in the React/Bootstrap UI) is strictly for immediate user feedback. The backend API is the authoritative validation and security boundary:
- All string inputs are trimmed of leading/trailing whitespace before length checks.
- All UUIDs, enum values, and foreign keys are validated independently against PostgreSQL.
- Ownership rules are enforced on every request regardless of client-side state.

---

## 2. Development Requester Context & Simulated Identity

### 2.1 Context Purpose & Architectural Role
Lab 2 implements the Requester Ticketing MVP before full authentication and session management are introduced in Lab 3. To simulate multi-user requester behavior and allow comprehensive testing of ownership isolation, the API uses a **Development Requester Context**.

> [!IMPORTANT]
> The Development Requester context is strictly a temporary Lab 2 development and testing mechanism. It is **NOT** secure authentication. It does not use passwords, password hashes, auth tokens, session cookies, or JWTs.

### 2.2 Transport Mechanism: `X-Development-Requester-Id`
Protected API endpoints (Tickets and Attachments) require the client to supply the active requester context via the custom HTTP header containing the requester's UUID:
```http
X-Development-Requester-Id: 3fa85f64-5717-4562-b3fc-2c963f66afa6
```

### 2.3 Backend Validation Rules for Requester Context
1. **Presence Check:** If the `X-Development-Requester-Id` header is missing on a protected route, the server immediately returns `400 Bad Request` (`MISSING_REQUESTER_HEADER`).
2. **Format Check:** If the header value is not a valid UUID string, the server returns `400 Bad Request` (`INVALID_REQUESTER_ID`).
3. **Database Existence Check:** The server queries the `DevelopmentRequester` table. If no record matches the UUID, the server returns `400 Bad Request` (`REQUESTER_NOT_FOUND`).
4. **Active State Check:** If the requester record has `isActive === false`, the server returns `400 Bad Request` (`INACTIVE_REQUESTER`).

#### Inactive Requester Error Example (`400 Bad Request`)
```json
{
  "error": {
    "code": "INACTIVE_REQUESTER",
    "message": "The specified Development Requester is inactive and cannot perform requester actions.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

---

## 3. Complete Endpoint Inventory

| # | HTTP Method | Route Path | Protected | Feature | Summary |
|---|---|---|---|---|---|
| 1 | `GET` | `/api/v1/development-requesters` | No | Feature-A | List all active Development Requesters for testing selector |
| 2 | `GET` | `/api/v1/categories` | No | Feature-C | List all active Categories for new ticket creation/filtering |
| 3 | `GET` | `/api/v1/related-systems` | No | Feature-C | List all active Related Systems for new ticket creation/filtering |
| 4 | `POST` | `/api/v1/tickets` | Yes | Feature-D | Create a new Ticket owned by the current Requester (idempotent) |
| 5 | `GET` | `/api/v1/tickets` | Yes | Feature-E | Retrieve paginated, searchable, filterable My Tickets list |
| 6 | `GET` | `/api/v1/tickets/:ticketId` | Yes | Feature-F | Retrieve read-only Ticket Detail for an owned ticket |
| 7 | `POST` | `/api/v1/tickets/:ticketId/attachments` | Yes | Feature-G | Upload permitted attachments to an owned ticket |
| 8 | `GET` | `/api/v1/tickets/:ticketId/attachments/:attachmentId` | Yes | Feature-G | Retrieve attachment metadata (active or removed tombstone) |
| 9 | `GET` | `/api/v1/tickets/:ticketId/attachments/:attachmentId/download` | Yes | Feature-G | Stream active attachment binary for preview or download |
| 10 | `DELETE` | `/api/v1/tickets/:ticketId/attachments/:attachmentId` | Yes | Feature-G | Soft-remove attachment with required reason & delete binary |

---

## 4. Endpoint Specifications

---

### Endpoint 1: GET `/api/v1/development-requesters`

#### 1. Purpose
Retrieves the list of active Development Requesters for the frontend Development Requester Selection dropdown. Inactive requesters (e.g., `Evan Developer`) are filtered out on the backend.

#### 2. HTTP Request
- **Method:** `GET`
- **Path:** `/api/v1/development-requesters`
- **Headers:**
  - `Accept: application/json`
- **Path Parameters:** None
- **Query Parameters:** None
- **Request Body:** None

#### 3. Validation & Business Rules
- Queries the database for records where `isActive = true`.
- Results are predictably ordered by `name ASC` (with secondary sort `id ASC`).
- Empty state: If no active requesters exist, returns an empty array with `200 OK`.

#### 4. Success Response (`200 OK`)
- **Content-Type:** `application/json`
- **Response DTO:**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      "name": "Alice Developer",
      "email": "alice@kmutt.ac.th"
    },
    {
      "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
      "name": "Bob Developer",
      "email": "bob@kmutt.ac.th"
    },
    {
      "id": "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
      "name": "Charlie Developer",
      "email": "charlie@kmutt.ac.th"
    },
    {
      "id": "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a",
      "name": "Diana Developer",
      "email": "diana@kmutt.ac.th"
    }
  ]
}
```

#### 5. Error Responses
##### `500 Internal Server Error`
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to fetch development requesters.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

---

### Endpoint 2: GET `/api/v1/categories`

#### 1. Purpose
Retrieves active IT Request Categories available for new Ticket submission and filter dropdowns. Historical inactive categories are excluded from this endpoint.

#### 2. HTTP Request
- **Method:** `GET`
- **Path:** `/api/v1/categories`
- **Headers:**
  - `Accept: application/json`
- **Path Parameters:** None
- **Query Parameters:** None
- **Request Body:** None

#### 3. Validation & Business Rules
- Filters for `isActive = true`.
- Predictably ordered by `name ASC` (with secondary sort `id ASC`).
- No requester header required (public reference data).
- DTO boundary: Omits `isActive` since all items in this collection are active by definition.

#### 4. Success Response (`200 OK`)
- **Content-Type:** `application/json`
- **Response DTO:**
```json
{
  "data": [
    {
      "id": "8a9b0c1d-2e3f-4a5b-6c7d-8e9f0a1b2c3d",
      "name": "Account & Access"
    },
    {
      "id": "9b0c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e",
      "name": "General IT Inquiry"
    },
    {
      "id": "0c1d2e3f-4a5b-6c7d-8e9f-0a1b2c3d4e5f",
      "name": "Hardware"
    },
    {
      "id": "1d2e3f4a-5b6c-7d8e-9f0a-1b2c3d4e5f6a",
      "name": "Network & Connectivity"
    },
    {
      "id": "2e3f4a5b-6c7d-8e9f-0a1b-2c3d4e5f6a7b",
      "name": "Software"
    }
  ]
}
```

#### 5. Error Responses
##### `500 Internal Server Error`
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to fetch categories.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

---

### Endpoint 3: GET `/api/v1/related-systems`

#### 1. Purpose
Retrieves active university Related Systems available for new Ticket submission and filter dropdowns.

#### 2. HTTP Request
- **Method:** `GET`
- **Path:** `/api/v1/related-systems`
- **Headers:**
  - `Accept: application/json`
- **Path Parameters:** None
- **Query Parameters:** None
- **Request Body:** None

#### 3. Validation & Business Rules
- Filters for `isActive = true`.
- Predictably ordered by `name ASC` (with secondary sort `id ASC`).
- DTO boundary: Omits `isActive` since all items in this collection are active by definition.

#### 4. Success Response (`200 OK`)
- **Content-Type:** `application/json`
- **Response DTO:**
```json
{
  "data": [
    {
      "id": "3f4a5b6c-7d8e-9f0a-1b2c-3d4e5f6a7b8c",
      "name": "Campus Wi-Fi"
    },
    {
      "id": "4a5b6c7d-8e9f-0a1b-2c3d-4e5f6a7b8c9d",
      "name": "Email"
    },
    {
      "id": "5b6c7d8e-9f0a-1b2c-3d4e-5f6a7b8c9d0e",
      "name": "LEB2"
    },
    {
      "id": "6c7d8e9f-0a1b-2c3d-4e5f-6a7b8c9d0e1f",
      "name": "Printing Service"
    },
    {
      "id": "7d8e9f0a-1b2c-3d4e-5f6a-7b8c9d0e1f2a",
      "name": "Student Information System"
    },
    {
      "id": "8e9f0a1b-2c3d-4e5f-6a7b-8c9d0e1f2a3b",
      "name": "University Computer/Laptop"
    },
    {
      "id": "9f0a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
      "name": "VPN"
    }
  ]
}
```

#### 5. Error Responses
##### `500 Internal Server Error`
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to fetch related systems.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

---

### Endpoint 4: POST `/api/v1/tickets`

#### 1. Purpose
Creates a new IT support ticket owned exclusively by the requesting Development Requester. Generates the official Ticket Number and Ticket Date server-side, sets initial status to `New`, and enforces authoritative duplicate-submission protection.

#### 2. HTTP Request
- **Method:** `POST`
- **Path:** `/api/v1/tickets`
- **Headers:**
  - `Content-Type: application/json`
  - `X-Development-Requester-Id: <UUID>` (*required*)
- **Request Body DTO:**
```json
{
  "categoryId": "0c1d2e3f-4a5b-6c7d-8e9f-0a1b2c3d4e5f",
  "relatedSystemId": "9f0a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
  "requestedPriority": "Medium",
  "summary": "Cannot connect to campus VPN from off-campus network",
  "description": "Every time I attempt to authenticate via GlobalProtect, the client displays error 403. This started occurring yesterday morning after changing my password.",
  "clientRequestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
}
```

#### 3. Request Field Validation Rules
| Field | Type | Required | Rules & Constraints |
|---|---|---|---|
| `categoryId` | UUID String | Yes | Must reference an existing record in `Category` where `isActive = true`. Inactive or missing returns validation error. |
| `relatedSystemId` | UUID String | Yes | Must reference an existing record in `RelatedSystem` where `isActive = true`. Inactive or missing returns validation error. |
| `requestedPriority` | String | No | Must be one of: `"Low"`, `"Medium"`, `"High"`, `"Urgent"`. Defaults to `"Medium"` if omitted. |
| `summary` | String | Yes | Trimmed length must be between 5 and 120 characters inclusive. Whitespace-only is invalid. |
| `description` | String | Yes | Trimmed length must be between 10 and 2000 characters inclusive. Whitespace-only is invalid. |
| `clientRequestId` | UUID String | Yes | Client-generated UUID v4 used for authoritative duplicate-submission protection. |

#### 4. Backend-Generated Fields & Business Invariants
- **`id`:** Server-generated UUID v4 primary key.
- **`ticketNumber`:** Generated server-side using the approved format `TKT-YYYY-NNNNN` (e.g. `TKT-2026-00001`). Generated within a database transaction utilizing an annual sequence that resets to `00001` each new calendar year. Frontend cannot supply or override this.
- **`ticketDate`:** System-generated UTC timestamp recorded at transaction commit time.
- **`currentStatus`:** Always initialized to `"New"`.
- **`requesterId`:** Derived authoritatively from `X-Development-Requester-Id`.

#### 5. Single Deterministic Idempotency / Duplicate-Submission Contract
- **Transportation:** In JSON request body as `clientRequestId` (UUID v4 string).
- **Requirement:** Required field on `POST /api/v1/tickets`.
- **Requester Scope:** Scoped to the authenticated `X-Development-Requester-Id`.
- **First Submission:** Creates the ticket in a database transaction, records `clientRequestId`, and returns **`201 Created`** with the new Ticket DTO.
- **Exact Replay (Same `clientRequestId` and identical payload):** Returns **`200 OK`** with the existing Ticket DTO and response header `Idempotent-Replay: true`. No second ticket is created.
- **Payload Mismatch Conflict (Same `clientRequestId` reused with different payload data):** Returns **`409 Conflict`** (`IDEMPOTENCY_CONFLICT`).

#### 6. Success Response (`201 Created` on First Submission)
- **Content-Type:** `application/json`
- **Response DTO:**
```json
{
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "ticketNumber": "TKT-2026-00001",
    "ticketDate": "2026-09-04T15:30:00.000Z",
    "currentStatus": "New",
    "requestedPriority": "Medium",
    "summary": "Cannot connect to campus VPN from off-campus network",
    "description": "Every time I attempt to authenticate via GlobalProtect, the client displays error 403. This started occurring yesterday morning after changing my password.",
    "requester": {
      "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      "name": "Alice Developer",
      "email": "alice@kmutt.ac.th"
    },
    "category": {
      "id": "0c1d2e3f-4a5b-6c7d-8e9f-0a1b2c3d4e5f",
      "name": "Hardware"
    },
    "relatedSystem": {
      "id": "9f0a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
      "name": "VPN"
    },
    "activeAttachmentCount": 0,
    "attachments": [],
    "createdAt": "2026-09-04T15:30:00.000Z",
    "updatedAt": "2026-09-04T15:30:00.000Z"
  }
}
```

#### 7. Error Responses
##### `400 Bad Request` (Validation Failure)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid ticket data provided.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
    "details": [
      {
        "field": "summary",
        "message": "Ticket Summary must be between 5 and 120 characters."
      },
      {
        "field": "description",
        "message": "Description must be between 10 and 2000 characters."
      },
      {
        "field": "categoryId",
        "message": "The selected Category is inactive or does not exist."
      }
    ]
  }
}
```

##### `409 Conflict` (Idempotency Payload Mismatch)
```json
{
  "error": {
    "code": "IDEMPOTENCY_CONFLICT",
    "message": "The provided clientRequestId has already been used with different ticket creation parameters.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

##### `500 Internal Server Error`
```json
{
  "error": {
    "code": "TICKET_CREATION_FAILED",
    "message": "An unexpected error occurred while creating the ticket. Please try again.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

---

### Endpoint 5: GET `/api/v1/tickets` (My Tickets)

#### 1. Purpose
Retrieves a paginated list of tickets owned strictly by the requesting Development Requester, supporting combined search, multi-field filtering, fixed-vocabulary sorting with deterministic tie-breaking, and comprehensive pagination metadata.

#### 2. HTTP Request
- **Method:** `GET`
- **Path:** `/api/v1/tickets`
- **Headers:**
  - `Accept: application/json`
  - `X-Development-Requester-Id: <UUID>` (*required*)
- **Query Parameters:**
| Parameter | Type | Required | Default | Allowed Values / Format | Description |
|---|---|---|---|---|---|
| `q` | String | No | `""` | Any string (trimmed) | Case-insensitive search across `ticketNumber`, `summary`, and `description`. |
| `categoryId` | UUID String | No | `null` | Valid UUID | Filter by Category ID. |
| `relatedSystemId` | UUID String | No | `null` | Valid UUID | Filter by Related System ID. |
| `requestedPriority` | String | No | `null` | `"Low"`, `"Medium"`, `"High"`, `"Urgent"` | Filter by Requested Priority. |
| `currentStatus` | String | No | `null` | `"New"` (or approved statuses) | Filter by Current Status. |
| `sortBy` | String | No | `"newest"` | `"newest"`, `"oldest"`, `"recentlyUpdated"`, `"ticketNumberAsc"` | Sort order vocabulary. |
| `page` | Integer | No | `1` | Integer >= 1 | 1-indexed page number. |
| `pageSize` | Integer | No | `10` | `10`, `20`, `50` | Items per page. |

#### 3. Deterministic Sorting & Tie-Breaking Specification
To ensure strict reproducibility and avoid pagination jitter across database queries:
| `sortBy` Value | Primary Ordering Clause | Deterministic Secondary Tie-Break |
|---|---|---|
| `"newest"` (*default*) | `createdAt DESC` | `ticketNumber ASC` |
| `"oldest"` | `createdAt ASC` | `ticketNumber ASC` |
| `"recentlyUpdated"` | `updatedAt DESC` | `ticketNumber ASC` |
| `"ticketNumberAsc"` | `ticketNumber ASC` | `createdAt DESC` |

#### 4. Query Validation Rules
- `page` must be an integer >= 1. If invalid -> `400 Bad Request` (`INVALID_PAGE_NUMBER`).
- `pageSize` must be one of `10`, `20`, `50`. If invalid -> `400 Bad Request` (`INVALID_PAGE_SIZE`).
- `sortBy` must be in allowed vocabulary. Arbitrary SQL identifiers are rejected -> `400 Bad Request` (`INVALID_SORT_PARAMETER`).
- `requestedPriority` must be valid enum value if supplied -> `400 Bad Request` (`INVALID_PRIORITY_FILTER`).

#### 5. Ownership Isolation Invariant
The query is unconditionally scoped by `WHERE requesterId = :requesterId`. A requester cannot view, search, or filter tickets owned by other requesters under any combination of query parameters.

#### 6. Success Response (`200 OK`)
- **Content-Type:** `application/json`
- **Response DTO:**
```json
{
  "data": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "ticketNumber": "TKT-2026-00001",
      "ticketDate": "2026-09-04T15:30:00.000Z",
      "currentStatus": "New",
      "requestedPriority": "Medium",
      "summary": "Cannot connect to campus VPN from off-campus network",
      "category": {
        "id": "0c1d2e3f-4a5b-6c7d-8e9f-0a1b2c3d4e5f",
        "name": "Hardware"
      },
      "relatedSystem": {
        "id": "9f0a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
        "name": "VPN"
      },
      "activeAttachmentCount": 1,
      "createdAt": "2026-09-04T15:30:00.000Z",
      "updatedAt": "2026-09-04T15:35:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

#### 7. Empty Results Semantics (`200 OK`)
When no tickets match (true empty or no search results), the API returns:
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

#### 8. Error Responses
##### `400 Bad Request` (Invalid Pagination Parameter)
```json
{
  "error": {
    "code": "INVALID_PAGE_SIZE",
    "message": "Invalid pageSize parameter. Supported values are 10, 20, and 50.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

##### `500 Internal Server Error`
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to retrieve tickets.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

---

### Endpoint 6: GET `/api/v1/tickets/:ticketId` (Ticket Detail)

#### 1. Purpose
Retrieves full read-only detail of a specific ticket owned by the requesting Development Requester, including its active attachments and reference metadata.

#### 2. HTTP Request
- **Method:** `GET`
- **Path:** `/api/v1/tickets/:ticketId`
- **Headers:**
  - `Accept: application/json`
  - `X-Development-Requester-Id: <UUID>` (*required*)
- **Path Parameters:**
  - `ticketId` (*UUID string, required*): The primary key UUID of the ticket.

#### 3. Validation & Ownership Rules
- `ticketId` must be a valid UUID. If not -> `400 Bad Request` (`INVALID_TICKET_ID`).
- **Neutral Protected-Resource Rule:**
  - If the ticket does not exist in the database, OR
  - If the ticket belongs to a different Development Requester (`ticket.requesterId !== requesterId`):
  - The server **MUST** return an identical `404 Not Found` response with message `"Ticket not found."`.
  - It **MUST NOT** return `403 Forbidden` or disclose whether the ticket exists for another requester.

#### 4. Historical Inactive Reference Data Behavior
If the Category or Related System referenced by this ticket was marked `isActive = false` after ticket creation, this endpoint returns `isActive: false` on the embedded reference object so the UI can accurately display historical reference state.

#### 5. Success Response (`200 OK`)
- **Content-Type:** `application/json`
- **Response DTO:**
```json
{
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "ticketNumber": "TKT-2026-00001",
    "ticketDate": "2026-09-04T15:30:00.000Z",
    "currentStatus": "New",
    "requestedPriority": "Medium",
    "summary": "Cannot connect to campus VPN from off-campus network",
    "description": "Every time I attempt to authenticate via GlobalProtect, the client displays error 403. This started occurring yesterday morning after changing my password.",
    "requester": {
      "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      "name": "Alice Developer",
      "email": "alice@kmutt.ac.th"
    },
    "category": {
      "id": "0c1d2e3f-4a5b-6c7d-8e9f-0a1b2c3d4e5f",
      "name": "Hardware",
      "isActive": true
    },
    "relatedSystem": {
      "id": "9f0a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
      "name": "VPN",
      "isActive": true
    },
    "activeAttachmentCount": 1,
    "attachments": [
      {
        "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "originalFilename": "vpn_error_screenshot.png",
        "mimeType": "image/png",
        "sizeBytes": 1048576,
        "createdAt": "2026-09-04T15:32:00.000Z",
        "isRemoved": false
      }
    ],
    "createdAt": "2026-09-04T15:30:00.000Z",
    "updatedAt": "2026-09-04T15:32:00.000Z"
  }
}
```

#### 6. Error Responses
##### `404 Not Found` (Neutral Missing or Cross-Requester Response)
```json
{
  "error": {
    "code": "TICKET_NOT_FOUND",
    "message": "Ticket not found.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

##### `400 Bad Request` (Invalid UUID Path Parameter)
```json
{
  "error": {
    "code": "INVALID_TICKET_ID",
    "message": "Ticket ID must be a valid UUID.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

##### `500 Internal Server Error`
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to retrieve ticket details.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

---

### Endpoint 7: POST `/api/v1/tickets/:ticketId/attachments`

#### 1. Purpose
Uploads one or more permitted attachments to an existing requester-owned ticket. Validates file types and content signatures, enforces the 5 MB per-file limit, caps active attachments at five, and supports partial acceptance for mixed selections.

#### 2. HTTP Request
- **Method:** `POST`
- **Path:** `/api/v1/tickets/:ticketId/attachments`
- **Headers:**
  - `Content-Type: multipart/form-data`
  - `X-Development-Requester-Id: <UUID>` (*required*)
- **Path Parameters:**
  - `ticketId` (*UUID string, required*): The primary key UUID of the ticket.
- **Multipart Form Payload:**
  - Form field `files`: One or more binary files attached via `multipart/form-data`.

#### 3. Attachment Validation Specifications
| Rule Category | Requirement | Backend Observable Validation Contract |
|---|---|---|
| **Permitted Extensions** | `.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf` | Case-insensitive extension check on `originalFilename`. |
| **Declared MIME Types** | Permitted standard media types | Must match one of: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`. |
| **Content Signature Validation** | Detected content-type verification | Server performs detected content type / content signature validation to ensure file content matches permitted formats and declared MIME type. |
| **Maximum File Size** | 5 MB (5,242,880 bytes) per file | File size > 5,242,880 bytes is individually rejected (`FILE_TOO_LARGE`). |
| **Active Attachment Cap** | Maximum 5 active files per Ticket | Only records with `isRemoved = false` count. Removed tombstones do not count. |
| **Original Filenames** | Duplicate names allowed | `originalFilename` is display-only metadata. Storage generates a unique UUID storage key (e.g. `uuid.png`). |
| **Ticket Ownership** | Requester must own ticket | If ticket does not exist or belongs to another requester -> neutral `404 Not Found`. |

#### 4. Mixed File Selection & Remaining Capacity Logic
When $N$ files are submitted to a ticket with $A$ active attachments:
1. Remaining capacity $C = \max(0, 5 - A)$.
2. The backend iterates through files in submission order.
3. For each file:
   - If extension, declared MIME, or detected content signature is invalid $\rightarrow$ Reject with reason `"Unsupported file format. Allowed formats: JPG, PNG, WEBP, PDF."`.
   - If size > 5 MB $\rightarrow$ Reject with reason `"File size exceeds the 5 MB maximum limit."`.
   - If capacity $C == 0$ $\rightarrow$ Reject with reason `"Ticket attachment limit reached (maximum 5 active attachments)."`.
   - Otherwise $\rightarrow$ Store binary in object storage, insert database record, decrement $C$, add to `accepted`.

#### 5. Storage / Database Compensation Behavior
- If database insertion fails after writing a binary to object storage, the backend immediately cleans up (unlinks/deletes) the stored binary to prevent orphaned files.
- Metadata is never committed claiming an attachment is usable if the binary failed to store.

#### 6. Success Response (`201 Created`)
- **Content-Type:** `application/json`
- **Response DTO:**
```json
{
  "data": {
    "accepted": [
      {
        "id": "8d0e1f2a-3b4c-5d6e-7f8a-9b0c1d2e3f4a",
        "originalFilename": "error_log.pdf",
        "mimeType": "application/pdf",
        "sizeBytes": 204800,
        "createdAt": "2026-09-04T15:40:00.000Z",
        "isRemoved": false
      }
    ],
    "rejected": [
      {
        "filename": "installer.exe",
        "reason": "Unsupported file format. Allowed formats: JPG, PNG, WEBP, PDF."
      }
    ],
    "activeAttachmentCount": 2
  }
}
```

#### 7. Error Responses
##### `404 Not Found` (Neutral Missing or Cross-Requester Ticket)
```json
{
  "error": {
    "code": "TICKET_NOT_FOUND",
    "message": "Ticket not found.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

##### `400 Bad Request` (No Files Uploaded / All Files Invalid)
```json
{
  "error": {
    "code": "NO_VALID_FILES",
    "message": "No valid files were provided for upload.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
    "details": [
      {
        "field": "files",
        "message": "All selected files were rejected due to format, size, or capacity constraints."
      }
    ]
  }
}
```

##### `500 Internal Server Error`
```json
{
  "error": {
    "code": "ATTACHMENT_UPLOAD_FAILED",
    "message": "Failed to upload attachment.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

---

### Endpoint 8: GET `/api/v1/tickets/:ticketId/attachments/:attachmentId`

#### 1. Purpose
Retrieves metadata for a specific attachment belonging to a requester-owned ticket. Supports inspecting active attachments as well as soft-removed tombstones.

#### 2. HTTP Request
- **Method:** `GET`
- **Path:** `/api/v1/tickets/:ticketId/attachments/:attachmentId`
- **Headers:**
  - `Accept: application/json`
  - `X-Development-Requester-Id: <UUID>` (*required*)
- **Path Parameters:**
  - `ticketId` (*UUID string, required*): The ticket ID.
  - `attachmentId` (*UUID string, required*): The attachment ID.

#### 3. Validation & Privacy Rules
- Validates ticket ownership against `X-Development-Requester-Id`.
- Validates attachment belongs to `ticketId`.
- If ticket/attachment is missing, belongs to another requester, or does not belong to this ticket $\rightarrow$ returns neutral `404 Not Found` (`ATTACHMENT_NOT_FOUND`).
- **Internal Storage Key Protection:** Internal storage paths, filesystem paths, and S3 keys are **never** returned in the DTO.

#### 4. Success Response (`200 OK` - Active Attachment)
```json
{
  "data": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "originalFilename": "vpn_error_screenshot.png",
    "mimeType": "image/png",
    "sizeBytes": 1048576,
    "createdAt": "2026-09-04T15:32:00.000Z",
    "isRemoved": false,
    "removedAt": null,
    "removalReason": null
  }
}
```

#### 5. Success Response (`200 OK` - Soft-Removed Tombstone)
```json
{
  "data": {
    "id": "6b8d5568-6314-39cd-833a-d06eb0e8f9d6",
    "originalFilename": "accidental_upload.png",
    "mimeType": "image/png",
    "sizeBytes": 524288,
    "createdAt": "2026-09-04T15:31:00.000Z",
    "isRemoved": true,
    "removedAt": "2026-09-04T15:34:00.000Z",
    "removalReason": "Uploaded incorrect screenshot showing personal email."
  }
}
```

#### 6. Error Responses
##### `404 Not Found` (Neutral Protected Response)
```json
{
  "error": {
    "code": "ATTACHMENT_NOT_FOUND",
    "message": "Attachment not found.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

---

### Endpoint 9: GET `/api/v1/tickets/:ticketId/attachments/:attachmentId/download`

#### 1. Purpose
Streams the physical binary content of an active attachment for in-browser image preview (JPG/JPEG, PNG, WEBP) or PDF open/download.

#### 2. HTTP Request
- **Method:** `GET`
- **Path:** `/api/v1/tickets/:ticketId/attachments/:attachmentId/download`
- **Headers:**
  - `X-Development-Requester-Id: <UUID>` (*required*)
- **Path Parameters:**
  - `ticketId` (*UUID string, required*): The ticket ID.
  - `attachmentId` (*UUID string, required*): The attachment ID.
- **Query Parameters:**
  - `inline` (*boolean, optional, default: true for images, false for PDF/generic*):
    - `inline=true`: Sets `Content-Disposition: inline; filename="..."` allowing browser rendering.
    - `inline=false`: Sets `Content-Disposition: attachment; filename="..."` forcing download dialog.

#### 3. Ownership & Removed Binary Rules
- Enforces Ticket ownership: If the ticket does not belong to the requester, returns neutral `404 Not Found`.
- **Removed Attachment Binary Unavailable:** If `isRemoved === true`, the binary is permanently deleted from storage. The endpoint returns `404 Not Found` with message `"Attachment is no longer available."`.

#### 4. Success Response (`200 OK`)
- **Headers:**
  - `Content-Type: image/png` (or `image/jpeg`, `image/webp`, `application/pdf`)
  - `Content-Length: <sizeBytes>`
  - `Content-Disposition: inline; filename="vpn_error_screenshot.png"`
  - `Cache-Control: private, no-cache, no-store, must-revalidate`
- **Body:** Binary octet stream of the file content.

#### 5. Error Responses
##### `404 Not Found` (Missing, Cross-Requester, or Removed Attachment)
```json
{
  "error": {
    "code": "ATTACHMENT_NOT_FOUND",
    "message": "Attachment not found or no longer available.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

##### `500 Internal Server Error`
```json
{
  "error": {
    "code": "DOWNLOAD_FAILED",
    "message": "Failed to stream attachment content.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

---

### Endpoint 10: DELETE `/api/v1/tickets/:ticketId/attachments/:attachmentId`

#### 1. Purpose
Soft-removes an active attachment from an owned ticket. Preserves audit metadata (tombstone) including reason, timestamp, and remover info, generates an `ATTACHMENT_REMOVED` audit record in transaction, deletes the physical binary from object storage, and frees an active attachment slot.

#### 2. HTTP Request
- **Method:** `DELETE`
- **Path:** `/api/v1/tickets/:ticketId/attachments/:attachmentId`
- **Headers:**
  - `Content-Type: application/json`
  - `X-Development-Requester-Id: <UUID>` (*required*)
- **Path Parameters:**
  - `ticketId` (*UUID string, required*): The ticket ID.
  - `attachmentId` (*UUID string, required*): The attachment ID.
- **Request Body DTO:**
```json
{
  "reason": "Uploaded incorrect file containing sensitive personal info"
}
```

#### 3. Validation & Business Rules
| Field | Type | Required | Rules & Constraints |
|---|---|---|---|
| `reason` | String | Yes | Trimmed length must be between 1 and 200 characters inclusive. Whitespace-only string is rejected (`INVALID_REMOVAL_REASON`). |

- **Ownership:** Requester must own the ticket. Cross-requester removal requests return neutral `404 Not Found`.
- **Already Removed:** If the attachment is already soft-removed (`isRemoved = true`), returns `409 Conflict` (`ATTACHMENT_ALREADY_REMOVED`).
- **Binary Cleanup & Transaction Lifecycle:**
  1. In a database transaction:
     - The Attachment record is updated: `isRemoved = true`, `removedAt = NOW()`, `removalReason = trimmedReason`, `removedById = requesterId`.
     - An `ATTACHMENT_REMOVED` audit/domain event record is inserted.
  2. The stored binary object is deleted from object storage.
  3. If physical deletion fails, cleanup is queued/recorded for background retry; failed physical deletion **never** restores requester visibility.
  4. The ticket's active attachment count decreases by 1, immediately allowing a new file to be uploaded up to the limit of 5.

#### 4. Success Response (`200 OK`)
- **Content-Type:** `application/json`
- **Response DTO (Tombstone):**
```json
{
  "data": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "originalFilename": "vpn_error_screenshot.png",
    "mimeType": "image/png",
    "sizeBytes": 1048576,
    "createdAt": "2026-09-04T15:32:00.000Z",
    "isRemoved": true,
    "removedAt": "2026-09-04T16:00:00.000Z",
    "removalReason": "Uploaded incorrect file containing sensitive personal info"
  }
}
```

#### 5. Error Responses
##### `400 Bad Request` (Invalid Removal Reason)
```json
{
  "error": {
    "code": "INVALID_REMOVAL_REASON",
    "message": "Removal reason is required and must contain 1-200 characters.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
    "details": [
      {
        "field": "reason",
        "message": "Reason cannot be empty or solely whitespace."
      }
    ]
  }
}
```

##### `404 Not Found` (Neutral Protected Response)
```json
{
  "error": {
    "code": "ATTACHMENT_NOT_FOUND",
    "message": "Attachment not found.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

##### `409 Conflict` (Already Removed)
```json
{
  "error": {
    "code": "ATTACHMENT_ALREADY_REMOVED",
    "message": "Attachment has already been removed.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

##### `500 Internal Server Error`
```json
{
  "error": {
    "code": "ATTACHMENT_REMOVAL_FAILED",
    "message": "Failed to remove attachment.",
    "correlationId": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

---

## 5. Comprehensive Requester Ownership Matrix

| Resource / Action | Requester A (Owner) | Requester B (Non-Owner) | Unauthenticated / Missing Header | Inactive Requester (e.g. Evan) |
|---|---|---|---|---|
| `GET /api/v1/development-requesters` | `200 OK` (Public) | `200 OK` (Public) | `200 OK` (Public) | `200 OK` (Public) |
| `GET /api/v1/categories` | `200 OK` (Public) | `200 OK` (Public) | `200 OK` (Public) | `200 OK` (Public) |
| `GET /api/v1/related-systems` | `200 OK` (Public) | `200 OK` (Public) | `200 OK` (Public) | `200 OK` (Public) |
| `POST /api/v1/tickets` | `201 Created` (Owned by A) | `201 Created` (Owned by B) | `400 Bad Request` | `400 Bad Request` |
| `GET /api/v1/tickets` (My Tickets) | `200 OK` (Sees A's tickets only) | `200 OK` (Sees B's tickets only) | `400 Bad Request` | `400 Bad Request` |
| `GET /api/v1/tickets/:ticketIdA` | `200 OK` (Full detail) | **`404 Not Found` (Neutral)** | `400 Bad Request` | `400 Bad Request` |
| `POST /api/v1/tickets/:ticketIdA/attachments` | `201 Created` | **`404 Not Found` (Neutral)** | `400 Bad Request` | `400 Bad Request` |
| `GET /api/v1/tickets/:ticketIdA/attachments/:id` | `200 OK` | **`404 Not Found` (Neutral)** | `400 Bad Request` | `400 Bad Request` |
| `GET /api/v1/tickets/:ticketIdA/attachments/:id/download` | `200 OK` (Binary Stream) | **`404 Not Found` (Neutral)** | `400 Bad Request` | `400 Bad Request` |
| `DELETE /api/v1/tickets/:ticketIdA/attachments/:id` | `200 OK` (Tombstone created) | **`404 Not Found` (Neutral)** | `400 Bad Request` | `400 Bad Request` |

---

## 6. Neutral Protected-Resource & Anti-Enumeration Behavior

### 6.1 Security & Information Leakage Prevention
In multi-user applications, returning `403 Forbidden` for existing resources that belong to other users allows malicious users to enumerate valid resource IDs (IDOR scanning).

### 6.2 Architectural Requirement
TokTickIT strictly enforces **Neutral Client-Visible Not-Found Behavior**:
1. If a client queries `GET /api/v1/tickets/00000000-0000-0000-0000-000000000000` (nonexistent): returns `404 Not Found` with `{ "error": { "code": "TICKET_NOT_FOUND", "message": "Ticket not found." } }`.
2. If Requester B queries `GET /api/v1/tickets/3fa85f64-5717-4562-b3fc-2c963f66afa6` (owned by Requester A): returns **identically** `404 Not Found` with `{ "error": { "code": "TICKET_NOT_FOUND", "message": "Ticket not found." } }`.
3. If Requester B attempts to download or delete an attachment on Ticket A: returns **identically** `404 Not Found` with `{ "error": { "code": "ATTACHMENT_NOT_FOUND", "message": "Attachment not found." } }`.

Response payloads, HTTP status codes, headers, and error messages for nonexistent resources and unauthorized cross-requester resources are completely indistinguishable.

---

## 7. API-to-Feature Traceability

| Feature ID | Feature Name | Backend Endpoints Implemented |
|---|---|---|
| **Feature-A** | Development Requester Context | `GET /api/v1/development-requesters`, Requester Header Middleware (`X-Development-Requester-Id`) |
| **Feature-B** | Requester UI Foundation | *Client-Side UI Foundation (Consumes shared error envelopes and status codes; no dedicated business endpoint)* |
| **Feature-C** | Ticket Reference Data | `GET /api/v1/categories`, `GET /api/v1/related-systems` |
| **Feature-D** | Create Ticket | `POST /api/v1/tickets` |
| **Feature-E** | My Tickets | `GET /api/v1/tickets` |
| **Feature-F** | Requester Ticket Detail | `GET /api/v1/tickets/:ticketId` |
| **Feature-G** | Attachment Management | `POST /api/v1/tickets/:ticketId/attachments`, `GET /api/v1/tickets/:ticketId/attachments/:attachmentId`, `GET /api/v1/tickets/:ticketId/attachments/:attachmentId/download`, `DELETE /api/v1/tickets/:ticketId/attachments/:attachmentId` |

---

## 8. Requirements-to-API Traceability Matrix

### 8.1 Functional Requirements (FR) Traceability
| Requirement | Covered By Endpoint(s) | Implementation Contract |
|---|---|---|
| **FR-01, FR-02** | `GET /api/v1/development-requesters` | Loads active Development Requesters for selection screen. |
| **FR-03, FR-04, FR-05, FR-06** | All protected endpoints | Middleware validates `X-Development-Requester-Id`, rejects missing/inactive IDs. |
| **FR-07, FR-08, FR-09, FR-10, FR-11, FR-12, FR-13** | `POST /api/v1/tickets` | Accepts ticket data, generates `TKT-YYYY-NNNNN` & UTC timestamp, sets status `New`. |
| **FR-14, FR-15, FR-16** | `POST /api/v1/tickets` | Implements duplicate submission protection via `clientRequestId`, preserves input on failure, returns DTO. |
| **FR-17, FR-18, FR-19, FR-20, FR-21** | `GET /api/v1/tickets` | Implements scoped My Tickets list with search, category/system/priority/status filters, deterministic sorting, and 10/20/50 pagination. |
| **FR-22, FR-23** | `GET /api/v1/tickets` | Returns empty items array with 200 OK and accurate pagination counts. |
| **FR-24, FR-25** | `GET /api/v1/tickets/:ticketId` | Returns read-only details of requester-owned ticket. |
| **FR-26, FR-27** | `GET /api/v1/tickets/:ticketId`, Attachment routes | Enforces neutral 404 behavior for unauthorized or nonexistent resources. |
| **FR-28, FR-29, FR-30, FR-31, FR-32, FR-33** | `POST /api/v1/tickets/:ticketId/attachments` | Multipart upload for JPG, PNG, WEBP, PDF up to 5 MB; caps active files at 5; supports partial acceptance and duplicate filenames. |
| **FR-34, FR-35, FR-36** | `GET .../attachments/:attachmentId/download` | Streams active image binaries for preview and PDF binaries for open/download. |
| **FR-37, FR-38, FR-39, FR-40, FR-41** | `DELETE .../attachments/:attachmentId` | Validates 1-200 char reason, creates soft-removal tombstone, deletes physical binary from storage. |
| **FR-42, FR-43** | `GET /api/v1/categories`, `GET /api/v1/related-systems`, Ticket routes | Active reference data for selection; historical inactive values remain readable. |
| **FR-45, FR-46, FR-47, FR-48** | All endpoints | Standardized HTTP response codes, safe error envelopes, and DTO contracts. |

### 8.2 Business Rules (BR) Traceability
| Business Rule | Covered By Endpoint(s) | Implementation Contract |
|---|---|---|
| **BR-01, BR-02, BR-09, BR-10** | `POST /api/v1/tickets` | Backend-authoritative `TKT-YYYY-NNNNN` annual sequence & UTC creation timestamp. |
| **BR-03, BR-19** | `POST /api/v1/tickets`, `GET /api/v1/tickets` | Initial status `New`, filterable in My Tickets. |
| **BR-04, BR-05, BR-06, BR-41** | `GET /api/v1/development-requesters`, Middleware | Active requester filter; clear error on inactive stored requester. |
| **BR-07, BR-08, BR-18, BR-23** | All protected endpoints | Strict requester ownership boundary on all queries and mutations. |
| **BR-11, BR-12** | `POST /api/v1/tickets`, `GET /api/v1/tickets` | `Low`, `Medium`, `High`, `Urgent` vocabulary, default `Medium`. |
| **BR-13, BR-14, BR-15** | `POST /api/v1/tickets` | Summary (5-120 chars) and Description (10-2000 chars) trimmed validation. |
| **BR-16, BR-17** | `POST /api/v1/tickets` | Idempotent `clientRequestId` deduplication contract. |
| **BR-20, BR-21, BR-22, BR-40** | `GET /api/v1/tickets` | Case-insensitive multi-field search, combined filters, pagination metadata. |
| **BR-24, BR-27** | `GET /api/v1/tickets/:id`, Attachment routes | Neutral 404 on cross-requester access. |
| **BR-25, BR-26** | `GET /api/v1/tickets/:id` | Read-only ticket fields; no update endpoint exposed in Lab 2. |
| **BR-26, BR-27, BR-28, BR-29, BR-30** | `POST .../attachments` | JPG/PNG/WEBP/PDF, 5 MB limit, 5 active limit, unique storage key. |
| **BR-31, BR-32, BR-33, BR-34, BR-35** | `DELETE .../attachments/:id`, `GET .../download` | 1-200 char reason, tombstone record, removed binary permanently unavailable. |
| **BR-36, BR-37** | `POST .../attachments` | Partial file acceptance; ticket persists if attachment upload fails. |
| **BR-38, BR-39** | `GET /api/v1/categories`, `GET /api/v1/related-systems` | Active reference data for selection; historical references preserved on tickets. |

### 8.3 Non-Functional Requirements (NFR) Traceability
| NFR | Covered By Endpoint(s) | Implementation Contract |
|---|---|---|
| **NFR-03 Safe Error Handling** | All endpoints | Uniform safe error envelope; no SQL, Prisma, or stack trace exposure. |
| **NFR-04 Validation Authority** | All endpoints | Backend independently validates all fields, lengths, types, and references. |
| **NFR-05 Ownership Enforcement** | All protected endpoints | Authoritative server-side requester ownership verification. |
| **NFR-06 Concurrency Safety** | `POST /api/v1/tickets` | Transactional sequence generation for unique ticket numbers under concurrency. |
| **NFR-07 Database Integrity** | All endpoints | Referential integrity, UUID keys, and foreign key constraints in PostgreSQL. |
| **NFR-08 Attachment Safety** | Attachment routes | Extension validation, MIME validation, detected content-type / content-signature validation, size limits, storage decoupling, compensation on failure. |
| **NFR-09 Maintainability** | All endpoints | Clean REST `/api/v1` architecture, explicit DTOs, modular route handlers. |
| **NFR-10, NFR-11 Testability** | All endpoints | Explicit inputs, outputs, and status codes for unit, integration, and E2E tests. |
| **NFR-12 Secrets & Config** | All endpoints | No credentials or sensitive storage keys exposed across API boundary. |

---

## 9. Planned API Testing Obligations

The implementation must pass automated backend integration and contract test suites covering at minimum:

### 9.1 Development Requester & Context Tests
- [ ] `GET /api/v1/development-requesters` returns `200 OK` with active requesters ordered by `name ASC`.
- [ ] Inactive requesters (`isActive: false`, e.g. Evan) are excluded from `GET /api/v1/development-requesters`.
- [ ] Protected endpoints return `400 Bad Request` (`MISSING_REQUESTER_HEADER`) when header is omitted.
- [ ] Protected endpoints return `400 Bad Request` (`INACTIVE_REQUESTER`) when header specifies an inactive requester UUID.
- [ ] Protected endpoints return `400 Bad Request` (`REQUESTER_NOT_FOUND`) when header specifies a nonexistent requester UUID.

### 9.2 Reference Data Tests
- [ ] `GET /api/v1/categories` returns `200 OK` with active categories ordered by `name ASC`.
- [ ] `GET /api/v1/related-systems` returns `200 OK` with active related systems ordered by `name ASC`.
- [ ] Legacy `GET /api/categories` remains functional for Lab 1 backward compatibility.

### 9.3 Ticket Creation Tests
- [ ] `POST /api/v1/tickets` with valid payload creates exactly one ticket and returns `201 Created`.
- [ ] Official `ticketNumber` matches `TKT-YYYY-NNNNN` format and annual sequence.
- [ ] Initial `currentStatus` is `"New"`.
- [ ] Default `requestedPriority` is `"Medium"` when omitted.
- [ ] Summary < 5 chars, > 120 chars, or whitespace-only returns `400 Bad Request`.
- [ ] Description < 10 chars, > 2000 chars, or whitespace-only returns `400 Bad Request`.
- [ ] Inactive Category UUID or Related System UUID returns `400 Bad Request`.
- [ ] Exact replay with same `clientRequestId` returns `200 OK` with existing ticket without duplicating records.
- [ ] Replaying same `clientRequestId` with modified payload returns `409 Conflict` (`IDEMPOTENCY_CONFLICT`).
- [ ] Concurrent ticket creation generates unique, non-colliding ticket numbers.

### 9.4 My Tickets (Query & Pagination) Tests
- [ ] `GET /api/v1/tickets` returns only tickets belonging to `X-Development-Requester-Id`.
- [ ] Case-insensitive search `q` filters across `ticketNumber`, `summary`, and `description`.
- [ ] Category, Related System, Priority, and Status filters can be combined.
- [ ] Sorting options (`newest`, `oldest`, `recentlyUpdated`, `ticketNumberAsc`) apply deterministic tie-breaking.
- [ ] Pagination (`page`, `pageSize` in [10, 20, 50]) returns accurate metadata (`totalItems`, `totalPages`, `hasNextPage`, `hasPreviousPage`).
- [ ] Invalid `page` or `pageSize` returns `400 Bad Request`.
- [ ] Empty result set returns `200 OK` with `data: []` and `totalItems: 0`.

### 9.5 Ticket Detail & Neutral Ownership Tests
- [ ] `GET /api/v1/tickets/:ticketId` returns `200 OK` for owned ticket with read-only fields.
- [ ] Inactive historical category/system references return `isActive: false` cleanly.
- [ ] Requesting nonexistent ticket returns `404 Not Found` with neutral error message.
- [ ] Requesting another requester's ticket returns identical `404 Not Found` (anti-enumeration).

### 9.6 Attachment Upload & Validation Tests
- [ ] Valid JPG, PNG, WEBP, PDF files upload successfully and return `201 Created`.
- [ ] Files > 5 MB are rejected.
- [ ] Disallowed file extensions and mismatched detected content signatures are rejected.
- [ ] Uploads exceeding 5 active files are capped up to remaining capacity, excess rejected.
- [ ] Mixed selection (valid + invalid) accepts valid files and rejects invalid files with reasons.
- [ ] Duplicate original filenames do not overwrite existing files.
- [ ] Storage failure triggers rollback compensation.

### 9.7 Attachment Retrieval & Download Tests
- [ ] `GET .../attachments/:attachmentId` returns metadata without exposing internal storage keys.
- [ ] `GET .../attachments/:attachmentId/download` streams image/PDF binary with correct `Content-Type`.
- [ ] `inline=true` serves `Content-Disposition: inline`, `inline=false` serves `attachment`.
- [ ] Requesting another requester's attachment download returns neutral `404 Not Found`.
- [ ] Requesting download of a removed attachment returns `404 Not Found`.

### 9.8 Attachment Removal Tests
- [ ] `DELETE .../attachments/:attachmentId` with valid 1-200 char reason soft-removes attachment, inserts `ATTACHMENT_REMOVED` audit event in transaction, and returns `200 OK` tombstone.
- [ ] Removal reason missing, empty, whitespace-only, or > 200 chars returns `400 Bad Request`.
- [ ] Removed attachment immediately frees an active slot, allowing new uploads.
- [ ] Removed binary is unlinked/deleted from object storage.
- [ ] Removing an already removed attachment returns `409 Conflict`.
- [ ] Removing another requester's attachment returns neutral `404 Not Found`.

---

## 10. Out-of-Scope API Behaviors

The following capabilities are explicitly excluded from Lab 2 and must not be implemented:
1. **Real Authentication & Authorization:** No passwords, bcrypt, tokens, session cookies, JWTs, login/logout routes, or role-based access control.
2. **IT Staff Workflows:** No ticket assignment, queue management, staff priority overrides, internal notes, actions taken, or public comments.
3. **Ticket Status Transitions:** No resolving, closing, reopening, or cancelling tickets (all Lab 2 tickets remain `New`).
4. **Requester Ticket Editing:** No `PUT` or `PATCH` endpoints for editing submitted ticket summary, description, category, related system, or priority.
5. **Admin Reference Management:** No endpoints for creating, editing, activating, or deactivating Categories or Related Systems.
6. **Hard Deletion of Tickets:** Tickets are permanent records and cannot be deleted.

---

## 11. Approved API Design Decisions

The following design decisions are approved as part of the Lab 2 engineering contract:

1. **Development Requester Identifier Format (UUID v4):** While the approved System-Level SDS establishes UUID primary keys for system entities (Tickets, Attachments, Categories, Related Systems), the temporary Lab 2 `DevelopmentRequester` testing model is also assigned standard UUID v4 strings for `id` and `X-Development-Requester-Id` header transport to maintain uniform identifier types across all REST DTOs and foreign keys.
2. **Idempotency Transport & Conflict Behavior:** Standardized exclusively on `clientRequestId` (UUID v4 string) in the JSON request body for `POST /api/v1/tickets`. First submission returns `201 Created`, exact replay returns `200 OK` with `Idempotent-Replay: true` header, and reusing the same `clientRequestId` with modified payload returns `409 Conflict` (`IDEMPOTENCY_CONFLICT`).
3. **Deterministic Tie-Break Sorting:** Defined `ticketNumber ASC` as the universal deterministic secondary sort for `newest`, `oldest`, and `recentlyUpdated`, and `createdAt DESC` as the secondary sort for `ticketNumberAsc`.
4. **Pagination Metadata Structure:** Standardized pagination metadata to include `page`, `pageSize`, `totalItems`, `totalPages`, `hasNextPage`, and `hasPreviousPage`.
5. **Attachment Download Disposition Query:** Standardized optional `inline=true|false` on `GET .../download` to support both in-browser preview (`inline`) and direct download (`attachment`).
6. **Soft-Removal HTTP Status & Transaction Contract:** Standardized on `200 OK` returning the tombstone DTO along with atomic creation of the `ATTACHMENT_REMOVED` domain event and asynchronous/synchronous storage binary deletion.
