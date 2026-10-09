# AQ Companies Logistics & Financial Management System
## Open Business Questions & Accounting Policy Decisions

This document records unresolved business questions, accounting policy decisions, and ambiguous workbook interpretations identified during the technical inspection of `AQ_Companies_System_v10_Logistics.xlsx`. 

> [!IMPORTANT]
> In accordance with Principle 1: **"Do not invent business requirements. When a decision is unresolved, record it in docs/OPEN_QUESTIONS.md, implement a safe configurable default only when possible, and label it as provisional. Never silently decide accounting policy."**

---

### Question 1: Opening Balance vs. Transaction ($83.36)
- **Workbook Observation**: Sheet `Account Statement`, Row 7 contains:
  - Date: `01-Sep-2026`
  - Ref: `N/A`
  - Description: `Starting Balance Prior to Transfers`
  - Category: `Balance`
  - Credit: `$83.36`
- **Question for Owner**: Is the \$83.36 an opening financial balance from a prior accounting period, or is it an actual posted transaction that occurred on 01-Sep-2026?
- **Provisional Default Implemented**: Treated as an explicit `OPENING_BALANCE` record for the primary USD account, included in the ledger starting calculation rather than categorized as regular commercial operating income.
- **Impact if Changed**: If classified as commercial income, it will be included in period revenue reports; if opening balance, it sets the initial baseline cash position.

---

### Question 2: Inward Transfer Discrepancies vs. Invoice Expected Amounts
- **Workbook Observation**:
  - Proforma Invoice `001` (G.T JAYANTI AGROCHEM) expected amount is **\$79,332.80**.
    - Account Statement Row 8 inward credit is **\$78,893.36** ($\Delta = -\$439.44$).
    - In `Proforma Invoices`, Payment Status is manually marked `PAID (See Ledger)`.
  - Proforma Invoice `001` (G.T INDIA PVT LTD) expected amount is **\$74,750.00**.
    - Account Statement Row 9 inward credit is **\$74,376.25** ($\Delta = -\$373.75$).
    - In `Proforma Invoices`, Payment Status is manually marked `PAID (See Ledger)`.
- **Question for Owner**: 
  1. Are these differences ($\$439.44$ and $\$373.75$) intermediary bank wire deduction charges borne by the seller (AQ Companies), discounts granted to the buyer, or underpayments to be carried forward as unpaid balance?
  2. Should the system auto-record a "Bank Charges / Intermediary Fee" debit expense of $\$439.44$ and $\$373.75$ when closing these invoices to fully balance the invoice ledger?
- **Provisional Default Implemented**: The inward payments are allocated for their actual received amounts (\$78,893.36 and \$74,376.25). The remaining balances are flagged in the reconciliation dashboard as "Unresolved Discrepancies / Bank Fee Tolerance" requiring manual sign-off before invoice closure.

---

### Question 3: Duplicate Proforma Numbering & Numbering Policy
- **Workbook Observation**: The human-readable string `001` appears 4 times across different dates and buyers in the workbook:
  - 05-Sep-2026: `G.T JAYANTI AGROCHEM INDIA PVT LTD` (USD 79,332.80)
  - 23-Sep-2026: `G.T INDIA PVT LTD` (USD 74,750.00)
  - 28-Sep-2026: `MANIK TRADERS` (USD 57,533.00)
  - 28-Sep-2026: `SPDC BITES LLP` (USD 71,864.00)
  Similarly, `002` appears 3 times.
- **Question for Owner**:
  1. What is the intended business rule for proforma invoice numbering going forward?
     - Option A: Sequential per customer per year (e.g., `GT-2026-001`, `MANIK-2026-001`).
     - Option B: Global sequential across all customers (e.g., `PI-2026-0001`, `PI-2026-0002`).
     - Option C: Reset monthly or yearly.
- **Provisional Default Implemented**:
  - In the database, every invoice has a unique immutable UUID (`id`).
  - An internal display reference (`display_number`) preserves the historical label (`001 (Sep 05, G.T Jayanti)`).
  - A configurable numbering engine generates unique formatted numbers (default: `PI-YYYY-XXXXX`) for new invoices, with collision prevention.

---

