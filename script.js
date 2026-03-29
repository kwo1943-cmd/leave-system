const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwSI4r8O9qjnvB6-6AkVs4laY1PLucUCm-H0pbdOg-Efu_xuirpQY99XbhDVKoBpGuUbg/exec"; 

const DAILY_LIMIT = 5; 
let selectedDates = []; 
let allLeaveData = []; // 儲存從後端抓到的完整資料物件 [{id, date, type}, ...]

const getEl = (id) => document.getElementById(id);

// --- 1. 定義抓取資料函數 (供月曆與查詢使用) ---
function fetchEvents(info, successCallback, failureCallback) {
    fetch(GOOGLE_SCRIPT_URL)
        .then(res => res.json())
        .then(dataArray => {
            allLeaveData = dataArray; // 存到全域變數供查詢功能使用
            
            let counts = {};
            allLeaveData.forEach(item => {
                let d = item.date;
                counts[d] = (counts[d] || 0) + 1;
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
            if(successCallback) successCallback(events);
        })
        .catch(err => {
            console.error("抓取失敗:", err);
            if(successCallback) successCallback([]);
        });
}

// --- 2. 初始化月曆 ---
document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = getEl('calendar');
    if (!calendarEl) return;

    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'zh-tw',
        height: 'auto',
        headerToolbar: { left: 'today', center: 'title', right: 'prev,next' },
        dateClick: function(info) {
            const dateStr = info.dateStr;
            const todayStr = new Date().toISOString().split('T')[0];
            if (dateStr < todayStr) return alert("不能選擇過去的日期！");

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

    // 綁定查詢按鈕
    if(getEl('btnCheck')) {
        getEl('btnCheck').addEventListener('click', searchMyLeaves);
    }
});

// --- 3. 查詢員工假期功能 ---
function searchMyLeaves() {
    const id = getEl('checkID').value.trim().toUpperCase();
    if (!id) return alert("請輸入工號");

    const listDiv = getEl('my-leaves-list');
    listDiv.innerHTML = "<p>查詢中...</p>";

    // 過濾出該員工的假期
    const myLeaves = allLeaveData.filter(item => item.id.toString().toUpperCase() === id);

    if (myLeaves.length === 0) {
        listDiv.innerHTML = "<p style='color:red;'>找不到此工號的請假紀錄。</p>";
        return;
    }

    // 按日期排序
    myLeaves.sort((a, b) => a.date.localeCompare(b.date));

    let html = '<table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.9em;">';
    html += '<tr style="background:#f1f3f4;"><th style="padding:8px; border:1px solid #ddd;">日期</th><th style="padding:8px; border:1px solid #ddd;">類型</th><th style="padding:8px; border:1px solid #ddd;">操作</th></tr>';
    
    myLeaves.forEach(item => {
        html += `<tr>
            <td style="padding:8px; border:1px solid #ddd; text-align:center;">${item.date}</td>
            <td style="padding:8px; border:1px solid #ddd; text-align:center;">${item.type}</td>
            <td style="padding:8px; border:1px solid #ddd; text-align:center;">
                <button onclick="cancelLeave('${id}', '${item.date}')" style="background:#dc3545; padding:4px 8px; font-size:12px;">取消</button>
            </td>
        </tr>`;
    });
    html += '</table>';
    listDiv.innerHTML = html;
}

// --- 4. 執行取消功能 ---
function cancelLeave(empId, dateStr) {
    if (!confirm(`確定要取消 ${dateStr} 的假期申請嗎？`)) return;

    // 這裡我們需要發送 POST 給 Google Script 執行刪除
    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({
            action: "delete",
            employee_id: empId,
            date_to_delete: dateStr
        })
    })
    .then(() => {
        alert("要求已發送，頁面將重新載入以更新名額。");
        location.reload(); // 重新整理網頁確保數據同步
    })
    .catch(err => alert("取消失敗，請檢查網路！"));
}

// --- 5. 更新 UI 與提交邏輯 (保留原有的) ---
function updateDateUI() {
    const container = getEl('date-tags');
    if (!container) return;
    selectedDates.sort();
    if (selectedDates.length === 0) {
        container.innerHTML = '<span style="color: #999;">請點擊月曆選取日期...</span>';
        getEl('daysDisplay').style.display = "none";
    } else {
        container.innerHTML = selectedDates.map(d => `<span class="date-tag">${d}</span>`).join('');
        getEl('daysDisplay').style.display = "block";
        getEl('totalDays').innerText = selectedDates.length;
    }
}

getEl('leaveForm').addEventListener('submit', function(e) {
    e.preventDefault();
    if (selectedDates.length === 0) return alert("請先選取日期！");
    
    const submitBtn = getEl('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerText = "提交中...";

    const formData = {
        applied_at: new Date().toLocaleString(),
        employee_id: getEl('employeeID').value,
        leave_type: getEl('leaveType').value,
        dates: selectedDates.join(', '), 
        total_days: selectedDates.length,
        remarks: getEl('remarks').value
    };

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify(formData)
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
