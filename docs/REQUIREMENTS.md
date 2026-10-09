# AQ Companies Logistics & Financial Management System
## Functional and Non-Functional Requirements Document

### 1. System Overview
The **AQ Companies Logistics & Financial Management System** is a unified, multi-user enterprise platform deployed as both a responsive web application and a cross-platform desktop application. Both clients interact with a single authenticated backend and database.

The system replaces manual Excel spreadsheets (`AQ_Companies_System_v10_Logistics.xlsx`) with an auditable, relational system for:
- Corporate freight logistics and container tracking.
- Proforma invoice issuance, tracking, and immutable document archival.
- Dual-entity financial ledger management (Operating entity: Sky Ariana Ltd, Brand: AQ Companies).
- Payment receipt, invoice allocation, and discrepancy tracking.
- Bank statement reconciliation with corrected running balance formulas.
- Secure, access-controlled banking details with audit trails.

---

### 2. Functional Requirements (FR)

#### FR-1: Authentication & Authorization (RBAC)
- **FR-1.1**: Secure user authentication via email and salted hash passwords (Argon2 / bcrypt) with JWT session tokens.
- **FR-1.2**: Role-Based Access Control (RBAC) with granular permissions:
  - `ADMIN`: Full administrative control, user management, audit logs, system configurations.
  - `FINANCE_MANAGER`: Manage invoices, payments, allocations, ledger entries, bank details, and financial reports.
  - `LOGISTICS_COORDINATOR`: Manage freight shipments, container status, carriers, and view linked invoices.
  - `AUDITOR`: Read-only access to all financial data, audit logs, reconciliation reports, and change history.
  - `VIEWER`: Read-only dashboard access with masked banking details.
- **FR-1.3**: Server-side authorization enforced on every REST API route. UI visibility toggles are strictly UX aids, not security boundaries.

#### FR-2: Customer & Counterparty Management
- **FR-2.1**: Master records for buyers/consignees (e.g., *G.T JAYANTI AGROCHEM INDIA PVT LTD*, *G.T INDIA PVT LTD*, *MANIK TRADERS*, *SPDC BITES LLP*) and payment payees (*Hayatullah Noori*, *Sodiqjon Aminov*, *NAJEB AMIN LTD*).
- **FR-2.2**: Counterparties are assigned immutable UUIDs.
- **FR-2.3**: Counterparty detail views provide complete historical statements: issued invoices, payment receipts, active shipments, and outstanding balances.

