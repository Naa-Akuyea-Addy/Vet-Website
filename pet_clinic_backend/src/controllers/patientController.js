const model = require("../models/patientModel");

async function list(req, res, next) {
  try {
    const rows = await model.list();
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function findById(req, res, next) {
  try {
    const row = await model.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "Patient not found" });
    res.json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    await model.create(req.body);
    res.status(201).json({ success: true, message: "Patient record created" });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    await model.update(req.params.id, req.body);
    res.json({ success: true, message: "Patient record updated" });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    await model.remove(req.params.id);
    res.json({ success: true, message: "Patient record deleted" });
  } catch (error) {
    next(error);
  }
}

async function getAppointments(req, res, next) {
  try {
    const rows = await model.getAppointments(req.params.id);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// WEIGHT TRACKING
// ==========================================
async function getWeights(req, res, next) {
  try {
    const rows = await model.getWeights(req.params.id);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function addWeight(req, res, next) {
  try {
    const { weight_kg } = req.body;
    if (weight_kg === undefined || weight_kg === null || isNaN(Number(weight_kg))) {
      return res.status(400).json({ success: false, message: "Valid weight_kg is required" });
    }
    const weightId = await model.addWeight(req.params.id, req.body);
    res.status(201).json({ success: true, message: "Weight recorded successfully", weightId });
  } catch (error) {
    next(error);
  }
}

async function deleteWeight(req, res, next) {
  try {
    await model.deleteWeight(req.params.id, req.params.weightId);
    res.json({ success: true, message: "Weight entry deleted" });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// MEDICAL NOTES
// ==========================================
async function getNotes(req, res, next) {
  try {
    const rows = await model.getNotes(req.params.id);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function createNote(req, res, next) {
  try {
    const text = req.body.note_text || req.body.text;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Note text is required" });
    }
    const doctorName = req.user?.full_name || req.body.doctor_name || "Veterinarian";
    const noteId = await model.createNote(req.params.id, {
      ...req.body,
      doctor_name: doctorName,
    });
    res.status(201).json({ success: true, message: "Medical note saved", noteId });
  } catch (error) {
    next(error);
  }
}

async function updateNote(req, res, next) {
  try {
    await model.updateNote(req.params.id, req.params.noteId, req.body);
    res.json({ success: true, message: "Medical note updated" });
  } catch (error) {
    next(error);
  }
}

async function deleteNote(req, res, next) {
  try {
    await model.deleteNote(req.params.id, req.params.noteId);
    res.json({ success: true, message: "Medical note deleted" });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// STATUS (VACCINATION & PATIENT STATUS)
// ==========================================
async function updateVaccinationStatus(req, res, next) {
  try {
    const status = req.body.status || req.body.vaccination_status;
    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }
    await model.updateVaccinationStatus(req.params.id, status);
    res.json({ success: true, message: "Vaccination status updated", status });
  } catch (error) {
    next(error);
  }
}

async function updatePatientStatus(req, res, next) {
  try {
    const status = req.body.status || req.body.patient_status;
    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }
    await model.updatePatientStatus(req.params.id, status);
    res.json({ success: true, message: "Patient status updated", status });
  } catch (error) {
    next(error);
  }
}

async function clearPatientStatus(req, res, next) {
  try {
    await model.clearPatientStatus(req.params.id);
    res.json({ success: true, message: "Patient status reverted to Active" });
  } catch (error) {
    next(error);
  }
}

async function getLabFiles(req, res, next) {
  try {
    const files = await model.getLabFiles(req.params.id);
    res.json({ success: true, data: files });
  } catch (error) {
    next(error);
  }
}

async function addLabFile(req, res, next) {
  try {
    const fileId = await model.addLabFile(req.params.id, req.body);
    res.status(201).json({ success: true, fileId });
  } catch (error) {
    next(error);
  }
}

async function deleteLabFile(req, res, next) {
  try {
    await model.deleteLabFile(req.params.id, req.params.fileId);
    res.json({ success: true, message: "File deleted" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  findById,
  create,
  update,
  remove,
  getAppointments,
  getWeights,
  addWeight,
  deleteWeight,
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  getLabFiles,
  addLabFile,
  deleteLabFile,
  updateVaccinationStatus,
  updatePatientStatus,
  clearPatientStatus,
};
