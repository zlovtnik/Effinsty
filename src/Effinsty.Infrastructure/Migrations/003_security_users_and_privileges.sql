-- ===================================================================
-- Effinsty API - Security Users and Privileges
-- Run as SYSDBA.
-- ===================================================================
-- Usage:
--   sqlplus / as sysdba @003_security_users_and_privileges.sql
--   ENTER 1) tenant schema
--   ENTER 2) effinsty_app password
--   ENTER 3) effinsty_audit password
--   ENTER 4) effinsty_admin password
--   NOTE: escape literal ampersands in passwords as \&.
--   NOTE: embedded double quotes are rejected in this SQL*Plus-driven password flow.
-- ===================================================================
SET DEFINE ON
SET SERVEROUTPUT ON
SET VERIFY OFF
SET ESCAPE ON
WHENEVER SQLERROR EXIT SQL.SQLCODE

ACCEPT p_tenant_schema CHAR PROMPT 'Tenant schema name: ' DEFAULT 'TENANT_A'
ACCEPT p_app_password HIDE PROMPT 'effinsty_app password: '
ACCEPT p_audit_password HIDE PROMPT 'effinsty_audit password: '
ACCEPT p_admin_password HIDE PROMPT 'effinsty_admin password: '

DEFINE v_app_password = '&p_app_password'
DEFINE v_audit_password = '&p_audit_password'
DEFINE v_admin_password = '&p_admin_password'

COLUMN tenant_schema_upper NEW_VALUE v_tenant_schema NOPRINT
SELECT DBMS_ASSERT.SIMPLE_SQL_NAME(UPPER('&p_tenant_schema')) AS tenant_schema_upper FROM dual;

-- Keep credentials external to source control.
-- Required inputs are provided at runtime to avoid hard-coded secrets.
-- Create role primitives (no-op if they already exist).
BEGIN
    BEGIN
        EXECUTE IMMEDIATE 'CREATE ROLE EFFINSTY_APP_ROLE';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE NOT IN (-1920, -1921) THEN RAISE; END IF;
    END;

    BEGIN
        EXECUTE IMMEDIATE 'CREATE ROLE EFFINSTY_AUDIT_ROLE';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE NOT IN (-1920, -1921) THEN RAISE; END IF;
    END;

    BEGIN
        EXECUTE IMMEDIATE 'CREATE ROLE EFFINSTY_ADMIN_ROLE';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE NOT IN (-1920, -1921) THEN RAISE; END IF;
    END;
END;
/

-- Ensure required inputs and target tenant exist before grants are applied.
DECLARE
    v_tenant_count NUMBER;
    v_app_password VARCHAR2(256) := '&v_app_password';
    v_audit_password VARCHAR2(256) := '&v_audit_password';
    v_admin_password VARCHAR2(256) := '&v_admin_password';
BEGIN
    IF TRIM(v_app_password) IS NULL OR TRIM(v_audit_password) IS NULL OR TRIM(v_admin_password) IS NULL THEN
        RAISE_APPLICATION_ERROR(-20001, 'All service user passwords must be provided.');
    END IF;

    SELECT COUNT(*)
    INTO v_tenant_count
    FROM dba_users
    WHERE username = '&v_tenant_schema';

    IF v_tenant_count = 0 THEN
        RAISE_APPLICATION_ERROR(
            -20002,
            'Tenant schema &v_tenant_schema not found. Run 002_bootstrap_tenant_schemas.sql first.'
        );
    END IF;

    -- Explicitly remove risky legacy audit-table privileges from service users/roles.
    -- before reapplying matrix grants.
    FOR rec IN (
        SELECT COLUMN_VALUE AS object_name
        FROM TABLE(SYS.ODCIVARCHAR2LIST('USERS_AUDIT_LOG', 'CONTACTS_AUDIT_LOG', 'SESSIONS_AUDIT_LOG'))
    ) LOOP
        BEGIN
            EXECUTE IMMEDIATE
                'REVOKE UPDATE, DELETE ON "&v_tenant_schema".' || rec.object_name ||
                ' FROM EFFINSTY_APP';
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLCODE != -1927 THEN
                    RAISE;
                END IF;
        END;

        BEGIN
            EXECUTE IMMEDIATE
                'REVOKE UPDATE, DELETE ON "&v_tenant_schema".' || rec.object_name ||
                ' FROM EFFINSTY_AUDIT';
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLCODE != -1927 THEN
                    RAISE;
                END IF;
        END;

        BEGIN
            EXECUTE IMMEDIATE
                'REVOKE UPDATE, DELETE ON "&v_tenant_schema".' || rec.object_name ||
                ' FROM EFFINSTY_APP_ROLE';
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLCODE != -1927 THEN
                    RAISE;
                END IF;
        END;

        BEGIN
            EXECUTE IMMEDIATE
                'REVOKE UPDATE, DELETE ON "&v_tenant_schema".' || rec.object_name ||
                ' FROM EFFINSTY_AUDIT_ROLE';
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLCODE != -1927 THEN
                    RAISE;
                END IF;
        END;
    END LOOP;
