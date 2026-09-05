# TokTickIT Lab 2 - UI Specification

**Version:** 1.0  
**Status:** Approved Engineering Contract  
**Sprint:** Lab 2 (Requester Ticketing MVP)  
**Product:** TokTickIT  

---

## 1. UI Design Principles

### 1.1 Visual Identity & Approved KMUTT Theme Tokens
In accordance with the approved Lab 2 Specification (`specification.md`, Section 8 and Decision `D-L2-33`) and the TokTickIT System-Level SDS:
- **Visual Theme:** The application strictly implements the **KMUTT Visual Identity**. The approved Lab 2 decision `D-L2-33` officially supersedes the initial Zen Green concept from the prompt brief.
- **Approved System-Level SDS Color Tokens:**
  - **KMUTT Orange (`#FA4616`):** Primary brand accent, main navigation elements, primary action buttons, and active tabs.
  - **KMUTT Yellow (`#FFC72C`):** Secondary accent, warning callouts, and pending/notice highlights.
  - **KMUTT Blue Grey (`#7B8189`):** Neutral borders, secondary icons, and structural dividers.
  - **Interactive Dark Orange (`#8A2608`):** Hover and active states for primary buttons and interactive links.
  - **Primary Text (`#1F2937`):** High-contrast dark charcoal text for headings, body copy, and form inputs.
  - **Muted Text (`#5B6573`):** Secondary labels, helper text, character counters, and timestamps.
  - **Surface Background (`#FFFFFF`):** Clean white surface for cards, modals, and main container backgrounds.
  - **Success (`#2E7D32`):** Confirmation badges, success banners, and positive state feedback.
  - **Danger (`#B3261E`):** Validation error messages, removal confirmations, and critical error banners.
- **UI Framework:** Built on **React 18**, **TypeScript**, **Vite**, and **Bootstrap 5.3**, utilizing standard utility classes and clean semantic styling.

### 1.2 Core UX & Interaction Principles
1. **Clear Identity & Context:** The user is always aware of the active Development Requester context via a persistent header badge and can switch requesters at any time.
2. **Authoritative Backend Alignment:** The UI reflects server-side validation and ownership rules directly without inventing client-only business logic.
3. **Visual Distinction for System-Generated Fields:** System-generated and read-only values (Ticket Number, Ticket Date, Current Status `New`, Requester identity) are visually distinct from editable form controls using read-only styling, subtle neutral backgrounds, and badge indicators.
4. **Responsive Usability:** Layouts seamlessly adapt across desktop, tablet, and mobile viewports without horizontal scrolling, clipped content, or broken actions.
5. **Universal Accessibility:** Complies with the System-Level SDS accessibility baseline (WCAG 2.2 AA target), providing semantic HTML, keyboard operability, visible focus indicators, accessible form labels, and status feedback that never relies on color alone.
6. **Graceful Degradation & Resilience:** Network failures, validation rejections, and empty states provide safe, informative feedback and actionable recovery paths (e.g., Retry, Clear Filters, Create Ticket CTA).

---

## 2. Feature-to-UI Inventory

| Feature ID | Feature Name | UI Responsibility | Primary Screens / Components |
|---|---|---|---|
| **Feature-A** | Development Requester Context | Requester selection, context display, tab-scoped persistence, switching, and invalid context handling. | `RequesterSelectScreen`, `RequesterContextBadge`, `ChangeRequesterAction` |
| **Feature-B** | Requester UI Foundation | Shared application shell, navigation bar, responsive layouts, theme tokens, accessible focus rings, and shared state components. | `AppShell`, `NavBar`, `LoadingSpinner`, `ErrorAlert`, `ConfirmModal` |
| **Feature-C** | Ticket Reference Data | Populating Category and Related System selection dropdowns, filter controls, and historical inactive value badges. | `CategorySelect`, `RelatedSystemSelect`, `ReferenceFilterGroup`, `HistoricalReferenceBadge` |
| **Feature-D** | Create Ticket | Form input for new tickets, default priority, summary/description validation, duplicate submission protection, and creation feedback. | `CreateTicketScreen`, `CreateTicketForm`, `SubmitBusyButton` |
| **Feature-E** | My Tickets | Requester-owned ticket list, real-time search, combined multi-filters, fixed sorting, pagination, empty states, and no-results states. | `MyTicketsScreen`, `TicketTable`, `TicketCardList`, `SearchInput`, `FilterBar`, `PaginationControl` |
| **Feature-F** | Requester Ticket Detail | Read-only presentation of ticket headers, dates, status, historical references, summary, description, and neutral not-found experience. | `TicketDetailScreen`, `TicketHeaderCard`, `TicketDescriptionCard`, `TicketNotFoundView` |
| **Feature-G** | Attachment Management | Uploading attachments, file validation feedback, active attachment list, image preview modal, PDF download, and soft-removal modal with reason. | `AttachmentSection`, `AttachmentUploadDropzone`, `ActiveAttachmentList`, `ImagePreviewModal`, `AttachmentRemovalModal`, `RemovedAttachmentTombstoneList` |

---

## 3. Screen Inventory

