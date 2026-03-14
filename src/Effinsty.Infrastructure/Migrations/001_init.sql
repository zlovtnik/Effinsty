-- ===================================================================
-- Effinsty API - Oracle Schema Initialization
-- SOC 1 Compliant Multi-Tenant Schema
-- ===================================================================
-- Usage (recommended):
-- 1) Define tenant schema token in your SQL client:
--      DEFINE TENANT_SCHEMA = 'TENANT_A';
-- 2) Substitute <TENANT_SCHEMA> before execution (bootstrap script does this automatically).
-- 3) Run this script while connected as the tenant schema owner.
-- -------------------------------------------------------------------
-- Expected tables:
--  - USERS, CONTACTS, SESSIONS
--  - USERS_AUDIT_LOG, CONTACTS_AUDIT_LOG, SESSIONS_AUDIT_LOG
--  - SEQ_USERS_AUDIT, SEQ_CONTACTS_AUDIT, SEQ_SESSIONS_AUDIT
--  - TRG_USERS_UPDATED_AT, TRG_CONTACTS_UPDATED_AT
--  - TRG_USERS_AUDIT_LOG, TRG_CONTACTS_AUDIT_LOG, TRG_SESSIONS_AUDIT_LOG
--  - V_USERS_AUDIT_TRAIL, V_CONTACTS_AUDIT_TRAIL, V_SESSIONS_AUDIT_TRAIL
-- ===================================================================

-- ===================================================================
-- APPLICATION CONTEXT SUPPORT
-- ===================================================================
CREATE OR REPLACE PACKAGE <TENANT_SCHEMA>.CTX_PKG AS
    PROCEDURE SET_REQUEST_ID(p_request_id IN VARCHAR2);
END;
/

CREATE OR REPLACE PACKAGE BODY <TENANT_SCHEMA>.CTX_PKG AS
    PROCEDURE SET_REQUEST_ID(p_request_id IN VARCHAR2) IS
    BEGIN
        DBMS_SESSION.SET_CONTEXT('APP_CTX', 'REQUEST_ID', p_request_id);
    END;
END;
/

CREATE OR REPLACE CONTEXT APP_CTX USING <TENANT_SCHEMA>.CTX_PKG ACCESSED GLOBALLY;
/

-- Hash email values before writing audit JSON to reduce plaintext PII in immutable logs.
CREATE OR REPLACE FUNCTION <TENANT_SCHEMA>.HASH_AUDIT_EMAIL(
    p_email IN VARCHAR2
) RETURN VARCHAR2 DETERMINISTIC AS
BEGIN
    IF p_email IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN RAWTOHEX(STANDARD_HASH(LOWER(TRIM(p_email)), 'SHA256'));
END;
/

-- ===================================================================
-- CORE DATA TABLES
-- ===================================================================

CREATE TABLE <TENANT_SCHEMA>.USERS (
    ID                  VARCHAR2(36) PRIMARY KEY,
    TENANT_ID           VARCHAR2(64) NOT NULL,
    USERNAME            VARCHAR2(100) NOT NULL,
    EMAIL               VARCHAR2(256) NOT NULL,
    PASSWORD_HASH       VARCHAR2(255) NOT NULL,
    IS_ACTIVE           NUMBER(1, 0) DEFAULT 1 NOT NULL,
    CREATED_AT          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UPDATED_AT          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CREATED_BY          VARCHAR2(36),
    UPDATED_BY          VARCHAR2(36),
    PASSWORD_CHANGED_AT  TIMESTAMP WITH TIME ZONE,
    CONSTRAINT UX_USERS_USERNAME UNIQUE (USERNAME),
    CONSTRAINT UX_USERS_EMAIL UNIQUE (EMAIL)
)
/

CREATE INDEX IX_USERS_EMAIL ON <TENANT_SCHEMA>.USERS (EMAIL)
/
CREATE INDEX IX_USERS_TENANT_UPDATED ON <TENANT_SCHEMA>.USERS (TENANT_ID, UPDATED_AT DESC)
/
CREATE INDEX IX_USERS_CREATED_AT ON <TENANT_SCHEMA>.USERS (CREATED_AT DESC)
/
CREATE TABLE <TENANT_SCHEMA>.CONTACTS (
    ID                  VARCHAR2(36) PRIMARY KEY,
    TENANT_ID           VARCHAR2(64) NOT NULL,
    USER_ID             VARCHAR2(36),
    FIRST_NAME          VARCHAR2(100) NOT NULL,
    LAST_NAME           VARCHAR2(100) NOT NULL,
    EMAIL               VARCHAR2(256),
    PHONE               VARCHAR2(32),
    ADDRESS             VARCHAR2(500),
    METADATA_JSON       CLOB,
    CREATED_AT          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UPDATED_AT          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CREATED_BY          VARCHAR2(36),
    UPDATED_BY          VARCHAR2(36),
    SOFT_DELETED        NUMBER(1, 0) DEFAULT 0 NOT NULL,
    DELETED_AT          TIMESTAMP WITH TIME ZONE,
    DELETED_BY          VARCHAR2(36),
    CONSTRAINT FK_CONTACTS_USERS FOREIGN KEY (USER_ID) REFERENCES <TENANT_SCHEMA>.USERS(ID) ON DELETE SET NULL,
    CONSTRAINT CK_CONTACTS_SOFT_DELETED CHECK (SOFT_DELETED IN (0, 1))
)
/

