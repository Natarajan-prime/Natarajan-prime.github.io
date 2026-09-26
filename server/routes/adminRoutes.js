const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.post('/student', adminController.addStudent);
router.put('/student/:id', adminController.updateStudent);
router.delete('/student/:id', adminController.deleteStudent);

router.post('/staff', adminController.addStaff);
router.put('/staff/:id', adminController.updateStaff);
router.delete('/staff/:id', adminController.deleteStaff);

router.get('/students', adminController.getStudents);
router.get('/staff', adminController.getStaff);
router.get('/requests', adminController.getAllRequests);
router.delete('/request/:id', adminController.deleteRequest);

module.exports = router;
