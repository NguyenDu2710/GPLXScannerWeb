// Phân tích chuỗi dữ liệu trong mã QR ở mặt sau thẻ CCCD gắn chip (theo
// Thông tư 59/2021/TT-BCA). Các trường phân tách bởi dấu "|":
//   0: Số CCCD (12 số)
//   1: Số CMND cũ (9 số, có thể rỗng)
//   2: Họ và tên
//   3: Ngày sinh (ddMMyyyy)
//   4: Giới tính
//   5: Nơi thường trú
//   6: Ngày cấp thẻ (ddMMyyyy)
(function (App) {
  'use strict';

  function formatDate(ddMMyyyy) {
    if (/^\d{8}$/.test(ddMMyyyy)) {
      return ddMMyyyy.slice(0, 2) + '/' + ddMMyyyy.slice(2, 4) + '/' + ddMMyyyy.slice(4);
    }
    return ddMMyyyy;
  }

  // Trả về null nếu chuỗi QR không đúng định dạng CCCD mong đợi.
  function parseCccdQr(raw) {
    const parts = String(raw || '').split('|');
    if (parts.length < 4) return null;

    const number = (parts[0] || '').trim();
    if (number.length < 9) return null;

    return {
      cccdNumber: number,
      fullName: parts.length > 2 ? (parts[2] || '').trim() : '',
      dateOfBirth: parts.length > 3 ? formatDate((parts[3] || '').trim()) : '',
      gender: parts.length > 4 ? (parts[4] || '').trim() : '',
      address: parts.length > 5 ? (parts[5] || '').trim() : '',
      cccdIssueDate: parts.length > 6 ? formatDate((parts[6] || '').trim()) : '',
    };
  }

  App.CccdParser = { parse: parseCccdQr };
})(window.App = window.App || {});