CREATE INDEX IX_CONTACTS_USER_UPDATED ON <TENANT_SCHEMA>.CONTACTS (USER_ID, UPDATED_AT DESC)
/
CREATE INDEX IX_CONTACTS_USER_EMAIL ON <TENANT_SCHEMA>.CONTACTS (USER_ID, EMAIL)
/
CREATE INDEX IX_CONTACTS_DELETED ON <TENANT_SCHEMA>.CONTACTS (SOFT_DELETED, DELETED_AT DESC)
/
CREATE INDEX IX_CONTACTS_CREATED_AT ON <TENANT_SCHEMA>.CONTACTS (CREATED_AT DESC)
/
CREATE TABLE <TENANT_SCHEMA>.SESSIONS (
    SESSION_ID          VARCHAR2(64) PRIMARY KEY,
    USER_ID             VARCHAR2(36) NOT NULL,
    TENANT_ID           VARCHAR2(64) NOT NULL,
    REFRESH_TOKEN_HASH  VARCHAR2(64) NOT NULL,
    CREATED_AT          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    EXPIRES_AT          TIMESTAMP WITH TIME ZONE NOT NULL,
    REVOKED_AT          TIMESTAMP WITH TIME ZONE,
    CLIENT_IDENTIFIER   VARCHAR2(128),
    CLIENT_IP           VARCHAR2(45),
    CONSTRAINT FK_SESSIONS_USERS FOREIGN KEY (USER_ID) REFERENCES <TENANT_SCHEMA>.USERS(ID) ON DELETE CASCADE
)
/
CREATE INDEX IX_SESSIONS_USER_EXPIRES ON <TENANT_SCHEMA>.SESSIONS (USER_ID, EXPIRES_AT)
/
CREATE INDEX IX_SESSIONS_EXPIRES ON <TENANT_SCHEMA>.SESSIONS (EXPIRES_AT)
/
-- ===================================================================
-- AUDIT TABLES
-- ===================================================================

CREATE TABLE <TENANT_SCHEMA>.USERS_AUDIT_LOG (
    AUDIT_ID            NUMBER PRIMARY KEY,
    USER_ID             VARCHAR2(36),
    TENANT_ID           VARCHAR2(64) NOT NULL,
    OPERATION           VARCHAR2(10) NOT NULL,
    CHANGED_BY          VARCHAR2(36),
    CHANGED_AT          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    REQUEST_ID          VARCHAR2(100),
    IP_ADDRESS          VARCHAR2(45),
    SESSION_ID          VARCHAR2(128),
    CHANGED_COLUMNS     CLOB,
    OLD_VALUES          CLOB,
    NEW_VALUES          CLOB,
    CONSTRAINT CK_USERS_AUDIT_OP CHECK (OPERATION IN ('INSERT', 'UPDATE', 'DELETE'))
)
/

CREATE TABLE <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG (
    AUDIT_ID            NUMBER PRIMARY KEY,
    CONTACT_ID          VARCHAR2(36),
    USER_ID             VARCHAR2(36),
    TENANT_ID           VARCHAR2(64) NOT NULL,
    OPERATION           VARCHAR2(10) NOT NULL,
    CHANGED_BY          VARCHAR2(36),
    CHANGED_AT          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    REQUEST_ID          VARCHAR2(100),
    IP_ADDRESS          VARCHAR2(45),
    SESSION_ID          VARCHAR2(128),
    CHANGED_COLUMNS     CLOB,
    OLD_VALUES          CLOB,
    NEW_VALUES          CLOB,
    CONSTRAINT CK_CONTACTS_AUDIT_OP CHECK (OPERATION IN ('INSERT', 'UPDATE', 'DELETE'))
)
/

CREATE TABLE <TENANT_SCHEMA>.SESSIONS_AUDIT_LOG (
    AUDIT_ID            NUMBER PRIMARY KEY,
    SESSION_ID          VARCHAR2(64),
    USER_ID             VARCHAR2(36),
    TENANT_ID           VARCHAR2(64) NOT NULL,
    EVENT_TYPE          VARCHAR2(20) NOT NULL,
    EVENT_STATUS        VARCHAR2(12) NOT NULL,
    CHANGED_BY          VARCHAR2(36),
    CHANGED_AT          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    REQUEST_ID          VARCHAR2(100),
    IP_ADDRESS          VARCHAR2(45),
    CLIENT_DETAILS      CLOB,
    CONSTRAINT CK_SESSIONS_AUDIT_EVENT CHECK (EVENT_TYPE IN ('LOGIN', 'REFRESH', 'LOGOUT', 'TIMEOUT', 'REVOKE')),
    CONSTRAINT CK_SESSIONS_AUDIT_STATUS CHECK (EVENT_STATUS IN ('SUCCESS', 'FAILED', 'REVOKED'))
)
/