| Screen / View | Primary Route (Proposed) | Feature Owner | Description & Key Function |
|---|---|---|---|
| **Development Requester Selection** | `/requester-select` | Feature-A | Initial gate to select an active Development Requester before entering ticketing workflows. |
| **Requester Application Shell** | `/` (Layout Wrapper) | Feature-B | Persistent top navigation bar displaying TokTickIT branding, links, and current requester badge. |
| **My Tickets Screen** | `/tickets` (or `/` after selection) | Feature-E | Main landing screen displaying requester-owned tickets with search, filters, sort, and pagination. |
| **Create Ticket Screen** | `/tickets/new` | Feature-D | Ticket creation form capturing Category, Related System, Priority, Summary, Description, and Attachments. |
| **Requester Ticket Detail Screen** | `/tickets/:ticketId` | Feature-F | Read-only inspection view of an owned ticket, integrating the Attachment Management section. |

---

## 4. Feature-A: Development Requester Context UI

### 4.1 Purpose & Disclaimer
The Development Requester UI allows testers and developers to select and switch simulated requester identities during Lab 2 testing.
> [!IMPORTANT]
> This is strictly a temporary Lab 2 development testing mechanism. It is **NOT** authentication. There are no passwords, login forms, sessions, or role permissions.

### 4.2 Development Requester Selection Screen (`/requester-select`)
- **Layout:** Centered card layout on a clean neutral surface.
- **Header & Branding:** TokTickIT logo, title `"Development Requester Selection"`.
- **Explanatory Callout:**
  > *"Select a Development Requester to test requester-specific ticketing features. This is a temporary testing selector for Lab 2; full authentication will be introduced in Lab 3."*
- **Form Controls:**
  - **Requester Dropdown:** Populated via `GET /api/v1/development-requesters` (displaying `"Name (email)"`, e.g., `"Alice Developer (alice@kmutt.ac.th)"`). Inactive requesters (e.g., Evan) are not included.
  - **Continue Button:** Enabled once an active requester is chosen; commits context and navigates to My Tickets (`/tickets`).
- **States:**
  - **Loading:** Dropdown disabled with a loading indicator `"Loading active requesters..."`.
  - **Empty List:** User-facing alert message `"No active Development Requesters are currently available."` with a Retry button.
  - **API Error:** Safe error banner `"Unable to load development requesters. [Retry]"`.

### 4.3 Context Storage, Restoration & Switching
- **Storage:** Only the selected **Development Requester ID** (UUID string) is persisted in browser `sessionStorage` (scoped strictly to the individual browser tab).
- **Restoration:** On page load or tab refresh, `AppShell` reads the stored requester ID. The client obtains/validates the active requester profile through the approved API context and attaches `X-Development-Requester-Id: <UUID>` to all protected API calls.
- **Invalid / Inactive Requester Detection:** If an API call returns `400 Bad Request` with code `INACTIVE_REQUESTER` or `REQUESTER_NOT_FOUND`, the client clears `sessionStorage` and immediately redirects to `/requester-select` with an explanatory notification.
- **Change Requester Workflow:**
  - Activating `"Change Requester"` in the navigation bar returns the user to Development Requester Selection (`/requester-select`).
  - Selecting a different active Requester replaces the stored requester ID in `sessionStorage`.
  - Unfinished requester-specific Create Ticket state is cleared.
  - Requester-owned data is reloaded for the newly selected Requester.
  - The application navigates to My Tickets (`/tickets`).

---

## 5. Feature-B: Requester UI Foundation

### 5.1 Shared Application Shell (`AppShell`)
The application shell encloses all requester views with a consistent, accessible top navigation bar and responsive content container.

```
+---------------------------------------------------------------------------------------+
|  [TokTickIT Brand]   My Tickets   Create Ticket     [Requester: Alice Developer] [Switch] |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|                               <Active Screen Content>                                 |
|                                                                                       |
+---------------------------------------------------------------------------------------+
```

### 5.2 Top Navigation Bar Components
1. **Brand Identity:** `"TokTickIT"` text logo styled in KMUTT Orange (`#FA4616`), linking to `/tickets`.
2. **Navigation Links:**
   - `"My Tickets"` (Active state highlighted with bold text and KMUTT Orange border accent).
   - `"Create Ticket"` (Styled as a distinct action button/link).
3. **Requester Status Badge:** Neutral pill badge displaying the user icon and active requester name (e.g., `Requester: Alice Developer`).
4. **Change Requester Button:** Secondary button triggering requester switching.
5. **Mobile Viewport Behavior ($< 768\text{px}$):** Collapses navigation links into a standard Bootstrap hamburger drawer while keeping the brand and requester badge accessible.

### 5.3 Reusable UI State Components
- **`LoadingSpinner`:** Accessible loading indicator (`role="status"`, `"Loading content, please wait..."`).
- **`ErrorAlert`:** Safe error card with an alert icon, human-readable message, and optional `"Retry"` action button.
- **`ConfirmModal`:** Standardized accessible modal dialog for destructive actions (e.g., attachment removal, or proposed confirmation interactions) with explicit `"Cancel"` and `"Confirm"` buttons.

---

## 6. Feature-C: Ticket Reference Data UI

### 6.1 Consumption in Form Controls
Reference data is loaded asynchronously and rendered across three main workflows:
1. **Create Ticket:** `Category` and `Related System` dropdown selects populated exclusively from `GET /api/v1/categories` and `GET /api/v1/related-systems`. Inactive values are never present in new creation dropdowns.
2. **My Tickets Filter Bar:** Populates Category and Related System filter dropdowns with an initial `"All Categories"` / `"All Systems"` default option.
3. **Ticket Detail:** Displays the historical Category and Related System names.

