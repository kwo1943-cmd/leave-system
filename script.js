/**
 * 設定區
 */
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwSI4r8O9qjnvB6-6AkVs4laY1PLucUCm-H0pbdOg-Efu_xuirpQY99XbhDVKoBpGuUbg/exec"; 
const DAILY_LIMIT = 5; // 每日名額上限

let selectedDates = []; // 本次申請選取的日期
let allLeaveData = [];  // 從資料庫抓回的所有請假紀錄

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
        headerToolbar: {
            left: 'today',
            center: 'title',
            right: 'prev,next'
        },
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

    if (getEl('btnCheck')) {
        getEl('btnCheck').addEventListener('click', searchMyLeaves);
    }
});

/**
 * 2. 抓取資料 (用於月曆名額顯示)
 */
function fetchEvents(info, successCallback, failureCallback) {
    fetch(GOOGLE_SCRIPT_URL)
        .then(res => res.json())
        .then(dataArray => {
            allLeaveData = dataArray; 
            
            let counts = {};
            dataArray.forEach(item => {
                const d = item.date; 
                if (d) {
                    counts[d] = (counts[d] || 0) + 1;
                }
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

    if (!container) return;

    selectedDates.sort();
    if (selectedDates.length === 0) {
        container.innerHTML = '<span style="color: #999; font-size: 0.9em;">請點擊月曆選取日期...</span>';
        if (display) display.style.display = "none";
    } else {
        container.innerHTML = selectedDates.map(date => 
            `<span class="date-tag">${date}</span>`
        ).join('');
        if (display) display.style.display = "block";
        if (total) total.innerText = selectedDates.length;
    }
}

/**
 * 4. 提交申請表單
 */
const leaveForm = getEl('leaveForm');
if (leaveForm) {
    leaveForm.addEventListener('submit', function(e) {
        e.preventDefault();

        if (selectedDates.length === 0) return alert("請先選取日期！");

        const submitBtn = getEl('submitBtn');
        submitBtn.disabled = true;
        submitBtn.innerText = "提交中...";

        // 使用 URLSearchParams 封裝資料，增加後端相容性
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
            alert("提交成功！系統更新中...");
            setTimeout(() => { location.reload(); }, 1500);
        })
        .catch(() => {
            alert("提交失敗");
            submitBtn.disabled = false;
        });
    });
}

/**
 * 5. 查詢個人假期清單
 */
function searchMyLeaves() {
    const id = getEl('checkID').value.trim().toUpperCase();
    if (!id) return alert("請輸入工號進行查詢");

    const listDiv = getEl('my-leaves-list');
    listDiv.innerHTML = "<p>搜尋中...</p>";

    const myLeaves = allLeaveData.filter(item => 
        item.id.toString().toUpperCase() === id
    );

    if (myLeaves.length === 0) {
        listDiv.innerHTML = "<p style='color:red;'>查無此工號的請假紀錄。</p>";
        return;
    }

    myLeaves.sort((a, b) => a.date.localeCompare(b.date));

    let html = `<table style="width:100%; border-collapse:collapse; margin-top:10px;">
        <tr style="background:#f8f9fa;">
            <th style="padding:8px; border:1px solid #ddd;">日期</th>
            <th style="padding:8px; border:1px solid #ddd;">類型</th>
            <th style="padding:8px; border:1px solid #ddd;">操作</th>
        </tr>`;
    
    myLeaves.forEach(item => {
        html += `<tr>
            <td style="padding:8px; border:1px solid #ddd; text-align:center; font-weight:bold;">${item.date}</td>
            <td style="padding:8px; border:1px solid #ddd; text-align:center;">${item.type}</td>
            <td style="padding:8px; border:1px solid #ddd; text-align:center;">
                <button type="button" onclick="cancelLeave('${id}', '${item.date}')" 
                    style="background:#dc3545; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">
                    取消
                </button>
            </td>
        </tr>`;
    });
    html += '</table>';
    listDiv.innerHTML = html;
}

/**
 * 6. 核心功能：執行取消 (刪除) 假期
 */
function cancelLeave(empId, dateStr) {
    if (!confirm(`確定要取消 ${dateStr} 的假期嗎？`)) return;

    // 抓取當前點擊的按鈕並鎖定
    const btn = event.target;
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "處理中...";

    // 封裝刪除指令
    const params = new URLSearchParams();
    params.append('action', 'delete');
    params.append('employee_id', empId);
    params.append('date_to_delete', dateStr);

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
    })
    .then(() => {
        // no-cors 下無法獲取 Response，直接提示用戶並延遲刷頁
        alert("已發送取消要求！系統處理約需 2 秒。");
        setTimeout(() => {
            location.reload(); 
        }, 2000);
    })
    .catch(err => {
        alert("取消失敗，請檢查網路！");
        btn.disabled = false;
        btn.innerText = originalText;
    });
}