CREATE INDEX IX_USERS_AUDIT_USER ON <TENANT_SCHEMA>.USERS_AUDIT_LOG (USER_ID, CHANGED_AT DESC)
/
CREATE INDEX IX_USERS_AUDIT_TIMESTAMP ON <TENANT_SCHEMA>.USERS_AUDIT_LOG (CHANGED_AT DESC)
/
CREATE INDEX IX_USERS_AUDIT_REQUEST ON <TENANT_SCHEMA>.USERS_AUDIT_LOG (REQUEST_ID)
/
CREATE INDEX IX_CONTACTS_AUDIT_CONTACT ON <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG (CONTACT_ID, CHANGED_AT DESC)
/
CREATE INDEX IX_CONTACTS_AUDIT_USER ON <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG (USER_ID, CHANGED_AT DESC)
/
CREATE INDEX IX_CONTACTS_AUDIT_TIMESTAMP ON <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG (CHANGED_AT DESC)
/
CREATE INDEX IX_CONTACTS_AUDIT_REQUEST ON <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG (REQUEST_ID)
/
CREATE INDEX IX_SESSIONS_AUDIT_SESSION ON <TENANT_SCHEMA>.SESSIONS_AUDIT_LOG (SESSION_ID, CHANGED_AT DESC)
/
CREATE INDEX IX_SESSIONS_AUDIT_USER ON <TENANT_SCHEMA>.SESSIONS_AUDIT_LOG (USER_ID, CHANGED_AT DESC)
/
CREATE INDEX IX_SESSIONS_AUDIT_TIMESTAMP ON <TENANT_SCHEMA>.SESSIONS_AUDIT_LOG (CHANGED_AT DESC)
/
-- ===================================================================
-- SEQUENCES
-- ===================================================================

CREATE SEQUENCE <TENANT_SCHEMA>.SEQ_USERS_AUDIT
    START WITH 1 INCREMENT BY 1 NOCACHE NOORDER
/
CREATE SEQUENCE <TENANT_SCHEMA>.SEQ_CONTACTS_AUDIT
    START WITH 1 INCREMENT BY 1 NOCACHE NOORDER
/
CREATE SEQUENCE <TENANT_SCHEMA>.SEQ_SESSIONS_AUDIT
    START WITH 1 INCREMENT BY 1 NOCACHE NOORDER
/
-- ===================================================================
-- CORE TRIGGERS
-- ===================================================================

CREATE OR REPLACE TRIGGER <TENANT_SCHEMA>.TRG_USERS_UPDATED_AT
BEFORE UPDATE ON <TENANT_SCHEMA>.USERS
FOR EACH ROW
BEGIN
    :NEW.UPDATED_AT := CURRENT_TIMESTAMP;
    IF :NEW.UPDATED_BY IS NULL THEN
        :NEW.UPDATED_BY := SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER');
    END IF;
    IF NVL(:OLD.PASSWORD_HASH, '~~') != NVL(:NEW.PASSWORD_HASH, '~~') THEN
        :NEW.PASSWORD_CHANGED_AT := CURRENT_TIMESTAMP;
    END IF;
END
/

CREATE OR REPLACE TRIGGER <TENANT_SCHEMA>.TRG_CONTACTS_UPDATED_AT
BEFORE UPDATE ON <TENANT_SCHEMA>.CONTACTS
FOR EACH ROW
BEGIN
    :NEW.UPDATED_AT := CURRENT_TIMESTAMP;
    IF :NEW.UPDATED_BY IS NULL THEN
        :NEW.UPDATED_BY := SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER');
    END IF;
END
/

CREATE OR REPLACE TRIGGER <TENANT_SCHEMA>.TRG_USERS_AUDIT_LOG
AFTER INSERT OR UPDATE OR DELETE ON <TENANT_SCHEMA>.USERS
FOR EACH ROW
DECLARE
    l_operation VARCHAR2(10);
    l_user_id VARCHAR2(36);
    l_tenant_id VARCHAR2(64);
    l_changed_by VARCHAR2(36);
    l_request_id VARCHAR2(100);
    l_ip VARCHAR2(45);
    l_session_id VARCHAR2(128);
    l_old_values CLOB;
    l_new_values CLOB;
    l_changed_columns CLOB;