### 6.2 Reference Data Loading & Failure Behavior
- **Loading State:** Form select elements display `"Loading categories..."` / `"Loading related systems..."` with disabled state until resolved.
- **Failure State:** If reference data fails to load, a field-level error alert appears with a `"Retry Loading"` button. The `"Submit"` button is disabled to prevent invalid ticket submission.
- **Historical Inactive Reference Display:** If `TicketDetail` receives `category.isActive === false` or `relatedSystem.isActive === false`, the UI renders the reference name accompanied by a subtle secondary indicator badge: `[Category Name] (Inactive)`.

---

## 7. Feature-D: Create Ticket UI

### 7.1 Screen Layout & Structure (`/tickets/new`)
The Create Ticket screen is structured into a clean, card-based form:

```
+---------------------------------------------------------------------------------------+
|  <- Back to My Tickets                                                                |
|                                                                                       |
|  Create New IT Support Ticket                                                         |
|  Describe your issue and submit a ticket to the IT Service Desk.                      |
|                                                                                       |
|  +-- System-Generated Information -------------------------------------------------+  |
|  |  Requester: Alice Developer (Read-only)                                          |  |
|  |  Ticket Number: Generated upon submission   Ticket Date: Recorded upon submission|  |
|  |  Initial Status: New                                                            |  |
|  +---------------------------------------------------------------------------------+  |
|                                                                                       |
|  * Category:               [ Select Category               v ]                        |
|  * Related System:         [ Select Related System         v ]                        |
|  * Requested Priority:     ( ) Low  (*) Medium  ( ) High  ( ) Urgent                  |
|  * Ticket Summary:         [ 5-120 characters                                ]        |
|                            Summary character count: 0 / 120                           |
|  * Description:            [ Detailed description of the problem...          ]        |
|                            [ 10-2000 characters                              ]        |
|                            Description character count: 0 / 2000                      |
|                                                                                       |
|  +-- Attachments (Optional) -------------------------------------------------------+  |
|  |  [ + Choose Files ] JPG, PNG, WEBP, PDF up to 5 MB each (Max 5 files)           |  |
|  |  Selected Files: (1) error_screenshot.png (1.2 MB) [Remove]                     |  |
|  +---------------------------------------------------------------------------------+  |
|                                                                                       |
|  [ Cancel ]                                                  [ Submit Ticket ]        |
+---------------------------------------------------------------------------------------+
```

### 7.2 Field Specifications & Client-Side Validation Rules
| Field | UI Control | Validation & Usability Rules |
|---|---|---|
| **Requester** | Read-only input badge | Displays active Development Requester name. Not editable. |
| **Category** | Dropdown select (`<select>`) | Required. Must select an active category. Validation error: *"Please select a category."* |
| **Related System** | Dropdown select (`<select>`) | Required. Must select an active related system. Validation error: *"Please select a related system."* |
| **Requested Priority** | Radio group or Select | Optional (defaults to `Medium`). Allowed: `Low`, `Medium`, `High`, `Urgent`. |
| **Ticket Summary** | Single-line text input | Required. 5–120 characters after trimming. Visual character count indicator. Validation error: *"Summary must be between 5 and 120 characters."* |
| **Description** | Multi-line textarea (min 4 rows) | Required. 10–2000 characters after trimming. Visual character count indicator. Validation error: *"Description must be between 10 and 2000 characters."* |
| **Staged Attachments** | File chooser / drop target | Optional. Validates format (JPG/PNG/WEBP/PDF) and size ($\le$ 5 MB). Staged files are uploaded after ticket creation. |

### 7.3 Duplicate-Submission Prevention & Busy State
- When the user clicks `"Submit Ticket"`, the client validates all fields locally.
- If valid:
  1. The Submit button enters a visible **busy state**: text changes to `"Submitting Ticket..."`, a loading spinner appears, and the button is **disabled**.
  2. The client generates a unique `clientRequestId` (UUID v4) and includes it in the `POST /api/v1/tickets` payload.
  3. The form fields are set to read-only during transmission.
- **Idempotency & Replay:** If the network request is retried, the identical `clientRequestId` ensures no duplicate ticket is created on the backend.

### 7.4 Success & Failure Transitions
- **Success:**
  1. The Ticket is created first on the backend, and the official `ticketNumber` and `id` are returned.
  2. Once the Ticket ID exists, staged permitted attachments are submitted using the approved Attachment API (`POST /api/v1/tickets/:ticketId/attachments`).
  3. The UI navigates to the Ticket Detail view (`/tickets/:ticketId`) displaying a success toast banner: *"Ticket TKT-YYYY-NNNNN created successfully!"*.
- **Partial Attachment Failure:** If the ticket is created successfully but staged attachments fail upload, the UI still navigates to Ticket Detail and displays a warning banner: *"Ticket created successfully, but some attachments failed to upload. You can retry uploading them below."*. The successfully created Ticket is preserved.
- **Recoverable Failure:** If ticket creation fails (e.g., backend validation or 500 error), the form is re-enabled, an error banner is displayed at the top, and **all entered user form values are strictly preserved**.

---

## 8. Feature-E: My Tickets UI

### 8.1 Screen Layout & Structure (`/tickets`)
The My Tickets screen provides the primary dashboard for viewing and managing requester-owned tickets.

