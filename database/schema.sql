-- ==========================================================
-- Annapoorana Engineering College (AEC)
-- Student Leave Request System - Database Schema
-- Supports Batch-Wise Routing & 4-Stage Approval Hierarchy
-- ==========================================================

CREATE DATABASE IF NOT EXISTS college_leave_db;
USE college_leave_db;

DROP TABLE IF EXISTS leave_requests;
DROP TABLE IF EXISTS users;

-- 1. USERS TABLE
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(50) NOT NULL UNIQUE,      -- reg_no for student, staff_id for staff, 'admin' for admin
    name VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,                    -- 'student', 'incharge', 'hod', 'warden', 'admin'
    department VARCHAR(100) NULL DEFAULT 'IT',
    batch VARCHAR(50) NULL,                       -- Batch format e.g. '2022-2026', '2023-2027', '2024-2028'
    is_hosteller BOOLEAN DEFAULT TRUE,
    room_no VARCHAR(50) NULL,
    parent_contact VARCHAR(20) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. LEAVE REQUESTS TABLE
CREATE TABLE leave_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    req_code VARCHAR(50) NOT NULL UNIQUE,         -- e.g. 'LR-1711234567890'
    student_id INT NOT NULL,
    reg_no VARCHAR(50) NOT NULL,
    student_name VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    batch VARCHAR(50) NOT NULL,
    is_hosteller BOOLEAN DEFAULT TRUE,
    room_no VARCHAR(50) NULL,
    parent_contact VARCHAR(20) NULL,
    leave_type VARCHAR(50) NOT NULL,              -- 'Home Visit', 'Medical', 'Family Function', 'Emergency', etc.
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason TEXT NOT NULL,
    address_on_leave VARCHAR(255) NULL,
    
    -- Status & Current Stage Tracking
    -- Approval flow: incharge -> hod -> (warden if hosteller)
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    current_stage ENUM('incharge', 'hod', 'warden', 'completed') DEFAULT 'incharge',

    -- Stage Decisions & Remarks
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

    applied_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================================
-- DEFAULT MASTER ADMINISTRATOR ACCOUNT
-- Username: admin
-- Password: admin123
-- ==========================================================

INSERT INTO users (identifier, name, password, role, department)
VALUES ('admin', 'System Administrator', 'admin123', 'admin', 'Administration')
ON DUPLICATE KEY UPDATE password = 'admin123';
