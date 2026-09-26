const db = require('../config/db');

// Helper to format requests
function formatApprovals(row) {
    const approvals = [];
    if (row.incharge_decision) {
        approvals.push({ stage: 'incharge', by: row.incharge_name || 'Class Incharge', decision: row.incharge_decision, remarks: row.incharge_remarks || '', date: row.incharge_date });
    }
    if (row.hod_decision) {
        approvals.push({ stage: 'hod', by: row.hod_name || 'HOD', decision: row.hod_decision, remarks: row.hod_remarks || '', date: row.hod_date });
    }
    if (row.warden_decision) {
        approvals.push({ stage: 'warden', by: row.warden_name || 'Warden', decision: row.warden_decision, remarks: row.warden_remarks || '', date: row.warden_date });
    }
    return approvals;
}

// 1. Add Student (with Batch & Year support)
exports.addStudent = async (req, res) => {
    try {
        const { regNo, name, password, batch, year, department, floor, room, parentContact, studentPhone, isHosteller } = req.body;

        if (!regNo || !name || !password || !batch) {
            return res.status(400).json({ success: false, message: 'Register number, name, password, and batch are required.' });
        }

        const [existing] = await db.query(`SELECT id FROM users WHERE identifier = ? OR roll_number = ?`, [regNo.trim(), regNo.trim()]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'A student with this register number already exists.' });
        }

        const studentEmail = (req.body.email && req.body.email.trim()) 
            ? req.body.email.trim() 
            : `${regNo.trim().toLowerCase()}@college.edu`;

        await db.query(
            `INSERT INTO users (identifier, roll_number, email, name, password, role, department, batch, year, is_hosteller, hostel_block, room_no, room_number, parent_contact, parent_phone, student_phone)
             VALUES (?, ?, ?, ?, ?, 'student', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                regNo.trim(),
                regNo.trim(),
                studentEmail,
                name.trim(),
                password.trim(),
                department ? department.trim() : 'IT',
                batch.trim(),
                year ? year.trim() : '1st Year',
                isHosteller !== undefined ? Boolean(isHosteller) : false,
                isHosteller && floor ? floor.trim() : null,
                isHosteller && room ? room.trim() : null,
                isHosteller && room ? room.trim() : null,
                parentContact ? parentContact.trim() : null,
                parentContact ? parentContact.trim() : null,
                studentPhone ? studentPhone.trim() : null
            ]
        );

        return res.status(201).json({ success: true, message: 'Student account created successfully.' });
    } catch (error) {
        console.error('Admin add student error:', error);
        return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// 2. Add Staff (with Batch for Incharge, Department for HOD/Incharge)
exports.addStaff = async (req, res) => {
    try {
        const { staffId, name, password, designation, department, batch } = req.body;

        if (!staffId || !name || !password || !designation) {
            return res.status(400).json({ success: false, message: 'Staff ID, name, password, and role are required.' });
        }

        const [existing] = await db.query(`SELECT id FROM users WHERE identifier = ? OR email = ?`, [staffId.trim(), staffId.trim()]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'A staff account with this ID already exists.' });
        }

        const staffEmail = staffId.includes('@') 
            ? staffId.trim() 
            : `${staffId.trim().toLowerCase()}@college.edu`;

        await db.query(
            `INSERT INTO users (identifier, email, name, password, role, department, batch, year)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                staffId.trim(),
                staffEmail,
                name.trim(),
                password.trim(),
                designation.trim(),
                department ? department.trim() : 'IT',
                designation === 'incharge' && batch ? batch.trim() : null,
                designation === 'incharge' && batch ? batch.trim() : null
            ]
        );

        return res.status(201).json({ success: true, message: 'Staff account created successfully.' });
    } catch (error) {
        console.error('Admin add staff error:', error);
        return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// 3. Get All Students
exports.getStudents = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, COALESCE(identifier, roll_number) as regNo, name, department, 
                    COALESCE(year, '1st Year') as year,
                    COALESCE(batch, year) as batch, is_hosteller, 
                    hostel_block as floor,
                    COALESCE(room_no, room_number) as room, 
                    COALESCE(parent_contact, parent_phone) as parentContact,
                    student_phone as studentPhone
             FROM users WHERE role = 'student' ORDER BY created_at DESC`
        );
        return res.json({ success: true, students: rows });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 4. Get All Staff
exports.getStaff = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, COALESCE(identifier, email) as staffId, name, 
                    CASE WHEN role = 'advisor' THEN 'incharge' ELSE role END as designation, 
                    department, COALESCE(batch, year) as batch 
             FROM users WHERE role IN ('incharge', 'advisor', 'hod', 'warden') ORDER BY created_at DESC`
        );
        return res.json({ success: true, staff: rows });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 5. Get All Requests (for Admin overview)
