const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwSI4r8O9qjnvB6-6AkVs4laY1PLucUCm-H0pbdOg-Efu_xuirpQY99XbhDVKoBpGuUbg/exec"; 

const DAILY_LIMIT = 5; 
let selectedDates = []; 

// 取得 DOM 元素 (加了個小檢查防止出錯)
const getEl = (id) => document.getElementById(id);

// --- 1. 定義抓取資料函數 ---
function fetchEvents(info, successCallback, failureCallback) {
    fetch(GOOGLE_SCRIPT_URL)
        .then(res => res.json())
        .then(allDatesArray => {
            let counts = {};
            if (Array.isArray(allDatesArray)) {
                allDatesArray.forEach(date => {
                    counts[date] = (counts[date] || 0) + 1;
                });
            }

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
            console.error("抓取資料失敗:", err);
            successCallback([]); // 失敗時回傳空陣列，至少讓月曆顯示
        });
}

// --- 2. 初始化月曆 ---
document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = getEl('calendar');
    
    // 如果找不到 calendar 容器，就在控制台報錯，避免後面當掉
    if (!calendarEl) {
        console.error("錯誤：找不到 ID 為 'calendar' 的元素！");
        return;
    }

    var calendar = new FullCalendar.Calendar(calendarEl, {
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
    console.log("月曆渲染指令已執行");
});

// --- 3. 更新介面 UI ---
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

// --- 4. 表單提交邏輯 ---
const leaveForm = getEl('leaveForm');
if (leaveForm) {
    leaveForm.addEventListener('submit', function(e) {
        e.preventDefault();

        if (selectedDates.length === 0) {
            alert("請先在月曆上選取請假日期！");
            return;
        }

        const submitBtn = getEl('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = "提交中...";
        }

        const now = new Date();
        const timestamp = now.getFullYear() + '/' + (now.getMonth()+1) + '/' + now.getDate() + ' ' + 
                          now.getHours().toString().padStart(2,'0') + ':' + 
                          now.getMinutes().toString().padStart(2,'0') + ':' + 
                          now.getSeconds().toString().padStart(2,'0');

        const formData = {
            applied_at: timestamp,
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
        .catch(err => {
            alert("提交失敗，請檢查網路！");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "提交申請";
            }
        });
    });
}
