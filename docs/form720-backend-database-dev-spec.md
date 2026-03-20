# Effinsty Form 720
## Backend + Oracle Database Development Specification (Effinsty Adaptation)

**Version:** 1.0  
**Date:** 2026-03-16  
**Status:** Draft for implementation  
**Source Input:** `tests/Effinsty.IntegrationTests/dev.md`

---

## 1. Purpose

This specification translates the Form 720 DEC requirements into the current Effinsty architecture:

- Backend: F# + Giraffe (`src/Effinsty.Api`, `src/Effinsty.Application`, `src/Effinsty.Infrastructure`)
- Database: Oracle schema-per-tenant model (`<TENANT_SCHEMA>.*`)
- Security model: JWT scopes + tenant isolation + SOC1 controls already documented in `soc1.md`

This document is the implementation baseline for database schema, backend domain/application/infrastructure changes, and API contract additions for Form 720 return lifecycle features.

---

## 2. Scope

### 2.1 In Scope

- Form 720 return lifecycle: draft, validation, submission, status tracking, audit trail
- Form line-item data model and persistence
- Filing transaction tracking and retry metadata
- Organization-scoped return search and pagination
- API endpoints for return CRUD + workflow actions
- Backend validation and error contract extension

### 2.2 Out of Scope (for this phase)

- IRS transport implementation details beyond defined backend interfaces
- Non-Form 720 tax forms
- Mobile app clients
- Replacing current auth/session architecture

---

## 3. Canonical Status Models

### 3.1 Return Status

- `DRAFT`
- `VALIDATING`
- `VALID`
- `INVALID`
- `SUBMITTED`
- `ACCEPTED`
- `REJECTED`
- `AMENDED`
- `ARCHIVED`

### 3.2 Filing Type

- `ORIGINAL`
- `AMENDED`
- `REPLACEMENT`

### 3.3 Transmission Status

- `PENDING`
- `SUBMITTED`
- `ACCEPTED`
- `REJECTED`
- `RETRY_SCHEDULED`
- `FAILED_PERMANENT`

---

## 4. Oracle Schema Specification

All objects are tenant-local and created per tenant schema (`<TENANT_SCHEMA>`). Existing tables (`USERS`, `CONTACTS`, `SESSIONS`, audit logs) remain unchanged.

### 4.1 `ORGANIZATIONS`

```sql
CREATE TABLE <TENANT_SCHEMA>.ORGANIZATIONS (
    ORG_ID              VARCHAR2(36) PRIMARY KEY,
    TENANT_ID           VARCHAR2(64) NOT NULL,
    ORG_NAME            VARCHAR2(255) NOT NULL,
    EIN                 VARCHAR2(9) NOT NULL,
    SUBSCRIPTION_TIER   VARCHAR2(50) NOT NULL,
    MAX_USERS           NUMBER(5),
    IS_ACTIVE           NUMBER(1,0) DEFAULT 1 NOT NULL,
    CREATED_AT          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UPDATED_AT          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT UX_ORGANIZATIONS_EIN UNIQUE (EIN),
    CONSTRAINT CK_ORGANIZATIONS_ACTIVE CHECK (IS_ACTIVE IN (0,1))
);

CREATE INDEX IX_ORGANIZATIONS_TENANT_ACTIVE
    ON <TENANT_SCHEMA>.ORGANIZATIONS (TENANT_ID, IS_ACTIVE);
```

### 4.2 `FORM_720_RETURNS`

