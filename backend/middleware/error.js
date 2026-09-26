const { ZodError } = require('zod');
exports.notFound = (req, res) => res.status(404).json({ message: 'Route not found.' });
exports.errorHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) return res.status(400).json({ message: err.issues[0].message, field: err.issues[0].path[0] });
  if (err.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' });
  console.error(err);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
};
