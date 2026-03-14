-- ===================================================================
-- Effinsty API - Network Security, Database Audit, and Password Policy
-- Run as SYSDBA.
-- ===================================================================
-- Runbook scope:
-- - Configure network encryption settings.
-- - Enable baseline database auditing for app/admin accounts.
-- - Create and assign a password policy profile.
-- - SQL-only; managed DB services may require equivalent controls in control plane.
-- ===================================================================
SET DEFINE ON
SET SERVEROUTPUT ON
WHENEVER SQLERROR EXIT SQL.SQLCODE

PROMPT
PROMPT === Network encryption (self-managed Oracle only) ===
PROMPT If managed database forbids ALTER SYSTEM, apply these controls in host console/instance policy instead.

BEGIN
    BEGIN
        EXECUTE IMMEDIATE q'[ALTER SYSTEM SET SQLNET.ENCRYPTION_SERVER = REQUIRED SCOPE=BOTH SID='*']';
        EXECUTE IMMEDIATE q'[ALTER SYSTEM SET SQLNET.ENCRYPTION_TYPES_SERVER = ('AES256') SCOPE=BOTH SID='*']';
        EXECUTE IMMEDIATE q'[ALTER SYSTEM SET SQLNET.CRYPTO_CHECKSUM_SERVER = REQUIRED SCOPE=BOTH SID='*']';
        DBMS_OUTPUT.PUT_LINE('Applied SQLNET encryption/checksum settings via ALTER SYSTEM.');
    EXCEPTION
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE(
                'WARNING: unable to apply SQLNET ALTER SYSTEM settings from this session: '
                || SQLERRM
                || '. Apply equivalent encryption controls via sqlnet.ora or the managed service control plane.'
            );
    END;
END;
/

PROMPT
PROMPT === Standardized audit trail ===
-- Prefer Unified Auditing policies in 12c+ estates when enabled.
-- This migration keeps traditional AUDIT for compatibility with the current deployment model.
DECLARE
    v_user_exists NUMBER;
BEGIN
    FOR rec IN (
        SELECT COLUMN_VALUE AS username
        FROM TABLE(SYS.ODCIVARCHAR2LIST('EFFINSTY_APP', 'EFFINSTY_ADMIN', 'EFFINSTY_AUDIT'))
    ) LOOP
        SELECT COUNT(*)
        INTO v_user_exists
        FROM dba_users
        WHERE username = rec.username;

        IF v_user_exists = 0 THEN
            DBMS_OUTPUT.PUT_LINE('WARNING: User ' || rec.username || ' does not exist. Skipping audit setup.');
        ELSIF rec.username = 'EFFINSTY_APP' THEN
            EXECUTE IMMEDIATE 'AUDIT INSERT TABLE BY EFFINSTY_APP BY ACCESS';
            EXECUTE IMMEDIATE 'AUDIT UPDATE TABLE BY EFFINSTY_APP BY ACCESS';
            EXECUTE IMMEDIATE 'AUDIT DELETE TABLE BY EFFINSTY_APP BY ACCESS';
            EXECUTE IMMEDIATE 'AUDIT SESSION BY EFFINSTY_APP BY ACCESS';
            DBMS_OUTPUT.PUT_LINE('Configured targeted DML/session auditing for EFFINSTY_APP.');
        ELSIF rec.username = 'EFFINSTY_ADMIN' THEN
            EXECUTE IMMEDIATE 'AUDIT CREATE, ALTER, DROP TABLE BY EFFINSTY_ADMIN BY ACCESS';
            EXECUTE IMMEDIATE 'AUDIT SESSION BY EFFINSTY_ADMIN BY ACCESS';
            EXECUTE IMMEDIATE 'AUDIT ROLE BY EFFINSTY_ADMIN BY ACCESS';
            EXECUTE IMMEDIATE 'AUDIT CREATE USER, ALTER USER, DROP USER BY EFFINSTY_ADMIN BY ACCESS';
            DBMS_OUTPUT.PUT_LINE('Configured admin DDL/session auditing for EFFINSTY_ADMIN.');
        ELSIF rec.username = 'EFFINSTY_AUDIT' THEN
            EXECUTE IMMEDIATE 'AUDIT SESSION BY EFFINSTY_AUDIT BY ACCESS';
            DBMS_OUTPUT.PUT_LINE('Configured session auditing for EFFINSTY_AUDIT.');
        END IF;
    END LOOP;
END;
/

PROMPT
PROMPT === Password profile for service users ===
PROMPT Profile name: EFFINSTY_PASSWORD_PROFILE

