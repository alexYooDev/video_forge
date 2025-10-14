const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Basic auth routes
router.post('/login', authController.login.bind(authController));
router.post('/register', authController.register.bind(authController));

// Email OTP MFA routes
router.post('/mfa/complete', authController.completeMFA.bind(authController));

// Admin routes
router.get('/users', requireAuth('admin'), authController.getUsers.bind(authController));
router.delete('/users/:userId', requireAuth('admin'), authController.deleteUser.bind(authController));
router.patch('/users/:userId/role', requireAuth('admin'), authController.updateUserRole.bind(authController));

// Email confirmation routes
router.post('/confirm-email', authController.confirmEmail.bind(authController));
router.post('/resend-confirmation', authController.resendConfirmation.bind(authController));

// Group management routes
router.post('/groups/admin', requireAuth('admin'), authController.addToAdminGroup.bind(authController));
router.get('/users/:email/permissions', requireAuth('admin'), authController.getUserPermissions.bind(authController));
router.post('/register-with-group', authController.registerWithGroup.bind(authController));

// OAuth/Federated authentication routes
router.get('/oauth/url', authController.getOAuthUrl.bind(authController));
router.post('/oauth/callback', authController.handleOAuthCallback.bind(authController));

module.exports = router;