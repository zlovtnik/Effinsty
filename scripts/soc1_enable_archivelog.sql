-- ===================================================================
-- SOC1 RMAN one-time archive-log setup (run as SYSDBA)
-- ===================================================================
WHENEVER SQLERROR EXIT SQL.SQLCODE;
WHENEVER OSERROR EXIT FAILURE;

SHUTDOWN IMMEDIATE;
STARTUP MOUNT;

DECLARE
    l_status VARCHAR2(20);
BEGIN
    SELECT status
    INTO l_status
    FROM v$instance;

    IF l_status != 'MOUNTED' THEN
        RAISE_APPLICATION_ERROR(-20001, 'Expected instance status MOUNTED before enabling ARCHIVELOG, found ' || l_status);
    END IF;
END;
/

ALTER DATABASE ARCHIVELOG;
SHUTDOWN IMMEDIATE;
STARTUP;

SELECT LOG_MODE FROM v$database;
