// ==================== الرابط الرئيسي ====================
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyo1vB4L2y25qAggxXw3AG-XnCPQI39WwS1amuAPIDuPJkTjPzmM1zrz-RSSZaF5B24/exec';

// ==================== متغيرات عامة ====================
let currentUser = null;
let currentPage = 'dashboard';

// ==================== دالة JSONP الموحدة ====================
function callAppsScript(data, callback) {
    const callbackName = 'cb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // تحويل البيانات إلى نص الاستعلام
    const queryString = Object.keys(data).map(key => {
        const value = typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key];
        return encodeURIComponent(key) + '=' + encodeURIComponent(value);
    }).join('&');
    
    const url = APPS_SCRIPT_URL + '?callback=' + callbackName + '&' + queryString;
    
    // إنشاء دالة الكولباك
    window[callbackName] = function(response) {
        if (document.getElementById(callbackName + '_script')) {
            document.head.removeChild(document.getElementById(callbackName + '_script'));
        }
        delete window[callbackName];
        callback(response);
    };
    
    // إنشاء عنصر script
    const script = document.createElement('script');
    script.id = callbackName + '_script';
    script.src = url;
    
    script.onerror = function() {
        // فقط سجل الخطأ في الكونسول ولا تظهر alert تلقائي
        console.error('❌ فشل الاتصال بالخادم:', url);
        if (document.getElementById(callbackName + '_script')) {
            document.head.removeChild(document.getElementById(callbackName + '_script'));
        }
        delete window[callbackName];
        callback({ success: false, message: 'فشل الاتصال' });
    };
    
    document.head.appendChild(script);
}

// ==================== التحقق من تسجيل الدخول ====================
document.addEventListener('DOMContentLoaded', function() {
    const userData = localStorage.getItem('user');
    
    // إذا كان في صفحة تسجيل الدخول، لا تفعل شيء
    if (window.location.href.includes('index.html')) {
        return;
    }
    
    // إذا كان في صفحة dashboard ولم يسجل الدخول، ارجع لتسجيل الدخول
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = JSON.parse(userData);
    
    // تحديث معلومات المستخدم
    const usernameDisplay = document.getElementById('usernameDisplay');
    const userRole = document.getElementById('userRole');
    if (usernameDisplay) usernameDisplay.textContent = currentUser.username;
    if (userRole) {
        userRole.textContent = currentUser.role === 'Admin' ? 'مدير النظام' :
                              currentUser.role === 'Staff' ? 'موظف' : 'طالب';
    }
    
    // إخفاء العناصر حسب الصلاحيات
    if (currentUser.role === 'Student') {
        const studentsLink = document.querySelector('[data-page="students"]');
        const statsLink = document.querySelector('[data-page="statistics"]');
        if (studentsLink) studentsLink.style.display = 'none';
        if (statsLink) statsLink.style.display = 'none';
    }
    
    // إضافة مستمعات الأحداث للقائمة
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            
            // تحديث الشكل
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            this.classList.add('active');
            
            // تحديث العنوان
            const pageTitle = document.getElementById('pageTitle');
            if (pageTitle) pageTitle.textContent = this.querySelector('span').textContent;
            
            // تحميل الصفحة
            currentPage = page;
            loadPage(page);
        });
    });
    
    // تحميل الصفحة الرئيسية
    loadPage('dashboard');
});

// ==================== دوال مساعدة ====================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// ==================== تحميل الصفحات ====================
function loadPage(page) {
    const contentBody = document.getElementById('contentBody');
    if (!contentBody) return;
    
    switch(page) {
        case 'dashboard':
            contentBody.innerHTML = getDashboardHTML();
            loadDashboardData();
            break;
        case 'absences':
            contentBody.innerHTML = getAbsencesHTML();
            loadAbsencesData();
            loadModulesAndStudents();
            break;
        case 'justifications':
            contentBody.innerHTML = getJustificationsHTML();
            loadJustificationsData();
            break;
        case 'students':
            contentBody.innerHTML = getStudentsHTML();
            loadStudentsData();
            break;
        case 'retake':
            contentBody.innerHTML = getRetakeHTML();
            loadRetakeData();
            break;
        case 'statistics':
            contentBody.innerHTML = getStatisticsHTML();
            loadStatisticsData();
            break;
    }
}

