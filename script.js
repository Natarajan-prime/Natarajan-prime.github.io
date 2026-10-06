/* ============================================================
   Student Leave Request System — Annapoorana Engineering College
   Shared Application Logic connected to Node.js & MySQL Backend
   ============================================================ */

const API_BASE = (window.location.protocol === 'file:')
  ? 'http://localhost:3000/api'
  : '/api';

const SESSION_KEY = "lrs_session_v2";

// Approval Stage Order: Student -> Incharge -> HOD -> (Warden if Hosteller)
const STAGE_ORDER_HOSTEL = ["incharge", "hod", "warden"];
const STAGE_ORDER_DAY = ["incharge", "hod"];

const STAGE_LABEL = {
  incharge: "Class Incharge",
  hod: "Head of Department (HOD)",
  warden: "Hostel Warden"
};

/* ---------------------------------------------------------
   SESSION / AUTHENTICATION
   --------------------------------------------------------- */

function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}
function setSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
function logout() {
  clearSession();
  window.location.href = "index.html";
}

// Redirect helper
function requireRole(expectedRole) {
  const session = getSession();
  if (!session || session.role !== expectedRole) {
    window.location.href = "index.html";
    return null;
  }
  return session;
}

// 1. Login Student API
async function loginStudent(regNo, password) {
  try {
    const res = await fetch(`${API_BASE}/auth/login-student`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regNo, password })
    });
    const data = await res.json();
    if (data.success && data.user) {
      setSession({
        role: "student",
        id: data.user.regNo,
        dbId: data.user.id,
        name: data.user.name,
        department: data.user.department,
        year: data.user.year,
        batch: data.user.batch,
        is_hosteller: data.user.is_hosteller,
        room: data.user.room,
        parentContact: data.user.parentContact,
        studentPhone: data.user.studentPhone || ''
      });
      return { ok: true, user: data.user };
    }
    return { ok: false, error: data.message || "Invalid register number or password." };
  } catch (err) {
    return { ok: false, error: "Cannot connect to server. Ensure Node.js server is running." };
  }
}

// 2. Login Staff API (Incharge, HOD, Warden)
async function loginStaff(staffId, password, designation) {
  try {
    const res = await fetch(`${API_BASE}/auth/login-staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, password, designation })
    });
    const data = await res.json();
    if (data.success && data.user) {
      setSession({
        role: "staff",
        id: data.user.staffId,
        dbId: data.user.id,
        name: data.user.name,
        designation: data.user.designation,
        department: data.user.department,
        batch: data.user.batch
      });
      return { ok: true, user: data.user };
    }
    return { ok: false, error: data.message || "Invalid staff credentials or role." };
  } catch (err) {
    return { ok: false, error: "Cannot connect to server. Ensure Node.js server is running." };
  }
}

// 3. Login Admin API
async function loginAdmin(username, password) {
  try {
    const res = await fetch(`${API_BASE}/auth/login-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success && data.user) {
      setSession({
        role: "admin",
        id: data.user.username,
        name: data.user.name
      });
      return { ok: true, user: data.user };
    }
    return { ok: false, error: data.message || "Invalid admin username or password." };
  } catch (err) {
    return { ok: false, error: "Cannot connect to server. Ensure Node.js server is running." };
  }
}

// 4. Register Student API (Public Self-Registration)
async function registerStudent(payload) {
  try {
    const res = await fetch(`${API_BASE}/auth/register-student`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      return { ok: true, message: data.message };
    }
    return { ok: false, error: data.message || "Registration failed." };
  } catch (err) {
    return { ok: false, error: "Cannot connect to server. Ensure Node.js server is running." };
  }
}

