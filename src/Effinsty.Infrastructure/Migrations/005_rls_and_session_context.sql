-- ===================================================================
-- Effinsty API - Row-Level Security (RLS) + session context helpers
-- Run as tenant schema owner or SYSDBA.
-- ===================================================================
-- Default state: policy is created but disabled.
-- Enable explicitly when readiness gate is approved.
-- ===================================================================
SET DEFINE ON
SET SERVEROUTPUT ON
WHENEVER SQLERROR EXIT SQL.SQLCODE

ACCEPT p_tenant_schema CHAR PROMPT 'Tenant schema name: ' DEFAULT 'TENANT_A'

COLUMN tenant_schema_upper NEW_VALUE v_tenant_schema NOPRINT
SELECT UPPER('&p_tenant_schema') AS tenant_schema_upper FROM dual;

-- Optional: ensure app user identifier context is not lost.
CREATE OR REPLACE PACKAGE "&v_tenant_schema".RLS_POLICY AS
    -- p_schema and p_object are standard Oracle VPD callback parameters.
    FUNCTION CONTACTS_USER_PREDICATE (p_schema VARCHAR2, p_object VARCHAR2) RETURN VARCHAR2;
END RLS_POLICY;
/

CREATE OR REPLACE PACKAGE BODY "&v_tenant_schema".RLS_POLICY AS
    FUNCTION CONTACTS_USER_PREDICATE (p_schema VARCHAR2, p_object VARCHAR2) RETURN VARCHAR2 IS
        l_user_id VARCHAR2(128);
    BEGIN
        -- CLIENT_IDENTIFIER must be populated by trusted server-side code after authentication.
        -- Never copy it directly from client request parameters.
        l_user_id := SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER');

        IF l_user_id IS NULL OR LENGTH(TRIM(l_user_id)) = 0 THEN
            -- Deny access by default when session identity is not supplied.
            RETURN '1 = 0';
        END IF;

        RETURN 'USER_ID = ' || DBMS_ASSERT.ENQUOTE_LITERAL(TRIM(l_user_id));
    END;
END RLS_POLICY;
/

BEGIN
    DBMS_RLS.DROP_POLICY(
        object_schema => '&v_tenant_schema',
        object_name => 'CONTACTS',
        policy_name => 'RLS_CONTACTS_USER_ISOLATION'
    );
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE != -28102 THEN
            RAISE;
        END IF;
END;
/

BEGIN
    DBMS_RLS.ADD_POLICY(
        object_schema => '&v_tenant_schema',
        object_name => 'CONTACTS',
        policy_name => 'RLS_CONTACTS_USER_ISOLATION',
        function_schema => '&v_tenant_schema',
        policy_function => 'RLS_POLICY.CONTACTS_USER_PREDICATE',
        statement_types => 'SELECT,INSERT,UPDATE,DELETE',
        update_check => TRUE
    );

    DBMS_RLS.DISABLE_POLICY(
        object_schema => '&v_tenant_schema',
        object_name => 'CONTACTS',
        policy_name => 'RLS_CONTACTS_USER_ISOLATION'
    );

    DBMS_OUTPUT.PUT_LINE('RLS policy created in disabled state.');
    DBMS_OUTPUT.PUT_LINE('Enable with DBMS_RLS.ENABLE_POLICY when rollout gate is approved.');
END;
/

PROMPT
PROMPT Example follow-up for application session context:
PROMPT   -- Set per DB session after authentication using a trusted, server-derived user id:
PROMPT   BEGIN DBMS_SESSION.SET_IDENTIFIER(:server_derived_user_id); END;
PROMPT /
PROMPT   -- Optional cleanup:
PROMPT   BEGIN DBMS_SESSION.CLEAR_IDENTIFIER; END;
PROMPT /
PROMPT Enablement SQL:
PROMPT   BEGIN DBMS_RLS.ENABLE_POLICY(object_schema => '&v_tenant_schema', object_name => 'CONTACTS', policy_name => 'RLS_CONTACTS_USER_ISOLATION'); END;
PROMPT /
PROMPT
