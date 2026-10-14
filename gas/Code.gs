/**
 * ==========================================================================
 * 桃園市楊光國中 115 學年度【行動方程式】彈性學習課程 
 * 學習單後端 API (GAS) - 支援雙向讀寫、出缺席同步、手動補登
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
        attSheet.appendRow(["時間戳記", "班級", "週次", "實到應交人數", "請假座號名單", "未交座號名單", "備註"]);
        attSheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#065F46").setFontColor("#FFFFFF");
        attSheet.setFrozenRows(1);
      }

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

    // 模式 B：學生送出作答 或 教師手動補登成績
    var sheetName = "第" + (data.weekId || "1") + "週作答紀錄";
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
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
      sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#1A365D").setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      data.timestamp || new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
      data.studentClass,
      data.studentSeat,
      data.studentName,
      data.studentGroup || "手動補登",
      data.score,
      Array.isArray(data.scoreBreakdown) ? data.scoreBreakdown.join("； ") : (data.scoreBreakdown || "教師手動補登"),
      typeof data.answers === 'object' ? JSON.stringify(data.answers) : (data.answers || "{}")
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "資料已成功儲存至試算表！"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
