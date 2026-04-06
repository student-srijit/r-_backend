import { HTTP_STATUS } from '../utils/constants.js';

export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  const status =
    err.status || err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { error: err }),
  });
};

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
