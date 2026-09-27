
const db = require('../config/db');

// Helper to construct UI-compatible approvals array
function formatApprovals(row) {
    const approvals = [];
    if (row.incharge_decision) {
        approvals.push({
            stage: 'incharge',
            by: row.incharge_name || 'Class Incharge',
            decision: row.incharge_decision,
            remarks: row.incharge_remarks || '',
            date: row.incharge_date
        });
    }
    if (row.hod_decision) {
        approvals.push({
            stage: 'hod',
            by: row.hod_name || 'Head of Department',
            decision: row.hod_decision,
            remarks: row.hod_remarks || '',
            date: row.hod_date
        });
    }
    if (row.warden_decision) {
        approvals.push({
            stage: 'warden',
            by: row.warden_name || 'Hostel Warden',
            decision: row.warden_decision,
            remarks: row.warden_remarks || '',
            date: row.warden_date
        });
    }
    return approvals;
}

function safeDateStr(val) {
    if (!val) return '';
    if (typeof val === 'string') return val.split('T')[0];
    try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    } catch (e) {
        return '';
    }
}

function safeIsoStr(val) {
    if (!val) return new Date().toISOString();
    try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    } catch (e) {
        return new Date().toISOString();
    }
}

function formatRequest(row) {
    return {
        id: row.req_code || ('LR-' + row.id),
        dbId: row.id,
        regNo: row.reg_no,
        studentName: row.student_name,
        department: row.department,
        year: row.student_year || row.year || '1st Year',
        batch: row.batch,
        room: row.room_no,
        is_hosteller: Boolean(row.is_hosteller),
        parentContact: row.parent_contact,
        studentPhone: row.student_phone || '',
        leaveType: row.leave_type,
        fromDate: safeDateStr(row.from_date || row.start_date),
        toDate: safeDateStr(row.to_date || row.end_date),
        reason: row.reason,
        addressOnLeave: row.address_on_leave || row.destination || '',
        appliedOn: safeIsoStr(row.applied_on || row.created_at),
        status: row.status,
        currentStage: row.current_stage,
        totalLeavesCount: Number(row.total_leaves_count || 1),
        approvedLeavesCount: Number(row.approved_leaves_count || 0),
        approvals: formatApprovals(row)
    };
}

