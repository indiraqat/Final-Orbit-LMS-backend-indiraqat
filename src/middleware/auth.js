const { verifyToken } = require('../utils/jwt');
const { ApiError } = require('./errorHandler');
const prisma = require('../config/db');

/**
 * Requires a valid "Authorization: Bearer <token>" header.
 * On success, attaches the authenticated user to req.user (without the
 * password hash) so downstream handlers/middleware can use it.
 *
 * Usage: router.get('/me', requireAuth, asyncHandler(getMe))
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Missing or malformed Authorization header.'));
  }

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user) return next(new ApiError(401, 'User for this token no longer exists.'));

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    next();
  } catch (err) {
    next(err); // JWT errors (expired/malformed) are mapped to 401 in errorHandler
  }
}

/**
 * Like requireAuth, but never rejects the request. If a valid Bearer token
 * is present, req.user is populated exactly as requireAuth would populate
 * it. If the header is missing, or the token is invalid/expired/belongs to
 * a deleted user, the request simply continues as an anonymous visitor
 * (req.user stays unset). Genuine failures (e.g. the database is down)
 * are still passed on to the error handler.
 *
 * Use on public routes whose response depends on who is asking — e.g. quiz
 * answers are only included for admins.
 *
 * Usage: router.get('/:id', optionalAuth, asyncHandler(getModule))
 */
function optionalAuth(req, res, next) {
  requireAuth(req, res, (err) => {
    if (!err) return next();

    const isAuthFailure =
      (err instanceof ApiError && err.statusCode === 401) ||
      err.name === 'JsonWebTokenError' ||
      err.name === 'TokenExpiredError' ||
      err.name === 'NotBeforeError';

    if (isAuthFailure) return next();
    next(err);
  });
}

/**
 * Restricts a route to one or more roles. Must run after requireAuth
 * has populated req.user.
 *
 * Usage: router.delete('/:id', requireAuth, requireRole('ADMIN'), asyncHandler(deleteCourse))
 */
function requireRole(...roles) {
  return function roleMiddleware(req, res, next) {
    if (!req.user) return next(new ApiError(401, 'Authentication required.'));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `This action requires one of these roles: ${roles.join(', ')}.`));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, optionalAuth };