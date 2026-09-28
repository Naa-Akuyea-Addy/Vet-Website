const model = require("../models/payrollModel");

function mapPayrollRow(r) {
  if (!r) return null;
  const name = r.FULL_NAME || "Staff Member";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const colors = ["blue", "purple", "green", "pink", "indigo", "amber", "cyan"];
  const color = colors[(Number(r.STAFF_ID) || 0) % colors.length];

  return {
    recordId: r.PAYROLL_ID,
    id: r.STAFF_NUMBER || `STF-${String(r.STAFF_ID).padStart(4, '0')}`,
    staffId: r.STAFF_ID,
    userId: r.USER_ID,
    name,
    initials,
    color,
    dept: r.DEPARTMENT || "General Medicine",
    jobTitle: r.JOB_TITLE || r.ROLE,
    role: r.ROLE,
    email: r.EMAIL,
    phone: r.PHONE,
    profileImage: r.PROFILE_IMAGE,
    basicSalary: Number(r.BASIC_SALARY || 0),
    housingAllowance: Number(r.HOUSING_ALLOWANCE || 0),
    transportAllowance: Number(r.TRANSPORT_ALLOWANCE || 0),
    otherAllowances: Number(r.OTHER_ALLOWANCES || 0),
    grossSalary: Number(r.GROSS_SALARY || 0),
    taxDeduction: Number(r.TAX_DEDUCTION || 0),
    socialSecurity: Number(r.SSNIT_DEDUCTION || 0),
    otherDeductions: Number(r.OTHER_DEDUCTIONS || 0),
    totalDeductions: Number((Number(r.TAX_DEDUCTION) || 0) + (Number(r.SSNIT_DEDUCTION) || 0) + (Number(r.OTHER_DEDUCTIONS) || 0)),
    netSalary: Number(r.NET_SALARY || 0),
    maxLoan: Number(r.MAX_LOAN || 0),
    insurance: r.INSURANCE_TIER || "Silver Cover",
    insurancePremium: Number(r.INSURANCE_PREMIUM || 0),
    employerInsurance: Number(r.EMPLOYER_INSURANCE || 0),
    employeeInsurance: Number(r.EMPLOYEE_INSURANCE || 0),
    status: r.PAYMENT_STATUS || "Paid",
    paymentDate: r.PAYMENT_DATE,
    paymentMethod: r.PAYMENT_METHOD || "Bank Transfer",
    payPeriod: r.PAY_PERIOD,
    notes: r.NOTES || "",
    actions: ["view", "edit", "print", "reminder", "mark_paid"],
  };
}

async function list(req, res, next) {
  try {
    const filters = {
      department: req.query.department || req.query.dept || null,
      search: req.query.search || req.query.q || null,
      period: req.query.period || req.query.month || null,
      status: req.query.status || null,
    };
    const rows = await model.list(filters);
    const mapped = rows.map(mapPayrollRow);
    res.json({ success: true, data: mapped, count: mapped.length });
  } catch (error) {
    next(error);
  }
}

async function kpis(req, res, next) {
  try {
    const period = req.query.period || req.query.month || null;
    const stats = await model.getKpis(period);
    res.json({
      success: true,
      data: {
        totalPayroll: stats.totalPayroll,
        totalBasic: stats.totalBasic,
        totalGross: stats.totalGross,
        totalTax: stats.totalTax,
        totalSsnit: stats.totalSsnit,
        totalLoan: stats.totalLoanCapacity,
        monthlyPremium: stats.totalInsurancePremium,
        staffCount: stats.totalStaff,
        staffCovered: stats.staffCovered,
        percentChange: stats.payrollChange,
        period: stats.payPeriod,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function payslip(req, res, next) {
  try {
    const staffId = req.query.staffId || req.query.id || req.params.staffId;
    const period = req.query.period || req.query.month || null;
    if (!staffId) {
      return res.status(400).json({ success: false, message: "Staff ID is required" });
    }
    const data = await model.getPayslip(staffId, period);
    if (!data) {
      return res.status(404).json({ success: false, message: "Payslip not found" });
    }
    res.json({ success: true, data: mapPayrollRow(data) });
  } catch (error) {
    next(error);
  }
}

async function reports(req, res, next) {
  try {
    const type = req.query.type || "summary";
    const date = req.query.date || req.query.period || null;
    const rep = await model.getReports(type, date);

    let sections = [];
    if (type === "summary") {
      sections.push({
        title: "Executive Summary",
        headers: ["Metric", "Amount (GHS)"],
        rows: [
          ["Total Staff", rep.totalStaff],
          ["Gross Payroll", rep.totalGross.toFixed(2)],
          ["Total Allowances", rep.totalAllowances.toFixed(2)],
          ["Tax Deductions", rep.totalTax.toFixed(2)],
          ["SSNIT Deductions", rep.totalSsnit.toFixed(2)],
          ["Net Payroll", rep.totalNet.toFixed(2)],
          ["Average Net Salary", rep.avgNet.toFixed(2)],
        ],
      });
    } else if (type === "department") {
      sections.push({
        title: "Department Breakdown",
        headers: ["Department", "Staff Count", "Gross Payroll (GHS)", "Net Payroll (GHS)"],
        rows: (rep.rows || []).map((r) => [
          r.DEPARTMENT,
          r.STAFF_COUNT,
          Number(r.TOTAL_GROSS || 0).toFixed(2),
          Number(r.TOTAL_NET || 0).toFixed(2),
        ]),
      });
    } else if (type === "insurance") {
      sections.push({
        title: "Insurance Coverage",
        headers: ["Insurance Tier", "Enrolled", "Employer Cost (GHS)", "Employee Cost (GHS)", "Total Premium (GHS)"],
        rows: (rep.rows || []).map((r) => [
          r.INSURANCE_TIER || "Silver Cover",
          r.ENROLLED_COUNT,
          Number(r.TOTAL_EMPLOYER_COST || 0).toFixed(2),
          Number(r.TOTAL_EMPLOYEE_COST || 0).toFixed(2),
          Number(r.TOTAL_PREMIUM || 0).toFixed(2),
        ]),
      });
    } else {
      sections.push({
        title: "Detailed Staff Payroll",
        headers: ["Staff ID", "Name", "Department", "Basic (GHS)", "Gross (GHS)", "Tax (GHS)", "SSNIT (GHS)", "Net (GHS)", "Status"],
        rows: (rep.rows || []).map((r) => [
          r.STAFF_NUMBER,
          r.FULL_NAME,
          r.DEPARTMENT,
          Number(r.BASIC_SALARY || 0).toFixed(2),
          Number(r.GROSS_SALARY || 0).toFixed(2),
          Number(r.TAX_DEDUCTION || 0).toFixed(2),
          Number(r.SSNIT_DEDUCTION || 0).toFixed(2),
          Number(r.NET_SALARY || 0).toFixed(2),
          r.PAYMENT_STATUS,
        ]),
      });
    }

    res.json({
      success: true,
      data: {
        title: `Payroll Report - ${rep.period || "2026-09"} (${type.toUpperCase()})`,
        period: rep.period,
        date: rep.date,
        type,
        sections,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }
    await model.updateStatus(id, status);
    res.json({ success: true, message: `Status updated to ${status}` });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  kpis,
  payslip,
  reports,
  updateStatus,
};
