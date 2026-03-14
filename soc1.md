# Effinsty API - Development Specification: SOC 1 Compliant Oracle Schema

**Version:** 1.0  
**Date:** March 2026  
**Status:** Active  
**Audience:** Development Team, DevOps, Database Administrators

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [SOC 1 Compliance Overview](#soc1-compliance-overview)
3. [Architecture & Design Principles](#architecture--design-principles)
4. [Database Schema Specification](#database-schema-specification)
5. [Security & Access Control](#security--access-control)
6. [Audit & Logging Requirements](#audit--logging-requirements)
7. [Data Integrity & Validation](#data-integrity--validation)
8. [Backup & Recovery](#backup--recovery)
9. [Monitoring & Alerting](#monitoring--alerting)
10. [Disaster Recovery](#disaster-recovery)
11. [Implementation Checklist](#implementation-checklist)

---

## Executive Summary

This specification defines the complete Oracle database schema and operational procedures for the Effinsty multi-tenant API platform. The design ensures compliance with SOC 1 Type II requirements by implementing:

- **Complete audit trails** for all data modifications
- **Granular access controls** with role-based security
- **Data isolation** between tenants with cryptographic verification
- **Automated monitoring** with real-time alerting
- **Immutable transaction logs** for regulatory compliance
- **Encryption at rest** and **in transit** standards
- **Change management** with approval workflows

All database operations are supported by comprehensive logging, monitoring, and recovery procedures documented herein.

---

## SOC 1 Compliance Overview

### 1.1 SOC 1 Control Objectives Addressed

| Control Area | Requirement | Implementation |
|---|---|---|
| **CC6.1** | Logical access control | Role-based database access with audit trail |
| **CC6.2** | System access | OAuth 2.0 / JWT + tenant isolation |
| **CC7.1** | System changes | Trigger-based audit logging on all DML |
| **CC7.2** | Change approval | Application-layer approval workflows |
| **CC7.3** | Prevent unauthorized changes | Database triggers + application validation |
| **CC7.4** | Monitor changes | Real-time audit log monitoring |
| **CC9.1** | System availability | Automated backups + Health checks |
| **CC9.2** | System performance | Query monitoring + index management |

### 1.2 Compliance Scope

This specification covers:

- ✅ Oracle 19c+ deployments (on-premises or cloud)
- ✅ Multi-tenant data segregation
- ✅ User and contact management
- ✅ Session & authentication state
- ✅ Audit trail generation and retention
- ✅ Change tracking and approval workflows

### 1.3 Out of Scope

This specification does NOT cover:

- ❌ Network security (firewall rules, SSL certificates)
- ❌ Physical data center controls
- ❌ Cloud provider infrastructure compliance (IAM, KMS)
- ❌ Disaster recovery site failover procedures
- ❌ Backup encryption key management (covered by cloud provider)

---

## Architecture & Design Principles

### 2.1 Core Design Philosophy

**Principle 1: Defense in Depth**
- Multiple validation layers (schema, application, trigger)
- Immutable audit logs
- Role-based access controls

**Principle 2: Tenant Isolation**
- Schema-per-tenant model
- Cryptographic verification of tenant ownership
- No cross-tenant queries possible at SQL level

**Principle 3: Immutable Audit Trail**
- All changes logged to dedicated audit tables
- Triggers prevent direct data manipulation without audit records
- Audit logs cannot be modified by standard operations

**Principle 4: Fail Secure**
- Constraints prevent invalid state transitions
- Missing data treated as access denial
- Triggers enforce business rules at database level

### 2.2 Multi-Tenancy Model

```
Effinsty API
├── Tenant A (Schema: TENANT_A)
│   ├── USERS table
│   ├── CONTACTS table
│   ├── SESSIONS table
│   ├── AUDIT_LOGS table
│   └── CHANGE_APPROVALS table (future)
├── Tenant B (Schema: TENANT_B)
│   └── [Same structure, isolated data]
└── Shared Infrastructure
    ├── Oracle User: effinsty_app (r/w on tenant schemas)
    ├── Oracle User: effinsty_audit (read-only audit tables)
    └── Oracle User: effinsty_admin (DDL/grants)
```

### 2.3 Deployment Topology

```
Production Environment
├── Primary Database (Active)
│   └── All schemas (TENANT_A, TENANT_B, ...)
├── Standby Database (Warm Standby)
│   └── Real-time replication via Data Guard
├── Backup Repository
│   └── Daily full + hourly incremental backups
└── Audit Log Archive
    └── Quarterly compression & long-term retention
```

---

## Database Schema Specification

### 3.1 Core Tables

#### 3.1.1 USERS Table

**Purpose:** Store tenant user credentials and profile information.

**Location:** `<TENANT_SCHEMA>.USERS`

```sql
CREATE TABLE <TENANT_SCHEMA>.USERS (
    ID                  VARCHAR2(36)        PRIMARY KEY,
    TENANT_ID           VARCHAR2(64)        NOT NULL,
    USERNAME            VARCHAR2(100)       NOT NULL,
    EMAIL               VARCHAR2(256)       NOT NULL,
    PASSWORD_HASH       VARCHAR2(255)       NOT NULL,
    IS_ACTIVE           NUMBER(1, 0)        DEFAULT 1 NOT NULL,
    CREATED_AT          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UPDATED_AT          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CREATED_BY          VARCHAR2(36),
    UPDATED_BY          VARCHAR2(36),
    PASSWORD_CHANGED_AT TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT UX_USERS_USERNAME UNIQUE (USERNAME),
    CONSTRAINT UX_USERS_EMAIL UNIQUE (EMAIL),
    CONSTRAINT CK_USERS_TENANT_ID CHECK (TENANT_ID IS NOT NULL AND LENGTH(TENANT_ID) > 0),
    CONSTRAINT CK_USERS_USERNAME CHECK (LENGTH(USERNAME) >= 3),
    CONSTRAINT CK_USERS_EMAIL CHECK (REGEXP_LIKE(EMAIL, '^[^@]+@[^@]+\.[^@]+$')),
    CONSTRAINT CK_USERS_PASSWORD CHECK (LENGTH(PASSWORD_HASH) >= 20),
    CONSTRAINT CK_USERS_IS_ACTIVE CHECK (IS_ACTIVE IN (0, 1))
);

-- Indexes for SOC 1 audit trail queries
CREATE INDEX IX_USERS_TENANT_UPDATED ON <TENANT_SCHEMA>.USERS (TENANT_ID, UPDATED_AT DESC);
CREATE INDEX IX_USERS_CREATED_AT ON <TENANT_SCHEMA>.USERS (CREATED_AT DESC);

-- Comments for data governance
COMMENT ON TABLE <TENANT_SCHEMA>.USERS IS 'Core user authentication and profile data. Subject to SOC 1 audit requirements.';
COMMENT ON COLUMN <TENANT_SCHEMA>.USERS.PASSWORD_HASH IS 'Bcrypt hashed password (min 60 chars). Never stored in plaintext.';
COMMENT ON COLUMN <TENANT_SCHEMA>.USERS.CREATED_BY IS 'User ID of creator for audit trail.';
COMMENT ON COLUMN <TENANT_SCHEMA>.USERS.UPDATED_BY IS 'User ID of last modifier for audit trail.';
COMMENT ON COLUMN <TENANT_SCHEMA>.USERS.PASSWORD_CHANGED_AT IS 'Tracks last password change for compliance.';
```

**Audit Requirements:**
- Every INSERT/UPDATE/DELETE triggers `TRG_USERS_UPDATED_AT` and `TRG_USERS_AUDIT_LOG`
- `CREATED_BY` and `UPDATED_BY` MUST be populated by application
- `PASSWORD_CHANGED_AT` updated only when password actually changes

**Data Classification:** **CONFIDENTIAL** - Contains authentication credentials

---

#### 3.1.2 CONTACTS Table

**Purpose:** Store user contact records with optional metadata.

**Location:** `<TENANT_SCHEMA>.CONTACTS`

```sql
CREATE TABLE <TENANT_SCHEMA>.CONTACTS (
    ID              VARCHAR2(36)        PRIMARY KEY,
    TENANT_ID       VARCHAR2(64)        NOT NULL,
    USER_ID         VARCHAR2(36)        NOT NULL,
    FIRST_NAME      VARCHAR2(100)       NOT NULL,
    LAST_NAME       VARCHAR2(100)       NOT NULL,
    EMAIL           VARCHAR2(256),
    PHONE           VARCHAR2(32),
    ADDRESS         VARCHAR2(500),
    METADATA_JSON   CLOB,
    CREATED_AT      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UPDATED_AT      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CREATED_BY      VARCHAR2(36)        NOT NULL,
    UPDATED_BY      VARCHAR2(36)        NOT NULL,
    SOFT_DELETED    NUMBER(1, 0)        DEFAULT 0 NOT NULL,
    DELETED_AT      TIMESTAMP WITH TIME ZONE,
    DELETED_BY      VARCHAR2(36),
    
    -- Constraints
    CONSTRAINT FK_CONTACTS_USERS FOREIGN KEY (USER_ID) REFERENCES <TENANT_SCHEMA>.USERS(ID) ON DELETE CASCADE,
    CONSTRAINT CK_CONTACTS_TENANT_ID CHECK (TENANT_ID IS NOT NULL),
    CONSTRAINT CK_CONTACTS_NAMES CHECK (LENGTH(FIRST_NAME) > 0 AND LENGTH(LAST_NAME) > 0),
    CONSTRAINT CK_CONTACTS_EMAIL CHECK (EMAIL IS NULL OR REGEXP_LIKE(EMAIL, '^[^@]+@[^@]+\.[^@]+$')),
    CONSTRAINT CK_CONTACTS_PHONE CHECK (PHONE IS NULL OR REGEXP_LIKE(PHONE, '^[0-9]{10,15}$')),
    CONSTRAINT CK_CONTACTS_SOFT_DELETED CHECK (SOFT_DELETED IN (0, 1)),
    CONSTRAINT CK_CONTACTS_DELETION CHECK (
        (SOFT_DELETED = 0 AND DELETED_AT IS NULL AND DELETED_BY IS NULL) OR
        (SOFT_DELETED = 1 AND DELETED_AT IS NOT NULL AND DELETED_BY IS NOT NULL)
    )
);

-- Indexes optimized for queries + audit trail
CREATE INDEX IX_CONTACTS_USER_UPDATED ON <TENANT_SCHEMA>.CONTACTS (USER_ID, UPDATED_AT DESC) WHERE SOFT_DELETED = 0;
CREATE INDEX IX_CONTACTS_USER_EMAIL ON <TENANT_SCHEMA>.CONTACTS (USER_ID, EMAIL) WHERE SOFT_DELETED = 0 AND EMAIL IS NOT NULL;
CREATE INDEX IX_CONTACTS_CREATED_AT ON <TENANT_SCHEMA>.CONTACTS (CREATED_AT DESC);
CREATE INDEX IX_CONTACTS_DELETED ON <TENANT_SCHEMA>.CONTACTS (SOFT_DELETED, DELETED_AT DESC);

COMMENT ON TABLE <TENANT_SCHEMA>.CONTACTS IS 'User contact records with soft-delete support for data recovery and audit.';
COMMENT ON COLUMN <TENANT_SCHEMA>.CONTACTS.METADATA_JSON IS 'Flexible JSON storage for custom fields. Validated at application layer.';
COMMENT ON COLUMN <TENANT_SCHEMA>.CONTACTS.SOFT_DELETED IS 'Logical delete flag (0=active, 1=deleted). Supports audit trail and recovery.';
COMMENT ON COLUMN <TENANT_SCHEMA>.CONTACTS.CREATED_BY IS 'User ID of creator for audit trail.';
COMMENT ON COLUMN <TENANT_SCHEMA>.CONTACTS.UPDATED_BY IS 'User ID of last modifier for audit trail.';
COMMENT ON COLUMN <TENANT_SCHEMA>.CONTACTS.DELETED_BY IS 'User ID who deleted record for audit trail.';
```

**Audit Requirements:**
- Soft deletes preserve data for compliance investigations
- All INSERT/UPDATE/DELETE operations logged to `CONTACTS_AUDIT_LOG`
- `CREATED_BY`, `UPDATED_BY`, `DELETED_BY` MUST be populated by application
- Deletion records retain creator, modifier, and deleter for complete audit trail

**Data Classification:** **INTERNAL** - Customer data, retention policy enforced

---

#### 3.1.3 SESSIONS Table

**Purpose:** Track active user sessions for logout/revocation.

**Location:** `<TENANT_SCHEMA>.SESSIONS`

```sql
CREATE TABLE <TENANT_SCHEMA>.SESSIONS (
    SESSION_ID      VARCHAR2(64)        PRIMARY KEY,
    USER_ID         VARCHAR2(36)        NOT NULL,
    TENANT_ID       VARCHAR2(64)        NOT NULL,
    REFRESH_TOKEN   VARCHAR2(4000)      NOT NULL,
    EXPIRES_AT      TIMESTAMP WITH TIME ZONE NOT NULL,
    CREATED_AT      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    IP_ADDRESS      VARCHAR2(45),
    USER_AGENT      VARCHAR2(500),
    
    -- Constraints
    CONSTRAINT FK_SESSIONS_USERS FOREIGN KEY (USER_ID) REFERENCES <TENANT_SCHEMA>.USERS(ID) ON DELETE CASCADE,
    CONSTRAINT CK_SESSIONS_TENANT_ID CHECK (TENANT_ID IS NOT NULL),
    CONSTRAINT CK_SESSIONS_EXPIRES CHECK (EXPIRES_AT > CREATED_AT)
);

-- Index for session cleanup and audit queries
CREATE INDEX IX_SESSIONS_USER_EXPIRES ON <TENANT_SCHEMA>.SESSIONS (USER_ID, EXPIRES_AT DESC);
CREATE INDEX IX_SESSIONS_EXPIRES_AT ON <TENANT_SCHEMA>.SESSIONS (EXPIRES_AT DESC);

COMMENT ON TABLE <TENANT_SCHEMA>.SESSIONS IS 'Active user sessions for logout tracking and token revocation. SOC 1 requirement for session management.';
COMMENT ON COLUMN <TENANT_SCHEMA>.SESSIONS.IP_ADDRESS IS 'Client IP for anomaly detection and audit trail.';
COMMENT ON COLUMN <TENANT_SCHEMA>.SESSIONS.USER_AGENT IS 'HTTP User-Agent for device identification in audit logs.';
```

**Audit Requirements:**
- Session creation logged with IP and User-Agent
- Session deletion logged (logout event)
- Expired sessions automatically purged daily (scheduled job)
- Audit logs must retain session context (IP, device)

**Data Classification:** **SENSITIVE** - Session tokens, encrypted storage recommended

---

### 3.2 Audit Tables

#### 3.2.1 USERS_AUDIT_LOG Table

**Purpose:** Immutable audit trail for all user modifications.

**Location:** `<TENANT_SCHEMA>.USERS_AUDIT_LOG`

```sql
CREATE TABLE <TENANT_SCHEMA>.USERS_AUDIT_LOG (
    AUDIT_ID            NUMBER          PRIMARY KEY,
    USER_ID             VARCHAR2(36)    NOT NULL,
    TENANT_ID           VARCHAR2(64)    NOT NULL,
    OPERATION           VARCHAR2(10)    NOT NULL, -- INSERT, UPDATE, DELETE
    CHANGED_COLUMNS     CLOB,                      -- JSON: {column: {old_value, new_value}}
    OLD_VALUES          CLOB,                      -- JSON snapshot of previous row (sensitive fields hashed)
    NEW_VALUES          CLOB,                      -- JSON snapshot of current row (sensitive fields hashed)
    CHANGED_BY          VARCHAR2(36),              -- User ID who made change
    CHANGED_AT          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    REQUEST_ID          VARCHAR2(36),              -- Correlation ID from app
    IP_ADDRESS          VARCHAR2(45),              -- Client IP
    SESSION_ID          VARCHAR2(64),              -- Session performing action
    
    -- Constraints
    CONSTRAINT CK_USERS_AUDIT_OP CHECK (OPERATION IN ('INSERT', 'UPDATE', 'DELETE')),
    CONSTRAINT CK_USERS_AUDIT_CHANGED_BY CHECK (CHANGED_BY IS NOT NULL OR OPERATION = 'DELETE')
);

-- Immutable index (cannot be dropped without CASCADE)
CREATE INDEX IX_USERS_AUDIT_USER ON <TENANT_SCHEMA>.USERS_AUDIT_LOG (USER_ID, CHANGED_AT DESC);
CREATE INDEX IX_USERS_AUDIT_TIMESTAMP ON <TENANT_SCHEMA>.USERS_AUDIT_LOG (CHANGED_AT DESC);
CREATE INDEX IX_USERS_AUDIT_REQUEST ON <TENANT_SCHEMA>.USERS_AUDIT_LOG (REQUEST_ID);

-- Partition strategy for large audit tables (optional, recommended for >10M rows)
-- CREATE TABLE <TENANT_SCHEMA>.USERS_AUDIT_LOG PARTITION BY RANGE (CHANGED_AT) ...

COMMENT ON TABLE <TENANT_SCHEMA>.USERS_AUDIT_LOG IS 'Immutable audit trail. Cannot be modified after creation. Supports SOC 1 Type II compliance.';
COMMENT ON COLUMN <TENANT_SCHEMA>.USERS_AUDIT_LOG.CHANGED_COLUMNS IS 'JSON map of only the columns that changed: {"username": {"old": "john.doe", "new": "jane.doe"}}';
COMMENT ON COLUMN <TENANT_SCHEMA>.USERS_AUDIT_LOG.REQUEST_ID IS 'Application correlation ID for tracing changes back to HTTP requests.';
```

**Audit Requirements:**
- **Immutability:** No UPDATE, DELETE, or TRUNCATE allowed on this table (enforce via database privilege)
- **Retention:** Minimum 7 years for SOC 1 Type II (adjust per company policy)
- **Archival:** Quarterly moves to compressed cold storage (date < 90 days ago)
- **Tracking:** Every column change must be logged with before/after values
- **Attribution:** Every change must identify the user, session, and request ID

**Critical:** NEVER grant UPDATE or DELETE on `USERS_AUDIT_LOG` to any application user.

---

#### 3.2.2 CONTACTS_AUDIT_LOG Table

**Purpose:** Immutable audit trail for all contact modifications.

**Location:** `<TENANT_SCHEMA>.CONTACTS_AUDIT_LOG`

```sql
CREATE TABLE <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG (
    AUDIT_ID            NUMBER          PRIMARY KEY,
    CONTACT_ID          VARCHAR2(36)    NOT NULL,
    USER_ID             VARCHAR2(36)    NOT NULL,
    TENANT_ID           VARCHAR2(64)    NOT NULL,
    OPERATION           VARCHAR2(10)    NOT NULL, -- INSERT, UPDATE, DELETE
    CHANGED_COLUMNS     CLOB,                      -- JSON: {column: {old_value, new_value}}
    OLD_VALUES          CLOB,                      -- JSON snapshot of previous row (sensitive fields hashed)
    NEW_VALUES          CLOB,                      -- JSON snapshot of current row (sensitive fields hashed)
    CHANGED_BY          VARCHAR2(36)    NOT NULL, -- User ID who made change
    CHANGED_AT          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    REQUEST_ID          VARCHAR2(36),              -- Correlation ID from app
    IP_ADDRESS          VARCHAR2(45),              -- Client IP
    SESSION_ID          VARCHAR2(64),              -- Session performing action
    
    -- Constraints
    CONSTRAINT CK_CONTACTS_AUDIT_OP CHECK (OPERATION IN ('INSERT', 'UPDATE', 'DELETE')),
    CONSTRAINT CK_CONTACTS_AUDIT_CHANGED_BY CHECK (CHANGED_BY IS NOT NULL)
);

CREATE INDEX IX_CONTACTS_AUDIT_CONTACT ON <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG (CONTACT_ID, CHANGED_AT DESC);
CREATE INDEX IX_CONTACTS_AUDIT_USER ON <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG (USER_ID, CHANGED_AT DESC);
CREATE INDEX IX_CONTACTS_AUDIT_TIMESTAMP ON <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG (CHANGED_AT DESC);
CREATE INDEX IX_CONTACTS_AUDIT_REQUEST ON <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG (REQUEST_ID);

COMMENT ON TABLE <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG IS 'Immutable audit trail for contact records. Supports SOC 1 Type II compliance and data recovery.';
```

**Audit Requirements:**
- Same immutability constraints as `USERS_AUDIT_LOG`
- Soft deletes logged with `OPERATION = 'UPDATE'` (SOFT_DELETED changes from 0 to 1)
- Hard deletes (FK cascade) logged with `OPERATION = 'DELETE'`
- User who requested deletion MUST be logged

---

#### 3.2.3 SESSIONS_AUDIT_LOG Table

**Purpose:** Track session creation, refresh, and logout events.

**Location:** `<TENANT_SCHEMA>.SESSIONS_AUDIT_LOG`

```sql
CREATE TABLE <TENANT_SCHEMA>.SESSIONS_AUDIT_LOG (
    AUDIT_ID            NUMBER          PRIMARY KEY,
    SESSION_ID          VARCHAR2(64)    NOT NULL,
    USER_ID             VARCHAR2(36)    NOT NULL,
    TENANT_ID           VARCHAR2(64)    NOT NULL,
    EVENT_TYPE          VARCHAR2(20)    NOT NULL, -- LOGIN, REFRESH, LOGOUT, TIMEOUT
    EVENT_AT            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    IP_ADDRESS          VARCHAR2(45),
    USER_AGENT          VARCHAR2(500),
    STATUS              VARCHAR2(20),              -- SUCCESS, FAILED, REVOKED
    REASON              VARCHAR2(500),             -- Why logout/revoke occurred
    REQUEST_ID          VARCHAR2(36),
    
    -- Constraints
    CONSTRAINT CK_SESSIONS_AUDIT_EVENT CHECK (EVENT_TYPE IN ('LOGIN', 'REFRESH', 'LOGOUT', 'TIMEOUT', 'REVOKE')),
    CONSTRAINT CK_SESSIONS_AUDIT_STATUS CHECK (STATUS IN ('SUCCESS', 'FAILED', 'REVOKED'))
);

CREATE INDEX IX_SESSIONS_AUDIT_SESSION ON <TENANT_SCHEMA>.SESSIONS_AUDIT_LOG (SESSION_ID, EVENT_AT DESC);
CREATE INDEX IX_SESSIONS_AUDIT_USER ON <TENANT_SCHEMA>.SESSIONS_AUDIT_LOG (USER_ID, EVENT_AT DESC);
CREATE INDEX IX_SESSIONS_AUDIT_TIMESTAMP ON <TENANT_SCHEMA>.SESSIONS_AUDIT_LOG (EVENT_AT DESC);

COMMENT ON TABLE <TENANT_SCHEMA>.SESSIONS_AUDIT_LOG IS 'Session lifecycle events for login/logout tracking. SOC 1 requirement for access control compliance.';
```

**Audit Requirements:**
- Successful login creates `LOGIN` event with `SUCCESS` status
- Token refresh creates `REFRESH` event with `SUCCESS` status
- Logout creates `LOGOUT` event with `SUCCESS` status
- Session timeout creates `TIMEOUT` event with `REVOKED` status
- Abnormal termination (account disabled, force logout) creates `REVOKE` event with reason

---

### 3.3 Triggers

#### 3.3.1 TRG_USERS_UPDATED_AT Trigger

**Purpose:** Automatically update `UPDATED_AT` timestamp on every modification.

**Location:** `<TENANT_SCHEMA>.TRG_USERS_UPDATED_AT`

```sql
CREATE OR REPLACE TRIGGER <TENANT_SCHEMA>.TRG_USERS_UPDATED_AT
BEFORE UPDATE ON <TENANT_SCHEMA>.USERS
FOR EACH ROW
BEGIN
    :NEW.UPDATED_AT := CURRENT_TIMESTAMP;
    
    -- Prevent null UPDATED_BY on application inserts
    IF :NEW.UPDATED_BY IS NULL THEN
        RAISE_APPLICATION_ERROR(-20001, 'UPDATED_BY cannot be null');
    END IF;
END TRG_USERS_UPDATED_AT;
/
```

**Behavior:**
- Fires on every UPDATE statement
- Ensures timestamp accuracy independent of application
- Validates audit attribution (`UPDATED_BY` cannot be null)

---

#### 3.3.2 TRG_USERS_AUDIT_LOG Trigger

**Purpose:** Log all user modifications to audit table.

**Location:** `<TENANT_SCHEMA>.TRG_USERS_AUDIT_LOG`

```sql
CREATE OR REPLACE TRIGGER <TENANT_SCHEMA>.TRG_USERS_AUDIT_LOG
AFTER INSERT OR UPDATE OR DELETE ON <TENANT_SCHEMA>.USERS
FOR EACH ROW
DECLARE
    v_operation VARCHAR2(10);
    v_changed_columns CLOB := '{}';
    v_old_values CLOB;
    v_new_values CLOB;
BEGIN
    -- Determine operation type
    IF INSERTING THEN
        v_operation := 'INSERT';
        v_old_values := NULL;
        v_new_values := JSON_OBJECT(
            'ID' VALUE :NEW.ID,
            'TENANT_ID' VALUE :NEW.TENANT_ID,
            'USERNAME' VALUE :NEW.USERNAME,
            'EMAIL_HASH' VALUE RAWTOHEX(STANDARD_HASH(LOWER(TRIM(:NEW.EMAIL)), 'SHA256')),
            'IS_ACTIVE' VALUE :NEW.IS_ACTIVE,
            'CREATED_AT' VALUE TO_CHAR(:NEW.CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS.FF3'),
            'CREATED_BY' VALUE :NEW.CREATED_BY
        );
    ELSIF UPDATING THEN
        v_operation := 'UPDATE';
        
        -- Build changed columns JSON
        v_changed_columns := JSON_OBJECT();
        
        IF NVL(:OLD.USERNAME, '__null__') <> NVL(:NEW.USERNAME, '__null__') THEN
            v_changed_columns := JSON_OBJECT(
                'USERNAME' VALUE JSON_OBJECT('old' VALUE :OLD.USERNAME, 'new' VALUE :NEW.USERNAME)
            );
        END IF;
        
        IF NVL(:OLD.EMAIL, '__null__') <> NVL(:NEW.EMAIL, '__null__') THEN
            v_changed_columns := JSON_MERGE_PATCH(v_changed_columns, JSON_OBJECT(
                'EMAIL' VALUE JSON_OBJECT(
                    'old_hash' VALUE RAWTOHEX(STANDARD_HASH(LOWER(TRIM(:OLD.EMAIL)), 'SHA256')),
                    'new_hash' VALUE RAWTOHEX(STANDARD_HASH(LOWER(TRIM(:NEW.EMAIL)), 'SHA256'))
                )
            ));
        END IF;
        
        IF NVL(:OLD.IS_ACTIVE, -1) <> NVL(:NEW.IS_ACTIVE, -1) THEN
            v_changed_columns := JSON_MERGE_PATCH(v_changed_columns, JSON_OBJECT(
                'IS_ACTIVE' VALUE JSON_OBJECT('old' VALUE :OLD.IS_ACTIVE, 'new' VALUE :NEW.IS_ACTIVE)
            ));
        END IF;
        
        IF NVL(:OLD.PASSWORD_HASH, '__null__') <> NVL(:NEW.PASSWORD_HASH, '__null__') THEN
            v_changed_columns := JSON_MERGE_PATCH(v_changed_columns, JSON_OBJECT(
                'PASSWORD_HASH' VALUE JSON_OBJECT('old' VALUE '***', 'new' VALUE '***')
            ));
        END IF;
        
        v_old_values := JSON_OBJECT(
            'ID' VALUE :OLD.ID,
            'USERNAME' VALUE :OLD.USERNAME,
            'EMAIL_HASH' VALUE RAWTOHEX(STANDARD_HASH(LOWER(TRIM(:OLD.EMAIL)), 'SHA256')),
            'IS_ACTIVE' VALUE :OLD.IS_ACTIVE,
            'UPDATED_AT' VALUE TO_CHAR(:OLD.UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS.FF3')
        );
        
        v_new_values := JSON_OBJECT(
            'ID' VALUE :NEW.ID,
            'USERNAME' VALUE :NEW.USERNAME,
            'EMAIL_HASH' VALUE RAWTOHEX(STANDARD_HASH(LOWER(TRIM(:NEW.EMAIL)), 'SHA256')),
            'IS_ACTIVE' VALUE :NEW.IS_ACTIVE,
            'UPDATED_AT' VALUE TO_CHAR(:NEW.UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS.FF3'),
            'UPDATED_BY' VALUE :NEW.UPDATED_BY
        );
    ELSIF DELETING THEN
        v_operation := 'DELETE';
        v_old_values := JSON_OBJECT(
            'ID' VALUE :OLD.ID,
            'USERNAME' VALUE :OLD.USERNAME,
            'EMAIL_HASH' VALUE RAWTOHEX(STANDARD_HASH(LOWER(TRIM(:OLD.EMAIL)), 'SHA256'))
        );
        v_new_values := NULL;
    END IF;
    
    -- Insert audit record
    INSERT INTO <TENANT_SCHEMA>.USERS_AUDIT_LOG (
        AUDIT_ID,
        USER_ID,
        TENANT_ID,
        OPERATION,
        CHANGED_COLUMNS,
        OLD_VALUES,
        NEW_VALUES,
        CHANGED_BY,
        CHANGED_AT,
        REQUEST_ID,
        IP_ADDRESS,
        SESSION_ID
    ) VALUES (
        <TENANT_SCHEMA>.SEQ_USERS_AUDIT.NEXTVAL,
        COALESCE(:NEW.ID, :OLD.ID),
        COALESCE(:NEW.TENANT_ID, :OLD.TENANT_ID),
        v_operation,
        v_changed_columns,
        v_old_values,
        v_new_values,
        COALESCE(:NEW.UPDATED_BY, :NEW.CREATED_BY, :OLD.UPDATED_BY, 'SYSTEM'),
        CURRENT_TIMESTAMP,
        SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER'),  -- Populated by app
        NULL,  -- Set by application layer
        NULL   -- Set by application layer
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Log trigger failures to alert operations team
    INSERT INTO <TENANT_SCHEMA>.TRIGGER_ERROR_LOG (
        ERROR_TABLE,
        ERROR_OPERATION,
        ERROR_MESSAGE,
        ERROR_TIMESTAMP
    ) VALUES (
        'USERS',
        v_operation,
        SQLERRM,
        CURRENT_TIMESTAMP
    );
    RAISE;
END TRG_USERS_AUDIT_LOG;
/
```

**Behavior:**
- Fires AFTER every INSERT/UPDATE/DELETE on USERS table
- Captures full before/after state
- Logs only changed columns in `CHANGED_COLUMNS` JSON
- Masks sensitive data (passwords shown as ***)
- Handles NULL values correctly
- Fails the transaction if audit log insert fails (security principle)

---

#### 3.3.3 TRG_CONTACTS_UPDATED_AT and TRG_CONTACTS_AUDIT_LOG Triggers

Similar to users triggers, with contact-specific logic:

```sql
CREATE OR REPLACE TRIGGER <TENANT_SCHEMA>.TRG_CONTACTS_UPDATED_AT
BEFORE UPDATE ON <TENANT_SCHEMA>.CONTACTS
FOR EACH ROW
BEGIN
    :NEW.UPDATED_AT := CURRENT_TIMESTAMP;
    
    IF :NEW.UPDATED_BY IS NULL THEN
        RAISE_APPLICATION_ERROR(-20001, 'UPDATED_BY cannot be null');
    END IF;
END TRG_CONTACTS_UPDATED_AT;
/

CREATE OR REPLACE TRIGGER <TENANT_SCHEMA>.TRG_CONTACTS_AUDIT_LOG
AFTER INSERT OR UPDATE OR DELETE ON <TENANT_SCHEMA>.CONTACTS
FOR EACH ROW
DECLARE
    v_operation VARCHAR2(10);
    v_changed_columns CLOB := '{}';
    v_old_values CLOB;
    v_new_values CLOB;
BEGIN
    -- Similar JSON construction as USERS trigger
    -- Track: FIRST_NAME, LAST_NAME, EMAIL, PHONE, ADDRESS, SOFT_DELETED, METADATA_JSON
    -- Log deleted_by on soft deletes
    
    IF INSERTING THEN
        v_operation := 'INSERT';
    ELSIF UPDATING THEN
        v_operation := 'UPDATE';
    ELSIF DELETING THEN
        v_operation := 'DELETE';
    END IF;
    
    INSERT INTO <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG (
        AUDIT_ID,
        CONTACT_ID,
        USER_ID,
        TENANT_ID,
        OPERATION,
        CHANGED_COLUMNS,
        OLD_VALUES,
        NEW_VALUES,
        CHANGED_BY,
        CHANGED_AT
    ) VALUES (
        <TENANT_SCHEMA>.SEQ_CONTACTS_AUDIT.NEXTVAL,
        COALESCE(:NEW.ID, :OLD.ID),
        COALESCE(:NEW.USER_ID, :OLD.USER_ID),
        COALESCE(:NEW.TENANT_ID, :OLD.TENANT_ID),
        v_operation,
        v_changed_columns,
        v_old_values,
        v_new_values,
        COALESCE(:NEW.UPDATED_BY, :NEW.CREATED_BY, :OLD.UPDATED_BY, 'SYSTEM'),
        CURRENT_TIMESTAMP
    );
END TRG_CONTACTS_AUDIT_LOG;
/
```

---

### 3.4 Sequences

**Purpose:** Generate unique audit log IDs without application involvement.

```sql
CREATE SEQUENCE <TENANT_SCHEMA>.SEQ_USERS_AUDIT
    START WITH 1
    INCREMENT BY 1
    NOCACHE
    NOORDER;

CREATE SEQUENCE <TENANT_SCHEMA>.SEQ_CONTACTS_AUDIT
    START WITH 1
    INCREMENT BY 1
    NOCACHE
    NOORDER;

CREATE SEQUENCE <TENANT_SCHEMA>.SEQ_SESSIONS_AUDIT
    START WITH 1
    INCREMENT BY 1
    NOCACHE
    NOORDER;
```

**Benefits:**
- Guaranteed audit log ID uniqueness
- No gaps (NOCACHE/NOORDER ensures sequential numbering)
- Database-enforced sequence integrity

---

### 3.5 Views

#### 3.5.1 V_USERS_AUDIT_TRAIL View

**Purpose:** Simplified audit trail query for compliance reports.

```sql
CREATE OR REPLACE VIEW <TENANT_SCHEMA>.V_USERS_AUDIT_TRAIL AS
SELECT
    AUDIT_ID,
    USER_ID,
    OPERATION,
    CHANGED_BY,
    CHANGED_AT,
    REQUEST_ID,
    IP_ADDRESS,
    SESSION_ID,
    CHANGED_COLUMNS,
    OLD_VALUES,
    NEW_VALUES
FROM <TENANT_SCHEMA>.USERS_AUDIT_LOG
WHERE CHANGED_AT >= TRUNC(SYSDATE) - 90  -- Last 90 days
ORDER BY CHANGED_AT DESC;

-- Grant read-only access to audit viewers
GRANT SELECT ON <TENANT_SCHEMA>.V_USERS_AUDIT_TRAIL TO effinsty_audit;
```

---

## Security & Access Control

### 4.1 Oracle Database Users

#### 4.1.1 Application User (effinsty_app)

**Privilege Level:** READ/WRITE on tables, cannot modify audit tables

```sql
-- Create application user
CREATE USER effinsty_app IDENTIFIED BY <STRONG_PASSWORD>;

-- Grant table privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON <TENANT_SCHEMA>.USERS TO effinsty_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON <TENANT_SCHEMA>.CONTACTS TO effinsty_app;
GRANT SELECT, INSERT, UPDATE ON <TENANT_SCHEMA>.SESSIONS TO effinsty_app;

-- Grant sequence privileges (for application-side ID generation if needed)
GRANT SELECT ON <TENANT_SCHEMA>.SEQ_USERS_AUDIT TO effinsty_app;
GRANT SELECT ON <TENANT_SCHEMA>.SEQ_CONTACTS_AUDIT TO effinsty_app;

-- Grant READ-ONLY on audit tables (for diagnostics)
GRANT SELECT ON <TENANT_SCHEMA>.USERS_AUDIT_LOG TO effinsty_app;
GRANT SELECT ON <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG TO effinsty_app;
GRANT SELECT ON <TENANT_SCHEMA>.SESSIONS_AUDIT_LOG TO effinsty_app;

-- DO NOT GRANT UPDATE/DELETE on audit tables
```

#### 4.1.2 Audit User (effinsty_audit)

**Privilege Level:** READ-ONLY on all tables, audit trails, and views

```sql
CREATE USER effinsty_audit IDENTIFIED BY <STRONG_PASSWORD>;

-- Read-only access to all data tables
GRANT SELECT ON <TENANT_SCHEMA>.USERS TO effinsty_audit;
GRANT SELECT ON <TENANT_SCHEMA>.CONTACTS TO effinsty_audit;
GRANT SELECT ON <TENANT_SCHEMA>.SESSIONS TO effinsty_audit;

-- Full read access to audit tables
GRANT SELECT ON <TENANT_SCHEMA>.USERS_AUDIT_LOG TO effinsty_audit;
GRANT SELECT ON <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG TO effinsty_audit;
GRANT SELECT ON <TENANT_SCHEMA>.SESSIONS_AUDIT_LOG TO effinsty_audit;

-- Access to audit views
GRANT SELECT ON <TENANT_SCHEMA>.V_USERS_AUDIT_TRAIL TO effinsty_audit;
GRANT SELECT ON <TENANT_SCHEMA>.V_CONTACTS_AUDIT_TRAIL TO effinsty_audit;
GRANT SELECT ON <TENANT_SCHEMA>.V_SESSIONS_AUDIT_TRAIL TO effinsty_audit;
```

#### 4.1.3 Admin User (effinsty_admin)

**Privilege Level:** Full DDL, schema changes, backup/recovery

```sql
CREATE USER effinsty_admin IDENTIFIED BY <VERY_STRONG_PASSWORD>;

GRANT CONNECT, RESOURCE TO effinsty_admin;
GRANT CREATE TABLE, CREATE SEQUENCE, CREATE TRIGGER, CREATE VIEW TO effinsty_admin;

-- Audit table management (read/delete for archival)
GRANT SELECT, DELETE ON <TENANT_SCHEMA>.USERS_AUDIT_LOG TO effinsty_admin;
GRANT SELECT, DELETE ON <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG TO effinsty_admin;

-- Usage note: DELETE from audit tables only for archival after retention period
-- Existing tenant table ALTER/DROP remains a schema-owner or controlled DBA action
```

### 4.2 Row-Level Security (RLS)

**Recommended Enhancement for Future Releases:**

```sql
-- Example: Prevent user from seeing other users' contacts
CREATE OR REPLACE PACKAGE <TENANT_SCHEMA>.rls_policy AS
    PROCEDURE apply_user_isolation;
END rls_policy;
/

CREATE OR REPLACE PACKAGE BODY <TENANT_SCHEMA>.rls_policy AS
    PROCEDURE apply_user_isolation IS
    BEGIN
        DBMS_RLS.ADD_POLICY(
            object_schema => '<TENANT_SCHEMA>',
            object_name => 'CONTACTS',
            policy_name => 'contacts_user_isolation',
            function_schema => '<TENANT_SCHEMA>',
            policy_function => 'user_isolation_function',
            statement_types => 'SELECT,INSERT,UPDATE,DELETE'
        );
    END apply_user_isolation;
END rls_policy;
/

-- Function to enforce isolation
CREATE OR REPLACE FUNCTION <TENANT_SCHEMA>.user_isolation_function(
    p_schema VARCHAR2,
    p_object VARCHAR2
) RETURN VARCHAR2 AS
    v_user_id VARCHAR2(36);
BEGIN
    -- CLIENT_IDENTIFIER must be set by trusted server-side code after authentication
    v_user_id := SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER');
    
    RETURN 'USER_ID = ''' || v_user_id || '''';
END user_isolation_function;
/
```

### 4.3 Network & Connection Security

**Requirement:** All Oracle connections use:

```sql
-- Enforce encryption for all connections
ALTER SYSTEM SET SQLNET.ENCRYPTION_SERVER = REQUIRED SCOPE=BOTH;
ALTER SYSTEM SET SQLNET.ENCRYPTION_TYPES_SERVER = (AES256) SCOPE=BOTH;

-- Enable database audit to SYS.AUD$ table
AUDIT INSERT TABLE BY effinsty_app BY ACCESS;
AUDIT UPDATE TABLE BY effinsty_app BY ACCESS;
AUDIT DELETE TABLE BY effinsty_app BY ACCESS;
AUDIT SESSION BY effinsty_app BY ACCESS;
AUDIT CREATE, ALTER, DROP TABLE BY effinsty_admin BY ACCESS;
AUDIT SESSION BY effinsty_admin BY ACCESS;
AUDIT SESSION BY effinsty_audit BY ACCESS;
AUDIT ROLE BY effinsty_admin BY ACCESS;
AUDIT CREATE USER, ALTER USER, DROP USER BY effinsty_admin BY ACCESS;
```

`BY ACCESS` is the required setting for the `effinsty_app` DML/session audit policy because the Executive Summary commits to complete audit trails for data modifications. Oracle traditional auditing records one audit record per audited statement/operation with `BY ACCESS`, which preserves the per-operation evidence expected for SOC 1 review; `BY SESSION` can collapse activity into broader session-level records and is therefore not sufficient here. The committed migration also guards missing service users and managed-database `ALTER SYSTEM` restrictions so it logs warnings instead of aborting the whole run.

Representative evidence capture for non-production validation:

```sql
SELECT username,
       action_name,
       obj_name,
       returncode,
       TO_CHAR("TIMESTAMP", 'YYYY-MM-DD"T"HH24:MI:SS') AS audit_ts
FROM dba_audit_trail
WHERE username = 'EFFINSTY_APP'
ORDER BY "TIMESTAMP" DESC
FETCH FIRST 5 ROWS ONLY;
```

Example evidence shape:

```text
EFFINSTY_APP  INSERT  USERS     0  2026-03-14T11:03:20
EFFINSTY_APP  UPDATE  CONTACTS  0  2026-03-14T11:03:41
EFFINSTY_APP  DELETE  USERS     0  2026-03-14T11:04:02
```

---

## Audit & Logging Requirements

### 5.1 Application-Layer Audit Fields

The application MUST populate these fields on every database operation:

| Field | Source | Example | Purpose |
|---|---|---|---|
| `CREATED_BY` | `User.Id` from JWT | `f47ac10b-58cc-4372-a567-0e02b2c3d479` | Attribution of creation |
| `UPDATED_BY` | `User.Id` from JWT | `f47ac10b-58cc-4372-a567-0e02b2c3d479` | Attribution of modification |
| `DELETED_BY` | `User.Id` from JWT | `f47ac10b-58cc-4372-a567-0e02b2c3d479` | Attribution of deletion |
| `REQUEST_ID` | Correlation ID header | `550e8400-e29b-41d4-a716-446655440000` | Link to HTTP request logs |
| `IP_ADDRESS` | HTTP `X-Forwarded-For` header | `203.0.113.42` | Network audit trail |
| `SESSION_ID` | JWT `sid` claim | `a1b2c3d4e5f6g7h8` | Session tracking |

**Implementation in Application (F# example):**

```fsharp
let createContactWithAudit (contact: Contact) (ctx: HttpContext) : Task<Result<Contact, AppError>> =
    task {
        let userId = extractUserIdFromJwt ctx
        let requestId = getCorrelationId ctx
        let ipAddress = getClientIp ctx
        let sessionId = getSessionId ctx
        
        // Populate audit fields BEFORE database insert
        let auditedContact = {
            contact with
                CreatedBy = userId
                UpdatedBy = userId
                RequestId = requestId
                IpAddress = ipAddress
                SessionId = sessionId
        }
        
        let! result = repository.CreateAsync(auditedContact)
        return result
    }
```

### 5.2 Audit Log Retention Policy

| Log Type | Retention Period | Archive Schedule | Compliance Purpose |
|---|---|---|---|
| `USERS_AUDIT_LOG` | 7 years | Quarterly to cold storage | SOC 1 Type II |
| `CONTACTS_AUDIT_LOG` | 7 years | Quarterly to cold storage | SOC 1 Type II + GDPR |
| `SESSIONS_AUDIT_LOG` | 2 years | Annual to cold storage | Access control history |
| Backup Logs | 1 year | Quarterly to cold storage | Recovery verification |

**Archival Process:**

1. **Quarterly (Jan 1, Apr 1, Jul 1, Oct 1):**
   - Export audit records older than 90 days to compressed archive
   - Verify checksum of archive
   - Store on separate immutable storage (S3 with WORM enabled)
   - Delete exported records from live database

2. **Annual (Jan 1):**
   - Validate all archived records for completeness
   - Generate audit trail report for external auditors
   - Archive backup logs older than 1 year

### 5.3 Log Monitoring & Alerting

**Real-time Alerts:**

| Condition | Alert Level | Action |
|---|---|---|
| DELETE from audit tables | **CRITICAL** | Email + PagerDuty + block operation |
| UPDATE to USERS with IS_ACTIVE=0 | **HIGH** | Email operations team |
| 10+ failed login attempts in 1 hour | **MEDIUM** | Email + SMS to user |
| Session token refresh fail rate >5% | **HIGH** | Page on-call DBA |

**Implementation using Oracle Autonomous Database Alerts:**

```sql
BEGIN
    DBMS_SERVER_ALERTS.SET_THRESHOLD(
        metrics_id => DBMS_SERVER_ALERTS.DB_CPU_TIME_RATIO,
        warning_value => 70,
        critical_value => 90,
        observation_period => 5
    );
END;
/
```

---

## Data Integrity & Validation

### 6.1 Constraint Strategy

**Design Principle:** Constraints at database level prevent invalid state, reduce application burden.

#### 6.1.1 Check Constraints

**User Table:**
```sql
-- Username minimum length
CONSTRAINT CK_USERS_USERNAME CHECK (LENGTH(USERNAME) >= 3),

-- Email format (basic)
CONSTRAINT CK_USERS_EMAIL CHECK (REGEXP_LIKE(EMAIL, '^[^@]+@[^@]+\.[^@]+$')),

-- Password hash minimum length (Bcrypt = 60 chars)
CONSTRAINT CK_USERS_PASSWORD CHECK (LENGTH(PASSWORD_HASH) >= 60),

-- Active flag
CONSTRAINT CK_USERS_IS_ACTIVE CHECK (IS_ACTIVE IN (0, 1))
```

**Contact Table:**
```sql
-- Names cannot be empty
CONSTRAINT CK_CONTACTS_NAMES CHECK (LENGTH(FIRST_NAME) > 0 AND LENGTH(LAST_NAME) > 0),

-- Email format (if provided)
CONSTRAINT CK_CONTACTS_EMAIL CHECK (EMAIL IS NULL OR REGEXP_LIKE(EMAIL, '^[^@]+@[^@]+\.[^@]+$')),

-- Phone format (if provided)
CONSTRAINT CK_CONTACTS_PHONE CHECK (PHONE IS NULL OR REGEXP_LIKE(PHONE, '^[0-9]{10,15}$')),

-- Soft delete consistency
CONSTRAINT CK_CONTACTS_DELETION CHECK (
    (SOFT_DELETED = 0 AND DELETED_AT IS NULL AND DELETED_BY IS NULL) OR
    (SOFT_DELETED = 1 AND DELETED_AT IS NOT NULL AND DELETED_BY IS NOT NULL)
)
```

#### 6.1.2 Foreign Key Constraints

```sql
-- Contact references User (cascade delete)
CONSTRAINT FK_CONTACTS_USERS FOREIGN KEY (USER_ID) 
    REFERENCES <TENANT_SCHEMA>.USERS(ID) ON DELETE CASCADE,

-- Session references User (cascade delete)
CONSTRAINT FK_SESSIONS_USERS FOREIGN KEY (USER_ID) 
    REFERENCES <TENANT_SCHEMA>.USERS(ID) ON DELETE CASCADE
```

**Note:** CASCADE DELETE is acceptable for sessions (ephemeral) and audit (preserved) but NOT for permanent user/contact records. Use soft deletes instead.

#### 6.1.3 Unique Constraints

```sql
-- Usernames must be unique per tenant
CONSTRAINT UX_USERS_USERNAME UNIQUE (USERNAME),

-- Emails must be unique per tenant
CONSTRAINT UX_USERS_EMAIL UNIQUE (EMAIL),

-- Emails must be unique per user's contacts
CONSTRAINT UX_CONTACTS_USER_EMAIL UNIQUE (USER_ID, EMAIL)
```

### 6.2 Application-Level Validation

**F# Validation Module:**

```fsharp
module Validation =
    // Email validation with SOC 1 compliance
    let validateEmail (email: string) =
        if String.IsNullOrWhiteSpace(email) then
            Error "Email is required"
        elif not (Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$")) then
            Error "Email format invalid"
        elif email.Length > 256 then
            Error "Email exceeds 256 characters"
        else
            Ok (email.Trim().ToLowerInvariant())
    
    // Phone validation
    let validatePhone (phone: string) =
        if String.IsNullOrWhiteSpace(phone) then
            Ok None
        else
            let digits = Regex.Replace(phone, @"[^\d]", "")
            if digits.Length < 10 || digits.Length > 15 then
                Error "Phone must contain 10-15 digits"
            else
                Ok (Some digits)
    
    // Password validation (entropy check)
    let validatePassword (password: string) =
        if String.IsNullOrWhiteSpace(password) then
            Error "Password is required"
        elif password.Length < 12 then
            Error "Password must be at least 12 characters"
        elif not (Regex.IsMatch(password, @"[A-Z]")) then
            Error "Password must contain uppercase letter"
        elif not (Regex.IsMatch(password, @"[a-z]")) then
            Error "Password must contain lowercase letter"
        elif not (Regex.IsMatch(password, @"[0-9]")) then
            Error "Password must contain digit"
        elif not (Regex.IsMatch(password, @"[!@#$%^&*()_\-+=\[\]{};:'\"<>,.?/\\|`~]")) then
            Error "Password must contain special character"
        else
            Ok password
```

### 6.3 Data Quality Checks

**Daily Job to Detect Inconsistencies:**

```sql
-- Check for orphaned contacts (user deleted but contact still exists)
SELECT COUNT(*) as orphaned_contacts
FROM <TENANT_SCHEMA>.CONTACTS c
WHERE NOT EXISTS (
    SELECT 1 FROM <TENANT_SCHEMA>.USERS u WHERE u.ID = c.USER_ID
);

-- Check for audit logs missing required fields
SELECT COUNT(*) as incomplete_audits
FROM <TENANT_SCHEMA>.USERS_AUDIT_LOG
WHERE CHANGED_BY IS NULL OR REQUEST_ID IS NULL;

-- Check for soft-deleted contacts without deletion timestamp
SELECT COUNT(*) as invalid_deletes
FROM <TENANT_SCHEMA>.CONTACTS
WHERE SOFT_DELETED = 1 AND (DELETED_AT IS NULL OR DELETED_BY IS NULL);
```

---

## Backup & Recovery

### 7.1 Backup Strategy

**RTO (Recovery Time Objective):** 4 hours  
**RPO (Recovery Point Objective):** 1 hour

**Backup Schedule:**

| Type | Frequency | Retention | Destination |
|---|---|---|---|
| Full Backup | Daily @ 2 AM UTC | 30 days | Oracle RMAN backup device |
| Incremental Backup | Hourly (1 AM - 11 PM UTC) | 7 days | Oracle RMAN backup device |
| Log Backup (Archive Logs) | Continuous | 30 days | Oracle RMAN backup device |
| Copy to S3 | Daily @ 4 AM UTC | 7 days | S3 with versioning enabled |
| Quarterly Archive | Every 90 days | 7 years | Glacier/S3 Deep Archive |

**RMAN Configuration:**

```sql
-- Enable archive log mode
ALTER DATABASE ARCHIVELOG;

-- Configure retention
CONFIGURE RETENTION POLICY TO RECOVERY WINDOW OF 30 DAYS;

-- Configure backup destinations
CONFIGURE DEFAULT DEVICE TYPE TO DISK;
CONFIGURE DEVICE TYPE DISK BACKUP TYPE TO BACKUPSET;

-- Example backup script
RUN {
    ALLOCATE CHANNEL c1 TYPE DISK;
    BACKUP DATABASE PLUS ARCHIVELOG;
    RELEASE CHANNEL c1;
}
```

### 7.2 Recovery Procedures

#### 7.2.1 Full Database Recovery

**Scenario:** Complete database loss, restore from most recent full backup.

```bash
#!/bin/bash
# restore_full_database.sh

ORACLE_SID=EFFINSTY
BACKUP_DIR=/oracle/backups

echo "Starting full database recovery..."

# 1. Shutdown database
sqlplus / as sysdba << EOF
    SHUTDOWN IMMEDIATE;
    EXIT;
EOF

# 2. Restore from RMAN backup
rman target / <<BACKUP_EOF
    SET DBID=<DBID>;
    RESTORE CONTROLFILE FROM '${BACKUP_DIR}/autobackup/control.backup';
    ALTER DATABASE MOUNT;
    RESTORE DATABASE;
    RECOVER DATABASE;
    ALTER DATABASE OPEN RESETLOGS;
BACKUP_EOF

echo "Recovery complete. Verify with:"
echo "  sqlplus / as sysdba -c 'SELECT STATUS FROM V\$INSTANCE;'"
```

#### 7.2.2 Point-in-Time Recovery (PITR)

**Scenario:** Accidental data deletion 2 hours ago, recover to specific timestamp.

```sql
-- In RMAN
RECOVER DATABASE UNTIL TIME "TO_DATE('2026-03-12 14:30:00', 'YYYY-MM-DD HH24:MI:SS')";
ALTER DATABASE OPEN RESETLOGS;

-- Verify recovery
SELECT COUNT(*) FROM <TENANT_SCHEMA>.CONTACTS;
SELECT MAX(UPDATED_AT) FROM <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG;
```

#### 7.2.3 Table-Level Recovery

**Scenario:** Single contact record deleted, recover from audit table.

```sql
-- 1. Identify deleted contact from audit log
SELECT OLD_VALUES FROM <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG
WHERE OPERATION = 'DELETE' 
  AND CONTACT_ID = 'xxxxx-xxxxx-xxxxx'
  AND CHANGED_AT > SYSDATE - 1;

-- 2. Restore via INSERT (no trigger)
ALTER TABLE <TENANT_SCHEMA>.CONTACTS DISABLE TRIGGER TRG_CONTACTS_AUDIT_LOG;

INSERT INTO <TENANT_SCHEMA>.CONTACTS (
    ID, TENANT_ID, USER_ID, FIRST_NAME, LAST_NAME, EMAIL, PHONE, ADDRESS, METADATA_JSON, 
    CREATED_AT, UPDATED_AT, CREATED_BY, UPDATED_BY, SOFT_DELETED
)
VALUES (
    'xxxxx-xxxxx-xxxxx',
    <tenant_id>,
    <user_id>,
    <recovered values from JSON>
);

ALTER TABLE <TENANT_SCHEMA>.CONTACTS ENABLE TRIGGER TRG_CONTACTS_AUDIT_LOG;

-- 3. Log recovery action in audit table
INSERT INTO <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG (
    AUDIT_ID, CONTACT_ID, USER_ID, TENANT_ID, OPERATION,
    CHANGED_BY, CHANGED_AT, REQUEST_ID
) VALUES (
    <TENANT_SCHEMA>.SEQ_CONTACTS_AUDIT.NEXTVAL,
    'xxxxx-xxxxx-xxxxx',
    <restored_user_id>,
    <tenant_id>,
    'RECOVERED',
    'DATABASE_ADMIN',
    CURRENT_TIMESTAMP,
    'MANUAL_RECOVERY_' || TRUNC(SYSDATE)
);
```

### 7.3 Backup Testing

**Monthly Recovery Test (SOC 1 Requirement):**

```bash
#!/usr/bin/env bash
# scripts/soc1_test_backup_recovery.sh
set -euo pipefail

export BACKUP_DIR=/oracle/backups
export TARGET_CONNECT=/
export AUXILIARY_CONNECT=sys/<password>@dev_recovery
export TEST_ENV=DEV_RECOVERY

# Prerequisites:
# - auxiliary instance is already created and started NOMOUNT
# - file destinations or DB_FILE_NAME_CONVERT/LOG_FILE_NAME_CONVERT are configured externally
# - the TDE wallet/keystore is open before duplicate/restore work begins

scripts/soc1_test_backup_recovery.sh
```

Operational behavior:

- Select the most recent `.bkp` file in `BACKUP_DIR` modified within the last 24 hours and fail if none exists.
- Run `DUPLICATE TARGET DATABASE TO ${TEST_ENV} BACKUP LOCATION '${BACKUP_DIR}'`.
- Execute SQL*Plus integrity checks with `WHENEVER SQLERROR EXIT SQL.SQLCODE` and `WHENEVER OSERROR EXIT FAILURE`.
- Write row-count metrics plus `ORPHAN_CONTACTS|<count>` to `/oracle/recovery_tests.log`.
- Exit nonzero when orphan contacts are detected or when the orphan metric cannot be parsed.

### 7.4 RMAN Backup Policy (single source of truth)

Create one RMAN policy file before scheduling jobs, then apply it through the wrapper so `BACKUP_DIR` is rendered from the approved deployment environment.

```bash
export BACKUP_DIR=/oracle/backups
export TARGET_CONNECT=/
scripts/soc1_apply_rman_policy.sh
```

The wrapper renders `__BACKUP_DIR__` before applying the RMAN policy and aborts if any unresolved placeholder remains.

Rendered RMAN source:

```sql
-- File: scripts/soc1_rman_policy.rman
CONFIGURE RETENTION POLICY TO RECOVERY WINDOW OF 30 DAYS;
CONFIGURE CONTROLFILE AUTOBACKUP ON;
CONFIGURE CONTROLFILE AUTOBACKUP FORMAT FOR DEVICE TYPE DISK TO '__BACKUP_DIR__/%F_autobkup_%d_%T.ctl';
CONFIGURE BACKUP OPTIMIZATION ON;
CONFIGURE DEVICE TYPE DISK PARALLELISM 2 BACKUP TYPE TO BACKUPSET;
CONFIGURE ENCRYPTION FOR DATABASE ON;
CONFIGURE ENCRYPTION ALGORITHM 'AES256';
CONFIGURE COMPRESSION ALGORITHM 'BASIC';
```

Encryption prerequisite:

- Keep the TDE wallet/keystore configured and open, or use an autologin wallet, before any encrypted RMAN backup or restore job runs.
- Backup entrypoints fail closed when the keystore is not open.

For one-time database setup, run separately as SYSDBA:

```sql
-- File: scripts/soc1_enable_archivelog.sql
WHENEVER SQLERROR EXIT SQL.SQLCODE;
WHENEVER OSERROR EXIT FAILURE;
SHUTDOWN IMMEDIATE;
STARTUP MOUNT;
DECLARE
    l_status VARCHAR2(20);
BEGIN
    SELECT status INTO l_status FROM v$instance;
    IF l_status != 'MOUNTED' THEN
        RAISE_APPLICATION_ERROR(-20001, 'Expected MOUNTED status before enabling ARCHIVELOG.');
    END IF;
END;
/
ALTER DATABASE ARCHIVELOG;
SHUTDOWN IMMEDIATE;
STARTUP;
SELECT LOG_MODE FROM v$database;
```

### 7.5 Automated Backup Jobs (required artifacts)

Use the committed scripts in `scripts/` as the executable source of truth and keep these environment inputs consistent across cron/systemd entries:

```bash
export ORACLE_SID=EFFINSTY
export BACKUP_DIR=/oracle/backups
export TARGET_CONNECT=/
```

Shared script behavior:

- `scripts/oracle_backup_common.sh` validates `ORACLE_SID`, initializes `ORACLE_HOME` via `oraenv` with `ORACLE_HOME` fallback, prepends `${ORACLE_HOME}/bin` to `PATH`, and rejects `BACKUP_DIR` values that are not safe to render into RMAN command files.
- `scripts/backup_full.sh` and `scripts/backup_incremental_hourly.sh` require `BACKUP_DIR` to exist and be writable, then abort unless the Oracle wallet/keystore is open.
- `scripts/backup_full.sh` renders RMAN command files from validated shell inputs, emits session-specific controlfile manifests under `/oracle/ops/manifests/<sid>/`, and computes SHA-256 digests while the backup lock is still held.
- `scripts/soc1_backup_monitor.sh` captures RMAN and SQL*Plus exit codes before the final grep-based health decision so report generation completes even when one subsystem fails.
- `scripts/backup_validate.sh` writes validation output to `/oracle/ops/logs/<sid>/rman/validate-<timestamp>.txt`, counts archived-log backup pieces via `V$BACKUP_PIECE` + `V$BACKUP_SET`, and raises critical status when the newest full backup is missing or at least 30 hours old.
- `scripts/soc1_test_backup_recovery.sh` rejects non-render-safe `BACKUP_DIR` values, skips unreadable backup-piece mtimes with warnings, and fails closed when `ORPHAN_CONTACTS` cannot be parsed as an integer.

```bash
#!/usr/bin/env bash
scripts/backup_full.sh
scripts/backup_incremental_hourly.sh
scripts/backup_validate.sh
```

### 7.6 Backup Monitoring & cold archive

- `backup_full.sh` scheduled:
  - `cron: 0 1 * * *` (UTC) for daily full at 1:00 UTC in each non-standby environment.
- `backup_incremental_hourly.sh` scheduled:
  - `cron: 0 1-23 * * *` (UTC) for hourly incremental + archive logs.
- `backup_validate.sh` scheduled:
  - `cron: 10 7 * * *` (UTC) daily post-backup validation.

- Cold-storage lifecycle:
  - Weekly move files older than 30 days from `${BACKUP_DIR}` to `s3://effinsty-backups-cold`.
  - Retain manifest and checksum manifest in `/oracle/ops/manifests/<sid>/`.
  - Verify manifest checksum after migration and persist result in immutable audit log.

---

## Monitoring & Alerting

### 8.0 Monitoring Architecture

Use one of the following paths for all Week 3 monitoring tasks:

- Path A (preferred if available): Enterprise Manager with `DBMS_SERVER_ALERTS` integration.
- Path B (cloud-neutral fallback): OS/DB script polling + alerting pipeline (Prometheus/Alertmanager + PagerDuty).

Shared requirements for both paths:

- Alert channels:
  - Primary: PagerDuty `integration key` route for P1/P2 incidents.
  - Secondary: email distribution list for ops + support.
- Evidence must be logged for every alert test and production alert using UTC timestamps.
- All monitoring outputs written to an immutable runbook log:
  - `/oracle/ops/evidence/<environment>/<run-date>/monitoring/`
- Change window:
  - New thresholds start in warning-only for 14 days, then full escalation can be enabled after drift review.

### 8.1 Monitoring & Alerting Baseline

| Family | Metric | Source | Warning | Critical | Initial Action |
|---|---|---|---|---|---|
| CPU | DB CPU time ratio | AWR / `DBMS_SERVER_ALERTS.DB_CPU_TIME_RATIO` | `>= 80` for 5m | `>= 90` for 5m | Check top sessions, enable slow query runbook |
| Memory | PGA used (percent of limit) | AWR / `v$pgastat` | `>= 85` for 10m | `>= 92` for 10m | Kill runaway consumers, review plans |
| Memory | SGA target utilization | `v$sgastat` | `>= 82` for 10m | `>= 92` for 10m | Resize if sustained 24h |
| Temp | Temp tablespace free | `DBA_FREE_SPACE` | `<= 20%` | `<= 10%` | Kill heavy sort/temp sessions |
| Disk | Oracle tablespace usage | `DBA_DATA_FILES` / `DBA_TEMP_FILES` | `>= 80%` | `>= 90%` | Add tablespace/datafile or cleanup |
| Process | DB process usage | `V$RESOURCE_LIMIT` | `>= 70%` | `>= 85%` | Increase `PROCESSES`/pool if supported |
| Redo latency | Redo log sync wait | `V$EVENT_NAME` | `> 5 sec` 5m avg | `> 15 sec` 5m avg | Review I/O + archive log path |
| Transactions | Uncommitted transactions | `V$TRANSACTION` | `> 100` | `> 250` | Check app locks and sessions |
| Reliability | Failed logins | `DBA_AUDIT_TRAIL` | `> 10/hour` | `> 25/hour` | Trigger investigation |
| Backups | Full backup age | RMAN (`V$RMAN_STATUS`) | `> 26h` | `> 30h` | Escalate operations immediately |

### 8.2 Monitoring Implementation (SQL + Alerting)

#### 8.2.1 Enterprise Manager path

```sql
-- Add CPU threshold in EM-compatible style
BEGIN
    DBMS_SERVER_ALERTS.SET_THRESHOLD(
        metrics_id => DBMS_SERVER_ALERTS.DB_CPU_TIME_RATIO,
        warning_value => 80,
        critical_value => 90,
        observation_period => 5, -- minutes
        alert_action => 'EMAIL'
    );
END;
/

-- Add user call threshold
BEGIN
    DBMS_SERVER_ALERTS.CREATE_THRESHOLD(
        metrics_id => DBMS_SERVER_ALERTS.USER_CALLS,
        warning_value => 10000,
        critical_value => 20000,
        observation_period => 15, -- minutes
        alert_action => 'EMAIL'
    );
END;
/
```

#### 8.2.2 Custom path (preferred in cloud)

Create recurring SQL checks with a scheduler (cron/systemd timer) and post to PagerDuty.

```sql
-- File: scripts/soc1_monitoring_check.sql
SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF TRIMSPOOL ON LINESIZE 200;
WHENEVER SQLERROR EXIT SQL.SQLCODE;

WITH failed_login_1h AS (
    SELECT
        NVL(USERHOST, 'UNKNOWN') AS userhost,
        NVL(USERNAME, 'UNKNOWN') AS username,
        COUNT(*) AS failures
    FROM dba_audit_trail
    WHERE action_name = 'LOGON'
      AND returncode != 0
      AND timestamp >= SYSTIMESTAMP - INTERVAL '1' HOUR
    GROUP BY NVL(USERHOST, 'UNKNOWN'), NVL(USERNAME, 'UNKNOWN')
)
SELECT 'FAILED_LOGIN_BY_HOST|' || userhost || '|' || failures AS metric
FROM failed_login_1h
WHERE failures > 10
UNION ALL
SELECT 'FAILED_LOGIN_TOTAL|' || SUM(failures) AS metric
FROM failed_login_1h
HAVING SUM(failures) > 10;

SELECT 'BACKUP_LAST_SUCCESS_TS|' || MAX(completion_time) AS metric
FROM v$rman_status
WHERE operation = 'BACKUP'
  AND status = 'COMPLETED'
  AND start_time > SYSDATE - 2;

SELECT 'BACKUP_RETRY_NEEDED|' || DECODE(COUNT(*),0,0,1) AS metric
FROM v$rman_status
WHERE operation = 'BACKUP'
  AND status = 'FAILED'
  AND start_time >= TRUNC(SYSDATE) - 1;
```

Custom orchestrator script should parse `metric` lines and map:

- `FAILED_LOGIN_BY_HOST`/`FAILED_LOGIN_TOTAL` → incident at `critical` if sustained over 10/hour.
- `BACKUP_LAST_SUCCESS_TS` older than 26 hours → `critical`.
- `BACKUP_RETRY_NEEDED = 1` → `critical`.

### 8.3 Failed Login, Slow Query, and Lock Detection

#### 8.3.1 Failed login and login source checks

```sql
-- Hourly failed login summary
SELECT
    USERHOST,
    USERNAME,
    COUNT(*) AS failed_logins_1h
FROM dba_audit_trail
WHERE action_name = 'LOGON'
  AND returncode != 0
  AND timestamp >= SYSTIMESTAMP - INTERVAL '1' HOUR
GROUP BY USERHOST, USERNAME
ORDER BY failed_logins_1h DESC;
```

#### 8.3.2 Slow query detection

```sql
-- Enable query monitoring baseline
ALTER SESSION SET STATISTICS_LEVEL = ALL;
-- For deeper parse/elapsed diagnostics, use DBMS_MONITOR, SQL trace, AWR, or ASH.

-- Top SQL by elapsed time (10-second threshold)
SELECT
    s.sql_id,
    s.parsing_schema_name,
    s.executions,
    ROUND(s.elapsed_time / NULLIF(s.executions,0) / 1000000, 2) AS avg_elapsed_s,
    SUBSTR(s.sql_text, 1, 300) AS sql_text
FROM v$sql s
WHERE s.parsing_schema_name = 'EFFINSTY_APP'
  AND s.executions > 0
  AND s.last_active_time >= SYSTIMESTAMP - INTERVAL '15' MINUTE
  AND (s.elapsed_time / NULLIF(s.executions,0) / 1000000) > 10
ORDER BY avg_elapsed_s DESC
FETCH FIRST 25 ROWS ONLY;

-- Top wait events (high contention)
SELECT event, total_waits, time_waited FROM v$system_event
WHERE time_waited > 600
ORDER BY time_waited DESC
FETCH FIRST 25 ROWS ONLY;

-- Blocking lock visibility
SELECT sid, serial#, username, command, status, blocking_session
FROM v$session
WHERE blocking_session IS NOT NULL;
```

#### 8.3.3 Lock response

```sql
-- Caution: only run after business-owner approval.
ALTER SYSTEM KILL SESSION '123,45678' IMMEDIATE;
```

### 8.4 Evidence, escalation, and notification validation

- Notification validation plan:
  - SMTP test: send one warning and one critical test from monitoring engine.
  - PagerDuty test: trigger one synthetic critical event and one warning event.
  - Capture for each:
    - UTC timestamp
    - incident/request id
    - recipient channel(s)
    - alert payload and incident link
- Triage and suppression:
  - If alert is known maintenance event, set maintenance window on matching monitor IDs.
  - Remove suppression immediately after maintenance end.
- Escalation:
  - Level 1: Email + on-call queue acknowledgment SLA 15 minutes.
  - Level 2: PagerDuty escalation after 15 minutes unresolved.
  - Level 3: DBA + engineering manager if unresolved after 45 minutes.
- Closeout evidence:
  - root-cause notes
  - action taken
  - time to mitigate, time to resolve
  - follow-up tasks

### 8.5 Backup monitoring scripts

```bash
#!/usr/bin/env bash
# scripts/soc1_backup_monitor.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="/oracle/ops/evidence/${ORACLE_SID}/monitoring"
REPORT_FILE="${LOG_DIR}/backup-monitor-$(date -u +%Y%m%dT%H%M%SZ).log"

umask 077
mkdir -p "${LOG_DIR}"
chmod 700 "${LOG_DIR}"
: > "${REPORT_FILE}"
chmod 600 "${REPORT_FILE}"

rman_rc=0
if rman target "${TARGET_CONNECT:-/}" <<'RMAN_EOF' >"${REPORT_FILE}" 2>&1
list backup summary;
list failure;
exit;
RMAN_EOF
then
  :
else
  rman_rc=$?
  printf 'RMAN_MONITOR_ERROR|%s\n' "${rman_rc}" >> "${REPORT_FILE}"
fi

sql_rc=0
if sqlplus -s / as sysdba "@${SCRIPT_DIR}/soc1_monitoring_check.sql" >> "${REPORT_FILE}" 2>&1; then
  :
else
  sql_rc=$?
  printf 'SQLPLUS_MONITOR_ERROR|%s\n' "${sql_rc}" >> "${REPORT_FILE}"
fi

monitor_failed=0
if grep -q "BACKUP_RETRY_NEEDED|1" "${REPORT_FILE}" || \
   grep -q "FAILED_LOGIN_BY_HOST" "${REPORT_FILE}" || \
   grep -q "FAILED_LOGIN_TOTAL" "${REPORT_FILE}"; then
  monitor_failed=1
fi

if (( rman_rc != 0 || sql_rc != 0 || monitor_failed != 0 )); then
  echo "CRITICAL: monitoring check failed" >&2
  exit 1
fi
```

---

## Disaster Recovery

### 9.1 DR Plan Overview

**RTO:** 4 hours  
**RPO:** 1 hour

**DR Architecture:**

```
Primary Data Center (Primary)
    ├── Production Database (Active)
    ├── Archive Logs → DBFS
    └── RMAN Backups → Backup Device

Secondary Data Center (Standby)
    ├── Data Guard Standby Database (Physical)
    ├── Real-time Log Shipping
    └── Monthly activation drill
```

### 9.2 Data Guard Configuration

**Primary Database:**

```sql
-- Enable force logging
ALTER DATABASE FORCE LOGGING;

-- Configure log archiving
ALTER SYSTEM SET LOG_ARCHIVE_DEST_1 = 'LOCATION=/archive/logs VALID_FOR=(ALL_LOGFILES,ALL_ROLES) DB_UNIQUE_NAME=PRIMARY' SCOPE=BOTH;

-- Create standby redo logs
ALTER DATABASE ADD STANDBY LOGFILE GROUP 4 ('/oradata/redo04.log') SIZE 500M;
ALTER DATABASE ADD STANDBY LOGFILE GROUP 5 ('/oradata/redo05.log') SIZE 500M;
ALTER DATABASE ADD STANDBY LOGFILE GROUP 6 ('/oradata/redo06.log') SIZE 500M;
```

**Standby Database:**

```sql
-- Recover in standby mode
RECOVER MANAGED STANDBY DATABASE DISCONNECT;

-- Apply real-time logs
ALTER DATABASE RECOVER MANAGED STANDBY DATABASE USING CURRENT LOGFILE DISCONNECT;

-- Monitor sync status
SELECT PROTECTION_MODE, PROTECTION_LEVEL FROM V$DATABASE;
-- Should return: MAXIMUM PROTECTION / MAXIMUM AVAILABILITY
```

### 9.3 Failover Procedure

**Scenario: Primary data center destroyed, failover to standby.**

```bash
#!/bin/bash
# failover_to_standby.sh

STANDBY_HOST="dr-db.company.com"
STANDBY_SID="EFFINSTY"

echo "Initiating failover to standby database..."

# 1. Stop log recovery on standby
ssh ${STANDBY_HOST} "
    sqlplus / as sysdba << SQL
        ALTER DATABASE RECOVER MANAGED STANDBY DATABASE CANCEL;
        EXIT;
    SQL
"

# 2. Activate standby as new primary
ssh ${STANDBY_HOST} "
    sqlplus / as sysdba << SQL
        ALTER DATABASE ACTIVATE STANDBY DATABASE;
        EXIT;
    SQL
"

# 3. Verify new primary is accepting connections
ssh ${STANDBY_HOST} "
    sqlplus / as sysdba << SQL
        SELECT STATUS FROM V\$INSTANCE;
        SELECT COUNT(*) FROM <TENANT_SCHEMA>.USERS;
        EXIT;
    SQL
"

# 4. Update application connection strings
# Edit connection pool configuration to point to new primary
# Restart application servers

echo "Failover complete. Application should now connect to new primary."
echo "Initiate reverse replication to restore original primary when possible."
```

---

## Implementation Checklist

### Phase 1: Schema Creation (Week 1)

- [ ] Provision tenant schemas (SYSDBA): run `002_bootstrap_tenant_schemas.sql`
  - Expected:
    - schema user exists (e.g. `TENANT_A`)
    - quota on `USERS` tablespace is granted when that tablespace exists, otherwise the script logs a skip and continues
    - re-run-safe behavior honored (001_init only runs when `<TENANT_SCHEMA>.USERS` absent)
- [ ] Run one tenant-scoped schema migration: execute rendered `001_init.sql` (scripted via `002_bootstrap_tenant_schemas.sql`)
  - Expected artifacts: `USERS`, `CONTACTS`, `SESSIONS`,
    `USERS_AUDIT_LOG`, `CONTACTS_AUDIT_LOG`, `SESSIONS_AUDIT_LOG`,
    `SEQ_USERS_AUDIT`, `SEQ_CONTACTS_AUDIT`, `SEQ_SESSIONS_AUDIT`,
    audit triggers, and `V_*_AUDIT_TRAIL` views.
- [ ] Record migration output checksums
  - Save `DBMS_METADATA.GET_DDL` hash per tenant for:
    - tables (`USERS`, `CONTACTS`, `SESSIONS`)
    - audit tables and sequences
    - triggers and audit views
- [ ] Execute security setup script `003_security_users_and_privileges.sql` for each tenant
  - Expected:
    - roles `EFFINSTY_APP_ROLE`, `EFFINSTY_AUDIT_ROLE`, `EFFINSTY_ADMIN_ROLE`
    - users `effinsty_app`, `effinsty_audit`, `effinsty_admin`
    - no direct `UPDATE`/`DELETE` grants on audit logs to app or audit roles
- [ ] Run `006_soc1_week1_2_validation.sql` section 1 and section 4 for each tenant
  - Expected:
    - object inventory checks return all required tables/sequences/triggers/views
    - audit trigger smoke tests create >=1 row in each audit log table

### Phase 2: Security & Access Control (Week 2)

- [ ] Execute hardening script `004_network_security_and_audit.sql` under SYSDBA
  - Expected:
    - `SQLNET.ENCRYPTION_SERVER = REQUIRED`
    - `SQLNET.ENCRYPTION_TYPES_SERVER` includes `AES256`
    - targeted `EFFINSTY_APP` `INSERT/UPDATE/DELETE TABLE` + `SESSION` auditing is active with `BY ACCESS`
    - `EFFINSTY_PASSWORD_PROFILE` applied to `effinsty_app`, `effinsty_audit`, `effinsty_admin`
- [ ] Apply managed-service note (if applicable): enforce encryption/audit/policies at DB service layer when `ALTER SYSTEM` is restricted.
- [ ] Execute `005_rls_and_session_context.sql` for each tenant
  - Expected:
    - `RLS_CONTACTS_USER_ISOLATION` exists on `CONTACTS`
    - policy is `DISABLED` initially (safe-by-default)
    - default predicate denies rows if `CLIENT_IDENTIFIER` missing
    - application follow-up documented: set `DBMS_SESSION.SET_IDENTIFIER(:server_derived_user_id)` after authentication and never from raw client input
- [ ] Verify access-control matrix in `006_soc1_week1_2_validation.sql`
  - Expected:
    - privilege matrix output aligns with matrix table in Appendix B
    - forbidden direct `UPDATE`/`DELETE` on audit tables are absent for app/audit personas
- [ ] Capture Phase 1–2 rollout sign-off
  - Record: run owner, timestamp (UTC), environment, tenant list, target DB links/SID, and validation outputs.

### Phase 1-2 Rollout Sign-off

| Field | Value |
|---|---|
| Run date (UTC) |  |
| Run owner |  |
| DBA approver |  |
| Environment / DB link / SID |  |
| Tenants executed |  |
| Bootstrap script checksum (`002_bootstrap_tenant_schemas.sql`) |  |
| Migration checksum (`001_init.sql`) |  |
| Security script checksum (`003_security_users_and_privileges.sql`) |  |
| Hardening script checksum (`004_network_security_and_audit.sql`) |  |
| RLS script checksum (`005_rls_and_session_context.sql`) |  |
| Validation script checksum (`006_soc1_week1_2_validation.sql`) |  |
| SQL validation command output refs (table/privilege/audit) |  |
| Approval notes / exceptions |  |

### Phase 3: Monitoring & Alerting (Week 3)

- [ ] Deploy monitoring platform for production and DEV
  - Decision captured in `Monitoring Path` field:
    - `EM` (Enterprise Manager) or `CUSTOM` (custom + alert pipeline)
  - Validate runbook docs exist:
    - `/oracle/ops/runbooks/monitoring.md`
    - `/oracle/ops/evidence/<env>/<run-date>/monitoring/`
- [ ] Configure monitoring thresholds and action mapping (Week 3 baseline)
  - CPU, memory, temp, process, disk, redo latency, uncommitted transaction, failed-login, backup-staleness.
  - Initial warning-only mode for 14 days, then full escalation.
- [ ] Configure failed login alert checks
  - Implement `dba_audit_trail`/`DBA_AUDIT_SESSION` query checks.
  - Alert if failures exceed `10/hour` by user/host for sustained 2 windows.
- [ ] Create slow query detection process
  - Implement session + wait event + SQL elapsed-time view checks.
  - Enforce review/runbook if p95/avg elapsed time breaches.
- [ ] Configure backup job monitoring
  - Validate `scripts/soc1_monitoring_check.sql` output includes:
    - `BACKUP_RETRY_NEEDED`
    - `BACKUP_LAST_SUCCESS_TS`
- [ ] Test alert notifications
  - SMTP test: warning + critical
  - PagerDuty test: warning + critical
  - Evidence persisted with timestamp + incident/request id.
- [ ] Document and sign off monitoring procedures
  - Triage matrix
  - false-positive suppression
  - escalation ownership
  - incident closure criteria

### Phase 4: Backup & Recovery (Week 4)

- [ ] Configure RMAN backup policy as executable standard
  - Create/maintain `scripts/soc1_rman_policy.rman`
  - Apply it through `scripts/soc1_apply_rman_policy.sh`
  - Verify policy includes:
    - archive logging enabled
    - retention window `30 DAYS`
    - encryption + compression enabled
    - `BACKUP_DIR` rendered from the approved deployment environment
    - TDE wallet/keystore open before encrypted RMAN jobs run
- [ ] Create and schedule automated backup scripts
  - `scripts/backup_full.sh`
  - `scripts/backup_incremental_hourly.sh`
  - `scripts/backup_validate.sh`
  - Verify `BACKUP_DIR`, `TARGET_CONNECT`, and wallet prerequisites in the scheduler environment.
  - Verify lockfile and non-overlap behavior.
- [ ] Validate full restore in DEV
  - Run `scripts/soc1_test_backup_recovery.sh`
  - Pre-create the auxiliary instance, start it `NOMOUNT`, and configure isolated file destinations or name conversion first.
  - Verify object-count checks pass, `ORPHAN_CONTACTS|0` is emitted, and record output in `/oracle/recovery_tests.log`.
- [ ] Validate PITR in DEV
  - Capture target timestamp, recover in isolated environment, verify row-count integrity.
- [ ] Document recovery procedures
  - Add RTO/RPO assumptions.
  - Add rollback steps and command-level runbook.
- [ ] Conduct monthly recovery drill
  - Schedule with owner + calendar + evidence bundle:
    - scenario type
    - recovered point
    - elapsed time
    - blockers
    - action items
- [ ] Archive oldest backups to cold storage
  - Implement age-based lifecycle from `/oracle/backups` to `s3://effinsty-backups-cold`.
  - Preserve manifest + checksum artifacts in `/oracle/ops/manifests/<sid>/`.

### Phase 3-4 Runoff Sign-off

| Field | Value |
|---|---|
| Monitoring path (EM or CUSTOM) |  |
| Monitoring engineer |  |
| Week 3 start date (UTC) |  |
| Week 3 completion date (UTC) |  |
| Alert tests completed (email) |  |
| Alert tests completed (PagerDuty) |  |
| Week 4 completion date (UTC) |  |
| Backup policy applied by DBA |  |
| Full recovery (DEV) result |  |
| PITR (DEV) result |  |
| Monthly drill date |  |
| Cold archive manifest count |  |

### Phase 5: Disaster Recovery (Week 5)

- [ ] Register standby topology and baseline capacity for target RTO/RPO
  - Expected: DR topology documented for each environment (`PRIMARY`/`STANDBY`) with hostnames, SIDs, network links, and archive destinations.
- [ ] Create Data Guard physical standby from production baseline
  - Deliverable: standby database created and opened in `MOUNT`, redo transport channels configured.
  - Validation: `V$DATABASE.DATABASE_ROLE` = `PHYSICAL STANDBY`, `open_mode` = `MOUNT`.
- [ ] Configure synchronous physical log shipping (Data Guard)
  - Deliverable: `CONFIGURE DEFAULT LOG ARCHIVE DEST` and `LOG_ARCHIVE_DEST_n` rules for standby.
  - Validate with `SELECT DEST_ID, DEST_NAME, STATUS, DESTINATION FROM V$ARCHIVE_DEST WHERE STATUS='VALID';`
- [ ] Configure and validate managed standby recovery
  - Deliverable: `ALTER DATABASE RECOVER MANAGED STANDBY DATABASE DISCONNECT USING CURRENT LOGFILE;`
  - Validate: `V$MANAGED_STANDBY` shows active managed recovery and `Last_Apply_Time` advancing.
- [ ] Test log apply on standby end-to-end
  - Execute transaction on primary, wait for apply lag, and verify same change is visible via standby apply metrics/redo gap checks.
  - Validate: `V$DATAGUARD_STATS.GAP_STATUS` is `No` during test window.
- [ ] Build and validate standby failover script
  - Deliverable: `scripts/failover_to_standby.sh` and `scripts/revert_to_original_primary.sh` with guardrails and dry-run mode.
  - Validate: scripted steps run successfully in lab with rollback plan and output logs.
- [ ] Conduct documented failover drill
  - Include: outage notification, takeover, post-failover application reconnect, and reverse-replication initiation.
  - Acceptance: RTO measured, evidence captured, blockers logged.
- [ ] Schedule monthly failover tests and evidence retention
  - Add calendar entry for monthly DR test and standard evidence folder naming (`/oracle/ops/evidence/<env>/<date>/dr/`).
- [ ] Create emergency failover runbook
  - Create/refresh ` /oracle/ops/runbooks/disaster_recovery_failover.md ` with command matrix, decision tree, contact list, and post-dr validation checklist.

### Phase 5 Runoff Sign-off

| Field | Value |
|---|---|
| DR lead owner |  |
| DBA approver |  |
| Standby build date (UTC) |  |
| Log shipping validation date (UTC) |  |
| Log apply drill outcome (RTO, lag, blockers) |  |
| Failover drill date (UTC) |  |
| Reverse-replication drill date (UTC) |  |
| Evidence bundle location |  |
| Monthly DR test schedule in calendar |  |
| Emergency runbook location |  |

### Phase 6: Application Integration (Week 6)

- [ ] Implement application-level audit attributes in shared mutation path
  - Populate `CREATED_BY`, `UPDATED_BY`, `REQUEST_ID` for all create/update/delete operations before DB write.
  - Validate with unit/integration asserts on every API command that writes to mutable entities.
- [ ] Add client IP capture and session binding to context
  - Populate `IP_ADDRESS` from trusted headers and `SESSION_ID` from auth/session context on all writes.
  - Validate with request/response integration test.
- [ ] Implement central user/session context propagation for audit procedures
  - Enforce DB context/claim hydration before each repository call.
  - Validate with request trace test that `CLIENT_IDENTIFIER`, `REQUEST_ID`, `SESSION_ID`, and source IP round-trip into audit rows.
- [ ] Implement `SESSIONS_AUDIT_LOG` end-to-end writes
  - Capture LOGIN/REFRESH/LOGOUT/TIMEOUT/REVOKE events with user/timestamp/request/session metadata.
  - Validate that every successful auth event produces one audit row and failed auth produces `STATUS=FAILED`.
- [ ] Add API-level session audit retrieval
  - Add query endpoints or admin report queries for latest session and user audit activity.
  - Validate with at least 3 query use cases (user trail, tenant trail, security incident lookup).
- [ ] Build reusable audit investigation utilities
  - Add `audit_query` scripts/functions for change-window, user activity, and risky-pattern (high-volume writes, IP anomaly, missing request-id).
  - Validate: one utility per major audit table and deterministic output format.
- [ ] Create audit interpretation guide and support training material
  - Add SOP for reading `CHANGED_COLUMNS`, `OLD_VALUES`, `NEW_VALUES`, and event correlation with request/session telemetry.
  - Run support walk-through with two scenario-based exercises.
- [ ] Run E2E audit validation script
  - Execute scenario script: create/update/delete user and contact, rotate session, timeout/refresh.
  - Validate required audit trail completeness for `USERS_AUDIT_LOG`, `CONTACTS_AUDIT_LOG`, and `SESSIONS_AUDIT_LOG`.

### Phase 6 Runoff Sign-off

- [ ] Capture weekly evidence bundle
  - Required artifacts: test outputs, query outputs, sample audit trails, and training attendance notes.

| Field | Value |
|---|---|
| Application owner |  |
| App/DB validation date (UTC) |  |
| E2E audit trail test run ID |  |
| Missing audit-field incidents (count) |  |
| Audit utility verification date |  |
| Support training date |  |
| Runbook updates / docs paths |  |
- [ ] Confirm support team can interpret trail and escalate correctly
  - Validate by mock incident with expected correct hypothesis and remediation path.

### Phase 7: Compliance & Testing (Week 7)

- [ ] Conduct full SOC 1 compliance audit
  - Run `src/Effinsty.Infrastructure/Migrations/006_soc1_week1_2_validation.sql` against the target tenant schema and confirm object inventory, trigger/view presence, privilege matrix, and security baseline all match expected outputs.
  - Cross-check startup schema enforcement against `src/Effinsty.Infrastructure/DbStartupValidationService.fs` and `src/Effinsty.Infrastructure/DbSchemaValidator.fs` before approving production readiness.
  - Reconcile service-user privilege posture and audit settings against `src/Effinsty.Infrastructure/Migrations/003_security_users_and_privileges.sql` and `src/Effinsty.Infrastructure/Migrations/004_network_security_and_audit.sql`.
  - Store executed SQL output, reviewer notes, and approval evidence in `/oracle/ops/evidence/<env>/<date>/compliance/`.
- [ ] Review audit logs for anomalies
  - Run `scripts/soc1_monitoring_check.sql` and inspect `FAILED_LOGIN_BY_HOST`, `FAILED_LOGIN_TOTAL`, `BACKUP_LAST_SUCCESS_TS`, and `BACKUP_RETRY_NEEDED`.
  - Review `USERS_AUDIT_LOG`, `CONTACTS_AUDIT_LOG`, and `SESSIONS_AUDIT_LOG` for missing `CHANGED_BY`, `REQUEST_ID`, `SESSION_ID`, IP metadata, abnormal write volume, or unexplained after-hours changes.
  - Record anomalies, false positives, containment actions, and remediation owners in the Week 7 evidence bundle.
- [ ] Test constraint validation
  - Verify application-side validation coverage for schema and payload rules by running the existing unit coverage in `tests/Effinsty.UnitTests/DomainValidationTests.fs`.
  - Re-run database-side smoke checks from `src/Effinsty.Infrastructure/Migrations/006_soc1_week1_2_validation.sql` for constraints, disallowed audit-table writes, and session-context behavior.
  - Capture rejected insert/update/delete attempts and expected `ORA-` errors as proof that fail-secure controls are active.
- [ ] Test backup/recovery procedures
  - Run `scripts/backup_validate.sh`, `scripts/soc1_backup_monitor.sh`, and `scripts/soc1_test_backup_recovery.sh` in the approved non-production recovery environment.
  - Confirm RMAN policy output, backup freshness, restore object counts, and missing-reference checks match the Week 4 recovery expectations.
  - Append pass/fail output and elapsed recovery time to `/oracle/recovery_tests.log` and archive supporting logs in `/oracle/ops/evidence/<env>/<date>/recovery/`.
- [ ] Prepare audit documentation for external auditors
  - Assemble the minimum artifact set: validation-script output, privilege/grant evidence, anomaly review notes, backup/recovery evidence, monitoring-alert evidence, production change record template, and named sign-offs with UTC timestamps.
  - Ensure each artifact is stamped with environment, execution time, operator, approver, and the source file or script used to generate it.
- [ ] Schedule quarterly compliance reviews
  - Establish a quarterly review cadence covering grant drift, audit-log retention, failed-login trends, backup drill outcomes, DR drill outcomes, and runbook currency.
  - Record control owner, approver, evidence location, and calendar invite or ticket reference for each quarterly review.
- [ ] Update disaster recovery runbooks
  - Reconcile Phase 5 failover documentation with the current topology, command matrix, emergency contacts, RTO/RPO targets, last drill date, and rollback decision points.
  - Confirm the emergency runbook path and link the latest drill evidence bundle before final sign-off.

### Phase 7 Runoff Sign-off

| Field | Value |
|---|---|
| Compliance lead owner |  |
| DBA reviewer |  |
| Week 7 audit execution date (UTC) |  |
| Validation script evidence path |  |
| Audit anomaly review outcome |  |
| Constraint validation result |  |
| Backup/recovery test result |  |
| External auditor packet owner |  |
| Quarterly review cadence / calendar reference |  |
| DR runbook refresh date / path |  |

### Phase 8: Production Deployment (Week 8)

- [ ] Confirm pre-window production readiness
  - Verify the approved maintenance window, rollback owner, communication channel, deployment approver, and evidence folder for `/oracle/ops/evidence/<env>/<date>/production/`.
  - Confirm the backend deployment topology still matches `README.md` and `docs/media/deployment.mmd`, and attach the current frontend release checklist from `frontend/docs/release-runbook.md` to the cutover plan.
  - Confirm Week 7 compliance outputs, backup validation results, and monitoring notification tests are clean before production changes begin.
- [ ] Deploy to production in maintenance window (off-hours)
  - Apply approved database changes first, then deploy the coordinated API artifacts and Kubernetes manifests for the production window.
  - Record start time, operator, artifact versions, image tag, tenant scope, and any deviations from the approved change set.
- [ ] Verify all triggers firing correctly
  - Re-run the object inventory and trigger functional checks from `src/Effinsty.Infrastructure/Migrations/006_soc1_week1_2_validation.sql`.
  - Execute controlled insert/update/delete smoke operations on the tenant schema and confirm `TRG_USERS_AUDIT_LOG`, `TRG_CONTACTS_AUDIT_LOG`, and `TRG_SESSIONS_AUDIT_LOG` produce audit rows with expected request and session metadata.
  - Stop the rollout and evaluate rollback if any trigger is disabled or any required audit row is missing.
- [ ] Monitor audit log growth
  - Capture baseline counts before deployment and at `+15m`, `+1h`, and `+24h` after cutover for each audit table.
  - Review growth against expected transaction volume and investigate spikes, retention pressure, or unexplained sequence gaps.
- [ ] Verify backup jobs completing
  - Run `scripts/soc1_backup_monitor.sh` and inspect `scripts/soc1_monitoring_check.sql` output for backup freshness and retry-needed status after production deployment.
  - Confirm the latest full and incremental jobs completed within policy and attach supporting logs to the production evidence bundle.
- [ ] Verify monitoring alerts working
  - Execute one warning-path and one critical-path alert test using the established Week 3 monitoring procedure.
  - Confirm notification delivery, incident or case ID capture, and maintenance-window suppression behavior where applicable.
- [ ] Conduct post-deployment tests
  - Run backend health checks and critical-path auth/contact tests, then execute the frontend smoke checks documented in `frontend/docs/release-runbook.md`.
  - Confirm login, token refresh, contact CRUD, logout, and health badge or status behavior succeed against production.
  - Confirm deployed tenant mappings would still pass startup schema validation and that no schema-object drift was introduced during the rollout.
- [ ] Apply rollback decision gate
  - Compare results against rollback criteria: missing audit rows, failed trigger checks, backup staleness, broken auth/contact flows, or alerting failures.
  - If any rollback gate fails, execute rollback within the same maintenance window and log the reason, time, and approving owner.
- [ ] Document any production changes
  - Persist executed commands, timestamps, versions, approvers, incidents, follow-up actions, and user-visible impact summary in the production change record.
  - Link production evidence and any variances back to the Week 7 compliance packet.
- [ ] Schedule post-deployment review
  - Schedule a `24-hour` monitoring review and a formal post-deployment review covering audit-log growth, backup freshness, alert noise, incidents, and action items.
  - Capture meeting owner, UTC time, attendee list, and remediation due dates.

### Phase 8 Runoff Sign-off

| Field | Value |
|---|---|
| Production change owner |  |
| Maintenance window date/time (UTC) |  |
| DB deployment completion time (UTC) |  |
| API deployment completion time (UTC) |  |
| Trigger verification result |  |
| Audit log growth review window |  |
| Backup freshness check result |  |
| Monitoring alert test incident IDs |  |
| Post-deployment smoke test result |  |
| Rollback invoked? (Y/N + reason) |  |
| Production evidence bundle path |  |
| Post-deployment review meeting reference |  |

---

## Appendix A: SQL Migration Script

**File: `001_init.sql`** - Run once per tenant schema

```sql
-- ===================================================================
-- Effinsty API - Oracle Schema Initialization
-- SOC 1 Compliant Multi-Tenant Schema
-- ===================================================================
-- Usage: sqlplus / as sysdba @001_init.sql
-- Then edit script to replace <TENANT_SCHEMA> with actual schema name
-- ===================================================================

-- Create schema (assuming user already created)
-- CREATE USER <TENANT_SCHEMA> IDENTIFIED BY <password>;
-- GRANT CREATE SESSION, CREATE TABLE, CREATE TRIGGER, CREATE SEQUENCE TO <TENANT_SCHEMA>;

-- ===================================================================
-- CORE DATA TABLES
-- ===================================================================

CREATE TABLE <TENANT_SCHEMA>.USERS (
    -- [Full DDL from section 3.1.1]
);

CREATE TABLE <TENANT_SCHEMA>.CONTACTS (
    -- [Full DDL from section 3.1.2]
);

CREATE TABLE <TENANT_SCHEMA>.SESSIONS (
    -- [Full DDL from section 3.1.3]
);

-- ===================================================================
-- AUDIT TABLES
-- ===================================================================

CREATE TABLE <TENANT_SCHEMA>.USERS_AUDIT_LOG (
    -- [Full DDL from section 3.2.1]
);

CREATE TABLE <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG (
    -- [Full DDL from section 3.2.2]
);

CREATE TABLE <TENANT_SCHEMA>.SESSIONS_AUDIT_LOG (
    -- [Full DDL from section 3.2.3]
);

-- ===================================================================
-- SEQUENCES FOR AUDIT LOG IDs
-- ===================================================================

CREATE SEQUENCE <TENANT_SCHEMA>.SEQ_USERS_AUDIT
    START WITH 1 INCREMENT BY 1 NOCACHE NOORDER;

CREATE SEQUENCE <TENANT_SCHEMA>.SEQ_CONTACTS_AUDIT
    START WITH 1 INCREMENT BY 1 NOCACHE NOORDER;

CREATE SEQUENCE <TENANT_SCHEMA>.SEQ_SESSIONS_AUDIT
    START WITH 1 INCREMENT BY 1 NOCACHE NOORDER;

-- ===================================================================
-- TRIGGERS
-- ===================================================================

CREATE OR REPLACE TRIGGER <TENANT_SCHEMA>.TRG_USERS_UPDATED_AT
BEFORE UPDATE ON <TENANT_SCHEMA>.USERS
FOR EACH ROW
BEGIN
    :NEW.UPDATED_AT := CURRENT_TIMESTAMP;
    IF :NEW.UPDATED_BY IS NULL THEN
        RAISE_APPLICATION_ERROR(-20001, 'UPDATED_BY cannot be null');
    END IF;
END TRG_USERS_UPDATED_AT;
/

-- [Additional triggers from section 3.3]

-- ===================================================================
-- AUDIT VIEWS
-- ===================================================================

CREATE OR REPLACE VIEW <TENANT_SCHEMA>.V_USERS_AUDIT_TRAIL AS
SELECT
    AUDIT_ID, USER_ID, OPERATION, CHANGED_BY, CHANGED_AT,
    REQUEST_ID, IP_ADDRESS, SESSION_ID, CHANGED_COLUMNS,
    OLD_VALUES, NEW_VALUES
FROM <TENANT_SCHEMA>.USERS_AUDIT_LOG
WHERE CHANGED_AT >= TRUNC(SYSDATE) - 90
ORDER BY CHANGED_AT DESC;

-- ===================================================================
-- INITIALIZATION COMPLETE
-- ===================================================================

COMMIT;

-- Verify installation
SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME LIKE '%AUDIT%' ORDER BY TABLE_NAME;
SELECT TRIGGER_NAME FROM USER_TRIGGERS ORDER BY TRIGGER_NAME;
SELECT SEQUENCE_NAME FROM USER_SEQUENCES ORDER BY SEQUENCE_NAME;

-- Expected output: 3 data tables, 3 audit tables, 3 sequences, 6 triggers
```

---

## Appendix B: Access Control Checklists

### User Privilege Matrix

| Privilege | effinsty_app | effinsty_audit | effinsty_admin | Notes |
|-----------|---|---|---|---|
| SELECT USERS | ✓ | ✓ | ✓ | App needs for auth |
| INSERT USERS | ✓ | ✗ | ✓ | Audit only reads |
| UPDATE USERS | ✓ | ✗ | ✓ | |
| DELETE USERS | ✗ | ✗ | ✗ | Use soft delete |
| SELECT USERS_AUDIT_LOG | ✓ | ✓ | ✓ | All can audit |
| UPDATE USERS_AUDIT_LOG | ✗ | ✗ | ✗ | **CRITICAL:** Never grant |
| DELETE USERS_AUDIT_LOG | ✗ | ✗ | ✓ | Admin only, archival only |

---

## Appendix C: Glossary

| Term | Definition |
|---|---|
| **SOC 1 Type II** | Service Organization Control 1 - Evaluates control activities over system and data security |
| **Audit Trail** | Immutable record of who did what, when, and where |
| **Soft Delete** | Logical deletion (flag SOFT_DELETED=1) preserving data for recovery |
| **RTO** | Recovery Time Objective - target time to restore service |
| **RPO** | Recovery Point Objective - maximum acceptable data loss |
| **RMAN** | Oracle Recovery Manager - backup/recovery tool |
| **Data Guard** | Oracle high-availability feature providing physical standby databases |
| **Row-Level Security (RLS)** | Database-enforced access control limiting rows visible to users |

---

## Document Control

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-03-12 | DevOps Team | Initial release |

**Last Updated:** March 12, 2026  
**Next Review:** September 12, 2026  
**Classification:** INTERNAL
