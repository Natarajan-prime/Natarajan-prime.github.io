const pool = require('./db');

async function autoMigrate() {
    try {
        console.log('🔄 Checking database schema and running auto-migration...');

        // 1. Ensure USERS table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                identifier VARCHAR(100) NULL,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                department VARCHAR(100) NULL DEFAULT 'IT',
                batch VARCHAR(50) NULL,
                year VARCHAR(50) NULL,
                roll_number VARCHAR(50) NULL,
                is_hosteller BOOLEAN DEFAULT TRUE,
                room_no VARCHAR(50) NULL,
                room_number VARCHAR(50) NULL,
                parent_contact VARCHAR(50) NULL,
                parent_phone VARCHAR(50) NULL,
                student_phone VARCHAR(50) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check columns in users table
        const [userCols] = await pool.query('SHOW COLUMNS FROM users');
        const userColNames = userCols.map(c => c.Field);

        const userColsToAdd = [
            ['identifier', 'VARCHAR(100) NULL'],
            ['batch', 'VARCHAR(50) NULL'],
            ['room_no', 'VARCHAR(50) NULL'],
            ['parent_contact', 'VARCHAR(50) NULL']
        ];

        for (const [col, colType] of userColsToAdd) {
            if (!userColNames.includes(col)) {
                console.log(`➕ Adding missing column users.${col}`);
                await pool.query(`ALTER TABLE users ADD COLUMN ${col} ${colType}`);
            }
        }

        // Avoid ENUM truncation and strict mode missing default value issues
        await pool.query('ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL');
        if (userColNames.includes('email')) {
            await pool.query('ALTER TABLE users MODIFY COLUMN email VARCHAR(100) NULL DEFAULT NULL');
        }
        if (userColNames.includes('roll_number')) {
            await pool.query('ALTER TABLE users MODIFY COLUMN roll_number VARCHAR(50) NULL DEFAULT NULL');
        }
        if (userColNames.includes('year')) {
            await pool.query('ALTER TABLE users MODIFY COLUMN year VARCHAR(50) NULL DEFAULT NULL');
        }
        if (userColNames.includes('hostel_block')) {
            await pool.query('ALTER TABLE users MODIFY COLUMN hostel_block VARCHAR(50) NULL DEFAULT NULL');
        }
        if (userColNames.includes('room_number')) {
            await pool.query('ALTER TABLE users MODIFY COLUMN room_number VARCHAR(50) NULL DEFAULT NULL');
        }
        if (userColNames.includes('parent_phone')) {
            await pool.query('ALTER TABLE users MODIFY COLUMN parent_phone VARCHAR(50) NULL DEFAULT NULL');
        }
        if (userColNames.includes('student_phone')) {
            await pool.query('ALTER TABLE users MODIFY COLUMN student_phone VARCHAR(50) NULL DEFAULT NULL');
        }

        // Populate identifier, batch, room_no, parent_contact from legacy columns if present
        if (userColNames.includes('roll_number') || userColNames.includes('email')) {
            await pool.query(`
                UPDATE users 
                SET identifier = COALESCE(NULLIF(roll_number, ''), NULLIF(email, ''), identifier)
                WHERE identifier IS NULL OR identifier = ''
            `);
        }

        // Ensure master admin has identifier = 'admin' so both 'admin' and 'admin@college.edu' can log in
        await pool.query(`
            UPDATE users 
            SET identifier = 'admin' 
            WHERE role = 'admin' AND (identifier IS NULL OR identifier = 'admin@college.edu' OR identifier = '')
        `);

        // If no admin user exists at all, insert default admin
        const [admins] = await pool.query("SELECT id FROM users WHERE role = 'admin'");
        if (admins.length === 0) {
            console.log('➕ Creating default master admin (admin / admin123)...');
            await pool.query(`
                INSERT INTO users (identifier, name, email, password, role, department) 
                VALUES ('admin', 'System Administrator', 'admin@college.edu', 'admin123', 'admin', 'Administration')
            `);
        }

        if (userColNames.includes('year')) {
            await pool.query(`
                UPDATE users 
                SET batch = year 
                WHERE (batch IS NULL OR batch = '') AND year IS NOT NULL
            `);
        }
        if (userColNames.includes('room_number')) {
            await pool.query(`
                UPDATE users 
                SET room_no = room_number 
                WHERE (room_no IS NULL OR room_no = '') AND room_number IS NOT NULL
            `);
        }
        if (userColNames.includes('parent_phone')) {
            await pool.query(`
                UPDATE users 
                SET parent_contact = parent_phone 
                WHERE (parent_contact IS NULL OR parent_contact = '') AND parent_phone IS NOT NULL
            `);
        }

        // 2. Ensure LEAVE_REQUESTS table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS leave_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                req_code VARCHAR(50) NULL,
                student_id INT NOT NULL,
                reg_no VARCHAR(50) NULL,
                student_name VARCHAR(100) NULL,
                department VARCHAR(100) NOT NULL,
                batch VARCHAR(50) NULL,
                year VARCHAR(50) NULL,
                is_hosteller BOOLEAN DEFAULT TRUE,
                room_no VARCHAR(50) NULL,
                parent_contact VARCHAR(50) NULL,
                leave_type VARCHAR(100) NOT NULL,
                from_date DATE NULL,
                to_date DATE NULL,
                reason TEXT NOT NULL,
                address_on_leave VARCHAR(255) NULL,
                status VARCHAR(50) DEFAULT 'pending',
                current_stage VARCHAR(50) DEFAULT 'incharge',
                incharge_id INT NULL,
                incharge_name VARCHAR(100) NULL,
                incharge_decision VARCHAR(20) NULL,
                incharge_remarks TEXT NULL,
                incharge_date TIMESTAMP NULL,
                hod_id INT NULL,
                hod_name VARCHAR(100) NULL,
                hod_decision VARCHAR(20) NULL,
                hod_remarks TEXT NULL,
                hod_date TIMESTAMP NULL,
                warden_id INT NULL,
                warden_name VARCHAR(100) NULL,
                warden_decision VARCHAR(20) NULL,
                warden_remarks TEXT NULL,
                warden_date TIMESTAMP NULL,
                applied_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const [leaveCols] = await pool.query('SHOW COLUMNS FROM leave_requests');
        const leaveColNames = leaveCols.map(c => c.Field);

        await pool.query("ALTER TABLE leave_requests MODIFY COLUMN status VARCHAR(50) DEFAULT 'pending'");
        await pool.query("ALTER TABLE leave_requests MODIFY COLUMN leave_type VARCHAR(100) NOT NULL");
        if (leaveColNames.includes('year')) {
            await pool.query("ALTER TABLE leave_requests MODIFY COLUMN year VARCHAR(50) NULL");
        }
        if (leaveColNames.includes('start_date')) {
            await pool.query("ALTER TABLE leave_requests MODIFY COLUMN start_date DATE NULL DEFAULT NULL");
        }
        if (leaveColNames.includes('end_date')) {
            await pool.query("ALTER TABLE leave_requests MODIFY COLUMN end_date DATE NULL DEFAULT NULL");
        }
        if (leaveColNames.includes('destination')) {
            await pool.query("ALTER TABLE leave_requests MODIFY COLUMN destination VARCHAR(255) NULL DEFAULT NULL");
        }

        const leaveColsToAdd = [
            ['req_code', 'VARCHAR(50) NULL'],
            ['reg_no', 'VARCHAR(50) NULL'],
            ['student_name', 'VARCHAR(100) NULL'],
            ['batch', 'VARCHAR(50) NULL'],
            ['is_hosteller', 'BOOLEAN DEFAULT TRUE'],
            ['room_no', 'VARCHAR(50) NULL'],
            ['parent_contact', 'VARCHAR(50) NULL'],
            ['from_date', 'DATE NULL'],
            ['to_date', 'DATE NULL'],
            ['address_on_leave', 'VARCHAR(255) NULL'],
            ['current_stage', "VARCHAR(50) DEFAULT 'incharge'"],
            ['incharge_id', 'INT NULL'],
            ['incharge_name', 'VARCHAR(100) NULL'],
            ['incharge_decision', 'VARCHAR(20) NULL'],
            ['incharge_remarks', 'TEXT NULL'],
            ['incharge_date', 'TIMESTAMP NULL'],
            ['hod_id', 'INT NULL'],
            ['hod_name', 'VARCHAR(100) NULL'],
            ['hod_decision', 'VARCHAR(20) NULL'],
            ['hod_remarks', 'TEXT NULL'],
            ['hod_date', 'TIMESTAMP NULL'],
            ['warden_id', 'INT NULL'],
            ['warden_name', 'VARCHAR(100) NULL'],
            ['warden_decision', 'VARCHAR(20) NULL'],
            ['warden_remarks', 'TEXT NULL'],
            ['warden_date', 'TIMESTAMP NULL'],
            ['applied_on', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
            ['student_phone', 'VARCHAR(50) NULL'],
            ['deleted_by_admin', 'BOOLEAN DEFAULT FALSE'],
            ['deleted_by_hod', 'BOOLEAN DEFAULT FALSE'],
            ['deleted_by_incharge', 'BOOLEAN DEFAULT FALSE'],
            ['deleted_by_warden', 'BOOLEAN DEFAULT FALSE']
        ];

        for (const [col, colType] of leaveColsToAdd) {
            if (!leaveColNames.includes(col)) {
                console.log(`➕ Adding missing column leave_requests.${col}`);
                await pool.query(`ALTER TABLE leave_requests ADD COLUMN ${col} ${colType}`);
            }
        }

        // Sync legacy leave data
        await pool.query("UPDATE leave_requests SET req_code = CONCAT('LR-', id) WHERE req_code IS NULL OR req_code = ''");
        
        if (leaveColNames.includes('start_date')) {
            await pool.query("UPDATE leave_requests SET from_date = start_date WHERE from_date IS NULL AND start_date IS NOT NULL");
        }
        if (leaveColNames.includes('end_date')) {
            await pool.query("UPDATE leave_requests SET to_date = end_date WHERE to_date IS NULL AND end_date IS NOT NULL");
        }
        if (leaveColNames.includes('destination')) {
            await pool.query("UPDATE leave_requests SET address_on_leave = destination WHERE (address_on_leave IS NULL OR address_on_leave = '') AND destination IS NOT NULL");
        }
        if (leaveColNames.includes('advisor_remarks')) {
            await pool.query("UPDATE leave_requests SET incharge_remarks = advisor_remarks WHERE (incharge_remarks IS NULL OR incharge_remarks = '') AND advisor_remarks IS NOT NULL");
        }
        if (leaveColNames.includes('advisor_id')) {
            await pool.query("UPDATE leave_requests SET incharge_id = advisor_id WHERE incharge_id IS NULL AND advisor_id IS NOT NULL");
        }

        // Populate student info into existing leave rows
        await pool.query(`
            UPDATE leave_requests lr 
            JOIN users u ON lr.student_id = u.id 
            SET lr.student_name = COALESCE(lr.student_name, u.name),
                lr.reg_no = COALESCE(lr.reg_no, u.identifier, u.roll_number),
                lr.batch = COALESCE(lr.batch, u.batch, u.year),
                lr.is_hosteller = COALESCE(lr.is_hosteller, u.is_hosteller),
                lr.room_no = COALESCE(lr.room_no, u.room_no, u.room_number),
                lr.parent_contact = COALESCE(lr.parent_contact, u.parent_contact, u.parent_phone)
            WHERE lr.reg_no IS NULL OR lr.student_name IS NULL
        `);

        // Standardize legacy status & stage
        await pool.query(`
            UPDATE leave_requests 
            SET status = 'pending', current_stage = 'incharge' 
            WHERE status = 'PENDING_ADVISOR'
        `);
        await pool.query(`
            UPDATE leave_requests 
            SET status = 'pending', current_stage = 'hod' 
            WHERE status = 'PENDING_HOD'
        `);
        await pool.query(`
            UPDATE leave_requests 
            SET status = 'pending', current_stage = 'warden' 
            WHERE status = 'PENDING_WARDEN'
        `);
        await pool.query(`
            UPDATE leave_requests 
            SET status = 'approved', current_stage = 'completed' 
            WHERE status = 'APPROVED'
        `);
        await pool.query(`
            UPDATE leave_requests 
            SET status = 'rejected' 
            WHERE status = 'REJECTED'
        `);

        console.log('✅ Database schema verified & synced successfully!');
    } catch (err) {
        console.error('⚠️ Auto-migration error:', err.message);
    }
}

module.exports = autoMigrate;
