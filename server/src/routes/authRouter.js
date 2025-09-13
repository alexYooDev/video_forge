const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth, authenticate } = require('../middleware/auth');

const router = express.Router();

// Basic auth routes
router.post('/login', authController.login.bind(authController));
router.post('/register', authController.register.bind(authController));

// MFA routes
router.post('/mfa/login', authController.loginMFA.bind(authController));
router.post('/mfa/complete', authController.completeMFA.bind(authController));
router.post('/mfa/setup', authenticate, authController.setupMFA.bind(authController));
router.post('/mfa/verify', authenticate, authController.verifyMFA.bind(authController));
router.delete('/mfa/disable', authenticate, authController.disableMFA.bind(authController));

// Admin routes
router.get('/users', requireAuth('admin'), authController.getUsers.bind(authController));
router.delete('/users/:userId', requireAuth('admin'), authController.deleteUser.bind(authController));
router.patch('/users/:userId/role', requireAuth('admin'), authController.updateUserRole.bind(authController));

// Group management routes
router.post('/groups/admin', requireAuth('admin'), authController.addToAdminGroup.bind(authController));
router.get('/users/:email/permissions', requireAuth('admin'), authController.getUserPermissions.bind(authController));
router.post('/register-with-group', authController.registerWithGroup.bind(authController));

module.exports = router;