```sql
CREATE TABLE <TENANT_SCHEMA>.FORM_720_RETURNS (
    RETURN_ID                VARCHAR2(36) PRIMARY KEY,
    TENANT_ID                VARCHAR2(64) NOT NULL,
    ORG_ID                   VARCHAR2(36) NOT NULL,
    TAX_YEAR                 NUMBER(4) NOT NULL,
    TAX_QUARTER              NUMBER(1) NOT NULL,
    RETURN_STATUS            VARCHAR2(30) NOT NULL,
    FILING_TYPE              VARCHAR2(20) NOT NULL,
    CREATED_BY               VARCHAR2(36) NOT NULL,
    UPDATED_BY               VARCHAR2(36),
    CREATED_AT               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UPDATED_AT               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    SUBMITTED_AT             TIMESTAMP WITH TIME ZONE,
    IRS_RECEIPT_ID           VARCHAR2(64),
    IRS_CONFIRMATION_NUMBER  VARCHAR2(64),
    TOTAL_TAX_AMOUNT         NUMBER(15,2) DEFAULT 0 NOT NULL,
    TOTAL_LIABILITY          NUMBER(15,2) DEFAULT 0 NOT NULL,
    NOTES                    CLOB,
    VERSION_NO               NUMBER(10) DEFAULT 1 NOT NULL,
    CONSTRAINT FK_RETURNS_ORG FOREIGN KEY (ORG_ID)
        REFERENCES <TENANT_SCHEMA>.ORGANIZATIONS (ORG_ID),
    CONSTRAINT CK_RETURNS_QUARTER CHECK (TAX_QUARTER IN (1,2,3,4)),
    CONSTRAINT CK_RETURNS_STATUS CHECK (
        RETURN_STATUS IN ('DRAFT','VALIDATING','VALID','INVALID','SUBMITTED','ACCEPTED','REJECTED','AMENDED','ARCHIVED')
    ),
    CONSTRAINT CK_RETURNS_FILING_TYPE CHECK (
        FILING_TYPE IN ('ORIGINAL','AMENDED','REPLACEMENT')
    )
)
PARTITION BY RANGE (TAX_YEAR)
SUBPARTITION BY LIST (TAX_QUARTER)
SUBPARTITION TEMPLATE (
    SUBPARTITION Q1 VALUES (1),
    SUBPARTITION Q2 VALUES (2),
    SUBPARTITION Q3 VALUES (3),
    SUBPARTITION Q4 VALUES (4)
)
(
    PARTITION P2024 VALUES LESS THAN (2025),
    PARTITION P2025 VALUES LESS THAN (2026),
    PARTITION PMAX VALUES LESS THAN (MAXVALUE)
);

CREATE INDEX IX_RETURNS_ORG_YEAR_QUARTER
    ON <TENANT_SCHEMA>.FORM_720_RETURNS (ORG_ID, TAX_YEAR, TAX_QUARTER);
CREATE INDEX IX_RETURNS_STATUS_CREATED
    ON <TENANT_SCHEMA>.FORM_720_RETURNS (RETURN_STATUS, CREATED_AT DESC);
CREATE INDEX IX_RETURNS_TENANT_UPDATED
    ON <TENANT_SCHEMA>.FORM_720_RETURNS (TENANT_ID, UPDATED_AT DESC);
CREATE UNIQUE INDEX UX_RETURNS_ORG_PERIOD_ORIGINAL
    ON <TENANT_SCHEMA>.FORM_720_RETURNS (
        CASE
            WHEN FILING_TYPE = 'ORIGINAL'
             AND RETURN_STATUS NOT IN ('ARCHIVED','REJECTED','AMENDED')
            THEN ORG_ID
        END,
        CASE
            WHEN FILING_TYPE = 'ORIGINAL'
             AND RETURN_STATUS NOT IN ('ARCHIVED','REJECTED','AMENDED')
            THEN TAX_YEAR
        END,
        CASE
            WHEN FILING_TYPE = 'ORIGINAL'
             AND RETURN_STATUS NOT IN ('ARCHIVED','REJECTED','AMENDED')
            THEN TAX_QUARTER
        END
    );
```

### 4.3 `RETURN_LINE_ITEMS`

```sql
CREATE TABLE <TENANT_SCHEMA>.RETURN_LINE_ITEMS (
    LINE_ID                  VARCHAR2(36) PRIMARY KEY,
    RETURN_ID                VARCHAR2(36) NOT NULL,
    TENANT_ID                VARCHAR2(64) NOT NULL,
    SCHEDULE_CODE            VARCHAR2(20) NOT NULL,
    TAX_CODE                 VARCHAR2(20) NOT NULL,
    DESCRIPTION              VARCHAR2(500),
    QUANTITY                 NUMBER(15,2),
    RATE                     NUMBER(15,6),
    AMOUNT                   NUMBER(15,2) NOT NULL,
    VALIDATION_STATUS        VARCHAR2(20) DEFAULT 'PENDING' NOT NULL,
    VALIDATION_ERRORS_JSON   CLOB,
    CREATED_AT               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UPDATED_AT               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT FK_LINE_ITEMS_RETURN FOREIGN KEY (RETURN_ID)
        REFERENCES <TENANT_SCHEMA>.FORM_720_RETURNS (RETURN_ID) ON DELETE CASCADE,
    CONSTRAINT CK_LINE_ITEMS_VALIDATION_STATUS CHECK (
        VALIDATION_STATUS IN ('PENDING','VALID','INVALID')
    ),
    CONSTRAINT CK_LINE_ITEMS_AMOUNT_NON_NEGATIVE CHECK (
        AMOUNT >= 0
    )
);

CREATE INDEX IX_LINE_ITEMS_RETURN_ID
    ON <TENANT_SCHEMA>.RETURN_LINE_ITEMS (RETURN_ID);
CREATE INDEX IX_LINE_ITEMS_TAX_CODE
    ON <TENANT_SCHEMA>.RETURN_LINE_ITEMS (TAX_CODE);
```

### 4.4 `FILING_TRANSACTIONS`

