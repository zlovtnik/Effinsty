-- ===================================================================
-- Effinsty API - SOC 1 Week 1/2 Validation Script
-- ===================================================================
-- Run sequence:
-- 1) Connect as SYSDBA (for object/privilege/security checks).
-- 2) Execute this script.
-- 3) Follow the guided prompts for tenant-session smoke tests.
-- ===================================================================
SET DEFINE ON
SET SERVEROUTPUT ON
SET PAGESIZE 200

ACCEPT p_tenant_schema CHAR PROMPT 'Tenant schema name: ' DEFAULT 'TENANT_A'

COLUMN tenant_schema_upper NEW_VALUE v_tenant_schema NOPRINT
SELECT UPPER('&p_tenant_schema') AS tenant_schema_upper FROM dual;

PROMPT
PROMPT ===== 1) Object inventory checks =====
SELECT 'TABLES_EXIST' AS check_type, t.table_name
FROM dba_tables t
WHERE t.owner = '&v_tenant_schema'
  AND t.table_name IN (
        'USERS','CONTACTS','SESSIONS',
        'USERS_AUDIT_LOG','CONTACTS_AUDIT_LOG','SESSIONS_AUDIT_LOG')
ORDER BY t.table_name;

SELECT 'SEQUENCES_EXIST' AS check_type, s.sequence_name
FROM dba_sequences s
WHERE s.sequence_owner = '&v_tenant_schema'
  AND s.sequence_name IN ('SEQ_USERS_AUDIT','SEQ_CONTACTS_AUDIT','SEQ_SESSIONS_AUDIT')
ORDER BY s.sequence_name;

SELECT 'TRIGGERS_EXIST' AS check_type, tr.trigger_name
FROM dba_triggers tr
WHERE tr.owner = '&v_tenant_schema'
  AND tr.trigger_name IN (
        'TRG_USERS_UPDATED_AT','TRG_CONTACTS_UPDATED_AT',
        'TRG_USERS_AUDIT_LOG','TRG_CONTACTS_AUDIT_LOG','TRG_SESSIONS_AUDIT_LOG'
      )
ORDER BY tr.trigger_name;

SELECT 'VIEWS_EXIST' AS check_type, v.view_name
FROM dba_views v
WHERE v.owner = '&v_tenant_schema'
  AND v.view_name IN ('V_USERS_AUDIT_TRAIL','V_CONTACTS_AUDIT_TRAIL','V_SESSIONS_AUDIT_TRAIL')
ORDER BY v.view_name;

PROMPT
PROMPT ===== 2) Privilege matrix checks =====
SELECT grantee AS role_or_user, p.table_name, p.privilege
FROM dba_tab_privs p
WHERE p.grantee IN ('EFFINSTY_APP_ROLE', 'EFFINSTY_AUDIT_ROLE', 'EFFINSTY_ADMIN_ROLE')
  AND p.owner = '&v_tenant_schema'
  AND p.table_name IS NOT NULL
ORDER BY p.grantee, p.table_name, p.privilege;

SELECT 'FORBIDDEN_DIRECT_PRIVILEGES' AS check_type,
       grantee,
       table_name,
       privilege
FROM dba_tab_privs
WHERE grantee IN ('EFFINSTY_APP', 'EFFINSTY_AUDIT')
  AND owner = '&v_tenant_schema'
  AND table_name IN ('USERS_AUDIT_LOG','CONTACTS_AUDIT_LOG','SESSIONS_AUDIT_LOG')
  AND privilege IN ('UPDATE', 'DELETE')
ORDER BY grantee, table_name, privilege;

SELECT 'FORBIDDEN_ROLE_PRIVILEGES' AS check_type,
       grantee,
       table_name,
       privilege
FROM dba_tab_privs
WHERE grantee IN ('EFFINSTY_APP_ROLE', 'EFFINSTY_AUDIT_ROLE')
  AND owner = '&v_tenant_schema'
  AND table_name IN ('USERS_AUDIT_LOG','CONTACTS_AUDIT_LOG','SESSIONS_AUDIT_LOG')
  AND privilege IN ('UPDATE', 'DELETE')
ORDER BY grantee, table_name, privilege;

PROMPT
PROMPT ===== 2b) Persona-level privilege validation =====
PROMPT Run these commands with each account to prove effective behavior.
PROMPT
PROMPT as effinsty_app:
PROMPT   -- expected OK
PROMPT   SELECT COUNT(*) FROM <TENANT_SCHEMA>.CONTACTS;
PROMPT   SELECT COUNT(*) FROM <TENANT_SCHEMA>.V_CONTACTS_AUDIT_TRAIL;
PROMPT   INSERT INTO <TENANT_SCHEMA>.USERS (ID, TENANT_ID, USERNAME, EMAIL, PASSWORD_HASH, IS_ACTIVE, CREATED_BY, UPDATED_BY)
PROMPT   VALUES (RAWTOHEX(SYS_GUID()), '<TENANT_ID>', 'app_user_smoke', 'app_user_smoke@example.com', 'hash-placeholder', 1, 'smoke', 'smoke');
PROMPT   -- expected ORA-01031
PROMPT   UPDATE <TENANT_SCHEMA>.USERS_AUDIT_LOG SET CHANGED_BY = 'smoke' WHERE ROWNUM = 1;
PROMPT
PROMPT as effinsty_audit:
PROMPT   -- expected OK
PROMPT   SELECT COUNT(*) FROM <TENANT_SCHEMA>.V_USERS_AUDIT_TRAIL;
PROMPT   -- expected ORA-01031
PROMPT   INSERT INTO <TENANT_SCHEMA>.USERS_AUDIT_LOG (AUDIT_ID, USER_ID, TENANT_ID, OPERATION, CHANGED_BY, CHANGED_AT)
PROMPT   VALUES (<SEQUENCE_VALUE>, NULL, '<TENANT_ID>', 'INSERT', 'smoke', CURRENT_TIMESTAMP);
PROMPT
PROMPT as effinsty_admin:
PROMPT   -- expected OK
PROMPT   SELECT COUNT(*) FROM <TENANT_SCHEMA>.USERS;
PROMPT   UPDATE <TENANT_SCHEMA>.USERS_AUDIT_LOG SET CHANGED_BY = 'admin_smoke' WHERE AUDIT_ID = 1;
PROMPT   DELETE FROM <TENANT_SCHEMA>.USERS WHERE ID = '00000000-0000-0000-0000-000000000000';
PROMPT
PROMPT Notes:
PROMPT - The smoke INSERT uses placeholders that must be replaced before execution.
PROMPT - If you see no ORA-01031 on disallowed statements, stop and reassess grant matrix.

