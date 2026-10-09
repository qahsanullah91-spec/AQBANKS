# AQ Companies Logistics & Financial Management System
## Automated Test Plan & Quality Assurance Strategy

### 1. Test Objectives & Scope
This test plan defines the automated verification suite for the AQ Companies system, focusing on financial correctness, data migration integrity, role-based authorization, and invariant enforcement.

---

### 2. Required Test Categories & Test Cases

#### Category A: Financial Engine & Ledger Correctness
- **TC-FIN-01: Correct Running Balance Calculation**:
  - *Given*: Starting balance of \$83.36, followed by credits of \$78,893.36 and \$74,376.25, and debits of \$15,200.00, \$35,000.00, and \$78,893.36.
  - *When*: Ledger calculation executes.
  - *Then*: Intermediate balances match exact cumulative points:
    1. Row 1: \$83.36
    2. Row 2: \$83.36 + \$78,893.36 = \$78,976.72
    3. Row 3: \$78,976.72 + \$74,376.25 = \$153,352.97
    4. Row 4: \$153,352.97 - \$15,200.00 = \$138,152.97
    5. Row 5: \$138,152.97 - \$35,000.00 = \$103,152.97
    6. Row 6: \$103,152.97 - \$78,893.36 = \$24,259.61
  - Proves elimination of Excel formula row-offset bug.
- **TC-FIN-02: Deterministic Tie-Breaking**:
  - *Given*: Multiple transactions posted on the same effective date (`08-Oct-2026`).
  - *Then*: Ordering is deterministically resolved by `effective_date ASC, posted_at ASC, id ASC`, ensuring reproducible balance computation across runs.
- **TC-FIN-03: Arbitrary-Precision Decimal Arithmetic**:
  - *Given*: Fractional amounts with high precision (e.g., unit price \$2.6001 * 22,128 KG).
  - *Then*: Computations using `decimal.js` avoid binary IEEE-754 floating-point drift (e.g., `0.1 + 0.2 === 0.3`).
- **TC-FIN-04: Ledger Entry Immutability & Reversal Workflow**:
  - *Attempt*: Directly updating or deleting a posted ledger entry.
  - *Result*: Operation rejected with 403/400 error.
  - *Valid Action*: Posting a reversal entry linked to `reversal_of_id` generates opposite credit/debit with documented audit reason.

#### Category B: Invoicing & Payment Allocations
- **TC-INV-01: Server-Side Line Total Recalculation**:
  - *Given*: Line item with weight 22,160 KG and unit price \$3.58.
  - *Then*: Server recalculates total \$79,332.80; ignores any client-tampered totals.
- **TC-INV-02: Issued Invoice Immutability & Snapshotting**:
  - *Given*: Invoice in `ISSUED` status.
  - *When*: Update request submitted.
  - *Then*: Rejected. Snapshot contains frozen bank routing details and line items.
- **TC-INV-03: Repeated Proforma Numbers Isolation**:
  - *Given*: Multiple invoices with duplicate human reference `001`.
  - *Then*: System isolates records using unique UUIDs; no cross-linking occurs.
- **TC-PAY-01: Partial & Split Payment Allocations**:
  - *Given*: Payment of \$50,000.00 allocated across Invoice A (\$30,000.00) and Invoice B (\$20,000.00).
  - *Then*: Payment allocations record \$30,000.00 and \$20,000.00, reducing invoice balances accordingly. Unallocated amount equals \$0.00.

#### Category C: Workbook Migration & Import Verification
- **TC-IMP-01: SHA-256 Checksum Validation**:
  - Verifies untouched source file hash `BC25181951738F3A3E668DC5D3564747447DE549A6CB85F59D28313EA05464EA`.
- **TC-IMP-02: Dry-Run Reporting**:
  - Verifies dry-run parsing produces exact expected row counts:
    - 6 ledger transactions
    - 8 proforma invoices
    - 2 active shipments
    - 1 official bank account
- **TC-IMP-03: Duplicate Proforma Number Warning**:
  - Flags duplicate reference `001` (4 occurrences) and `002` (3 occurrences) without crashing or conflating records.
- **TC-IMP-04: Idempotent Re-Import**:
  - Running import twice does not duplicate rows.

#### Category D: Role-Based Authorization & Security
- **TC-SEC-01: Logistics Coordinator Denied Financial Modifications**:
  - User with `LOGISTICS_COORDINATOR` role attempting `POST /api/invoices` or `POST /api/ledger` receives `403 Forbidden`.
- **TC-SEC-02: Viewer Denied Unmasked Bank Account Details**:
  - User with `VIEWER` role requesting `POST /api/bank-accounts/:id/reveal` receives `403 Forbidden`.
- **TC-SEC-03: Admin Reveal Generates Audit Event**:
  - User with `ADMIN` role requesting reveal receives unmasked account number and verifies an audit event is recorded with timestamp and actor ID.