```sql
CREATE TABLE <TENANT_SCHEMA>.FILING_TRANSACTIONS (
    TRANSACTION_ID           VARCHAR2(36) PRIMARY KEY,
    RETURN_ID                VARCHAR2(36) NOT NULL,
    TENANT_ID                VARCHAR2(64) NOT NULL,
    IRS_TRANSACTION_ID       VARCHAR2(64),
    SUBMISSION_TIMESTAMP     TIMESTAMP WITH TIME ZONE NOT NULL,
    ACCEPTANCE_TIMESTAMP     TIMESTAMP WITH TIME ZONE,
    FILING_METHOD            VARCHAR2(30) NOT NULL,
    TRANSMISSION_STATUS      VARCHAR2(30) NOT NULL,
    RETRY_COUNT              NUMBER(3) DEFAULT 0 NOT NULL,
    ERROR_MESSAGE            CLOB,
    IRS_RESPONSE_CODE        VARCHAR2(20),
    CREATED_AT               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UPDATED_AT               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT FK_FILING_TX_RETURN FOREIGN KEY (RETURN_ID)
        REFERENCES <TENANT_SCHEMA>.FORM_720_RETURNS (RETURN_ID),
    CONSTRAINT CK_FILING_TX_STATUS CHECK (
        TRANSMISSION_STATUS IN ('PENDING','SUBMITTED','ACCEPTED','REJECTED','RETRY_SCHEDULED','FAILED_PERMANENT')
    )
);

CREATE INDEX IX_FILING_TX_RETURN_ID
    ON <TENANT_SCHEMA>.FILING_TRANSACTIONS (RETURN_ID);
CREATE INDEX IX_FILING_TX_STATUS
    ON <TENANT_SCHEMA>.FILING_TRANSACTIONS (TRANSMISSION_STATUS);
CREATE INDEX IX_FILING_TX_SUBMITTED
    ON <TENANT_SCHEMA>.FILING_TRANSACTIONS (SUBMISSION_TIMESTAMP DESC);
```

### 4.5 `RETURNS_AUDIT_LOG`

```sql
CREATE TABLE <TENANT_SCHEMA>.RETURNS_AUDIT_LOG (
    AUDIT_ID                 NUMBER PRIMARY KEY,
    RETURN_ID                VARCHAR2(36),
    TENANT_ID                VARCHAR2(64) NOT NULL,
    USER_ID                  VARCHAR2(36),
    ACTION                   VARCHAR2(50) NOT NULL,
    ACTION_TIMESTAMP         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    STATUS_BEFORE            VARCHAR2(30),
    STATUS_AFTER             VARCHAR2(30),
    REQUEST_ID               VARCHAR2(100),
    IP_ADDRESS               VARCHAR2(45),
    USER_AGENT               VARCHAR2(500),
    CHANGES_JSON             CLOB
);

CREATE SEQUENCE <TENANT_SCHEMA>.SEQ_RETURNS_AUDIT START WITH 1 INCREMENT BY 1 NOCACHE NOORDER;

CREATE INDEX IX_RETURNS_AUDIT_RETURN_TS
    ON <TENANT_SCHEMA>.RETURNS_AUDIT_LOG (RETURN_ID, ACTION_TIMESTAMP DESC);
CREATE INDEX IX_RETURNS_AUDIT_USER_TS
    ON <TENANT_SCHEMA>.RETURNS_AUDIT_LOG (USER_ID, ACTION_TIMESTAMP DESC);
```

### 4.6 Trigger Requirements

- `TRG_FORM_720_RETURNS_UPDATED_AT`: set `UPDATED_AT`, increment `VERSION_NO`
- `TRG_RETURN_LINE_ITEMS_UPDATED_AT`: set `UPDATED_AT`
- `TRG_FILING_TRANSACTIONS_UPDATED_AT`: set `UPDATED_AT`
- `TRG_RETURNS_AUDIT_LOG`: write immutable audit rows on INSERT/UPDATE/DELETE + workflow transitions

---

## 5. Backend Domain and Application Contracts

### 5.1 New Domain Types (in `src/Effinsty.Domain/Types.fs`)

- `OrganizationId`
- `ReturnId`
- `ReturnLineItemId`
- `FilingTransactionId`
- `ReturnStatus` DU
- `FilingType` DU
- `TransmissionStatus` DU
- `Form720Return` record
- `ReturnLineItem` record
- `FilingTransaction` record
- `ReturnAuditEvent` record

### 5.2 New Application Contracts (in `src/Effinsty.Application/Contracts.fs`)

- `IReturnService`
- `IReturnRepository`
- `IReturnValidationService`
- `IIrsFilingGateway` (interface-only for this phase)

Required commands/queries:

- `CreateReturnCommand`
- `UpdateReturnCommand`
- `AddLineItemCommand`
- `RemoveLineItemCommand`
- `ValidateReturnCommand`
- `SubmitReturnCommand`
- `ListReturnsQuery`

### 5.3 Service Rules (in `src/Effinsty.Application/Services.fs`)

- Enforce status transition matrix
- Enforce organization/tenant ownership checks
- Validate quarter/year uniqueness constraint for active `ORIGINAL` return per org
- Recompute `TOTAL_TAX_AMOUNT` and `TOTAL_LIABILITY` from line items
- Prevent submit unless validation status is `VALID`

---

## 6. Repository + SQL Template Additions

### 6.1 Infrastructure Files

- Extend `src/Effinsty.Infrastructure/SqlTemplates.fs` with:
  - `returnsList`
  - `returnById`
  - `returnInsert`
  - `returnUpdate`
  - `returnDeleteDraft`
  - `lineItemInsert`
  - `lineItemDelete`
  - `lineItemsByReturn`
  - `filingTransactionInsert`
  - `returnAuditList`

- Extend `src/Effinsty.Infrastructure/Repositories.fs` with repository implementations and row mappers.

### 6.2 SQL Safety Requirements

- Keep schema validation pattern from existing templates
- Use bind parameters only
- Preserve tenant scoping in every query (`TENANT_ID` + owner context)
- Use optimistic concurrency (`VERSION_NO`) for update operations

---

## 7. API Specification (Effinsty Route Model)

Routes are added under `/api/returns` (to stay consistent with current API style). All endpoints require auth and tenant context.

### 7.1 Endpoints

- `GET /api/returns`
- `POST /api/returns`
- `GET /api/returns/{id}`
- `PUT /api/returns/{id}`
- `DELETE /api/returns/{id}` (draft-only)
- `POST /api/returns/{id}/validate`
- `POST /api/returns/{id}/submit`
- `GET /api/returns/{id}/status`
- `GET /api/returns/{id}/audit-trail`
- `POST /api/returns/{id}/line-items`
- `DELETE /api/returns/{id}/line-items/{lineId}`

### 7.2 Scopes

- `returns.read`: list/get/status/audit
- `returns.write`: create/update/delete draft/line-items
- `returns.submit`: submit return
- `returns.validate`: run validation workflow

### 7.3 Response Envelope

Adopt current Effinsty API response patterns but standardize return payload fields:

- Success body fields: `id`, `orgId`, `taxYear`, `taxQuarter`, `returnStatus`, `filingType`, `createdAt`, `updatedAt`
- Error body uses existing `ErrorResponse` with mapped codes:
  - `validation_error`
  - `unauthorized`
  - `forbidden`
  - `not_found`
  - `conflict`
  - `irs_transmission_error`
  - `service_unavailable`

---

## 8. Validation Requirements

### 8.1 Draft Validation

- Required fields: `orgId`, `taxYear`, `taxQuarter`, `filingType`
- Year range: configurable, default `[currentYear-7, currentYear+1]`
- Quarter in `[1..4]`

### 8.2 Line-Item Validation

- `taxCode` required
- `amount >= 0`
- `quantity` and `rate` either both populated or both null (configurable rule)
- Sum of line-item amounts must equal computed return totals

### 8.3 Pre-Submission Validation

- Return status must be `VALID`
- At least one line item
- No `INVALID` line items
- Organization is active

---

## 9. Migration Plan

Create additive migrations in `src/Effinsty.Infrastructure/Migrations`:

- `007_form720_core_tables.sql`
- `008_form720_indexes_partitioning.sql`
- `009_form720_audit_and_triggers.sql`
- `010_form720_seed_reference_data.sql` (optional)

Migration requirements:

- Re-runnable where practical
- Explicit comments for DBA runbooks
- No destructive changes to existing contacts/auth tables

---

## 10. Testing Requirements

### 10.1 Unit Tests

- Domain status transitions
- Validation rules
- Service orchestration and forbidden transitions

### 10.2 Integration Tests

- Repository CRUD for returns and line items
- Pagination/sorting and tenant isolation
- Audit row generation on status changes

### 10.3 Contract Tests

- DTO key/casing lock tests similar to existing API contract tests
- Error envelope mapping for new failure codes

---

## 11. Operational Requirements

- Correlation ID must flow through all return workflow logs
- Add metrics tags for `return_status`, `validation_outcome`, `submission_outcome`
- Emit retry telemetry for IRS submission attempts
- Include runbook updates for new migrations and failure triage

---

## 12. Deliverables

- New Oracle migrations (`007+`)
- Domain + application contracts for returns
- Infrastructure repositories and SQL templates
- API handlers/DTOs/routes for `/api/returns*`
- Unit/integration/contract tests
- Frontend implementation based on `frontend/frontend.md`
- Cross-functional execution plan in `docs/form720-workmap.md`