exports.getAllRequests = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM leave_requests WHERE COALESCE(deleted_by_admin, 0) = 0 ORDER BY COALESCE(applied_on, created_at) DESC`
        );
        const requests = rows.map(row => ({
            id: row.req_code,
            regNo: row.reg_no,
            studentName: row.student_name,
            department: row.department,
            year: row.year || '1st Year',
            batch: row.batch,
            room: row.room_no,
            is_hosteller: Boolean(row.is_hosteller),
            parentContact: row.parent_contact,
            studentPhone: row.student_phone || '',
            leaveType: row.leave_type,
            fromDate: row.from_date ? new Date(row.from_date).toISOString().split('T')[0] : '',
            toDate: row.to_date ? new Date(row.to_date).toISOString().split('T')[0] : '',
            reason: row.reason,
            addressOnLeave: row.address_on_leave,
            appliedOn: row.applied_on ? new Date(row.applied_on).toISOString() : new Date().toISOString(),
            status: row.status,
            currentStage: row.current_stage,
            approvals: formatApprovals(row)
        }));
        return res.json({ success: true, requests });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 6. Delete Student
exports.deleteStudent = async (req, res) => {
    try {
        const { id } = req.params;
        // Mark related leave requests as deleted_by_admin so historical records remain safe for HOD & Advisor
        await db.query(`UPDATE leave_requests SET deleted_by_admin = 1 WHERE student_id = ? OR reg_no = (SELECT identifier FROM users WHERE id = ?)`, [id, id]);
        const [result] = await db.query(`DELETE FROM users WHERE id = ? AND role = 'student'`, [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }
        return res.json({ success: true, message: 'Student deleted successfully (leave records preserved for staff/HOD).' });
    } catch (error) {
        console.error('Delete student error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 7. Update Student
exports.updateStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, department, year, batch, isHosteller, floor, room, parentContact, studentPhone, password } = req.body;

        if (!name || !batch) {
            return res.status(400).json({ success: false, message: 'Student name and batch are required.' });
        }

        const isHostelBool = Boolean(isHosteller);
        let query = `UPDATE users SET name = ?, department = ?, year = ?, batch = ?, is_hosteller = ?, hostel_block = ?, room_no = ?, room_number = ?, parent_contact = ?, parent_phone = ?, student_phone = ?`;
        const params = [
            name.trim(),
            department ? department.trim() : 'IT',
            year ? year.trim() : '1st Year',
            batch.trim(),
            isHostelBool,
            isHostelBool && floor ? floor.trim() : null,
            isHostelBool && room ? room.trim() : null,
            isHostelBool && room ? room.trim() : null,
            parentContact ? parentContact.trim() : null,
            parentContact ? parentContact.trim() : null,
            studentPhone ? studentPhone.trim() : null
        ];

        if (password && password.trim()) {
            query += `, password = ?`;
            params.push(password.trim());
        }

        query += ` WHERE id = ? AND role = 'student'`;
        params.push(id);

        const [result] = await db.query(query, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }

        // Also update leave_requests student_name, department, batch, etc. for existing requests of this student
        await db.query(
            `UPDATE leave_requests 
             SET student_name = ?, department = ?, batch = ?, year = ?, is_hosteller = ?, room_no = ?, parent_contact = ?, student_phone = ? 
             WHERE student_id = ?`,
            [
                name.trim(),
                department ? department.trim() : 'IT',
                batch.trim(),
                year ? year.trim() : '1st Year',
                isHostelBool,
                isHostelBool && room ? room.trim() : null,
                parentContact ? parentContact.trim() : null,
                studentPhone ? studentPhone.trim() : null,
                id
            ]
        );

        return res.json({ success: true, message: 'Student updated successfully.' });
    } catch (error) {
        console.error('Update student error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 8. Delete Staff
exports.deleteStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query(`DELETE FROM users WHERE id = ? AND role IN ('incharge', 'advisor', 'hod', 'warden')`, [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Staff member not found.' });
        }
        return res.json({ success: true, message: 'Staff member deleted successfully.' });
    } catch (error) {
        console.error('Delete staff error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 9. Update Staff
exports.updateStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, department, designation, batch, password } = req.body;

        if (!name || !designation) {
            return res.status(400).json({ success: false, message: 'Name and designation are required.' });
        }

        let query = `UPDATE users SET name = ?, department = ?, role = ?, batch = ?, year = ?`;
        const params = [
            name.trim(),
            department ? department.trim() : 'IT',
            designation.trim(),
            designation === 'incharge' && batch ? batch.trim() : null,
            designation === 'incharge' && batch ? batch.trim() : null
        ];

        if (password && password.trim()) {
            query += `, password = ?`;
            params.push(password.trim());
        }

        query += ` WHERE id = ? AND role IN ('incharge', 'advisor', 'hod', 'warden')`;
        params.push(id);

        const [result] = await db.query(query, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Staff member not found.' });
        }

        return res.json({ success: true, message: 'Staff member updated successfully.' });
    } catch (error) {
        console.error('Update staff error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 10. Delete Leave Request (Only removes from Admin view; strictly preserves in HOD & Advisor profiles)
exports.deleteRequest = async (req, res) => {
    try {
        const { id } = req.params;
        let query = `UPDATE leave_requests SET deleted_by_admin = 1 WHERE req_code = ?`;
        let params = [id];
        if (!isNaN(id) && Number.isInteger(Number(id))) {
            query = `UPDATE leave_requests SET deleted_by_admin = 1 WHERE id = ? OR req_code = ?`;
            params = [Number(id), id];
        }
        const [result] = await db.query(query, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Leave request not found.' });
        }
        return res.json({ success: true, message: 'Leave request removed from Admin view (safely preserved in HOD and Advisor profiles).' });
    } catch (error) {
        console.error('Delete request error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

