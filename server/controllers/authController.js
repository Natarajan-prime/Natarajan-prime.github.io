const db = require('../config/db');

// 1. STUDENT LOGIN
exports.loginStudent = async (req, res) => {
    try {
        const { regNo, password } = req.body;

        if (!regNo || !password) {
            return res.status(400).json({ success: false, message: 'Please enter your register number and password.' });
        }

        const [rows] = await db.query(
            `SELECT id, COALESCE(identifier, roll_number) as regNo, name, email, department, 
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
                email: student.email || '',
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
            `SELECT id, COALESCE(identifier, email, roll_number) as staffId, name, email, role as designation, 
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
                email: staff.email || '',
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

// 4. SELF REGISTER STUDENT
exports.registerStudent = async (req, res) => {
    try {
        const {
            regNo,
            name,
            email,
            password,
            department,
            year,
            batch,
            isHosteller,
            floor,
            room,
            parentContact,
            studentPhone
        } = req.body;

        if (!regNo || !name || !email || !password || !batch) {
            return res.status(400).json({ 
                success: false, 
                message: 'Register number, full name, Gmail address, password, and batch are required.' 
            });
        }

        const cleanRegNo = regNo.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanName = name.trim();
        const cleanPassword = password.trim();

        // Check if student with this regNo or email already exists
        const [existing] = await db.query(
            `SELECT id FROM users WHERE (identifier = ? OR roll_number = ? OR email = ?)`,
            [cleanRegNo, cleanRegNo, cleanEmail]
        );

        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'An account with this Register Number or Email already exists. Please log in or use Forgot Password.' 
            });
        }

        const isHostelBool = Boolean(isHosteller);

        await db.query(
            `INSERT INTO users (identifier, roll_number, email, name, password, role, department, batch, year, is_hosteller, hostel_block, room_no, room_number, parent_contact, parent_phone, student_phone)
             VALUES (?, ?, ?, ?, ?, 'student', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                cleanRegNo,
                cleanRegNo,
                cleanEmail,
                cleanName,
                cleanPassword,
                department ? department.trim() : 'Information Technology',
                batch ? batch.trim() : '2022-2026',
                year ? year.trim() : '1st Year',
                isHostelBool,
                isHostelBool && floor ? floor.trim() : null,
                isHostelBool && room ? room.trim() : null,
                isHostelBool && room ? room.trim() : null,
                parentContact ? parentContact.trim() : null,
                parentContact ? parentContact.trim() : null,
                studentPhone ? studentPhone.trim() : null
            ]
        );

        return res.status(201).json({ 
            success: true, 
            message: 'Student account registered successfully! You can now log in.' 
        });
    } catch (error) {
        console.error('Student registration error:', error);
        return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// 5. SELF REGISTER STAFF (Class Incharge, HOD, Warden)
exports.registerStaff = async (req, res) => {
    try {
        const {
            staffId,
            name,
            email,
            password,
            designation,
            department,
            batch
        } = req.body;

        if (!staffId || !name || !email || !password || !designation) {
            return res.status(400).json({ 
                success: false, 
                message: 'Staff ID, full name, Gmail address, role, and password are required.' 
            });
        }

        const cleanStaffId = staffId.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanName = name.trim();
        const cleanPassword = password.trim();
        const cleanDesignation = designation.trim();

        // Check if staff already exists
        const [existing] = await db.query(
            `SELECT id FROM users WHERE (identifier = ? OR email = ?)`,
            [cleanStaffId, cleanEmail]
        );

        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'A staff account with this Staff ID or Email already exists. Please log in or use Forgot Password.' 
            });
        }

        await db.query(
            `INSERT INTO users (identifier, email, name, password, role, department, batch, year)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                cleanStaffId,
                cleanEmail,
                cleanName,
                cleanPassword,
                cleanDesignation,
                cleanDesignation === 'warden' ? 'Hostel' : (department ? department.trim() : 'Information Technology'),
                cleanDesignation === 'incharge' && batch ? batch.trim() : null,
                cleanDesignation === 'incharge' && batch ? batch.trim() : null
            ]
        );

        return res.status(201).json({ 
            success: true, 
            message: 'Staff account registered successfully! You can now log in.' 
        });
    } catch (error) {
        console.error('Staff registration error:', error);
        return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// 6. FORGOT / RESET PASSWORD
// Validates Register No (Student) or Staff ID (Staff) along with Registered Gmail
exports.forgotPassword = async (req, res) => {
    try {
        const { role, identifier, email, newPassword } = req.body;

        if (!role || !identifier || !email || !newPassword) {
            return res.status(400).json({ 
                success: false, 
                message: 'Role, Register No / Staff ID, registered Gmail address, and new password are required.' 
            });
        }

        const cleanRole = role.trim();
        const cleanId = identifier.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanNewPassword = newPassword.trim();

        if (cleanNewPassword.length < 4) {
            return res.status(400).json({ 
                success: false, 
                message: 'New password must be at least 4 characters long.' 
            });
        }

        let query = '';
        let params = [];

        if (cleanRole === 'student') {
            query = `SELECT id, name FROM users 
                     WHERE role = 'student' 
                       AND (identifier = ? OR roll_number = ?) 
                       AND LOWER(email) = ?`;
            params = [cleanId, cleanId, cleanEmail];
        } else if (cleanRole === 'staff') {
            query = `SELECT id, name FROM users 
                     WHERE role IN ('incharge', 'advisor', 'hod', 'warden') 
                       AND (identifier = ? OR roll_number = ?) 
                       AND LOWER(email) = ?`;
            params = [cleanId, cleanId, cleanEmail];
        } else {
            return res.status(400).json({ success: false, message: 'Invalid role selected.' });
        }

        const [rows] = await db.query(query, params);

        if (rows.length === 0) {
            const idLabel = cleanRole === 'student' ? 'Register Number' : 'Staff ID';
            return res.status(400).json({ 
                success: false, 
                message: `Verification failed: The entered ${idLabel} and registered Gmail do not match our database records.` 
            });
        }

        const user = rows[0];

        // Update password in users table
        await db.query(
            `UPDATE users SET password = ? WHERE id = ?`,
            [cleanNewPassword, user.id]
        );

        return res.json({ 
            success: true, 
            message: `Password reset successfully for ${user.name}! You can now log in with your new password.` 
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};