BEGIN
    IF INSERTING THEN
        l_operation := 'INSERT';
        l_user_id := :NEW.ID;
        l_tenant_id := :NEW.TENANT_ID;
        l_changed_by := SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER');
        l_old_values := NULL;
        l_new_values :=
            JSON_OBJECT(
                'ID' VALUE :NEW.ID,
                'TENANT_ID' VALUE :NEW.TENANT_ID,
                'USERNAME' VALUE :NEW.USERNAME,
                'EMAIL_HASH' VALUE <TENANT_SCHEMA>.HASH_AUDIT_EMAIL(:NEW.EMAIL),
                'IS_ACTIVE' VALUE :NEW.IS_ACTIVE
                RETURNING CLOB
            );
        l_changed_columns :=
            JSON_ARRAY(
                'ID',
                'TENANT_ID',
                'USERNAME',
                'EMAIL',
                'IS_ACTIVE',
                'PASSWORD_HASH'
                RETURNING CLOB
            );
    ELSIF UPDATING THEN
        l_operation := 'UPDATE';
        l_user_id := :NEW.ID;
        l_tenant_id := :NEW.TENANT_ID;
        l_changed_by := SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER');
            l_old_values :=
                JSON_OBJECT(
                    'ID' VALUE :OLD.ID,
                    'TENANT_ID' VALUE :OLD.TENANT_ID,
                    'USERNAME' VALUE :OLD.USERNAME,
                    'EMAIL_HASH' VALUE <TENANT_SCHEMA>.HASH_AUDIT_EMAIL(:OLD.EMAIL),
                    'IS_ACTIVE' VALUE :OLD.IS_ACTIVE
                    RETURNING CLOB
                );
        l_new_values :=
            JSON_OBJECT(
                'ID' VALUE :NEW.ID,
                'TENANT_ID' VALUE :NEW.TENANT_ID,
                'USERNAME' VALUE :NEW.USERNAME,
                'EMAIL_HASH' VALUE <TENANT_SCHEMA>.HASH_AUDIT_EMAIL(:NEW.EMAIL),
                'IS_ACTIVE' VALUE :NEW.IS_ACTIVE
                RETURNING CLOB
            );
        l_changed_columns :=
            JSON_ARRAY(
                CASE WHEN :OLD.USERNAME != :NEW.USERNAME THEN 'USERNAME' END,
                CASE WHEN :OLD.EMAIL != :NEW.EMAIL THEN 'EMAIL' END,
                CASE WHEN :OLD.IS_ACTIVE != :NEW.IS_ACTIVE THEN 'IS_ACTIVE' END,
                CASE WHEN NVL(:OLD.PASSWORD_HASH, '~~NULL~~') != NVL(:NEW.PASSWORD_HASH, '~~NULL~~') THEN 'PASSWORD_HASH' END,
                CASE WHEN :OLD.TENANT_ID != :NEW.TENANT_ID THEN 'TENANT_ID' END,
                ABSENT ON NULL
                RETURNING CLOB
            );
    ELSE
        l_operation := 'DELETE';
        l_user_id := :OLD.ID;
        l_tenant_id := :OLD.TENANT_ID;
        l_changed_by := SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER');
        l_old_values :=
            JSON_OBJECT(
                'ID' VALUE :OLD.ID,
                'TENANT_ID' VALUE :OLD.TENANT_ID,
                'USERNAME' VALUE :OLD.USERNAME,
                'EMAIL_HASH' VALUE <TENANT_SCHEMA>.HASH_AUDIT_EMAIL(:OLD.EMAIL),
                'IS_ACTIVE' VALUE :OLD.IS_ACTIVE
                RETURNING CLOB
            );
        l_new_values := NULL;
        l_changed_columns :=
            JSON_ARRAY(
                'ID',
                'TENANT_ID',
                'USERNAME',
                'EMAIL',
                'IS_ACTIVE',
                'PASSWORD_HASH'
                RETURNING CLOB
            );
    END IF;

    l_request_id := SYS_CONTEXT('APP_CTX', 'REQUEST_ID');
    l_ip := SYS_CONTEXT('USERENV', 'IP_ADDRESS');
    l_session_id := SYS_CONTEXT('USERENV', 'SESSIONID');
    IF l_changed_columns IS NULL THEN
        l_changed_columns := JSON_ARRAY('UNKNOWN' RETURNING CLOB);
    END IF;

    INSERT INTO <TENANT_SCHEMA>.USERS_AUDIT_LOG (
        AUDIT_ID,
        USER_ID,
        TENANT_ID,
        OPERATION,
        CHANGED_BY,
        CHANGED_AT,
        REQUEST_ID,
        IP_ADDRESS,
        SESSION_ID,
        CHANGED_COLUMNS,
        OLD_VALUES,
        NEW_VALUES
    ) VALUES (
        <TENANT_SCHEMA>.SEQ_USERS_AUDIT.NEXTVAL,
        l_user_id,
        l_tenant_id,
        l_operation,
        l_changed_by,
        CURRENT_TIMESTAMP,
        l_request_id,
        l_ip,
        l_session_id,
        l_changed_columns,
        l_old_values,
        l_new_values
    );
END
/