PROMPT
PROMPT ===== 3) Security baseline checks =====
SELECT name, value
FROM v$parameter
WHERE name = 'audit_trail';

SELECT username, profile
FROM dba_users
WHERE username IN ('EFFINSTY_APP', 'EFFINSTY_AUDIT', 'EFFINSTY_ADMIN');

SELECT profile, resource_name, limit
FROM dba_profiles
WHERE profile = 'EFFINSTY_PASSWORD_PROFILE'
  AND resource_type = 'PASSWORD'
ORDER BY resource_name;

SELECT username, os_username, terminal, "TIMESTAMP", action, returncode
FROM dba_audit_trail
WHERE username IN ('EFFINSTY_APP', 'EFFINSTY_ADMIN', 'EFFINSTY_AUDIT')
  AND action IN (0, 42, 100, 102, 103)
  AND "TIMESTAMP" >= SYSDATE - 1
ORDER BY "TIMESTAMP" DESC;

-- Audit session-level encryption for the current connection.
PROMPT Verify SQLNET.ENCRYPTION_* and SQLNET.CRYPTO_CHECKSUM_* in sqlnet.ora or the managed service control plane; v$parameter does not surface those sqlnet.ora settings.
SELECT s.sid,
       sc.network_service_banner
FROM v$session s
JOIN v$session_connect_info sc
  ON s.sid = sc.sid
WHERE s.audsid = USERENV('SESSIONID');

PROMPT
PROMPT ===== 4) Audit trigger functional sample =====
PROMPT Run these in tenant session after connecting to the tenant schema.
PROMPT
COLUMN run_id NEW_VALUE v_run_id NOPRINT
SELECT RAWTOHEX(SYS_GUID()) AS run_id FROM dual;
PROMPT   -- Generated run id: &v_run_id
PROMPT
PROMPT   INSERT INTO &v_tenant_schema..USERS (
PROMPT     ID, TENANT_ID, USERNAME, EMAIL, PASSWORD_HASH, IS_ACTIVE, CREATED_BY, UPDATED_BY
PROMPT   ) VALUES
PROMPT   (
PROMPT     RAWTOHEX(SYS_GUID()), '&v_tenant_schema', 'audit_user_&v_run_id', 'audit_user_&v_run_id@example.com', 'hash_placeholder', 1, 'RUN_SMOKE', 'RUN_SMOKE'
PROMPT   );
PROMPT   UPDATE &v_tenant_schema..USERS
PROMPT      SET UPDATED_BY = 'RUN_SMOKE', EMAIL = 'updated_&v_run_id@example.com'
PROMPT    WHERE USERNAME = 'audit_user_&v_run_id';
PROMPT   DELETE FROM &v_tenant_schema..USERS WHERE USERNAME = 'audit_user_&v_run_id';
PROMPT
PROMPT   -- Verify audit rows were written:
PROMPT   SELECT COUNT(*) AS users_audit_count FROM &v_tenant_schema..USERS_AUDIT_LOG WHERE USER_ID IS NOT NULL;
PROMPT
PROMPT   -- Repeat analogous insert/update/delete steps on CONTACTS and verify CONTACTS_AUDIT_LOG.

PROMPT
PROMPT ===== 5) RLS/session-context smoke test =====
PROMPT 1) In a tenant session:
PROMPT    EXEC DBMS_SESSION.SET_IDENTIFIER('00000000-0000-0000-0000-000000000001');
PROMPT    SELECT COUNT(*) FROM &v_tenant_schema..CONTACTS;
PROMPT    EXEC DBMS_SESSION.CLEAR_IDENTIFIER;
PROMPT 2) Validate policy state:
PROMPT    SELECT POLICY_NAME, ENABLED FROM DBA_POLICIES WHERE OBJECT_OWNER = '&v_tenant_schema' AND OBJECT_NAME = 'CONTACTS';
PROMPT 3) Enable policy only after approval:
PROMPT    BEGIN
PROMPT      DBMS_RLS.ENABLE_POLICY(object_schema => '&v_tenant_schema', object_name => 'CONTACTS', policy_name => 'RLS_CONTACTS_USER_ISOLATION');
PROMPT    END;
PROMPT    /
PROMPT 4) Re-test filtering, then disable at end of maintenance:
PROMPT    BEGIN
PROMPT      DBMS_RLS.ENABLE_POLICY(object_schema => '&v_tenant_schema', object_name => 'CONTACTS', policy_name => 'RLS_CONTACTS_USER_ISOLATION', enable => FALSE);
PROMPT    END;
PROMPT    /

PROMPT ==================================
PROMPT End of SOC 1 Week 1/2 validation script.
PROMPT ==================================
