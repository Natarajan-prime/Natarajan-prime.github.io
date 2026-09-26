const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');

router.post('/submit', leaveController.submitLeaveRequest);
router.get('/student/:regNo', leaveController.getRequestsForStudent);
router.get('/stage', leaveController.getRequestsForStage);
router.get('/history', leaveController.getRequestHistoryForStage);
router.post('/action', leaveController.actOnRequest);
router.delete('/request/:id', leaveController.deleteRequestForStaff);

module.exports = router;