```
+---------------------------------------------------------------------------------------+
|  My Tickets                                                    [ + Create Ticket ]     |
|  View and track your submitted IT support tickets.                                    |
|                                                                                       |
|  +-- Search & Filters -------------------------------------------------------------+  |
|  |  Search: [ Search by ticket #, summary, description...          ] [ Clear ]     |  |
|  |  Category: [ All Categories v ]   System: [ All Systems v ]                     |  |
|  |  Priority: [ All Priorities v ]   Status: [ All Statuses v ]                    |  |
|  |  Sort By:  [ Newest Created First v ]                                            |  |
|  +---------------------------------------------------------------------------------+  |
|                                                                                       |
|  Showing 1 - 10 of 42 tickets                                                         |
|  +---------------------------------------------------------------------------------+  |
|  | Ticket #        Summary                  Category   System   Priority  Status   |  |
|  |---------------------------------------------------------------------------------|  |
|  | TKT-2026-00001  Cannot connect to VPN... Hardware   VPN      Medium    New      |  |
|  | TKT-2026-00002  Email sync failure on... Software   Email    High      New      |  |
|  +---------------------------------------------------------------------------------+  |
|                                                                                       |
|  Page Size: [ 10 v ]                 [ < Previous ]  1  [2]  3  4  5  [ Next > ]     |
+---------------------------------------------------------------------------------------+
```

### 8.2 Search, Filter, Sort & Pagination Controls
1. **Search Input (`q`):**
   - Text input with search icon and clear button (`x`).
   - Debounced by **300 ms** before dispatching the API request.
   - Searches case-insensitively across `ticketNumber`, `summary`, and `description`.
2. **Filter Controls:**
   - Dropdowns for `categoryId`, `relatedSystemId`, `requestedPriority` (`Low`, `Medium`, `High`, `Urgent`), and `currentStatus` (`New`).
   - Multiple filters combine with logical **AND**.
   - Changing any filter triggers an immediate fetch and **resets pagination to Page 1**.
3. **Sorting Control (`sortBy`):**
   - Dropdown options matching the approved API vocabulary:
     - `"Newest Created First"` (`newest`, default)
     - `"Oldest Created First"` (`oldest`)
     - `"Recently Updated First"` (`recentlyUpdated`)
     - `"Ticket Number (A-Z)"` (`ticketNumberAsc`)
   - Changing sort order triggers an immediate fetch and resets pagination to Page 1.
4. **Pagination Controls:**
   - Page selector buttons with current page highlight, `"Previous"`, and `"Next"` actions.
   - Page size dropdown: `10` (default), `20`, `50`.
   - Disabled states for Previous on Page 1 and Next on the final page.

### 8.3 Screen States
- **Loading State:** Table rows render placeholder loading indicators; controls remain interactive.
- **True Empty State:** Displayed when the requester owns 0 tickets in total:
  - Icon + Heading: *"No Tickets Found"*.
  - Body: *"You have not submitted any IT support tickets yet."*.
  - Primary Action: `[ + Create Ticket ]` button.
- **Query No-Results State:** Displayed when tickets exist but none match active filters/search:
  - Icon + Heading: *"No Matching Tickets"*.
  - Body: *"No tickets match your search and filter criteria."*.
  - Primary Action: `[ Clear Filters ]` button (resets all filter dropdowns and search input to default).
- **Failure State:** Error banner: *"Failed to load tickets. Please check your connection. [Retry]"*.

### 8.4 Responsive Views
- **Desktop ($\ge 992\text{px}$):** Structured data table showing Ticket #, Summary, Category, Related System, Requested Priority Badge, Status Badge, Attachment Count, and Creation Date.
- **Tablet / Mobile ($< 992\text{px}$):** Adapts into a responsive list of **Ticket Cards**, with prominent Ticket Number, Status pill, Summary snippet, and metadata tags, ensuring comfortable touch targets.

---

## 9. Feature-F: Requester Ticket Detail UI

### 9.1 Screen Layout & Structure (`/tickets/:ticketId`)
Ticket Detail presents complete read-only information for a submitted ticket and embeds attachment management controls.

```
+---------------------------------------------------------------------------------------+
|  <- Back to My Tickets                                                                |
|                                                                                       |
|  Ticket TKT-2026-00001                                            [ Status: New ]     |
|  Submitted on September 4, 2026, 10:30 PM                                             |
|                                                                                       |
|  +-- Ticket Overview --------------------------------------------------------------+  |
|  |  Requester:          Alice Developer (alice@kmutt.ac.th)                        |  |
|  |  Category:           Hardware                                                   |  |
|  |  Related System:     VPN                                                        |  |
|  |  Requested Priority: Medium                                                     |  |
|  +---------------------------------------------------------------------------------+  |
|                                                                                       |
|  +-- Problem Details --------------------------------------------------------------+  |
|  |  Summary:                                                                       |  |
|  |  Cannot connect to campus VPN from off-campus network                            |  |
|  |                                                                                 |  |
|  |  Description:                                                                   |  |
|  |  Every time I attempt to authenticate via GlobalProtect, the client displays    |  |
|  |  error 403. This started occurring yesterday morning after changing my password.|  |
|  +---------------------------------------------------------------------------------+  |
|                                                                                       |
|  +-- Attachments (Feature-G Section) ----------------------------------------------+  |
|  |  (See Section 10 for complete Attachment UI contract)                           |  |
|  +---------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------+
```