END;
/

-- Create service accounts if missing.
BEGIN
    DECLARE
        v_count NUMBER;
        v_app_password VARCHAR2(256) := '&v_app_password';
        v_audit_password VARCHAR2(256) := '&v_audit_password';
        v_admin_password VARCHAR2(256) := '&v_admin_password';

        FUNCTION password_token(p_password IN VARCHAR2, p_username IN VARCHAR2) RETURN VARCHAR2 IS
        BEGIN
            IF TRIM(p_password) IS NULL THEN
                RAISE_APPLICATION_ERROR(-20003, p_username || ' password must be provided.');
            END IF;

            IF INSTR(p_password, '"') > 0
               OR INSTR(p_password, CHR(10)) > 0
               OR INSTR(p_password, CHR(13)) > 0 THEN
                RAISE_APPLICATION_ERROR(
                    -20004,
                    p_username || ' password cannot contain double quotes or newline characters in this SQL*Plus-driven workflow.'
                );
            END IF;

            RETURN '"' || p_password || '"';
        END;
    BEGIN
        SELECT COUNT(*) INTO v_count FROM dba_users WHERE username = 'EFFINSTY_APP';
        IF v_count = 0 THEN
            EXECUTE IMMEDIATE
                'CREATE USER EFFINSTY_APP IDENTIFIED BY ' || password_token(v_app_password, 'EFFINSTY_APP');
            DBMS_OUTPUT.PUT_LINE('Created effinsty_app.');
        END IF;

        SELECT COUNT(*) INTO v_count FROM dba_users WHERE username = 'EFFINSTY_AUDIT';
        IF v_count = 0 THEN
            EXECUTE IMMEDIATE
                'CREATE USER EFFINSTY_AUDIT IDENTIFIED BY ' || password_token(v_audit_password, 'EFFINSTY_AUDIT');
            DBMS_OUTPUT.PUT_LINE('Created effinsty_audit.');
        END IF;

        SELECT COUNT(*) INTO v_count FROM dba_users WHERE username = 'EFFINSTY_ADMIN';
        IF v_count = 0 THEN
            EXECUTE IMMEDIATE
                'CREATE USER EFFINSTY_ADMIN IDENTIFIED BY ' || password_token(v_admin_password, 'EFFINSTY_ADMIN');
            DBMS_OUTPUT.PUT_LINE('Created effinsty_admin.');
        END IF;
    END;
END;
/

-- Recommended resource profile and connection quotas.
ALTER USER EFFINSTY_ADMIN QUOTA UNLIMITED ON USERS;
ALTER USER EFFINSTY_APP PROFILE DEFAULT;
ALTER USER EFFINSTY_AUDIT PROFILE DEFAULT;
ALTER USER EFFINSTY_ADMIN PROFILE DEFAULT;

GRANT CREATE SESSION TO EFFINSTY_APP, EFFINSTY_AUDIT, EFFINSTY_ADMIN;

