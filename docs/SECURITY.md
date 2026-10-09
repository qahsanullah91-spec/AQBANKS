# AQ Companies Logistics & Financial Management System
## Security, Access Control & Compliance Architecture

### 1. Threat Model & Security Posture
The AQ Companies application manages cross-border freight movements, international commercial invoices, and corporate banking details for export settlements. The security design guarantees defense-in-depth across the following vectors:

1. **Unauthorized Access**: Protection against credential stuffing, brute force, and session hijacking.
2. **Privilege Escalation**: Server-enforced role and permission boundaries across all API routes.
3. **Financial Data Tampering**: Immutability of issued invoices and posted ledger entries.
4. **Data Exfiltration**: Masking of banking identifiers by default and rate-limited audit logging for reveals.
5. **Injection Attacks**: Parameterized database queries, typed request schemas, and safe DOM rendering.

---

### 2. Role-Based Access Control (RBAC) Matrix

| Permission / Action | ADMIN | FINANCE_MANAGER | LOGISTICS_COORDINATOR | AUDITOR | VIEWER |
|---|:---:|:---:|:---:|:---:|:---:|
| `user:manage` |  |  |  |  |  |
| `settings:manage` |  |  |  |  |  |
| `invoice:create_draft` |  |  |  |  |  |
| `invoice:issue` |  |  |  |  |  |
| `invoice:void` |  |  |  |  |  |
| `invoice:view` |  |  |  |  |  |
| `ledger:post_entry` |  |  |  |  |  |
| `ledger:reverse_entry`|  |  |  |  |  |
| `ledger:view` |  |  |  |  |  |
| `payment:create` |  |  |  |  |  |
| `payment:allocate` |  |  |  |  |  |
| `shipment:manage` |  |  |  |  |  |
| `shipment:view` |  |  |  |  |  |
| `bank_details:view_masked` |  |  |  |  |  |
| `bank_details:reveal_unmasked` |  |  (Requires Reason) |  |  |  |
| `import:execute` |  |  |  |  |  |
| `audit:view` |  |  |  |  |  |

---

### 3. Masking & Sensitive Field Governance
- **Default Redaction**: In all standard list and detail API responses, bank account numbers are redacted:
  `101502USD2940472` is returned as `101502******0472`.
- **Audited Reveal Mechanism**:
  1. User triggers `POST /api/bank-accounts/:id/reveal` with mandatory business reason.
  2. Server verifies caller holds `bank_details:reveal_unmasked` permission.
  3. Server logs an immutable audit event (`action: "BANK_DETAILS_REVEALED"`, `actor_id`, `ip_address`, `timestamp`, `reason`).
  4. Server returns the unmasked account number for single-view consumption.

---

### 4. Cryptographic Storage & Session Controls
- **Password Storage**: Passwords hashed using bcrypt with work factor 12 (or Argon2id).
- **Session Tokens**: Signed JSON Web Tokens (JWT) with HMAC-SHA256 or RS256, carrying expiration times (1 hour for access tokens; rolling 7-day refresh tokens).
- **Secrets Management**: No secret credentials, database passwords, or private keys are ever checked into source control. All sensitive keys are injected via environment variables (`.env`).
- **Audit Tamper-Resistance**: Audit event logs are append-only. No API endpoint exists to update or delete audit events.
