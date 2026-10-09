# AQ Companies Logistics & Financial Management System
## Excel Workbook Import Mapping Specification

**Source File**: `AQ_Companies_System_v10_Logistics.xlsx`  
**File SHA-256**: `BC25181951738F3A3E668DC5D3564747447DE549A6CB85F59D28313EA05464EA`  
**Verification Date**: 09-Oct-2026

---

### Sheet 1: `Account & Routing Details`
**Header / Layout**: Metadata key-value block starting at Row 7 and Row 15.

| Cell Range | Label in Sheet | Target Entity & Field | Data Type | Transformation & Validation Rules |
|---|---|---|---|---|
| `C7` | `Bank Name:` | `bank_accounts.bank_name` | `VARCHAR(255)` | Trim string: `AFGHAN UNITED BANK` |
| `C8` | `Beneficiary Name:` | `company_profiles.legal_name` / `bank_accounts.beneficiary_name` | `VARCHAR(255)` | Trim string: `SKY ARIANA LTD` |
| `C9` | `Account Number (USD):` | `bank_accounts.account_number` | `VARCHAR(100)` | Encrypted at rest. Stored as `101502USD2940472`. Masked for regular display: `101502******0472`. |
| `C10` | `Bank SWIFT Code:` | `bank_accounts.swift_code` | `VARCHAR(50)` | Uppercase alphanumeric: `AFGUAFKAXXX`. Format validated (8 or 11 chars). |
| `C15` | `Correspondent Bank:` | `bank_accounts.correspondent_bank` | `VARCHAR(255)` | Trim string: `DA AFGHANISTAN BANK` |
| `C16` | `Correspondent SWIFT:` | `bank_accounts.correspondent_swift` | `VARCHAR(50)` | Uppercase alphanumeric: `AFGBAFKA` |

---

### Sheet 2: `Account Statement`
**Header Row**: Row 6  
**Data Rows**: Rows 7 through 12 (6 records total)

| Source Column | Excel Header | Target Field | Data Type | Transform / Handling |
|---|---|---|---|---|
| `Col A` (A7:A12) | `Date` | `ledger_transactions.effective_date` | `DATE` | Parse `01-Sep-2026`, `30-Sep-2026`, `08-Oct-2026` to ISO `YYYY-MM-DD`. Standardize mixed date strings. |
| `Col B` (B7:B12) | `Transaction ID / Ref` | `ledger_transactions.reference` | `VARCHAR(100)` | If `N/A` or empty, set `reference = NULL` and store raw value in `import_rows.raw_data`. Values: `0464AIR261771143`, `8483AIR261778937`, `AD 5708262`. |
| `Col C` (C7:C12) | `Description` | `ledger_transactions.description` | `TEXT` | Strip surrounding whitespace. Extract counterparty or invoice hints for auto-reconciliation. |
| `Col D` (D7:D12) | `Category` | `ledger_transactions.category` | `VARCHAR(50)` | Values: `Balance` (Opening), `Credit` (Commercial Receipt), `Debit` (Vendor/Supplier Disbursement). Normalized to enum. |
| `Col E` (E7:E12) | `Debit (USD)` | `ledger_transactions.debit_amount` | `DECIMAL(18, 4)` | Parse numeric; convert currency symbols/commas to exact Decimal. Empty/0 parsed as `0.0000`. |
| `Col F` (F7:F12) | `Credit (USD)` | `ledger_transactions.credit_amount` | `DECIMAL(18, 4)` | Parse numeric; convert currency symbols/commas to exact Decimal. Empty/0 parsed as `0.0000`. |
| `Col G` (G7:G12) | `Running Balance` | Calculated Server-Side (`ledger_transactions.running_balance`) | `DECIMAL(18, 4)` | **DO NOT IMPORT EXCEL FORMULA**. Recomputed deterministically: Opening Balance + Cumulative Credits - Cumulative Debits. Formula in sheet (`SUM($F$5:$F5)-SUM($E$5:$E5)`) is flawed and discarded. |
| `Col H` (H5) | `Reconciled` | `ledger_transactions.reconciliation_status` | `VARCHAR(50)` | Default `UNRECONCILED` unless confirmed during reconciliation phase. |

---

### Sheet 3: `Proforma Invoices`
**Header Row**: Row 6  
**Data Rows**: Rows 7 through 14 (8 records total)

