/**
 * Must run AFTER `protect`. Ensures the authenticated account is an admin.
 * - 401 was already handled by `protect` if there's no valid token at all.
 * - 403 here means: valid token, but the account is not an admin.
 */
const adminOnly = (req, res, next) => {
  if (req.userType !== 'admin' || !req.admin) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden — admin access required',
    });
  }
  next();
};

/**
 * Restricts to superadmin role only (e.g. for managing other admins, if ever added).
 */
const superAdminOnly = (req, res, next) => {
  if (req.userType !== 'admin' || !req.admin || req.admin.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden — superadmin access required',
    });
  }
  next();
};

module.exports = { adminOnly, superAdminOnly };
