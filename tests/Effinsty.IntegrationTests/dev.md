# Form 720 MeF Tax Filing Software
## Backend & Oracle Database Development Specification

**Version:** 1.0  
**Date:** January 2024

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Overview & Scope](#project-overview--scope)
3. [Architecture & Technology Stack](#architecture--technology-stack)
4. [System Architecture Diagram](#system-architecture-diagram)
5. [Database Design & Schema](#database-design--schema)
6. [API Specifications](#api-specifications)
7. [Security & Compliance](#security--compliance)
8. [Performance & Scalability](#performance--scalability)
9. [Deployment & DevOps](#deployment--devops)
10. [Testing Strategy](#testing-strategy)
11. [Monitoring & Logging](#monitoring--logging)
12. [Error Handling & Recovery](#error-handling--recovery)

---

## Executive Summary

This document provides a comprehensive technical specification for the backend infrastructure and Oracle database design of the Form 720 MeF (Modernized e-File) tax filing software system. The system is designed to enable businesses and tax professionals to electronically file IRS Form 720 (Excise Tax Return) with full compliance to IRS requirements.

### Key Objectives

- Provide a secure, scalable backend infrastructure for Form 720 tax filing
- Ensure IRS ATS (Assurance Testing System) compliance
- Support multi-tenant SaaS architecture with enterprise-grade performance
- Implement comprehensive audit logging and compliance tracking
- Guarantee data integrity and business continuity

---

## Project Overview & Scope

### 2.1 About Form 720

Form 720 (Excise Tax Return) is filed quarterly by businesses that are liable for federal excise taxes. Key tax categories include:

- Communications and air transportation taxes
- Fuel and diesel fuel taxes
- Heavy truck and trailer taxes
- Firearms and ammunition excise taxes
- Other manufacturer and user taxes

### 2.2 System Scope

- Return preparation and validation
- Electronic filing to IRS via MeF transmission
- Multi-user collaboration and draft management
- Secure transmission of sensitive tax data
- Return status tracking and acknowledgment receipt
- Compliance audit trail and reporting
- Prior year and amended return support

### 2.3 Out of Scope

- Forms other than 720 and its supporting schedules
- Frontend/UI components (separate specification)
- Mobile application (separate project)
- Third-party tax calculation engines (assumed as external service)

---

## Architecture & Technology Stack

### 3.1 Architecture Overview

The system follows a microservices architecture with clear separation of concerns:

| Layer | Components |
|-------|-----------|
| API Gateway | Load balancer, routing, rate limiting, API versioning |
| Microservices | Return Processing, Validation Engine, Filing Service, User Management, Audit Service |
| Data Access | ORM layer, caching (Redis), connection pooling |
| Storage | Oracle Database, S3/Cloud Storage for documents, Document archives |
| External | IRS MeF gateway, Email service, Payment processor |

### 3.2 Technology Stack

| Category | Technology | Rationale |
|----------|-----------|-----------|
| Backend Language | Java 17+ (Spring Boot 3.x) | Enterprise-grade, strong typing, excellent Oracle support, widely used in finance |
| Web Framework | Spring Boot 3.x | Mature ecosystem, excellent transaction management, built-in security features |
| Database | Oracle Database 21c+ | Enterprise reliability, ACID compliance, advanced features (partitioning, compression) |
| ORM | Hibernate + JPA | Database abstraction, relationship management, query optimization |
| Caching | Redis 7.x | High-performance in-memory caching, distributed session support |
| Message Queue | RabbitMQ or Apache Kafka | Asynchronous processing, eventual consistency, audit trail |
| API Documentation | OpenAPI 3.0 + Swagger UI | Standard API specification, interactive testing |
| Logging | ELK Stack (Elasticsearch, Logstash, Kibana) | Centralized logging, real-time analysis, compliance reporting |
| Monitoring | Prometheus + Grafana | Metrics collection, alerting, visualization |
| Container Orchestration | Kubernetes | Scalability, self-healing, declarative management |

### 3.3 Development & Build Tools

- **Build Tool:** Maven 3.9+
- **Source Control:** Git (GitHub Enterprise)
- **CI/CD:** Jenkins + GitOps (ArgoCD)
- **Code Quality:** SonarQube, Checkmarx
- **Testing Frameworks:** JUnit 5, Mockito, Testcontainers

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│            (Web UI, Mobile Apps - separate specs)            │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    API Gateway                              │
│        (Load Balancer, Rate Limiting, Auth Check)          │
└────────────────────┬────────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼────────┐  ┌───▼────────┐  ┌───▼────────┐
│  Return    │  │ Validation │  │   Filing   │
│ Processing │  │   Engine   │  │  Service   │
│ Service    │  │ Service    │  │            │
└───┬────────┘  └───┬────────┘  └───┬────────┘
    │                │                │
    └────────────────┼────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼──────┐   ┌────▼────┐    ┌─────▼────┐
│  Redis   │   │ Message  │    │ User Mgmt │
│ Cache    │   │  Queue   │    │ Service   │
└──────────┘   └──────────┘    └──────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                 Oracle Database                             │
│  (FORM_720_RETURNS, AUDIT_LOG, LINE_ITEMS, etc)            │
└────────────────────┬────────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼──────┐   ┌────▼────┐    ┌─────▼────┐
│  S3/Cloud│   │ ELK Stack│    │IRS MeF   │
│ Storage  │   │  Logging │    │ Gateway  │
└──────────┘   └──────────┘    └──────────┘
```

---

## Database Design & Schema

### 5.1 Database Architecture

- OLTP (Online Transaction Processing) optimized
- Oracle RAC (Real Application Clusters) for high availability
- Partitioning by tax year and quarter for performance
- Data Guard for disaster recovery
- Automated backup and recovery procedures

### 5.2 Core Tables

#### 5.2.1 USERS

```sql
CREATE TABLE USERS (
  user_id            VARCHAR2(36) PRIMARY KEY,
  username           VARCHAR2(100) NOT NULL UNIQUE,
  email              VARCHAR2(255) NOT NULL,
  password_hash      VARCHAR2(255) NOT NULL,
  user_role          VARCHAR2(50) NOT NULL,
  organization_id    VARCHAR2(36) REFERENCES ORGANIZATIONS(org_id),
  created_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
  is_active          CHAR(1) DEFAULT 'Y',
  mfa_enabled        CHAR(1) DEFAULT 'Y',
  last_login         TIMESTAMP,
  CONSTRAINT CK_USERS_IS_ACTIVE CHECK (is_active IN ('Y','N')),
  CONSTRAINT CK_USERS_MFA_ENABLED CHECK (mfa_enabled IN ('Y','N')),
  CONSTRAINT CK_USERS_ROLE CHECK (user_role IN ('Admin','Preparer','Reviewer','Filer'))
);
```

**Columns:**
- `user_id`: Primary key (UUID)
- `username`: Unique username for login
- `email`: Contact email
- `password_hash`: Bcrypt hashed password
- `user_role`: Admin, Preparer, Reviewer, Filer
- `organization_id`: Foreign key to ORGANIZATIONS
- `created_at`, `updated_at`: Audit timestamps
- `is_active`: Soft delete flag
- `mfa_enabled`: Multi-factor authentication status
- `last_login`: Last successful login time

#### 5.2.2 ORGANIZATIONS

```sql
CREATE TABLE ORGANIZATIONS (
  org_id            VARCHAR2(36) PRIMARY KEY,
  org_name          VARCHAR2(255) NOT NULL,
  ein               VARCHAR2(10) NOT NULL UNIQUE,
  created_at        TIMESTAMP DEFAULT SYSTIMESTAMP,
  subscription_tier VARCHAR2(50) NOT NULL,
  max_users         NUMBER(5),
  is_active         CHAR(1) DEFAULT 'Y',
  CONSTRAINT CHK_ORGANIZATIONS_SUBSCRIPTION_TIER CHECK (subscription_tier IN ('Free','Pro','Enterprise')),
  CONSTRAINT CHK_ORGANIZATIONS_IS_ACTIVE CHECK (is_active IN ('Y','N'))
);
```

**Columns:**
- `org_id`: Primary key (UUID)
- `org_name`: Organization name
- `ein`: Employer Identification Number (unique)
- `created_at`: Account creation timestamp
- `subscription_tier`: Free, Pro, Enterprise
- `max_users`: User limit for subscription
- `is_active`: Active/inactive status

#### 5.2.3 FORM_720_RETURNS

```sql
CREATE TABLE FORM_720_RETURNS (
  return_id              VARCHAR2(36) PRIMARY KEY,
  org_id                 VARCHAR2(36) NOT NULL REFERENCES ORGANIZATIONS(org_id),
  tax_year               NUMBER(4) NOT NULL,
  tax_quarter            NUMBER(1) NOT NULL,
  return_status          VARCHAR2(50) NOT NULL,
  filing_type            VARCHAR2(50) NOT NULL,
  created_by             VARCHAR2(36) REFERENCES USERS(user_id),
  created_at             TIMESTAMP DEFAULT SYSTIMESTAMP,
  submitted_at           TIMESTAMP,
  irs_receipt_id         VARCHAR2(50),
  irs_confirmation_number VARCHAR2(50),
  total_tax_amount       NUMBER(15,2),
  total_liability        NUMBER(15,2),
  notes                  CLOB,
  CONSTRAINT chk_form720_return_status CHECK (
    return_status IN ('DRAFT','SUBMITTED','ACCEPTED','REJECTED','AMENDED')
  ),
  CONSTRAINT chk_form720_filing_type CHECK (
    filing_type IN ('ORIGINAL','AMENDED','REPLACEMENT')
  ),
  CONSTRAINT chk_form720_tax_quarter CHECK (tax_quarter IN (1,2,3,4))
) PARTITION BY RANGE (tax_year)
  SUBPARTITION BY LIST (tax_quarter)
  SUBPARTITION TEMPLATE (
    SUBPARTITION q1 VALUES (1),
    SUBPARTITION q2 VALUES (2),
    SUBPARTITION q3 VALUES (3),
    SUBPARTITION q4 VALUES (4)
  );
```

**Columns:**
- `return_id`: Primary key (UUID)
- `org_id`: Organization filing the return
- `tax_year`, `tax_quarter`: Filing period
- `return_status`: DRAFT, SUBMITTED, ACCEPTED, REJECTED, AMENDED
- `filing_type`: ORIGINAL, AMENDED, REPLACEMENT
- `created_by`: User who created the return
- `created_at`, `submitted_at`: Key timestamps
- `irs_receipt_id`: IRS-provided receipt ID
- `irs_confirmation_number`: IRS confirmation for accepted returns
- `total_tax_amount`: Sum of all tax liabilities
- `total_liability`: Including penalties/interest
- `notes`: CLOB for filer notes

#### 5.2.4 RETURN_LINE_ITEMS

```sql
CREATE TABLE RETURN_LINE_ITEMS (
  line_id              VARCHAR2(36) PRIMARY KEY,
  return_id            VARCHAR2(36) NOT NULL REFERENCES FORM_720_RETURNS(return_id),
  schedule             VARCHAR2(50) NOT NULL,
  tax_code             VARCHAR2(10) NOT NULL,
  description          VARCHAR2(500),
  quantity             NUMBER(15,2),
  rate                 NUMBER(15,6),
  amount               NUMBER(15,2) NOT NULL,
  validation_status    VARCHAR2(50) DEFAULT 'PENDING',
  validation_errors    CLOB,
  created_at           TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at           TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT chk_return_line_items_validation_status CHECK (
    validation_status IN ('PENDING','VALID','INVALID')
  )
);

CREATE INDEX idx_return_line_items_return_id ON RETURN_LINE_ITEMS(return_id);
CREATE INDEX idx_return_line_items_tax_code ON RETURN_LINE_ITEMS(tax_code);
```

**Columns:**
- `line_id`: Primary key
- `return_id`: Foreign key to FORM_720_RETURNS
- `schedule`: Schedule A, B, C, D, etc.
- `tax_code`: IRS tax code for the line item
- `description`: Description of taxable item
- `quantity`: Units or measurement
- `rate`: Tax rate percentage or per-unit amount
- `amount`: Calculated tax amount
- `validation_status`: PENDING, VALID, INVALID
- `validation_errors`: JSON array of validation messages

#### 5.2.5 AUDIT_LOG

```sql
CREATE TABLE AUDIT_LOG (
  audit_id         VARCHAR2(36) PRIMARY KEY,
  user_id          VARCHAR2(36) REFERENCES USERS(user_id),
  return_id        VARCHAR2(36) REFERENCES FORM_720_RETURNS(return_id),
  action           VARCHAR2(100) NOT NULL,
  action_timestamp TIMESTAMP DEFAULT SYSTIMESTAMP,
  ip_address       VARCHAR2(45),
  user_agent       VARCHAR2(500),
  changes          CLOB,
  status_before    VARCHAR2(50),
  status_after     VARCHAR2(50)
);

CREATE INDEX idx_audit_log_return_id ON AUDIT_LOG(return_id);
CREATE INDEX idx_audit_log_user_id ON AUDIT_LOG(user_id);
CREATE INDEX idx_audit_log_timestamp ON AUDIT_LOG(action_timestamp);
```

**Columns:**
- `audit_id`: Primary key
- `user_id`: User performing the action
- `return_id`: Return being modified
- `action`: CREATE, UPDATE, SUBMIT, DELETE, etc.
- `action_timestamp`: When the action occurred
- `ip_address`: Source IP address
- `user_agent`: Client user agent string
- `changes`: JSON with field-level changes
- `status_before`, `status_after`: State transition tracking

#### 5.2.6 FILING_TRANSACTIONS

```sql
CREATE TABLE FILING_TRANSACTIONS (
  transaction_id       VARCHAR2(36) PRIMARY KEY,
  return_id            VARCHAR2(36) NOT NULL REFERENCES FORM_720_RETURNS(return_id),
  irs_transaction_id   VARCHAR2(50),
  submission_timestamp TIMESTAMP NOT NULL,
  acceptance_timestamp TIMESTAMP,
  filing_method        VARCHAR2(50) NOT NULL,
  transmission_status  VARCHAR2(50) NOT NULL,
  retry_count          NUMBER(3) DEFAULT 0,
  error_message        CLOB,
  irs_response_code    VARCHAR2(10),
  created_at           TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT CK_FILING_TRANSACTIONS_FILING_METHOD CHECK (
    filing_method IN ('MEF','FIRE')
  ),
  CONSTRAINT CK_FILING_TRANSACTIONS_TRANSMISSION_STATUS CHECK (
    transmission_status IN ('PENDING','SUBMITTED','ACCEPTED','REJECTED')
  )
);

CREATE INDEX idx_filing_trans_return_id ON FILING_TRANSACTIONS(return_id);
CREATE INDEX idx_filing_trans_status ON FILING_TRANSACTIONS(transmission_status);
```

**Columns:**
- `transaction_id`: Primary key
- `return_id`: Associated return
- `irs_transaction_id`: IRS-assigned transaction ID
- `submission_timestamp`: When sent to IRS
- `acceptance_timestamp`: When IRS accepted it
- `filing_method`: MeF, FIRE, etc.
- `transmission_status`: PENDING, SUBMITTED, ACCEPTED, REJECTED
- `retry_count`: Number of retry attempts
- `error_message`: IRS error response
- `irs_response_code`: IRS response code
- `created_at`: Record creation time

### 5.3 Indexing Strategy

All tables include indexes on:
- Primary keys (automatic)
- Foreign keys (automatic)
- Frequently searched columns: `org_id`, `tax_year`, `return_status`
- Composite indexes for common WHERE clauses
- Partitioned indexes for large tables

**Example composite index:**
```sql
CREATE INDEX idx_form720_org_year_quarter ON FORM_720_RETURNS(org_id, tax_year, tax_quarter);
```

### 5.4 Data Partitioning

The `FORM_720_RETURNS` table is partitioned by:
1. **Range partition** on `tax_year` (separate partition per year)
2. **Sub-partition** on `tax_quarter` (Q1, Q2, Q3, Q4)

```sql
CREATE TABLE FORM_720_RETURNS (
  -- columns ...
) PARTITION BY RANGE (tax_year)
  SUBPARTITION BY LIST (tax_quarter);
```

**Benefits:**
- Improved query performance for year/quarter lookups
- Easier maintenance and archival of old data
- Parallel query execution
- Reduced table scan times

### 5.5 Data Retention Policy

| Data Type | Retention Period | Action |
|-----------|-----------------|--------|
| Active returns | Indefinite | Keep in online storage |
| Draft returns (>90 days old) | 90 days | Archive to cold storage |
| Accepted/rejected returns | 7 years | Keep per tax code requirements |
| Audit logs | 90 days online | 7 years archived |
| Failed transmissions | 2 years | Archive after 2 years |

---

## API Specifications

### 6.1 API Design Principles

- RESTful design with proper HTTP methods and status codes
- Versioning via URL path prefix: `/api/v1/`
- JSON request/response format
- Pagination for list endpoints (limit, offset)
- Comprehensive error responses with error codes

### 6.2 Core API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/returns` | List all returns for organization |
| POST | `/api/v1/returns` | Create new draft return |
| GET | `/api/v1/returns/{id}` | Get specific return details |
| PUT | `/api/v1/returns/{id}` | Update return |
| DELETE | `/api/v1/returns/{id}` | Delete draft return |
| POST | `/api/v1/returns/{id}/validate` | Validate return data |
| POST | `/api/v1/returns/{id}/submit` | Submit return to IRS |
| GET | `/api/v1/returns/{id}/status` | Check filing status |
| GET | `/api/v1/returns/{id}/audit-trail` | Get audit history |
| POST | `/api/v1/returns/{id}/line-items` | Add line items to return |
| DELETE | `/api/v1/returns/{id}/line-items/{line_id}` | Remove line item |

### 6.3 Authentication & Authorization

- **Method:** OAuth 2.0 with JWT tokens
- **RBAC:** Role-based access control with roles: Admin, Preparer, Reviewer, Filer
- **MFA:** Multi-factor authentication required for all users
- **Token Expiration:** 1 hour for access tokens, 7 days for refresh tokens
- **Scopes:** Granular permission scopes for API endpoints

**Example JWT Payload:**
```json
{
  "sub": "user-uuid",
  "email": "user@company.com",
  "org_id": "org-uuid",
  "role": "preparer",
  "scopes": ["returns:read", "returns:write", "returns:submit"],
  "iat": 1705317000,
  "exp": 1705320600
}
```

### 6.3.1 Authorization Appendix (Scopes)

**Valid OAuth scopes:**

- `returns:read`
- `returns:write`
- `returns:submit`
- `returns:delete`
- `users:manage`
- `audit:read`

**Scope-to-role mapping** (aligned with the Role Permissions Matrix in section 7.2):

| Role | Allowed Scopes |
|------|----------------|
| Admin | `returns:read`, `returns:write`, `returns:submit`, `returns:delete`, `users:manage`, `audit:read` |
| Preparer | `returns:read`, `returns:write`, `audit:read` |
| Reviewer | `returns:read`, `returns:submit`, `audit:read` |
| Filer | `returns:read`, `returns:submit` |

**Scope-to-endpoint mapping:**

| Endpoint | Required Scope |
|----------|----------------|
| `GET /api/v1/returns` | `returns:read` |
| `POST /api/v1/returns` | `returns:write` |
| `PUT /api/v1/returns/{id}` | `returns:write` |
| `DELETE /api/v1/returns/{id}` | `returns:delete` |
| `POST /api/v1/returns/{id}/submit` | `returns:submit` |
| `GET /api/v1/returns/{id}/audit-trail` | `audit:read` |
| user management endpoints | `users:manage` |

### 6.4 Response Formats

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "return_id": "uuid",
    "org_id": "org-uuid",
    "tax_year": 2024,
    "tax_quarter": 1,
    "return_status": "DRAFT",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req-uuid"
}
```

#### Error Response (4xx/5xx)

```json
{
  "success": false,
  "error_code": "VALIDATION_ERROR",
  "message": "Field 'tax_year' is required",
  "details": [
    {
      "field": "tax_year",
      "issue": "missing",
      "code": "REQUIRED_FIELD"
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req-uuid"
}
```

### 6.5 List Endpoint Pagination

**Request:**
```
GET /api/v1/returns?limit=25&offset=0&sort_by=created_at&sort_order=desc
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "return_id": "...", "tax_year": 2024, ... },
    { "return_id": "...", "tax_year": 2024, ... }
  ],
  "pagination": {
    "total": 150,
    "limit": 25,
    "offset": 0,
    "has_more": true
  }
}
```

### 6.6 Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| VALIDATION_ERROR | 400 | Request validation failed |
| UNAUTHORIZED | 401 | Missing or invalid authentication |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource already exists or status conflict |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Unexpected server error |
| SERVICE_UNAVAILABLE | 503 | IRS gateway or external service unavailable |
| IRS_TRANSMISSION_ERROR | 502 | IRS MeF gateway error |

---

## Security & Compliance

### 7.1 Data Security

- **Encryption at Rest:** Oracle Transparent Data Encryption (TDE) with AES-256 at the tablespace level
- **Encryption in Transit:** TLS 1.3 for all API calls and database connections
- **Database Encryption Mode:** TDE-only in this specification (no additional field-level encryption layer required)
- **Key Rotation:** Every 90 days using automated key management

**Sensitive Data Covered by TDE:**
```
- SSN (Social Security Numbers)
- EIN (Employer Identification Numbers)
- Routing numbers
- Bank account numbers
- Credit card numbers (PCI-DSS if stored)
- Tax identification documents
```

### 7.2 Access Control

- **Authentication:** OAuth 2.0 + JWT tokens
- **Authorization:** Role-based access control (RBAC)
- **Roles:** Admin, Preparer, Reviewer, Filer
- **Organization Isolation:** Data strictly isolated by organization
- **IP Whitelisting:** Optional for sensitive operations
- **Session Management:** Automatic logout after 30 minutes of inactivity
- **Audit Logging:** All access attempts logged

**Role Permissions Matrix:**

| Action | Admin | Preparer | Reviewer | Filer |
|--------|-------|----------|----------|-------|
| Create Return | ✓ | ✓ | ✗ | ✗ |
| Edit Return | ✓ | ✓ | ✗ | ✗ |
| Review Return | ✓ | ✓ | ✓ | ✗ |
| Submit to IRS | ✓ | ✗ | ✓ | ✓ |
| View Audit Log | ✓ | ✓ | ✓ | ✗ |
| Manage Users | ✓ | ✗ | ✗ | ✗ |

### 7.3 IRS Compliance Requirements

- **IRS ATS Certification:** Software must pass IRS Assurance Testing System
- **Software Identification Number (SID):** Valid, current SID required
- **XML Schema Validation:** Strict compliance with IRS Form 720 XML schema
- **Business Rules:** Implementation of all IRS business logic rules
- **Digital Signature:** ECDSA certificate for return signing
- **MeF Transmission:** Compliance with IRS MeF transmission protocols
- **Error Handling:** Proper handling of IRS validation errors

### 7.4 Regulatory Compliance

- **SOC 2 Type II:** Annual audit and certification
- **GDPR:** Compliance for EU residents (data minimization, right to delete)
- **CCPA/CPRA:** California privacy requirements
- **HIPAA-adjacent:** PII handling procedures (not true HIPAA but similar safeguards)
- **FinCEN:** Beneficial ownership reporting compliance
- **Data Residency:** Option for data to remain within US borders

### 7.5 Security Best Practices

- **Password Policy:** Minimum 12 characters, complexity requirements
- **Password Hashing:** bcrypt with cost factor 12+
- **MFA:** TOTP or hardware security keys required
- **API Rate Limiting:** 100 requests per minute per user
- **CORS:** Whitelist specific frontend origins
- **CSRF Protection:** SameSite cookies, CSRF tokens
- **SQL Injection Prevention:** Parameterized queries, ORM usage
- **XSS Protection:** Input validation and output encoding
- **Security Headers:** HSTS, Content-Security-Policy, X-Frame-Options

---

## Performance & Scalability

### 8.1 Performance Targets

| Operation | Target P99 | Acceptable Range |
|-----------|-----------|-----------------|
| Retrieve return list | 500 ms | 300-700 ms |
| Get return details | 200 ms | 100-400 ms |
| Validate return | 1000 ms | 800-1500 ms |
| Submit to IRS | 2000 ms | 1500-3000 ms |
| API availability | 99.99% | 99.95%-99.99% |
| Database availability | 99.999% | 99.99%-99.999% |

### 8.2 Scalability Architecture

- **API Servers:** Horizontal scaling from 2 to 20 instances based on load
- **Database:** Oracle RAC with up to 4 nodes for high availability
- **Cache Layer:** Redis cluster with automatic failover and sharding
- **Message Queue:** Kafka cluster with 3+ brokers for redundancy
- **Load Balancing:** AWS NLB or similar with health checks
- **Auto-scaling:** Kubernetes HPA based on CPU/memory metrics
- **CDN:** CloudFront or similar for static assets

### 8.3 Caching Strategy

| Data Type | TTL | Invalidation |
|-----------|-----|-------------|
| Return metadata | 1 hour | On update |
| Tax codes/schedules | 24 hours | On midnight UTC |
| User permissions | 15 minutes | On role/permission change |
| Validation rules | 1 hour | On rule update |
| Organization settings | 1 hour | On setting change |

**Cache Invalidation Pattern:**
```java
// After updating return
cache.invalidate("return:" + returnId);
cache.invalidate("org:" + orgId + ":returns");

// After permission change
cache.invalidate("user:" + userId + ":permissions");
```

### 8.4 Database Optimization

- **Connection Pooling:** HikariCP with 20-50 connections
- **Query Optimization:** EXPLAIN PLAN analysis for slow queries
- **Statistics:** Automatic statistics collection daily
- **Hints:** Manual hints for complex queries if needed
- **Materialized Views:** For common reports
- **Partitioning:** By year/quarter for efficient scanning

---

## Deployment & DevOps

### 9.1 Deployment Infrastructure

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Containerization | Docker | Lightweight, consistent environments |
| Orchestration | Kubernetes (EKS/AKE) | Scalability, self-healing |
| Infrastructure | Terraform | IaC, reproducible deployments |
| GitOps | ArgoCD | Declarative, version-controlled deployments |
| Secrets Management | AWS Secrets Manager / Vault | Secure credential storage |
| Artifact Registry | Docker Hub / ECR | Container image storage |

### 9.2 Environments

| Environment | Purpose | Scale |
|-------------|---------|-------|
| Development | Developer testing | 1-2 instances |
| Staging | Pre-production testing | 2-3 instances (production-like) |
| Production | Live system | 4-20 instances (auto-scaling) |
| DR (Standby) | Disaster recovery | 2-4 instances (warm standby) |

### 9.3 CI/CD Pipeline

1. **Source Control:** Git commit triggers pipeline
2. **Build:**
   - Checkout code
   - Maven build
   - Unit tests (JUnit 5)
   - Code quality analysis (SonarQube)
   - Security scanning (Checkmarx)
3. **Artifact:**
   - Build Docker image
   - Push to registry with version tag
4. **Test:**
   - Deploy to staging
   - Integration tests
   - Performance tests
   - Security tests
5. **Approval:**
   - Manual approval required for production
   - Slack notification to team
6. **Deploy:**
   - Apply Kubernetes manifests via ArgoCD
   - Database migrations (Flyway)
   - Health checks
   - Smoke tests
7. **Monitor:**
   - Log aggregation
   - Metrics collection
   - Alert team on failures

**Pipeline Stages:**
```yaml
stages:
  - build (10 min)
  - test (15 min)
  - quality-gate (5 min)
  - staging-deploy (5 min)
  - staging-tests (20 min)
  - production-approval (manual)
  - production-deploy (10 min)
  - smoke-tests (5 min)
```

### 9.4 Backup & Disaster Recovery

**Backup Strategy:**
- Oracle RMAN daily full backup + hourly incremental for long-term recovery
- Backup location: Separate storage in same region
- Off-site backup: Daily copies to secondary region
- Backup verification: Monthly restore tests

**Disaster Recovery:**
- **RPO (Recovery Point Objective):** 15 minutes
- **RTO (Recovery Time Objective):** 1 hour
- **Solution:** Data Guard with standby database in different region (near-synchronous replication provides the 15-minute RPO target)
- **Failover:** Automated if primary becomes unavailable
- **Manual Failover:** Documented procedures for controlled switchover

Hourly RMAN incrementals support restore depth and retention, while Data Guard is the mechanism used to satisfy failover RPO.

**Backup Schedule:**
```
Daily 2:00 AM UTC: Full backup
Hourly at :30: Incremental backup
Weekly Sunday: Off-site backup copy
Monthly: Restore test to validate backups
Quarterly: Disaster recovery drill
```

### 9.5 Infrastructure as Code

**Terraform structure:**
```
terraform/
├── main.tf (VPC, networking)
├── rds.tf (Oracle database)
├── redis.tf (cache cluster)
├── eks.tf (Kubernetes cluster)
├── iam.tf (IAM roles/policies)
├── variables.tf (configuration)
└── outputs.tf (exported values)
```

---

## Testing Strategy

### 10.1 Testing Levels

| Test Type | Coverage Target | Tools | Execution |
|-----------|-----------------|-------|-----------|
| Unit Tests | 80% code coverage | JUnit 5, Mockito, PowerMock | Per commit |
| Integration Tests | Database, API, message queue | Testcontainers, Wiremock | Per PR |
| API Tests | All endpoints, error cases | REST Assured, Postman | Per commit |
| Validation Tests | All Form 720 business rules | Custom validators | Per feature |
| Performance Tests | Meet P99 latency targets | JMeter, Gatling | Weekly |
| Security Tests | OWASP Top 10, encryption | OWASP ZAP, Checkmarx | Monthly |
| E2E Tests | Complete return lifecycle | Selenium, Cucumber | Pre-release |
| IRS Compliance Tests | XML schema, filing rules | Custom test suite | Per feature |
| Regression Tests | No functionality broken | Automated suite | Per deployment |

### 10.2 Unit Testing Standards

**Coverage Requirements:**
- Overall: 80% code coverage minimum
- Critical paths: 95% coverage required
- Controllers/APIs: 90% coverage
- Business logic: 90% coverage
- Utilities: 70% coverage

**Example Test Structure:**
```java
@Test
void shouldValidateReturnWithValidData() {
    // Arrange
    Form720Return return = buildValidReturn();
    
    // Act
    ValidationResult result = validator.validate(return);
    
    // Assert
    assertThat(result.isValid()).isTrue();
    assertThat(result.getErrors()).isEmpty();
}

@Test
void shouldRejectReturnWithMissingTaxYear() {
    // Arrange
    Form720Return return = buildReturnWithoutTaxYear();
    
    // Act
    ValidationResult result = validator.validate(return);
    
    // Assert
    assertThat(result.isValid()).isFalse();
    assertThat(result.getErrors())
        .contains("Tax year is required");
}
```

### 10.3 Integration Testing

**Database Integration Tests:**
```java
@DataJpaTest
@ActiveProfiles("test")
class Form720ReturnRepositoryTest {
    
    @Autowired
    private Form720ReturnRepository repository;
    
    @Autowired
    private TestEntityManager em;
    
    @Test
    void shouldSaveAndRetrieveReturn() {
        Form720Return return = new Form720Return();
        // ... setup ...
        
        Form720Return saved = repository.save(return);
        em.flush();
        
        Form720Return retrieved = repository.findById(saved.getId()).orElse(null);
        assertThat(retrieved).isNotNull();
        assertThat(retrieved.getTaxYear()).isEqualTo(2024);
    }
}
```

### 10.4 API Testing

**REST API Tests:**
```java
@SpringBootTest
@AutoConfigureMockMvc
class Form720ApiTest {
    
    @Autowired
    private MockMvc mockMvc;
    
    @Test
    void shouldCreateReturn() throws Exception {
        CreateReturnRequest request = new CreateReturnRequest();
        request.setTaxYear(2024);
        request.setTaxQuarter(1);
        
        mockMvc.perform(post("/api/v1/returns")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.return_id").exists());
    }
}
```

### 10.5 Performance Testing

**Load Test Scenarios:**
- 100 concurrent users creating returns
- 500 concurrent users listing returns
- 50 concurrent users validating returns
- Sustained load: 200 requests/second for 10 minutes

**JMeter Test Plan:**
```
Thread Group: 100 users, 1 minute ramp-up
Requests:
- GET /api/v1/returns (30%)
- POST /api/v1/returns (20%)
- PUT /api/v1/returns/{id} (20%)
- POST /api/v1/returns/{id}/validate (20%)
- POST /api/v1/returns/{id}/submit (10%)
```

### 10.6 Security Testing

**OWASP Top 10 Testing:**
1. Injection attacks (SQL, command injection)
2. Broken authentication
3. Sensitive data exposure
4. XML External Entities (XXE)
5. Broken access control
6. Security misconfiguration
7. Cross-site scripting (XSS)
8. Insecure deserialization
9. Using components with known vulnerabilities
10. Insufficient logging & monitoring

**Tools:**
- Checkmarx for static analysis
- OWASP ZAP for dynamic testing
- Dependency-check for vulnerable dependencies

### 10.7 IRS Compliance Testing

**Form 720 Validation Tests:**
```java
@Test
void shouldValidateTaxCodeFormula() {
    // Test: Schedule A tax code 001 formula
    ReturnLineItem item = new ReturnLineItem();
    item.setTaxCode("001");
    item.setQuantity(100);
    item.setRate(0.11);
    
    BigDecimal calculated = validator.calculateAmount(item);
    assertThat(calculated).isEqualTo(new BigDecimal("11.00"));
}

@Test
void shouldRejectInvalidScheduleACombination() {
    // Test: Cannot combine certain tax codes
    List<ReturnLineItem> items = List.of(
        item("001", "Communications"),
        item("010", "Air Transportation")
    );
    
    ValidationResult result = validator.validateScheduleRules(items);
    assertThat(result.isValid()).isFalse();
}
```

---

## Monitoring & Logging

### 11.1 Monitoring Framework

**Metrics Collected:**

| Metric | Type | Alerting |
|--------|------|----------|
| Request latency (P50, P95, P99) | Histogram | P99 > 5s |
| Request throughput | Counter | < 10 req/s during business hours |
| API error rate | Counter | > 1% |
| Database connection pool | Gauge | Usage > 80% |
| Cache hit ratio | Gauge | < 70% |
| Message queue depth | Gauge | > 1000 messages |
| Validation failure rate | Counter | > 5% |

**Prometheus Scraping:**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'spring-boot'
    metrics_path: '/actuator/prometheus'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:8080']
```

**Grafana Dashboards:**
1. System Health (CPU, memory, disk)
2. API Performance (latency, throughput, errors)
3. Database Metrics (queries, connections, locks)
4. Business Metrics (returns filed, validations)
5. IRS Filing Status (accepted, rejected, pending)

### 11.2 Logging Strategy

**Log Format:**
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "logger": "com.form720.service.ReturnService",
  "thread": "http-nio-8080-exec-1",
  "request_id": "req-abc123",
  "user_id": "user-uuid",
  "org_id": "org-uuid",
  "message": "Return created successfully",
  "return_id": "return-uuid",
  "tax_year": 2024,
  "duration_ms": 150
}
```

**Log Levels:**
- **DEBUG:** Detailed diagnostic information for development
- **INFO:** General informational messages (return created, filed, etc.)
- **WARN:** Warning messages (deprecated usage, performance issues)
- **ERROR:** Error messages (validation failed, external service error)

**Sensitive Data Masking:**
```
Before: ssn=123-45-6789
After:  ssn=XXX-XX-6789

Before: amount=50000.00
After:  amount=[REDACTED]

Before: password=secretPassword123
After:  password=[REDACTED]
```

### 11.3 Centralized Logging (ELK Stack)

**Logstash Pipeline:**
```
Input: Filebeat from pods
Filter: Parse JSON, extract fields, mask sensitive data
Output: Elasticsearch

Elasticsearch:
- Index pattern: form720-logs-2024.01.15
- Retention: 90 days hot, 7 years archived
- Replicas: 3 for redundancy

Kibana:
- Dashboards for operations team
- Alerts for error spikes
- Saved searches for investigations
```

### 11.4 Alerting Rules

| Condition | Severity | Action |
|-----------|----------|--------|
| API error rate > 1% for 5 min | Critical | Page on-call |
| P99 latency > 5 sec for 10 min | High | Alert Slack #operations |
| Database connection pool > 80% | High | Alert Slack #database |
| Failed IRS transmission | Critical | Page on-call + notify customer |
| Validation failure rate > 10% | Medium | Alert support team |
| Disk usage > 80% | Medium | Create scaling ticket |
| Message queue depth > 5000 | High | Investigate and alert |
| Cache hit ratio < 50% | Medium | Review cache settings |

**Alertmanager Configuration:**
```yaml
route:
  receiver: 'default'
  group_by: ['alertname', 'severity']
  
  routes:
    - match:
        severity: critical
      receiver: 'on-call-pagerduty'
      continue: true
    
    - match:
        severity: high
      receiver: 'slack-operations'

receivers:
  - name: 'on-call-pagerduty'
    pagerduty_configs:
      - service_key: 'xxx'
  
  - name: 'slack-operations'
    slack_configs:
      - channel: '#operations'
        api_url: 'xxx'
```

---

## Error Handling & Recovery

### 12.1 Error Classification

#### Validation Errors (4xx)

| Error Code | HTTP Status | Example |
|-----------|------------|---------|
| VALIDATION_ERROR | 400 | Missing required fields |
| INVALID_TAX_CODE | 400 | Tax code not recognized |
| INVALID_AMOUNT | 400 | Amount out of valid range |
| BUSINESS_RULE_VIOLATION | 400 | Cannot combine schedules A and B |
| DUPLICATE_ENTRY | 409 | Line item already exists |

#### System Errors (5xx)

| Error Code | HTTP Status | Example |
|-----------|------------|---------|
| INTERNAL_ERROR | 500 | Unexpected exception |
| DATABASE_ERROR | 500 | Connection pool exhausted |
| SERVICE_UNAVAILABLE | 503 | Dependent service down |
| IRS_GATEWAY_ERROR | 502 | MeF gateway unreachable |
| TIMEOUT_ERROR | 504 | Operation exceeded time limit |

### 12.2 Error Response Format

```json
{
  "success": false,
  "error_code": "VALIDATION_ERROR",
  "message": "Validation failed for return",
  "details": [
    {
      "field": "tax_code",
      "value": "999",
      "issue": "Invalid tax code",
      "code": "INVALID_TAX_CODE",
      "suggestion": "Valid codes are 001-050"
    }
  ],
  "timestamp": "2024-01-15T10:30:45Z",
  "request_id": "req-uuid",
  "trace_id": "trace-uuid"
}
```

### 12.3 Retry Strategy

**Exponential Backoff:**
```
Attempt 1: Immediately (0 sec)
Attempt 2: After 1 second (1 sec)
Attempt 3: After 2 seconds (3 sec)
Attempt 4: After 4 seconds (7 sec)
Attempt 5: After 8 seconds (15 sec)
Max: 3 retries for transient failures
```

**Retry Policy by Error:**
| Error | Retryable | Max Attempts | Backoff |
|-------|-----------|-------------|---------|
| Connection timeout | Yes | 3 | Exponential |
| Socket timeout | Yes | 3 | Exponential |
| IRS gateway timeout | Yes | 3 | Exponential |
| Invalid input | No | 0 | N/A |
| Authentication failed | No | 0 | N/A |
| Database error | Yes | 2 | Exponential |

**Circuit Breaker Pattern:**
```
Closed: Normal operation
Open: Failing, reject requests immediately
Half-Open: Testing recovery, allow limited requests

Threshold: 5 failures in 1 minute → Open
Recovery: Try half-open after 30 seconds
Success: Close circuit after 10 successful requests
```

### 12.4 IRS Filing Failure Recovery

**Failure Workflow:**
1. **Submission Fails**
   - Log detailed error from IRS
   - Set return status to REJECTED
   - Store IRS error response
   
2. **Notify User**
   - Email with specific error message
   - Show error in dashboard with suggested fixes
   
3. **User Corrects**
   - User edits return based on error
   - Resubmit (creates new filing transaction record)
   
4. **Retry Logic**
   - Automatic retry for transient errors (timeout, gateway unavailable)
   - Manual resubmission for validation errors
   - Track all attempts in audit log

**Example IRS Errors:**
```
Error: "Invalid tax code 999"
Fix: Use only codes 001-050

Error: "Amount exceeds quarterly limit"
Fix: Reduce amount or split across quarters

Error: "Missing EIN on return"
Fix: Ensure EIN is populated and valid
```

### 12.5 Data Consistency

**Transaction Management:**
- All database operations use ACID transactions
- Rollback on any validation or system error
- No partial updates to return data

**Optimistic Locking:**
```java
@Entity
public class Form720Return {
    @Version
    private Long version;
    // other fields
}

// Update only if version matches
repository.save(return); // Throws OptimisticLockException if stale
```

**Message Queue Durability:**
- Messages persisted before processing
- Dead letter queue for failed messages
- Manual review and replay of failed messages

### 12.6 Graceful Degradation

If non-critical services fail:
- **Validation service down:** Allow submission with warning
- **Email service down:** Queue for retry, don't block submission
- **Analytics service down:** Continue normal operation
- **Cache service down:** Fall back to database queries
- **CDN down:** Serve static files directly from origin

---

## Appendix: Database Connection Details

### Connection Pool Configuration

```properties
# HikariCP Settings
spring.datasource.hikari.maximum-pool-size=200
spring.datasource.hikari.minimum-idle=10
spring.datasource.hikari.connection-timeout=20000
spring.datasource.hikari.idle-timeout=300000
spring.datasource.hikari.max-lifetime=1200000
```

Each application instance runs its own Hikari pool and does not share a single global pool. Monitor `spring.datasource.hikari.maximum-pool-size`, `minimum-idle`, `connection-timeout`, `idle-timeout`, and `max-lifetime` per instance, and verify Oracle RAC connection distribution across nodes.

### Oracle Database Requirements

- **Version:** 21c+ or 23c
- **Edition:** Enterprise (for RAC, Partitioning, Encryption)
- **Character Set:** AL32UTF8
- **NLS_LANG:** AMERICAN_AMERICA.AL32UTF8
- **Processes:** Minimum 500
- **SGA Target:** 4GB minimum
- **PGA Aggregate:** 2GB minimum

### Required Oracle Features

- Transparent Data Encryption (TDE)
- Real Application Clusters (RAC)
- Data Guard
- Partitioning
- Compression
- Advanced Security Option (for network encryption)

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-01-15 | Architecture Team | Initial release |

---

## Sign-Off

**Prepared by:** Software Architecture Team  
**Reviewed by:** Technical Leadership  
**Approved by:** Project Sponsor  
**Date:** January 2024

---

*This specification is subject to change and will be updated to reflect system enhancements and evolving requirements.*
