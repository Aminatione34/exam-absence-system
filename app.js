// ==================== API URL ====================
const APPS_SCRIPT_URL ='https://script.google.com/macros/s/AKfycbyk6njtpeEeR5XonY1JErToIUB8I1v0nxg3D73j_NhHGP_ufRvuqMy5Qdm4pPRXmYnn/exec';

// ==================== GLOBAL VARIABLES ====================
let currentUser = null;
let currentPage = "dashboard";

// Chart instances
let absencesChart = null;
let modulesChart = null;
let monthlyChart = null;

// ==================== APPS SCRIPT CALL ====================
function callAppsScript(data, callback) {
    const callbackName = "cb_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    
    // Convert data to query string
    const queryString = Object.keys(data).map(key => {
        const value = typeof data[key] === "object" ? JSON.stringify(data[key]) : data[key];
        return encodeURIComponent(key) + "=" + encodeURIComponent(value);
    }).join("&");
    
    const url = APPS_SCRIPT_URL + "?callback=" + callbackName + "&" + queryString;
    
    // Timeout protection
    const timeout = setTimeout(() => {
        console.error("⏰ Timeout - server not responding");
        if (window[callbackName]) {
            delete window[callbackName];
        }
        const script = document.getElementById(callbackName + "_script");
        if (script) {
            document.head.removeChild(script);
        }
        callback({ 
            success: false, 
            message: "الخادم لا يستجيب - تحقق من الاتصال" 
        });
    }, 15000); // 15 seconds timeout
    
    // Callback function
    window[callbackName] = function(response) {
        clearTimeout(timeout);
        const script = document.getElementById(callbackName + "_script");
        if (script) {
            document.head.removeChild(script);
        }
        delete window[callbackName];
        callback(response);
    };
    
    // Create script element
    const script = document.createElement("script");
    script.id = callbackName + "_script";
    script.src = url;
    
    // Error handler
    script.onerror = function() {
        clearTimeout(timeout);
        console.error("❌ Network error - failed to load script");
        if (window[callbackName]) {
            delete window[callbackName];
        }
        if (script.parentNode) {
            script.parentNode.removeChild(script);
        }
        callback({ 
            success: false, 
            message: "فشل الاتصال بالخادم - تحقق من الرابط" 
        });
    };
    
    document.head.appendChild(script);
}

// ==================== LOGIN CHECK ====================
document.addEventListener("DOMContentLoaded", function() {
    // Skip if on login page
    if (window.location.href.includes("index.html") || 
        window.location.pathname.endsWith("index.html")) {
        return;
    }
    
    const userData = localStorage.getItem("user");
    
    if (!userData) {
        window.location.href = "index.html";
        return;
    }
    
    try {
        currentUser = JSON.parse(userData);
    } catch (e) {
        console.error("Invalid user data in localStorage");
        localStorage.removeItem("user");
        window.location.href = "index.html";
        return;
    }
    
    // Update UI with user info
    updateUserInfo();
    
    // Setup navigation
    setupNavigation();
    
    // Load default page
    loadPage("dashboard");
});

// ==================== UPDATE USER INFO ====================
function updateUserInfo() {
    const usernameDisplay = document.getElementById("usernameDisplay");
    const userRole = document.getElementById("userRole");
    
    if (usernameDisplay) {
        usernameDisplay.textContent = currentUser.username || "User";
    }
    
    if (userRole) {
        let roleText = "مستخدم";
        if (currentUser.role === "Admin") roleText = "مدير النظام";
        else if (currentUser.role === "Staff") roleText = "موظف";
        else if (currentUser.role === "Student") roleText = "طالب";
        userRole.textContent = roleText;
    }
    
    // Hide elements based on role
    if (currentUser.role === "Student") {
        const studentsLink = document.querySelector('[data-page="students"]');
        const statsLink = document.querySelector('[data-page="statistics"]');
        if (studentsLink) studentsLink.style.display = "none";
        if (statsLink) statsLink.style.display = "none";
    }
}

