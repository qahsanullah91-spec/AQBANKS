# AQ Companies Logistics & Financial Management System
## Sample Workbook Import & Validation Report
> [!WARNING]
> **STATUS: UNAPPROVED / PREVIEW ONLY**
> In accordance with Principle 10 and Data Migration Governance, this import report is generated from `AQ_Companies_System_v10_Logistics.xlsx` and is strictly **PROVISIONAL**. Final production ledger balances require explicit accounting sign-off and owner confirmation of open questions recorded in `docs/OPEN_QUESTIONS.md`.

---

### 1. Source File Provenance & Cryptographic Verification
- **Source File**: `AQ_Companies_System_v10_Logistics.xlsx`
- **SHA-256 Checksum**: `BC25181951738F3A3E668DC5D3564747447DE549A6CB85F59D28313EA05464EA`
- **Expected Master Checksum**: `BC25181951738F3A3E668DC5D3564747447DE549A6CB85F59D28313EA05464EA`
- **Integrity Status**: ✅ **VERIFIED (Bit-for-bit authentic source match)**
- **Report Generation Timestamp**: 2026-10-09T12:59:06.921Z

---

### 2. Sheet Ingestion & Record Metrics

| Sheet Name | Raw Status | Non-Empty Rows | Mapped Records | Validation Warnings |
|---|---|---|---|---|
| **Overview** | Dynamic Metric Source | 14 | N/A (Dynamic Target) | 0 |
| **Account & Routing Details** | Metadata Key-Value | 9 | 1 Corporate Bank Account | 0 |
| **Account Statement** | Transaction Log | 11 | 6 Ledger Transactions | 1 (Row 7 Starting Balance Classification) |
| **Proforma Invoices** | Receivables Register | 12 | 8 Proforma Invoices | 2 (Repeated human proforma refs '001', '002') |
| **Logistics & Tracking** | Freight Movements | 5 | 2 Active Shipments | 1 (Ambiguous link to duplicate proforma '001') |
| **Invoice Generator** | Print/Template Layout | 16 | 1 Default Billing Layout | 0 |
| **Total** | -- | **67** | **17 Core Relational Entities** | **4 Total Audit Warnings** |

---

### 3. Financial Checkpoint Comparisons

| Metric Category | Workbook Cell / Review Benchmark | Parsed Source Calculated | Variance | Accounting Sign-Off State |
|---|---|---|---|---|
| **Total Credits (Inflow)** | $153,352.97 | $153352.97 | $0.00 | ⏳ Pending Reconciliation Sign-Off |
| **Total Debits (Outflow)** | $129,093.36 | $129093.36 | $0.00 | ⏳ Pending Reconciliation Sign-Off |
| **Net Available Cash Balance** | $24,259.61 | $24259.61 | $0.00 | ⏳ Corrected Running Balance Logic Verified |
| **Total Invoiced (All-Time)** | $555,090.30 | $555090.30 | $0.00 | ⏳ Pending Commercial Confirmation |
| **Pending Receivables** | $401,007.50 | $401007.50 | $0.00 | ⏳ Pending Reconciliation Sign-Off |

---

### 4. Row-Level Parsed Records Preview

#### 4.1 Account Statement (Ledger)
- **Row 7** | Date: `01-Sep-2026` | Ref: `N/A` | Description: *Starting Balance Prior to Transfers* | Category: `Balance` | Debit: `$0.00` | Credit: `$83.36`
- **Row 8** | Date: `30-Sep-2026` | Ref: `0464AIR261771143` | Description: *Inward Transfer: G.T JAYANTI AGROCHEM (INV 001)* | Category: `Credit` | Debit: `$0.00` | Credit: `$78893.36`
- **Row 9** | Date: `08-Oct-2026` | Ref: `8483AIR261778937` | Description: *Inward Transfer: GT INDIA PVT LTD* | Category: `Credit` | Debit: `$0.00` | Credit: `$74376.25`
- **Row 10** | Date: `08-Oct-2026` | Ref: `N/A` | Description: *Payment to Hayatullah Noori* | Category: `Debit` | Debit: `$15200.00` | Credit: `$0.00`
- **Row 11** | Date: `08-Oct-2026` | Ref: `AD 5708262` | Description: *Payment to Sodiqjon Aminov (Tashkent)* | Category: `Debit` | Debit: `$35000.00` | Credit: `$0.00`
- **Row 12** | Date: `08-Oct-2026` | Ref: `N/A` | Description: *Payment to NAJEB AMIN LTD* | Category: `Debit` | Debit: `$78893.36` | Credit: `$0.00`