-- Bind role-level privileges to business objects in the tenant schema.
GRANT EFFINSTY_APP_ROLE TO EFFINSTY_APP;
GRANT EFFINSTY_AUDIT_ROLE TO EFFINSTY_AUDIT;
GRANT EFFINSTY_ADMIN_ROLE TO EFFINSTY_ADMIN;

BEGIN
    EXECUTE IMMEDIATE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "&v_tenant_schema".USERS TO EFFINSTY_APP_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "&v_tenant_schema".CONTACTS TO EFFINSTY_APP_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT, INSERT, UPDATE ON "&v_tenant_schema".SESSIONS TO EFFINSTY_APP_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".SEQ_USERS_AUDIT TO EFFINSTY_APP_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".SEQ_CONTACTS_AUDIT TO EFFINSTY_APP_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".SEQ_SESSIONS_AUDIT TO EFFINSTY_APP_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".USERS_AUDIT_LOG TO EFFINSTY_APP_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".CONTACTS_AUDIT_LOG TO EFFINSTY_APP_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".SESSIONS_AUDIT_LOG TO EFFINSTY_APP_ROLE';

    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".USERS TO EFFINSTY_AUDIT_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".CONTACTS TO EFFINSTY_AUDIT_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".SESSIONS TO EFFINSTY_AUDIT_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".USERS_AUDIT_LOG TO EFFINSTY_AUDIT_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".CONTACTS_AUDIT_LOG TO EFFINSTY_AUDIT_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".SESSIONS_AUDIT_LOG TO EFFINSTY_AUDIT_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".V_USERS_AUDIT_TRAIL TO EFFINSTY_AUDIT_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".V_CONTACTS_AUDIT_TRAIL TO EFFINSTY_AUDIT_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".V_SESSIONS_AUDIT_TRAIL TO EFFINSTY_AUDIT_ROLE';

    EXECUTE IMMEDIATE 'GRANT CREATE TABLE, CREATE SEQUENCE, CREATE TRIGGER, CREATE VIEW TO EFFINSTY_ADMIN_ROLE';
    -- Existing tenant object ALTER/DROP remains a schema-owner or controlled DBA responsibility.

    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".USERS TO EFFINSTY_ADMIN_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".CONTACTS TO EFFINSTY_ADMIN_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT ON "&v_tenant_schema".SESSIONS TO EFFINSTY_ADMIN_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT, DELETE ON "&v_tenant_schema".USERS_AUDIT_LOG TO EFFINSTY_ADMIN_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT, DELETE ON "&v_tenant_schema".CONTACTS_AUDIT_LOG TO EFFINSTY_ADMIN_ROLE';
    EXECUTE IMMEDIATE 'GRANT SELECT, DELETE ON "&v_tenant_schema".SESSIONS_AUDIT_LOG TO EFFINSTY_ADMIN_ROLE';
END;
/

PROMPT
PROMPT SECURITY NOTE:
PROMPT - effinsty_app and effinsty_audit are not granted UPDATE/DELETE on audit logs.
PROMPT - Use role grants above as the source of truth and review in DBA_TAB_PRIVS.
PROMPT - Revoke blocks intentionally removed legacy audit write grants (if found) before applying matrix grants.
PROMPT - Structural changes to existing tenant tables stay with the tenant schema owner or a controlled DBA session.
PROMPT
PROMPT Verification queries (run by a DBA/automation user):
PROMPT   SELECT grantee, table_name, privilege
PROMPT     FROM dba_tab_privs
PROMPT    WHERE grantee IN ('EFFINSTY_APP', 'EFFINSTY_AUDIT', 'EFFINSTY_APP_ROLE', 'EFFINSTY_AUDIT_ROLE')
PROMPT      AND table_name IN ('USERS_AUDIT_LOG', 'CONTACTS_AUDIT_LOG', 'SESSIONS_AUDIT_LOG')
PROMPT      AND privilege IN ('UPDATE', 'DELETE')
PROMPT    ORDER BY grantee, table_name, privilege;
PROMPT
