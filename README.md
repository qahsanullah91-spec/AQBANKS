# AQBANKS - AQ Companies Logistics & Financial Management System

[![CI Pipeline](https://github.com/aq-companies/logistics-bank/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20SQLite-indigo)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#)

A production-grade, multi-user **Logistics & Financial Management Enterprise Application** available as a responsive web application and cross-platform desktop application. Both clients consume a unified, authenticated Modular Monolith backend and database.

Built to replace and migrate spreadsheet operations from `AQ_Companies_System_v10_Logistics.xlsx`.

---

## 🏛️ Architecture Overview

The system is engineered as a **Modular Monolith** adhering to strict financial correctness, relational integrity, and server-side RBAC:

```
├── backend/            # TypeScript REST API (Express, Prisma, Decimal.js, Zod, Vitest)
│   ├── prisma/         # SQLite (Dev/Test) & PostgreSQL (Prod) schemas + seed script
│   ├── src/modules/    # Bounded domain contexts: auth, invoices, ledger, logistics, etc.
│   └── tests/          # Automated test suite (Ledger math, Invoices, RBAC, Import)
├── frontend/           # Responsive Enterprise UI (React 18, Vite, Tailwind CSS, Lucide)
├── desktop/            # Cross-platform desktop application shell (Electron / Tauri)
├── docs/               # Complete engineering & compliance documentation
│   ├── ARCHITECTURE.md
│   ├── REQUIREMENTS.md
│   ├── DATABASE_SCHEMA.md
│   ├── IMPORT_MAPPING.md
│   ├── OPEN_QUESTIONS.md
│   ├── SECURITY.md
│   ├── TEST_PLAN.md
│   ├── DEPLOYMENT_AND_BACKUP.md
│   └── SAMPLE_IMPORT_REPORT.md
└── docker-compose.yml  # Multi-container production deployment specification
```

---

## 🔑 Non-Negotiable Core Principles Implemented

1. **Deterministic Cumulative Ledger Balances**: Corrects the workbook's row-lag offset formula bug (`=SUM($F$5:$F5)-SUM($E$5:$E5)`). Balances are calculated dynamically:
   $$\text{Balance}_n = \text{Opening Balance} + \sum_{i=1}^n \text{Credits}_i - \sum_{i=1}^n \text{Debits}_i$$
   Deterministic tie-breaking: `ORDER BY effective_date ASC, posted_at ASC, id ASC`.
2. **Arbitrary-Precision Decimal Math**: All financial math computes via `decimal.js`. Floating-point binary arithmetic is strictly barred.
3. **Immutable Relational Identifiers**: Entities use immutable UUID primary keys. Legacy repeated proforma numbers (e.g. `001` and `002`) are isolated with zero collision.
4. **Server-Side Line Item Recalculation**: Invoice line totals ($\text{Net Wt} \times \text{Unit Price}$) and grand totals are verified server-side.
5. **Issued Invoice Immutability**: Issuing freezes an immutable snapshot of banking details, consignee info, and line items. Subsequent company profile changes never alter historical legal records.
6. **Masked Banking Details**: Corporate account numbers are masked by default (`101502******0472`). Revealing requires role authorization, mandatory business justification, and produces a tamper-evident audit log entry.
7. **Workbook Migration Center**: Ingestion checks SHA-256 integrity, runs pre-import dry-runs, detects repeated proforma references, presents ambiguous link warnings, and executes safe transactional commits.

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- **Node.js**: v20.x or later (Tested on Node.js v25.8.0)
- **npm**: v10.x or later (Tested on npm 11.11.0)
- **Git**: Installed and configured

### 2. Installation
```bash
# Clone the repository and navigate into the root directory
cd AQ-COMPANIES-BANK

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

### 3. Database Initialization & Seeding
```bash
# Push schema and generate Prisma client (Local SQLite zero-config development)
cd backend
npx prisma db push

# Seed roles, permissions, administrative users, company profile & accounts
npm run prisma:seed
cd ..
```

### 4. Running the Applications

#### Start the Backend API (Port 4000)
```bash
cd backend
npm run dev
# API running at: http://localhost:4000
# Health check:  http://localhost:4000/api/health
```

#### Start the Responsive Web Frontend (Port 5173)
```bash
cd frontend
npm run dev
# Web Portal running at: http://localhost:5173
```

#### Start the Desktop Client
```bash
cd desktop
npm start
```

---

## 👥 Seed Accounts & RBAC Roles

The system is seeded with dedicated role accounts for testing and evaluation.  
**Default Password for all accounts**: `AQCompanies@2026`

| Email | Role | Scope of Authority |
|---|---|---|
| `admin@aqcompanies.com` | **ADMIN** | Unrestricted access, user management, audit logs, import execution |
| `finance@aqcompanies.com` | **FINANCE_MANAGER** | Invoices, payments, ledger posting, reconciliation, unmasking reveal |
| `logistics@aqcompanies.com` | **LOGISTICS_COORDINATOR**| Container tracking, carriers, milestones, read-only invoices |
| `auditor@aqcompanies.com` | **AUDITOR** | Read-only compliance access to ledger, invoices, shipments, audit log |
| `viewer@aqcompanies.com` | **VIEWER** | Dashboard view with masked banking identifiers |

---

## 🧪 Running Automated Tests

The automated test suite verifies financial math, ledger ordering, line recalculation, duplicate proforma handling, import verification, and RBAC negative authorization:

```bash
cd backend
npm test
```

### Verified Test Suite Results:
```text
 ✓ tests/invoice.test.ts (2 tests)
 ✓ tests/ledger.test.ts (3 tests)
 ✓ tests/import.test.ts (4 tests)
 ✓ tests/security.test.ts (6 tests)

Test Files  4 passed (4)
     Tests  15 passed (15)
```

---

## 🐳 Dockerized Production Deployment

To run containerized services using PostgreSQL 16 and Nginx:
```bash
# Launch PostgreSQL, Backend API, and Nginx Web Container
docker compose up -d --build

# Verify container health
docker compose ps
curl http://localhost:4000/api/health
```

---

## 📑 Technical Documentation Directory

- [System Architecture](docs/ARCHITECTURE.md) - Modular Monolith design, boundaries, and client tiers.
- [Requirements Document](docs/REQUIREMENTS.md) - Functional and Non-Functional specifications.
- [Database Schema & ERD](docs/DATABASE_SCHEMA.md) - Entity relationship diagrams, keys, and indexes.
- [Workbook Import Mapping](docs/IMPORT_MAPPING.md) - Column-by-column transformation rules for all 6 sheets.
- [Open Questions & Accounting Decisions](docs/OPEN_QUESTIONS.md) - Unresolved business decisions and provisional defaults.
- [Security & Access Control](docs/SECURITY.md) - Threat model, RBAC permission matrix, and masking rules.
- [Automated Test Plan](docs/TEST_PLAN.md) - Test cases, invariants, and coverage.
- [Deployment & Backup Procedures](docs/DEPLOYMENT_AND_BACKUP.md) - Disaster recovery, pg_dump, and restore steps.
- [Sample Import Report](docs/SAMPLE_IMPORT_REPORT.md) - Ingestion audit and checkpoint verification.
