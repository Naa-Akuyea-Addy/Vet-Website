function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    const error = new Error("A valid numeric id is required");
    error.status = 400;
    throw error;
  }
  return id;
}

function pickFields(body, allowed) {
  return Object.fromEntries(
    Object.entries(body || {}).filter(
      ([key, value]) => allowed.includes(key) && value !== undefined,
    ),
  );
}

module.exports = { parseId, pickFields };
