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
    OLD_VALUES          CLOB,                      -- Full JSON of previous row
    NEW_VALUES          CLOB,                      -- Full JSON of current row
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
    OLD_VALUES          CLOB,                      -- Full JSON of previous row
    NEW_VALUES          CLOB,                      -- Full JSON of current row
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
            'EMAIL' VALUE :NEW.EMAIL,
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
                'EMAIL' VALUE JSON_OBJECT('old' VALUE :OLD.EMAIL, 'new' VALUE :NEW.EMAIL)
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
            'EMAIL' VALUE :OLD.EMAIL,
            'IS_ACTIVE' VALUE :OLD.IS_ACTIVE,
            'UPDATED_AT' VALUE TO_CHAR(:OLD.UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS.FF3')
        );
        
        v_new_values := JSON_OBJECT(
            'ID' VALUE :NEW.ID,
            'USERNAME' VALUE :NEW.USERNAME,
            'EMAIL' VALUE :NEW.EMAIL,
            'IS_ACTIVE' VALUE :NEW.IS_ACTIVE,
            'UPDATED_AT' VALUE TO_CHAR(:NEW.UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS.FF3'),
            'UPDATED_BY' VALUE :NEW.UPDATED_BY
        );
    ELSIF DELETING THEN
        v_operation := 'DELETE';
        v_old_values := JSON_OBJECT(
            'ID' VALUE :OLD.ID,
            'USERNAME' VALUE :OLD.USERNAME,
            'EMAIL' VALUE :OLD.EMAIL
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
GRANT ALTER TABLE, DROP TABLE TO effinsty_admin;

-- Audit table management (read/delete for archival)
GRANT SELECT, DELETE ON <TENANT_SCHEMA>.USERS_AUDIT_LOG TO effinsty_admin;
GRANT SELECT, DELETE ON <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG TO effinsty_admin;

-- Usage note: DELETE from audit tables only for archival after retention period
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
    -- Get current user from JWT claim stored in context
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
AUDIT ALL BY effinsty_app BY ACCESS;
AUDIT CREATE, ALTER, DROP TABLE BY effinsty_admin BY ACCESS;
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
#!/bin/bash
# test_backup_recovery.sh
# Run 1st Sunday of each month

TEST_ENV="DEV_RECOVERY"
PROD_BACKUP=$(find /oracle/backups -name "*.bkp" -mtime -1 | head -1)

echo "Testing recovery from backup: ${PROD_BACKUP}"

# 1. Create isolated recovery environment
rman <<RMAN_EOF
    DUPLICATE DATABASE ${ORACLE_SID} TO ${TEST_ENV} BACKUP LOCATION '${PROD_BACKUP}';
RMAN_EOF

# 2. Verify data integrity
sqlplus / as sysdba << SQL_EOF
    SET HEAD OFF FEEDBACK OFF PAGESIZE 0;
    SELECT 'Users: ' || COUNT(*) FROM ${TEST_ENV}.USERS;
    SELECT 'Contacts: ' || COUNT(*) FROM ${TEST_ENV}.CONTACTS;
    SELECT 'Audit Records: ' || COUNT(*) FROM ${TEST_ENV}.USERS_AUDIT_LOG;
    
    -- Verify audit integrity
    SELECT 'Missing User IDs in CONTACTS: ' || COUNT(DISTINCT c.USER_ID)
    FROM ${TEST_ENV}.CONTACTS c
    WHERE NOT EXISTS (SELECT 1 FROM ${TEST_ENV}.USERS u WHERE u.ID = c.USER_ID);
SQL_EOF

# 3. Generate recovery test report
echo "Recovery Test: PASSED" >> /oracle/recovery_tests.log
```

---

## Monitoring & Alerting

### 8.1 Database Health Metrics

**Real-time Monitoring Dashboard:**

| Metric | Threshold | Alert | Action |
|---|---|---|---|
| Database CPU | > 80% | YELLOW | Check slow queries |
| Database Memory | > 85% | YELLOW | Monitor PGA usage |
| Redo Log Sync Latency | > 5 sec | RED | Page DBA, review archive settings |
| Uncommitted Transactions | > 100 | YELLOW | Check for hung sessions |
| Disk Space Used | > 80% | YELLOW | Add space, compress archives |
| Failed Authentication | > 10/hour | RED | Investigation required |
| Backup Duration | > 2 hours | YELLOW | Review performance |

**Implementation with Enterprise Manager:**

```sql
-- Add custom metric for audit log growth
BEGIN
    DBMS_SERVER_ALERTS.CREATE_THRESHOLD(
        metrics_id => DBMS_SERVER_ALERTS.USER_CALLS,
        warning_value => 10000,
        critical_value => 50000,
        observation_period => 15,  -- minutes
        alert_action => 'EMAIL'
    );
END;
/
```

### 8.2 Slow Query Detection

**Enable Query Monitoring:**

```sql
-- Enable execution plan logging
ALTER SESSION SET STATISTICS_LEVEL = ALL;

-- Set slow query threshold (queries taking > 1 second)
ALTER SYSTEM SET LONG_PARSE_TIME = 1 SCOPE=BOTH;

-- Query to find slow queries
SELECT *
FROM V$SESSION
WHERE LAST_CALL_ET > 1000  -- 1000 centiseconds = 10 seconds
  AND USERNAME = 'EFFINSTY_APP';

-- Query plan analysis
EXPLAIN PLAN FOR
SELECT * FROM <TENANT_SCHEMA>.CONTACTS
WHERE SOFT_DELETED = 0
ORDER BY UPDATED_AT DESC;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```

### 8.3 Lock Detection

**Monitor for Table Locks:**

```sql
-- View blocking locks
SELECT sid, serial#, username, command, status
FROM v$session
WHERE SID IN (
    SELECT BLOCKING_SESSION FROM v$session WHERE BLOCKING_SESSION IS NOT NULL
);

-- Kill blocking session (with caution)
ALTER SYSTEM KILL SESSION '123,45678' IMMEDIATE;
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

- [ ] Create tenant schemas in Oracle
- [ ] Run migration SQL: `001_init.sql` for each tenant
- [ ] Create audit tables and triggers
- [ ] Create sequences for audit log IDs
- [ ] Create database users (effinsty_app, effinsty_audit, effinsty_admin)
- [ ] Configure privileges per user role
- [ ] Create audit views
- [ ] Test audit triggers with sample data

### Phase 2: Security & Access Control (Week 2)

- [ ] Configure network encryption (TLS 1.2+)
- [ ] Enable database audit trail (`AUDIT ALL BY effinsty_app`)
- [ ] Configure password policies (complexity, expiry)
- [ ] Implement row-level security (RLS) policies
- [ ] Set up database user session tracking
- [ ] Document access control procedures
- [ ] Create access control matrix (user × privilege)

### Phase 3: Monitoring & Alerting (Week 3)

- [ ] Deploy monitoring agent (Enterprise Manager or custom)
- [ ] Configure CPU/memory/disk thresholds
- [ ] Set up failed login alerts
- [ ] Create slow query detection
- [ ] Configure backup job monitoring
- [ ] Test alert notifications (email, PagerDuty)
- [ ] Document monitoring procedures

### Phase 4: Backup & Recovery (Week 4)

- [ ] Configure RMAN backup policy
- [ ] Create automated backup scripts
- [ ] Test full database recovery (DEV environment)
- [ ] Test point-in-time recovery
- [ ] Document recovery procedures
- [ ] Conduct recovery drill (monthly schedule)
- [ ] Archive oldest backups to cold storage

### Phase 5: Disaster Recovery (Week 5)

- [ ] Set up Data Guard physical standby
- [ ] Configure log shipping to standby
- [ ] Test log apply on standby
- [ ] Document failover procedures
- [ ] Conduct failover drill
- [ ] Schedule monthly failover tests
- [ ] Create runbook for emergency failover

### Phase 6: Application Integration (Week 6)

- [ ] Implement audit field population in application (CREATED_BY, UPDATED_BY, REQUEST_ID)
- [ ] Add IP address & session ID capture
- [ ] Implement session tracking (SESSIONS_AUDIT_LOG)
- [ ] Test end-to-end audit trail
- [ ] Create audit query utilities
- [ ] Document audit trail interpretation
- [ ] Train support team on reading audit logs

### Phase 7: Compliance & Testing (Week 7)

- [ ] Conduct full SOC 1 compliance audit
- [ ] Review audit logs for anomalies
- [ ] Test constraint validation
- [ ] Test backup/recovery procedures
- [ ] Prepare audit documentation for external auditors
- [ ] Schedule quarterly compliance reviews
- [ ] Update disaster recovery runbooks

### Phase 8: Production Deployment (Week 8)

- [ ] Deploy to production in maintenance window (off-hours)
- [ ] Verify all triggers firing correctly
- [ ] Monitor audit log growth
- [ ] Verify backup jobs completing
- [ ] Verify monitoring alerts working
- [ ] Conduct post-deployment tests
- [ ] Document any production changes
- [ ] Schedule post-deployment review

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