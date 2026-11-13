/* ==========================================================================
   桃園市楊光國中 115 學年度【行動方程式】彈性學習課程 共用前端腳本
   功能：防呆下拉選單生成、LocalStorage 離線自動快取、即時表單驗證、
         教師派發 QR Code 產生器與全螢幕白板投影彈窗
   ========================================================================== */

const COURSE_CONFIG = {
  // 班級陣列：未來若有新增或修改班級，直接在此陣列加入字串即可！
  classes: ['701', '702', '703', '704', '705', '706', '707', '708', '709', '710'],
  
  // 座號上限：固定 1 ~ 35 號
  maxSeatNumber: 35,

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

  // 2. 動態填充座號選單 (01 ~ 35 號)
  if (seatSelect) {
    seatSelect.innerHTML = '<option value="" disabled selected>請選擇座號</option>';
    const maxSeat = COURSE_CONFIG.maxSeatNumber || 35;
    for (let i = 1; i <= maxSeat; i++) {
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

  // 4. 綁定變更自動儲存與換班偵測
  if (classSelect) {
    classSelect.addEventListener('change', () => {
      handleClassChangeDetection(weekId, classSelect.value);
    });
  }

  const formElements = document.querySelectorAll('input, select, textarea');
  formElements.forEach(el => {
    el.addEventListener('input', () => saveDraft(weekId));
    el.addEventListener('change', () => saveDraft(weekId));
  });

  // 4.5 檢查 URL 參數是否包含換人重置指令 (?reset=1 或 ?fresh=1)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('reset') === '1' || urlParams.get('fresh') === '1') {
    localStorage.removeItem('action115_draft_' + weekId);
    localStorage.removeItem('action115_submitted_' + weekId);
    localStorage.removeItem('action115_timestamp_' + weekId);
    // 移除 URL 參數以保持乾淨
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // 4.8 ⏰ 課堂超時自動偵測 (40 分鐘推車換節判定：超過 40 分鐘自動銷毀舊草稿)
  checkSessionTimeout(weekId);

  // 5. 恢復快取草稿
  loadDraft(weekId);

  // 6. 🔍 檢查本地狀態（是否為上一位學生留存，或已繳交）
  checkStudentIdentityAndStatus(weekId);
}

/**
 * ⏰ 課堂超時過期檢查（專為 10 分鐘下課推平板車設計）
 * 若上一次填答或交卷時間超過 40 分鐘，判定為下一個班級，自動清空本機暫存
 */
function checkSessionTimeout(weekId) {
  const lastTimeRaw = localStorage.getItem('action115_timestamp_' + weekId);
  if (!lastTimeRaw) return;

  const lastTime = parseInt(lastTimeRaw, 10);
  const now = Date.now();
  const diffMinutes = (now - lastTime) / (1000 * 60);

  // 若超過 40 分鐘（一堂課結束推車換班）
  if (diffMinutes > 40) {
    console.log(`[Session Guard] 距離上次操作已超過 ${Math.round(diffMinutes)} 分鐘，自動清空舊班級暫存！`);
    localStorage.removeItem('action115_draft_' + weekId);
    localStorage.removeItem('action115_submitted_' + weekId);
    localStorage.removeItem('action115_timestamp_' + weekId);
  }
}

/**
 * 🚨 跨班級防滑鎖：當手動更換班級時，自動提示並清空上一班作答
 */
function handleClassChangeDetection(weekId, newClass) {
  const draftRaw = localStorage.getItem('action115_draft_' + weekId);
  if (!draftRaw) return;

  try {
    const draft = JSON.parse(draftRaw);
    if (draft.studentClass && draft.studentClass !== newClass) {
      if (confirm(`⚠️ 系統偵測到班級已切換為【${newClass} 班】！\n\n是否清空上一班（${draft.studentClass} 班）所留存的座號姓名與作答內容，讓您全新填寫？`)) {
        localStorage.removeItem('action115_draft_' + weekId);
        localStorage.removeItem('action115_submitted_' + weekId);
        // 保留新班級，清空其他欄位
        document.getElementById('studentSeat').value = '';
        document.getElementById('studentName').value = '';
        document.getElementById('studentGroup').value = '';
        document.querySelectorAll('textarea, input[type="text"]').forEach(input => {
          if (input.id !== 'studentClass') input.value = '';
        });
        document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(cb => cb.checked = false);
        saveDraft(weekId);
      }
    }
  } catch (e) {}
}

/**
 * 檢查身分與繳交狀態 (比照生物平台：防上一個同學沒關網頁導致錯交/覆蓋)
 */
function checkStudentIdentityAndStatus(weekId) {
  const submittedRaw = localStorage.getItem('action115_submitted_' + weekId);
  const draftRaw = localStorage.getItem('action115_draft_' + weekId);

  // 狀況 A：本地有已繳交的紀錄
  if (submittedRaw) {
    try {
      const info = JSON.parse(submittedRaw);
      showSubmittedBanner(weekId, info);
      showIdentityVerifyModal(weekId, info, true);
      return;
    } catch (e) {
      console.error(e);
    }
  }

  // 狀況 B：本地無已繳交，但有正在填寫的草稿基本資料
  if (draftRaw) {
    try {
      const draft = JSON.parse(draftRaw);
      if (draft.studentName && draft.studentClass && draft.studentSeat) {
        showIdentityVerifyModal(weekId, draft, false);
      }
    } catch (e) {}
  }
}

/**
 * 彈出身分覆核對話框（下課跑班平板車核心防呆：防止接續前一位作答）
 */
function showIdentityVerifyModal(weekId, prevData, isSubmitted) {
  let modal = document.getElementById('identityVerifyModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'identityVerifyModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const cls = prevData.studentClass || '';
  const seat = prevData.studentSeat || '';
  const name = prevData.studentName || '';

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 520px; border-top: 6px solid #2563EB;">
      <div style="font-size: 2.8rem; margin-bottom: 0.5rem;">👋</div>
      <h2 style="font-size: 1.4rem; color: #1E293B; font-weight: 800; margin-bottom: 0.4rem;">
        請確認使用身分
      </h2>
      <p style="color: #64748B; font-size: 0.95rem; margin-bottom: 1.2rem;">
        本平板目前留存上一位同學的作答紀錄：
      </p>

      <div style="background: #EFF6FF; border: 2px dashed #93C5FD; border-radius: 12px; padding: 1rem; margin-bottom: 1.5rem; text-align: center;">
        <span style="font-size: 1.25rem; font-weight: 800; color: #1D4ED8;">
          ${cls} 班 ${seat} 號 ${name}
        </span>
        <div style="font-size: 0.85rem; color: #3B82F6; margin-top: 0.3rem;">
          ${isSubmitted ? '✅ 該生已成功完成繳交' : '📝 該生尚有未送出的填寫草稿'}
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <button type="button" class="btn-submit" onclick="confirmSelfIdentity('${weekId}')" style="background: #2563EB; width: 100%; padding: 0.85rem;">
          🙋‍♂️ 我就是 ${name}（繼續檢視我的作答）
        </button>
        <button type="button" class="btn-secondary" onclick="startFreshWorksheet('${weekId}')" style="background: #FEE2E2; color: #DC2626; border: 1.5px solid #FCA5A5; width: 100%; padding: 0.85rem; font-weight: 800;">
          🔄 不是我，我是新同學（清空上一位，開始全新作答）
        </button>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function confirmSelfIdentity(weekId) {
  const modal = document.getElementById('identityVerifyModal');
  if (modal) modal.classList.remove('active');
}

/**
 * 徹底清空上一位學生紀錄，乾淨重新開局
 */
function startFreshWorksheet(weekId) {
  if (confirm('確定要開始全新填寫嗎？\n\n（點擊「確定」將清空此平板畫面上留存的上一位座號、姓名與答案，前一位同學已送出的成績不受任何影響）')) {
    localStorage.removeItem('action115_draft_' + weekId);
    localStorage.removeItem('action115_submitted_' + weekId);
    location.reload();
  }
}

/**
 * 顯示已成功繳交橫幅 (含明顯換人按鈕與扣分警告)
 */
function showSubmittedBanner(weekId, info) {
  const container = document.querySelector('.container');
  const existingBanner = document.getElementById('submittedNoticeBanner');
  if (existingBanner) existingBanner.remove();

  if (container) {
    // 檢查是否有扣分警示
    let hasPenalty = false;
    let penaltyTexts = [];
    if (info.scoreBreakdown) {
      const items = Array.isArray(info.scoreBreakdown) ? info.scoreBreakdown : [info.scoreBreakdown];
      penaltyTexts = items.filter(b => typeof b === 'string' && (b.includes('🚨') || b.includes('⚠️') || b.includes('(-')));
      if (penaltyTexts.length > 0) hasPenalty = true;
    }
    if (info.score !== undefined && info.score < 80) {
      hasPenalty = true;
    }

    const banner = document.createElement('div');
    banner.id = 'submittedNoticeBanner';

    if (hasPenalty) {
      banner.style.cssText = "background: #FEF2F2; border: 2px solid #EF4444; border-radius: 14px; padding: 1.2rem 1.4rem; margin-bottom: 1.6rem; color: #991B1B; text-align: center; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.15);";
      banner.innerHTML = `
        <div style="font-size: 1.25rem; font-weight: 800; margin-bottom: 0.3rem;">⚠️ 您已繳交本週學習單，但系統初評偵測到扣分提醒！</div>
        <div style="font-size: 1rem; margin-bottom: 0.4rem;">
          ${info.studentClass} 班 ${info.studentSeat} 號 <strong>${info.studentName}</strong> | 初評得分：<strong style="color: #DC2626; font-size: 1.25rem;">${info.score} 分</strong> | 繳交時間：${info.timestamp}
        </div>
        ${penaltyTexts.length > 0 ? `
          <div style="background: #FEE2E2; border-radius: 8px; padding: 0.6rem 0.9rem; margin: 0.5rem auto 0.8rem; max-width: 650px; text-align: left; font-size: 0.88rem; font-weight: 700; color: #B91C1C;">
            <div style="margin-bottom: 0.2rem;">🚨 扣分警告項目：</div>
            ${penaltyTexts.map(t => `<div>• ${t}</div>`).join('')}
          </div>
        ` : ''}
        <div style="display: flex; gap: 0.8rem; justify-content: center; align-items: center; flex-wrap: wrap; margin-top: 0.6rem;">
          <button onclick="resetSubmission('${weekId}')" style="background: #EA580C; color: #fff; border: none; border-radius: 8px; padding: 0.5rem 1.1rem; font-size: 0.9rem; font-weight: 800; cursor: pointer;">✏️ 重新修改填寫（消除扣分爭取高分）</button>
          <button id="resyncBtn" onclick="resyncSubmission('${weekId}')" style="background: #059669; color: #fff; border: none; border-radius: 8px; padding: 0.5rem 1rem; font-size: 0.9rem; font-weight: 700; cursor: pointer;">🔄 重新同步雲端</button>
          <button onclick="startFreshWorksheet('${weekId}')" style="background: #DC2626; color: #fff; border: none; border-radius: 8px; padding: 0.5rem 1.1rem; font-size: 0.9rem; font-weight: 800; cursor: pointer; box-shadow: 0 2px 6px rgba(220,38,38,0.25);">🔄 換下一位同學填寫</button>
        </div>
      `;
    } else {
      banner.style.cssText = "background: #ECFDF5; border: 2px solid #10B981; border-radius: 14px; padding: 1.2rem 1.4rem; margin-bottom: 1.6rem; color: #065F46; text-align: center; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.15);";
      banner.innerHTML = `
        <div style="font-size: 1.25rem; font-weight: 800; margin-bottom: 0.3rem;">🎉 您已成功繳交本週學習單！</div>
        <div style="font-size: 1rem; margin-bottom: 0.6rem;">
          ${info.studentClass} 班 ${info.studentSeat} 號 <strong>${info.studentName}</strong> | 初評得分：<strong>${info.score} 分</strong> | 繳交時間：${info.timestamp}
        </div>
        <div style="display: flex; gap: 0.8rem; justify-content: center; align-items: center; flex-wrap: wrap; margin-top: 0.6rem;">
          <button id="resyncBtn" onclick="resyncSubmission('${weekId}')" style="background: #059669; color: #fff; border: none; border-radius: 8px; padding: 0.5rem 1rem; font-size: 0.9rem; font-weight: 700; cursor: pointer;">🔄 若老師未看見成績，點此重新同步雲端</button>
          <button onclick="startFreshWorksheet('${weekId}')" style="background: #DC2626; color: #fff; border: none; border-radius: 8px; padding: 0.5rem 1.1rem; font-size: 0.9rem; font-weight: 800; cursor: pointer; box-shadow: 0 2px 6px rgba(220,38,38,0.25);">🔄 換下一位同學填寫（清除本機紀錄）</button>
        </div>
      `;
    }

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
}

/**
 * 重新將本地快取的繳交紀錄同步至 Google 試算表（解決 Wi-Fi 暫態斷線造成漏登）
 */
async function resyncSubmission(weekId) {
  const submittedRaw = localStorage.getItem('action115_submitted_' + weekId);
  if (!submittedRaw) {
    alert('⚠️ 查無本地繳交紀錄，請重新填寫送出！');
    return;
  }

  const resyncBtn = document.getElementById('resyncBtn');
  const oldText = resyncBtn ? resyncBtn.innerHTML : '';
  if (resyncBtn) {
    resyncBtn.disabled = true;
    resyncBtn.innerHTML = '⏳ 正在重新連線同步中...';
  }

  try {
    const payload = JSON.parse(submittedRaw);
    if (COURSE_CONFIG.gasEndpoint && COURSE_CONFIG.gasEndpoint.startsWith('http')) {
      await fetch(COURSE_CONFIG.gasEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors'
      });
    }
    alert('✅ 重新同步成功！資料已成功送達雲端試算表，請請老師重新整理儀表板查看。');
    if (resyncBtn) {
      resyncBtn.disabled = false;
      resyncBtn.innerHTML = '✅ 剛剛已重新同步成功！';
    }
  } catch (err) {
    alert('❌ 同步失敗：請檢查平板 Wi-Fi 網路連線是否通暢！');
    if (resyncBtn) {
      resyncBtn.disabled = false;
      resyncBtn.innerHTML = oldText;
    }
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
  localStorage.setItem('action115_timestamp_' + weekId, String(Date.now()));
  
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
 * 檢查文字是否為敷衍、重複亂碼、語音雜訊或離題詞彙
 */
function checkIsNonsense(rawText) {
  if (!rawText) return false;
  const text = String(rawText).trim();
  if (text.length === 0) return false;

  // 1. 連續 3 個以上相同字元 (例如：高高高、給給給、？？？、喔喔喔、哈哈哈哈)
  if (/(.)\1{2,}/u.test(text)) {
    return true;
  }

  // 2. 敷衍／語音雜訊／同儕聊天／離題黑名單詞彙
  const nonsenseBlacklist = [
    '不知道', '隨便', '沒意見', '看手機', '猜誰', '去玩', '笑死', '無言', 
    '不知道寫啥', '不知寫啥', '哈哈', '啦啦', '喔喔', '誒誒', '欸欸', 
    '可可去誒', '給給高', '隨便寫', '隨便填', '不想寫', '跳過', '無聊',
    '快去誒', '看誒給給', '猜猜看', '我是誰', '沒有', '沒想法', '不知道啦'
  ];
  for (const word of nonsenseBlacklist) {
    if (text.includes(word)) {
      return true;
    }
  }

  // 3. 字元多樣性檢驗 (長度>=8 但不同字元太少，例如「高給高給給高高」)
  if (text.length >= 8) {
    const cleanChars = text.replace(/[\s\p{P}]/gu, '');
    const uniqueChars = new Set(cleanChars).size;
    if (uniqueChars <= 3) {
      return true;
    }
  }

  return false;
}

/**
 * 桃園市楊光國中【行動方程式】各單元專屬學術評分規準與關鍵字庫
 */
const UNIT_EVALUATION_CONFIG = {
  '1': {
    name: '第 1 週：美麗的海岸線——還原自然',
    baseScore: 78,
    questions: [
      {
        id: 'w1_q1',
        name: '任務一 [常見廢棄物種類]',
        isCombo: true,
        subIds: ['w1_q1_1', 'w1_q1_2', 'w1_q1_3'],
        keywords: ['寶特瓶', '塑膠', '保麗龍', '漁網', '吸管', '瓶蓋', '鐵罐', '玻璃', '菸蒂', '免洗餐具', '袋'],
        weight: 2
      },
      {
        id: 'w1_q2',
        name: '任務一 [觸動畫面與省思]',
        minLen: 15,
        keywords: ['淨灘', '老外', 'Daniel', '海洋', '心痛', '感動', '責任', '汗水', '撿', '守護', '污染', '美麗', '垃圾', '台灣'],
        weight: 3.5
      },
      {
        id: 'w1_q3',
        name: '任務二 [廢棄物來源管道]',
        minLen: 12,
        keywords: ['河川', '溪流', '陸地', '漁業', '漁船', '觀光', '遊客', '亂丟', '沖刷', '生活', '排水', '雨水'],
        weight: 3.5
      },
      {
        id: 'w1_q4',
        name: '任務二 [淨灘治標 vs 減塑治本]',
        minLen: 15,
        keywords: ['治標', '治本', '源頭', '減塑', '習慣', '減量', '根本', '循環', '撿不完', '塑膠袋', '自備', '一次性', '回收'],
        weight: 4
      }
    ],
    actionsId: 'w1_actions'
  },

  '2': {
    name: '第 2 週：美麗的海岸線——台灣海底垃圾',
    baseScore: 78,
    questions: [
      {
        id: 'w2_q1',
        name: '任務一 [海底廢棄物前3名]',
        isCombo: true,
        subIds: ['w2_q1_1', 'w2_q1_2', 'w2_q1_3'],
        keywords: ['刺網', '廢棄', '漁網', '塑膠', '袋', '瓶', '輪胎', '鐵罐', '保麗龍', '垃圾'],
        weight: 2
      },
      {
        id: 'w2_q2',
        name: '任務一 [水下震撼心疼畫面]',
        minLen: 15,
        keywords: ['海底', '珊瑚', '魚', '海龜', '纏繞', '覆蓋', '窒息', '死亡', '黑暗', '垃圾海', '白化', '受困', '心疼'],
        weight: 3.5
      },
      {
        id: 'w2_q3',
        name: '任務二 [幽靈捕撈惡性循環]',
        minLen: 15,
        keywords: ['刺網', '幽靈捕撈', '纏繞', '誘餌', '死亡', '溺斃', '惡性循環', '獵捕', '無法掙脫', '廢棄'],
        weight: 4
      },
      {
        id: 'w2_q4',
        name: '任務二 [海底垃圾對珊瑚與海龜傷害]',
        minLen: 15,
        keywords: ['珊瑚', '白化', '覆蓋', '缺氧', '海龜', '誤食', '塑膠袋', '水母', '窒息', '微塑膠', '食物鏈', '致死'],
        weight: 3.5
      }
    ],
    actionsId: 'w2_actions'
  },

  '3': {
    name: '第 3 週：環保無國界——雨林·生存臨界點',
    baseScore: 78,
    questions: [
      {
        id: 'w3_q1',
        name: '任務一 [雨林縮減氣候影響]',
        isCombo: true,
        subIds: ['w3_q1_1', 'w3_q1_2'],
        keywords: ['碳排放', '二氧化碳', '溫室效應', '降雨', '乾旱', '氣溫', '極端氣候', '火災', '暖化', '臨界點'],
        weight: 2
      },
      {
        id: 'w3_q2',
        name: '任務一 [護林者與原住民信念]',
        minLen: 15,
        keywords: ['守護', '保護', '勇敢', '原住民', '護林員', '土地', '犧牲', '堅持', '威脅', '生命', '家園', '捍衛'],
        weight: 4
      },
      {
        id: 'w3_q3',
        name: '任務二 [碳循環與地球之肺運作]',
        minLen: 15,
        keywords: ['光合作用', '二氧化碳', '氧氣', '吸收', '呼吸', '碳儲存', '地球之肺', '調節', '暖化'],
        weight: 3.5
      },
      {
        id: 'w3_q4',
        name: '任務二 [跨國公民守護責任]',
        minLen: 15,
        keywords: ['跨國', '責任', '消費', '減少', '木材', '牛肉', '國際', '地球公民', '關注', '永續', '行動'],
        weight: 3.5
      }
    ],
    actionsId: 'w3_actions'
  },

  '4': {
    name: '第 4 週：環保無國界——雨林·生存臨界點 (探究篇)',
    baseScore: 78,
    questions: [
      {
        id: 'w4_q1',
        name: '任務一 [全球性氣候影響]',
        isCombo: true,
        subIds: ['w4_q1_1', 'w4_q1_2'],
        keywords: ['碳排放', '二氧化碳', '溫室效應', '降雨', '乾旱', '循環', '極端氣候', '暖化', '臨界點'],
        weight: 2
      },
      {
        id: 'w4_q2',
        name: '任務一 [護林者捍衛土地啟發]',
        minLen: 15,
        keywords: ['守護', '保護', '勇敢', '信念', '原住民', '土地', '堅持', '犧牲', '生命', '啟發', '家園', '感動'],
        weight: 4
      },
      {
        id: 'w4_q3',
        name: '任務二 [生活商品成分探究]',
        minLen: 12,
        keywords: ['棕櫚油', '大豆', '大豆油', '紙漿', '木材', '牛肉', '砍伐', '森林', '棲地', '零食', '洗髮精'],
        weight: 3.5
      },
      {
        id: 'w4_q4',
        name: '任務二 [國中生綠色倡議力量]',
        minLen: 15,
        keywords: ['FSC', '標章', '認證', '綠色消費', '抵制', '倡議', '企業', '校園', '自備', '永續', '選擇', '少用'],
        weight: 3.5
      }
    ],
    actionsId: 'w4_actions'
  },

  '5': {
    name: '第 5 週：地球公民——環境保育一起來',
    baseScore: 78,
    questions: [
      {
        id: 'w5_q0_symptom',
        name: '任務一 [地球會診危機與責任思辨]',
        minLen: 12,
        keywords: ['昏迷', '病徵', '暖化', '高溫', '垃圾', '海廢', '塑膠', '氣候', '真兇', '人類', '責任', '公民'],
        weight: 2.5
      },
      {
        id: 'w5_q1_spirit',
        name: '任務一 [世界地球日由來與精神]',
        minLen: 10,
        keywords: ['地球日', '4月22', '4/22', '覺醒', '倡議', '法案', '草根', '學生', '守護', '綠色'],
        weight: 2.5
      },
      {
        id: 'w5_q2_aim',
        name: '任務一 [世界清潔日時間與主旨]',
        minLen: 10,
        keywords: ['清潔日', '9月', '清理', '動手', '實踐', '愛沙尼亞', '志工', '垃圾', '廢棄物'],
        weight: 2.5
      },
      {
        id: 'w5_q3_content',
        name: '任務二 [全球綠色案例資訊統整]',
        minLen: 15,
        keywords: ['案例', '政策', '禁塑', '減塑', '押金', '清理', '回收', '減碳', '法律', '國家', '永續', '科技'],
        weight: 3.5
      },
      {
        id: 'w5_roles',
        name: '任務三 [下週成果發表團隊分工]',
        isRoleCheck: true,
        roleKeys: ['w5_leader', 'w5_searcher', 'w5_designer', 'w5_presenter'],
        weight: 3
      }
    ],
    actionsId: null
  },

  '6': {
    name: '第 6-7 週：地球公民——環境保育一起來之『發表會』',
    baseScore: 78,
    questions: [
      {
        id: 'w6_my_title',
        name: '任務一 [本組發表成果]',
        minLen: 5,
        keywords: ['報告', '發表', '主題', '環保', '分工', '分享', '多元表達'],
        weight: 2
      },
      {
        id: 'w6_peer_feedback',
        name: '任務二 [同儕亮點學習反饋]',
        minLen: 15,
        keywords: ['優點', '認真', '清楚', '簡報', '表達', '精彩', '學習', '條理', '內容', '生動', '完整'],
        weight: 4
      },
      {
        id: 'w6_reflection',
        name: '任務三 [發表會最大收穫與體悟]',
        minLen: 12,
        keywords: ['收穫', '合作', '進步', '溝通', '表達', '地球公民', '實踐', '永續', '未來', '改善'],
        weight: 3.5
      },
      {
        id: 'w6_action',
        name: '任務三 [生活綠色永續行動承諾]',
        minLen: 10,
        keywords: ['生活', '行動', '減塑', '隨手', '自備', '省水', '節能', '宣傳', '堅持', '習慣'],
        weight: 3.5
      }
    ],
    actionsId: null
  },

  '8': {
    name: '第 8 週：還我安靜的環境——噪音對生態環境的影響',
    baseScore: 78,
    questions: [
      {
        id: 'w8_speed',
        name: '任務一 [水中音速科學數據探索]',
        minLen: 4,
        keywords: ['1500', '公尺', '4', '倍', '速度', '快', '傳播'],
        weight: 2
      },
      {
        id: 'w8_noise',
        name: '任務一 [人為水下三大噪音來源]',
        isCombo: true,
        subIds: ['w8_noise_1', 'w8_noise_2', 'w8_noise_3'],
        keywords: ['離岸風電', '打樁', '船隻', '引擎', '螺旋槳', '聲納', '爆破', '施工', '探勘', '噪音'],
        weight: 2.5
      },
      {
        id: 'w8_masking',
        name: '任務二 [聲學遮蔽致命影響]',
        minLen: 15,
        keywords: ['聲學遮蔽', '回聲定位', '導航', '覓食', '溝通', '聽覺', '遮蓋', '聽不見', '障礙', '迷失', '受損'],
        weight: 4
      },
      {
        id: 'w8_solution',
        name: '任務二 [工程減噪友善解方]',
        minLen: 15,
        keywords: ['氣泡', '帷幕', '減速', '減噪', '監測', '觀測員', '友善', '降噪', '替代工法', '緩衝'],
        weight: 3.5
      }
    ],
    actionsId: 'w8_actions'
  },

  '9': {
    name: '第 9 週：還我安靜的環境——噪音專題分享與寧靜生活',
    baseScore: 78,
    questions: [
      {
        id: 'w9_topic',
        name: '任務一 [本組噪音專題分享名稱]',
        minLen: 5,
        keywords: ['專題', '噪音', '生態', '分貝', '實驗', '數據', '調查', '影響', '報告', '減噪', '海豚'],
        weight: 2
      },
      {
        id: 'w9_discovery',
        name: '任務一 [核心發現與友善降噪解方]',
        isCombo: true,
        subIds: ['w9_discovery_1', 'w9_discovery_2'],
        keywords: ['發現', '降低', '分貝', '氣泡', '減速', '航線', '避開', '保護區', '解方'],
        weight: 3
      },
      {
        id: 'w9_peer_highlight',
        name: '任務二 [聆聽同儕發表亮點]',
        minLen: 15,
        keywords: ['優點', '精彩', '深入', '清楚', '簡報', '數據', '例子', '說明', '條理', '生動'],
        weight: 3.5
      },
      {
        id: 'w9_peer_question',
        name: '任務二 [思辨提問與同儕討論]',
        minLen: 10,
        keywords: ['提問', '請問', '為什麼', '測量', '改善', '影響', '方法', '可能性', '建議', '如何'],
        weight: 3.5
      }
    ],
    actionsId: 'w9_actions'
  }
,

  '10': {
    name: '第 10 週：與自然有約——專書閱讀',
    baseScore: 78,
    questions: [
      {
        id: 'w10_soundscape',
        name: '任務一 [聲景三元素與寂靜山徑]',
        isCombo: true,
        subIds: ['w10_q1_mountain', 'w10_q1_bio', 'w10_q1_geo', 'w10_q1_anthro'],
        keywords: ['太平', '生物', '環境', '人為'],
        weight: 3
      },
      {
        id: 'w10_laisang',
        name: '任務一 [賴桑三不政策]',
        isCombo: true,
        subIds: ['w10_q2_policy1', 'w10_q2_policy2', 'w10_q2_policy3'],
        keywords: ['砍', '買', '賣', '子孫', '後代', '私有'],
        weight: 2.5
      },
      {
        id: 'w10_reflection',
        name: '任務二 [心靈啟發與深度思辨]',
        minLen: 15,
        keywords: ['堅持', '無私', '守護', '自然', '生命', '永續', '感動', '尊重', '承諾', '傻子', '綠色', '責任'],
        weight: 3.5
      },
      {
        id: 'w10_book_reasons',
        name: '任務二 [小組選書與選擇理由]',
        isCombo: true,
        subIds: ['w10_book_title', 'w10_book_author', 'w10_book_reason1', 'w10_book_reason2'],
        keywords: ['生態', '環境', '閱讀', '動物', '森林', '海洋', '故事', '啟發', '共讀', '發表'],
        weight: 3
      }
    ],
    actionsId: 'w10_actions'
  }
,

  '11': {
    name: '第 11 週：與自然有約——專書共讀與角色分工',
    baseScore: 78,
    questions: [
      {
        id: 'w11_book_info',
        name: '任務一 [共讀專書與架構]',
        isCombo: true,
        subIds: ['w11_book_title', 'w11_book_author', 'w11_book_structure'],
        keywords: ['章', '生態', '環境', '自然', '探討', '危機', '保護', '閱讀', '故事'],
        weight: 3
      },
      {
        id: 'w11_quote_info',
        name: '任務一 [靈魂金句與頁碼]',
        isCombo: true,
        subIds: ['w11_core_quote', 'w11_quote_page'],
        keywords: ['P', 'p', '頁', '自然', '心', '生命', '安靜', '樹', '林', '愛', '人'],
        weight: 2
      },
      {
        id: 'w11_roles',
        name: '任務二 [團隊四角角色分工]',
        isRoleCheck: true,
        roleKeys: ['w11_role_leader', 'w11_role_recorder', 'w11_role_visual', 'w11_role_presenter'],
        weight: 3.5
      },
      {
        id: 'w11_contribution',
        name: '任務二 [個人今日具體貢獻]',
        minLen: 15,
        keywords: ['閱讀', '負責', '整理', '討論', '金句', '章節', '想法', '提議', '角色', '摘要'],
        weight: 3.5
      }
    ],
    actionsId: 'w11_actions'
  }
,

  '12': {
    name: '第 12 週：與自然有約之『小組會議（一）』——專書拆解與觀點萃取',
    baseScore: 78,
    questions: [
      {
        id: 'w12_orid_facts',
        name: '任務一 [ORID 事實與感受]',
        isCombo: true,
        subIds: ['w12_orid_o', 'w12_orid_r'],
        keywords: ['生態', '數據', '森林', '聲音', '破壞', '樹', '保護', '感動', '敬佩', '心疼', '震撼'],
        weight: 3
      },
      {
        id: 'w12_orid_insights',
        name: '任務一 [ORID 詮釋與行動]',
        isCombo: true,
        subIds: ['w12_orid_i', 'w12_orid_d'],
        keywords: ['永續', '觀念', '反省', '改變', '行動', '生活', '校園', '自然', '生命', '自備', '分享'],
        weight: 3
      },
      {
        id: 'w12_roles',
        name: '任務二 [角色成果推進簽核]',
        isRoleCheck: true,
        roleKeys: ['w12_role_leader', 'w12_role_recorder', 'w12_role_visual', 'w12_role_presenter'],
        weight: 3.5
      },
      {
        id: 'w12_contribution',
        name: '任務二 [個人今日最大實質貢獻]',
        minLen: 15,
        keywords: ['討論', '提出', '觀點', '整理', '紀錄', '簡報', '開場', '想法', '負責', '重點'],
        weight: 3.5
      }
    ],
    actionsId: 'w12_actions'
  }
,

  '13': {
    name: '第 13 週：與自然有約之『小組會議（二）』——創意發表策劃與彩排演練',
    baseScore: 78,
    questions: [
      {
        id: 'w13_plan_flow',
        name: '任務一 [4分鐘流程規劃]',
        isCombo: true,
        subIds: ['w13_plan_intro', 'w13_plan_core', 'w13_plan_action'],
        keywords: ['開場', '故事', '核心', '生態', '危機', '行動', '生活', '分享', '提問', '問題', '數據', '啟發'],
        weight: 3.5
      },
      {
        id: 'w13_roles',
        name: '任務二 [登台四角責任分工簽核]',
        isRoleCheck: true,
        roleKeys: ['w13_role_intro', 'w13_role_analyst', 'w13_role_tech', 'w13_role_qa'],
        weight: 3.5
      },
      {
        id: 'w13_speech',
        name: '任務二 [個人登台台詞與任務]',
        minLen: 15,
        keywords: ['負責', '台上', '講', '分享', '說明', '開場', '介紹', '操作', '提問', '簡報', '重點'],
        weight: 3
      },
      {
        id: 'w13_rehearsal',
        name: '任務三 [彩排時間與微調檢核]',
        isCombo: true,
        subIds: ['w13_rehearsal_min', 'w13_rehearsal_sec', 'w13_rehearsal_note'],
        keywords: ['時間', '放慢', '音量', '切換', '流暢', '太快', '超時', '加強', '簡報', '聲音'],
        weight: 2.5
      }
    ],
    actionsId: 'w13_actions'
  }
,

  '14': {
    name: '第 14 週：與自然有約之『小組發表會（場次一）』',
    baseScore: 78,
    questions: [
      {
        id: 'w14_self',
        name: '任務一 [本組展演表現自評]',
        minLen: 15,
        keywords: ['默契', '台風', '時間', '發表', '準備', '簡報', '開場', '順利', '優點', '亮點'],
        weight: 3
      },
      {
        id: 'w14_peer1',
        name: '任務二 [同儕回饋與給星 ①]',
        isCombo: true,
        subIds: ['w14_peer1_group', 'w14_peer1_book', 'w14_peer1_praise'],
        keywords: ['精彩', '棒', '清楚', '好', '生動', '深入', '讚', '數據', '金句', '流暢', '啟發'],
        weight: 3
      },
      {
        id: 'w14_peer2',
        name: '任務二 [同儕回饋與給星 ②]',
        isCombo: true,
        subIds: ['w14_peer2_group', 'w14_peer2_book', 'w14_peer2_praise'],
        keywords: ['精彩', '棒', '清楚', '好', '生動', '深入', '讚', '數據', '金句', '流暢', '啟發'],
        weight: 3
      },
      {
        id: 'w14_question_insight',
        name: '任務二&三 [深度思辨提問與觀點共鳴]',
        isCombo: true,
        subIds: ['w14_peer_question', 'w14_deep_insight'],
        keywords: ['請問', '為什麼', '如何', '生態', '自然', '生命', '改變', '感動', '想法', '行動', '保護'],
        weight: 3
      }
    ],
    actionsId: 'w14_actions'
  }
,

  '15': {
    name: '第 15 週：與自然有約之『小組發表會（場次二）』＆ 共讀總策展',
    baseScore: 78,
    questions: [
      {
        id: 'w15_self',
        name: '任務一 [本組展演表現自評]',
        minLen: 15,
        keywords: ['默契', '台風', '時間', '發表', '準備', '簡報', '開場', '順利', '優點', '亮點'],
        weight: 3
      },
      {
        id: 'w15_peer1',
        name: '任務二 [同儕回饋與給星 ①]',
        isCombo: true,
        subIds: ['w15_peer1_group', 'w15_peer1_book', 'w15_peer1_praise'],
        keywords: ['精彩', '棒', '清楚', '好', '生動', '深入', '讚', '數據', '金句', '流暢', '啟發'],
        weight: 3
      },
      {
        id: 'w15_peer2',
        name: '任務二 [同儕回饋與給星 ②]',
        isCombo: true,
        subIds: ['w15_peer2_group', 'w15_peer2_book', 'w15_peer2_praise'],
        keywords: ['精彩', '棒', '清楚', '好', '生動', '深入', '讚', '數據', '金句', '流暢', '啟發'],
        weight: 3
      },
      {
        id: 'w15_vote_pledge',
        name: '任務三 [書海票選與綠色行動宣言]',
        isCombo: true,
        subIds: ['w15_vote_book', 'w15_vote_reason', 'w15_action_pledge'],
        keywords: ['借', '書', '推薦', '因為', '行動', '生活', '承諾', '改變', '環保', '自然', '減塑', '珍惜'],
        weight: 3
      }
    ],
    actionsId: 'w15_actions'
  }
};

/**
 * 素養導向全單元標準評量計分引擎
 * 核心規則：
 * 1. 基礎繳交分 78 分
 * 2. 敷衍／重複疊字／語音雜訊 🚨 扣 10 分
 * 3. 留白未填 ⚠️ 扣 5 分
 * 4. 關鍵字與字數階梯給分 (有回答且切題才給分)
 * 5. 🛡️【嚴格守門機制】：非全題特優者，分數嚴格封頂在 93 分以下，絕不輕易給 94 分以上！
 */
function evaluateUnitWorksheet(weekId, answers) {
  const cfg = UNIT_EVALUATION_CONFIG[String(weekId)];
  if (!cfg) {
    // 預設容錯
    return { total: 80, breakdown: ["🎯 學習單完成與提交基礎分 (80分)"] };
  }

  let score = cfg.baseScore || 78;
  let breakdown = [`🎯 學習單完成與提交基礎分 (${score}分)`];
  let bonus = 0;
  let penalty = 0;
  let excellentCount = 0;
  let coreQuestionsCount = 0;

  // 1. 逐題進行深度評量
  cfg.questions.forEach(q => {
    // 組合填空題 (如 w1_q1_1, w1_q1_2, w1_q1_3)
    if (q.isCombo && q.subIds) {
      coreQuestionsCount++;
      let filledCount = 0;
      let hasNonsense = false;
      q.subIds.forEach(sId => {
        const val = (answers[sId] || "").trim();
        if (checkIsNonsense(val)) hasNonsense = true;
        if (val.length >= 2) filledCount++;
      });

      if (hasNonsense) {
        penalty += 10;
        breakdown.push(`🚨 ${q.name} 偵測到敷衍/語音無意義文字 (-10分)`);
      } else if (filledCount === q.subIds.length) {
        bonus += q.weight || 2;
        excellentCount++;
        breakdown.push(`💡 ${q.name} 觀察記錄確實完整 (+${q.weight || 2}分)`);
      } else if (filledCount > 0) {
        bonus += 1;
        breakdown.push(`📝 ${q.name} 部分記錄填寫 (+1分)`);
      } else {
        penalty += 5;
        breakdown.push(`⚠️ ${q.name} 未填寫留白 (-5分)`);
      }
      return;
    }

    // 團隊分工檢核題 (w5_roles)
    if (q.isRoleCheck && q.roleKeys) {
      coreQuestionsCount++;
      const allRolesFilled = q.roleKeys.every(k => (answers[k] || "").trim().length >= 2);
      if (allRolesFilled) {
        bonus += q.weight || 3;
        excellentCount++;
        breakdown.push(`🤝 ${q.name} 團隊職責分工明確確實 (+${q.weight || 3}分)`);
      } else {
        breakdown.push(`⚠️ ${q.name} 未完整填寫團隊角色 (+0分)`);
      }
      return;
    }

    // 一般問答/簡答題
    coreQuestionsCount++;
    const text = (answers[q.id] || "").trim();

    // A. 敷衍／語音雜訊檢驗
    if (checkIsNonsense(text)) {
      penalty += 10;
      breakdown.push(`🚨 ${q.name} 偵測到敷衍/非相關文字 (-10分)`);
      return;
    }

    // B. 空白未填
    if (!text || text.length === 0) {
      penalty += 5;
      breakdown.push(`⚠️ ${q.name} 未作答留白 (-5分)`);
      return;
    }

    // C. 關鍵字命中計算
    const hitKeywords = (q.keywords || []).filter(kw => text.includes(kw));
    const hitCount = hitKeywords.length;
    const minRequiredLen = q.minLen || 12;

    // D. 階梯計分
    if (hitCount >= 2 && text.length >= (minRequiredLen + 6)) {
      // 特優等級 (命中2個關鍵字且字數充實)
      bonus += q.weight || 3.5;
      excellentCount++;
      breakdown.push(`🌟 ${q.name} 核心概念深刻且論述完整 (+${q.weight || 3.5}分)`);
    } else if (hitCount >= 1 && text.length >= minRequiredLen) {
      // 良好等級 (命中1個關鍵字且字數達標)
      const gWeight = Math.max(1.5, (q.weight || 3.5) - 1.5);
      bonus += gWeight;
      breakdown.push(`💡 ${q.name} 切中主題核心重點 (+${gWeight}分)`);
    } else if (text.length >= 15) {
      // 具體但未命中核心關鍵字
      bonus += 1;
      breakdown.push(`📝 ${q.name} 回答具體但核心概念可更深入 (+1分)`);
    } else {
      // 簡略回答 (無關鍵字且字數少)
      breakdown.push(`📝 ${q.name} 簡略作答 (+0分)`);
    }
  });

  // 2. 檢核表與生活行動加分 (最多 +3 分)
  if (answers.check1 === 'yes' && answers.check2 === 'yes' && answers.check3 === 'yes') {
    bonus += 2;
    breakdown.push("🌟 課堂自我檢核落實 (+2分)");
  }
  if (cfg.actionsId && Array.isArray(answers[cfg.actionsId]) && answers[cfg.actionsId].length >= 2) {
    bonus += 1;
    breakdown.push("🌱 具體實踐承諾落實 (+1分)");
  }

  // 3. 🛡️【嚴格守門：不輕易超過 94 分】機制
  let rawScore = Math.round(score + bonus - penalty);

  if (rawScore > 94) {
    // 只要有任何一題未達特優，或曾有扣分，嚴格封頂在 93 分！
    if (excellentCount < coreQuestionsCount || penalty > 0) {
      rawScore = 93;
      breakdown.push("📌 (需所有問答皆達特優深入水準，總分方可超過 94 分)");
    }
  }

  // 4. 最低保底 60，最高 100
  let finalScore = Math.max(60, Math.min(100, rawScore));
  return { total: finalScore, breakdown };
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

  // 1.2 檢查自我檢核表是否完成自評（防滑水未看題目就交卷）
  const check1Selected = document.querySelector('input[name="check1"]:checked');
  const check2Selected = document.querySelector('input[name="check2"]:checked');
  const check3Selected = document.querySelector('input[name="check3"]:checked');
  if (document.querySelector('input[name="check1"]') && (!check1Selected || !check2Selected || !check3Selected)) {
    alert('⚠️ 請完成下方的「學習表現自我檢核表」，誠實自評各項學習表現後再送出！');
    const chkTable = document.querySelector('.check-table');
    if (chkTable) chkTable.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // 1.3 特殊單選題檢查（例如第 8 週選擇題）
  if (weekId === '8') {
    const senseSelected = document.querySelector('input[name="w8_sense"]:checked');
    if (!senseSelected) {
      alert('⚠️ 任務一第 3 題「海豚的生存感知之眼」尚未選擇答案，請點選後再送出！');
      const senseEl = document.querySelector('input[name="w8_sense"]');
      if (senseEl) senseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
  }

  // 1.5 🔍 雙重送出確認對話框 (顯示班級、座號、姓名確認，防手滑與防冒名)
  const confirmSubmit = await new Promise(resolve => {
    let confirmModal = document.getElementById('submitConfirmModal');
    if (!confirmModal) {
      confirmModal = document.createElement('div');
      confirmModal.id = 'submitConfirmModal';
      confirmModal.className = 'modal-overlay';
      document.body.appendChild(confirmModal);
    }

    confirmModal.innerHTML = `
      <div class="modal-content" style="max-width: 480px; text-align: center;">
        <div style="font-size: 2.8rem; margin-bottom: 0.5rem;">📋</div>
        <h2 style="font-size: 1.35rem; color: #1E293B; font-weight: 800; margin-bottom: 0.3rem;">準備交卷確認</h2>
        <p style="color: #64748B; font-size: 0.95rem; margin-bottom: 1.2rem;">請仔細核對您的身分資料是否正確：</p>

        <div style="background: #F8FAFC; border: 2px solid #E2E8F0; border-radius: 12px; padding: 1.1rem; margin-bottom: 1.5rem;">
          <div style="font-size: 1.35rem; font-weight: 800; color: #0F172A; margin-bottom: 0.3rem;">
            ${classVal} 班 <span style="color: #059669;">${seatVal} 號</span>
          </div>
          <div style="font-size: 1.2rem; font-weight: 800; color: #2563EB;">
            ${nameVal} <span style="font-size: 0.95rem; font-weight: 500; color: #64748B;">(${groupVal})</span>
          </div>
          <p style="font-size: 0.85rem; color: #DC2626; margin-top: 0.6rem; font-weight: 600;">
            ⚠️ 請確認這是您本人的資料！若非本人請點「返回修改」。
          </p>
        </div>

        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <button type="button" id="confirmSubmitBtnYes" class="btn-submit" style="flex: 1; padding: 0.85rem; background: #059669; font-weight: 800;">
            🚀 確認是我，正式送出
          </button>
          <button type="button" id="confirmSubmitBtnNo" class="btn-secondary" style="flex: 1; padding: 0.85rem; font-weight: 700;">
            返回修改
          </button>
        </div>
      </div>
    `;

    confirmModal.classList.add('active');

    document.getElementById('confirmSubmitBtnYes').onclick = () => {
      confirmModal.classList.remove('active');
      resolve(true);
    };
    document.getElementById('confirmSubmitBtnNo').onclick = () => {
      confirmModal.classList.remove('active');
      resolve(false);
    };
  });

  if (!confirmSubmit) {
    return; // 學生取消交卷
  }

  // 1.8 重複繳交防呆確認 (若先前已繳交過)
  const existingSubmission = localStorage.getItem('action115_submitted_' + weekId);
  if (existingSubmission) {
    try {
      const prev = JSON.parse(existingSubmission);
      const prevTime = prev.timestamp || '先前';
      const prevScore = (prev.score !== undefined) ? `${prev.score} 分` : '已計分';
      const confirmResubmit = confirm(
        `⚠️ 系統提示：\n\n您先前已於【${prevTime}】送出過本週學習單（初評成績：${prevScore}）。\n\n您確定要再次送出，並以「最新的作答內容與分數」覆蓋雲端試算表嗎？`
      );
      if (!confirmResubmit) {
        return; // 學生取消送出，終止後續動作
      }
    } catch (e) {}
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

  let uploadSuccess = true;
  if (COURSE_CONFIG.gasEndpoint && COURSE_CONFIG.gasEndpoint.startsWith('http')) {
    let sendOk = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await fetch(COURSE_CONFIG.gasEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          mode: 'no-cors'
        });
        sendOk = true;
        break;
      } catch (e) {
        console.warn(`第 ${attempt} 次連線同步失敗:`, e);
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1200)); // 間隔 1.2 秒後自動重試
        }
      }
    }
    if (!sendOk) {
      uploadSuccess = false;
    }
  }

  // 5.5 若網路完全中斷，主動提醒學生，不鎖死表單，確保分數不漏失
  if (!uploadSuccess) {
    alert('⚠️ 雲端同步失敗（學校 Wi-Fi 訊號不穩或暫時斷線）！\n\n請不要離開此畫面，確認平板 Wi-Fi 連線正常後，再次點擊「重新送出學習單」！\n（您的所有作答內容均完整保存在畫面上，不會遺失）');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '🔄 重新送出學習單';
      submitBtn.style.background = '#EA580C'; // 醒目橘色提醒重試
    }
    return;
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
 * 顯示即時計分與完成彈窗 (若有扣分直接醒目突顯原因以示警惕)
 */
function showResultModal(payload, scoreResult) {
  let modal = document.getElementById('resultModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'resultModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const breakdownList = scoreResult.breakdown || [];
  const penaltyItems = breakdownList.filter(b => typeof b === 'string' && (b.includes('🚨') || b.includes('⚠️') || b.includes('(-')));
  const hasPenalties = penaltyItems.length > 0;

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 520px;">
      <div class="modal-icon">
        ${hasPenalties ? '🚨' : '🎉'}
      </div>
      <h2 class="modal-title" style="${hasPenalties ? 'color: #DC2626;' : ''}">
        ${hasPenalties ? '學習單已送出（初評含扣分警告）' : '學習單送出成功！'}
      </h2>
      <p style="color: var(--text-muted); font-size: 0.95rem;">
        ${payload.studentClass} 班 ${payload.studentSeat} 號 <strong>${payload.studentName}</strong> 同學
      </p>

      <div class="modal-score-box" style="${hasPenalties ? 'background: #FEF2F2; border: 2px solid #EF4444;' : ''}">
        <div class="modal-score-val" style="${hasPenalties ? 'color: #DC2626;' : ''}">
          ${scoreResult.total} <span style="font-size: 1.2rem;">分</span>
        </div>
        <div class="modal-score-label" style="${hasPenalties ? 'color: #991B1B;' : ''}">
          ${hasPenalties ? '本次初評得分（含扣分項目提醒）' : '本節課完成度與系統初評分數'}
        </div>
      </div>

      ${hasPenalties ? `
        <div style="background: #FEF2F2; border: 2px solid #EF4444; border-radius: 12px; padding: 1rem; margin-bottom: 0.9rem; text-align: left;">
          <div style="font-weight: 800; color: #991B1B; font-size: 1rem; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
            <span>🚨 扣分警告項目（請務必警惕）：</span>
          </div>
          <div style="color: #B91C1C; font-size: 0.92rem; line-height: 1.6; font-weight: 700;">
            ${penaltyItems.map(p => `<div>• ${p}</div>`).join('')}
          </div>
          <div style="font-size: 0.84rem; color: #7F1D1D; margin-top: 0.6rem; background: #FEE2E2; padding: 0.5rem 0.75rem; border-radius: 6px; line-height: 1.45;">
            📢 <strong>教師後台即時提示：</strong>老師已在後台儀表板同步檢視您的完整作答。若您剛才是語音輸入誤填、隨意湊字或留白，<strong>請立即點擊下方橘色按鈕重新修改訂正</strong>，以免影響平時成績！
          </div>
        </div>
      ` : ''}

      <div class="modal-msg" style="text-align: left; background: #F8FAFC; padding: 0.8rem; border-radius: 8px; font-size: 0.9rem; margin-bottom: 1rem;">
        <div>📌 <strong>評分明細：</strong></div>
        ${breakdownList.map(b => {
          if (penaltyItems.includes(b)) {
            return `<div style="color: #DC2626; font-weight: 700;">• ${b}</div>`;
          }
          return `<div>• ${b}</div>`;
        }).join('')}
      </div>

      <div class="modal-actions" style="flex-direction: column; gap: 0.6rem;">
        ${hasPenalties ? `
          <button type="button" class="btn-submit" style="width: 100%; background: #EA580C; font-weight: 800; padding: 0.8rem; font-size: 1rem; margin-bottom: 0.2rem;" onclick="resetSubmission('${payload.weekId}')">
            ✏️ 立即重新修改作答（消除扣分爭取高分）
          </button>
        ` : ''}
        <div style="display: flex; gap: 0.75rem; width: 100%;">
          <button class="btn-secondary" style="flex: 1;" onclick="document.getElementById('resultModal').classList.remove('active')">檢視本次作答</button>
          <a href="index.html" class="btn-submit" style="flex: 1; padding: 0.7rem 1.2rem; text-decoration: none; font-size: 0.95rem; background: #059669;">回課程首頁</a>
        </div>
        <button type="button" onclick="startFreshWorksheet('${payload.weekId}')" style="width: 100%; background: #FEE2E2; color: #DC2626; border: 1.5px solid #FCA5A5; border-radius: 10px; padding: 0.75rem; font-weight: 800; font-size: 0.95rem; cursor: pointer;">
          🔄 換下一位同學作答（清除本機紀錄）
        </button>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

// 支援全域與模組環境掛載
if (typeof window !== 'undefined') {
  window.COURSE_CONFIG = COURSE_CONFIG;
  window.UNIT_EVALUATION_CONFIG = UNIT_EVALUATION_CONFIG;
  window.checkIsNonsense = checkIsNonsense;
  window.evaluateUnitWorksheet = evaluateUnitWorksheet;
  window.submitWorksheet = submitWorksheet;
  window.initStudentInfoForm = initStudentInfoForm;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    COURSE_CONFIG,
    UNIT_EVALUATION_CONFIG,
    checkIsNonsense,
    evaluateUnitWorksheet,
    submitWorksheet,
    initStudentInfoForm
  };
}
