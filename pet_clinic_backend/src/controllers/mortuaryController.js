const mortuaryModel = require("../models/mortuaryModel");

class MortuaryController {
  async getAllMortuaryRecords(req, res) {
    try {
      const records = await mortuaryModel.getAllMortuaryRecords();
      
      // Map database snake_case names back to frontend camelCase expectations
      const mappedRecords = records.map(r => ({
        id: r.MORTUARY_NUMBER,
        db_id: r.RECORD_ID,
        patient: r.PATIENT_NAME,
        owner: r.OWNER_NAME,
        species: r.SPECIES,
        breed: r.BREED,
        age: r.AGE,
        date: r.ENTRY_DATE,
        cause: r.CAUSE_OF_DEATH,
        disposition: r.DISPOSITION,
        status: r.STATUS,
        storage: r.STORAGE_LOCATION,
        pickupDate: r.PICKUP_DATE,
        notes: r.NOTES || ""
      }));
      
      res.status(200).json(mappedRecords);
    } catch (error) {
      console.error("Error fetching mortuary records:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  async createMortuaryRecord(req, res) {
    try {
      const data = {
        patient_name: req.body.patient,
        owner_name: req.body.owner,
        species: req.body.species,
        breed: req.body.breed,
        age: String(req.body.age),
        entry_date: req.body.date,
        cause_of_death: req.body.cause,
        disposition: req.body.disposition,
        status: req.body.status,
        storage_location: req.body.storage,
        pickup_date: req.body.pickupDate,
        notes: req.body.notes
      };

      const result = await mortuaryModel.createMortuaryRecord(data);
      res.status(201).json({ message: "Mortuary record created successfully", id: result.record_id });
    } catch (error) {
      console.error("Error creating mortuary record:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  async updateMortuaryRecord(req, res) {
    try {
      const recordId = req.params.id; // This is the DB RECORD_ID
      const data = {
        patient_name: req.body.patient,
        owner_name: req.body.owner,
        species: req.body.species,
        breed: req.body.breed,
        age: String(req.body.age),
        entry_date: req.body.date,
        cause_of_death: req.body.cause,
        disposition: req.body.disposition,
        status: req.body.status,
        storage_location: req.body.storage,
        pickup_date: req.body.pickupDate,
        notes: req.body.notes
      };

      const success = await mortuaryModel.updateMortuaryRecord(recordId, data);
      if (success) {
        res.status(200).json({ message: "Mortuary record updated successfully" });
      } else {
        res.status(404).json({ message: "Record not found" });
      }
    } catch (error) {
      console.error("Error updating mortuary record:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  async deleteMortuaryRecord(req, res) {
    try {
      const recordId = req.params.id;
      const success = await mortuaryModel.deleteMortuaryRecord(recordId);
      if (success) {
        res.status(200).json({ message: "Mortuary record deleted successfully" });
      } else {
        res.status(404).json({ message: "Record not found" });
      }
    } catch (error) {
      console.error("Error deleting mortuary record:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}

module.exports = new MortuaryController();