// ==================== SETUP NAVIGATION ====================
function setupNavigation() {
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            if (!page) return;
            
            // Update active state
            document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
            this.classList.add("active");
            
            // Update title
            const pageTitle = document.getElementById("pageTitle");
            if (pageTitle) {
                const span = this.querySelector("span");
                if (span) pageTitle.textContent = span.textContent;
            }
            
            // Load page
            currentPage = page;
            loadPage(page);
        });
    });
}

// ==================== UI FUNCTIONS ====================
function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
        sidebar.classList.toggle("collapsed");
    }
}

function logout() {
    localStorage.removeItem("user");
    window.location.href = "index.html";
}

// ==================== PAGE LOADER ====================
function loadPage(page) {
    const body = document.getElementById("contentBody");
    if (!body) return;
    
    // Clear previous charts
    destroyCharts();
    
    switch(page) {
        case "dashboard":
            body.innerHTML = getDashboardHTML();
            setTimeout(() => loadDashboardData(), 100);
            break;
            
        case "students":
            body.innerHTML = getStudentsHTML();
            setTimeout(() => {
                loadStudentsData();
                setupStudentForm();
            }, 100);
            break;
            
        case "absences":
            body.innerHTML = getAbsencesHTML();
            setTimeout(() => {
                loadModulesAndStudents();
                loadAbsencesData();
                setupAbsenceForm();
            }, 100);
            break;
            
        case "statistics":
            body.innerHTML = getStatisticsHTML();
            setTimeout(() => loadStatisticsData(), 100);
            break;
            
        default:
            body.innerHTML = "<h2>الصفحة غير موجودة</h2>";
    }
}

// ==================== DESTROY CHARTS ====================
function destroyCharts() {
    if (absencesChart) {
        absencesChart.destroy();
        absencesChart = null;
    }
    if (modulesChart) {
        modulesChart.destroy();
        modulesChart = null;
    }
    if (monthlyChart) {
        monthlyChart.destroy();
        monthlyChart = null;
    }
}

// ==================== HTML TEMPLATES ====================
function getDashboardHTML() {
    return `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon blue">
                    <i class="fas fa-calendar-times"></i>
                </div>
                <div class="stat-info">
                    <h3>إجمالي الغيابات</h3>
                    <span class="stat-number" id="totalAbsences">0</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon orange">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="stat-info">
                    <h3>تبريرات قيد الانتظار</h3>
                    <span class="stat-number" id="pendingJustifications">0</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="stat-info">
                    <h3>تبريرات مقبولة</h3>
                    <span class="stat-number" id="approvedJustifications">0</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon red">
                    <i class="fas fa-redo-alt"></i>
                </div>
                <div class="stat-info">
                    <h3>مسموح بالاستدراك</h3>
                    <span class="stat-number" id="eligibleStudents">0</span>
                </div>
            </div>
        </div>
        <div class="chart-container">
            <canvas id="absencesChart"></canvas>
        </div>
    `;
}

function getStudentsHTML() {
    return `
        <div class="form-container">
            <h3>➕ إضافة طالب جديد</h3>
            <form id="studentForm" onsubmit="return false;">
                <div class="form-group">
                    <label>الاسم الكامل</label>
                    <input type="text" id="studentName" placeholder="أحمد محمد" required>
                </div>
                <div class="form-group">
                    <label>البريد الإلكتروني</label>
                    <input type="email" id="studentEmail" placeholder="ahmed@univ.edu" required>
                </div>
                <div class="form-group">
                    <label>التخصص</label>
                    <input type="text" id="studentMajor" placeholder="علوم الحاسب" required>
                </div>
                <div class="form-group">
                    <label>السنة الدراسية</label>
                    <input type="number" id="studentYear" min="1" max="5" value="1" required>
                </div>
                <button type="submit" class="btn-primary">إضافة الطالب</button>
            </form>
        </div>
        
        <div class="table-container">
            <h3>📋 قائمة الطلاب</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>رقم الطالب</th>
                        <th>الاسم</th>
                        <th>البريد الإلكتروني</th>
                        <th>التخصص</th>
                        <th>السنة</th>
                    </tr>
                </thead>
                <tbody id="studentsTableBody">
                    <tr><td colspan="5">جاري التحميل...</td></tr>
                </tbody>
            </table>
        </div>
    `;
}

