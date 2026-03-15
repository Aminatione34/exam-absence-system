// ==================== API URL ====================
const APPS_SCRIPT_URL =
'https://script.google.com/macros/s/AKfycbyo1vB4L2y25qAggxXw3AG-XnCPQI39WwS1amuAPIDuPJkTjPzmM1zrz-RSSZaF5B24/exec';

// ==================== GLOBAL ====================
let currentUser = null
let currentPage = "dashboard"

let absencesChart = null
let modulesChart = null
let monthlyChart = null

// ==================== APPS SCRIPT CALL ====================
function callAppsScript(data, callback){

const callbackName =
"cb_" + Date.now() + "_" + Math.random().toString(36).substr(2,9)

const query = Object.keys(data).map(key=>{

const value =
typeof data[key] === "object"
? JSON.stringify(data[key])
: data[key]

return encodeURIComponent(key)+"="+encodeURIComponent(value)

}).join("&")

const url =
APPS_SCRIPT_URL + "?callback=" + callbackName + "&" + query

const timeout = setTimeout(()=>{

console.error("Timeout request")
delete window[callbackName]

callback({
success:false,
message:"timeout"
})

},10000)

window[callbackName] = function(response){

clearTimeout(timeout)

const script =
document.getElementById(callbackName+"_script")

if(script){
document.head.removeChild(script)
}

delete window[callbackName]

callback(response)

}

const script = document.createElement("script")

script.id = callbackName+"_script"
script.src = url

script.onerror = function(){

console.error("Server error")

delete window[callbackName]

callback({
success:false,
message:"server error"
})

}

document.head.appendChild(script)

}

// ==================== LOGIN CHECK ====================
document.addEventListener("DOMContentLoaded",function(){

const userData = localStorage.getItem("user")

if(window.location.href.includes("index.html")){
return
}

if(!userData){
window.location.href = "index.html"
return
}

currentUser = JSON.parse(userData)

const usernameDisplay =
document.getElementById("usernameDisplay")

const userRole =
document.getElementById("userRole")

if(usernameDisplay)
usernameDisplay.textContent = currentUser.username

if(userRole){

userRole.textContent =
currentUser.role==="Admin" ? "مدير النظام" :
currentUser.role==="Staff" ? "موظف" :
"طالب"

}

if(currentUser.role==="Student"){

const studentsLink =
document.querySelector('[data-page="students"]')

const statsLink =
document.querySelector('[data-page="statistics"]')

if(studentsLink) studentsLink.style.display="none"
if(statsLink) statsLink.style.display="none"

}

document.querySelectorAll(".nav-item").forEach(item=>{

item.addEventListener("click",function(e){

e.preventDefault()

const page = this.dataset.page

document.querySelectorAll(".nav-item")
.forEach(n=>n.classList.remove("active"))

this.classList.add("active")

const pageTitle =
document.getElementById("pageTitle")

if(pageTitle)
pageTitle.textContent =
this.querySelector("span").textContent

currentPage = page

loadPage(page)

})

})

loadPage("dashboard")

})

// ==================== UI ====================
function toggleSidebar(){
document.getElementById("sidebar").classList.toggle("collapsed")
}

function logout(){
localStorage.removeItem("user")
window.location.href="index.html"
}

// ==================== PAGE LOADER ====================
function loadPage(page){

const body =
document.getElementById("contentBody")

if(!body) return

switch(page){

case "dashboard":

body.innerHTML = getDashboardHTML()
loadDashboardData()

break

case "students":

body.innerHTML = getStudentsHTML()
loadStudentsData()

break

case "absences":

body.innerHTML = getAbsencesHTML()
loadAbsencesData()
loadModulesAndStudents()

break

case "statistics":

body.innerHTML = getStatisticsHTML()
loadStatisticsData()

break

}

}

