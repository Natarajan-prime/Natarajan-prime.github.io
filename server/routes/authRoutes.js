const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login-student', authController.loginStudent);
router.post('/login-staff', authController.loginStaff);
router.post('/login-admin', authController.loginAdmin);
router.post('/register-student', authController.registerStudent);
router.post('/register-staff', authController.registerStaff);
router.post('/forgot-password', authController.forgotPassword);

module.exports = router;
