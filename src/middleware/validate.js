const { validate } = require('../utils/validators');
const { ApiError } = require('./errorHandler');

/**
 * Usage: router.post('/register', validateBody({
 *   email: { required: true, type: 'string', email: true },
 *   password: { required: true, type: 'string', minLength: 8 },
 * }), asyncHandler(register))
 */
function validateBody(schema) {
  return function validateBodyMiddleware(req, res, next) {
    const errors = validate(req.body, schema);
    if (errors.length > 0) {
      return next(new ApiError(400, errors.join(' ')));
    }
    next();
  };
}

module.exports = { validateBody };
