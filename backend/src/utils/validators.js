import { body, param, query, validationResult } from 'express-validator';

export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
}

export const loginRules = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

export const registerRules = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().isLength({ min: 1, max: 100 }).escape().withMessage('Name is required'),
];

export const createUserRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().isLength({ min: 1, max: 100 }).escape().withMessage('Name is required'),
  body('role').optional().isIn(['admin', 'user']).withMessage('Role must be admin or user'),
  body('max_containers').optional().isInt({ min: 0, max: 100 }).withMessage('Max containers must be 0-100'),
];

export const updateUserRules = [
  param('id').isInt().withMessage('Valid user ID required'),
  body('email').optional().isEmail().normalizeEmail(),
  body('name').optional().trim().isLength({ min: 1, max: 100 }).escape(),
  body('role').optional().isIn(['admin', 'user']),
  body('max_containers').optional().isInt({ min: 0, max: 100 }),
  body('company_name').optional().trim().isLength({ max: 100 }).escape(),
  body('theme_color').optional().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Invalid hex color'),
  body('is_active').optional().isBoolean(),
];

export const createContainerRules = [
  body('display_name').trim().isLength({ min: 1, max: 50 }).escape().withMessage('Display name required'),
  body('user_id').isInt({ min: 1 }).withMessage('Valid user ID required'),
  body('image').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Valid image name required'),
  body('cpu_limit').optional().isInt({ min: 1, max: 16 }).withMessage('CPU limit must be 1-16'),
  body('ram_limit').optional().isInt({ min: 128, max: 32768 }).withMessage('RAM limit must be 128-32768 MB'),
  body('disk_limit').optional().isInt({ min: 1, max: 500 }).withMessage('Disk limit must be 1-500 GB'),
];

export const containerIdRule = [
  param('id').isInt().withMessage('Valid container ID required'),
];

export const changePasswordRules = [
  param('id').isInt().withMessage('Valid container ID required'),
  body('password').isLength({ min: 4 }).withMessage('Password must be at least 4 characters'),
];

export const reinstallRules = [
  param('id').isInt().withMessage('Valid container ID required'),
  body('image').trim().isLength({ min: 1, max: 100 }).withMessage('Valid image required'),
];

export const renameRules = [
  param('id').isInt().withMessage('Valid container ID required'),
  body('display_name').trim().isLength({ min: 1, max: 50 }).escape().withMessage('Display name required'),
];

export const backupScheduleRules = [
  param('id').isInt().withMessage('Valid container ID required'),
  body('cron_expression').optional().trim().isLength({ min: 5, max: 50 }).withMessage('Valid cron expression required'),
  body('max_keep').optional().isInt({ min: 1, max: 20 }).withMessage('Max keep must be 1-20'),
  body('is_active').optional().isBoolean(),
];

export function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[^a-zA-Z0-9\s\-_.@]/g, '').trim();
}

export function sanitizeContainerName(name) {
  return name.toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
}
