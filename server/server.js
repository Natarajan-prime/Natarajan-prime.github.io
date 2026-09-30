const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./routes/authRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend UI files from the newproject root folder
app.use(express.static(path.join(__dirname, '..')));

// API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/admin', adminRoutes);

// Root route serves index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🎓 Annapoorana Engineering College - Leave System`);
    console.log(`🚀 Server running on: http://localhost:${PORT}`);
    console.log(`====================================================`);
});
// Render deploy trigger: 2026-10-01-v4-admin-manage-delete
