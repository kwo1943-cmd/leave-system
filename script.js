const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwSI4r8O9qjnvB6-6AkVs4laY1PLucUCm-H0pbdOg-Efu_xuirpQY99XbhDVKoBpGuUbg/exec"; 

document.getElementById('leaveForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const msgDiv = document.getElementById('message');
    
    // 獲取當前精確時間 (YYYY/MM/DD HH:mm:ss)
    const now = new Date();
    const timestamp = now.getFullYear() + '/' + 
                      (now.getMonth() + 1).toString().padStart(2, '0') + '/' + 
                      now.getDate().toString().padStart(2, '0') + ' ' + 
                      now.getHours().toString().padStart(2, '0') + ':' + 
                      now.getMinutes().toString().padStart(2, '0') + ':' + 
                      now.getSeconds().toString().padStart(2, '0');

    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;

    if (new Date(start) > new Date(end)) {
        alert("錯誤：開始日期不能晚於結束日期！");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = "提交中...";

    // 重新封裝資料
    const formData = {
        applied_at: timestamp, // 精確到秒
        employee_id: document.getElementById('employeeID').value,
        leave_type: document.getElementById('leaveType').value,
        start_date: start,
        end_date: end,
        remarks: document.getElementById('remarks').value
    };

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        cache: "no-cache",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
    })
    .then(() => {
        msgDiv.style.display = "block";
        msgDiv.style.backgroundColor = "#d4edda";
        msgDiv.style.color = "#155724";
        msgDiv.innerText = "✅ 申請已成功送出！\n時間：" + timestamp;
        this.reset();
    })
    .catch(error => {
        alert("提交失敗，請檢查網路。");
        console.error(error);
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerText = "提交申請";
    });
});