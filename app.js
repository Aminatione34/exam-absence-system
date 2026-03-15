// دالة JSONP للاتصال بـ Apps Script
function jsonpRequest(data, callback) {
    const callbackName = 'callback' + Date.now();
    
    // تحويل البيانات إلى query string
    const queryString = Object.keys(data).map(key => {
        const value = typeof data[key] === 'object' ? 
            JSON.stringify(data[key]) : data[key];
        return encodeURIComponent(key) + '=' + encodeURIComponent(value);
    }).join('&');
    
    const url = APPS_SCRIPT_URL + '?callback=' + callbackName + '&' + queryString;
    
    // إنشاء دالة الكولباك
    window[callbackName] = function(response) {
        if (document.head.contains(script)) {
            document.head.removeChild(script);
        }
        delete window[callbackName];
        callback(response);
    };
    
    // إنشاء عنصر script وإضافته
    const script = document.createElement('script');
    script.src = url;
    script.onerror = function() {
        alert('❌ فشل الاتصال بالخادم');
        if (document.head.contains(script)) {
            document.head.removeChild(script);
        }
        delete window[callbackName];
    };
    document.head.appendChild(script);
}

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwvlyXwWbG8y82x4LQOtvrolcP1fAcuZQxrqOI1XuZ2wYkc9r5df6n7Fe1QeQ1sUmET/exec';
let currentUser = null;
let currentPage = 'dashboard';

// تهيئة التطبيق
document.addEventListener('DOMContentLoaded', function() {
    // التحقق من تسجيل الدخول
    const userData = localStorage.getItem('user');
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = JSON.parse(userData);
    updateUI();
    loadPage('dashboard');
    
    // أحداث التنقل
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            setActiveNav(this);
            loadPage(page);
        });
    });
});

// تحديث واجهة المستخدم
function updateUI() {
    if (currentUser) {
        document.getElementById('usernameDisplay').textContent = currentUser.username;
        document.getElementById('userRole').textContent = 
            currentUser.role === 'Admin' ? 'مدير النظام' :
            currentUser.role === 'Staff' ? 'موظف' : 'طالب';
        
        // إخفاء العناصر حسب الصلاحيات
        if (currentUser.role === 'Student') {
            document.querySelector('[data-page="students"]').style.display = 'none';
            document.querySelector('[data-page="statistics"]').style.display = 'none';
        }
    }
}

// تبديل الشريط الجانبي
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

// تسجيل الخروج
function logout() {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// تعيين العنصر النشط في القائمة
function setActiveNav(activeItem) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    activeItem.classList.add('active');
    currentPage = activeItem.dataset.page;
    document.getElementById('pageTitle').textContent = activeItem.querySelector('span').textContent;
}