// 5. Register Staff API (Public Self-Registration)
async function registerStaff(payload) {
  try {
    const res = await fetch(`${API_BASE}/auth/register-staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      return { ok: true, message: data.message };
    }
    return { ok: false, error: data.message || "Registration failed." };
  } catch (err) {
    return { ok: false, error: "Cannot connect to server. Ensure Node.js server is running." };
  }
}

// 6. Forgot / Reset Password API
// Requires role ('student' | 'staff'), identifier (regNo | staffId), registered Gmail, and new password
async function forgotPassword(payload) {
  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      return { ok: true, message: data.message };
    }
    return { ok: false, error: data.message || "Password reset failed." };
  } catch (err) {
    return { ok: false, error: "Cannot connect to server. Ensure Node.js server is running." };
  }
}

/* ---------------------------------------------------------
   ADMIN ACTIONS (Database backed)
   --------------------------------------------------------- */

async function adminAddStudent(payload) {
  try {
    const res = await fetch(`${API_BASE}/admin/student`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) return { ok: true };
    return { ok: false, error: data.message };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function adminAddStaff(payload) {
  try {
    const res = await fetch(`${API_BASE}/admin/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) return { ok: true };
    return { ok: false, error: data.message };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function adminGetStudents() {
  const res = await fetch(`${API_BASE}/admin/students`);
  const data = await res.json();
  return data.students || [];
}

async function adminGetStaff() {
  const res = await fetch(`${API_BASE}/admin/staff`);
  const data = await res.json();
  return data.staff || [];
}

async function adminGetAllRequests() {
  const res = await fetch(`${API_BASE}/admin/requests`);
  const data = await res.json();
  return data.requests || [];
}

async function adminUpdateStudent(id, payload) {
  try {
    const res = await fetch(`${API_BASE}/admin/student/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: err.message };
  }
}

async function adminDeleteStudent(id) {
  try {
    const res = await fetch(`${API_BASE}/admin/student/${id}`, {
      method: "DELETE"
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: err.message };
  }
}

async function adminUpdateStaff(id, payload) {
  try {
    const res = await fetch(`${API_BASE}/admin/staff/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: err.message };
  }
}

async function adminDeleteStaff(id) {
  try {
    const res = await fetch(`${API_BASE}/admin/staff/${id}`, {
      method: "DELETE"
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: err.message };
  }
}

async function adminDeleteRequest(id) {
  try {
    const res = await fetch(`${API_BASE}/admin/request/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: err.message };
  }
}

async function printStudentList() {
  try {
    const students = await adminGetStudents();
    if (!students || students.length === 0) {
      alert("No students registered to print.");
      return;
    }

    const rows = students.map((s, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td><strong>${escapeHtml(s.regNo)}</strong></td>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.department)}</td>
        <td>${escapeHtml(s.year || '-')}</td>
        <td>${escapeHtml(s.batch || '-')}</td>
        <td>${s.is_hosteller ? `Hostel (Floor: ${escapeHtml(s.floor || '-')}, Room: ${escapeHtml(s.room || '-')})` : 'Day Scholar'}</td>
        <td>${escapeHtml(s.studentPhone || s.student_phone || '-')}</td>
        <td>${escapeHtml(s.parentContact || '-')}</td>
      </tr>
    `).join("");

    const html = `
      <div class="slip-container" style="max-width:900px;">
        <div class="slip-header">
          <div class="crest-sm">AEC</div>
          <div>
            <h3>ANNAPOORANA ENGINEERING COLLEGE</h3>
            <p>(An Autonomous Institution &middot; Accredited by NAAC)</p>
            <p style="font-weight:700; color:#1e3a8a; margin-top:2px;">OFFICIAL STUDENT REGISTER &amp; LEAVE SYSTEM ENROLLMENT</p>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; margin:12px 0 8px 0; font-size:12px; color:#475569;">
          <span><strong>Total Enrolled Students:</strong> ${students.length}</span>
          <span><strong>Generated On:</strong> ${new Date().toLocaleString('en-IN')}</span>
        </div>

        <table class="slip-approvals-table" style="font-size:11px;">
          <thead>
            <tr>
              <th style="width:40px; text-align:center;">S.No</th>
              <th>Register No.</th>
              <th>Student Name</th>
              <th>Department</th>
              <th>Year</th>
              <th>Batch</th>
              <th>Residence Category</th>
              <th>Student Mobile</th>
              <th>Parent Mobile</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="slip-footer" style="margin-top:28px;">
          <div>
            <p><strong>Prepared By:</strong> System Administrator</p>
            <p style="color:#64748b; font-size:10px; margin-top:4px;">AEC Automated Leave Management Portal</p>
          </div>
          <div>
            <p><strong>Authorized Signatory:</strong> _______________________</p>
            <p style="color:#64748b; font-size:10px; margin-top:4px;">Principal / Administrative Officer</p>
          </div>
        </div>
      </div>
    `;

    let sheet = document.getElementById("printSheet");
    if (!sheet) {
      sheet = document.createElement("div");
      sheet.id = "printSheet";
      sheet.className = "print-sheet";
      document.body.appendChild(sheet);
    }
    sheet.innerHTML = html;
    setTimeout(() => {
      window.print();
    }, 200);
  } catch (err) {
    alert("Error preparing student list: " + err.message);
  }
}

/* ---------------------------------------------------------
   LEAVE REQUEST WORKFLOW
   --------------------------------------------------------- */

async function submitLeaveRequest(session, payload) {
  try {
    const res = await fetch(`${API_BASE}/leave/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        regNo: session.id,
        ...payload
      })
    });
    return await res.json();
  } catch (err) {
    console.error("Submit leave error:", err);
    throw err;
  }
}

async function getRequestsForStudent(regNo) {
  try {
    if (!regNo) return [];
    const res = await fetch(`${API_BASE}/leave/student/${encodeURIComponent(regNo)}`);
    const data = await res.json();
    return data.requests || [];
  } catch (err) {
    console.error("Fetch student leaves error:", err);
    return [];
  }
}

async function getRequestsForStage(designation, staffId) {
  try {
    if (!designation) return [];
    let url = `${API_BASE}/leave/stage?designation=${encodeURIComponent(designation)}`;
    if (staffId) url += `&staffId=${encodeURIComponent(staffId)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.requests || [];
  } catch (err) {
    console.error("Fetch stage leaves error:", err);
    return [];
  }
}

async function getRequestHistoryForStage(designation, staffId) {
  try {
    if (!designation) return [];
    let url = `${API_BASE}/leave/history?designation=${encodeURIComponent(designation)}`;
    if (staffId) url += `&staffId=${encodeURIComponent(staffId)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.requests || [];
  } catch (err) {
    console.error("Fetch history leaves error:", err);
    return [];
  }
}

async function actOnRequest(requestId, staffSession, decision, remarks) {
  try {
    const res = await fetch(`${API_BASE}/leave/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        staffId: staffSession.id || staffSession.staffId,
        decision,
        remarks
      })
    });
    return await res.json();
  } catch (err) {
    console.error("Act on request error:", err);
    throw err;
  }
}

async function staffDeleteRequest(requestId, staffId) {
  try {
    const res = await fetch(`${API_BASE}/leave/request/${encodeURIComponent(requestId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId })
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/* ---------------------------------------------------------
   RENDER HELPERS
   --------------------------------------------------------- */

function fmtDate(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateOnly(dateStr) {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function statusBadge(req) {
  if (req.status === "approved") return `<span class="badge badge-approved">Approved</span>`;
  if (req.status === "rejected") return `<span class="badge badge-rejected">Rejected</span>`;
  return `<span class="badge badge-pending">Pending \u2014 ${STAGE_LABEL[req.currentStage] || req.currentStage}</span>`;
}

// Stage Track: If hosteller -> incharge -> hod -> warden.
// If day scholar -> incharge -> hod (Final).
function stageTrack(req) {
  const isHostel = req.is_hosteller !== false;
  const stages = isHostel ? STAGE_ORDER_HOSTEL : STAGE_ORDER_DAY;
  const rejectedStage = req.status === "rejected" && req.approvals && req.approvals.length
    ? req.approvals[req.approvals.length - 1].stage 
    : null;

  const dots = stages.map(stage => {
    let cls = "stage-dot";
    const wasApproved = req.approvals && req.approvals.some(a => a.stage === stage && a.decision === "approved");
    if (stage === rejectedStage) cls += " rejected";
    else if (wasApproved) cls += " done";
    else if (req.status === "pending" && req.currentStage === stage) cls += " current";
    return `<span class="${cls}" title="${STAGE_LABEL[stage]}"></span>`;
  });

  return `<div class="stage-track">${dots.join("")}<span style="margin-left:4px;">${stages.map(
    s => STAGE_LABEL[s]
  ).join(" \u2192 ")}</span></div>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

/* ---------------------------------------------------------
   PRINT / OUTPASS SHEET (OFFICIAL STYLISH CERTIFICATE & AEC WATERMARK)
   --------------------------------------------------------- */

function buildPrintSheet(req) {
  const isApproved = req.status === "approved" || req.status === "APPROVED";
  const isRejected = req.status === "rejected" || req.status === "REJECTED";
  const bannerClass = isApproved ? "banner-approved" : (isRejected ? "banner-rejected" : "banner-pending");
  const bannerTitle = isApproved 
    ? "OFFICIAL STUDENT LEAVE PASS &amp; GATE OUTPASS" 
    : (isRejected ? "STUDENT LEAVE APPLICATION FORM (REJECTED)" : "STUDENT LEAVE APPLICATION FORM (PENDING APPROVAL)");

  let totalDays = 1;
  if (req.fromDate && req.toDate) {
    try {
      const d1 = new Date(req.fromDate);
      const d2 = new Date(req.toDate);
      const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
      if (!isNaN(diff) && diff > 0) totalDays = diff;
    } catch (e) {}
  }

  let rows = "";
  if (req.approvals && req.approvals.length > 0) {
    rows = req.approvals.map(a => {
      const decClass = a.decision === "approved" ? "slip-decision-approved" : "slip-decision-rejected";
      const decText = a.decision === "approved" ? "✓ Approved" : "✗ Rejected";
      return `
        <tr>
          <td><strong>${STAGE_LABEL[a.stage] || a.stage}</strong></td>
          <td>${escapeHtml(a.by || "Authorized Staff")}</td>
          <td><span class="${decClass}">${decText}</span></td>
          <td>${fmtDate(a.date)}</td>
          <td>${escapeHtml(a.remarks) || "—"}</td>
        </tr>
      `;
    }).join("");
  } else {
    rows = `
      <tr>
        <td><strong>Class Incharge</strong></td>
        <td>Class Advisor</td>
        <td><span class="slip-decision-pending">⏳ Pending Review</span></td>
        <td>—</td>
        <td>Awaiting submission review</td>
      </tr>
      <tr>
        <td><strong>Head of Department</strong></td>
        <td>HOD</td>
        <td><span class="slip-decision-pending">⏳ Pending Review</span></td>
        <td>—</td>
        <td>Awaiting HOD sanction</td>
      </tr>
      ${req.is_hosteller ? `
      <tr>
        <td><strong>Hostel Warden</strong></td>
        <td>Chief Warden</td>
        <td><span class="slip-decision-pending">⏳ Pending Review</span></td>
        <td>—</td>
        <td>Awaiting hostel clearance</td>
      </tr>` : ""}
    `;
  }

  return `
    <div class="slip-container">
      <!-- AEC WATERMARK PLACEHOLDER IN BACKGROUND -->
      <div class="slip-watermark" aria-hidden="true">
        <svg class="slip-watermark-svg" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
          <circle cx="250" cy="250" r="235" fill="none" stroke="#0b2545" stroke-width="4" stroke-dasharray="10 6" opacity="0.6"/>
          <circle cx="250" cy="250" r="220" fill="none" stroke="#0b2545" stroke-width="3" opacity="0.75"/>
          <circle cx="250" cy="250" r="162" fill="none" stroke="#0b2545" stroke-width="2" opacity="0.6"/>
          
          <defs>
            <path id="wmCircleTop" d="M 65,250 A 185,185 0 0,1 435,250" fill="none" />
            <path id="wmCircleBottom" d="M 435,250 A 185,185 0 0,1 65,250" fill="none" />
          </defs>
          <text font-family="'Inter', 'Arial', sans-serif" font-size="18" font-weight="800" fill="#0b2545" letter-spacing="4">
            <textPath href="#wmCircleTop" startOffset="50%" text-anchor="middle">
              ANNAPOORANA ENGINEERING COLLEGE
            </textPath>
          </text>
          <text font-family="'Inter', 'Arial', sans-serif" font-size="15" font-weight="700" fill="#0b2545" letter-spacing="5">
            <textPath href="#wmCircleBottom" startOffset="50%" text-anchor="middle">
              ★ AUTONOMOUS • SALEM • ESTD 2010 ★
            </textPath>
          </text>
          
          <text x="250" y="278" font-family="'Times New Roman', 'Cinzel', Georgia, serif" font-size="120" font-weight="900" fill="#0b2545" text-anchor="middle" letter-spacing="12">
            AEC
          </text>
          
          <line x1="130" y1="300" x2="370" y2="300" stroke="#0b2545" stroke-width="3.5" opacity="0.8"/>
          <text x="250" y="324" font-family="'Inter', sans-serif" font-size="13" font-weight="800" fill="#0b2545" text-anchor="middle" letter-spacing="6">
            OFFICIAL GATE PASS
          </text>
        </svg>
      </div>

      <!-- SLIP HEADER -->
      <div class="slip-header">
        <div class="slip-crest-row">
          <div class="slip-crest-badge">
           <img src="ChatGPT Image Sep 27, 2026, 12_50_34 AM.png" alt=""height="50px" width="50px"> 
          </div>
          <div class="slip-header-center">
            <h1 class="slip-college-name">ANNAPOORANA ENGINEERING COLLEGE</h1>
            <p class="slip-college-affil">(An Autonomous Institution &bull; Accredited by NAAC &bull; Approved by AICTE, New Delhi)</p>
            <p class="slip-college-addr">NH-47 Sankari Main Road, Periyaseeragapadi, Salem &ndash; 636 308, Tamil Nadu</p>
          </div>
          <div class="slip-qr-box">
            <div class="slip-qr-placeholder">
              <div class="slip-qr-code">${escapeHtml(req.id)}</div>
              <span class="slip-qr-lbl">${isApproved ? 'VERIFIED' : 'ACTIVE'}</span>
            </div>
          </div>
        </div>

        <div class="slip-dept-bar">
          <span>DEPARTMENT OF ${escapeHtml((req.department || 'ENGINEERING').toUpperCase())}</span>
          <span class="slip-dot-divider">&bull;</span>
          <span>ACADEMIC YEAR: ${escapeHtml(req.year || 'N/A')}</span>
        </div>

        <div class="slip-title-banner ${bannerClass}">
          <div class="slip-title-text">${bannerTitle}</div>
          <div class="slip-pass-badge">
            PASS ID: <strong>${escapeHtml(req.id)}</strong>
          </div>
        </div>
      </div>

      <!-- SLIP BODY -->
      <div class="slip-body">
        <div class="slip-section-title">1. STUDENT PARTICULARS</div>
        <div class="slip-grid-box">
          <div class="slip-grid-col">
            <div class="slip-item"><span class="slip-label">Student Name</span><strong class="slip-value">${escapeHtml(req.studentName)}</strong></div>
            <div class="slip-item"><span class="slip-label">Register / Roll No</span><strong class="slip-value slip-mono">${escapeHtml(req.regNo)}</strong></div>
            <div class="slip-item"><span class="slip-label">Department &amp; Year</span><strong class="slip-value">${escapeHtml(req.department)} &bull; ${escapeHtml(req.year || 'N/A')}</strong></div>
            <div class="slip-item"><span class="slip-label">Academic Batch</span><strong class="slip-value">${escapeHtml(req.batch || 'N/A')}</strong></div>
          </div>
          <div class="slip-grid-col">
            <div class="slip-item"><span class="slip-label">Residential Category</span><strong class="slip-value">${req.is_hosteller ? `🏢 Hostel Resident (Room ${escapeHtml(req.room || 'N/A')}${req.floor ? ', Floor ' + escapeHtml(req.floor) : ''})` : '🎒 Day Scholar'}</strong></div>
            <div class="slip-item"><span class="slip-label">Student Mobile No</span><strong class="slip-value slip-highlight">📱 ${escapeHtml(req.studentPhone || 'N/A')}</strong></div>
            <div class="slip-item"><span class="slip-label">Parent / Guardian Contact</span><strong class="slip-value slip-highlight">👨‍👩‍👦 ${escapeHtml(req.parentContact || 'N/A')}</strong></div>
            <div class="slip-item"><span class="slip-label">Pass Applied Date</span><strong class="slip-value">${fmtDate(req.appliedOn)}</strong></div>
          </div>
        </div>

        <div class="slip-section-title">2. LEAVE DETAILS &amp; DURATION</div>
        <div class="slip-grid-box">
          <div class="slip-grid-col">
            <div class="slip-item"><span class="slip-label">Nature / Type of Leave</span><strong class="slip-value slip-type-badge">${escapeHtml(req.leaveType)}</strong></div>
            <div class="slip-item"><span class="slip-label">Leave Duration</span><strong class="slip-value">${fmtDateOnly(req.fromDate)} &rarr; ${fmtDateOnly(req.toDate)}</strong></div>
          </div>
          <div class="slip-grid-col">
            <div class="slip-item"><span class="slip-label">Total Days Requested</span><strong class="slip-value">${totalDays} Day(s)</strong></div>
            <div class="slip-item"><span class="slip-label">Clearance Status</span><strong class="slip-value ${isApproved ? 'status-text-approved' : (isRejected ? 'status-text-rejected' : 'status-text-pending')}">${isApproved ? 'AUTHORIZED / CLEARED' : (isRejected ? 'REJECTED' : 'PENDING APPROVAL')}</strong></div>
          </div>
        </div>

        <div class="slip-reason-container">
          <div class="slip-reason-title">Purpose / Reason for Leave:</div>
          <div class="slip-reason-text">${escapeHtml(req.reason)}</div>
        </div>

        ${req.addressOnLeave ? `
        <div class="slip-address-container">
          <div class="slip-reason-title">Destination &amp; Address During Leave:</div>
          <div class="slip-reason-text">${escapeHtml(req.addressOnLeave)}</div>
        </div>` : ''}

        <div class="slip-section-title">3. APPROVAL &amp; VERIFICATION AUDIT TRAIL</div>
        <table class="slip-approvals-table">
          <thead>
            <tr>
              <th>Approval Stage</th>
              <th>Designated Authority</th>
              <th>Decision</th>
              <th>Date &amp; Timestamp</th>
              <th>Remarks &amp; Conditions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="slip-bottom-notice">
          <p><strong>Notice:</strong> 1. This leave pass must be presented and verified at the college security gate upon departure and re-entry. 2. Hostellers must strictly report back to the hostel before curfew hours. 3. Tampering, editing, or falsifying this official document is punishable under college regulations.</p>
          <div class="slip-meta-footer">
            <span>System Generated on: ${new Date().toLocaleString('en-IN')}</span>
            <span>AEC ERP Leave Management Portal</span>
          </div>
        </div>
      </div>
    </div>
  `
}

async function printRequest(requestId) {
  try {
    let req = null;
    const session = getSession();
    if (session && session.role === "student") {
      const list = await getRequestsForStudent(session.id);
      req = list.find(r => r.id === requestId || r.dbId === requestId || r.id === ('LR-' + requestId));
    }
    if (!req && session && (session.role === "advisor" || session.role === "hod" || session.role === "warden")) {
      const list = await getRequestHistoryForStage(session.designation, session.id || session.staffId);
      req = list.find(r => r.id === requestId || r.dbId === requestId || r.id === ('LR-' + requestId));
    }
    if (!req && window.allHistoryRecords) {
      req = window.allHistoryRecords.find(r => r.id === requestId || r.dbId === requestId || r.id === ('LR-' + requestId));
    }
    if (!req) {
      const list = await adminGetAllRequests();
      req = list.find(r => r.id === requestId || r.dbId === requestId || r.id === ('LR-' + requestId));
    }
    if (!req) {
      alert("Could not load details for this leave request.");
      return;
    }

    let sheet = document.getElementById("printSheet");
    if (!sheet) {
      sheet = document.createElement("div");
      sheet.id = "printSheet";
      document.body.appendChild(sheet);
    }
    sheet.className = "print-sheet";
    sheet.innerHTML = buildPrintSheet(req);
    setTimeout(() => {
      window.print();
    }, 200);
  } catch (err) {
    alert("Error loading pass: " + err.message);
  }
}

// -------------------------------------------------------------
// LIVE RUNNING DATE & TIME CLOCK (FOR SIDEBAR & LOGIN)
// -------------------------------------------------------------
let _liveClockInterval = null;
function startLiveClock() {
  function tick() {
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const timeStr = now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      
      document.querySelectorAll('.live-clock-date').forEach(el => { el.textContent = dateStr; });
      document.querySelectorAll('.live-clock-time').forEach(el => { el.textContent = timeStr; });
    } catch (e) {
      console.warn("Live clock tick error:", e);
    }
  }
  tick();
  if (!_liveClockInterval) {
    _liveClockInterval = setInterval(tick, 1000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startLiveClock);
} else {
  startLiveClock();
}