DECLARE
    v_profile_count NUMBER;
    v_verify_fn VARCHAR2(128);
    v_verify_clause VARCHAR2(4000);
    v_valid_username VARCHAR2(128);
BEGIN
    SELECT COUNT(*) INTO v_profile_count
    FROM dba_profiles
    WHERE profile = 'EFFINSTY_PASSWORD_PROFILE';

    BEGIN
        SELECT CASE
            WHEN EXISTS (
                SELECT 1
                FROM all_objects
                WHERE owner = 'SYS'
                  AND object_type = 'FUNCTION'
                  AND object_name = 'ORA12C_VERIFY_FUNCTION'
            ) THEN 'ORA12C_VERIFY_FUNCTION'
            WHEN EXISTS (
                SELECT 1
                FROM all_objects
                WHERE owner = 'SYS'
                  AND object_type = 'FUNCTION'
                  AND object_name = 'VERIFY_FUNCTION'
            ) THEN 'VERIFY_FUNCTION'
            ELSE NULL
        END
        INTO v_verify_fn
        FROM dual;
    END;

    IF v_verify_fn IS NOT NULL THEN
        v_verify_clause := 'PASSWORD_VERIFY_FUNCTION ' || v_verify_fn;
    ELSE
        v_verify_clause := NULL;
        DBMS_OUTPUT.PUT_LINE('NOTE: No SYS password verify function found; PASSWORD_VERIFY_FUNCTION not applied by this script.');
    END IF;

    IF v_profile_count = 0 THEN
        EXECUTE IMMEDIATE (
            'CREATE PROFILE EFFINSTY_PASSWORD_PROFILE LIMIT '
            || ' PASSWORD_LIFE_TIME 90 '
            || ' FAILED_LOGIN_ATTEMPTS 5 '
            || ' PASSWORD_REUSE_MAX 10 '
            || ' PASSWORD_REUSE_TIME 365 '
            || ' PASSWORD_LOCK_TIME 1/24 '
            || ' PASSWORD_GRACE_TIME 5 '
            || NVL(' ' || v_verify_clause, '')
        );
    ELSE
        EXECUTE IMMEDIATE (
            'ALTER PROFILE EFFINSTY_PASSWORD_PROFILE LIMIT '
            || ' PASSWORD_LIFE_TIME 90 '
            || ' FAILED_LOGIN_ATTEMPTS 5 '
            || ' PASSWORD_REUSE_MAX 10 '
            || ' PASSWORD_REUSE_TIME 365 '
            || ' PASSWORD_LOCK_TIME 1/24 '
            || ' PASSWORD_GRACE_TIME 5 '
            || NVL(' ' || v_verify_clause, '')
        );
    END IF;

    BEGIN
        FOR rec IN (
            SELECT username
            FROM dba_users
            WHERE username IN ('EFFINSTY_APP', 'EFFINSTY_AUDIT', 'EFFINSTY_ADMIN')
        ) LOOP
            v_valid_username := DBMS_ASSERT.SIMPLE_SQL_NAME(rec.username);
            EXECUTE IMMEDIATE 'ALTER USER ' || v_valid_username || ' PROFILE EFFINSTY_PASSWORD_PROFILE';
            DBMS_OUTPUT.PUT_LINE('Assigned EFFINSTY_PASSWORD_PROFILE to ' || v_valid_username);
        END LOOP;
    END;

    DBMS_OUTPUT.PUT_LINE('Configured password profile: EFFINSTY_PASSWORD_PROFILE');
END;
/

PROMPT
PROMPT === Verification SQL snippets ===
PROMPT SQLNET encryption settings:
PROMPT   SELECT sid, network_service_banner
PROMPT     FROM v$session_connect_info
PROMPT    WHERE sid = SYS_CONTEXT('USERENV','SID');
PROMPT   -- Confirm additional sqlnet.ora / service-level controls for managed databases.
PROMPT Audit activity:
PROMPT   SELECT username, action, "TIMESTAMP", obj_name, returncode FROM dba_audit_trail WHERE username IN ('EFFINSTY_APP','EFFINSTY_ADMIN') ORDER BY "TIMESTAMP" DESC;
PROMPT Profile assignment:
PROMPT   SELECT username, profile FROM dba_users WHERE username IN ('EFFINSTY_APP','EFFINSTY_AUDIT','EFFINSTY_ADMIN');
PROMPT Profile definition:
PROMPT   SELECT profile, resource_name, limit FROM dba_profiles WHERE profile = 'EFFINSTY_PASSWORD_PROFILE' AND resource_type = 'PASSWORD' ORDER BY resource_name;
PROMPT
