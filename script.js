/**
 * 設定區
 */
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwSI4r8O9qjnvB6-6AkVs4laY1PLucUCm-H0pbdOg-Efu_xuirpQY99XbhDVKoBpGuUbg/exec"; 
const DAILY_LIMIT = 5; // 每日名額上限

let selectedDates = []; // 本次申請選取的日期
let allLeaveData = [];  // 從資料庫抓回的所有請假紀錄 (格式: [{id, date, type}])

// 簡化獲取元件的工具
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
        // 點擊日期選取/取消
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

    // 綁定查詢按鈕事件
    if (getEl('btnCheck')) {
        getEl('btnCheck').addEventListener('click', searchMyLeaves);
    }
});

/**
 * 2. 核心：從 Google Script 抓取資料
 */
function fetchEvents(info, successCallback, failureCallback) {
    fetch(GOOGLE_SCRIPT_URL)
        .then(res => res.json())
        .then(dataArray => {
            allLeaveData = dataArray; 
            
            let counts = {};
            dataArray.forEach(item => {
                const d = item.date; // 後端已統一回傳 YYYY-MM-DD
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
 * 3. 更新介面顯示 (選取日期標籤)
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
 * 4. 表單提交申請
 */
const leaveForm = getEl('leaveForm');
if (leaveForm) {
    leaveForm.addEventListener('submit', function(e) {
        e.preventDefault();

        if (selectedDates.length === 0) {
            alert("請先在月曆上選取請假日期！");
            return;
        }

        const submitBtn = getEl('submitBtn');
        submitBtn.disabled = true;
        submitBtn.innerText = "提交中...";

        const formData = {
            applied_at: new Date().toLocaleString(),
            employee_id: getEl('employeeID').value.trim().toUpperCase(),
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
            alert("提交成功！系統更新中...");
            setTimeout(() => { location.reload(); }, 1000);
        })
        .catch(err => {
            alert("提交失敗");
            submitBtn.disabled = false;
        });
    });
}

/**
 * 5. 查詢個人假期清單 (優化日期顯示)
 */
function searchMyLeaves() {
    const id = getEl('checkID').value.trim().toUpperCase();
    if (!id) return alert("請輸入員工工號進行查詢");

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

    let html = `
        <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.9em;">
            <tr style="background:#f1f3f4;">
                <th style="padding:8px; border:1px solid #ddd;">日期</th>
                <th style="padding:8px; border:1px solid #ddd;">類型</th>
                <th style="padding:8px; border:1px solid #ddd;">操作</th>
            </tr>
    `;
    
    myLeaves.forEach(item => {
        // 直接使用後端已格式化好的 YYYY-MM-DD
        const simpleDate = item.date;

        html += `
            <tr>
                <td style="padding:8px; border:1px solid #ddd; text-align:center; font-weight:bold;">${simpleDate}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:center;">${item.type}</td>
                <td style="padding:8px; border:1px solid #ddd; text-align:center;">
                    <button type="button" onclick="cancelLeave('${id}', '${simpleDate}')" 
                        style="background:#dc3545; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">
                        取消
                    </button>
                </td>
            </tr>
        `;
    });
    html += '</table>';
    listDiv.innerHTML = html;
}

/**
 * 6. 執行刪除 (強化取消邏輯)
 */
function cancelLeave(empId, dateStr) {
    if (!confirm(`確定要取消 ${dateStr} 的假期嗎？`)) return;

    // 將按鈕暫時停用，避免重複點擊
    const btn = event.target;
    btn.disabled = true;
    btn.innerText = "處理中...";

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
        // 重要：給予後端 1.5 秒的處理時間，再刷新頁面
        alert("要求已提交！名額更新約需 1-2 秒。");
        setTimeout(() => {
            location.reload(); 
        }, 1500);
    })
    .catch(err => {
        alert("取消失敗，請檢查網路連線");
        btn.disabled = false;
        btn.innerText = "取消";
    });
}