function getAbsencesHTML() {
    return `
        <div class="form-container">
            <h3>📝 تسجيل غياب جديد</h3>
            <form id="absenceForm" onsubmit="return false;">
                <div class="form-group">
                    <label>الطالب</label>
                    <select id="studentId" required>
                        <option value="">اختر الطالب...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>المادة</label>
                    <select id="moduleId" required>
                        <option value="">اختر المادة...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>تاريخ الامتحان</label>
                    <input type="date" id="examDate" required>
                </div>
                <div class="form-group">
                    <label>السبب (اختياري)</label>
                    <textarea id="reason" placeholder="اذكر سبب الغياب..."></textarea>
                </div>
                <button type="submit" class="btn-primary">تسجيل الغياب</button>
            </form>
        </div>
        
        <div class="table-container">
            <h3>📋 سجل الغيابات</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>رقم الغياب</th>
                        <th>الطالب</th>
                        <th>المادة</th>
                        <th>التاريخ</th>
                        <th>الحالة</th>
                    </tr>
                </thead>
                <tbody id="absencesTableBody">
                    <tr><td colspan="5">جاري التحميل...</td></tr>
                </tbody>
            </table>
        </div>
    `;
}

function getStatisticsHTML() {
    return `
        <div class="charts-grid">
            <div class="chart-card">
                <h3>نسبة الغياب حسب المقياس</h3>
                <canvas id="modulesChart"></canvas>
            </div>
            <div class="chart-card">
                <h3>الغيابات الشهرية</h3>
                <canvas id="monthlyChart"></canvas>
            </div>
        </div>
        <div class="table-container">
            <h3>📊 تفاصيل الإحصائيات</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>المقياس</th>
                        <th>عدد الغيابات</th>
                        <th>النسبة</th>
                    </tr>
                </thead>
                <tbody id="statsTableBody">
                    <tr><td colspan="3">جاري التحميل...</td></tr>
                </tbody>
            </table>
        </div>
    `;
}

// ==================== LOAD DASHBOARD DATA ====================
function loadDashboardData() {
    callAppsScript({
        action: "getStatistics",
        username: currentUser.username,
        password: currentUser.password
    }, function(res) {
        if (!res || !res.success) {
            console.error("Failed to load dashboard data");
            return;
        }
        
        const stats = res.statistics || {};
        
        // Update stats
        setElementText("totalAbsences", stats.totalAbsences || 0);
        setElementText("pendingJustifications", stats.pendingJustifications || 0);
        setElementText("approvedJustifications", stats.approvedJustifications || 0);
        setElementText("eligibleStudents", stats.eligibleStudents || 0);
        
        // Create chart
        setTimeout(() => {
            const canvas = document.getElementById("absencesChart");
            if (!canvas) return;
            
            const ctx = canvas.getContext("2d");
            if (absencesChart) absencesChart.destroy();
            
            const topModules = stats.topModules || [];
            if (topModules.length === 0) return;
            
            absencesChart = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: topModules.map(m => m.moduleName || "غير معروف"),
                    datasets: [{
                        label: "عدد الغيابات",
                        data: topModules.map(m => m.count || 0),
                        backgroundColor: "rgba(102, 126, 234, 0.7)",
                        borderColor: "rgb(102, 126, 234)",
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { stepSize: 1 }
                        }
                    }
                }
            });
        }, 200);
    });
}

