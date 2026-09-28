const oracledb = require("oracledb");
try {
  oracledb.fetchAsString = [oracledb.CLOB];
} catch (e) {}
const { withConnection } = require("../config/database");

/**
 * List all active/recent emergency cases
 */
async function list() {
  return withConnection(async (c) => {
    const result = await c.execute(
      `SELECT e.EMERGENCY_ID, e.PATIENT_ID, p.PET_NAME AS PATIENT_NAME, p.PET_SPECIES AS SPECIES,
              p.PET_BREED AS BREED, p.PET_AGE AS AGE,
              (SELECT w.WEIGHT_KG FROM PATIENT_WEIGHTS w WHERE w.PATIENT_ID = p.PATIENT_ID ORDER BY w.RECORDED_DATE DESC, w.WEIGHT_ID DESC FETCH FIRST 1 ROWS ONLY) AS WEIGHT,
              p.OWNER_NAME, p.OWNER_PHONE,
              e.DESCRIPTION AS CHIEF_COMPLAINT, e.PRIORITY, e.STATUS, e.SOURCE, e.AI_REASONING,
              (SELECT LISTAGG(t.TAG, ',') WITHIN GROUP (ORDER BY t.TAG) FROM EMERGENCY_CASE_TAGS t WHERE t.EMERGENCY_ID = e.EMERGENCY_ID) AS TAGS,
              c.CAGE_ID, e.ASSIGNED_STAFF_ID, u.FULL_NAME AS ASSIGNED_VET_NAME,
              (SELECT IS_APPROVED FROM EMERGENCY_CASE_CONSENTS x WHERE x.EMERGENCY_ID = e.EMERGENCY_ID AND x.CONSENT_TYPE = 'CPR') AS CPR_APPROVED,
              (SELECT IS_APPROVED FROM EMERGENCY_CASE_CONSENTS x WHERE x.EMERGENCY_ID = e.EMERGENCY_ID AND x.CONSENT_TYPE = 'ESTIMATE') AS ESTIMATE_SIGNED,
              (SELECT IS_APPROVED FROM EMERGENCY_CASE_CONSENTS x WHERE x.EMERGENCY_ID = e.EMERGENCY_ID AND x.CONSENT_TYPE = 'DEPOSIT') AS DEPOSIT_PAID,
              e.ARRIVAL_TIME, e.CREATED_AT, e.RESOLVED_AT
       FROM EMERGENCY_CASES e JOIN PATIENTS p ON p.PATIENT_ID = e.PATIENT_ID
       LEFT JOIN EMERGENCY_CAGES c ON c.EMERGENCY_ID = e.EMERGENCY_ID
       LEFT JOIN STAFF s ON s.STAFF_ID = e.ASSIGNED_STAFF_ID LEFT JOIN USERS u ON u.USER_ID = s.USER_ID
       WHERE e.STATUS != 'Discharged' OR e.ARRIVAL_TIME >= SYSTIMESTAMP - INTERVAL '1' DAY
       ORDER BY 
         CASE WHEN UPPER(PRIORITY) = 'CRITICAL' THEN 1
              WHEN UPPER(PRIORITY) = 'URGENT' THEN 2
              ELSE 3 END,
         e.ARRIVAL_TIME DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return result.rows || [];
  });
}

/**
 * Get single case with flowsheet and stat orders
 */
async function getById(id) {
  return withConnection(async (c) => {
    const caseRes = await c.execute(
      `SELECT e.EMERGENCY_ID, e.PATIENT_ID, p.PET_NAME AS PATIENT_NAME, p.PET_SPECIES AS SPECIES,
              p.PET_BREED AS BREED, p.PET_AGE AS AGE,
              (SELECT w.WEIGHT_KG FROM PATIENT_WEIGHTS w WHERE w.PATIENT_ID = p.PATIENT_ID ORDER BY w.RECORDED_DATE DESC, w.WEIGHT_ID DESC FETCH FIRST 1 ROWS ONLY) AS WEIGHT,
              p.OWNER_NAME, p.OWNER_PHONE,
              e.DESCRIPTION AS CHIEF_COMPLAINT, e.PRIORITY, e.STATUS, e.SOURCE, e.AI_REASONING,
              (SELECT LISTAGG(t.TAG, ',') WITHIN GROUP (ORDER BY t.TAG) FROM EMERGENCY_CASE_TAGS t WHERE t.EMERGENCY_ID = e.EMERGENCY_ID) AS TAGS,
              c.CAGE_ID, e.ASSIGNED_STAFF_ID, u.FULL_NAME AS ASSIGNED_VET_NAME,
              (SELECT IS_APPROVED FROM EMERGENCY_CASE_CONSENTS x WHERE x.EMERGENCY_ID = e.EMERGENCY_ID AND x.CONSENT_TYPE = 'CPR') AS CPR_APPROVED,
              (SELECT IS_APPROVED FROM EMERGENCY_CASE_CONSENTS x WHERE x.EMERGENCY_ID = e.EMERGENCY_ID AND x.CONSENT_TYPE = 'ESTIMATE') AS ESTIMATE_SIGNED,
              (SELECT IS_APPROVED FROM EMERGENCY_CASE_CONSENTS x WHERE x.EMERGENCY_ID = e.EMERGENCY_ID AND x.CONSENT_TYPE = 'DEPOSIT') AS DEPOSIT_PAID,
              e.ARRIVAL_TIME, e.CREATED_AT, e.RESOLVED_AT
       FROM EMERGENCY_CASES e JOIN PATIENTS p ON p.PATIENT_ID = e.PATIENT_ID
       LEFT JOIN EMERGENCY_CAGES c ON c.EMERGENCY_ID = e.EMERGENCY_ID
       LEFT JOIN STAFF s ON s.STAFF_ID = e.ASSIGNED_STAFF_ID LEFT JOIN USERS u ON u.USER_ID = s.USER_ID
       WHERE e.EMERGENCY_ID = :id`,
      { id: Number(id) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const emergency = caseRes.rows?.[0];
    if (!emergency) return null;

    const flowsheetRes = await c.execute(
      `SELECT FLOWSHEET_ID, EMERGENCY_ID, TIME_LABEL, VITALS_CHECKED, FLUIDS_CHECKED, MEDS_CHECKED, NOTES, RECORDED_AT
       FROM EMERGENCY_FLOWSHEET
       WHERE EMERGENCY_ID = :id
       ORDER BY FLOWSHEET_ID ASC`,
      { id: Number(id) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const ordersRes = await c.execute(
      `SELECT ORDER_ID, EMERGENCY_ID, ORDER_TYPE, DESCRIPTION, ORDER_TIME, IS_DONE, COMPLETED_AT, CREATED_AT
       FROM EMERGENCY_STAT_ORDERS
       WHERE EMERGENCY_ID = :id
       ORDER BY ORDER_ID DESC`,
      { id: Number(id) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    emergency.FLOWSHEET = flowsheetRes.rows || [];
    emergency.STAT_ORDERS = ordersRes.rows || [];
    return emergency;
  });
}

/**
 * Create emergency case and seed default hourly monitoring checklist
 */
async function create(data) {
  return withConnection(async (c) => {
    const patientName = data.patient_name || data.name || (data.animal ? `Guest ${data.animal}` : "Emergency Patient");
    const ownerName = data.owner_name || data.owner || "Pet Parent";
    const ownerPhone = data.owner_phone || data.phone || "";
    const species = data.species || data.animal || "Dog";
    const breed = data.breed || "Mixed Breed";
    const age = data.age || "Adult";
    const weight = Number(data.weight) || (species.toLowerCase() === "cat" ? 4.5 : 15);
    const complaint = data.description || data.symptoms || data.complaint || "Emergency triage";
    const priority = (data.priority || data.triageLevel || "Urgent").toUpperCase();
    const source = data.source || "website";
    const aiReasoning = data.ai_reasoning || data.reasoning || "";
    const tags = Array.isArray(data.tags) ? data.tags : String(data.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
    const cageId = data.cage_id || null;
    const vetName = data.assigned_vet_name || data.vet || null;

    let patientId = data.patient_id ? Number(data.patient_id) : null;
    if (!patientId) {
      const patientRes = await c.execute(
        `SELECT PATIENT_ID FROM PATIENTS WHERE UPPER(TRIM(PET_NAME)) = UPPER(TRIM(:pet_name))
           AND UPPER(TRIM(OWNER_NAME)) = UPPER(TRIM(:owner_name)) FETCH FIRST 1 ROWS ONLY`,
        { pet_name: patientName, owner_name: ownerName }, { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      patientId = patientRes.rows?.[0]?.PATIENT_ID;
      if (!patientId) {
        let ageVal = data.pet_age_value !== undefined && data.pet_age_value !== null ? Number(data.pet_age_value) : null;
        let ageUnit = data.pet_age_unit || "years";
        let formattedAge = age || null;
        if (ageVal === null && formattedAge) {
          const match = String(formattedAge).match(/\d+/);
          if (match) ageVal = parseInt(match[0], 10);
          if (String(formattedAge).toLowerCase().includes("month")) ageUnit = "months";
          else if (String(formattedAge).toLowerCase().includes("week")) ageUnit = "weeks";
          else ageUnit = "years";
        }
        if (!formattedAge && ageVal !== null) {
          formattedAge = `${ageVal} ${ageUnit}`;
        }
        const createdPatient = await c.execute(
          `INSERT INTO PATIENTS (PET_NAME, PET_SPECIES, PET_BREED, PET_AGE, PET_AGE_VALUE, PET_AGE_UNIT, OWNER_NAME, OWNER_PHONE)
           VALUES (:pet_name, :species, :breed, :age, :age_val, :age_unit, :owner_name, :owner_phone) RETURNING PATIENT_ID INTO :out_id`,
          { pet_name: patientName, species, breed, age: formattedAge || "Adult",
            age_val: ageVal !== null ? ageVal : 3, age_unit: ageUnit,
            owner_name: ownerName, owner_phone: ownerPhone,
            out_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }, { autoCommit: false },
        );
        patientId = createdPatient.outBinds.out_id[0];
      }
    }

    const res = await c.execute(
      `INSERT INTO EMERGENCY_CASES (PATIENT_ID, DESCRIPTION, PRIORITY, STATUS, SOURCE, AI_REASONING, ARRIVAL_TIME, CREATED_AT)
       VALUES (:patient_id, :description, :priority, 'Active', :source, :ai_reasoning, SYSTIMESTAMP, SYSTIMESTAMP)
       RETURNING EMERGENCY_ID INTO :out_id`,
      { patient_id: patientId, description: complaint, priority, source, ai_reasoning: aiReasoning,
        out_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }, { autoCommit: false },
    );

    const emergencyId = res.outBinds.out_id[0];

    for (const tag of tags) {
      await c.execute(`INSERT INTO EMERGENCY_CASE_TAGS (EMERGENCY_ID, TAG) VALUES (:id, :tag)`,
        { id: emergencyId, tag }, { autoCommit: false });
    }
    for (const [type, approved] of [["CPR", data.cpr_approved !== undefined ? Number(data.cpr_approved) : 1], ["ESTIMATE", data.estimate_signed !== undefined ? Number(data.estimate_signed) : 0], ["DEPOSIT", data.deposit_paid !== undefined ? Number(data.deposit_paid) : 0]]) {
      await c.execute(`INSERT INTO EMERGENCY_CASE_CONSENTS (EMERGENCY_ID, CONSENT_TYPE, IS_APPROVED) VALUES (:id, :type, :approved)`,
        { id: emergencyId, type, approved }, { autoCommit: false });
    }

    // Seed standard 4-interval hourly flowsheet
    const defaultIntervals = ["Now", "+15m", "+30m", "+45m"];
    for (let i = 0; i < defaultIntervals.length; i++) {
      await c.execute(
        `INSERT INTO EMERGENCY_FLOWSHEET (EMERGENCY_ID, TIME_LABEL, VITALS_CHECKED, FLUIDS_CHECKED, MEDS_CHECKED, NOTES)
         VALUES (:eid, :label, :vitals, 0, 0, :notes)`,
        {
          eid: emergencyId,
          label: defaultIntervals[i],
          vitals: i === 0 ? 1 : 0,
          notes: i === 0 ? "Initial emergency triage assessment" : "",
        },
        { autoCommit: false },
      );
    }

    // Assign cage if specified
    if (cageId) {
      await c.execute(
        `UPDATE EMERGENCY_CAGES 
         SET STATUS = 'occupied', EMERGENCY_ID = :eid, UPDATED_AT = SYSTIMESTAMP 
         WHERE CAGE_ID = :cid`,
        { eid: emergencyId, cid: cageId },
        { autoCommit: false },
      );
    }

    await c.commit();
    return emergencyId;
  });
}

/**
 * Update clinical details / admit case to ER
 */
async function update(id, data) {
  return withConnection(async (c) => {
    const fields = [];
    const params = { id: Number(id) };
    const patientFields = [];
    const patientParams = { id: Number(id) };

    if (data.patient_name) { patientFields.push("PET_NAME = :p_name"); patientParams.p_name = data.patient_name; }
    if (data.species) { patientFields.push("PET_SPECIES = :p_species"); patientParams.p_species = data.species; }
    if (data.breed) { patientFields.push("PET_BREED = :p_breed"); patientParams.p_breed = data.breed; }
    if (data.age || data.pet_age || data.pet_age_value !== undefined) {
      let ageVal = data.pet_age_value !== undefined && data.pet_age_value !== null ? Number(data.pet_age_value) : null;
      let ageUnit = data.pet_age_unit || "years";
      let formattedAge = data.age || data.pet_age || null;
      if (ageVal === null && formattedAge) {
        const match = String(formattedAge).match(/\d+/);
        if (match) ageVal = parseInt(match[0], 10);
        if (String(formattedAge).toLowerCase().includes("month")) ageUnit = "months";
        else if (String(formattedAge).toLowerCase().includes("week")) ageUnit = "weeks";
        else ageUnit = "years";
      }
      if (!formattedAge && ageVal !== null) {
        formattedAge = `${ageVal} ${ageUnit}`;
      }
      patientFields.push("PET_AGE = :p_age", "PET_AGE_VALUE = :p_age_val", "PET_AGE_UNIT = :p_age_unit");
      patientParams.p_age = formattedAge || "Adult";
      patientParams.p_age_val = ageVal !== null ? ageVal : 3;
      patientParams.p_age_unit = ageUnit;
    }
    if (data.weight !== undefined) {
      const parsedWeight = parseFloat(String(data.weight).replace(/[^0-9.]/g, ""));
      if (!isNaN(parsedWeight)) {
        await c.execute(
          `INSERT INTO PATIENT_WEIGHTS (PATIENT_ID, WEIGHT_KG, RECORDED_DATE, NOTES)
           VALUES ((SELECT PATIENT_ID FROM EMERGENCY_CASES WHERE EMERGENCY_ID = :id), :weight, TRUNC(SYSDATE), 'Emergency intake')`,
          { id: Number(id), weight: parsedWeight }, { autoCommit: false },
        );
      }
    }
    if (data.owner_name) { patientFields.push("OWNER_NAME = :p_owner"); patientParams.p_owner = data.owner_name; }
    if (data.owner_phone) { patientFields.push("OWNER_PHONE = :p_phone"); patientParams.p_phone = data.owner_phone; }
    if (data.description || data.complaint) {
      fields.push("DESCRIPTION = :p_desc");
      params.p_desc = data.description || data.complaint;
    }
    if (data.priority || data.triageLevel) {
      fields.push("PRIORITY = :p_priority");
      params.p_priority = (data.priority || data.triageLevel).toUpperCase();
    }
    if (data.status) { fields.push("STATUS = :p_status"); params.p_status = data.status; }
    if (data.tags !== undefined) {
      await c.execute(`DELETE FROM EMERGENCY_CASE_TAGS WHERE EMERGENCY_ID = :id`, { id: Number(id) }, { autoCommit: false });
      for (const tag of (Array.isArray(data.tags) ? data.tags : String(data.tags).split(",")).map((value) => value.trim()).filter(Boolean)) {
        await c.execute(`INSERT INTO EMERGENCY_CASE_TAGS (EMERGENCY_ID, TAG) VALUES (:id, :tag)`, { id: Number(id), tag }, { autoCommit: false });
      }
    }

    if (fields.length > 0) {
      await c.execute(
        `UPDATE EMERGENCY_CASES SET ${fields.join(", ")} WHERE EMERGENCY_ID = :id`,
        params,
        { autoCommit: false },
      );
    }
    if (patientFields.length > 0) {
      await c.execute(`UPDATE PATIENTS SET ${patientFields.join(", ")} WHERE PATIENT_ID = (SELECT PATIENT_ID FROM EMERGENCY_CASES WHERE EMERGENCY_ID = :id)`, patientParams, { autoCommit: false });
    }

    for (const [type, value] of [["CPR", data.cpr_approved], ["ESTIMATE", data.estimate_signed], ["DEPOSIT", data.deposit_paid]]) {
      if (value !== undefined) await c.execute(`MERGE INTO EMERGENCY_CASE_CONSENTS c USING (SELECT :id id, :type type, :approved approved FROM DUAL) s ON (c.EMERGENCY_ID = s.id AND c.CONSENT_TYPE = s.type) WHEN MATCHED THEN UPDATE SET c.IS_APPROVED = s.approved, c.RECORDED_AT = SYSTIMESTAMP WHEN NOT MATCHED THEN INSERT (EMERGENCY_ID, CONSENT_TYPE, IS_APPROVED) VALUES (s.id, s.type, s.approved)`, { id: Number(id), type, approved: Number(value) ? 1 : 0 }, { autoCommit: false });
    }

    // If cage was updated, handle cage table
    if (data.cage_id) {
      // Clear previous cage
      await c.execute(
        `UPDATE EMERGENCY_CAGES SET STATUS = 'empty', EMERGENCY_ID = NULL WHERE EMERGENCY_ID = :id AND CAGE_ID != :cid`,
        { id: Number(id), cid: data.cage_id },
        { autoCommit: false },
      );
      // Set new cage
      await c.execute(
        `UPDATE EMERGENCY_CAGES SET STATUS = 'occupied', EMERGENCY_ID = :id, UPDATED_AT = SYSTIMESTAMP WHERE CAGE_ID = :cid`,
        { id: Number(id), cid: data.cage_id },
        { autoCommit: false },
      );
    }

    await c.commit();
    return true;
  });
}

/**
 * Toggle consent flags
 */
async function updateConsent(id, type, isApproved) {
  return withConnection(async (c) => {
    await c.execute(
      `MERGE INTO EMERGENCY_CASE_CONSENTS c
       USING (SELECT :id emergency_id, :consent_type consent_type, :approved is_approved FROM DUAL) s
       ON (c.EMERGENCY_ID = s.emergency_id AND c.CONSENT_TYPE = s.consent_type)
       WHEN MATCHED THEN UPDATE SET c.IS_APPROVED = s.is_approved, c.RECORDED_AT = SYSTIMESTAMP
       WHEN NOT MATCHED THEN INSERT (EMERGENCY_ID, CONSENT_TYPE, IS_APPROVED) VALUES (s.emergency_id, s.consent_type, s.is_approved)`,
      { id: Number(id), consent_type: type === "estimate" ? "ESTIMATE" : type === "deposit" ? "DEPOSIT" : "CPR", approved: isApproved ? 1 : 0 },
      { autoCommit: true },
    );
    return true;
  });
}

/**
 * List all cages and their current status + occupant
 */
async function listCages() {
  return withConnection(async (c) => {
    const res = await c.execute(
      `SELECT c.CAGE_ID, c.CAGE_TYPE, c.STATUS, c.EMERGENCY_ID, c.UPDATED_AT,
              p.PET_NAME AS PATIENT_NAME, p.PET_SPECIES AS SPECIES,
              (SELECT w.WEIGHT_KG FROM PATIENT_WEIGHTS w WHERE w.PATIENT_ID = p.PATIENT_ID ORDER BY w.RECORDED_DATE DESC, w.WEIGHT_ID DESC FETCH FIRST 1 ROWS ONLY) AS WEIGHT,
              e.PRIORITY,
              (SELECT LISTAGG(t.TAG, ',') WITHIN GROUP (ORDER BY t.TAG) FROM EMERGENCY_CASE_TAGS t WHERE t.EMERGENCY_ID = e.EMERGENCY_ID) AS TAGS,
              p.OWNER_NAME, p.OWNER_PHONE
       FROM EMERGENCY_CAGES c
       LEFT JOIN EMERGENCY_CASES e ON e.EMERGENCY_ID = c.EMERGENCY_ID
       LEFT JOIN PATIENTS p ON p.PATIENT_ID = e.PATIENT_ID
       ORDER BY c.CAGE_ID ASC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return res.rows || [];
  });
}

/**
 * Flowsheet entries for a case
 */
async function getFlowsheet(emergencyId) {
  return withConnection(async (c) => {
    const res = await c.execute(
      `SELECT FLOWSHEET_ID, EMERGENCY_ID, TIME_LABEL, VITALS_CHECKED, FLUIDS_CHECKED, MEDS_CHECKED, NOTES, RECORDED_AT
       FROM EMERGENCY_FLOWSHEET
       WHERE EMERGENCY_ID = :eid
       ORDER BY FLOWSHEET_ID ASC`,
      { eid: Number(emergencyId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return res.rows || [];
  });
}

/**
 * Update or toggle flowsheet row
 */
async function updateFlowsheet(flowsheetId, data) {
  return withConnection(async (c) => {
    const fields = [];
    const params = { fid: Number(flowsheetId) };

    if (data.vitals_checked !== undefined) {
      fields.push("VITALS_CHECKED = :vitals");
      params.vitals = data.vitals_checked ? 1 : 0;
    }
    if (data.fluids_checked !== undefined) {
      fields.push("FLUIDS_CHECKED = :fluids");
      params.fluids = data.fluids_checked ? 1 : 0;
    }
    if (data.meds_checked !== undefined) {
      fields.push("MEDS_CHECKED = :meds");
      params.meds = data.meds_checked ? 1 : 0;
    }
    if (data.notes !== undefined) {
      fields.push("NOTES = :notes");
      params.notes = data.notes;
    }

    if (fields.length > 0) {
      await c.execute(
        `UPDATE EMERGENCY_FLOWSHEET SET ${fields.join(", ")} WHERE FLOWSHEET_ID = :fid`,
        params,
        { autoCommit: true },
      );
    }
    return true;
  });
}

/**
 * List Stat Orders for a case
 */
async function getStatOrders(emergencyId) {
  return withConnection(async (c) => {
    const res = await c.execute(
      `SELECT ORDER_ID, EMERGENCY_ID, ORDER_TYPE, DESCRIPTION, ORDER_TIME, IS_DONE, COMPLETED_AT, CREATED_AT
       FROM EMERGENCY_STAT_ORDERS
       WHERE EMERGENCY_ID = :eid
       ORDER BY ORDER_ID DESC`,
      { eid: Number(emergencyId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return res.rows || [];
  });
}

/**
 * Add a flowsheet entry
 */
async function addFlowsheetEntry(emergencyId, data) {
  return withConnection(async (c) => {
    const res = await c.execute(
      `INSERT INTO EMERGENCY_FLOWSHEET (EMERGENCY_ID, TIME_LABEL, VITALS_CHECKED, FLUIDS_CHECKED, MEDS_CHECKED, NOTES, RECORDED_AT)
       VALUES (:p_eid, :p_label, :p_vitals, :p_fluids, :p_meds, :p_notes, SYSTIMESTAMP)
       RETURNING FLOWSHEET_ID INTO :out_id`,
      {
        p_eid: Number(emergencyId),
        p_label: data.time_label || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        p_vitals: data.vitals_checked ? 1 : 0,
        p_fluids: data.fluids_checked ? 1 : 0,
        p_meds: data.meds_checked ? 1 : 0,
        p_notes: data.notes || "",
        out_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true },
    );
    return res.outBinds.out_id[0];
  });
}

/**
 * Add a Stat Order
 */
async function createStatOrder(emergencyId, data) {
  return withConnection(async (c) => {
    const orderTime = data.order_time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const res = await c.execute(
      `INSERT INTO EMERGENCY_STAT_ORDERS (EMERGENCY_ID, ORDER_TYPE, DESCRIPTION, ORDER_TIME, IS_DONE, CREATED_AT)
       VALUES (:p_eid, :p_type, :p_desc, :p_time, 0, SYSTIMESTAMP)
       RETURNING ORDER_ID INTO :out_id`,
      {
        p_eid: Number(emergencyId),
        p_type: data.order_type || "medication",
        p_desc: data.description || "Stat Order",
        p_time: orderTime,
        out_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true },
    );
    return res.outBinds.out_id[0];
  });
}

/**
 * Mark a Stat Order as complete
 */
async function completeStatOrder(orderId) {
  return withConnection(async (c) => {
    await c.execute(
      `UPDATE EMERGENCY_STAT_ORDERS
       SET IS_DONE = 1, COMPLETED_AT = SYSTIMESTAMP
       WHERE ORDER_ID = :id`,
      { id: Number(orderId) },
      { autoCommit: true },
    );
    return true;
  });
}

/**
 * Discharge patient: free cage, update case status
 */
async function discharge(emergencyId) {
  return withConnection(async (c) => {
    const id = Number(emergencyId);
    await c.execute(
      `UPDATE EMERGENCY_CASES 
       SET STATUS = 'Discharged', RESOLVED_AT = SYSTIMESTAMP 
       WHERE EMERGENCY_ID = :id`,
      { id },
      { autoCommit: false },
    );

    await c.execute(
      `UPDATE EMERGENCY_CAGES 
       SET STATUS = 'empty', EMERGENCY_ID = NULL, UPDATED_AT = SYSTIMESTAMP 
       WHERE EMERGENCY_ID = :id`,
      { id },
      { autoCommit: false },
    );

    await c.commit();
    return true;
  });
}

/**
 * Get live KPI metrics
 */
async function getKpis() {
  return withConnection(async (c) => {
    const countsRes = await c.execute(
      `SELECT 
         COUNT(CASE WHEN UPPER(PRIORITY) = 'CRITICAL' AND STATUS != 'Discharged' THEN 1 END) AS CRITICAL_COUNT,
         COUNT(CASE WHEN UPPER(PRIORITY) = 'URGENT' AND STATUS != 'Discharged' THEN 1 END) AS URGENT_COUNT,
         COUNT(CASE WHEN UPPER(PRIORITY) = 'STANDARD' AND STATUS != 'Discharged' THEN 1 END) AS STANDARD_COUNT,
         COUNT(CASE WHEN STATUS != 'Discharged' THEN 1 END) AS TOTAL_ACTIVE
       FROM EMERGENCY_CASES`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const bedsRes = await c.execute(
      `SELECT 
         COUNT(CASE WHEN STATUS = 'empty' THEN 1 END) AS AVAILABLE_BEDS,
         COUNT(*) AS TOTAL_BEDS
       FROM EMERGENCY_CAGES`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const doctorsRes = await c.execute(
      `SELECT COUNT(*) AS ON_DUTY_DOCS
       FROM USERS u
       JOIN STAFF s ON s.USER_ID = u.USER_ID
       WHERE LOWER(NVL(u.STATUS, 'active')) = 'active'
         AND (
           LOWER(NVL(s.JOB_TITLE, '')) LIKE '%vet%'
           OR LOWER(NVL(s.JOB_TITLE, '')) LIKE '%surgeon%'
           OR LOWER(NVL(s.JOB_TITLE, '')) LIKE '%doctor%'
           OR LOWER(NVL(s.DEPARTMENT, '')) LIKE '%emergency%'
           OR LOWER(NVL(s.DEPARTMENT, '')) LIKE '%clinical%'
         )`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    return {
      critical: countsRes.rows?.[0]?.CRITICAL_COUNT || 0,
      urgent: countsRes.rows?.[0]?.URGENT_COUNT || 0,
      standard: countsRes.rows?.[0]?.STANDARD_COUNT || 0,
      totalActive: countsRes.rows?.[0]?.TOTAL_ACTIVE || 0,
      availableBeds: bedsRes.rows?.[0]?.AVAILABLE_BEDS || 0,
      totalBeds: bedsRes.rows?.[0]?.TOTAL_BEDS || 8,
      onDutyDoctors: Math.max(doctorsRes.rows?.[0]?.ON_DUTY_DOCS || 0, 2),
    };
  });
}

module.exports = {
  list,
  getById,
  create,
  update,
  updateConsent,
  listCages,
  getFlowsheet,
  addFlowsheetEntry,
  updateFlowsheet,
  getStatOrders,
  createStatOrder,
  completeStatOrder,
  discharge,
  getKpis,
};
