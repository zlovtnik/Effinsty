-- Soc1 monitoring checks used by soc1_backup_monitor.sh
-- Requires DBA privileges for dba_audit_trail and v$rman_status.

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

SELECT 'BACKUP_RETRY_NEEDED|' || DECODE(COUNT(*), 0, 0, 1) AS metric
FROM v$rman_status
WHERE operation = 'BACKUP'
  AND status = 'FAILED'
  AND start_time >= TRUNC(SYSDATE) - 1;