### 9.2 Read-Only Enforcement & Visual Cues
- All ticket header fields (Ticket Number, Ticket Date, Requester, Category, Related System, Requested Priority, Summary, Description, Status) are rendered as read-only text cards.
- Form inputs, editable textareas, and inline editing controls are strictly omitted.
- **Localized Date Display:** System-generated UTC timestamps are formatted in the user's local locale (e.g. `"September 4, 2026, 10:30 PM"`).
- If historical Category or Related System records are inactive, a subtle secondary badge `(Inactive)` is displayed beside the name without disabling the view.

### 9.3 Neutral Ticket Not Found State
- If the backend returns `404 Not Found` (which occurs identically for nonexistent tickets and tickets owned by other requesters):
  - The UI renders a neutral **Ticket Not Found** screen:
    - Heading: *"Ticket Not Found"*.
    - Body: *"The requested ticket does not exist or you do not have permission to view it."*.
    - Action: `[ <- Return to My Tickets ]`.
  - The UI never reveals whether the ticket exists for another requester.

---

## 10. Feature-G: Attachment Management UI

### 10.1 Placement & Capabilities
The Attachment UI is embedded within the Ticket Detail screen (`/tickets/:ticketId`) and provides full lifecycle support: uploading, metadata display, image preview, PDF viewing/downloading, and soft-removal with reason.

```
+-- Attachments (2 / 5 active) ---------------------------------------------------------+
|  Allowed formats: JPG, PNG, WEBP, PDF (Max 5 MB each)                                 |
|                                                                                       |
|  [ + Upload Attachment ]  or drag & drop files here                                   |
|                                                                                       |
|  Active Attachments:                                                                  |
|  +---------------------------------------------------------------------------------+  |
|  | [IMG] vpn_screenshot.png (1.0 MB)      Uploaded 15:32   [Preview] [Download] [X]|  |
|  | [PDF] error_log.pdf (200 KB)           Uploaded 15:40             [Download] [X]|  |
|  +---------------------------------------------------------------------------------+  |
|                                                                                       |
|  Removed Attachments (History):                                                       |
|  +---------------------------------------------------------------------------------+  |
|  | [TOMB] old_capture.png (500 KB) - Removed 15:34 by Requester                        |  |
|  | Reason: "Uploaded incorrect screenshot showing personal email"                   |  |
|  +---------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------+
```

### 10.2 File Selection, Validation & Mixed-Selection Logic
1. **File Input & Staging:** Accepts multi-file selection via file chooser or drop target.
2. **Client-Side Usability Checks:**
   - Checks file extensions (`.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`).
   - Checks file size ($\le 5\text{ MB} = 5,242,880\text{ bytes}$).
   - Checks active capacity ($C = 5 - \text{activeCount}$).
3. **Mixed Selection Feedback:**
   - If multiple files are selected and some violate constraints or exceed capacity, valid files up to capacity are accepted for upload, while invalid files display clear per-file error feedback:
     - *`"installer.exe"`: Unsupported format (allowed: JPG, PNG, WEBP, PDF).*
     - *`"video_dump.mp4"`: Unsupported format.*
     - *`"extra_doc.pdf"`: Rejected — maximum 5 active attachments limit reached.*
4. **Duplicate Original Filenames:** Permitted. The UI displays identical filenames cleanly while the backend manages unique UUID storage identities.

### 10.3 Preview, Open & Download Interactions
- **Image Preview (JPG, PNG, WEBP):**
  - Clicking `[Preview]` opens an accessible `ImagePreviewModal` displaying the full image loaded from `/api/v1/tickets/:ticketId/attachments/:attachmentId/download?inline=true`.
  - Includes a `"Close"` button and Escape key dismissibility.
- **PDF Behavior:**
  - Clicking `[Open / Download]` opens the PDF binary in a new browser tab (`target="_blank"`) or triggers direct download. Custom embedded PDF viewers are out of scope.
- **Direct Download:**
  - Clicking `[Download]` triggers file download via `/api/v1/tickets/:ticketId/attachments/:attachmentId/download?inline=false`.

### 10.4 Attachment Removal Flow (`ConfirmRemovalModal`)
1. User clicks the `[Remove]` / `[Delete]` button on an active attachment.
2. A confirmation modal opens:
   - Title: *"Remove Attachment"*.
   - Prompt: *"Are you sure you want to remove **vpn_screenshot.png**? This file will no longer be downloadable."*.
   - **Removal Reason Input:** Required textarea.
     - Validation: Trimmed length 1–200 characters. Whitespace-only is rejected.
     - Visual character counter (`0 / 200`).
     - Error message: *"Please provide a removal reason (1-200 characters)."*.
   - Actions: `[ Cancel ]` and `[ Confirm Removal ]` (`btn-danger`).
3. Upon confirmation:
   - Modal enters busy state (`"Removing..."`).
   - API call `DELETE /api/v1/tickets/:ticketId/attachments/:attachmentId` is dispatched.
   - On success, modal closes, active count decreases by 1, and the attachment immediately moves to the **Removed Attachments (History)** section.
   - The newly freed capacity allows uploading another file immediately.

### 10.5 Removed Attachment Tombstone Display
- Removed attachments are listed under a collapsible `"Removed Attachments (History)"` section.
- Displays original filename, secondary badge `[Removed]`, removal timestamp, and the recorded removal reason.
- Preview and Download actions are completely disabled/hidden.