CREATE OR REPLACE TRIGGER <TENANT_SCHEMA>.TRG_CONTACTS_AUDIT_LOG
AFTER INSERT OR UPDATE OR DELETE ON <TENANT_SCHEMA>.CONTACTS
FOR EACH ROW
DECLARE
    l_operation VARCHAR2(10);
    l_contact_id VARCHAR2(36);
    l_user_id VARCHAR2(36);
    l_tenant_id VARCHAR2(64);
    l_changed_by VARCHAR2(36);
    l_request_id VARCHAR2(100);
    l_ip VARCHAR2(45);
    l_session_id VARCHAR2(128);
    l_old_values CLOB;
    l_new_values CLOB;
    l_changed_columns CLOB;
BEGIN
    IF INSERTING THEN
        l_operation := 'INSERT';
        l_contact_id := :NEW.ID;
        l_user_id := :NEW.USER_ID;
        l_tenant_id := :NEW.TENANT_ID;
        l_changed_by := SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER');
        l_old_values := NULL;
        l_new_values :=
            JSON_OBJECT(
                'ID' VALUE :NEW.ID,
                'USER_ID' VALUE :NEW.USER_ID,
                'TENANT_ID' VALUE :NEW.TENANT_ID,
                'FIRST_NAME' VALUE :NEW.FIRST_NAME,
                'LAST_NAME' VALUE :NEW.LAST_NAME,
                'EMAIL_HASH' VALUE <TENANT_SCHEMA>.HASH_AUDIT_EMAIL(:NEW.EMAIL),
                'PHONE' VALUE :NEW.PHONE,
                'ADDRESS' VALUE :NEW.ADDRESS,
                'METADATA_JSON' VALUE :NEW.METADATA_JSON,
                'CREATED_AT' VALUE :NEW.CREATED_AT,
                'UPDATED_AT' VALUE :NEW.UPDATED_AT,
                'CREATED_BY' VALUE :NEW.CREATED_BY,
                'UPDATED_BY' VALUE :NEW.UPDATED_BY,
                'SOFT_DELETED' VALUE :NEW.SOFT_DELETED,
                'DELETED_AT' VALUE :NEW.DELETED_AT,
                'DELETED_BY' VALUE :NEW.DELETED_BY
                RETURNING CLOB
            );
        l_changed_columns :=
            JSON_ARRAY(
                'ID',
                'USER_ID',
                'TENANT_ID',
                'FIRST_NAME',
                'LAST_NAME',
                'EMAIL',
                'PHONE',
                'ADDRESS',
                'METADATA_JSON',
                'CREATED_AT',
                'UPDATED_AT',
                'CREATED_BY',
                'UPDATED_BY',
                'SOFT_DELETED',
                'DELETED_AT',
                'DELETED_BY'
                RETURNING CLOB
            );
    ELSIF UPDATING THEN
        l_operation := 'UPDATE';
        l_contact_id := :NEW.ID;
        l_user_id := :NEW.USER_ID;
        l_tenant_id := :NEW.TENANT_ID;
        l_changed_by := SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER');
        l_old_values :=
            JSON_OBJECT(
                'ID' VALUE :OLD.ID,
                'USER_ID' VALUE :OLD.USER_ID,
                'TENANT_ID' VALUE :OLD.TENANT_ID,
                'FIRST_NAME' VALUE :OLD.FIRST_NAME,
                'LAST_NAME' VALUE :OLD.LAST_NAME,
                'EMAIL_HASH' VALUE <TENANT_SCHEMA>.HASH_AUDIT_EMAIL(:OLD.EMAIL),
                'PHONE' VALUE :OLD.PHONE,
                'ADDRESS' VALUE :OLD.ADDRESS,
                'METADATA_JSON' VALUE :OLD.METADATA_JSON,
                'CREATED_AT' VALUE :OLD.CREATED_AT,
                'UPDATED_AT' VALUE :OLD.UPDATED_AT,
                'CREATED_BY' VALUE :OLD.CREATED_BY,
                'UPDATED_BY' VALUE :OLD.UPDATED_BY,
                'SOFT_DELETED' VALUE :OLD.SOFT_DELETED,
                'DELETED_AT' VALUE :OLD.DELETED_AT,
                'DELETED_BY' VALUE :OLD.DELETED_BY
                RETURNING CLOB
            );
        l_new_values :=
            JSON_OBJECT(
                'ID' VALUE :NEW.ID,
                'USER_ID' VALUE :NEW.USER_ID,
                'TENANT_ID' VALUE :NEW.TENANT_ID,
                'FIRST_NAME' VALUE :NEW.FIRST_NAME,
                'LAST_NAME' VALUE :NEW.LAST_NAME,
                'EMAIL_HASH' VALUE <TENANT_SCHEMA>.HASH_AUDIT_EMAIL(:NEW.EMAIL),
                'PHONE' VALUE :NEW.PHONE,
                'ADDRESS' VALUE :NEW.ADDRESS,
                'METADATA_JSON' VALUE :NEW.METADATA_JSON,
                'CREATED_AT' VALUE :NEW.CREATED_AT,
                'UPDATED_AT' VALUE :NEW.UPDATED_AT,
                'CREATED_BY' VALUE :NEW.CREATED_BY,
                'UPDATED_BY' VALUE :NEW.UPDATED_BY,
                'SOFT_DELETED' VALUE :NEW.SOFT_DELETED,
                'DELETED_AT' VALUE :NEW.DELETED_AT,
                'DELETED_BY' VALUE :NEW.DELETED_BY
                RETURNING CLOB
            );
        l_changed_columns :=
            JSON_ARRAY(
                CASE WHEN NVL(:OLD.USER_ID, '~~NULL~~') != NVL(:NEW.USER_ID, '~~NULL~~') THEN 'USER_ID' END,
                CASE WHEN :OLD.TENANT_ID != :NEW.TENANT_ID THEN 'TENANT_ID' END,
                CASE WHEN :OLD.FIRST_NAME != :NEW.FIRST_NAME THEN 'FIRST_NAME' END,
                CASE WHEN :OLD.LAST_NAME != :NEW.LAST_NAME THEN 'LAST_NAME' END,
                CASE WHEN NVL(:OLD.EMAIL, '~~NULL~~') != NVL(:NEW.EMAIL, '~~NULL~~') THEN 'EMAIL' END,
                CASE WHEN NVL(:OLD.PHONE, '~~NULL~~') != NVL(:NEW.PHONE, '~~NULL~~') THEN 'PHONE' END,
                CASE WHEN NVL(:OLD.ADDRESS, '~~NULL~~') != NVL(:NEW.ADDRESS, '~~NULL~~') THEN 'ADDRESS' END,
                CASE
                    WHEN :OLD.METADATA_JSON IS NULL AND :NEW.METADATA_JSON IS NULL THEN NULL
                    WHEN :OLD.METADATA_JSON IS NULL OR :NEW.METADATA_JSON IS NULL THEN 'METADATA_JSON'
                    WHEN DBMS_LOB.COMPARE(:OLD.METADATA_JSON, :NEW.METADATA_JSON) != 0 THEN 'METADATA_JSON'
                END,
                CASE WHEN :OLD.CREATED_AT != :NEW.CREATED_AT THEN 'CREATED_AT' END,
                CASE WHEN :OLD.UPDATED_AT != :NEW.UPDATED_AT THEN 'UPDATED_AT' END,
                CASE WHEN NVL(:OLD.CREATED_BY, '~~NULL~~') != NVL(:NEW.CREATED_BY, '~~NULL~~') THEN 'CREATED_BY' END,
                CASE WHEN NVL(:OLD.UPDATED_BY, '~~NULL~~') != NVL(:NEW.UPDATED_BY, '~~NULL~~') THEN 'UPDATED_BY' END,
                CASE WHEN :OLD.SOFT_DELETED != :NEW.SOFT_DELETED THEN 'SOFT_DELETED' END,
                CASE
                    WHEN NVL(:OLD.DELETED_AT, TO_TIMESTAMP_TZ('1900-01-01 00:00:00 UTC', 'YYYY-MM-DD HH24:MI:SS TZR'))
                       != NVL(:NEW.DELETED_AT, TO_TIMESTAMP_TZ('1900-01-01 00:00:00 UTC', 'YYYY-MM-DD HH24:MI:SS TZR')) THEN 'DELETED_AT'
                END,
                CASE WHEN NVL(:OLD.DELETED_BY, '~~NULL~~') != NVL(:NEW.DELETED_BY, '~~NULL~~') THEN 'DELETED_BY' END,
                ABSENT ON NULL
                RETURNING CLOB
            );
    ELSE
        l_operation := 'DELETE';
        l_contact_id := :OLD.ID;
        l_user_id := :OLD.USER_ID;
        l_tenant_id := :OLD.TENANT_ID;
        l_changed_by := SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER');
        l_old_values :=
            JSON_OBJECT(
                'ID' VALUE :OLD.ID,
                'USER_ID' VALUE :OLD.USER_ID,
                'TENANT_ID' VALUE :OLD.TENANT_ID,
                'FIRST_NAME' VALUE :OLD.FIRST_NAME,
                'LAST_NAME' VALUE :OLD.LAST_NAME,
                'EMAIL_HASH' VALUE <TENANT_SCHEMA>.HASH_AUDIT_EMAIL(:OLD.EMAIL),
                'PHONE' VALUE :OLD.PHONE,
                'ADDRESS' VALUE :OLD.ADDRESS,
                'METADATA_JSON' VALUE :OLD.METADATA_JSON,
                'CREATED_AT' VALUE :OLD.CREATED_AT,
                'UPDATED_AT' VALUE :OLD.UPDATED_AT,
                'CREATED_BY' VALUE :OLD.CREATED_BY,
                'UPDATED_BY' VALUE :OLD.UPDATED_BY,
                'SOFT_DELETED' VALUE :OLD.SOFT_DELETED,
                'DELETED_AT' VALUE :OLD.DELETED_AT,
                'DELETED_BY' VALUE :OLD.DELETED_BY
                RETURNING CLOB
            );
        l_new_values := NULL;
        l_changed_columns :=
            JSON_ARRAY(
                'ID',
                'USER_ID',
                'TENANT_ID',
                'FIRST_NAME',
                'LAST_NAME',
                'EMAIL',
                'PHONE',
                'ADDRESS',
                'METADATA_JSON',
                'CREATED_AT',
                'UPDATED_AT',
                'CREATED_BY',
                'UPDATED_BY',
                'SOFT_DELETED',
                'DELETED_AT',
                'DELETED_BY'
                RETURNING CLOB
            );
    END IF;

    l_request_id := SYS_CONTEXT('APP_CTX', 'REQUEST_ID');
    l_ip := SYS_CONTEXT('USERENV', 'IP_ADDRESS');
    l_session_id := SYS_CONTEXT('USERENV', 'SESSIONID');

    INSERT INTO <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG (
        AUDIT_ID,
        CONTACT_ID,
        USER_ID,
        TENANT_ID,
        OPERATION,
        CHANGED_BY,
        CHANGED_AT,
        REQUEST_ID,
        IP_ADDRESS,
        SESSION_ID,
        CHANGED_COLUMNS,
        OLD_VALUES,
        NEW_VALUES
    ) VALUES (
        <TENANT_SCHEMA>.SEQ_CONTACTS_AUDIT.NEXTVAL,
        l_contact_id,
        l_user_id,
        l_tenant_id,
        l_operation,
        l_changed_by,
        CURRENT_TIMESTAMP,
        l_request_id,
        l_ip,
        l_session_id,
        l_changed_columns,
        l_old_values,
        l_new_values
    );
