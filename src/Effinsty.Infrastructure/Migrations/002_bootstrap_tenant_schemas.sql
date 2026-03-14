-- ===================================================================
-- Effinsty API - Tenant Bootstrap Helper
-- Run as SYSDBA
-- ===================================================================
-- Usage (recommended):
--   sqlplus / as sysdba @002_bootstrap_tenant_schemas.sql
--   1) Enter tenant schema name (e.g. TENANT_A)
--   2) Enter tenant schema password
--   NOTE: escape literal ampersands in passwords as \&.
--   NOTE: single quotes and embedded double quotes are rejected in this SQL*Plus-driven password flow.
--   NOTE: this helper assumes a Unix-like SQL*Plus host because it uses /tmp, HOST sed, and rm -f cleanup.
--
-- Re-run safety:
-- - Existing tenant user is retained.
-- - 001_init.sql is rendered and executed only when <TENANT_SCHEMA>.USERS is missing.
-- - Script prints object checks for re-run diagnosis.
-- - Passwords are entered interactively, but Oracle DDL still exposes password text in SQL history views.
--   Run this script only from a controlled SYSDBA/manual DBA session.
-- ===================================================================
-- Substitution strategy:
-- - This script renders <TENANT_SCHEMA> placeholders and writes a temp rendered file.
-- - The rendered file is executed through SQL*Plus only when the schema is not already initialized.
-- - Run this script from repository root so the 001_init.sql path resolves.
-- - SQL*Plus substitution occurs before PL/SQL parsing, so passwords containing single quotes are unsupported.
-- ===================================================================
SET DEFINE ON
SET SERVEROUTPUT ON
SET VERIFY OFF
SET ESCAPE ON
WHENEVER SQLERROR EXIT SQL.SQLCODE

ACCEPT p_tenant_schema CHAR PROMPT 'Tenant schema name: ' DEFAULT 'TENANT_A'
ACCEPT p_tenant_password HIDE PROMPT 'Tenant schema password: '

COLUMN tenant_schema_upper NEW_VALUE v_tenant_schema NOPRINT
SELECT UPPER(TRIM('&p_tenant_schema')) AS tenant_schema_upper FROM dual;

DEFINE v_tenant_password = '&p_tenant_password'
DEFINE v_init_template = 'src/Effinsty.Infrastructure/Migrations/001_init.sql'
DEFINE v_rendered_init = '/tmp/effinsty_001_init_&v_tenant_schema._schema.sql'
DEFINE v_skip_script = '/tmp/effinsty_001_init_skip.sql'

HOST printf "PROMPT No-op: Skipping 001_init.sql execution for schema &v_tenant_schema (USERS already exists).\n" > "&v_skip_script"

DECLARE
    v_schema_exists NUMBER;
    v_users_count NUMBER;
    v_users_tablespace_count NUMBER;
    v_schema_password VARCHAR2(256) := '&v_tenant_password';
    v_schema_password_token VARCHAR2(512);
    v_schema_name_raw VARCHAR2(128) := '&v_tenant_schema';
    v_schema_name VARCHAR2(128);