---

## 11. UI State Matrix

| Screen / Component | Loading State | Empty State | No Results State | Validation State | Success State | Not Found State | Error / Failure State |
|---|---|---|---|---|---|---|---|
| **Requester Selection** | Indicator in dropdown | "No active requesters" alert | N/A | "Please select a requester" | Context set & redirect | N/A | Alert banner with [Retry] |
| **App Shell / Nav** | Shimmer badge | N/A | N/A | N/A | Active requester badge | N/A | Offline / sync banner |
| **Create Ticket** | Reference data loading indicators | "No categories available" warning | N/A | Field-level inline errors + summary | Redirect to Detail + toast | N/A | Alert banner (preserves input) |
| **My Tickets** | Table loading rows | "No tickets yet" + [Create Ticket] CTA | "No matches" + [Clear Filters] CTA | Invalid query alert | N/A | N/A | Alert banner with [Retry] |
| **Ticket Detail** | Card loading indicators | N/A | N/A | N/A | Loaded ticket cards | Neutral "Ticket not found" view | Alert banner with [Retry] |
| **Attachment Section** | Upload progress indicator | "No attachments" note | N/A | Inline per-file format/size errors | Upload success feedback | Neutral "Attachment not found" | Upload/delete failure alert |
| **Removal Modal** | "Removing..." spinner | N/A | N/A | Reason 1-200 char validation | Modal close + tombstone move | N/A | Removal error banner |

---

## 12. Responsive Design Contract

### 12.1 Breakpoints (Bootstrap 5 Standard)
In accordance with the System-Level SDS:
- **Mobile Viewport:** $< 768\text{px}$ (`xs`, `sm`)
- **Tablet Viewport:** $768\text{px} - 991\text{px}$ (`md`)
- **Desktop Viewport:** $\ge 992\text{px}$ (`lg`, `xl`, `xxl`)

### 12.2 Responsive Layout Adaptations
| Component / Region | Desktop Layout ($\ge 992\text{px}$) | Tablet Layout ($768\text{px} - 991\text{px}$) | Mobile Layout ($< 768\text{px}$) |
|---|---|---|---|
| **App Shell Header** | Horizontal bar: Logo, links, requester badge, switch button. | Horizontal bar: Condensed padding. | Collapsed hamburger menu; sticky brand & badge. |
| **My Tickets Query Bar** | Single-row inline flex: Search input, 4 filter dropdowns, sort dropdown. | 2-row grid: Search & Sort row 1, Filters row 2. | Stacked vertical controls; full-width dropdowns & search. |
| **My Tickets List** | Full tabular view (8 columns) with sortable headers. | Compact table or 2-column card grid. | Single-column stacked Ticket Cards with metadata tags. |
| **Create Ticket Form** | 2-column form grid for category/system/priority; full-width description. | 2-column form grid. | Single-column stacked fields; full-width inputs & submit button. |
| **Ticket Detail** | 2-column layout: Overview card (left), Description card (right). | Stacked cards with full container width. | Stacked cards with full container width; wrapped long text. |
| **Attachment Controls** | Side-by-side active attachments grid with action toolbars. | 2-column attachment cards. | Single-column attachment cards; full-width touch buttons. |

---

## 13. Accessibility Contract