// ==================== LOAD STUDENTS DATA ====================
function loadStudentsData() {
    callAppsScript({
        action: "getStudents",
        username: currentUser.username,
        password: currentUser.password
    }, function(res) {
        const tbody = document.getElementById("studentsTableBody");
        if (!tbody) return;
        
        if (!res || !res.success || !res.students) {
            tbody.innerHTML = `<tr><td colspan="5">خطأ في تحميل البيانات</td></tr>`;
            return;
        }
        
        if (res.students.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5">لا يوجد طلاب</td></tr>`;
            return;
        }
        
        let html = "";
        res.students.forEach(s => {
            html += `
                <tr>
                    <td>${s.studentId || "-"}</td>
                    <td>${s.name || "-"}</td>
                    <td>${s.email || "-"}</td>
                    <td>${s.major || "-"}</td>
                    <td>${s.year || "-"}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    });
}

// ==================== LOAD ABSENCES DATA ====================
function loadAbsencesData() {
    callAppsScript({
        action: "getAbsences",
        username: currentUser.username,
        password: currentUser.password
    }, function(res) {
        const tbody = document.getElementById("absencesTableBody");
        if (!tbody) return;
        
        if (!res || !res.success || !res.absences) {
            tbody.innerHTML = `<tr><td colspan="5">خطأ في تحميل البيانات</td></tr>`;
            return;
        }
        
        if (res.absences.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5">لا يوجد غيابات</td></tr>`;
            return;
        }
        
        let html = "";
        res.absences.forEach(a => {
            const statusClass = a.status === "Approved" ? "status-approved" : 
                              a.status === "Rejected" ? "status-rejected" : "status-pending";
            const statusText = a.status === "Approved" ? "مقبول" :
                              a.status === "Rejected" ? "مرفوض" : "قيد الانتظار";
            
            html += `
                <tr>
                    <td>${a.absenceId || "-"}</td>
                    <td>${a.studentId || "-"}</td>
                    <td>${a.moduleId || "-"}</td>
                    <td>${a.examDate || "-"}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    });
}

// ==================== LOAD STATISTICS DATA ====================
function loadStatisticsData() {
    callAppsScript({
        action: "getStatistics",
        username: currentUser.username,
        password: currentUser.password
    }, function(res) {
        if (!res || !res.success) {
            console.error("Failed to load statistics");
            return;
        }
        
        const stats = res.statistics || {};
        const topModules = stats.topModules || [];
        
        // Modules pie chart
        setTimeout(() => {
            const canvas1 = document.getElementById("modulesChart");
            if (canvas1 && topModules.length > 0) {
                const ctx1 = canvas1.getContext("2d");
                if (modulesChart) modulesChart.destroy();
                
                modulesChart = new Chart(ctx1, {
                    type: "pie",
                    data: {
                        labels: topModules.map(m => m.moduleName || "غير معروف"),
                        datasets: [{
                            data: topModules.map(m => m.count || 0),
                            backgroundColor: [
                                "#667eea", "#2ecc71", "#f1c40f", 
                                "#e74c3c", "#9b59b6", "#3498db"
                            ]
                        }]
                    }
                });
            }
            
            // Monthly line chart
            const months = Object.keys(stats.absencesByMonth || {});
            const counts = Object.values(stats.absencesByMonth || {});
            
            const canvas2 = document.getElementById("monthlyChart");
            if (canvas2 && months.length > 0) {
                const ctx2 = canvas2.getContext("2d");
                if (monthlyChart) monthlyChart.destroy();
                
                monthlyChart = new Chart(ctx2, {
                    type: "line",
                    data: {
                        labels: months,
                        datasets: [{
                            label: "عدد الغيابات",
                            data: counts,
                            borderColor: "#667eea",
                            tension: 0.1,
                            fill: false
                        }]
                    }
                });
            }
        }, 200);
        
        // Stats table
        const tbody = document.getElementById("statsTableBody");
        if (tbody) {
            if (topModules.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3">لا توجد بيانات</td></tr>`;
                return;
            }
            
            let html = "";
            const total = stats.totalAbsences || 1;
            topModules.forEach(m => {
                const count = m.count || 0;
                const percentage = ((count / total) * 100).toFixed(1);
                html += `
                    <tr>
                        <td>${m.moduleName || "-"}</td>
                        <td>${count}</td>
                        <td>${percentage}%</td>
                    </tr>
                `;
            });
            
            tbody.innerHTML = html;
        }
    });
}

// ==================== LOAD MODULES AND STUDENTS FOR SELECTS ====================
function loadModulesAndStudents() {
    // Load modules
    callAppsScript({
        action: "getModules",
        username: currentUser.username,
        password: currentUser.password
    }, function(res) {
        const moduleSelect = document.getElementById("moduleId");
        if (!moduleSelect) return;
        
        if (!res || !res.success || !res.modules) {
            moduleSelect.innerHTML = '<option value="">خطأ في التحميل</option>';
            return;
        }
        
        let options = '<option value="">اختر المادة...</option>';
        res.modules.forEach(m => {
            options += `<option value="${m.moduleId || ""}">${m.moduleName || "غير معروف"}</option>`;
        });
        
        moduleSelect.innerHTML = options;
    });
    
    // Load students
    callAppsScript({
        action: "getStudents",
        username: currentUser.username,
        password: currentUser.password
    }, function(res) {
        const studentSelect = document.getElementById("studentId");
        if (!studentSelect) return;
        
        if (!res || !res.success || !res.students) {
            studentSelect.innerHTML = '<option value="">خطأ في التحميل</option>';
            return;
        }
        
        let options = '<option value="">اختر الطالب...</option>';
        res.students.forEach(s => {
            options += `<option value="${s.studentId || ""}">${s.name || "غير معروف"}</option>`;
        });
        
        studentSelect.innerHTML = options;
    });
}

// ==================== SETUP STUDENT FORM ====================
function setupStudentForm() {
    const form = document.getElementById("studentForm");
    if (!form) return;
    
    form.addEventListener("submit", function(e) {
        e.preventDefault();
        
        const name = document.getElementById("studentName");
        const email = document.getElementById("studentEmail");
        const major = document.getElementById("studentMajor");
        const year = document.getElementById("studentYear");
        
        if (!name.value || !email.value || !major.value || !year.value) {
            alert("❌ الرجاء ملء جميع الحقول");
            return;
        }
        
        const studentData = {
            action: "addStudent",
            username: currentUser.username,
            password: currentUser.password,
            name: name.value,
            email: email.value,
            major: major.value,
            year: year.value
        };
        
        callAppsScript(studentData, function(res) {
            if (res && res.success) {
                alert("✅ تم إضافة الطالب بنجاح");
                name.value = "";
                email.value = "";
                major.value = "";
                year.value = "1";
                loadStudentsData();
            } else {
                alert("❌ فشل إضافة الطالب: " + (res?.message || "خطأ غير معروف"));
            }
        });
    });
}

// ==================== SETUP ABSENCE FORM ====================
function setupAbsenceForm() {
    const form = document.getElementById("absenceForm");
    if (!form) return;
    
    form.addEventListener("submit", function(e) {
        e.preventDefault();
        
        const studentId = document.getElementById("studentId");
        const moduleId = document.getElementById("moduleId");
        const examDate = document.getElementById("examDate");
        
        if (!studentId.value || !moduleId.value || !examDate.value) {
            alert("❌ الرجاء اختيار الطالب والمادة وتاريخ الامتحان");
            return;
        }
        
        const reason = document.getElementById("reason");
        
        const absenceData = {
            action: "addAbsence",
            username: currentUser.username,
            password: currentUser.password,
            studentId: studentId.value,
            moduleId: moduleId.value,
            examDate: examDate.value,
            reason: reason ? reason.value : ""
        };
        
        callAppsScript(absenceData, function(res) {
            if (res && res.success) {
                alert("✅ تم تسجيل الغياب بنجاح");
                studentId.value = "";
                moduleId.value = "";
                examDate.value = "";
                if (reason) reason.value = "";
                loadAbsencesData();
            } else {
                alert("❌ فشل تسجيل الغياب: " + (res?.message || "خطأ غير معروف"));
            }
        });
    });
}

// ==================== HELPER FUNCTIONS ====================
function setElementText(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value;
    }
}
