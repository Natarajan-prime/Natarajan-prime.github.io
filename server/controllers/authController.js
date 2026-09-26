const db = require('../config/db');

// 1. STUDENT LOGIN
exports.loginStudent = async (req, res) => {
    try {
        const { regNo, password } = req.body;

        if (!regNo || !password) {
            return res.status(400).json({ success: false, message: 'Please enter your register number and password.' });
        }

        const [rows] = await db.query(
            `SELECT id, COALESCE(identifier, roll_number) as regNo, name, department, 
                    COALESCE(year, '1st Year') as year,
                    COALESCE(batch, year) as batch, is_hosteller, 
                    COALESCE(room_no, room_number) as room, 
                    COALESCE(parent_contact, parent_phone) as parentContact,
                    student_phone as studentPhone
             FROM users 
             WHERE role = 'student' 
               AND (identifier = ? OR roll_number = ? OR email = ?) 
               AND password = ?`,
            [regNo.trim(), regNo.trim(), regNo.trim(), password.trim()]
        );

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Register number or password is incorrect.' });
        }

        const student = rows[0];
        return res.json({
            success: true,
            user: {
                id: student.id,
                regNo: student.regNo,
                name: student.name,
                department: student.department,
                year: student.year,
                batch: student.batch,
                is_hosteller: Boolean(student.is_hosteller),
                room: student.room,
                parentContact: student.parentContact,
                studentPhone: student.studentPhone || '',
                role: 'student'
            }
        });
    } catch (error) {
        console.error('Student login error:', error);
        return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// 2. STAFF LOGIN (Incharge/Advisor, HOD, Warden)
exports.loginStaff = async (req, res) => {
    try {
        const { staffId, password, designation } = req.body;

        if (!staffId || !password || !designation) {
            return res.status(400).json({ success: false, message: 'Please enter staff ID, password, and select your role.' });
        }

        const isAdvisorOrIncharge = (designation === 'incharge' || designation === 'advisor');
        const roleCondition = isAdvisorOrIncharge 
            ? "role IN ('incharge', 'advisor')" 
            : "role = ?";

        const params = isAdvisorOrIncharge
            ? [staffId.trim(), staffId.trim(), staffId.trim(), password.trim()]
            : [designation.trim(), staffId.trim(), staffId.trim(), staffId.trim(), password.trim()];

        const [rows] = await db.query(
            `SELECT id, COALESCE(identifier, email, roll_number) as staffId, name, role as designation, 
                    department, COALESCE(batch, year) as batch 
             FROM users 
             WHERE ${roleCondition} 
               AND (identifier = ? OR email = ? OR roll_number = ?) 
               AND password = ?`,
            params
        );

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Staff ID, password or selected role is incorrect.' });
        }

        const staff = rows[0];
        // Standardize designation for incharge/advisor
        const normalizedDesignation = (staff.designation === 'advisor' || staff.designation === 'incharge') 
            ? 'incharge' 
            : staff.designation;

        return res.json({
            success: true,
            user: {
                id: staff.id,
                staffId: staff.staffId,
                name: staff.name,
                designation: normalizedDesignation,
                department: staff.department,
                batch: staff.batch, // Assigned batch for Incharge
                role: 'staff'
            }
        });
    } catch (error) {
        console.error('Staff login error:', error);
        return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// 3. ADMIN LOGIN
exports.loginAdmin = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Please enter admin username and password.' });
        }

        const [rows] = await db.query(
            `SELECT id, COALESCE(identifier, email) as username, name 
             FROM users 
             WHERE role = 'admin' 
               AND (identifier = ? OR email = ? OR identifier = 'admin') 
               AND password = ?`,
            [username.trim(), username.trim(), password.trim()]
        );

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Admin username or password is incorrect.' });
        }

        const admin = rows[0];
        return res.json({
            success: true,
            user: {
                id: admin.id,
                username: admin.username,
                name: admin.name,
                role: 'admin'
            }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};
