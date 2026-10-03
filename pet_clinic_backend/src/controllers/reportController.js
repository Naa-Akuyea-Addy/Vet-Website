const model = require("../models/reportModel");

const Groq = require("groq-sdk");

async function summary(req, res) {
  try {
    const data = await model.summary();
    const charts = await model.chartData();
    res.json({ success: true, data: data, charts: charts });
  } catch (error) {
    console.error("Report generation error:", error);
    res.status(500).json({ success: false, error: "Failed to generate report summary" });
  }
}

const { groqChat } = require("../utils/groqHelper");

async function insight(req, res) {
  try {
    const data = await model.summary();
    
    const prompt = `You are an AI veterinary clinic analyst. Here is the current clinic summary:
    - Appointments: ${data.totalAppointments}
    - Active Patients: ${data.activePatients}
    - Total Revenue: GHS ${data.totalRevenue}
    - Low Stock Items: ${data.lowStockValue}
    - Mortuary Occupancy: ${data.mortuaryValue}
    
    Give a single short (2-3 sentences max) "Key Insight" or recommendation for the clinic manager based on this data. Do not use formatting like bold or bullet points, just plain text.`;
    
    const insightText = await groqChat(prompt);
    res.json({ success: true, insight: insightText || "No insight could be generated." });
  } catch (error) {
    console.error("Groq AI Error:", error);
    res.status(500).json({ success: false, error: "Failed to generate AI insight" });
  }
}

async function postInsights(req, res) {
  try {
    const { stats, transactions } = req.body;
    
    const prompt = `You are an AI veterinary clinic analyst. Here is the current clinic summary:
    - Appointments: ${stats.totalAppointments}
    - Active Patients: ${stats.activePatients}
    - Total Revenue: GHS ${stats.totalRevenue}
    - Low Stock Items: ${stats.lowStockValue}
    - Mortuary Occupancy: ${stats.mortuaryValue}
    
    Recent Transactions:
    ${JSON.stringify(transactions)}
    
    Give a single short (2-3 sentences max) "Key Insight" or recommendation for the clinic manager based on this data. Do not use formatting like bold or bullet points, just plain text.`;
    
    const insightText = await groqChat(prompt);
    res.json({ insight: insightText || "No insight could be generated." });
  } catch (error) {
    console.error("Groq AI Error:", error);
    res.status(500).json({ error: "Failed to generate AI insight" });
  }
}

module.exports = { summary, insight, postInsights };