END
/

CREATE OR REPLACE TRIGGER <TENANT_SCHEMA>.TRG_SESSIONS_AUDIT_LOG
AFTER INSERT OR UPDATE OR DELETE ON <TENANT_SCHEMA>.SESSIONS
FOR EACH ROW
DECLARE
    l_operation VARCHAR2(10);
    l_session_id VARCHAR2(64);
    l_user_id VARCHAR2(36);
    l_tenant_id VARCHAR2(64);
    l_event_type VARCHAR2(20);
    l_status VARCHAR2(12);
    l_changed_by VARCHAR2(36);
    l_request_id VARCHAR2(100);
    l_ip VARCHAR2(45);
BEGIN
    IF INSERTING THEN
        l_operation := 'INSERT';
        l_session_id := :NEW.SESSION_ID;
        l_user_id := :NEW.USER_ID;
        l_tenant_id := :NEW.TENANT_ID;
        l_event_type := 'LOGIN';
        l_status := 'SUCCESS';
        l_changed_by := :NEW.USER_ID;
    ELSIF UPDATING THEN
        l_operation := 'UPDATE';
        l_session_id := :NEW.SESSION_ID;
        l_user_id := :NEW.USER_ID;
        l_tenant_id := :NEW.TENANT_ID;
        l_event_type := CASE WHEN :NEW.REVOKED_AT IS NOT NULL THEN 'REVOKE' ELSE 'REFRESH' END;
        l_status := CASE WHEN :NEW.REVOKED_AT IS NOT NULL THEN 'REVOKED' ELSE 'SUCCESS' END;
        l_changed_by := :NEW.USER_ID;
    ELSE
        l_operation := 'DELETE';
        l_session_id := :OLD.SESSION_ID;
        l_user_id := :OLD.USER_ID;
        l_tenant_id := :OLD.TENANT_ID;
        l_event_type := 'LOGOUT';
        l_status := 'REVOKED';
        l_changed_by := :OLD.USER_ID;
    END IF;

    l_request_id := SYS_CONTEXT('APP_CTX', 'REQUEST_ID');
    l_ip := SYS_CONTEXT('USERENV', 'IP_ADDRESS');

    INSERT INTO <TENANT_SCHEMA>.SESSIONS_AUDIT_LOG (
        AUDIT_ID,
        SESSION_ID,
        USER_ID,
        TENANT_ID,
        EVENT_TYPE,
        EVENT_STATUS,
        CHANGED_BY,
        CHANGED_AT,
        REQUEST_ID,
        IP_ADDRESS,
        CLIENT_DETAILS
    ) VALUES (
        <TENANT_SCHEMA>.SEQ_SESSIONS_AUDIT.NEXTVAL,
        l_session_id,
        l_user_id,
        l_tenant_id,
        l_event_type,
        l_status,
        l_changed_by,
        CURRENT_TIMESTAMP,
        l_request_id,
        l_ip,
        '{"session_event":"' || l_operation || '"}'
    );
