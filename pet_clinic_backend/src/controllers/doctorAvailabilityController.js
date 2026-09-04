const model = require("../models/doctorAvailabilityModel");

const isVeterinarian = (staff) => {
  const role = String(staff.JOB_TITLE || "").toLowerCase();
  const department = String(staff.DEPARTMENT || "").toLowerCase();
  return role.includes("vet") || role.includes("surgeon") || department.includes("clinical") || department.includes("veterinary");
};

async function list(req, res, next) {
  try {
    const staff = await model.list();
    res.json({ success: true, data: staff.filter(isVeterinarian) });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const { availabilityStatus, startTime, endTime, leaveReason } = req.body;
    if (!["Available", "Unavailable", "On Leave"].includes(availabilityStatus)) {
      return res.status(400).json({ success: false, message: "Invalid availability status" });
    }
    await model.upsert(Number(req.params.staffId), { availabilityStatus, startTime, endTime, leaveReason });
    res.json({ success: true, message: "Doctor availability updated" });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, update };
