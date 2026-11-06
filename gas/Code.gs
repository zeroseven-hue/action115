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
        records: records,
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

    var targetSeat = String(data.studentSeat).padStart(2, '0');
    var targetClass = String(data.studentClass).trim();
    var existingRowIndex = -1;

    // 🔍 防重複洗板檢查：檢查同班級、同座號是否已存在
    if (sheet.getLastRow() > 1) {
      var existingData = sheet.getRange(2, 2, sheet.getLastRow() - 1, 2).getValues(); // 班級(欄2), 座號(欄3)
      for (var r = 0; r < existingData.length; r++) {
        if (String(existingData[r][0]).trim() === targetClass && String(existingData[r][1]).padStart(2, '0') === targetSeat) {
          existingRowIndex = r + 2; // 試算表列數 (從第2列開始)
          break;
        }
      }
    }

    var rowValues = [
      data.timestamp || new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
      data.studentClass,
      targetSeat,
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
        var dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8);
        dataRange.sort([
          { column: 2, ascending: true }, // 依班級排序
          { column: 3, ascending: true }  // 依座號排序
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
      // 依班級與座號排序
      if (s.getLastRow() > 2) {
        try {
          s.getRange(2, 1, s.getLastRow() - 1, 8).sort([
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
 * 試算表開啟時自動掛載自訂選單
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🌱 行動方程式工具')
    .addItem('✨ 一鍵美化所有工作表 (套用第3週樣式)', 'formatAllSheets')
    .addToUi();
}
