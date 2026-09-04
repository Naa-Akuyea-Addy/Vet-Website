const staffModel = require('../models/staffModel');

async function list(req, res, next) {
  try {
    const service = (req.query.service || '').toLowerCase();
    const rows = await staffModel.list();

    // Filter to veterinarians and optionally by service/department/job_title
    const vets = (rows || []).filter((s) => {
      const role = String(s.JOB_TITLE || '').toLowerCase();
      const dept = String(s.DEPARTMENT || '').toLowerCase();
      const name = String(s.FULL_NAME || '').toLowerCase();
      const matchesService = !service || name.includes(service) || dept.includes(service) || role.includes(service);
      // Consider job_title or department indicating clinical veterinarian
      const isVet = role.includes('vet') || role.includes('veterinarian') || dept.includes('clinical') || dept.includes('veterinary') || role.includes('surgeon') || role.includes('emergency');
      return isVet && matchesService;
    }).map(s => ({
      staff_id: s.STAFF_ID,
      full_name: s.FULL_NAME,
      job_title: s.JOB_TITLE,
      department: s.DEPARTMENT,
      phone: s.PHONE,
      email: s.EMAIL,
    }));

    res.json({ success: true, data: vets });
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