// تحميل الصفحة المطلوبة
function loadPage(page) {
    const contentBody = document.getElementById('contentBody');
    
    switch(page) {
        case 'dashboard':
            contentBody.innerHTML = getDashboardHTML();
            loadDashboardData();
            break;
        case 'absences':
            contentBody.innerHTML = getAbsencesHTML();
            loadAbsencesData();
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

// دوال إنشاء HTML للصفحات
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

function getJustificationsHTML() {
    return `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>رقم الغياب</th>
                        <th>الطالب</th>
                        <th>المادة</th>
                        <th>التاريخ</th>
                        <th>السبب</th>
                        <th>ملف التبرير</th>
                        <th>الحالة</th>
                        <th>إجراءات</th>
                    </tr>
                </thead>
                <tbody id="justificationsTableBody"></tbody>
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

// ==================== دوال تحميل البيانات باستخدام JSONP ====================

// تحميل بيانات لوحة التحكم
function loadDashboardData() {
    const data = {
        action: 'getStatistics',
        username: currentUser.username,
        password: currentUser.password
    };
    
    jsonpRequest(data, function(response) {
        console.log('📥 إحصائيات:', response);
        
        if (response && response.success) {
            document.getElementById('totalAbsences').textContent = response.statistics.totalAbsences;
            document.getElementById('pendingJustifications').textContent = response.statistics.pendingJustifications;
            document.getElementById('approvedJustifications').textContent = response.statistics.approvedJustifications;
            document.getElementById('eligibleStudents').textContent = response.statistics.approvedJustifications;
            
            // رسم بياني
            const ctx = document.getElementById('absencesChart').getContext('2d');
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
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    });
}

// تحميل بيانات الغيابات
function loadAbsencesData() {
    const data = {
        action: 'getAbsences',
        username: currentUser.username,
        password: currentUser.password
    };
    
    jsonpRequest(data, function(response) {
        console.log('📥 الغيابات:', response);
        
        if (response && response.success) {
            const tbody = document.getElementById('absencesTableBody');
            tbody.innerHTML = '';
            
            response.absences.forEach(absence => {
                const row = tbody.insertRow();
                row.innerHTML = `
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
                `;
            });
        }
        
        // تحميل البيانات للقوائم المنسدلة
        loadModulesForSelect();
    });
}

// تحميل بيانات التبريرات
function loadJustificationsData() {
    const data = {
        action: 'getAbsences',
        username: currentUser.username,
        password: currentUser.password
    };
    
    jsonpRequest(data, function(response) {
        console.log('📥 التبريرات:', response);
        
        if (response && response.success) {
            const tbody = document.getElementById('justificationsTableBody');
            tbody.innerHTML = '';
            
            response.absences.filter(a => a.justificationFile).forEach(absence => {
                const row = tbody.insertRow();
                row.innerHTML = `
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
                `;
            });
        }
    });
}

// تحميل بيانات الطلاب
function loadStudentsData() {
    const data = {
        action: 'getStudents',
        username: currentUser.username,
        password: currentUser.password
    };
    
    jsonpRequest(data, function(response) {
        console.log('📥 الطلاب:', response);
        
        if (response && response.success) {
            const tbody = document.getElementById('studentsTableBody');
            tbody.innerHTML = '';
            
            response.students.forEach(student => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${student.studentId}</td>
                    <td>${student.name}</td>
                    <td>${student.email}</td>
                    <td>${student.major}</td>
                    <td>${student.year}</td>
                `;
            });
        }
        
        // تحميل المواد للقوائم المنسدلة
        loadModulesForSelect();
    });
}

// تحميل بيانات الاستدراك
function loadRetakeData() {
    // تحميل المواد
    const modulesData = {
        action: 'getModules',
        username: currentUser.username,
        password: currentUser.password
    };
    
    jsonpRequest(modulesData, function(modulesResponse) {
        console.log('📥 المواد:', modulesResponse);
        
        if (modulesResponse && modulesResponse.success) {
            const moduleSelect = document.getElementById('retakeModuleId');
            if (moduleSelect) {
                moduleSelect.innerHTML = '<option value="">اختر المادة...</option>';
                modulesResponse.modules.forEach(module => {
                    moduleSelect.innerHTML += `<option value="${module.moduleId}">${module.moduleName}</option>`;
                });
            }
        }
    });
    
    // تحميل الطلاب
    const studentsData = {
        action: 'getStudents',
        username: currentUser.username,
        password: currentUser.password
    };
    
    jsonpRequest(studentsData, function(studentsResponse) {
        console.log('📥 الطلاب للاستدراك:', studentsResponse);
        
        if (studentsResponse && studentsResponse.success) {
            const studentSelect = document.getElementById('retakeStudentId');
            if (studentSelect) {
                studentSelect.innerHTML = '<option value="">اختر الطالب...</option>';
                studentsResponse.students.forEach(student => {
                    studentSelect.innerHTML += `<option value="${student.studentId}">${student.name}</option>`;
                });
            }
        }
    });
}

// تحميل بيانات الإحصائيات
function loadStatisticsData() {
    const data = {
        action: 'getStatistics',
        username: currentUser.username,
        password: currentUser.password
    };
    
    jsonpRequest(data, function(response) {
        console.log('📥 إحصائيات كاملة:', response);
        
        if (response && response.success) {
            // رسم بياني للمقاييس
            const ctx1 = document.getElementById('modulesChart').getContext('2d');
            new Chart(ctx1, {
                type: 'pie',
                data: {
                    labels: response.statistics.topModules.map(m => m.moduleName),
                    datasets: [{
                        data: response.statistics.topModules.map(m => m.count),
                        backgroundColor: [
                            '#667eea', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6'
                        ]
                    }]
                }
            });
            
            // رسم بياني للشهور
            const months = Object.keys(response.statistics.absencesByMonth);
            const counts = Object.values(response.statistics.absencesByMonth);
            
            const ctx2 = document.getElementById('monthlyChart').getContext('2d');
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
            
            // جدول التفاصيل
            const tbody = document.getElementById('statsTableBody');
            tbody.innerHTML = '';
            
            response.statistics.topModules.forEach(module => {
                const row = tbody.insertRow();
                const percentage = ((module.count / response.statistics.totalAbsences) * 100).toFixed(1);
                row.innerHTML = `
                    <td>${module.moduleName}</td>
                    <td>${module.count}</td>
                    <td>${percentage}%</td>
                `;
            });
        }
    });
}