END
/

-- ===================================================================
-- AUDIT VIEWS
-- ===================================================================

CREATE OR REPLACE VIEW <TENANT_SCHEMA>.V_USERS_AUDIT_TRAIL AS
SELECT
    ual.AUDIT_ID,
    ual.USER_ID,
    ual.OPERATION,
    ual.CHANGED_BY,
    ual.CHANGED_AT,
    ual.REQUEST_ID,
    ual.IP_ADDRESS,
    ual.SESSION_ID,
    ual.CHANGED_COLUMNS,
    ual.OLD_VALUES,
    ual.NEW_VALUES
FROM <TENANT_SCHEMA>.USERS_AUDIT_LOG ual
ORDER BY ual.CHANGED_AT DESC
/

CREATE OR REPLACE VIEW <TENANT_SCHEMA>.V_CONTACTS_AUDIT_TRAIL AS
SELECT
    cal.AUDIT_ID,
    cal.CONTACT_ID,
    cal.USER_ID,
    cal.OPERATION,
    cal.CHANGED_BY,
    cal.CHANGED_AT,
    cal.REQUEST_ID,
    cal.IP_ADDRESS,
    cal.SESSION_ID,
    cal.CHANGED_COLUMNS,
    cal.OLD_VALUES,
    cal.NEW_VALUES