| Source Column | Excel Header | Target Field | Data Type | Transform / Handling |
|---|---|---|---|---|
| `Col B` (B7:B14) | `Invoice Date` | `invoices.issue_date` | `DATE` | Parse `05-Sep-2026`, `23-Sep-2026`, `28-Sep-2026` to ISO `YYYY-MM-DD`. |
| `Col C` (C7:C14) | `Proforma No` | `invoices.source_invoice_ref` / `invoices.display_number` | `VARCHAR(100)` | **Non-unique in source!** Store as `source_invoice_ref`. Primary key is immutable UUID `invoices.id`. Distinct system ref generated: e.g. `PI-2026-001-A`. |
| `Col D` (D7:D14) | `Buyer / Consignee` | `customers.company_name` | `VARCHAR(255)` | Matches or creates customer record. Maps to `invoices.customer_id`. Counterparties: `G.T JAYANTI AGROCHEM INDIA PVT LTD`, `G.T INDIA PVT LTD`, `MANIK TRADERS`, `SPDC BITES LLP`. |
| `Col E` (E7:E14) | `Item Description` | `invoice_lines.description` | `TEXT` | Line item description (e.g. `Black Raisins (Best) - 1,385 CTNS`). |
| `Col F` (F7:F14) | `Total Net Wt (KG)` | `invoice_lines.quantity` | `DECIMAL(18, 4)` | Store as decimal weight in KG: `22160`, `23000`, `22950`, `22500`, `22128`, `22144`, `22122`. |
| `Col G` (G7:G14) | `Expected Amount (USD)` | `invoices.total_amount` | `DECIMAL(18, 4)` | Recalculate unit price as `Total Amount / Weight`. Validate line total matches expected invoice total. |
| `Col H` (H7:H14) | `Payment Status` | `invoices.payment_status` | `VARCHAR(50)` | Source values: `Pending` -> `UNPAID`. `PAID (See Ledger)` -> Flagged for ledger verification. Converted to `PAID` only when linked to reconciled payment allocation. |

---

### Sheet 4: `Logistics & Tracking`
**Header Row**: Row 5  
**Data Rows**: Rows 6 through 7 (2 records total)

| Source Column | Excel Header | Target Field | Data Type | Transform / Handling |
|---|---|---|---|---|
| `Col B` (B6:B7) | `Date` | `shipments.shipment_date` | `DATE` | Parse `10-Oct-2026`, `12-Oct-2026` to ISO `YYYY-MM-DD`. |
| `Col C` (C6:C7) | `Shipment Ref` | `shipments.shipment_ref` | `VARCHAR(100)` | Unique freight reference: `SHP-9001`, `SHP-9002`. Indexed. |
| `Col D` (D6:D7) | `Proforma Ref` | `shipment_invoices.invoice_id` | `UUID` (Junction) | Flags ambiguous link during import. Matches to candidate invoice via buyer and date, requiring user confirmation. |
| `Col E` (E6:E7) | `Container No` | `shipments.container_number` | `VARCHAR(100)` | Standard ISO container numbers: `MSKU9023418`, `TGHU8172635`. |
| `Col F` (F6:F7) | `B/L Number` | `shipments.bill_of_lading` | `VARCHAR(100)` | B/L numbers: `BL-1928374`, `BL-1928375`. |
| `Col G` (G6:G7) | `Origin -> Destination` | `shipments.origin`, `shipments.destination` | `VARCHAR(255)` each | Split on `->` string: `Kandahar` -> `Nhava Sheva`, `Dogharoun` -> `Jebel Ali`. |
| `Col H` (H6:H7) | `Vessel / Carrier` | `shipments.carrier` | `VARCHAR(255)` | Ocean/freight carriers: `Maersk Line`, `MSC`. |
| `Col I` (I6:I7) | `ETA` | `shipments.estimated_arrival_date` | `DATE` | Parse `22-Oct-2026`, `18-Oct-2026` to ISO `YYYY-MM-DD`. |
| `Col J` (J6:J7) | `Status` | `shipments.status` | `VARCHAR(50)` | Map to enum: `In Transit` -> `IN_TRANSIT`, `At Origin Port` -> `AT_ORIGIN_PORT`. Status history record created. |

---

### Sheet 5: `Invoice Generator` (Template)
- **Purpose**: Template used to structure the proforma invoice layout, company details, line items, and payment terms.
- **Mapping**: Used to define default entity profile (`SKY ARIANA LTD`, `info@skyariana.com`, `www.skyariana.com`), default terms (`100% Advance Payment`), and PDF rendering template.

---

### Sheet 6: `Overview`
- **Purpose**: Executive dashboard view.
- **Mapping**: Dynamic calculation verification target. Overview metrics are NOT stored as static rows, but dynamically verified against the backend query engine:
  - **Total Credits**: \$153,352.97
  - **Total Debits**: \$129,093.36
  - **Available Balance**: \$24,259.61
  - **Total Invoiced**: \$555,090.30
  - **Pending Receivables**: \$401,007.50
