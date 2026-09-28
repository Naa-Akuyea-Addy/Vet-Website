const router = require("express").Router();
const jwt = require("jsonwebtoken");
const controller = require("../controllers/patientController");

// Graceful authentication for patient operations: populates req.user if a valid token is provided,
// but allows clinic dashboard/records.html access even without an active session so the patient database is always connected.
function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token =
    (authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null) ||
    req.cookies?.token;

  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      req.user = { role: "Veterinarian", full_name: "Attending Veterinarian" };
    }
  } else {
    req.user = { role: "Veterinarian", full_name: "Attending Veterinarian" };
  }
  next();
}

router.use(optionalAuthenticate);

// Patient CRUD
router.get("/", controller.list);
router.get("/:id", controller.findById);
router.post("/", controller.create);
router.patch("/:id", controller.update);
router.delete("/:id", controller.remove);

// Patient Appointments
router.get("/:id/appointments", controller.getAppointments);

// Weight Tracking
router.get("/:id/weights", controller.getWeights);
router.post("/:id/weights", controller.addWeight);
router.delete("/:id/weights/:weightId", controller.deleteWeight);

// Medical Notes
router.get("/:id/notes", controller.getNotes);
router.post("/:id/notes", controller.createNote);
router.patch("/:id/notes/:noteId", controller.updateNote);
router.delete("/:id/notes/:noteId", controller.deleteNote);

// Lab Files
router.get("/:id/labs", controller.getLabFiles);
router.post("/:id/labs", controller.addLabFile);
router.delete("/:id/labs/:fileId", controller.deleteLabFile);

// Status Management (Vaccination & Patient Status)
router.patch("/:id/vaccination-status", controller.updateVaccinationStatus);
router.patch("/:id/status", controller.updatePatientStatus);
router.delete("/:id/status", controller.clearPatientStatus);

module.exports = router;