#### FR-3: Proforma Invoice Management
- **FR-3.1**: Lifecycle statuses: `DRAFT`, `ISSUED`, `VOID`.
- **FR-3.2**: Payment statuses: `UNPAID`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`.
- **FR-3.3**: Server-side line item calculations:
  $$\text{Line Total} = \text{Net Weight (KG)} \times \text{C\&F Unit Price (USD)}$$
  $$\text{Invoice Grand Total} = \sum \text{Line Totals}$$
  Computed using fixed-point arbitrary precision arithmetic (`decimal.js`). Floating-point arithmetic is strictly prohibited.
- **FR-3.4**: Configurable human-readable proforma numbering (e.g., `PI-2026-001`), with internal relationships strictly anchored to UUIDs to support legacy duplicate numbers without collision.
- **FR-3.5**: Issuing an invoice creates an immutable snapshot of consignee info, line items, totals, payment terms, and active banking instructions. Subsequent company profile changes never alter issued documents.
- **FR-3.6**: Generate and render compliant PDF and printable proforma invoices.

#### FR-4: Freight Logistics & Shipment Tracking
- **FR-4.1**: Track shipments with attributes: Shipment Reference, Container Number, Bill of Lading (B/L) Number, Origin, Destination, Carrier/Vessel, Estimated Time of Arrival (ETA), and Current Status.
- **FR-4.2**: Shipment statuses: `BOOKED`, `AT_ORIGIN_PORT`, `IN_TRANSIT`, `CUSTOMS_CLEARANCE`, `DELIVERED`, `CANCELLED`.
- **FR-4.3**: Shipment status audit trail recording status transitions, actor ID, and timestamps.
- **FR-4.4**: Configurable shipment-to-invoice association via a junction entity (`shipment_invoices`) supporting many-to-many relationships.

#### FR-5: Ledger & Account Statement
- **FR-5.1**: Correct running balance logic:
  $$\text{Balance}_n = \text{Opening Balance} + \sum_{i=1}^n \text{Credits}_i - \sum_{i=1}^n \text{Debits}_i$$
  Calculated with deterministic ordering: `effective_date ASC, posted_at ASC, id ASC`.
- **FR-5.2**: Correction of workbook formula bug: Excel formula `=SUM($F$5:$F5)-SUM($E$5:$E5)` on Row 7 produced row-lagging balances; the system implements cumulative deterministic ledger math.
- **FR-5.3**: Posted ledger entries are strictly immutable. Adjustments or error corrections require linked reversal entries (`REVERSAL`) with mandatory justification notes.
- **FR-5.4**: Multi-currency support with explicit currency codes (Default `USD`).

#### FR-6: Payments & Invoice Allocations
- **FR-6.1**: Support inbound customer payments and outbound disbursements.
- **FR-6.2**: Payment allocation engine supporting:
  - 1-to-1 payment to invoice.
  - Partial payments (payment amount < invoice balance).
  - Split payments (single inward transfer allocated across multiple invoices).
  - Multi-payment invoices (invoice settled by multiple transfers).
- **FR-6.3**: Tracking of unallocated payment amounts and overpayment handling.
- **FR-6.4**: Duplicate payment detection based on transaction reference, amount, and counterparty.

#### FR-7: Banking & Routing Details Security
- **FR-7.1**: Secure storage of corporate bank routing details:
  - Beneficiary: *SKY ARIANA LTD*
  - Primary Bank: *AFGHAN UNITED BANK*
  - Account Number: `101502USD2940472`
  - SWIFT: `AFGUAFKAXXX`
  - Correspondent Bank: *DA AFGHANISTAN BANK*
  - Correspondent SWIFT: `AFGBAFKA`
- **FR-7.2**: Account numbers masked by default in all API responses and UIs (`101502******0472`).
- **FR-7.3**: Dedicated, permission-restricted reveal endpoint (`POST /bank-accounts/:id/reveal`) that logs an audit event every time unmasked details are requested.

#### FR-8: Bank Statement & Invoice Reconciliation
- **FR-8.1**: Automated matching engine comparing statement credits with pending proforma invoices.
- **FR-8.2**: Calculation of match confidence scores based on reference text (e.g., `(INV 001)`), counterparty name similarity, and expected vs. actual amounts (factoring in potential intermediary bank wire fees).
- **FR-8.3**: Human-in-the-loop confirmation interface: no auto-merges without finance staff approval.

#### FR-9: Workbook Migration & Import Center
- **FR-9.1**: Source file verification via SHA-256 hash checking against original workbook (`BC25181951738F3A3E668DC5D3564747447DE549A6CB85F59D28313EA05464EA`).
- **FR-9.2**: Dry-run preview computing expected row counts, parsed amounts, duplicate warnings, and balance comparisons before database writes.
- **FR-9.3**: Row-level import audit storing source sheet name, source row index, raw payload, and mapping status.
- **FR-9.4**: Idempotent execution preventing duplicate record generation on re-import.

#### FR-10: Dashboard, Reporting & Audit Trail
- **FR-10.1**: Executive dashboard displaying real-time metrics: Available Cash Balance, Total Debits, Total Credits, Total Invoiced, Pending Receivables, Active Shipments in transit, and Cash Flow breakdown.
- **FR-10.2**: Comprehensive reporting: Receivables Aging Report, Customer Statements, Ledger Statement, Shipment Status Summary, and Reconciliation Discrepancy Log.
- **FR-10.3**: System-wide audit logging for all critical operations (auth, invoice issue/void, ledger adjustments, bank detail views, import executions).

---

### 3. Non-Functional Requirements (NFR)

- **NFR-1 (Financial Precision)**: All monetary amounts must be stored and computed using high-precision decimal math (minimum 4 decimal places internally, 2 for display). Binary floating point (`float`, `double`) is strictly banned for money.
- **NFR-2 (Security & Compliance)**: Passwords hashed with bcrypt (salt rounds >= 10) or Argon2id; secure HTTP headers (Helmet), CORS restriction, CSRF protection, input validation via class-validator/Zod.
- **NFR-3 (Data Integrity)**: Foreign key constraints, unique constraints, and atomic ACID database transactions for all multi-step financial operations (such as payment allocation).
- **NFR-4 (Performance)**: Sub-200ms API response times for standard queries; optimized database indexing on foreign keys, dates, and status fields.
- **NFR-5 (Cross-Platform Availability)**: Identical user experience on modern web browsers (Chrome, Edge, Firefox, Safari) and desktop environments (Windows, macOS, Linux).
