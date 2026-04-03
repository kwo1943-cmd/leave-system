/**
 * 設定區
 */
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwSI4r8O9qjnvB6-6AkVs4laY1PLucUCm-H0pbdOg-Efu_xuirpQY99XbhDVKoBpGuUbg/exec"; 
const DAILY_LIMIT = 5; // 每日名額上限

let selectedDates = []; // 本次申請選取的日期
let allLeaveData = [];  // 快取所有請假紀錄

const getEl = (id) => document.getElementById(id);

/**
 * 1. 初始化與月曆渲染
 */
document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = getEl('calendar');
    if (!calendarEl) return;

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'zh-tw',
        height: 'auto',
        headerToolbar: { left: 'today', center: 'title', right: 'prev,next' },
        dateClick: function(info) {
            const dateStr = info.dateStr;
            const todayStr = new Date().toISOString().split('T')[0];

            if (dateStr < todayStr) {
                alert("不能選擇過去的日期！");
                return;
            }

            const index = selectedDates.indexOf(dateStr);
            if (index > -1) {
                selectedDates.splice(index, 1);
                info.dayEl.style.backgroundColor = ""; 
            } else {
                selectedDates.push(dateStr);
                info.dayEl.style.backgroundColor = "#e8f0fe"; 
            }
            updateDateUI();
        },
        events: fetchEvents 
    });

    calendar.render();

    // 預設月份選擇器為當月
    const now = new Date();
    getEl('exportMonth').value = now.toISOString().slice(0, 7);

    // 綁定按鈕事件
    if (getEl('btnCheck')) getEl('btnCheck').addEventListener('click', searchMyLeaves);
    if (getEl('btnExport')) getEl('btnExport').addEventListener('click', exportToCSV);
});

/**
 * 2. 抓取資料 (用於顯示餘額與報表)
 */
function fetchEvents(info, successCallback, failureCallback) {
    fetch(GOOGLE_SCRIPT_URL)
        .then(res => res.json())
        .then(dataArray => {
            allLeaveData = dataArray; 
            
            let counts = {};
            dataArray.forEach(item => {
                const d = item.date; 
                if (d) counts[d] = (counts[d] || 0) + 1;
            });

            let events = Object.keys(counts).map(date => {
                let count = counts[date];
                let isFull = count >= DAILY_LIMIT;
                return {
                    title: isFull ? "❌ 已滿" : `餘額: ${DAILY_LIMIT - count}`,
                    start: date,
                    color: isFull ? "#ff4d4d" : "#28a745",
                    allDay: true,
                    display: 'block'
                };
            });
            successCallback(events);
        })
        .catch(err => {
            console.error("抓取失敗:", err);
            successCallback([]); 
        });
}

/**
 * 3. 更新已選日期 UI
 */
function updateDateUI() {
    const container = getEl('date-tags');
    const display = getEl('daysDisplay');
    const total = getEl('totalDays');

    selectedDates.sort();
    if (selectedDates.length === 0) {
        container.innerHTML = '<span style="color:#999;">請點擊月曆...</span>';
        if (display) display.style.display = "none";
    } else {
        container.innerHTML = selectedDates.map(date => `<span class="date-tag">${date}</span>`).join('');
        if (display) display.style.display = "block";
        if (total) total.innerText = selectedDates.length;
    }
}

/**
 * 4. 提交申請
 */
const leaveForm = getEl('leaveForm');
if (leaveForm) {
    leaveForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (selectedDates.length === 0) return alert("請先選取日期！");

        const submitBtn = getEl('submitBtn');
        submitBtn.disabled = true;
        submitBtn.innerText = "提交中...";

        const params = new URLSearchParams();
        params.append('employee_id', getEl('employeeID').value.trim().toUpperCase());
        params.append('leave_type', getEl('leaveType').value);
        params.append('dates', selectedDates.join(', '));
        params.append('remarks', getEl('remarks').value);

        fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString()
        })
        .then(() => {
            alert("提交成功！");
            location.reload();
        })
        .catch(() => {
            alert("提交失敗");
            submitBtn.disabled = false;
        });
    });
}

/**
 * 5. 查詢個人紀錄
 */
function searchMyLeaves() {
    const id = getEl('checkID').value.trim().toUpperCase();
    if (!id) return alert("請輸入工號");

    const listDiv = getEl('my-leaves-list');
    listDiv.innerHTML = "<p>搜尋中...</p>";

    const myLeaves = allLeaveData.filter(item => item.id.toString().toUpperCase() === id);

    if (myLeaves.length === 0) {
        listDiv.innerHTML = "<p style='color:red;'>查無紀錄。</p>";
        return;
    }

    myLeaves.sort((a, b) => a.date.localeCompare(b.date));

    let html = `<table><tr><th>日期</th><th>類型</th><th>操作</th></tr>`;
    myLeaves.forEach(item => {
        html += `<tr>
            <td style="font-weight:bold;">${item.date}</td>
            <td>${item.type}</td>
            <td><button onclick="cancelLeave('${id}', '${item.date}')" style="background:#dc3545; padding:4px 8px; font-size:0.8em;">取消</button></td>
        </tr>`;
    });
    html += '</table>';
    listDiv.innerHTML = html;
}

/**
 * 6. 取消假期
 */
function cancelLeave(empId, dateStr) {
    if (!confirm(`確定取消 ${dateStr}？`)) return;
    
    const params = new URLSearchParams();
    params.append('action', 'delete');
    params.append('employee_id', empId);
    params.append('date_to_delete', dateStr);

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: params.toString()
    }).then(() => {
        alert("已送出取消要求");
        setTimeout(() => location.reload(), 1500);
    });
}

/**
 * 7. 匯出 CSV 報表 (自選月份)
 */
function exportToCSV() {
    const selectedMonth = getEl('exportMonth').value;
    if (!selectedMonth) return alert("請選擇月份");

    const filteredData = allLeaveData.filter(item => item.date.startsWith(selectedMonth));
    if (filteredData.length === 0) return alert("該月份無資料");

    filteredData.sort((a, b) => a.date.localeCompare(b.date));

    let csvContent = "\uFEFF工號,日期,假別\n";
    filteredData.forEach(item => {
        csvContent += `${item.id},${item.date},${item.type}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Leave_Report_${selectedMonth}.csv`;
    link.click();
}
