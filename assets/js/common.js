/* ==========================================================================
   桃園市楊光國中 115 學年度【行動方程式】彈性學習課程 共用前端腳本
   功能：防呆下拉選單生成、LocalStorage 離線自動快取、即時表單驗證、
         教師派發 QR Code 產生器與全螢幕白板投影彈窗
   ========================================================================== */

const COURSE_CONFIG = {
  // 班級陣列：未來若有新增或修改班級，直接在此陣列加入字串即可！
  classes: ['701', '702', '703', '704', '705', '706', '707', '708', '709', '710'],
  
  // 座號上限：固定 1 ~ 30 號
  maxSeatNumber: 30,

  // 組別選項：第 1 組 ~ 第 8 組
  groups: ['第 1 組', '第 2 組', '第 3 組', '第 4 組', '第 5 組', '第 6 組', '第 7 組', '第 8 組'],

  // Google Apps Script 部署 URL
  gasEndpoint: "https://script.google.com/macros/s/AKfycbyzDaKcAxAxvSKOqaXM0pF6H3uugLAs6FkE_OPbwVyaSpqQWxmNhb7JQBqLJXnTLZkWog/exec"
};

/**
 * 取得當前網頁之真實完整 URL（自動適應 GitHub Pages 與本機測試）
 */
function getAbsoluteWeekUrl(weekFile) {
  const loc = window.location;
  if (loc.protocol === 'file:') {
    // 本機 file 協定下
    const dir = loc.pathname.substring(0, loc.pathname.lastIndexOf('/') + 1);
    return loc.origin + dir + weekFile;
  }
  // HTTP/HTTPS 伺服器 (如 GitHub Pages)
  const pathParts = loc.pathname.split('/');
  pathParts.pop(); // 移除目前的檔案名 (如 index.html)
  const basePath = pathParts.join('/') + '/';
  return loc.origin + basePath + weekFile;
}

/**
 * 彈出教師大螢幕派卷 QR Code Modal (支援白板投影與手機掃碼)
 */