### 13.1 Compliance Baseline & Guidelines
In accordance with the System-Level SDS (WCAG 2.2 AA target) and NFR-02:
- **Keyboard Operability:** All interactive controls (buttons, links, inputs, selects, radio buttons, modal dismissals) are operable via standard keyboard navigation (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Esc`).
- **Focus Visibility:** Interactive elements display clear, high-contrast keyboard focus indicators utilizing the approved KMUTT focus tokens (`#FA4616` / `#8A2608`). Unstyled outline suppression (`outline: none`) without replacement is strictly prohibited.
- **Form Association:** Every input and select control has an explicit `<label>` associated via `htmlFor`/`id`.
- **Validation Accessibility:** Invalid fields set `aria-invalid="true"` and reference their respective error messages using `aria-describedby`.
- **Color Independence:** Error, warning, priority, and status indicators pair color coding with textual labels and distinct icons (e.g., status pill displays text `"New"` alongside visual styling, not color alone).
- **ARIA Live Regions:** Dynamic loading states and asynchronous alert banners use `role="status"` or `role="alert"` with `aria-live="polite"` to inform assistive technologies of state updates.

---

## 14. API-to-UI Traceability Matrix

| API Endpoint (`api-spec.md`) | Consuming UI Component(s) | UI Actions & Workflows Supported |
|---|---|---|
| `GET /api/v1/development-requesters` | `RequesterSelectScreen` | Loads active requester options into the selection dropdown. |
| `GET /api/v1/categories` | `CategorySelect`, `FilterBar` | Populates active category choices in Create Ticket and My Tickets filter. |
| `GET /api/v1/related-systems` | `RelatedSystemSelect`, `FilterBar` | Populates active related system choices in Create Ticket and My Tickets filter. |
| `POST /api/v1/tickets` | `CreateTicketForm` | Submits new ticket payload with `clientRequestId` and transitions to Ticket Detail. |
| `GET /api/v1/tickets` | `MyTicketsScreen`, `TicketTable` | Fetches paginated, filtered, searched, and sorted ticket dataset. |
| `GET /api/v1/tickets/:ticketId` | `TicketDetailScreen` | Loads full read-only ticket details, dates, status, and attachment list. |
| `POST /api/v1/tickets/:ticketId/attachments` | `AttachmentUploadDropzone` | Uploads multipart files to an existing ticket with partial acceptance feedback. |
| `GET /api/v1/tickets/:ticketId/attachments/:id` | `ActiveAttachmentList` | Fetches metadata for specific active or removed attachment. |
| `GET /api/v1/tickets/:ticketId/attachments/:id/download` | `ImagePreviewModal`, `DownloadButton` | Streams binary for in-browser preview (`inline=true`) or download (`inline=false`). |
| `DELETE /api/v1/tickets/:ticketId/attachments/:id` | `AttachmentRemovalModal` | Submits removal reason and soft-removes attachment. |

---

## 15. Requirements-to-UI Traceability Matrix

### 15.1 Functional Requirements (FR) Traceability
| Requirement | Covered By UI Section | Summary of UI Enforcement |
|---|---|---|
| **FR-01, FR-02** | Section 4.2 | Development Requester Selection screen loading active requesters from API. |
| **FR-03, FR-04, FR-05, FR-06** | Section 4.3, 5.2 | Storing requester ID in `sessionStorage`, displaying badge in shell, and Change Requester flow. |
| **FR-07, FR-08, FR-09, FR-10, FR-11, FR-12, FR-13** | Section 7.1, 7.2 | Create Ticket form capturing fields, displaying read-only generated info, default Medium priority. |
| **FR-14, FR-15, FR-16** | Section 7.3, 7.4 | Disabled busy button, `clientRequestId` deduplication, form preservation on failure, success toast. |
| **FR-17, FR-18, FR-19, FR-20, FR-21** | Section 8.1, 8.2 | Scoped My Tickets view with debounced search, combined filters, fixed sorting, and 10/20/50 pagination. |
| **FR-22, FR-23** | Section 8.3 | Distinct True Empty state (with Create CTA) and Query No-Results state (with Clear CTA). |
| **FR-24, FR-25, FR-26, FR-27** | Section 9.1, 9.2, 9.3 | Read-only Ticket Detail view with neutral "Ticket Not Found" view for cross-requester access. |
| **FR-28, FR-29, FR-30, FR-31, FR-32, FR-33** | Section 10.1, 10.2 | Attachment upload supporting JPG/PNG/WEBP/PDF $\le$ 5 MB, max 5 active files, and mixed selection feedback. |
| **FR-34, FR-35, FR-36** | Section 10.3 | In-browser modal image preview, PDF open/download, and direct download actions. |
| **FR-37, FR-38, FR-39, FR-40, FR-41** | Section 10.4, 10.5 | Confirmation modal with 1–200 char reason, soft-removal tombstone display, and capacity recalculation. |
| **FR-42, FR-43** | Section 6.1, 6.2 | Active reference data for selection; historical inactive badges on existing tickets. |
| **FR-44, FR-45, FR-46, FR-47, FR-48** | Section 5, 11, 12, 13 | App shell navigation, standardized loading/error states, responsive breakpoints, accessibility baseline. |

### 15.2 Business Rules (BR) Traceability
| Business Rule | Covered By UI Section | Summary of UI Enforcement |
|---|---|---|
| **BR-01, BR-02, BR-09, BR-10** | Section 7.1, 9.1 | System-generated Ticket Number and localized Ticket Date displayed as read-only; frontend never calculates them. |
| **BR-03, BR-19** | Section 7.1, 8.2 | Initial status `New` displayed and filterable in My Tickets. |
| **BR-04, BR-05, BR-06, BR-41** | Section 4.1, 4.2, 4.3 | Testing identity disclaimer, active requester validation, and context clearing on inactive requester. |
| **BR-07, BR-08, BR-18, BR-23** | Section 4.3, 8.1, 9.1 | Ticket ownership boundaries respected; changing requester reloads dataset. |
| **BR-11, BR-12** | Section 7.2 | `Low`, `Medium`, `High`, `Urgent` priority options with `Medium` default. |
| **BR-13, BR-14, BR-15** | Section 7.2 | Summary (5-120 chars) and Description (10-2000 chars) trimmed length validation. |
| **BR-16, BR-17** | Section 7.3, 7.4 | Submit button busy state, client-side idempotency tracking, form preservation on failure. |
| **BR-20, BR-21, BR-22, BR-40** | Section 8.2, 8.3 | Case-insensitive search across 3 fields, combined filter logic, page 1 reset, distinct empty/no-results states. |
| **BR-24, BR-27** | Section 9.3 | Neutral 404 Ticket Not Found view preventing cross-requester resource enumeration. |
| **BR-25, BR-26** | Section 9.1, 9.2 | Submitted ticket fields are strictly read-only; no edit controls rendered. |
| **BR-26, BR-27, BR-28, BR-29, BR-30** | Section 10.2 | Permitted file types, 5 MB size cap, 5 active file cap, tombstones excluded from cap, duplicate filenames allowed. |
| **BR-31, BR-32, BR-33, BR-34, BR-35** | Section 10.4, 10.5 | Removal confirmation, 1-200 char reason, tombstone list, removed binary unavailable. |
| **BR-36, BR-37** | Section 7.4, 10.2 | Ticket persists if attachment fails; valid files accepted in mixed selections. |
| **BR-38, BR-39** | Section 6.1, 6.2 | Active reference data in selects; historical inactive badges in Detail view. |

---

## 16. Out-of-Scope UI Behaviors

The following features are explicitly excluded from Lab 2 and must not be implemented:
1. **Real Authentication & Login Forms:** No password fields, user registration, JWT token storage, or logout workflows.
2. **IT Staff Workflows:** No ticket queue assignment, IT Priority overrides, internal notes, actions taken, or public comment threads.
3. **Ticket Status Changes:** No buttons or controls for resolving, closing, reopening, or cancelling tickets (all tickets remain `New`).
4. **Requester Ticket Editing:** No edit forms or inline editing for summary, description, category, or priority after submission.
5. **Admin Reference Data Management:** No screens for creating, editing, or deleting Categories or Related Systems.
6. **Custom PDF Viewer:** PDF attachments use standard browser open/download behavior; no custom canvas PDF rendering component.

---

## 17. UI Contract Completion Checklist

- [x] All 7 approved Features (Feature-A through Feature-G) have comprehensive UI specification.
- [x] Approved KMUTT theme visual tokens (`#FA4616`, `#FFC72C`, `#7B8189`, `#8A2608`, `#1F2937`, `#5B6573`, `#FFFFFF`, `#2E7D32`, `#B3261E`) applied without Zen Green contradiction.
- [x] UI field names, character boundaries, and validation rules match `specification.md` and `api-spec.md`.
- [x] Tab-scoped `sessionStorage` requester ID persistence and switching workflows fully detailed.
- [x] Create Ticket form, read-only system fields, busy submit button, and `clientRequestId` idempotency covered.
- [x] My Tickets search (300 ms debounce), combined filters, deterministic sorting, and pagination specified.
- [x] True Empty state and Query No-Results state clearly distinguished with respective CTAs.
- [x] Read-only Ticket Detail view, localized date display, and neutral 404 Not Found anti-enumeration screen detailed.
- [x] Attachment upload, 5 MB limit, 5 active file cap, mixed selection, image preview modal, and PDF behavior specified.
- [x] Attachment soft-removal modal with required 1–200 char reason and tombstone history list defined.
- [x] Comprehensive UI State Matrix and Responsive Design Breakpoint Contract included.
- [x] Full accessibility baseline (keyboard navigation, focus visibility, ARIA labels, color independence) documented.
- [x] Complete API-to-UI and Requirements-to-UI traceability matrices provided.
- [x] Scope boundaries strictly maintained (no Lab 3 auth, staff queues, status changes, or ticket editing).

---

## 18. Final UI Design Decisions

The following UI design and presentation decisions have been reviewed and finalized for Lab 2:

1. **Client-Side URL Route Structure:**
   - *Affected Features:* Feature-A, Feature-B, Feature-D, Feature-E, Feature-F.
   - *Proposed Routes:* `/requester-select` (Requester Selection), `/tickets` (My Tickets landing), `/tickets/new` (Create Ticket), `/tickets/:ticketId` (Ticket Detail).
   - *Rationale:* Establishes a clean RESTful routing hierarchy for React Router while keeping deep links bookmarkable within an active tab session.
2. **Mobile My Tickets View Adaptation:**
   - *Affected Feature:* Feature-E (My Tickets).
   - *Proposed Choice:* Transform the wide 8-column desktop table into a stacked card list on mobile/tablet viewports ($< 992\text{px}$).
   - *Rationale:* Avoids horizontal scrolling on mobile screens and ensures comfortable touch target sizing.
3. **Image Preview Presentation:**
   - *Affected Feature:* Feature-G (Attachment Management).
   - *Proposed Choice:* Render image previews (JPG, PNG, WEBP) in an accessible Bootstrap modal dialog (`ImagePreviewModal`) rather than navigating away to a raw image URL.
   - *Rationale:* Keeps the user inside their ticket context and provides a smoother review workflow.
4. **Historical Inactive Reference Indicator:**
   - *Affected Feature:* Feature-C, Feature-F.
   - *Proposed Choice:* Display a subtle secondary pill badge `[Category Name] (Inactive)` in Ticket Detail when `category.isActive === false`.
   - *Rationale:* Clearly indicates historical reference status without alarming the user or breaking the layout.
5. **Real-Time Character Count Indicators:**
   - *Affected Features:* Feature-D (Create Ticket), Feature-G (Attachment Removal).
   - *Proposed Choice:* Provide dynamic visual character count indicators (`current / max`) on Ticket Summary (5–120), Description (10–2000), and Removal Reason (1–200).
   - *Rationale:* Enhances user form usability and prevents unexpected submission rejections.
6. **Change Requester Confirmation Dialog:**
   - *Affected Feature:* Feature-A, Feature-B.
   - *Proposed Choice:* Prompt the user with a confirmation modal before clearing requester context to prevent accidental loss of in-progress Create Ticket inputs.
   - *Rationale:* Prevents accidental data loss while enforcing clean requester-context switching.
7. **Drag-and-Drop Attachment Staging:**
   - *Affected Feature:* Feature-G (Attachment Management).
   - *Proposed Choice:* Provide a drag-and-drop file target as an optional usability convenience alongside standard file input button.
   - *Rationale:* Standard modern file upload UX convenience.
