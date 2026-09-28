const model = require("../models/emergencyModel");

async function list(req, res, next) {
  try {
    const rows = await model.list();
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const data = await model.getById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: "Emergency case not found" });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const id = await model.create(req.body);
    res.status(201).json({ success: true, message: "Emergency case created", id });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    await model.update(req.params.id, req.body);
    res.json({ success: true, message: "Emergency case updated" });
  } catch (error) {
    next(error);
  }
}

async function updateConsent(req, res, next) {
  try {
    const { type, isApproved, cpr_approved, estimate_signed, deposit_paid } = req.body;
    if (type !== undefined) {
      await model.updateConsent(req.params.id, type, isApproved);
    } else {
      if (cpr_approved !== undefined) await model.updateConsent(req.params.id, "cpr", cpr_approved);
      if (estimate_signed !== undefined) await model.updateConsent(req.params.id, "estimate", estimate_signed);
      if (deposit_paid !== undefined) await model.updateConsent(req.params.id, "deposit", deposit_paid);
    }
    res.json({ success: true, message: "Consent updated" });
  } catch (error) {
    next(error);
  }
}

async function addFlowsheet(req, res, next) {
  try {
    const fid = await model.addFlowsheetEntry(req.params.id, req.body);
    res.status(201).json({ success: true, message: "Flowsheet entry added", flowsheetId: fid });
  } catch (error) {
    next(error);
  }
}

async function listCages(req, res, next) {
  try {
    const rows = await model.listCages();
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function getFlowsheet(req, res, next) {
  try {
    const rows = await model.getFlowsheet(req.params.id);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function updateFlowsheet(req, res, next) {
  try {
    await model.updateFlowsheet(req.params.flowsheetId, req.body);
    res.json({ success: true, message: "Flowsheet updated" });
  } catch (error) {
    next(error);
  }
}

async function getStatOrders(req, res, next) {
  try {
    const rows = await model.getStatOrders(req.params.id);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function createStatOrder(req, res, next) {
  try {
    const orderId = await model.createStatOrder(req.params.id, req.body);
    res.status(201).json({ success: true, message: "Stat order created", orderId });
  } catch (error) {
    next(error);
  }
}

async function completeStatOrder(req, res, next) {
  try {
    await model.completeStatOrder(req.params.orderId);
    res.json({ success: true, message: "Stat order completed" });
  } catch (error) {
    next(error);
  }
}

async function discharge(req, res, next) {
  try {
    await model.discharge(req.params.id);
    res.json({ success: true, message: "Patient discharged and cage cleared" });
  } catch (error) {
    next(error);
  }
}

async function getKpis(req, res, next) {
  try {
    const kpis = await model.getKpis();
    res.json({ success: true, data: kpis });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  updateConsent,
  listCages,
  getFlowsheet,
  addFlowsheet,
  updateFlowsheet,
  getStatOrders,
  createStatOrder,
  completeStatOrder,
  discharge,
  getKpis,
};
