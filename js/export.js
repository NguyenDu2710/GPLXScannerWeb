// Xuất danh sách người ra file Excel (.xlsx, dùng thư viện SheetJS nạp qua
// CDN trong index.html) hoặc văn bản (.txt), rồi tải xuống trực tiếp bằng
// trình duyệt (không cần server).
(function (App) {
  'use strict';

  function timestampedFileName(extension) {
    const now = new Date();
    function two(n) { return String(n).padStart(2, '0'); }
    const stamp =
      now.getFullYear().toString() + two(now.getMonth() + 1) + two(now.getDate()) +
      '_' + two(now.getHours()) + two(now.getMinutes()) + two(now.getSeconds());
    return 'ket_qua_quet_' + stamp + '.' + extension;
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportToExcel(people) {
    if (typeof XLSX === 'undefined') {
      throw new Error('Chưa tải được thư viện xuất Excel (XLSX). Kiểm tra kết nối mạng rồi thử lại.');
    }
    const rows = [App.Person.COLUMNS].concat(people.map(App.Person.toRow));
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'KetQua');
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    downloadBlob(
      new Blob([wbout], { type: 'application/octet-stream' }),
      timestampedFileName('xlsx'),
    );
  }

  function exportToTxt(people) {
    const lines = [App.Person.COLUMNS.join('\t')].concat(
      people.map(function (p) { return App.Person.toRow(p).join('\t'); }),
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, timestampedFileName('txt'));
  }

  App.Export = { exportToExcel: exportToExcel, exportToTxt: exportToTxt };
})(window.App = window.App || {});
