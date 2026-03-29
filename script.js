const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwSI4r8O9qjnvB6-6AkVs4laY1PLucUCm-H0pbdOg-Efu_xuirpQY99XbhDVKoBpGuUbg/exec"; 

const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const totalDaysSpan = document.getElementById('totalDays');
const daysDisplay = document.getElementById('daysDisplay');

// 設定日期限制：不能選今天以前的日期
const today = new Date().toISOString().split('T')[0];
startDateInput.setAttribute('min', today);
endDateInput.setAttribute('min', today);
const DAILY_LIMIT = 5; // 設定每日申請上限人數

document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    var calendar = new FullCalendar.Calendar(calendarEl, {
        dateClick: function(info) {
        const selectedDate = info.dateStr; // 取得點擊的日期 (格式 YYYY-MM-DD)
        const todayStr = new Date().toISOString().split('T')[0];

        // 防呆：如果點擊的是過去的日期，不執行填寫
        if (selectedDate < todayStr) {
            alert("不能選擇過去的日期！");
            return;
        }

        // 自動填寫到表單中
        document.getElementById('startDate').value = selectedDate;
        document.getElementById('endDate').value = selectedDate;

        // 觸發天數計算功能 (如果之前有寫 calculateDays 函數)
        if (typeof calculateDays === "function") {
            calculateDays();
        }

        // 畫面自動捲動回到表單頂部，方便員工繼續填寫
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });

        // 可選：給予一個簡單的提示
        console.log("已選取日期: " + selectedDate);
    },
    // -----------------------

    events: function(info, successCallback, failureCallback) {
        // ... 你原本抓取 Google Sheets 資料的 fetch 邏輯 ...
    }
});

calendar.render();
        initialView: 'dayGridMonth',
        locale: 'zh-tw',
        events: fetchEvents // 動態載入事件
    });
    calendar.render();

    function fetchEvents(info, successCallback, failureCallback) {
        fetch(GOOGLE_SCRIPT_URL)
            .then(res => res.json())
            .then(data => {
                // 統計每天的人數
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

                // 轉換為月曆格式
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
            });
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
        } else {
            // 計算天數：(結束 - 開始) / 一天的毫秒數 + 1 (包含當天)
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
    const timestamp = now.toLocaleString('zh-TW', { hour12: false });

    const formData = {
        applied_at: timestamp,
        employee_id: document.getElementById('employeeID').value,
        leave_type: document.getElementById('leaveType').value,
        start_date: startDateInput.value,
        end_date: endDateInput.value,
        total_days: days, // 新增：傳送總天數
        remarks: document.getElementById('remarks').value
    };

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify(formData)
    })
    .then(() => {
        document.getElementById('message').style.display = "block";
        document.getElementById('message').innerHTML = `✅ 成功！共請假 ${days} 天。<br><small>提交時間：${timestamp}</small>`;
        this.reset();
        daysDisplay.style.display = "none";
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerText = "提交申請";
    });
});
