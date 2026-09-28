const oracledb = require("oracledb");
const { withConnection } = require("../config/database");

const table = "PAYROLL_RECORDS";

function parsePeriod(periodStr) {
  if (!periodStr) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }
  const clean = periodStr.trim();
  if (clean.length === 7) {
    return `${clean}-01`;
  }
  return clean.slice(0, 10);
}

function getPrevPeriod(periodStr) {
  const dt = new Date(parsePeriod(periodStr));
  dt.setMonth(dt.getMonth() - 1);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

async function list(filters = {}) {
  return withConnection(async (c) => {
    let sql = `
      SELECT p.PAYROLL_ID,
             p.STAFF_ID,
             p.USER_ID,
             NVL(s.STAFF_NUMBER, 'STF-' || LPAD(p.STAFF_ID, 4, '0')) AS STAFF_NUMBER,
             u.FULL_NAME,
             u.EMAIL,
             u.ROLE,
             NVL(s.JOB_TITLE, u.ROLE) AS JOB_TITLE,
             NVL(s.DEPARTMENT, 'General Medicine') AS DEPARTMENT,
             u.PROFILE_IMAGE,
             NVL(TRIM(u.STATUS), 'Active') AS USER_STATUS,
             p.BASIC_SALARY,
             p.HOUSING_ALLOWANCE,
             p.TRANSPORT_ALLOWANCE,
             p.GROSS_SALARY,
             p.TAX_DEDUCTION,
             p.SSNIT_DEDUCTION,
             p.NET_SALARY,
             p.MAX_LOAN,
             p.INSURANCE_TIER,
             p.INSURANCE_PREMIUM,
             p.EMPLOYER_INSURANCE,
             p.EMPLOYEE_INSURANCE,
             p.PAYMENT_STATUS,
             p.PAYMENT_DATE,
             p.PAY_PERIOD,
             p.NOTES
      FROM ${table} p
      JOIN STAFF s ON s.STAFF_ID = p.STAFF_ID
      JOIN USERS u ON u.USER_ID = p.USER_ID
      WHERE 1 = 1
    `;

    const binds = {};

    if (filters.period) {
      const periodPrefix = filters.period.slice(0, 7); // e.g. '2026-09'
      sql += ` AND p.PAY_PERIOD LIKE :periodPrefix`;
      binds.periodPrefix = `${periodPrefix}%`;
    } else {
      // Default to the latest period available in the DB
      sql += ` AND p.PAY_PERIOD = (SELECT MAX(p2.PAY_PERIOD) FROM ${table} p2)`;
    }

    if (filters.department && filters.department !== "all" && filters.department !== "All Departments") {
      sql += ` AND UPPER(TRIM(s.DEPARTMENT)) = UPPER(TRIM(:dept))`;
      binds.dept = filters.department.trim();
    }

    if (filters.search) {
      const q = `%${filters.search.trim().toUpperCase()}%`;
      sql += ` AND (
        UPPER(u.FULL_NAME) LIKE :searchQ
        OR UPPER(NVL(s.STAFF_NUMBER, '')) LIKE :searchQ
        OR UPPER(u.EMAIL) LIKE :searchQ
        OR UPPER(NVL(s.JOB_TITLE, '')) LIKE :searchQ
        OR TO_CHAR(s.STAFF_ID) = :searchExact
        OR TO_CHAR(u.USER_ID) = :searchExact
      )`;
      binds.searchQ = q;
      binds.searchExact = filters.search.trim();
    }

    if (filters.status && filters.status !== "all") {
      sql += ` AND UPPER(TRIM(p.PAYMENT_STATUS)) = UPPER(TRIM(:status))`;
      binds.status = filters.status.trim();
    }

    sql += ` ORDER BY u.FULL_NAME ASC`;

    const result = await c.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    return result.rows || [];
  });
}

async function getKpis(periodStr) {
  return withConnection(async (c) => {
    const period = parsePeriod(periodStr);
    const periodPrefix = period.slice(0, 7) + "%";
    const prevPeriodPrefix = getPrevPeriod(period).slice(0, 7) + "%";

    // Current month stats
    const currentRes = await c.execute(
      `SELECT 
         COUNT(*) AS TOTAL_STAFF,
         NVL(SUM(NET_SALARY), 0) AS TOTAL_PAYROLL,
         NVL(SUM(BASIC_SALARY), 0) AS TOTAL_BASIC,
         NVL(SUM(GROSS_SALARY), 0) AS TOTAL_GROSS,
         NVL(SUM(TAX_DEDUCTION), 0) AS TOTAL_TAX,
         NVL(SUM(SSNIT_DEDUCTION), 0) AS TOTAL_SSNIT,
         NVL(SUM(MAX_LOAN), 0) AS TOTAL_LOAN_CAPACITY,
         NVL(SUM(INSURANCE_PREMIUM), 0) AS TOTAL_INSURANCE_PREMIUM,
         NVL(SUM(CASE WHEN PAYMENT_STATUS = 'Paid' THEN 1 ELSE 0 END), 0) AS STAFF_COVERED
       FROM ${table}
       WHERE PAY_PERIOD LIKE :currPeriod`,
      { currPeriod: periodPrefix },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    // Prior month stats for percentage change
    const prevRes = await c.execute(
      `SELECT NVL(SUM(NET_SALARY), 0) AS TOTAL_PAYROLL
       FROM ${table}
       WHERE PAY_PERIOD LIKE :prevPeriod`,
      { prevPeriod: prevPeriodPrefix },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const curr = currentRes.rows?.[0] || {};
    const prev = prevRes.rows?.[0] || {};

    const currPayroll = Number(curr.TOTAL_PAYROLL || 0);
    const prevPayroll = Number(prev.TOTAL_PAYROLL || 0);

    let payrollChange = 0;
    if (prevPayroll > 0) {
      payrollChange = Number((((currPayroll - prevPayroll) / prevPayroll) * 100).toFixed(1));
    }

    return {
      totalPayroll: currPayroll,
      totalBasic: Number(curr.TOTAL_BASIC || 0),
      totalGross: Number(curr.TOTAL_GROSS || 0),
      totalTax: Number(curr.TOTAL_TAX || 0),
      totalSsnit: Number(curr.TOTAL_SSNIT || 0),
      totalLoanCapacity: Number(curr.TOTAL_LOAN_CAPACITY || 0),
      totalInsurancePremium: Number(curr.TOTAL_INSURANCE_PREMIUM || 0),
      totalStaff: Number(curr.TOTAL_STAFF || 0),
      staffCovered: Number(curr.STAFF_COVERED || 0),
      payrollChange,
      payPeriod: period.slice(0, 7),
    };
  });
}

async function getPayslip(identifier, periodStr) {
  return withConnection(async (c) => {
    const periodPrefix = (periodStr || "2026-09").slice(0, 7) + "%";

    const sql = `
      SELECT p.PAYROLL_ID,
             p.STAFF_ID,
             p.USER_ID,
             NVL(s.STAFF_NUMBER, 'STF-' || LPAD(p.STAFF_ID, 4, '0')) AS STAFF_NUMBER,
             u.FULL_NAME,
             u.EMAIL,
             u.PHONE,
             u.ROLE,
             NVL(s.JOB_TITLE, u.ROLE) AS JOB_TITLE,
             NVL(s.DEPARTMENT, 'General Medicine') AS DEPARTMENT,
             u.PROFILE_IMAGE,
             p.BASIC_SALARY,
             p.HOUSING_ALLOWANCE,
             p.TRANSPORT_ALLOWANCE,
             p.OTHER_ALLOWANCES,
             p.GROSS_SALARY,
             p.TAX_DEDUCTION,
             p.SSNIT_DEDUCTION,
             p.OTHER_DEDUCTIONS,
             p.NET_SALARY,
             p.MAX_LOAN,
             p.INSURANCE_TIER,
             p.INSURANCE_PREMIUM,
             p.EMPLOYER_INSURANCE,
             p.EMPLOYEE_INSURANCE,
             p.PAYMENT_STATUS,
             p.PAYMENT_DATE,
             p.PAYMENT_METHOD,
             p.PAY_PERIOD,
             p.NOTES
      FROM ${table} p
      JOIN STAFF s ON s.STAFF_ID = p.STAFF_ID
      JOIN USERS u ON u.USER_ID = p.USER_ID
      WHERE (
        TO_CHAR(s.STAFF_ID) = :id
        OR TO_CHAR(u.USER_ID) = :id
        OR UPPER(TRIM(s.STAFF_NUMBER)) = UPPER(TRIM(:id))
        OR UPPER(TRIM(u.FULL_NAME)) = UPPER(TRIM(:id))
      )
      AND p.PAY_PERIOD LIKE :period
      FETCH FIRST 1 ROWS ONLY
    `;

    const result = await c.execute(
      sql,
      { id: String(identifier || "").trim(), period: periodPrefix },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    if (result.rows && result.rows.length > 0) {
      return result.rows[0];
    }

    // Fallback: If not found for that exact period, get latest record for that staff
    const fallbackSql = `
      SELECT p.PAYROLL_ID,
             p.STAFF_ID,
             p.USER_ID,
             NVL(s.STAFF_NUMBER, 'STF-' || LPAD(p.STAFF_ID, 4, '0')) AS STAFF_NUMBER,
             u.FULL_NAME,
             u.EMAIL,
             u.PHONE,
             u.ROLE,
             NVL(s.JOB_TITLE, u.ROLE) AS JOB_TITLE,
             NVL(s.DEPARTMENT, 'General Medicine') AS DEPARTMENT,
             u.PROFILE_IMAGE,
             p.BASIC_SALARY,
             p.HOUSING_ALLOWANCE,
             p.TRANSPORT_ALLOWANCE,
             p.OTHER_ALLOWANCES,
             p.GROSS_SALARY,
             p.TAX_DEDUCTION,
             p.SSNIT_DEDUCTION,
             p.OTHER_DEDUCTIONS,
             p.NET_SALARY,
             p.MAX_LOAN,
             p.INSURANCE_TIER,
             p.INSURANCE_PREMIUM,
             p.EMPLOYER_INSURANCE,
             p.EMPLOYEE_INSURANCE,
             p.PAYMENT_STATUS,
             p.PAYMENT_DATE,
             p.PAYMENT_METHOD,
             p.PAY_PERIOD,
             p.NOTES
      FROM ${table} p
      JOIN STAFF s ON s.STAFF_ID = p.STAFF_ID
      JOIN USERS u ON u.USER_ID = p.USER_ID
      WHERE (
        TO_CHAR(s.STAFF_ID) = :id
        OR TO_CHAR(u.USER_ID) = :id
        OR UPPER(TRIM(s.STAFF_NUMBER)) = UPPER(TRIM(:id))
        OR UPPER(TRIM(u.FULL_NAME)) = UPPER(TRIM(:id))
      )
      ORDER BY p.PAY_PERIOD DESC
      FETCH FIRST 1 ROWS ONLY
    `;

    const fallbackRes = await c.execute(
      fallbackSql,
      { id: String(identifier || "").trim() },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    return (fallbackRes.rows && fallbackRes.rows[0]) || null;
  });
}

async function getReports(type = "summary", dateStr) {
  return withConnection(async (c) => {
    const period = parsePeriod(dateStr);
    const periodPrefix = period.slice(0, 7) + "%";

    if (type === "summary") {
      const res = await c.execute(
        `SELECT 
           COUNT(*) AS TOTAL_STAFF,
           NVL(SUM(BASIC_SALARY), 0) AS TOTAL_BASIC,
           NVL(SUM(HOUSING_ALLOWANCE + TRANSPORT_ALLOWANCE + OTHER_ALLOWANCES), 0) AS TOTAL_ALLOWANCES,
           NVL(SUM(GROSS_SALARY), 0) AS TOTAL_GROSS,
           NVL(SUM(TAX_DEDUCTION), 0) AS TOTAL_TAX,
           NVL(SUM(SSNIT_DEDUCTION), 0) AS TOTAL_SSNIT,
           NVL(SUM(NET_SALARY), 0) AS TOTAL_NET,
           NVL(AVG(NET_SALARY), 0) AS AVG_NET
         FROM ${table}
         WHERE PAY_PERIOD LIKE :period`,
        { period: periodPrefix },
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const r = res.rows?.[0] || {};
      return {
        type: "summary",
        period: period.slice(0, 7),
        date: period,
        totalStaff: Number(r.TOTAL_STAFF || 0),
        totalBasic: Number(r.TOTAL_BASIC || 0),
        totalAllowances: Number(r.TOTAL_ALLOWANCES || 0),
        totalGross: Number(r.TOTAL_GROSS || 0),
        totalTax: Number(r.TOTAL_TAX || 0),
        totalSsnit: Number(r.TOTAL_SSNIT || 0),
        totalNet: Number(r.TOTAL_NET || 0),
        avgNet: Number(r.AVG_NET || 0),
      };
    }

    if (type === "department") {
      const res = await c.execute(
        `SELECT 
           NVL(s.DEPARTMENT, 'General Medicine') AS DEPARTMENT,
           COUNT(*) AS STAFF_COUNT,
           NVL(SUM(p.BASIC_SALARY), 0) AS TOTAL_BASIC,
           NVL(SUM(p.GROSS_SALARY), 0) AS TOTAL_GROSS,
           NVL(SUM(p.TAX_DEDUCTION), 0) AS TOTAL_TAX,
           NVL(SUM(p.SSNIT_DEDUCTION), 0) AS TOTAL_SSNIT,
           NVL(SUM(p.NET_SALARY), 0) AS TOTAL_NET
         FROM ${table} p
         JOIN STAFF s ON s.STAFF_ID = p.STAFF_ID
         WHERE p.PAY_PERIOD LIKE :period
         GROUP BY s.DEPARTMENT
         ORDER BY TOTAL_NET DESC`,
        { period: periodPrefix },
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      return {
        type: "department",
        period: period.slice(0, 7),
        date: period,
        rows: res.rows || [],
      };
    }

    if (type === "insurance") {
      const res = await c.execute(
        `SELECT 
           p.INSURANCE_TIER,
           COUNT(*) AS ENROLLED_COUNT,
           NVL(SUM(p.EMPLOYER_INSURANCE), 0) AS TOTAL_EMPLOYER_COST,
           NVL(SUM(p.EMPLOYEE_INSURANCE), 0) AS TOTAL_EMPLOYEE_COST,
           NVL(SUM(p.INSURANCE_PREMIUM), 0) AS TOTAL_PREMIUM
         FROM ${table} p
         WHERE p.PAY_PERIOD LIKE :period
         GROUP BY p.INSURANCE_TIER
         ORDER BY TOTAL_PREMIUM DESC`,
        { period: periodPrefix },
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      return {
        type: "insurance",
        period: period.slice(0, 7),
        date: period,
        rows: res.rows || [],
      };
    }

    // Detailed report
    const res = await c.execute(
      `SELECT 
         p.PAYROLL_ID,
         NVL(s.STAFF_NUMBER, 'STF-' || LPAD(p.STAFF_ID, 4, '0')) AS STAFF_NUMBER,
         u.FULL_NAME,
         NVL(s.DEPARTMENT, 'General Medicine') AS DEPARTMENT,
         NVL(s.JOB_TITLE, u.ROLE) AS JOB_TITLE,
         p.BASIC_SALARY,
         p.HOUSING_ALLOWANCE,
         p.TRANSPORT_ALLOWANCE,
         p.GROSS_SALARY,
         p.TAX_DEDUCTION,
         p.SSNIT_DEDUCTION,
         p.NET_SALARY,
         p.PAYMENT_STATUS,
         p.PAYMENT_DATE
       FROM ${table} p
       JOIN STAFF s ON s.STAFF_ID = p.STAFF_ID
       JOIN USERS u ON u.USER_ID = p.USER_ID
       WHERE p.PAY_PERIOD LIKE :period
       ORDER BY u.FULL_NAME ASC`,
      { period: periodPrefix },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return {
      type: "detailed",
      period: period.slice(0, 7),
      date: period,
      rows: res.rows || [],
    };
  });
}

async function updateStatus(payrollId, status) {
  return withConnection(async (c) => {
    return c.execute(
      `UPDATE ${table}
       SET PAYMENT_STATUS = :status,
           PAYMENT_DATE = CASE WHEN :status = 'Paid' THEN SYSDATE ELSE PAYMENT_DATE END
       WHERE PAYROLL_ID = :id`,
      { status, id: Number(payrollId) },
      { autoCommit: true },
    );
  });
}

module.exports = {
  list,
  getKpis,
  getPayslip,
  getReports,
  updateStatus,
};
