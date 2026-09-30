function sendError(res, status, { message, field, code }) {
  const error = { message };
  if (field) error.field = field;
  if (code) error.code = code;
  res.status(status).json({ error });
}

module.exports = { sendError };