FROM <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG cal
ORDER BY cal.CHANGED_AT DESC
/

CREATE OR REPLACE VIEW <TENANT_SCHEMA>.V_SESSIONS_AUDIT_TRAIL AS
SELECT
    sal.AUDIT_ID,
    sal.SESSION_ID,
    sal.USER_ID,
    sal.EVENT_TYPE,
    sal.EVENT_STATUS,
    sal.CHANGED_BY,
    sal.CHANGED_AT,
    sal.REQUEST_ID,
    sal.IP_ADDRESS,
    sal.CLIENT_DETAILS
FROM <TENANT_SCHEMA>.SESSIONS_AUDIT_LOG sal
ORDER BY sal.CHANGED_AT DESC
/

-- ===================================================================
-- COMMENTS
-- ===================================================================

COMMENT ON TABLE <TENANT_SCHEMA>.USERS IS 'Core user authentication and profile data. Subject to SOC 1 audit requirements.';
COMMENT ON TABLE <TENANT_SCHEMA>.CONTACTS IS 'Contact records with soft-delete support for recovery.';
COMMENT ON TABLE <TENANT_SCHEMA>.SESSIONS IS 'Active user sessions for login/logout tracking and token lifecycle.';
COMMENT ON TABLE <TENANT_SCHEMA>.USERS_AUDIT_LOG IS 'Immutable audit trail for user row changes. SOC 1 Type II control support.';
COMMENT ON TABLE <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG IS 'Immutable audit trail for contact row changes. SOC 1 Type II control support.';
COMMENT ON TABLE <TENANT_SCHEMA>.SESSIONS_AUDIT_LOG IS 'Session lifecycle events for access control traceability.';
COMMENT ON COLUMN <TENANT_SCHEMA>.USERS_AUDIT_LOG.CHANGED_COLUMNS IS 'JSON payload of changed attributes for each user operation.';
COMMENT ON COLUMN <TENANT_SCHEMA>.USERS_AUDIT_LOG.REQUEST_ID IS 'Application correlation ID for request tracing.';
COMMENT ON COLUMN <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG.CHANGED_COLUMNS IS 'JSON payload of changed attributes for each contact operation.';
COMMENT ON COLUMN <TENANT_SCHEMA>.CONTACTS_AUDIT_LOG.REQUEST_ID IS 'Application correlation ID for request tracing.';

-- ===================================================================
-- VERIFICATION OUTPUT
-- ===================================================================

SELECT TABLE_NAME
FROM USER_TABLES
WHERE TABLE_NAME IN (
    'USERS', 'CONTACTS', 'SESSIONS',
    'USERS_AUDIT_LOG', 'CONTACTS_AUDIT_LOG', 'SESSIONS_AUDIT_LOG'
)
ORDER BY TABLE_NAME;

SELECT SEQUENCE_NAME
FROM USER_SEQUENCES
WHERE SEQUENCE_NAME IN ('SEQ_USERS_AUDIT', 'SEQ_CONTACTS_AUDIT', 'SEQ_SESSIONS_AUDIT')
ORDER BY SEQUENCE_NAME;

SELECT TRIGGER_NAME
FROM USER_TRIGGERS
WHERE TRIGGER_NAME IN (
    'TRG_USERS_UPDATED_AT', 'TRG_CONTACTS_UPDATED_AT',
    'TRG_USERS_AUDIT_LOG', 'TRG_CONTACTS_AUDIT_LOG', 'TRG_SESSIONS_AUDIT_LOG'
)
ORDER BY TRIGGER_NAME;

SELECT VIEW_NAME
FROM USER_VIEWS
WHERE VIEW_NAME IN ('V_USERS_AUDIT_TRAIL', 'V_CONTACTS_AUDIT_TRAIL', 'V_SESSIONS_AUDIT_TRAIL')
ORDER BY VIEW_NAME;
