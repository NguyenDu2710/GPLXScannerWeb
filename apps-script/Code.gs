/**
 * Ghi dữ liệu quét CCCD/GPLX từ app web thẳng vào Sheet này.
 *
 * CÀI ĐẶT (làm 1 lần):
 * 1. Mở ĐÚNG Google Sheet này (không phải file khác) > Extensions >
 *    Apps Script.
 * 2. Xóa hết code mẫu có sẵn (thường là "function myFunction() {}"), dán
 *    TOÀN BỘ nội dung file này vào thay thế.
 * 3. Bấm biểu tượng đĩa mềm (Save), rồi bấm nút "Deploy" (góc trên bên
 *    phải) > "New deployment".
 * 4. Bấm biểu tượng bánh răng cạnh "Select type" > chọn "Web app".
 *    - Execute as: Me
 *    - Who has access: Anyone   (bắt buộc chọn đúng "Anyone", KHÔNG chọn
 *      "Only myself" hay "Anyone with Google account" — app web không
 *      đăng nhập Google nên cần quyền ẩn danh)
 * 5. Bấm "Deploy". Lần đầu Google sẽ hỏi cấp quyền truy cập Sheet cho
 *    script — bấm "Authorize access", chọn tài khoản, bấm "Advanced" >
 *    "Go to ... (unsafe)" nếu hiện cảnh báo, rồi "Allow". Đây là quyền của
 *    CHÍNH BẠN cấp cho code CHÍNH BẠN vừa dán, hoàn toàn bình thường với
 *    Apps Script tự viết.
 * 6. Copy đường dẫn "Web app URL" (dạng
 *    https://script.google.com/macros/s/AKfycb.../exec), dán vào app web
 *    quét CCCD/GPLX, mục "Kết nối Google Sheet" > "Qua Google Apps Script".
 *
 * Mỗi khi SỬA LẠI code này, phải vào Deploy > Manage deployments > bấm
 * biểu tượng bút chì > Version "New version" > Deploy thì URL cũ mới chạy
 * code mới (nếu chỉ Save mà không Deploy lại, URL web app vẫn chạy code
 * PHIÊN BẢN CŨ).
 */

// Tab (gid) cần ghi vào trong file Sheet này. Lấy từ link Google Sheet:
// .../edit?gid=677059443  ->  677059443
var TARGET_GID = 677059443;

function _getTargetSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === TARGET_GID) return sheets[i];
  }
  // Không tìm thấy đúng gid (tab đã bị xóa/đổi id) -> dùng sheet đầu tiên
  // để không bao giờ ghi lỗi ra ngoài, chỉ có thể ghi nhầm tab.
  return sheets[0];
}

function doPost(e) {
  try {
    var sheet = _getTargetSheet();
    var params = (e && e.parameter) || {};

    // App web gửi kèm __order = danh sách tên cột chuẩn, nối bằng "||",
    // dùng để tạo dòng tiêu đề khi Sheet còn trống.
    var defaultOrder = params.__order ? params.__order.split('||') : [];

    var lastCol = sheet.getLastColumn();
    var headerRow = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    var hasHeader = headerRow.some(function (h) { return String(h).trim() !== ''; });

    if (!hasHeader && defaultOrder.length > 0) {
      sheet.getRange(1, 1, 1, defaultOrder.length).setValues([defaultOrder]);
      headerRow = defaultOrder;
    }

    // Luôn ghi theo ĐÚNG THỨ TỰ CỘT THẬT SỰ ĐANG CÓ trên Sheet (không phải
    // thứ tự app gửi lên) — nhờ vậy nếu bạn tự sắp xếp/thêm/bớt cột trên
    // Sheet, dữ liệu vẫn vào đúng cột theo tên, không bị lệch.
    var columnsToUse = headerRow.length > 0 ? headerRow : defaultOrder;
    var row = columnsToUse.map(function (col) {
      var value = params[col];
      return value === undefined ? '' : value;
    });
    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(
    'Apps Script đang hoạt động. App web sẽ gửi dữ liệu bằng POST, không dùng GET nên không cần mở link này trực tiếp.',
  );
}
