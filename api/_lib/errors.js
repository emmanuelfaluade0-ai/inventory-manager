function sendError(res, status, { message, field, code, ...extra }) {
  const error = { message, ...extra };
  if (field) error.field = field;
  if (code) error.code = code;
  res.status(status).json({ error });
}

module.exports = { sendError };