// ==================== HTML TEMPLATES ====================
function getDashboardHTML(){

return `

<div class="stats-grid">

<div class="stat-card">
<h3>إجمالي الغيابات</h3>
<span id="totalAbsences">0</span>
</div>

<div class="stat-card">
<h3>تبريرات قيد الانتظار</h3>
<span id="pendingJustifications">0</span>
</div>

<div class="stat-card">
<h3>تبريرات مقبولة</h3>
<span id="approvedJustifications">0</span>
</div>

<div class="stat-card">
<h3>طلاب الاستدراك</h3>
<span id="eligibleStudents">0</span>
</div>

</div>

<canvas id="absencesChart"></canvas>

`

}

function getStudentsHTML(){

return `

<form id="studentForm">

<input id="studentName" placeholder="name" required>
<input id="studentEmail" placeholder="email" required>
<input id="studentMajor" placeholder="major" required>
<input id="studentYear" type="number" required>

<button type="submit">إضافة</button>

</form>

<table>

<thead>
<tr>
<th>ID</th>
<th>Name</th>
<th>Email</th>
<th>Major</th>
<th>Year</th>
</tr>
</thead>

<tbody id="studentsTableBody"></tbody>

</table>

`

}

function getAbsencesHTML(){

return `

<form id="absenceForm">

<select id="studentId"></select>

<select id="moduleId"></select>

<input type="date" id="examDate">

<textarea id="reason"></textarea>

<button type="submit">تسجيل</button>

</form>

<table>

<thead>
<tr>
<th>ID</th>
<th>Student</th>
<th>Module</th>
<th>Date</th>
<th>Status</th>
</tr>
</thead>

<tbody id="absencesTableBody"></tbody>

</table>

`

}

function getStatisticsHTML(){

return `

<canvas id="modulesChart"></canvas>

<canvas id="monthlyChart"></canvas>

<table>
<tbody id="statsTableBody"></tbody>
</table>

`

}

// ==================== LOAD DASHBOARD ====================
function loadDashboardData(){

callAppsScript({

action:"getStatistics",
username:currentUser.username,
password:currentUser.password

},function(res){

if(!res || !res.success) return

const s = res.statistics

document.getElementById("totalAbsences").textContent =
s.totalAbsences || 0

document.getElementById("pendingJustifications").textContent =
s.pendingJustifications || 0

document.getElementById("approvedJustifications").textContent =
s.approvedJustifications || 0

document.getElementById("eligibleStudents").textContent =
s.eligibleStudents || 0

const canvas =
document.getElementById("absencesChart")

if(!canvas) return

const ctx = canvas.getContext("2d")

if(absencesChart) absencesChart.destroy()

absencesChart = new Chart(ctx,{

type:"bar",

data:{

labels:
s.topModules.map(m=>m.moduleName),

datasets:[{

label:"Absences",

data:
s.topModules.map(m=>m.count)

}]

}

})

})

}

// ==================== LOAD STUDENTS ====================
function loadStudentsData(){

callAppsScript({

action:"getStudents",
username:currentUser.username,
password:currentUser.password

},function(res){

if(!res || !res.success) return

const tbody =
document.getElementById("studentsTableBody")

if(!tbody) return

let html = ""

res.students.forEach(s=>{

html += `
<tr>
<td>${s.studentId}</td>
<td>${s.name}</td>
<td>${s.email}</td>
<td>${s.major}</td>
<td>${s.year}</td>
</tr>
`

})

tbody.innerHTML = html

})

}

// ==================== LOAD ABSENCES ====================
function loadAbsencesData(){

callAppsScript({

action:"getAbsences",
username:currentUser.username,
password:currentUser.password

},function(res){

if(!res || !res.success) return

const tbody =
document.getElementById("absencesTableBody")

if(!tbody) return

let html = ""

res.absences.forEach(a=>{

html += `
<tr>
<td>${a.absenceId}</td>
<td>${a.studentId}</td>
<td>${a.moduleId}</td>
<td>${a.examDate}</td>
<td>${a.status}</td>
</tr>
`

})

tbody.innerHTML = html

})

}