// 1. Submit Leave Request
exports.submitLeaveRequest = async (req, res) => {
    try {
        const { regNo, leaveType, fromDate, toDate, reason, addressOnLeave, studentPhone, parentContact } = req.body;

        if (!regNo || !leaveType || !fromDate || !toDate || !reason) {
            return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
        }

        // Fetch student details
        const [students] = await db.query(
            `SELECT id, COALESCE(identifier, roll_number) as regNo, name, department, 
                    COALESCE(year, '1st Year') as year,
                    COALESCE(batch, year) as batch, is_hosteller, 
                    COALESCE(room_no, room_number) as room_no, 
                    COALESCE(parent_contact, parent_phone) as parent_contact,
                    student_phone 
             FROM users WHERE role = 'student' AND (identifier = ? OR roll_number = ?)`,
            [regNo.trim(), regNo.trim()]
        );

        if (students.length === 0) {
            return res.status(404).json({ success: false, message: 'Student account not found.' });
        }

        const student = students[0];
        const finalStudentPhone = (studentPhone && studentPhone.trim()) ? studentPhone.trim() : (student.student_phone || null);
        const finalParentContact = (parentContact && parentContact.trim()) ? parentContact.trim() : (student.parent_contact || null);
        const reqCode = 'LR-' + Date.now();

        // If student supplied phone number, update student profile as well
        if (studentPhone && studentPhone.trim()) {
            await db.query(`UPDATE users SET student_phone = ? WHERE id = ?`, [studentPhone.trim(), student.id]);
        }

        const [result] = await db.query(
            `INSERT INTO leave_requests 
             (req_code, student_id, reg_no, student_name, department, batch, year, is_hosteller, room_no, parent_contact, student_phone, 
              leave_type, from_date, to_date, reason, address_on_leave, status, current_stage)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'incharge')`,
            [
                reqCode,
                student.id,
                student.regNo,
                student.name,
                student.department,
                student.batch,
                student.year,
                student.is_hosteller,
                student.room_no,
                finalParentContact,
                finalStudentPhone,
                leaveType,
                fromDate,
                toDate,
                reason,
                addressOnLeave || ''
            ]
        );

        return res.status(201).json({
            success: true,
            message: 'Leave request submitted successfully!',
            reqCode
        });
    } catch (error) {
        console.error('Submit leave error:', error);
        return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// 2. Get Requests for Student
exports.getRequestsForStudent = async (req, res) => {
    try {
        const { regNo } = req.params;

        const [rows] = await db.query(
            `SELECT * FROM leave_requests 
             WHERE reg_no = ? OR student_id IN (SELECT id FROM users WHERE identifier = ? OR roll_number = ? OR email = ?)
             ORDER BY id DESC`,
            [regNo.trim(), regNo.trim(), regNo.trim(), regNo.trim()]
        );

        return res.json({ success: true, requests: rows.map(formatRequest) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 3. Get Pending Requests for Staff Stage (with Batch & Dept filtering for Incharge)
exports.getRequestsForStage = async (req, res) => {
    try {
        const { designation, staffId } = req.query;

        if (!designation) {
            return res.status(400).json({ success: false, message: 'Designation is required.' });
        }

        const normalizedStage = (designation === 'advisor' || designation === 'incharge') ? 'incharge' : designation.trim();

        let query = `SELECT * FROM leave_requests WHERE (status = 'pending' OR status = 'PENDING') AND (current_stage = ? OR (current_stage = 'advisor' AND ? = 'incharge'))`;
        let params = [normalizedStage, normalizedStage];

        // If Class Incharge: filter by incharge's department and batch!
        if (normalizedStage === 'incharge' && staffId) {
            const [staffRows] = await db.query(
                `SELECT department, COALESCE(batch, year) as batch FROM users 
                 WHERE role IN ('incharge', 'advisor') AND (identifier = ? OR email = ? OR id = ?)`,
                [staffId.toString().trim(), staffId.toString().trim(), staffId.toString().trim()]
            );
            if (staffRows.length > 0) {
                const staff = staffRows[0];
                if (staff.department && staff.department.trim()) {
                    query += ` AND (LOWER(TRIM(department)) = LOWER(TRIM(?)) OR (LOWER(TRIM(department)) IN ('it', 'information technology') AND LOWER(TRIM(?)) IN ('it', 'information technology')))`;
                    params.push(staff.department.trim(), staff.department.trim());
                }
                if (staff.batch && staff.batch.trim()) {
                    query += ` AND (LOWER(TRIM(batch)) = LOWER(TRIM(?)) OR LOWER(TRIM(year)) = LOWER(TRIM(?)))`;
                    params.push(staff.batch.trim(), staff.batch.trim());
                }
            }
        }

        // If HOD: filter by HOD's department
        if (normalizedStage === 'hod' && staffId) {
            const [hodRows] = await db.query(
                `SELECT department FROM users WHERE role = 'hod' AND (identifier = ? OR email = ? OR id = ?)`,
                [staffId.toString().trim(), staffId.toString().trim(), staffId.toString().trim()]
            );
            if (hodRows.length > 0 && hodRows[0].department && hodRows[0].department.trim()) {
                query += ` AND (LOWER(TRIM(department)) = LOWER(TRIM(?)) OR (LOWER(TRIM(department)) IN ('it', 'information technology') AND LOWER(TRIM(?)) IN ('it', 'information technology')))`;
                params.push(hodRows[0].department.trim(), hodRows[0].department.trim());
            }
        }

        // If Warden: only hostellers
        if (normalizedStage === 'warden') {
            query += ` AND (is_hosteller = 1 OR is_hosteller = TRUE)`;
        }

        query += ` ORDER BY id ASC`;

        const [rows] = await db.query(query, params);
        return res.json({ success: true, requests: rows.map(formatRequest) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 4. Get History for Staff Stage (Scoped to HOD department / Incharge batch)
exports.getRequestHistoryForStage = async (req, res) => {
    try {
        const { designation, staffId } = req.query;
        const normalizedStage = (designation === 'advisor' || designation === 'incharge') ? 'incharge' : designation;

        let query = `
            SELECT lr.*, 
                   COALESCE(u.year, lr.year, '1st Year') as student_year,
                   (SELECT COUNT(*) FROM leave_requests WHERE (reg_no = lr.reg_no OR student_id = lr.student_id)) as total_leaves_count,
                   (SELECT COUNT(*) FROM leave_requests WHERE (reg_no = lr.reg_no OR student_id = lr.student_id) AND (status = 'approved' OR status = 'APPROVED')) as approved_leaves_count
            FROM leave_requests lr
            LEFT JOIN users u ON lr.student_id = u.id
            WHERE `;

        let params = [];

        if (normalizedStage === 'incharge') query += `(lr.incharge_decision IS NOT NULL OR lr.advisor_id IS NOT NULL) AND COALESCE(lr.deleted_by_incharge, 0) = 0`;
        else if (normalizedStage === 'hod') query += `(lr.hod_decision IS NOT NULL OR lr.hod_id IS NOT NULL) AND COALESCE(lr.deleted_by_hod, 0) = 0`;
        else if (normalizedStage === 'warden') query += `(lr.warden_decision IS NOT NULL OR lr.warden_id IS NOT NULL) AND COALESCE(lr.deleted_by_warden, 0) = 0`;
        else query += `lr.status != 'pending'`;

        // If staffId provided, scope history to that staff member's department/batch
        if (staffId) {
            const [staffRows] = await db.query(
                `SELECT role, department, COALESCE(batch, year) as batch FROM users 
                 WHERE (identifier = ? OR email = ? OR id = ?)`,
                [staffId.toString().trim(), staffId.toString().trim(), staffId.toString().trim()]
            );
            if (staffRows.length > 0) {
                const staff = staffRows[0];
                if (normalizedStage === 'hod' && staff.department) {
                    query += ` AND lr.department = ?`;
                    params.push(staff.department);
                } else if (normalizedStage === 'incharge') {
                    if (staff.department) {
                        query += ` AND lr.department = ?`;
                        params.push(staff.department);
                    }
                    if (staff.batch) {
                        query += ` AND (lr.batch = ? OR lr.year = ?)`;
                        params.push(staff.batch, staff.batch);
                    }
                } else if (normalizedStage === 'warden') {
                    query += ` AND (lr.is_hosteller = 1 OR lr.is_hosteller = TRUE)`;
                }
            }
        }

        query += ` ORDER BY lr.id DESC LIMIT 100`;

        const [rows] = await db.query(query, params);
        return res.json({ success: true, requests: rows.map(formatRequest) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 5. Staff Act on Request (Incharge/Advisor -> HOD -> (if hostel: Warden))
exports.actOnRequest = async (req, res) => {
    try {
        const { requestId, staffId, decision, remarks } = req.body;

        if (!requestId || !staffId || !decision) {
            return res.status(400).json({ success: false, message: 'Missing required parameters.' });
        }

        // Fetch staff profile (by identifier, email, or id)
        const [staffRows] = await db.query(
            `SELECT id, COALESCE(identifier, email) as identifier, name, 
                    CASE WHEN role = 'advisor' THEN 'incharge' ELSE role END as designation,
                    department, batch 
             FROM users WHERE identifier = ? OR email = ? OR id = ?`,
            [staffId.toString().trim(), staffId.toString().trim(), staffId.toString().trim()]
        );
        if (staffRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Staff member not found.' });
        }
        const staff = staffRows[0];

        // Fetch request safely without DOUBLE truncation error
        let reqQuery = `SELECT * FROM leave_requests WHERE req_code = ?`;
        let reqParams = [requestId.toString().trim()];
        if (!isNaN(requestId) && Number.isInteger(Number(requestId))) {
            reqQuery = `SELECT * FROM leave_requests WHERE id = ? OR req_code = ?`;
            reqParams = [Number(requestId), requestId.toString().trim()];
        }
        const [reqRows] = await db.query(reqQuery, reqParams);
        if (reqRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Leave request not found.' });
        }
        const record = reqRows[0];

        // Normalize stage check (incharge/advisor match each other)
        const curStage = (record.current_stage === 'advisor' || record.current_stage === 'incharge') ? 'incharge' : record.current_stage;
        const staffRole = (staff.designation === 'advisor' || staff.designation === 'incharge') ? 'incharge' : staff.designation;

        if (record.status !== 'pending' || curStage !== staffRole) {
            return res.status(400).json({ 
                success: false, 
                message: `This request is at stage '${record.current_stage}', but you are acting as '${staffRole}'.` 
            });
        }

        const isHosteller = Boolean(record.is_hosteller);
        let nextStatus = 'pending';
        let nextStage = curStage;

        if (decision === 'rejected') {
            nextStatus = 'rejected';
        } else if (decision === 'approved') {
            // Workflow: incharge -> hod -> (warden if hosteller, otherwise completed)
            if (staffRole === 'incharge') {
                nextStage = 'hod';
            } else if (staffRole === 'hod') {
                if (isHosteller) {
                    nextStage = 'warden';
                } else {
                    nextStatus = 'approved';
                    nextStage = 'completed';
                }
            } else if (staffRole === 'warden') {
                nextStatus = 'approved';
                nextStage = 'completed';
            }
        }

        // Update corresponding stage fields safely
        let updateQuery = `UPDATE leave_requests SET status = ?, current_stage = ? `;
        let updateParams = [nextStatus, nextStage];

        if (staffRole === 'incharge') {
            updateQuery += `, incharge_id = ?, incharge_name = ?, incharge_decision = ?, incharge_remarks = ?, incharge_date = NOW() `;
            updateParams.push(staff.id, staff.name, decision, remarks || null);
        } else if (staffRole === 'hod') {
            updateQuery += `, hod_id = ?, hod_name = ?, hod_decision = ?, hod_remarks = ?, hod_date = NOW() `;
            updateParams.push(staff.id, staff.name, decision, remarks || null);
        } else if (staffRole === 'warden') {
            updateQuery += `, warden_id = ?, warden_name = ?, warden_decision = ?, warden_remarks = ?, warden_date = NOW() `;
            updateParams.push(staff.id, staff.name, decision, remarks || null);
        }

        if (!isNaN(requestId) && Number.isInteger(Number(requestId))) {
            updateQuery += `WHERE id = ? OR req_code = ?`;
            updateParams.push(Number(requestId), requestId.toString().trim());
        } else {
            updateQuery += `WHERE req_code = ?`;
            updateParams.push(requestId.toString().trim());
        }

        await db.query(updateQuery, updateParams);

        return res.json({
            success: true,
            message: `Request ${decision} successfully!`,
            nextStatus,
            nextStage
        });
    } catch (error) {
        console.error('Act on request error:', error);
        return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// 6. Staff Delete Request (Scoped to their department / batch only)
exports.deleteRequestForStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const { staffId } = req.body;

        if (!id || !staffId) {
            return res.status(400).json({ success: false, message: 'Request ID and staff ID are required.' });
        }

        // Fetch staff profile
        const [staffRows] = await db.query(
            `SELECT id, COALESCE(identifier, email) as identifier, name, role, department, batch 
             FROM users WHERE identifier = ? OR email = ? OR id = ?`,
            [staffId.toString().trim(), staffId.toString().trim(), staffId.toString().trim()]
        );

        if (staffRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Staff member not found.' });
        }
        const staff = staffRows[0];

        // Determine scoped column to update
        let delField = 'deleted_by_hod';
        if (staff.role === 'incharge' || staff.role === 'advisor') {
            delField = 'deleted_by_incharge';
        } else if (staff.role === 'warden') {
            delField = 'deleted_by_warden';
        }

        // Scoped condition: HOD can only delete for their department; Incharge only for their batch & dept
        let query = `UPDATE leave_requests SET ${delField} = 1 WHERE (req_code = ?`;
        let params = [id.toString().trim()];

        if (!isNaN(id) && Number.isInteger(Number(id))) {
            query += ` OR id = ?`;
            params.push(Number(id));
        }
        query += `)`;

        if (staff.role === 'hod') {
            if (staff.department) {
                query += ` AND department = ?`;
                params.push(staff.department);
            }
        } else if (staff.role === 'incharge' || staff.role === 'advisor') {
            if (staff.department) {
                query += ` AND department = ?`;
                params.push(staff.department);
            }
            if (staff.batch) {
                query += ` AND (batch = ? OR year = ?)`;
                params.push(staff.batch, staff.batch);
            }
        } else if (staff.role === 'warden') {
            query += ` AND is_hosteller = 1`;
        }

        const [result] = await db.query(query, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'No matching request found in your department/scope to delete.' 
            });
        }

        return res.json({ 
            success: true, 
            message: 'Leave request deleted successfully from your view.' 
        });
    } catch (error) {
        console.error('Staff delete request error:', error);
        return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};
