# Feature: BetterBond Commission Payments POC

## Problem Statement

BetterBond needs a visual and functional preview of a commission payments management system for real estate agencies. Operators must be able to view payment statuses, manage individual and bulk payments (including parking/unparking), initiate payment batches, and access generated invoice PDFs — all scoped to South African formatting conventions and a BFF-based authentication model.

## User Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| User/Operator | An authenticated operator managing commission payments for one or more agencies | View dashboard metrics; view and filter payment grids; park/unpark individual and bulk payments; initiate payment batches; download invoice PDFs |
| System Admin | An authenticated administrator responsible for demo environment management | All Operator permissions plus access to the Admin page and the ability to reset demo data |

## Functional Requirements

### Authentication

- **R1:** When an unauthenticated user navigates to any page, the application immediately redirects them to `http://localhost:5120/auth/login` with no intermediate landing page shown.
- **R2:** On successful login, the BFF sets an HTTP-only session cookie; the frontend never receives, stores, or inspects OIDC tokens.
- **R3:** The application calls `GET http://localhost:5120/auth/me` on startup to retrieve the authenticated user's identity (name, role); if the call returns 401 the user is redirected to the BFF login endpoint.
- **R4:** A "Log out" control is accessible from the application header; clicking it calls `GET http://localhost:5120/auth/logout` and then redirects the browser to the BFF login endpoint.

### Dashboard Screen (Screen 1)

- **R5:** The Dashboard screen displays the following metric components, each dynamically filtered when an agency row is selected: Payments Ready for Payment bar chart (split by Commission Type: "Bond Comm" and "Manual Payments"); Parked Payments bar chart (split by Commission Type); Total Value Ready for Payment; Total Value of Parked Payments; Parked Payments Aging Report (bar chart with ranges: "1–3 Days", "4–7 Days", ">7 Days"); Total Value of Payments Made (Last 14 Days).
- **R6:** Dashboard data is fetched from `GET /v1/payments/dashboard` (base URL `http://localhost:8042`). The response schema (`PaymentsDashboardRead`) includes `PaymentStatusReport`, `ParkedPaymentsAgingReport`, `TotalPaymentCountInLast14Days`, and `PaymentsByAgency`.
- **R7:** The Dashboard screen displays an Agency Summary grid with columns: Agency Name, Number of Payments (ready for payment, not parked), Total Commission Amount, VAT.
- **R8:** Each row in the Agency Summary grid has a button that, when clicked, navigates to the Payment Management screen pre-filtered to that agency.
- **R9:** Selecting an agency row in the Agency Summary grid dynamically updates all dashboard metric components to reflect that agency's data only; deselecting or selecting a different agency updates the metrics accordingly.
- **R10:** All currency values on the Dashboard are formatted using en-ZA locale: `R 1 234,56` (thousands separator = non-breaking space, decimal separator = comma).

### Payment Management Screen (Screen 2)

