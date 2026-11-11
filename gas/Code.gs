/**
 * ==========================================================================
 * 桃園市楊光國中 115 學年度【行動方程式】彈性學習課程 
 * 學習單後端 API (GAS) - 支援雙向讀寫、自動排版美化 (第3週高雅綠風格)、
 * 依班級座號自動排序、出缺席同步、手動補登、防重複繳交覆蓋
 * ==========================================================================
 */

function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    var action = params.action || "getRecords";
    var weekId = params.weekId || "1";
    var classId = params.studentClass || "";

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. 讀取指定週次的繳交紀錄
    if (action === "getRecords") {
      var sheetName = "第" + weekId + "週作答紀錄";
      var sheet = ss.getSheetByName(sheetName);
      var records = [];

      if (sheet && sheet.getLastRow() > 1) {
        var data = sheet.getDataRange().getValues();
        // 表頭: [時間戳記, 班級, 座號, 姓名, 組別, 系統初評分數, 評分明細, 作答詳情]
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          var rowClass = String(row[1] || "").trim();
          if (!classId || rowClass === String(classId).trim()) {
            records.push({
              timestamp: row[0],
              studentClass: row[1],
              studentSeat: String(row[2]).padStart(2, '0'),
              studentName: row[3],
              studentGroup: row[4],
              score: row[5],
              scoreBreakdown: row[6],
              answers: row[7]
            });
          }
        }
      }

      // 同時讀取出缺席紀錄
      var attSheet = ss.getSheetByName("出缺席紀錄");
      var attendance = { absentSeats: [], expectedCount: 28 };
      if (attSheet && attSheet.getLastRow() > 1) {
        var attData = attSheet.getDataRange().getValues();
        for (var j = attData.length - 1; j >= 1; j--) {
          var aRow = attData[j];
          if (String(aRow[1]).trim() === String(classId).trim() && String(aRow[2]).trim() === String(weekId).trim()) {
            attendance = {
              expectedCount: Number(aRow[3]) || 28,
              absentSeats: String(aRow[4] || "").split(',').map(function(s) { return s.trim(); }).filter(Boolean)
            };
            break;
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        weekId: weekId,
        studentClass: classId,
        records: deduplicateRecordsList(records),
        attendance: attendance
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "API 運作正常"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "warning",
        message: "無效請求"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 模式 A：儲存出缺席與請假座號
    if (data.action === "saveAttendance") {
      var attSheet = ss.getSheetByName("出缺席紀錄");
      if (!attSheet) {
        attSheet = ss.insertSheet("出缺席紀錄");
      }
      formatAttendanceSheet(attSheet);

      attSheet.appendRow([
        new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
        data.studentClass,
        data.weekId,
        data.expectedCount,
        (data.absentSeats || []).join(", "),
        (data.unsubmittedSeats || []).join(", "),
        "由教師儀表板同步"
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "出缺席紀錄已成功儲存至試算表！"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 模式 B：學生送出作答 或 教師手動補登成績 (具備防重複繳交覆蓋與自動美化排序機制)
    var sheetName = "第" + (data.weekId || "1") + "週作答紀錄";
    var sheet = ss.getSheetByName(sheetName);
    var isNewSheet = false;

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      isNewSheet = true;
    }

    // 確保表頭存在且符合美化標準
    if (isNewSheet || sheet.getLastRow() === 0) {
      sheet.appendRow([
        "時間戳記", 
        "班級", 
        "座號", 
        "姓名", 
        "組別", 
        "系統初評分數", 
        "評分明細", 
        "作答詳情 (JSON 原始紀錄)"
      ]);
      formatWeekSheet(sheet);
    }

    // 確保座號一定是兩位數字串 (如 "01", "02")，並以單引號開頭寫入避免 Google Sheets 自動轉數值抹除前導 0
    var rawSeatNum = parseInt(data.studentSeat, 10);
    var targetSeat = (!isNaN(rawSeatNum) && rawSeatNum > 0) 
      ? String(rawSeatNum).padStart(2, '0') 
      : String(data.studentSeat || "").padStart(2, '0');
    var targetClass = String(data.studentClass || "").trim();
    var targetName = String(data.studentName || "").trim();
    var existingRowIndex = -1;

    // 🔍 防重複洗板與錯位覆蓋檢查：
    // 比對條件：同班級下，若「座號相同」或「姓名相同（防止改座號重複洗板殘留幽靈列）」，皆視為同一位學生的更新！
    if (sheet.getLastRow() > 1) {
      var existingData = sheet.getRange(2, 2, sheet.getLastRow() - 1, 3).getValues(); // 班級(欄2), 座號(欄3), 姓名(欄4)
      for (var r = 0; r < existingData.length; r++) {
        var rowClass = String(existingData[r][0]).trim();
        var rowSeatNum = parseInt(existingData[r][1], 10);
        var rowSeatStr = (!isNaN(rowSeatNum) && rowSeatNum > 0) ? String(rowSeatNum).padStart(2, '0') : String(existingData[r][1]).trim();
        var rowName = String(existingData[r][2] || "").trim();

        if (rowClass === targetClass) {
          // 1. 若同班且姓名相符：學生修正座號重交，優先覆蓋此列，避免在舊座號殘留幽靈紀錄！
          if (targetName && rowName === targetName) {
            existingRowIndex = r + 2;
            break;
          }
          // 2. 若同班且座號相符：同座號更新或教師手動補登
          if (rowSeatStr === targetSeat) {
            existingRowIndex = r + 2;
            break;
          }
        }
      }
    }

    // 💡 關鍵：座號加上單引號 "'" 強制 Google Sheets 視為純文字保留 01~35 前導 0
    var displaySeat = "'" + targetSeat;

    var rowValues = [
      data.timestamp || new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
      data.studentClass,
      displaySeat,
      data.studentName,
      data.studentGroup || "手動補登",
      data.score,
      Array.isArray(data.scoreBreakdown) ? data.scoreBreakdown.join("； ") : (data.scoreBreakdown || "教師手動補登"),
      typeof data.answers === 'object' ? JSON.stringify(data.answers) : (data.answers || "{}")
    ];

    if (existingRowIndex > 0) {
      // 學生重複交卷：自動「更新覆蓋」原有一列，確保試算表每位學生只有一筆最新成績，絕不重複洗板！
      sheet.getRange(existingRowIndex, 1, 1, 8).setValues([rowValues]);
    } else {
      // 全新繳交：新增一列
      sheet.appendRow(rowValues);
    }

    // 📊 依「班級 (升冪)」與「座號 (升冪)」自動排序，並套用美化格式
    try {
      if (sheet.getLastRow() > 2) {
        var numRows = sheet.getLastRow() - 1;
        // 先將 C 欄 (座號) 所有現存座號統一修復為兩位數純文字 ("01"~"35")，防止歷史或舊格式變成數值亂序
        var seatRange = sheet.getRange(2, 3, numRows, 1);
        var seatVals = seatRange.getValues();
        for (var sIdx = 0; sIdx < seatVals.length; sIdx++) {
          var sNum = parseInt(seatVals[sIdx][0], 10);
          if (!isNaN(sNum) && sNum > 0) {
            seatVals[sIdx][0] = "'" + String(sNum).padStart(2, '0');
          }
        }
        seatRange.setValues(seatVals);

        var dataRange = sheet.getRange(2, 1, numRows, 8);
        dataRange.sort([
          { column: 2, ascending: true }, // 依班級排序
          { column: 3, ascending: true }  // 依座號排序 (純文字 01~35 字典序即自然數序)
        ]);
      }
      formatWeekSheet(sheet);
    } catch (sortErr) {
      console.warn("排序或美化提醒: " + sortErr);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: existingRowIndex > 0 ? "已更新此座號之最新繳交紀錄！" : "資料已成功儲存至試算表！"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ==========================================================================
 * ✨ 美化專案工作表：100% 復刻第 3 週的高雅綠 (Forest Emerald) 樣式
 * ==========================================================================
 */
function formatWeekSheet(sheet) {
  if (!sheet) return;

  var lastRow = Math.max(sheet.getLastRow(), 2);
  var lastCol = 8;

  // 1. 凍結首列與表頭高度
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 38);

  // 2. 表頭文字與顏色 (高雅深祖母綠 #065F46)
  var headerRange = sheet.getRange(1, 1, 1, lastCol);
  headerRange
    .setBackground("#065F46")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(11)
    .setVerticalAlignment("middle");

  // 3. 欄位寬度最佳化
  sheet.setColumnWidth(1, 165); // 時間戳記
  sheet.setColumnWidth(2, 75);  // 班級
  sheet.setColumnWidth(3, 65);  // 座號
  sheet.setColumnWidth(4, 95);  // 姓名
  sheet.setColumnWidth(5, 105); // 組別
  sheet.setColumnWidth(6, 115); // 系統初評分數
  sheet.setColumnWidth(7, 360); // 評分明細
  sheet.setColumnWidth(8, 140); // 作答詳情 (JSON)

  // 4. 資料列對齊與高度
  if (lastRow > 1) {
    var dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
    dataRange.setVerticalAlignment("middle").setFontSize(10);

    // 各欄對齊
    sheet.getRange(2, 1, lastRow - 1, 1).setHorizontalAlignment("center"); // 時間
    sheet.getRange(2, 2, lastRow - 1, 1).setHorizontalAlignment("center"); // 班級
    sheet.getRange(2, 3, lastRow - 1, 1).setHorizontalAlignment("center").setNumberFormat("@"); // 座號純文字
    sheet.getRange(2, 4, lastRow - 1, 1).setHorizontalAlignment("center").setFontWeight("bold"); // 姓名
    sheet.getRange(2, 5, lastRow - 1, 1).setHorizontalAlignment("center"); // 組別
    sheet.getRange(2, 6, lastRow - 1, 1).setHorizontalAlignment("center").setFontWeight("bold"); // 初評分數
    sheet.getRange(2, 7, lastRow - 1, 1).setHorizontalAlignment("left");   // 評分明細
    sheet.getRange(2, 8, lastRow - 1, 1).setHorizontalAlignment("left");   // 作答詳情

    // 設定資料列高度
    for (var r = 2; r <= Math.min(lastRow, 50); r++) {
      sheet.setRowHeight(r, 30);
    }

    // 5. 組別下拉選單晶片 (Data Validation)
    try {
      var groupList = ["第 1 組", "第 2 組", "第 3 組", "第 4 組", "第 5 組", "第 6 組", "第 7 組", "第 8 組", "手動補登"];
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(groupList, true)
        .setAllowInvalid(true)
        .build();
      sheet.getRange(2, 5, lastRow - 1, 1).setDataValidation(rule);
    } catch (ruleErr) {}
  }

  // 6. 套用交替色彩 (Zebra Striping: 白底 / 淡薄荷綠 #F0FDF4)
  try {
    var bandings = sheet.getBandings();
    for (var b = 0; b < bandings.length; b++) {
      bandings[b].remove();
    }
    var fullRange = sheet.getRange(1, 1, Math.max(lastRow, 50), lastCol);
    fullRange.applyRowBanding()
      .setHeaderRowColor("#065F46")
      .setFirstRowColor("#FFFFFF")
      .setSecondRowColor("#F0FDF4");
  } catch (bandErr) {}
}

/**
 * 美化出缺席紀錄表
 */
function formatAttendanceSheet(sheet) {
  if (!sheet) return;
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 38);
  var header = sheet.getRange(1, 1, 1, 7);
  header.setBackground("#064E3B").setFontColor("#FFFFFF").setFontWeight("bold").setVerticalAlignment("middle");
  sheet.setColumnWidth(1, 165);
  sheet.setColumnWidth(2, 75);
  sheet.setColumnWidth(3, 75);
  sheet.setColumnWidth(4, 110);
  sheet.setColumnWidth(5, 180);
  sheet.setColumnWidth(6, 220);
  sheet.setColumnWidth(7, 150);
}

/**
 * ==========================================================================
 * 🚀 一鍵美化全試算表所有週次工作表 (點擊上方選單即可自動執行！)
 * ==========================================================================
 */
function formatAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var count = 0;

  for (var i = 0; i < sheets.length; i++) {
    var s = sheets[i];
    var name = s.getName();
    if (name.indexOf("作答紀錄") !== -1) {
      // 依班級與座號排序（修復座號為 01~35 格式）
      if (s.getLastRow() > 2) {
        try {
          var nRows = s.getLastRow() - 1;
          var sRange = s.getRange(2, 3, nRows, 1);
          var sVals = sRange.getValues();
          for (var k = 0; k < sVals.length; k++) {
            var valNum = parseInt(sVals[k][0], 10);
            if (!isNaN(valNum) && valNum > 0) {
              sVals[k][0] = "'" + String(valNum).padStart(2, '0');
            }
          }
          sRange.setValues(sVals);

          s.getRange(2, 1, nRows, 8).sort([
            { column: 2, ascending: true },
            { column: 3, ascending: true }
          ]);
        } catch(e) {}
      }
      formatWeekSheet(s);
      count++;
    } else if (name === "出缺席紀錄") {
      formatAttendanceSheet(s);
    }
  }

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast("已成功套用第 3 週樣式美化 " + count + " 個作答紀錄表！", "✨ 美化完成", 5);
  } catch(e) {}
}

/**
 * 伺服器端資料去重與錯位修正：確保同班級同姓名只有最新座號，同座號只有最新學生
 */
function deduplicateRecordsList(records) {
  if (!Array.isArray(records) || records.length === 0) return [];

  var valid = records.filter(function(r) {
    if (!r || typeof r !== 'object') return false;
    var s = parseInt(r.studentSeat, 10);
    return !isNaN(s) && s >= 1 && s <= 35;
  });

  var enriched = valid.map(function(r) {
    var seat = String(r.studentSeat).padStart(2, '0');
    try {
      var parsed = typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers;
      if (parsed && parsed.studentSeat) {
        var innerSeat = parseInt(parsed.studentSeat, 10);
        if (!isNaN(innerSeat) && innerSeat >= 1 && innerSeat <= 35) {
          seat = String(innerSeat).padStart(2, '0');
        }
      }
    } catch (e) {}

    var timeMs = 0;
    if (r.timestamp) {
      timeMs = Date.parse(r.timestamp) || 0;
      if (timeMs === 0) {
        var cleaned = String(r.timestamp).replace('上午', 'AM ').replace('下午', 'PM ');
        timeMs = Date.parse(cleaned) || 0;
      }
    }

    return {
      raw: r,
      cls: String(r.studentClass || '').trim(),
      seat: seat,
      name: String(r.studentName || '').trim(),
      timeMs: timeMs
    };
  });

  enriched.sort(function(a, b) { return a.timeMs - b.timeMs; });

  var studentLatest = {};
  enriched.forEach(function(rec) {
    if (rec.name) {
      studentLatest[rec.cls + '_' + rec.name] = rec;
    }
  });

  var seatMap = {};
  Object.keys(studentLatest).forEach(function(k) {
    var rec = studentLatest[k];
    var seatKey = rec.cls + '_' + rec.seat;
    if (seatMap[seatKey]) {
      if (rec.timeMs >= seatMap[seatKey].timeMs) {
        seatMap[seatKey] = rec;
      }
    } else {
      seatMap[seatKey] = rec;
    }
  });

  enriched.forEach(function(rec) {
    if (!rec.name) {
      var seatKey = rec.cls + '_' + rec.seat;
      if (!seatMap[seatKey] || rec.timeMs >= seatMap[seatKey].timeMs) {
        seatMap[seatKey] = rec;
      }
    }
  });

  var res = Object.keys(seatMap).map(function(k) {
    var item = seatMap[k];
    var r = item.raw;
    r.studentSeat = item.seat;
    return r;
  });

  res.sort(function(a, b) {
    var sa = parseInt(a.studentSeat, 10);
    var sb = parseInt(b.studentSeat, 10);
    return sa - sb;
  });

  return res;
}

/**
 * ==========================================================================
 * 🧹 一鍵清除與修復全試算表重複錯位紀錄 (Google Sheets 專用管理維護工具)
 * 自動掃描所有「第X週作答紀錄」工作表，清除跨座號幽靈列、保留最新有效作答，
 * 並依班級、座號 ('01~'35) 重新排序且套用高雅綠美化格式！
 * ==========================================================================
 */
function cleanAllSheetsDuplicates() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var totalCleanedCount = 0;
  var sheetsFixedCount = 0;

  for (var i = 0; i < sheets.length; i++) {
    var s = sheets[i];
    var name = s.getName();
    if (name.indexOf("作答紀錄") !== -1 && s.getLastRow() > 1) {
      var lastRow = s.getLastRow();
      var dataRange = s.getRange(2, 1, lastRow - 1, 8);
      var rawRows = dataRange.getValues();

      if (rawRows.length === 0) continue;

      var parsedRecords = [];
      for (var rIdx = 0; rIdx < rawRows.length; rIdx++) {
        var r = rawRows[rIdx];
        var cls = String(r[1] || "").trim();
        var rawSeatNum = parseInt(r[2], 10);
        var seatStr = (!isNaN(rawSeatNum) && rawSeatNum > 0) ? String(rawSeatNum).padStart(2, '0') : String(r[2] || "").trim();
        var studentName = String(r[3] || "").trim();

        // 檢查答案 JSON 中是否有修正後的座號
        try {
          var ansObj = typeof r[7] === 'string' ? JSON.parse(r[7]) : r[7];
          if (ansObj && ansObj.studentSeat) {
            var innerSeatNum = parseInt(ansObj.studentSeat, 10);
            if (!isNaN(innerSeatNum) && innerSeatNum > 0 && innerSeatNum <= 35) {
              seatStr = String(innerSeatNum).padStart(2, '0');
            }
          }
        } catch (e) {}

        var timeMs = 0;
        if (r[0]) {
          timeMs = Date.parse(r[0]) || 0;
          if (timeMs === 0) {
            var cleanedTimeStr = String(r[0]).replace('上午', 'AM ').replace('下午', 'PM ');
            timeMs = Date.parse(cleanedTimeStr) || 0;
          }
        }

        parsedRecords.push({
          raw: r,
          cls: cls,
          seat: seatStr,
          name: studentName,
          timeMs: timeMs || rIdx
        });
      }

      // 依時間舊到新排序
      parsedRecords.sort(function(a, b) { return a.timeMs - b.timeMs; });

      // 規則 1：同班級每位姓名只保留最新一次的提交座號
      var studentLatest = {};
      parsedRecords.forEach(function(rec) {
        if (rec.name) {
          studentLatest[rec.cls + '_' + rec.name] = rec;
        }
      });

      // 規則 2：映射至座號，確保每班每個座號只有一位最新合法學生
      var seatMap = {};
      Object.keys(studentLatest).forEach(function(k) {
        var rec = studentLatest[k];
        var seatKey = rec.cls + '_' + rec.seat;
        if (seatMap[seatKey]) {
          if (rec.timeMs >= seatMap[seatKey].timeMs) {
            seatMap[seatKey] = rec;
          }
        } else {
          seatMap[seatKey] = rec;
        }
      });

      // 補入手動補登或無名紀錄
      parsedRecords.forEach(function(rec) {
        if (!rec.name) {
          var seatKey = rec.cls + '_' + rec.seat;
          if (!seatMap[seatKey] || rec.timeMs >= seatMap[seatKey].timeMs) {
            seatMap[seatKey] = rec;
          }
        }
      });

      // 輸出排序後乾淨資料
      var cleanList = Object.keys(seatMap).map(function(k) { return seatMap[k]; });
      cleanList.sort(function(a, b) {
        if (a.cls !== b.cls) return a.cls.localeCompare(b.cls);
        var sa = parseInt(a.seat, 10);
        var sb = parseInt(b.seat, 10);
        return sa - sb;
      });

      var rowsDiff = rawRows.length - cleanList.length;
      if (rowsDiff > 0 || cleanList.length > 0) {
        // 清除原有資料區域
        s.getRange(2, 1, lastRow - 1, 8).clearContent();

        // 重新填入去重後的純淨資料
        var newValues = cleanList.map(function(item) {
          var rowCopy = item.raw.slice();
          rowCopy[2] = "'" + item.seat; // 保留 '01 前導 0
          return rowCopy;
        });

        if (newValues.length > 0) {
          s.getRange(2, 1, newValues.length, 8).setValues(newValues);
        }

        formatWeekSheet(s);
        if (rowsDiff > 0) {
          totalCleanedCount += rowsDiff;
          sheetsFixedCount++;
        }
      }
    }
  }

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "已完成全試算表深度去重檢核！共修復清理 " + totalCleanedCount + " 筆重複/幽靈錯位紀錄，涵蓋 " + sheetsFixedCount + " 個工作表。",
      "🧹 清理與修復成功",
      8
    );
  } catch (e) {}
}

/**
 * 試算表開啟時自動掛載自訂選單
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🌱 行動方程式工具')
    .addItem('✨ 一鍵美化所有工作表 (套用第3週樣式)', 'formatAllSheets')
    .addItem('🧹 一鍵清理與修復重複錯位紀錄 (去重修復)', 'cleanAllSheetsDuplicates')
    .addToUi();
}
