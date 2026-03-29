const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwSI4r8O9qjnvB6-6AkVs4laY1PLucUCm-H0pbdOg-Efu_xuirpQY99XbhDVKoBpGuUbg/exec"; 

const totalDaysSpan = document.getElementById('totalDays');
const daysDisplay = document.getElementById('daysDisplay');
const dateTagsContainer = document.getElementById('date-tags');

const DAILY_LIMIT = 5; // 每日名額上限
let selectedDates = []; // 儲存員工本次選取的日期

document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    
    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'zh-tw',
        height: 'auto',
        headerToolbar: {
            left: 'today',
            center: 'title',
            right: 'prev,next'
        },
        // 點擊選取/取消邏輯
        dateClick: function(info) {
            const dateStr = info.dateStr;
            const todayStr = new Date().toISOString().split('T')[0];

            // 防呆：不能選過去
            if (dateStr < todayStr) {
                alert("不能選擇過去的日期！");
                return;
            }

            const index = selectedDates.indexOf(dateStr);
            if (index > -1) {
                // 已選過，則取消選取
                selectedDates.splice(index, 1);
                info.dayEl.style.backgroundColor = ""; 
            } else {
                // 未選過，則加入清單
                selectedDates.push(dateStr);
                info.dayEl.style.backgroundColor = "#e8f0fe"; // 淺藍色高亮
            }

            updateDateUI();
        },
        // 動態載入名額事件
        events: fetchEvents 
    });

    calendar.render();

    // 從 Google Sheets 抓取已申請資料並統計
    function fetchEvents(info, successCallback, failureCallback) {
        fetch(GOOGLE_SCRIPT_URL)
            .then(res => res.json())
            .then(allDatesArray => {
                let counts = {};
                // allDatesArray 是從 doGet 傳回的扁平化日期陣列
                allDatesArray.forEach(date => {
                    counts[date] = (counts[date] || 0) + 1;
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

// 更新介面上的選取狀態
function updateDateUI() {
    selectedDates.sort(); // 按日期順序排列
    
    if (selectedDates.length === 0) {
        dateTagsContainer.innerHTML = '<span style="color: #999; font-size: 0.9em;">請點擊月曆選取日期...</span>';
        daysDisplay.style.display = "none";
    } else {
        dateTagsContainer.innerHTML = selectedDates.map(date => 
            `<span class="date-tag">${date}</span>`
        ).join('');
        daysDisplay.style.display = "block";
        totalDaysSpan.innerText = selectedDates.length;
    }
}

// 表單提交邏輯
document.getElementById('leaveForm').addEventListener('submit', function(e) {
    e.preventDefault();

    if (selectedDates.length === 0) {
        alert("請先在月曆上選取請假日期！");
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerText = "提交中...";

    const now = new Date();
    const timestamp = now.getFullYear() + '/' + (now.getMonth()+1) + '/' + now.getDate() + ' ' + 
                      now.getHours().toString().padStart(2,'0') + ':' + 
                      now.getMinutes().toString().padStart(2,'0') + ':' + 
                      now.getSeconds().toString().padStart(2,'0');

    const formData = {
        applied_at: timestamp,
        employee_id: document.getElementById('employeeID').value,
        leave_type: document.getElementById('leaveType').value,
        dates: selectedDates.join(', '), // 將所有日期合成字串
        total_days: selectedDates.length,
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
        msgDiv.innerHTML = `✅ 成功！共請假 ${selectedDates.length} 天。<br>日期：${formData.dates}`;
        
        // 重置表單與清單
        this.reset();
        selectedDates = [];
        updateDateUI();
        
        // 清除月曆上的手動高亮 (重新渲染月曆)
        location.reload(); 
        alert("提交成功！");
    })
    .catch(err => alert("提交失敗，請檢查網路！"))
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerText = "提交申請";
    });
});
