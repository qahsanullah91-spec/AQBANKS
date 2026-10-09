# AQ Companies Logistics & Financial Management System
## Deployment, Disaster Recovery & Backup Procedures

### 1. Deployment Architecture
The system supports two production deployment models:
1. **Containerized Production (Docker / Kubernetes)**: Deploying backend API container, PostgreSQL database container, and Nginx reverse proxy serving the React frontend.
2. **Dedicated On-Premise / Desktop Workstation**: Running the embedded desktop client connected to a secure local/remote backend server.

---

### 2. Docker Compose Specification (`docker-compose.yml`)
The production environment is orchestrated via Docker Compose:
- **`postgres`**: PostgreSQL 16 Alpine with persistent volume storage.
- **`backend`**: Node.js/TypeScript backend API container with non-root user execution, health checks, and connection retry.
- **`frontend`**: Production Vite build served via Nginx with TLS termination, gzip/brotli compression, and security headers.

---

### 3. Automated Backup Strategy

#### 3.1 Database Backup
PostgreSQL database dumps are executed daily via an automated scheduled cron job:
```bash
# Automated Daily Backup Command
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
docker compose exec -T postgres pg_dump -U postgres -d aq_companies_prod -F c -b -v -f /backups/aq_companies_${TIMESTAMP}.dump
```
- **Retention Policy**:
  - Daily backups retained for 30 days.
  - Weekly backups retained for 12 weeks.
  - Monthly backups retained for 7 years.
- **Encryption**: Backups encrypted with AES-256 before offsite upload.

#### 3.2 Document & Invoice Snapshot Archive
- Generated invoice PDFs, issued snapshots, and uploaded spreadsheets are backed up synchronously with the database snapshot.

---

### 4. Restore & Recovery Procedure

To restore the system from a backup dump:
```bash
# 1. Stop backend application to prevent write collisions
docker compose stop backend

# 2. Terminate existing connections and drop target database
docker compose exec -T postgres psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'aq_companies_prod';"
docker compose exec -T postgres dropdb -U postgres --if-exists aq_companies_prod
docker compose exec -T postgres createdb -U postgres aq_companies_prod

# 3. Restore database schema and records from archive
docker compose exec -T postgres pg_restore -U postgres -d aq_companies_prod -v /backups/aq_companies_YYYYMMDD_HHMMSS.dump

# 4. Restart backend and verify health
docker compose start backend
curl -f http://localhost:4000/api/health
```

---

### 5. Health Checks & Observability
- **Health Check Endpoint**: `GET /api/health`
  - Returns `200 OK` with status `pass`, database connection latency, system uptime, and version.
  - Returns `503 Service Unavailable` if database connectivity fails.
- **Structured JSON Logging**: Logs formatted in JSON with log levels (`INFO`, `WARN`, `ERROR`), request IDs, timestamps, and caller context. Sensitive banking credentials and passwords are automatically redacted.