// تحميل المواد للقوائم المنسدلة
function loadModulesForSelect() {
    const modulesData = {
        action: 'getModules',
        username: currentUser.username,
        password: currentUser.password
    };
    
    jsonpRequest(modulesData, function(modulesResponse) {
        if (modulesResponse && modulesResponse.success) {
            const moduleSelect = document.getElementById('moduleId');
            if (moduleSelect) {
                moduleSelect.innerHTML = '<option value="">اختر المادة...</option>';
                modulesResponse.modules.forEach(module => {
                    moduleSelect.innerHTML += `<option value="${module.moduleId}">${module.moduleName}</option>`;
                });
            }
        }
    });
    
    const studentsData = {
        action: 'getStudents',
        username: currentUser.username,
        password: currentUser.password
    };
    
    jsonpRequest(studentsData, function(studentsResponse) {
        if (studentsResponse && studentsResponse.success) {
            const studentSelect = document.getElementById('studentId');
            if (studentSelect) {
                studentSelect.innerHTML = '<option value="">اختر الطالب...</option>';
                studentsResponse.students.forEach(student => {
                    studentSelect.innerHTML += `<option value="${student.studentId}">${student.name}</option>`;
                });
            }
        }
    });
}

// ==================== دوال الإجراءات باستخدام JSONP ====================

// إضافة طالب
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
    
    console.log('📤 إرسال طالب:', studentData);
    
    jsonpRequest(studentData, function(response) {
        console.log('📥 رد الإضافة:', response);
        
        if (response && response.success) {
            alert('✅ تم إضافة الطالب بنجاح');
            
            // تفريغ الحقول
            document.getElementById('studentName').value = '';
            document.getElementById('studentEmail').value = '';
            document.getElementById('studentMajor').value = '';
            document.getElementById('studentYear').value = '';
            
            // إعادة تحميل قائمة الطلاب
            loadPage('students');
        } else {
            alert('❌ خطأ: ' + (response?.message || 'فشل إضافة الطالب'));
        }
    });
}

// تسجيل غياب
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
    
    console.log('📤 تسجيل غياب:', absenceData);
    
    jsonpRequest(absenceData, function(response) {
        console.log('📥 رد الغياب:', response);
        
        if (response && response.success) {
            alert('✅ تم تسجيل الغياب بنجاح');
            document.getElementById('absenceForm').reset();
            loadPage('absences');
        } else {
            alert('❌ خطأ: ' + (response?.message || 'فشل تسجيل الغياب'));
        }
    });
}

// إنشاء امتحان استدراك
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
    
    console.log('📤 إنشاء استدراك:', retakeData);
    
    jsonpRequest(retakeData, function(response) {
        console.log('📥 رد الاستدراك:', response);
        
        if (response && response.success) {
            alert('✅ تم إنشاء امتحان الاستدراك بنجاح');
            document.getElementById('retakeForm').reset();
            loadPage('retake');
        } else {
            alert('❌ خطأ: ' + (response?.message || 'فشل إنشاء الامتحان'));
        }
    });
}

// تحديث حالة الغياب
function updateAbsenceStatus(absenceId, status) {
    const statusData = {
        action: 'updateAbsenceStatus',
        username: currentUser.username,
        password: currentUser.password,
        absenceId: absenceId,
        status: status
    };
    
    console.log('📤 تحديث حالة:', statusData);
    
    jsonpRequest(statusData, function(response) {
        console.log('📥 رد التحديث:', response);
        
        if (response && response.success) {
            alert('✅ تم تحديث الحالة بنجاح');
            loadPage(currentPage);
        } else {
            alert('❌ خطأ: ' + (response?.message || 'فشل تحديث الحالة'));
        }
    });
}
