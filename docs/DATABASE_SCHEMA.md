# AQ Companies Logistics & Financial Management System
## Relational Database Schema & Entity Relationship Diagram (ERD)

### 1. Entity-Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ USER_ROLES : has
    ROLES ||--o{ USER_ROLES : assigns
    ROLES ||--o{ ROLE_PERMISSIONS : contains
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : grants

    USERS ||--o{ AUDIT_EVENTS : triggers
    CUSTOMERS ||--o{ INVOICES : billed_to
    CUSTOMERS ||--o{ PAYMENTS : pays

    COMPANY_PROFILES ||--o{ BANK_ACCOUNTS : owns
    BANK_ACCOUNTS ||--o{ BANK_DETAIL_VERSIONS : versions

    FINANCIAL_ACCOUNTS ||--o{ LEDGER_TRANSACTIONS : contains
    LEDGER_TRANSACTIONS ||--o{ LEDGER_TRANSACTIONS : reverses

    INVOICES ||--o{ INVOICE_LINES : contains
    INVOICES ||--o{ INVOICE_SNAPSHOTS : freezes
    INVOICES ||--o{ SHIPMENT_INVOICES : links
    SHIPMENTS ||--o{ SHIPMENT_INVOICES : links
    SHIPMENTS ||--o{ SHIPMENT_STATUS_HISTORY : tracks

    PAYMENTS ||--o{ PAYMENT_ALLOCATIONS : allocates
    INVOICES ||--o{ PAYMENT_ALLOCATIONS : receives

    IMPORTS ||--o{ IMPORT_ROWS : parses

    CUSTOMERS {
        uuid id PK
        string company_name
        string contact_person
        string email
        string phone
        string address_line1
        string address_line2
        string country
        timestamp created_at
        timestamp updated_at
    }

    INVOICES {
        uuid id PK
        uuid customer_id FK
        string invoice_number
        string source_invoice_ref
        date issue_date
        date due_date
        string currency
        decimal subtotal
        decimal tax_amount
        decimal total_amount
        string status
        string payment_status
        string payment_terms
        uuid bank_account_id FK
        timestamp created_at
        timestamp updated_at
    }

    INVOICE_LINES {
        uuid id PK
        uuid invoice_id FK
        int line_number
        string description
        decimal quantity
        string unit_of_measure
        decimal unit_price
        decimal line_total
    }

    SHIPMENTS {
        uuid id PK
        string shipment_ref UK
        string container_number
        string bill_of_lading
        string origin
        string destination
        string carrier
        date shipment_date
        date estimated_arrival_date
        date actual_arrival_date
        string status
        timestamp created_at
        timestamp updated_at
    }

    SHIPMENT_INVOICES {
        uuid id PK
        uuid shipment_id FK
        uuid invoice_id FK
        decimal allocated_weight_kg
        timestamp created_at
    }

    LEDGER_TRANSACTIONS {
        uuid id PK
        uuid financial_account_id FK
        date effective_date
        timestamp posted_at
        string reference
        string description
        string category
        decimal debit_amount
        decimal credit_amount
        decimal running_balance
        string currency
        string reconciliation_status
        uuid reversal_of_id FK
        timestamp created_at
    }

    PAYMENTS {
        uuid id PK
        uuid customer_id FK
        uuid financial_account_id FK
        date payment_date
        string reference
        string payment_method
        decimal total_amount
        decimal allocated_amount
        decimal unallocated_amount
        string currency
        string notes
        timestamp created_at
    }

    PAYMENT_ALLOCATIONS {
        uuid id PK
        uuid payment_id FK
        uuid invoice_id FK
        decimal amount
        timestamp allocated_at
    }

    BANK_ACCOUNTS {
        uuid id PK
        string bank_name
        string beneficiary_name
        string account_number_encrypted
        string account_number_masked
        string swift_code
        string correspondent_bank
        string correspondent_swift
        string currency
        boolean is_primary
        timestamp created_at
        timestamp updated_at
    }

    AUDIT_EVENTS {
        uuid id PK
        uuid actor_id FK
        string action
        string entity_type
        uuid entity_id
        jsonb old_values
        jsonb new_values
        string ip_address
        timestamp created_at
    }
```

### 2. Table Definitions & Constraints
- **UUID Primary Keys**: Every entity uses a non-sequential, immutable UUID identifier.
- **Decimal Fields**: Financial fields (`debit_amount`, `credit_amount`, `running_balance`, `total_amount`, `unit_price`, `line_total`, `allocated_amount`) use `DECIMAL(18, 4)`.
- **Foreign Keys**: Explicit relational constraints enforce referential integrity across all junction tables.
- **Audit Columns**: `created_at`, `updated_at`, and `created_by` track temporal state changes.