### Question 4: Ambiguous Shipment-to-Invoice Links
- **Workbook Observation**:
  - `Logistics & Tracking` Row 6 specifies Shipment `SHP-9001` with Proforma Ref `001`.
  - `Logistics & Tracking` Row 7 specifies Shipment `SHP-9002` with Proforma Ref `002`.
  - Because `001` exists 4 times in `Proforma Invoices`, the workbook reference `001` is ambiguous.
- **Question for Owner**:
  - Is `SHP-9001` associated with G.T JAYANTI AGROCHEM's invoice of 05-Sep-2026, or GT INDIA PVT LTD of 23-Sep-2026?
  - Can a single shipment contain goods billed across multiple proforma invoices (many-to-one), or can an invoice be fulfilled across multiple shipments (one-to-many)?
- **Provisional Default Implemented**:
  - A junction table `shipment_invoices` is implemented supporting full **many-to-many** relationships.
  - The import center flags `SHP-9001 -> 001` and `SHP-9002 -> 002` as ambiguous links and presents candidate invoices for user verification during migration rather than guessing.

---

### Question 5: Corporate Entity Hierarchy: Brand vs. Legal Invoicing Entity
- **Workbook Observation**:
  - Overview sheet header: `AQ COMPANIES` and `Corporate Logistics & Banking Portal`.
  - Account Statement header: `AQ Companies • Account Statement`.
  - Invoice Generator & Bank Details: Beneficiary Name is `SKY ARIANA LTD`.
- **Question for Owner**:
  - Is "AQ Companies" the overarching trade group/holding company, and "SKY ARIANA LTD" the registered corporate legal entity used for export contracts, proforma invoices, and international banking?
  - Will there be other operating entities under AQ Companies in the future requiring multi-entity ledgering?
- **Provisional Default Implemented**:
  - Designed with an `EntityProfile` model. `AQ Companies` is configured as the organization name, and `SKY ARIANA LTD` is configured as the active legal billing entity. The architecture is multi-entity ready.

---

### Question 6: Quantity & Weight Unit Pricing Policy
- **Workbook Observation**:
  - In `Invoice Generator`, line items specify `Total Net Wt (KG)` and `C&F Unit Price (USD)`.
  - Line total formula is `Total Net Wt * C&F Unit Price`.
  - In `Proforma Invoices`, descriptions include carton counts (e.g. `1,385 CTNS`, `2,300 CTNS`), but the total price divided by net weight produces unit prices such as:
    - 79,332.80 / 22,160 = $3.58 / KG
    - 74,750.00 / 23,000 = $3.25 / KG
    - 63,000.00 / 22,500 = $2.80 / KG
    - 57,533.00 / 22,128 = ~$2.600099 / KG
- **Question for Owner**:
  - Is the billable quantity strictly Net Weight in Kilograms (KG), or are some shipments invoiced per Carton / Unit?
  - What is the required decimal precision for unit pricing (2, 3, or 4 decimal places)?
- **Provisional Default Implemented**:
  - Supports configurable quantity units (`KG`, `MT`, `CTN`, `PCS`). Default set to `KG` with unit prices stored up to 4 decimal places and line totals rounded to 2 decimal places using standard half-even (banker's) rounding.

---

### Question 7: Treatment of Overpayments, Refunds, Credit Notes & Write-offs
- **Question for Owner**: If a buyer overpays an invoice, or if a shipment is damaged and a credit note is required:
  - Should overpayments automatically remain as unallocated customer credit balance on their account?
  - How should bad debts or write-offs be authorized and categorized?
- **Provisional Default Implemented**:
  - Overpayments remain as an explicit `UNALLOCATED_BALANCE` attached to the customer account.
  - Credit adjustments require supervisor sign-off and create auditable adjustment ledger entries.

---

### Question 8: Desktop Offline Mode Expectations
- **Question for Owner**: Does the desktop client require offline write access with local database syncing, or is the desktop application intended as a secure, dedicated desktop workstation client communicating with the centralized cloud/local server API?
- **Provisional Default Implemented**:
  - Desktop client operates as a secure native desktop application with full network resilience, cached local read state, and authenticated HTTPS/WSS communication to the central server.
