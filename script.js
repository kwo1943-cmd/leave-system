const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwSI4r8O9qjnvB6-6AkVs4laY1PLucUCm-H0pbdOg-Efu_xuirpQY99XbhDVKoBpGuUbg/exec"; 

const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const totalDaysSpan = document.getElementById('totalDays');
const daysDisplay = document.getElementById('daysDisplay');

// 設定日期限制：不能選今天以前的日期
const today = new Date().toISOString().split('T')[0];
startDateInput.setAttribute('min', today);
endDateInput.setAttribute('min', today);

const DAILY_LIMIT = 5; 

document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    
    var calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'zh-tw',
    height: 'auto',
    
    // --- 重新排列按鈕位置 ---
    headerToolbar: {
        left: 'today',          // [today] 移到左上角
        center: 'title',         // 月份標題保留在中間
        right: 'prev,next'       // [左箭頭][右箭頭] 移到右上角
    },
        // 點擊日期自動填寫功能
var calendar = new FullCalendar.Calendar(calendarEl, {
    // ... 其他設定 (headerToolbar, locale 等)
    
    dateClick: function(info) {
        const dateStr = info.dateStr;
        const todayStr = new Date().toISOString().split('T')[0];

        if (dateStr < todayStr) {
            alert("不能選擇過去的日期！");
            return;
        }

        // 邏輯：如果已在陣列中就移除（取消選取），不在就加入
        const index = selectedDates.indexOf(dateStr);
        if (index > -1) {
            selectedDates.splice(index, 1);
            info.dayEl.style.backgroundColor = ""; // 恢復顏色
        } else {
            selectedDates.push(dateStr);
            info.dayEl.style.backgroundColor = "#e8f0fe"; // 高亮顯示選中
        }

        updateDateTags(); // 更新顯示介面
    },
    // ...
});

// 更新介面上的日期標籤
function updateDateTags() {
    selectedDates.sort(); // 排序日期
    const container = document.getElementById('date-tags');
    const totalSpan = document.getElementById('totalDays');
    
    if (selectedDates.length === 0) {
        container.innerHTML = '<span style="color: #999;">請點擊下方月曆選取日期...</span>';
    } else {
        container.innerHTML = selectedDates.map(date => 
            `<span class="date-tag" style="background:#1a73e8; color:white; padding:4px 8px; border-radius:15px; font-size:0.85em;">${date}</span>`
        ).join('');
    }
    totalSpan.innerText = selectedDates.length;
}

// 修改提交表單的邏輯
document.getElementById('leaveForm').addEventListener('submit', function(e) {
    e.preventDefault();
    if (selectedDates.length === 0) {
        alert("請至少選取一個日期！");
        return;
    }

    // 將所有日期結合成一個字串，例如 "2026-04-10, 2026-04-11..."
    const dateRangeString = selectedDates.join(', ');

    const formData = {
        applied_at: new Date().toLocaleString(),
        employee_id: document.getElementById('employeeID').value,
        leave_type: document.getElementById('leaveType').value,
        dates: dateRangeString, // 傳送完整的日期清單
        total_days: selectedDates.length,
        remarks: document.getElementById('remarks').value
    };

    // ... 後續 fetch 邏輯不變 ...
    // 成功後記得清空陣列：selectedDates = []; updateDateTags();
});

            startDateInput.value = selectedDate;
            endDateInput.value = selectedDate;

            // 觸發天數計算
            calculateDays();

            // 捲動到頂部
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        // 動態載入事件
        events: fetchEvents 
    });

    calendar.render();

    function fetchEvents(info, successCallback, failureCallback) {
        fetch(GOOGLE_SCRIPT_URL)
            .then(res => res.json())
            .then(data => {
                let counts = {};
                data.forEach(leave => {
                    let d = new Date(leave.start);
                    let end = new Date(leave.end);
                    while(d <= end) {
                        let dateStr = d.toISOString().split('T')[0];
                        counts[dateStr] = (counts[dateStr] || 0) + 1;
                        d.setDate(d.getDate() + 1);
                    }
                });

                let events = Object.keys(counts).map(date => {
                    let count = counts[date];
                    let isFull = count >= DAILY_LIMIT;
                    return {
                        title: isFull ? "❌ 已滿" : `餘額: ${DAILY_LIMIT - count}`,
                        start: date,
                        color: isFull ? "#ff4d4d" : "#28a745",
                        allDay: true
                    };
                });
                successCallback(events);
            })
            .catch(err => console.error("抓取資料失敗:", err));
    }
});

// 自動計算天數的函數
function calculateDays() {
    const start = new Date(startDateInput.value);
    const end = new Date(endDateInput.value);

    if (startDateInput.value && endDateInput.value) {
        if (end < start) {
            daysDisplay.style.display = "block";
            totalDaysSpan.innerText = "日期錯誤";
            totalDaysSpan.style.color = "red";
            return "日期錯誤";
        } else {
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            daysDisplay.style.display = "block";
            totalDaysSpan.innerText = diffDays;
            totalDaysSpan.style.color = "#1a73e8";
            return diffDays;
        }
    }
    return 0;
}

// 監聽日期變動
startDateInput.addEventListener('change', calculateDays);
endDateInput.addEventListener('change', calculateDays);

// 表單提交
document.getElementById('leaveForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const days = calculateDays();
    if (days === "日期錯誤" || days <= 0) {
        alert("請檢查日期設定是否正確！");
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerText = "提交中...";

    const now = new Date();
    // 修正時間戳記：精確到秒
    const timestamp = now.getFullYear() + '/' + (now.getMonth()+1) + '/' + now.getDate() + ' ' + 
                      now.getHours().toString().padStart(2,'0') + ':' + 
                      now.getMinutes().toString().padStart(2,'0') + ':' + 
                      now.getSeconds().toString().padStart(2,'0');

    const formData = {
        applied_at: timestamp,
        employee_id: document.getElementById('employeeID').value,
        leave_type: document.getElementById('leaveType').value,
        start_date: startDateInput.value,
        end_date: endDateInput.value,
        total_days: days,
        remarks: document.getElementById('remarks').value
    };

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify(formData)
    })
    .then(() => {
        const msgDiv = document.getElementById('message');
        msgDiv.style.display = "block";
        msgDiv.style.backgroundColor = "#d4edda";
        msgDiv.innerHTML = `✅ 成功！共請假 ${days} 天。<br><small>提交時間：${timestamp}</small>`;
        this.reset();
        daysDisplay.style.display = "none";
        alert("提交成功！");
    })
    .catch(err => alert("提交失敗，請檢查網路！"))
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerText = "提交申請";
    });
});
