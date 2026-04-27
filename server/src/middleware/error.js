const notFound = (req, res, next) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
};

const errorHandler = (err, req, res, next) => {
  console.error('[error]', err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Internal server error',
    errors: err.errors || undefined,
  });
};

module.exports = { notFound, errorHandler };