function showQrModal(targetUrl, titleText) {
  let modal = document.getElementById('qrModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'qrModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close-btn" onclick="closeQrModal()">&times;</button>
      <div style="font-size: 0.95rem; font-weight: 700; color: #16A34A; margin-bottom: 0.3rem;">📲 電子白板派卷投影</div>
      <h2 style="font-size: 1.4rem; color: var(--primary); font-weight: 800; margin-bottom: 0.4rem;">${titleText}</h2>
      <p style="color: var(--text-muted); font-size: 0.95rem;">請學生開啟平板/手機相機，對準 QR Code 即可直接進入學習單：</p>

      <div class="modal-qr-frame">
        <div id="modalQrCode"></div>
      </div>

      <div class="modal-qr-url-box">${targetUrl}</div>

      <div class="modal-actions">
        <button class="btn-dispatch" onclick="copyToClipboard('${targetUrl}', this)">📋 複製學生填答連結</button>
        <a href="${targetUrl}" target="_blank" class="btn-secondary">🚀 在新分頁開啟</a>
        <button class="btn-secondary" onclick="closeQrModal()">關閉投影</button>
      </div>
    </div>
  `;

  modal.classList.add('active');

  // 繪製 QR Code (優先使用本地 qrcode.min.js，後備支援 API)
  setTimeout(() => {
    const container = document.getElementById('modalQrCode');
    if (!container) return;
    container.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
      new QRCode(container, {
        text: targetUrl,
        width: 260,
        height: 260,
        colorDark: "#1A365D",
        colorLight: "#FFFFFF",
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      const img = document.createElement('img');
      img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&color=1A365D&data=' + encodeURIComponent(targetUrl);
      img.alt = 'QR Code';
      container.appendChild(img);
    }
  }, 50);
}

function closeQrModal() {
  const modal = document.getElementById('qrModal');
  if (modal) modal.classList.remove('active');
}

/**
 * 在各週學習單頁面中，點擊頂部「📱 投影派卷」時調用
 */
function showCurrentPageQrModal() {
  const currentUrl = window.location.href;
  const pageTitle = document.title || '【行動方程式】課堂學習單';
  showQrModal(currentUrl, pageTitle);
}

/**
 * 複製文字至剪貼簿
 */
function copyToClipboard(text, btnElement) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = btnElement ? btnElement.innerHTML : '';
    if (btnElement) {
      btnElement.innerHTML = '✅ 已複製連結！';
      setTimeout(() => {
        btnElement.innerHTML = originalText;
      }, 2000);
    }
  }).catch(() => {
    prompt('請手動選取並複製下列學生連結：', text);
  });
}

/**
 * 初始化學生資訊防呆下拉選單與自動儲存監聽
 */
function initStudentInfoForm(weekId) {
  const classSelect = document.getElementById('studentClass');
  const seatSelect = document.getElementById('studentSeat');
  const groupSelect = document.getElementById('studentGroup');

  // 1. 動態填充班級選單
  if (classSelect) {
    classSelect.innerHTML = '<option value="" disabled selected>請選擇班級</option>';
    COURSE_CONFIG.classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c + ' 班';
      classSelect.appendChild(opt);
    });
  }

  // 2. 動態填充座號選單 (01 ~ 30 號)
  if (seatSelect) {
    seatSelect.innerHTML = '<option value="" disabled selected>請選擇座號</option>';
    for (let i = 1; i <= COURSE_CONFIG.maxSeatNumber; i++) {
      const opt = document.createElement('option');
      const seatVal = i < 10 ? '0' + i : '' + i;
      opt.value = seatVal;
      opt.textContent = seatVal + ' 號';
      seatSelect.appendChild(opt);
    }
  }

  // 3. 動態填充組別選單
  if (groupSelect) {
    groupSelect.innerHTML = '<option value="" disabled selected>請選擇組別</option>';
    COURSE_CONFIG.groups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      groupSelect.appendChild(opt);
    });
  }

  // 4. 綁定變更自動儲存
  const formElements = document.querySelectorAll('input, select, textarea');
  formElements.forEach(el => {
    el.addEventListener('input', () => saveDraft(weekId));
    el.addEventListener('change', () => saveDraft(weekId));
  });

  // 5. 恢復快取草稿
  loadDraft(weekId);

  // 6. 🔍 防重複繳交檢查：若本地已提交過，顯示已繳交橫幅並鎖定防手滑
  checkSubmissionStatus(weekId);
}

/**
 * 檢查學生是否已繳交過此週學習單
 */
function checkSubmissionStatus(weekId) {
  const submittedRaw = localStorage.getItem('action115_submitted_' + weekId);
  if (!submittedRaw) return;

  try {
    const info = JSON.parse(submittedRaw);
    const container = document.querySelector('.container');
    const existingBanner = document.getElementById('submittedNoticeBanner');
    if (!existingBanner && container) {
      const banner = document.createElement('div');
      banner.id = 'submittedNoticeBanner';
      banner.style.cssText = "background: #ECFDF5; border: 2px solid #10B981; border-radius: 14px; padding: 1.1rem 1.4rem; margin-bottom: 1.6rem; color: #065F46; text-align: center; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);";
      banner.innerHTML = `
        <div style="font-size: 1.2rem; font-weight: 800; margin-bottom: 0.2rem;">🎉 您已成功繳交本週學習單！</div>
        <div style="font-size: 0.95rem; margin-bottom: 0.4rem;">
          ${info.studentClass} 班 ${info.studentSeat} 號 <strong>${info.studentName}</strong> | 得分：<strong>${info.score} 分</strong> | 繳交時間：${info.timestamp}
        </div>
        <div style="font-size: 0.85rem; color: #047857;">
          作答已即時儲存至教師試算表。若老師要求您重新修改作答，請點此：
          <a href="javascript:void(0)" onclick="resetSubmission('${weekId}')" style="color: #2563EB; font-weight: 700; text-decoration: underline;">重置作答狀態</a>
        </div>
      `;
      const firstCard = document.querySelector('.container .card');
      if (firstCard) {
        container.insertBefore(banner, firstCard);
      }
    }

    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.innerHTML = '✅ 已完成繳交 (系統已鎖定)';
      submitBtn.style.background = '#059669';
    }
  } catch (e) {
    console.error('Error checking submission status:', e);
  }
}

function resetSubmission(weekId) {
  if (confirm('您確定要重新填寫本週學習單嗎？已送出的作答將解除鎖定供您修改。')) {
    localStorage.removeItem('action115_submitted_' + weekId);
    location.reload();
  }
}

/**
 * 儲存填答草稿至 LocalStorage
 */
function saveDraft(weekId) {
  const data = {};
  const formElements = document.querySelectorAll('input, select, textarea');
  
  formElements.forEach(el => {
    if (el.type === 'checkbox') {
      if (!data[el.name]) data[el.name] = [];
      if (el.checked) data[el.name].push(el.value);
    } else if (el.type === 'radio') {
      if (el.checked) data[el.name] = el.value;
    } else {
      data[el.id || el.name] = el.value;
    }
  });

  localStorage.setItem('action115_draft_' + weekId, JSON.stringify(data));
  
  const statusEl = document.getElementById('saveStatus');
  if (statusEl) {
    statusEl.textContent = '✅ 已自動儲存';
    setTimeout(() => {
      statusEl.textContent = '💾 本地暫存安全';
    }, 2000);
  }
}

/**
 * 載入快取草稿
 */
function loadDraft(weekId) {
  const raw = localStorage.getItem('action115_draft_' + weekId);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    Object.keys(data).forEach(key => {
      const val = data[key];
      const el = document.getElementById(key) || document.querySelector('[name="' + key + '"]');
      if (!el) return;

      if (Array.isArray(val)) {
        val.forEach(itemVal => {
          const cb = document.querySelector('input[name="' + key + '"][value="' + itemVal + '"]');
          if (cb) cb.checked = true;
        });
      } else if (el.type === 'radio') {
        const rb = document.querySelector('input[name="' + key + '"][value="' + val + '"]');
        if (rb) rb.checked = true;
      } else {
        el.value = val;
      }
    });

    const statusEl = document.getElementById('saveStatus');
    if (statusEl) statusEl.textContent = '✨ 已恢復上次進度';
  } catch (err) {
    console.error('Failed to load draft:', err);
  }
}

/**
 * 提交學習單與自動評分
 */
async function submitWorksheet(weekId, scoreCalculator) {
  // 1. 防呆檢查必填基本資料
  const classVal = document.getElementById('studentClass')?.value;
  const seatVal = document.getElementById('studentSeat')?.value;
  const nameVal = document.getElementById('studentName')?.value?.trim();
  const groupVal = document.getElementById('studentGroup')?.value;

  let isValid = true;
  let firstErrorEl = null;

  function markInvalid(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('is-invalid');
      if (!firstErrorEl) firstErrorEl = el;
      el.addEventListener('input', () => el.classList.remove('is-invalid'), { once: true });
      el.addEventListener('change', () => el.classList.remove('is-invalid'), { once: true });
    }
    isValid = false;
  }

  if (!classVal) markInvalid('studentClass');
  if (!seatVal) markInvalid('studentSeat');
  if (!nameVal || nameVal.length < 2) markInvalid('studentName');
  if (!groupVal) markInvalid('studentGroup');

  if (!isValid) {
    alert('⚠️ 請填寫完整的班級、座號、姓名（至少2個字）與組別！');
    if (firstErrorEl) firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // 2. 收集所有作答資料
  const answers = {};
  const formElements = document.querySelectorAll('input, select, textarea');
  formElements.forEach(el => {
    if (el.type === 'checkbox') {
      if (!answers[el.name]) answers[el.name] = [];
      if (el.checked) answers[el.name].push(el.value);
    } else if (el.type === 'radio') {
      if (el.checked) answers[el.name] = el.value;
    } else {
      answers[el.id || el.name] = el.value;
    }
  });

  // 3. 計算即時分數
  const scoreResult = scoreCalculator(answers);

  // 4. 防重複點擊，鎖定按鈕
  const submitBtn = document.getElementById('submitBtn');
  const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ 正在提交學習單中...';
  }

  // 5. 準備送往 GAS 後端
  const payload = {
    timestamp: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
    weekId: weekId,
    studentClass: classVal,
    studentSeat: seatVal,
    studentName: nameVal,
    studentGroup: groupVal,
    score: scoreResult.total,
    scoreBreakdown: scoreResult.breakdown,
    answers: answers
  };

  if (COURSE_CONFIG.gasEndpoint && COURSE_CONFIG.gasEndpoint.startsWith('http')) {
    try {
      await fetch(COURSE_CONFIG.gasEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors'
      });
    } catch (e) {
      console.warn('GAS submission error (local will succeed):', e);
    }
  }

  // 6. 標記已提交以防重複交卷、清除草稿並彈出成績模態窗
  localStorage.setItem('action115_submitted_' + weekId, JSON.stringify(payload));
  localStorage.removeItem('action115_draft_' + weekId);
  showResultModal(payload, scoreResult);

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '✅ 已完成繳交';
    submitBtn.style.background = '#059669';
  }
}

/**
 * 顯示即時計分與完成彈窗
 */
function showResultModal(payload, scoreResult) {
  let modal = document.getElementById('resultModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'resultModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-icon">🎉</div>
      <h2 class="modal-title">學習單送出成功！</h2>
      <p style="color: var(--text-muted); font-size: 0.95rem;">
        ${payload.studentClass} 班 ${payload.studentSeat} 號 <strong>${payload.studentName}</strong> 同學
      </p>

      <div class="modal-score-box">
        <div class="modal-score-val">${scoreResult.total} <span style="font-size: 1.2rem;">分</span></div>
        <div class="modal-score-label">本節課完成度與系統初評分數</div>
      </div>

      <div class="modal-msg" style="text-align: left; background: #F8FAFC; padding: 0.8rem; border-radius: 8px; font-size: 0.9rem;">
        <div>📌 <strong>評分明細：</strong></div>
        ${scoreResult.breakdown.map(b => '<div>• ' + b + '</div>').join('')}
      </div>

      <div class="modal-actions">
        <button class="btn-secondary" onclick="document.getElementById('resultModal').classList.remove('active')">查看作答內容</button>
        <a href="index.html" class="btn-submit" style="padding: 0.7rem 1.5rem; text-decoration: none; width: auto; font-size: 1rem;">返回課程總覽</a>
      </div>
    </div>
  `;

  modal.classList.add('active');
}
