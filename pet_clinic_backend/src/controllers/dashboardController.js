const dashboardModel = require("../models/dashboardModel");

async function getStats(req, res, next) {
  try {
    const data = await dashboardModel.getDashboardData();
    res.json({ success: true, data });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    next(error);
  }
}

module.exports = { getStats };