// ==================== HTML القوالب ====================
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
                    <h3>مسموح لهم بالاستدراك</h3>
                    <span class="stat-number" id="eligibleStudents">0</span>
                </div>
            </div>
        </div>
        <div class="charts-grid">
            <div class="chart-card">
                <h3>أكثر المقاييس غيابات</h3>
                <canvas id="absencesChart"></canvas>
            </div>
        </div>
    `;
}

function getAbsencesHTML() {
    return `
        <div class="form-container" style="margin-bottom: 20px;">
            <h3>تسجيل غياب جديد</h3>
            <form id="absenceForm" onsubmit="addAbsence(event)">
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
                    <textarea id="reason"></textarea>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-primary">تسجيل الغياب</button>
                </div>
            </form>
        </div>
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>رقم الغياب</th>
                        <th>الطالب</th>
                        <th>المادة</th>
                        <th>تاريخ الامتحان</th>
                        <th>الحالة</th>
                        <th>إجراءات</th>
                    </tr>
                </thead>
                <tbody id="absencesTableBody"></tbody>
            </table>
        </div>
    `;
}

function getStudentsHTML() {
    return `
        <div class="form-container" style="margin-bottom: 20px;">
            <h3>إضافة طالب جديد</h3>
            <form id="studentForm" onsubmit="addStudent(event)">
                <div class="form-group">
                    <label>الاسم الكامل</label>
                    <input type="text" id="studentName" required>
                </div>
                <div class="form-group">
                    <label>البريد الإلكتروني</label>
                    <input type="email" id="studentEmail" required>
                </div>
                <div class="form-group">
                    <label>التخصص</label>
                    <input type="text" id="studentMajor" required>
                </div>
                <div class="form-group">
                    <label>السنة الدراسية</label>
                    <input type="number" id="studentYear" min="1" max="5" required>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-primary">إضافة طالب</button>
                </div>
            </form>
        </div>
        <div class="table-container">
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
                <tbody id="studentsTableBody"></tbody>
            </table>
        </div>
    `;
}

function getRetakeHTML() {
    return `
        <div class="form-container" style="margin-bottom: 20px;">
            <h3>إنشاء امتحان استدراك</h3>
            <form id="retakeForm" onsubmit="createRetakeExam(event)">
                <div class="form-group">
                    <label>الطالب</label>
                    <select id="retakeStudentId" required>
                        <option value="">اختر الطالب...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>المادة</label>
                    <select id="retakeModuleId" required>
                        <option value="">اختر المادة...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>تاريخ الامتحان</label>
                    <input type="datetime-local" id="retakeDate" required>
                </div>
                <div class="form-group">
                    <label>القاعة</label>
                    <input type="text" id="retakeRoom" required>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-primary">إنشاء الامتحان</button>
                </div>
            </form>
        </div>
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>رقم الاستدراك</th>
                        <th>الطالب</th>
                        <th>المادة</th>
                        <th>التاريخ</th>
                        <th>القاعة</th>
                    </tr>
                </thead>
                <tbody id="retakeTableBody"></tbody>
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
        <div class="table-container" style="margin-top: 20px;">
            <h3>تفاصيل الإحصائيات</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>المقياس</th>
                        <th>عدد الغيابات</th>
                        <th>النسبة</th>
                    </tr>
                </thead>
                <tbody id="statsTableBody"></tbody>
            </table>
        </div>
    `;
}

// ==================== دوال تحميل البيانات ====================
function loadDashboardData() {
    callAppsScript({
        action: 'getStatistics',
        username: currentUser.username,
        password: currentUser.password
    }, function(response) {
        if (response && response.success) {
            document.getElementById('totalAbsences').textContent = response.statistics.totalAbsences;
            document.getElementById('pendingJustifications').textContent = response.statistics.pendingJustifications;
            document.getElementById('approvedJustifications').textContent = response.statistics.approvedJustifications;
            document.getElementById('eligibleStudents').textContent = response.statistics.approvedJustifications;
            
            // رسم بياني
            const ctx = document.getElementById('absencesChart')?.getContext('2d');
            if (ctx && response.statistics.topModules.length > 0) {
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: response.statistics.topModules.map(m => m.moduleName),
                        datasets: [{
                            label: 'عدد الغيابات',
                            data: response.statistics.topModules.map(m => m.count),
                            backgroundColor: 'rgba(102, 126, 234, 0.5)',
                            borderColor: 'rgba(102, 126, 234, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        scales: { y: { beginAtZero: true } }
                    }
                });
            }
        }
    });
}

function loadStudentsData() {
    callAppsScript({
        action: 'getStudents',
        username: currentUser.username,
        password: currentUser.password
    }, function(response) {
        if (response && response.success) {
            const tbody = document.getElementById('studentsTableBody');
            if (tbody) {
                tbody.innerHTML = '';
                response.students.forEach(student => {
                    tbody.innerHTML += `
                        <tr>
                            <td>${student.studentId}</td>
                            <td>${student.name}</td>
                            <td>${student.email}</td>
                            <td>${student.major}</td>
                            <td>${student.year}</td>
                        </tr>
                    `;
                });
            }
        }
    });
}

function loadAbsencesData() {
    callAppsScript({
        action: 'getAbsences',
        username: currentUser.username,
        password: currentUser.password
    }, function(response) {
        if (response && response.success) {
            const tbody = document.getElementById('absencesTableBody');
            if (tbody) {
                tbody.innerHTML = '';
                response.absences.forEach(absence => {
                    tbody.innerHTML += `
                        <tr>
                            <td>${absence.absenceId}</td>
                            <td>${absence.studentId}</td>
                            <td>${absence.moduleId}</td>
                            <td>${absence.examDate}</td>
                            <td>
                                <span class="status-badge status-${absence.status.toLowerCase()}">
                                    ${absence.status === 'Pending' ? 'قيد الانتظار' :
                                      absence.status === 'Approved' ? 'مقبول' : 'مرفوض'}
                                </span>
                            </td>
                            <td>
                                ${currentUser.role !== 'Student' && absence.status === 'Pending' ?
                                    `<button class="action-btn btn-approve" onclick="updateAbsenceStatus('${absence.absenceId}', 'Approved')">
                                        <i class="fas fa-check"></i>
                                    </button>
                                    <button class="action-btn btn-reject" onclick="updateAbsenceStatus('${absence.absenceId}', 'Rejected')">
                                        <i class="fas fa-times"></i>
                                    </button>` : ''}
                            </td>
                        </tr>
                    `;
                });
            }
        }
    });
}

function loadJustificationsData() {
    callAppsScript({
        action: 'getAbsences',
        username: currentUser.username,
        password: currentUser.password
    }, function(response) {
        if (response && response.success) {
            const tbody = document.getElementById('justificationsTableBody');
            if (tbody) {
                tbody.innerHTML = '';
                response.absences.filter(a => a.justificationFile).forEach(absence => {
                    tbody.innerHTML += `
                        <tr>
                            <td>${absence.absenceId}</td>
                            <td>${absence.studentId}</td>
                            <td>${absence.moduleId}</td>
                            <td>${absence.examDate}</td>
                            <td>${absence.reason || 'لا يوجد'}</td>
                            <td>
                                <button class="action-btn btn-view" onclick="window.open('${absence.justificationFile}')">
                                    <i class="fas fa-eye"></i> عرض
                                </button>
                            </td>
                            <td>
                                <span class="status-badge status-${absence.status.toLowerCase()}">
                                    ${absence.status === 'Pending' ? 'قيد الانتظار' :
                                      absence.status === 'Approved' ? 'مقبول' : 'مرفوض'}
                                </span>
                            </td>
                            <td>
                                ${currentUser.role !== 'Student' && absence.status === 'Pending' ?
                                    `<button class="action-btn btn-approve" onclick="updateAbsenceStatus('${absence.absenceId}', 'Approved')">
                                        <i class="fas fa-check"></i> قبول
                                    </button>
                                    <button class="action-btn btn-reject" onclick="updateAbsenceStatus('${absence.absenceId}', 'Rejected')">
                                        <i class="fas fa-times"></i> رفض
                                    </button>` : ''}
                            </td>
                        </tr>
                    `;
                });
            }
        }
    });
}

function loadModulesAndStudents() {
    // تحميل المواد
    callAppsScript({
        action: 'getModules',
        username: currentUser.username,
        password: currentUser.password
    }, function(response) {
        if (response && response.success) {
            const moduleSelect = document.getElementById('moduleId');
            if (moduleSelect) {
                moduleSelect.innerHTML = '<option value="">اختر المادة...</option>';
                response.modules.forEach(module => {
                    moduleSelect.innerHTML += `<option value="${module.moduleId}">${module.moduleName}</option>`;
                });
            }
        }
    });
    
    // تحميل الطلاب
    callAppsScript({
        action: 'getStudents',
        username: currentUser.username,
        password: currentUser.password
    }, function(response) {
        if (response && response.success) {
            const studentSelect = document.getElementById('studentId');
            if (studentSelect) {
                studentSelect.innerHTML = '<option value="">اختر الطالب...</option>';
                response.students.forEach(student => {
                    studentSelect.innerHTML += `<option value="${student.studentId}">${student.name}</option>`;
                });
            }
        }
    });
}

function loadRetakeData() {
    // تحميل المواد
    callAppsScript({
        action: 'getModules',
        username: currentUser.username,
        password: currentUser.password
    }, function(response) {
        if (response && response.success) {
            const moduleSelect = document.getElementById('retakeModuleId');
            if (moduleSelect) {
                moduleSelect.innerHTML = '<option value="">اختر المادة...</option>';
                response.modules.forEach(module => {
                    moduleSelect.innerHTML += `<option value="${module.moduleId}">${module.moduleName}</option>`;
                });
            }
        }
    });
    
    // تحميل الطلاب
    callAppsScript({
        action: 'getStudents',
        username: currentUser.username,
        password: currentUser.password
    }, function(response) {
        if (response && response.success) {
            const studentSelect = document.getElementById('retakeStudentId');
            if (studentSelect) {
                studentSelect.innerHTML = '<option value="">اختر الطالب...</option>';
                response.students.forEach(student => {
                    studentSelect.innerHTML += `<option value="${student.studentId}">${student.name}</option>`;
                });
            }
        }
    });
}

function loadStatisticsData() {
    callAppsScript({
        action: 'getStatistics',
        username: currentUser.username,
        password: currentUser.password
    }, function(response) {
        if (response && response.success) {
            // رسم بياني للمقاييس
            const ctx1 = document.getElementById('modulesChart')?.getContext('2d');
            if (ctx1 && response.statistics.topModules.length > 0) {
                new Chart(ctx1, {
                    type: 'pie',
                    data: {
                        labels: response.statistics.topModules.map(m => m.moduleName),
                        datasets: [{
                            data: response.statistics.topModules.map(m => m.count),
                            backgroundColor: ['#667eea', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6']
                        }]
                    }
                });
            }
            
            // رسم بياني للشهور
            const months = Object.keys(response.statistics.absencesByMonth);
            const counts = Object.values(response.statistics.absencesByMonth);
            const ctx2 = document.getElementById('monthlyChart')?.getContext('2d');
            if (ctx2 && months.length > 0) {
                new Chart(ctx2, {
                    type: 'line',
                    data: {
                        labels: months,
                        datasets: [{
                            label: 'عدد الغيابات',
                            data: counts,
                            borderColor: '#667eea',
                            tension: 0.1
                        }]
                    }
                });
            }
            
            // جدول التفاصيل
            const tbody = document.getElementById('statsTableBody');
            if (tbody) {
                tbody.innerHTML = '';
                response.statistics.topModules.forEach(module => {
                    const percentage = ((module.count / response.statistics.totalAbsences) * 100).toFixed(1);
                    tbody.innerHTML += `
                        <tr>
                            <td>${module.moduleName}</td>
                            <td>${module.count}</td>
                            <td>${percentage}%</td>
                        </tr>
                    `;
                });
            }
        }
    });
}

// ==================== دوال الإجراءات ====================
function addStudent(event) {
    event.preventDefault();
    
    const studentData = {
        action: 'addStudent',
        username: currentUser.username,
        password: currentUser.password,
        name: document.getElementById('studentName').value,
        email: document.getElementById('studentEmail').value,
        major: document.getElementById('studentMajor').value,
        year: document.getElementById('studentYear').value
    };
    
    callAppsScript(studentData, function(response) {
        if (response && response.success) {
            alert('✅ تم إضافة الطالب بنجاح');
            document.getElementById('studentForm').reset();
            loadPage('students');
        } else {
            alert('❌ خطأ: ' + (response?.message || 'فشل إضافة الطالب'));
        }
    });
}

function addAbsence(event) {
    event.preventDefault();
    
    const absenceData = {
        action: 'addAbsence',
        username: currentUser.username,
        password: currentUser.password,
        studentId: document.getElementById('studentId').value,
        moduleId: document.getElementById('moduleId').value,
        examDate: document.getElementById('examDate').value,
        reason: document.getElementById('reason').value
    };
    
    callAppsScript(absenceData, function(response) {
        if (response && response.success) {
            alert('✅ تم تسجيل الغياب بنجاح');
            document.getElementById('absenceForm').reset();
            loadPage('absences');
        } else {
            alert('❌ خطأ: ' + (response?.message || 'فشل تسجيل الغياب'));
        }
    });
}

function createRetakeExam(event) {
    event.preventDefault();
    
    const retakeData = {
        action: 'createRetakeExam',
        username: currentUser.username,
        password: currentUser.password,
        studentId: document.getElementById('retakeStudentId').value,
        moduleId: document.getElementById('retakeModuleId').value,
        retakeDate: document.getElementById('retakeDate').value,
        room: document.getElementById('retakeRoom').value
    };
    
    callAppsScript(retakeData, function(response) {
        if (response && response.success) {
            alert('✅ تم إنشاء امتحان الاستدراك بنجاح');
            document.getElementById('retakeForm').reset();
            loadPage('retake');
        } else {
            alert('❌ خطأ: ' + (response?.message || 'فشل إنشاء الامتحان'));
        }
    });
}

function updateAbsenceStatus(absenceId, status) {
    const statusData = {
        action: 'updateAbsenceStatus',
        username: currentUser.username,
        password: currentUser.password,
        absenceId: absenceId,
        status: status
    };
    
    callAppsScript(statusData, function(response) {
        if (response && response.success) {
            alert('✅ تم تحديث الحالة بنجاح');
            loadPage(currentPage);
        } else {
            alert('❌ خطأ: ' + (response?.message || 'فشل تحديث الحالة'));
        }
    });
}
