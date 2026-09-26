const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login-student', authController.loginStudent);
router.post('/login-staff', authController.loginStaff);
router.post('/login-admin', authController.loginAdmin);

module.exports = router;