#### 4.2 Proforma Invoices
- **Row 7** | Date: `05-Sep-2026` | Ref: `001` | Buyer: *G.T JAYANTI AGROCHEM INDIA PVT LTD* | Item: *Black Raisins (Best) - 1,385 CTNS* | Wt: `22,160 KG` | Total: `$79332.80` | Status: `PAID (See Ledger)`
- **Row 8** | Date: `23-Sep-2026` | Ref: `001` | Buyer: *G.T INDIA PVT LTD* | Item: *Black Raisins - 2,300 CTNS* | Wt: `23,000 KG` | Total: `$74750.00` | Status: `PAID (See Ledger)`
- **Row 9** | Date: `23-Sep-2026` | Ref: `002` | Buyer: *G.T INDIA PVT LTD* | Item: *Black Raisins - 2,295 CTNS* | Wt: `22,950 KG` | Total: `$74587.50` | Status: `Pending`
- **Row 10** | Date: `23-Sep-2026` | Ref: `002` | Buyer: *G.T JAYANTI AGROCHEM INDIA PVT LTD* | Item: *Black Raisins - 2,250 CTNS* | Wt: `22,500 KG` | Total: `$63000.00` | Status: `Pending`
- **Row 11** | Date: `28-Sep-2026` | Ref: `001` | Buyer: *MANIK TRADERS* | Item: *Black Raisins - 1,383 CTNS* | Wt: `22,128 KG` | Total: `$57533.00` | Status: `Pending`
- **Row 12** | Date: `28-Sep-2026` | Ref: `002` | Buyer: *MANIK TRADERS* | Item: *Black Raisins - 1,384 CTNS* | Wt: `22,144 KG` | Total: `$62003.00` | Status: `Pending`
- **Row 13** | Date: `28-Sep-2026` | Ref: `003` | Buyer: *MANIK TRADERS* | Item: *Black Raisins - 1,385 CTNS* | Wt: `22,160 KG` | Total: `$72020.00` | Status: `Pending`
- **Row 14** | Date: `28-Sep-2026` | Ref: `001` | Buyer: *SPDC BITES LLP* | Item: *Black Raisins - 1,382 CTNS* | Wt: `22,122 KG` | Total: `$71864.00` | Status: `Pending`

#### 4.3 Active Freight Shipments
- **Row 6** | Date: `10-Oct-2026` | Shipment Ref: `SHP-9001` | Container: `MSKU9023418` | B/L: `BL-1928374` | Route: `Kandahar -> Nhava Sheva` | Carrier: `Maersk Line` | ETA: `22-Oct-2026` | Status: `In Transit`
- **Row 7** | Date: `12-Oct-2026` | Shipment Ref: `SHP-9002` | Container: `TGHU8172635` | B/L: `BL-1928375` | Route: `Dogharoun -> Jebel Ali` | Carrier: `MSC` | ETA: `18-Oct-2026` | Status: `At Origin Port`

---

### 5. Audit Warnings & Decisions Required

```text
[WARN-1] Row 7 ($83.36, "Starting Balance Prior to Transfers") flagged: Requires owner confirmation if this is Opening Balance or commercial transaction.
[WARN-2] Human proforma number "001" appears 4 times in source. Must be isolated with unique internal UUIDs.
[WARN-3] Human proforma number "002" appears 3 times in source. Must be isolated with unique internal UUIDs.
[WARN-4] Shipment Row 6 (SHP-9001) references proforma "001", which is ambiguous (4 candidates found). Junction association requires user confirmation.
[WARN-5] Shipment Row 7 (SHP-9002) references proforma "002", which is ambiguous (3 candidates found). Junction association requires user confirmation.
```

---

### 6. Sign-Off Signature Block

- **Lead Software Architect & QA Engineer**: ✅ *Automated Ingestion Pre-Check Passed*
- **Senior Accountant / Controller**: ___________________________ Date: ____________
- **AQ Companies Business Owner**: ___________________________ Date: ____________