BEGIN
    IF TRIM(v_schema_password) IS NULL THEN
        RAISE_APPLICATION_ERROR(-20001, 'Tenant schema password must be provided.');
    END IF;

    IF INSTR(v_schema_password, '''') > 0
       OR INSTR(v_schema_password, '"') > 0
       OR INSTR(v_schema_password, CHR(10)) > 0
       OR INSTR(v_schema_password, CHR(13)) > 0 THEN
        RAISE_APPLICATION_ERROR(
            -20002,
            'Tenant schema password cannot contain single quotes, double quotes, or newline characters in this SQL*Plus-driven workflow.'
        );
    END IF;

    v_schema_password_token := '"' || v_schema_password || '"';
    v_schema_name := DBMS_ASSERT.SIMPLE_SQL_NAME(v_schema_name_raw);

    SELECT COUNT(*)
    INTO v_schema_exists
    FROM dba_users
    WHERE username = v_schema_name;

    IF v_schema_exists = 0 THEN
        EXECUTE IMMEDIATE (
            'CREATE USER "' || v_schema_name || '" IDENTIFIED BY '
            || v_schema_password_token
            || ' PROFILE DEFAULT'
        );
        DBMS_OUTPUT.PUT_LINE('Created tenant user: ' || v_schema_name);
    ELSE
        DBMS_OUTPUT.PUT_LINE('Tenant user already exists: ' || v_schema_name);
    END IF;

    SELECT COUNT(*)
    INTO v_users_tablespace_count
    FROM dba_tablespaces
    WHERE tablespace_name = 'USERS';

    IF v_users_tablespace_count > 0 THEN
        EXECUTE IMMEDIATE 'ALTER USER "' || v_schema_name || '" QUOTA UNLIMITED ON USERS';
    ELSE
        DBMS_OUTPUT.PUT_LINE('Skipping QUOTA UNLIMITED ON USERS for ' || v_schema_name || ': USERS tablespace not found.');
    END IF;

    EXECUTE IMMEDIATE 'GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE, CREATE TRIGGER, CREATE VIEW TO "' || v_schema_name || '"';
    EXECUTE IMMEDIATE 'GRANT CREATE PROCEDURE TO "' || v_schema_name || '"';

    SELECT COUNT(*)
    INTO v_users_count
    FROM dba_tables
    WHERE owner = v_schema_name
      AND table_name = 'USERS';

    DBMS_OUTPUT.PUT_LINE('Bootstrap status for schema ' || v_schema_name || ': USERS table present=' || CASE WHEN v_users_count > 0 THEN 'YES' ELSE 'NO' END);
END;
/

-- Render 001_init.sql with schema substitution before deciding execution mode.
HOST sed "s#<TENANT_SCHEMA>#&v_tenant_schema#g" "&v_init_template" > "&v_rendered_init"

-- SQL*Plus-side routing: run migration only when schema is uninitialized.
COLUMN v_init_script_path NEW_VALUE v_init_script_path
SELECT CASE
           WHEN EXISTS (
               SELECT 1
               FROM dba_tables
               WHERE owner = '&v_tenant_schema'
                 AND table_name = 'USERS'
           )
           THEN '&v_skip_script'
           ELSE '&v_rendered_init'
       END AS v_init_script_path
FROM dual;

@&v_init_script_path

-- Optional object sanity check for re-run confidence.
PROMPT
PROMPT ===== Week 1 object sanity check =====
PROMPT TENANT, TABLE, SEQUENCE, TRIGGER, VIEW counts for the tenant after bootstrap:
SELECT owner, object_type, object_name
FROM all_objects
WHERE owner = '&v_tenant_schema'
  AND object_name IN (
        'USERS', 'CONTACTS', 'SESSIONS',
        'USERS_AUDIT_LOG', 'CONTACTS_AUDIT_LOG', 'SESSIONS_AUDIT_LOG',
        'SEQ_USERS_AUDIT', 'SEQ_CONTACTS_AUDIT', 'SEQ_SESSIONS_AUDIT',
        'TRG_USERS_UPDATED_AT', 'TRG_CONTACTS_UPDATED_AT',
        'TRG_USERS_AUDIT_LOG', 'TRG_CONTACTS_AUDIT_LOG', 'TRG_SESSIONS_AUDIT_LOG',
        'V_USERS_AUDIT_TRAIL', 'V_CONTACTS_AUDIT_TRAIL', 'V_SESSIONS_AUDIT_TRAIL'
  )
ORDER BY object_type, object_name;

PROMPT Runbook mode: SYSDBA/manual DBA mode with explicit placeholders.
PROMPT 1) sqlplus / as sysdba
PROMPT 2) @002_bootstrap_tenant_schemas.sql
PROMPT 3) rerun safely: script will skip 001_init.sql if USERS already exists, and revalidate by object inventory.

-- Cleanup rendered bootstrap artifacts.
HOST rm -f "&v_rendered_init"
HOST rm -f "&v_skip_script"