- **R11:** The Payment Management screen displays two grids: a **Main Grid** (payments ready for payout, not parked) and a **Parked Grid** (payments in parked state), both filtered by the currently selected agency.
- **R12:** The Main Grid and Parked Grid each display the following columns: Agency Name, Batch ID, Claim Date, Agent Name & Surname, Bond Amount, Commission Type, Commission %, Grant Date, Reg Date, Bank, Commission Amount, VAT, Status.
- **R13:** The Payment Management screen provides a search/filter bar that filters the grid by Claim Date, Agency Name, and Status. Filter state is persisted in the URL as query parameters so that filtered views are bookmarkable and shareable.
- **R14:** Payments data is fetched from `GET /v1/payments` with optional query parameters `ClaimDate`, `AgencyName`, and `Status` (base URL `http://localhost:8042`). The response schema is `PaymentReadList`.
- **R15:** The Main Grid shows payments where `PaymentState` is `Ready` (and `Status` is `REG` or `MAN-PAY`); the Parked Grid shows payments where `PaymentState` is `Parked`. The routing of a payment to the correct grid is determined by the combination of `Status` (REG, MAN-PAY) and `PaymentState` (Ready, Parked, Processed).
- **R16:** Each row in the Main Grid includes a "Park" button. Clicking it displays a confirmation modal showing: Agent Name, Claim Date, Commission Amount, and the message "Are you sure you want to park this payment?". On confirmation, the application calls `PUT /v1/payments/park` with `{ PaymentIds: [id] }` and moves the row to the Parked Grid.
- **R17:** The Main Grid supports multi-select via row checkboxes. A "Park Selected" button, visible when at least one row is selected, opens a confirmation modal showing: number of selected payments and total combined Commission Amount. On confirmation, the application calls `PUT /v1/payments/park` with the array of selected payment IDs and moves the rows to the Parked Grid.
- **R18:** Each row in the Parked Grid includes an "Unpark" button. Clicking it displays a confirmation modal mirroring the park flow (Agent Name, Claim Date, Commission Amount, "Are you sure you want to unpark this payment?"). On confirmation, the application calls `PUT /v1/payments/unpark` with `{ PaymentIds: [id] }` and moves the row back to the Main Grid.
- **R19:** The Parked Grid supports multi-select via row checkboxes. An "Unpark Selected" button, visible when at least one parked row is selected, opens a confirmation modal showing: number of selected payments and total combined Commission Amount. On confirmation, the application calls `PUT /v1/payments/unpark` with the array of selected IDs and moves the rows back to the Main Grid.
- **R20:** An "Initiate Payment" button is displayed above the Main Grid. Clicking it opens a confirmation modal summarising the number of payments and total value of all items in the Main Grid. On confirmation, the application calls `POST /v1/payment-batches` (with `{ PaymentIds: [...] }` and `LastChangedUser` header set to the authenticated user's name). On success, a success modal confirms that the payment batch has been processed, and the processed payments are removed from the Main Grid.
- **R21:** After a successful payment batch is created via `POST /v1/payment-batches`, the backend automatically generates an invoice for the agency. The invoice becomes accessible in the Payments Made screen. The frontend does not separately call an invoice-generation endpoint.
- **R22:** All currency values on the Payment Management screen are formatted using en-ZA locale: `R 1 234,56`.

### Payments Made Screen (Screen 3)

- **R23:** The Payments Made screen displays a grid of processed payment batches grouped by agency, with columns: Agency Name, Number of Payments, Total Commission Amount, VAT, Invoice Link.
- **R24:** Payment batches data is fetched from `GET /v1/payment-batches` with optional query parameters `Reference` and `AgencyName`. The response schema is `PaymentBatchReadList`.
- **R25:** The Payments Made screen provides a search/filter bar that filters by Agency Name and Batch ID (Reference). Filter state is persisted in the URL as query parameters.
- **R26:** The Invoice Link column displays a clickable link or button per row. Clicking it calls `POST /v1/payment-batches/{Id}/download-invoice-pdf` and opens/downloads the returned PDF binary (`application/octet-stream`).
- **R27:** All currency values on the Payments Made screen are formatted using en-ZA locale: `R 1 234,56`.

### Admin Screen

- **R28:** Users with the System Admin role can access an Admin page (e.g., `/admin`) via a navigation link visible only to that role.
- **R29:** The Admin page displays a "Reset Demo" button. Clicking it triggers a confirmation prompt, and on confirmation, calls `POST /demo/reset-demo`. On success, a toast notification confirms the reset; on failure, a dismissible toast notification describes the error.

### Loading States and Error Handling

- **R30:** All data-fetching operations (API calls) display skeleton loaders that match the layout of the component being loaded while awaiting a response.
- **R31:** When any API call returns an error (non-2xx response or network failure), the application displays a dismissible toast notification describing the failure. The failed UI component remains visible in its last known state or displays an empty state.

## Business Rules

- **BR1:** A payment is displayed in the Main Grid (ready for payout) when its `PaymentState` is `Ready` and its `Status` is either `REG` (regular bond commission) or `MAN-PAY` (manual payment).
- **BR2:** A payment is displayed in the Parked Grid when its `PaymentState` is `Parked`. Parked payments do not appear in the Main Grid.
- **BR3:** A payment with `PaymentState` of `Processed` is excluded from both the Main Grid and the Parked Grid; it appears only in the Payments Made screen (via its associated payment batch).
- **BR4:** Only payments currently in the Main Grid (PaymentState = Ready) can be parked; payments in the Parked Grid or already Processed cannot be parked again.
- **BR5:** Only payments in the Parked Grid (PaymentState = Parked) can be unparked; unpacking returns them to the Main Grid with PaymentState = Ready.
- **BR6:** The "Initiate Payment" action includes all payments currently in the Main Grid for the selected agency — there is no partial selection for batch initiation (bulk park/unpark is separate from batch initiation).
- **BR7:** The `POST /v1/payment-batches` request must include the `LastChangedUser` header containing the authenticated user's name; the frontend reads this name from the BFF `/auth/me` response.
- **BR8:** The `BatchId` field on a payment record (integer) is distinct from the `Reference` field (string, e.g., "BB202511-391"); they are separate identifiers for the same batch and must not be conflated in the UI.
- **BR9:** No actual bank disbursements occur as a result of initiating a payment batch. The system records the batch and generates an invoice, but no real money transfers are made.
- **BR10:** All monetary values are displayed in South African Rand using en-ZA locale formatting: `R 1 234,56` (space as thousands separator, comma as decimal separator). The currency symbol `R` is prefixed with a space before the number.
- **BR11:** The Parked Payments Aging Report groups parked payments into three ranges based on how many days they have been parked: "1–3 Days", "4–7 Days", ">7 Days".
- **BR12:** Dashboard metric components (charts, totals) reflect all agencies when no agency row is selected; they update dynamically to reflect only the selected agency's data when a row is selected.
- **BR13:** Invoice PDFs are generated server-side after payment batch creation. The frontend retrieves them on demand via `POST /v1/payment-batches/{Id}/download-invoice-pdf`; the frontend does not generate PDFs.
- **BR14:** Unauthenticated requests to the BFF (`/auth/me` returning 401) redirect the user to the BFF login endpoint (`http://localhost:5120/auth/login`). The frontend does not display a custom login or landing page.
- **BR15:** The Admin page and "Reset Demo" functionality are accessible only to users with the System Admin role. Users with the Operator role who navigate to `/admin` are redirected to the Dashboard.
- **BR16:** Audit logging is in scope for this system; the `LastChangedUser` and `LastChangedDate` fields on payment records are managed by the backend when actions are performed.

## Data Model

| Entity | Key Fields | Relationships |
|--------|-----------|---------------|
| Payment | Id (integer), Reference (string), AgencyName, ClaimDate, AgentName, AgentSurname, BondAmount, CommissionType, CommissionPct (from dataset), GrantDate, RegistrationDate, Bank, CommissionAmount, VAT, Status (REG / MAN-PAY), BatchId (integer, FK to PaymentBatch), PaymentState (Ready / Parked / Processed), LastChangedUser, LastChangedDate | Belongs to Agency (by AgencyName); may belong to PaymentBatch (BatchId); generates Invoice (via batch) |
| PaymentBatch | Id (integer), Reference (string, e.g., "BB202511-391"), AgencyName, CreatedDate, Status, LastChangedUser, PaymentCount, TotalCommissionAmount, TotalVat | Has many Payments; belongs to Agency (by AgencyName); has one Invoice PDF |
| Agency | AgencyName, AddressLine1, AddressLine2, AddressLine3, PostalCode, BankAccountNumber, BranchName, BranchCode, BankName, VATNumber | Has many Agents; has many Payments; has many PaymentBatches |
| Agent | AgentFullName (= AgentName + AgentSurname), AgencyName | Belongs to Agency |
| Dashboard | PaymentStatusReport (array of PaymentStatusReportItem), ParkedPaymentsAgingReport (array of ParkedPaymentsAgingReportItem), TotalPaymentCountInLast14Days, PaymentsByAgency | Derived/read-only; aggregates Payment data |
| PaymentStatusReportItem | Status, PaymentCount, TotalPaymentAmount, CommissionType, AgencyName | Part of Dashboard |
| ParkedPaymentsAgingReportItem | Range (string), AgencyName, PaymentCount | Part of Dashboard |
| PaymentsByAgencyReportItem | AgencyName, PaymentCount, TotalCommissionCount, Vat | Part of Dashboard |

## Key Workflows

### 1. Authenticated Access

1. User navigates to the application.
2. Application calls `GET /auth/me` on the BFF.
3. If the response is 401, the browser is redirected to `http://localhost:5120/auth/login`.
4. After successful OIDC login, the BFF sets an HTTP-only session cookie and redirects back to the application.
5. Application calls `GET /auth/me` again; on success, stores the user identity (name, role) in application state and renders the appropriate home screen (Dashboard).

### 2. View Dashboard

1. User arrives on the Dashboard screen (authenticated).
2. Application calls `GET /v1/payments/dashboard`.
3. Skeleton loaders are shown while the request is in flight.
4. On success, all metric components (bar charts, totals, aging report) and the Agency Summary grid render with all-agency data.
5. User clicks a row in the Agency Summary grid.
6. Dashboard metrics update to show data for the selected agency only.
7. Clicking the row's navigation button routes the user to the Payment Management screen filtered to that agency.

### 3. Park a Single Payment

1. User is on the Payment Management screen for a specific agency.
2. User clicks "Park" on a row in the Main Grid.
3. A confirmation modal appears: Agent Name, Claim Date, Commission Amount, and "Are you sure you want to park this payment?".
4. User clicks "Confirm".
5. Application calls `PUT /v1/payments/park` with `{ PaymentIds: [id] }`.
6. On success, the row disappears from the Main Grid and appears in the Parked Grid.
7. On API error, the modal closes and a dismissible toast notification describes the failure; the row remains in the Main Grid.

### 4. Park Multiple Payments (Bulk)

1. User selects one or more rows in the Main Grid via checkboxes.
2. User clicks "Park Selected".
3. A confirmation modal appears showing the number of selected payments and total combined Commission Amount.
4. User clicks "Confirm".
5. Application calls `PUT /v1/payments/park` with the array of selected IDs.
6. On success, selected rows move to the Parked Grid.
7. On API error, modal closes and a dismissible toast notification describes the failure.

### 5. Unpark a Payment (Single or Bulk)

1. User clicks "Unpark" on a row (or selects rows and clicks "Unpark Selected") in the Parked Grid.
2. A confirmation modal appears mirroring the park flow.
3. User clicks "Confirm".
4. Application calls `PUT /v1/payments/unpark` with the relevant payment ID(s).
5. On success, rows move back to the Main Grid.
6. On API error, modal closes and a toast notification describes the failure.

### 6. Initiate Payment Batch

1. User is on the Payment Management screen with payments in the Main Grid.
2. User clicks "Initiate Payment".
3. A confirmation modal appears showing: number of payments and total value.
4. User clicks "Confirm".
5. Application calls `POST /v1/payment-batches` with all Main Grid payment IDs and the `LastChangedUser` header.
6. On success:
   a. A success modal confirms the payment batch has been processed.
   b. The processed payments are removed from the Main Grid.
   c. The backend generates an invoice for the agency (no separate frontend call).
7. On API error, a dismissible toast notification describes the failure; the Main Grid is unchanged.

### 7. Download Invoice PDF

1. User navigates to the Payments Made screen.
2. Application calls `GET /v1/payment-batches` to load processed payment batches.
3. User locates the desired batch row and clicks the Invoice Link.
4. Application calls `POST /v1/payment-batches/{Id}/download-invoice-pdf`.
5. The returned `application/octet-stream` binary is opened or downloaded by the browser as a PDF.
6. On API error, a dismissible toast notification describes the failure.

### 8. Reset Demo Data (Admin)

1. System Admin navigates to `/admin`.
2. Admin page displays a "Reset Demo" button.
3. Admin clicks "Reset Demo".
4. A confirmation prompt appears.
5. Admin confirms.
6. Application calls `POST /demo/reset-demo`.
7. On success, a toast notification confirms the reset is in progress.
8. On API error, a dismissible toast notification describes the failure.

## Non-Functional Requirements

- **NFR1:** The application must be fully responsive across desktop, tablet, and mobile screen sizes.
- **NFR2:** The application must function correctly in modern browsers: Chrome (latest), Edge (latest), Safari (latest), Firefox (latest).
- **NFR3:** All currency values must use en-ZA locale formatting throughout the application (`R 1 234,56`).
- **NFR4:** The application locale is South African English (en-ZA) only; multi-region and multi-language support are not required.
- **NFR5:** All data-fetching operations must display skeleton loaders that match the layout of the component being loaded.
- **NFR6:** Filter and search state on Payment Management and Payments Made screens must be persisted in the URL as query parameters to support bookmarking and sharing.
- **NFR7:** API errors must surface as dismissible toast notifications; they must not result in blank screens or silent failures.
- **NFR8:** The API base URL is `http://localhost:8042`; the BFF base URL is `http://localhost:5120`. These are the authoritative addresses for all API calls.
- **NFR9:** The frontend must never store, log, or transmit OIDC tokens; authentication state is managed exclusively via HTTP-only session cookies set by the BFF.
- **NFR10:** Accessibility: interactive elements (buttons, links, form inputs) must have accessible labels; color is not the sole indicator of state.

## Out of Scope

- Actual bank disbursements — payment batches are created and invoices generated, but no real money transfers occur.
- User administration (creating, editing, or deactivating users) — this is a backend/IdP concern.
- Multi-region or multi-language support — South African en-ZA only.
- A custom login or landing page — authentication is handled entirely by the BFF OIDC flow.
- Mobile native apps — web only (responsive).
- Real-time data push (websockets, SSE) — data is fetched on page load and on user action.
- Email or SMS notifications.

## Source Traceability

| ID | Source | Reference |
|----|--------|-----------|
| R1 | User input | Clarifying question: "How should unauthenticated users be handled — redirect or landing page?" |
| R2 | intake-manifest.json | `requirements.authentication.description` — BFF pattern, HTTP-only cookies, no token management on frontend |
| R3 | intake-manifest.json | `requirements.authentication.bffEndpoints.userinfo` |
| R4 | intake-manifest.json | `requirements.authentication.bffEndpoints.logout` |
| R5 | BetterBond-Commission-Payments-POC-002.md | Screen 1: Dashboard Components section |
| R6 | Api Definition.yaml | `GET /v1/payments/dashboard`, `PaymentsDashboardRead` schema |
| R7 | BetterBond-Commission-Payments-POC-002.md | Screen 1: Dashboard Grid (Agency Summary) — Grid Fields |
| R8 | BetterBond-Commission-Payments-POC-002.md | Screen 1: Dashboard Grid — Behaviour, "navigates to Screen 2 for that specific agency" |
| R9 | BetterBond-Commission-Payments-POC-002.md | Screen 1: Dashboard Grid — Behaviour, "Selecting a record dynamically updates the dashboard graphs" |
| R10 | dataset.md | Currency Formatting note; intake-manifest.json `requirements.localization.currencyFormat` |
| R11 | BetterBond-Commission-Payments-POC-002.md | Screen 2: Purpose and Main Grid / Parked Grid sections |
| R12 | BetterBond-Commission-Payments-POC-002.md | Screen 2: Main Grid — Columns; Parked Grid — "Fields: identical to Main Grid" |
| R13 | BetterBond-Commission-Payments-POC-002.md | Screen 2: Functional Requirements — Search Bar; User input: "Filter/search state persisted in URL as query params" |
| R14 | Api Definition.yaml | `GET /v1/payments`, `PaymentReadList` schema, query params ClaimDate/AgencyName/Status |
| R15 | BetterBond-Commission-Payments-POC-002.md | Screen 2: Main Grid / Parked Grid; User input: "Payment screen routing uses BOTH Status AND PaymentState combined" |
| R16 | BetterBond-Commission-Payments-POC-002.md | Screen 2: Single Payment Parking; Api Definition.yaml `PUT /v1/payments/park` |
| R17 | BetterBond-Commission-Payments-POC-002.md | Screen 2: Bulk Parking; Api Definition.yaml `PUT /v1/payments/park` |
| R18 | BetterBond-Commission-Payments-POC-002.md | Screen 2: Parked Grid — "Unpark" individual; Api Definition.yaml `PUT /v1/payments/unpark` |
| R19 | BetterBond-Commission-Payments-POC-002.md | Screen 2: Parked Grid — unpark multiple; Api Definition.yaml `PUT /v1/payments/unpark` |
| R20 | BetterBond-Commission-Payments-POC-002.md | Screen 2: Initiate Payment; Api Definition.yaml `POST /v1/payment-batches` |
| R21 | BetterBond-Commission-Payments-POC-002.md | Screen 2: Invoice Generation — "System automatically generates an invoice" |
| R22 | dataset.md | Currency Formatting note; intake-manifest.json `requirements.localization.currencyFormat` |
| R23 | BetterBond-Commission-Payments-POC-002.md | Screen 3: Main Grid — Fields |
| R24 | Api Definition.yaml | `GET /v1/payment-batches`, `PaymentBatchReadList` schema |
| R25 | BetterBond-Commission-Payments-POC-002.md | Screen 3: Functional Requirements — "Search bar for filtering by Agency Name or Batch ID"; User input: URL query params |
| R26 | BetterBond-Commission-Payments-POC-002.md | Screen 3: "Clickable invoice link to open/download invoice"; Api Definition.yaml `POST /v1/payment-batches/{Id}/download-invoice-pdf` |
| R27 | dataset.md | Currency Formatting note; intake-manifest.json `requirements.localization.currencyFormat` |
| R28 | User input | Clarifying question: "Does the System Admin role need a UI?" — "Add a simple admin page" |
| R29 | User input | Clarifying question: "Does the System Admin role need a UI?" — "Reset Demo button"; Api Definition.yaml `POST /demo/reset-demo` |
| R30 | User input | Clarifying question: "What should happen during loading?" — "Skeleton loaders matching the layout" |
| R31 | User input | Clarifying question: "How should API errors be surfaced?" — "Toast notifications (dismissible)" |
| BR1 | User input | Clarifying question: "How does payment screen routing work?" — "Uses BOTH Status (REG, MAN-PAY) AND PaymentState (Ready, Parked, Processed) combined" |
| BR2 | BetterBond-Commission-Payments-POC-002.md | Screen 2: Parked Grid — payments in a parked state |
| BR3 | BetterBond-Commission-Payments-POC-002.md | Screen 2: Initiate Payment — "Processed payments are removed from the Main Grid"; Screen 3 purpose |
| BR4 | BetterBond-Commission-Payments-POC-002.md | Screen 2: Parking Payments — only Main Grid payments can be parked |
| BR5 | BetterBond-Commission-Payments-POC-002.md | Screen 2: Parked Grid — "On confirmation, items return to the Main Grid" |
| BR6 | BetterBond-Commission-Payments-POC-002.md | Screen 2: Initiate Payment — "initiates the payment process for all payments in the Main Grid" |
| BR7 | Api Definition.yaml | `POST /v1/payment-batches` — `LastChangedUser` header required |
| BR8 | User input | Clarifying question: "Are Reference and BatchId the same field?" — "They are separate fields" |
| BR9 | User input | Out of Scope clarification — "Actual bank disbursements... no real money transfers" |
| BR10 | dataset.md | Currency Formatting note; intake-manifest.json `requirements.localization.currencyFormat` — "R 1 234,56" |
| BR11 | BetterBond-Commission-Payments-POC-002.md | Screen 1: Parked Payments Aging Report — "1-3, 4-7, and >7 Days" |
| BR12 | BetterBond-Commission-Payments-POC-002.md | Screen 1: Dashboard Grid — Behaviour, "Selecting a record dynamically updates the dashboard graphs" |
| BR13 | BetterBond-Commission-Payments-POC-002.md | Screen 2: Invoice Generation — "System automatically generates an invoice"; Api Definition.yaml `POST /v1/payment-batches/{Id}/download-invoice-pdf` |
| BR14 | User input | Clarifying question: "How should unauthenticated users be handled?" — "auto-redirect to BFF login endpoint, no landing page" |
| BR15 | User input | Clarifying question: "Does the System Admin role need a UI?" — "add a simple admin page"; role-based access |
| BR16 | User input | Out of Scope clarification — "audit logging is NOT out of scope"; Api Definition.yaml `PaymentRead` — LastChangedUser, LastChangedDate |
| NFR1 | User input | Clarifying question: "What browser/device support is required?" — "Full responsive (desktop, tablet, mobile)" |
| NFR2 | User input | Clarifying question: "What browser/device support is required?" — "Modern browsers (Chrome, Edge, Safari, Firefox)" |
| NFR3 | dataset.md | Currency Formatting note; intake-manifest.json `requirements.localization.currencyFormat` |
| NFR4 | intake-manifest.json | `requirements.localization.multiRegionSupport: false`, `primaryLocale: "en-ZA"` |
| NFR5 | User input | Clarifying question: "What should loading states look like?" — "Skeleton loaders matching the layout" |
| NFR6 | User input | Clarifying question: "Should filter/search state persist across navigation?" — "Persisted in URL as query params (bookmarkable/shareable)" |
| NFR7 | User input | Clarifying question: "How should API errors be surfaced?" — "Toast notifications (dismissible)" |
| NFR8 | intake-manifest.json | `artifacts.apiSpec.baseUrl: "http://localhost:8042"`; `requirements.authentication.bffEndpoints` |
| NFR9 | intake-manifest.json | `requirements.authentication.description` — "Frontend never sees OIDC tokens" |
| NFR10 | BetterBond-Commission-Payments-POC-002.md | General UI requirements; standard accessibility baseline |
