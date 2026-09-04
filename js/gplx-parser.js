// Trích xuất thông tin từ văn bản OCR đọc được trên Giấy phép lái xe (GPLX).
// GPLX không có mã máy đọc chuẩn (khác CCCD có QR) nên chỉ mang tính "đoán
// tốt nhất" dựa trên các nhãn thường gặp trên phôi bằng lái. Người dùng
// LUÔN cần xem lại và sửa ở màn hình xác nhận trước khi lưu.
(function (App) {
  'use strict';

  const stripDiacritics = App.stripVietnameseDiacritics;

  // Ngày dạng số có dấu phân cách, ví dụ "19/02/1993".
  const DATE_RE = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/g;

  // Ngày dạng văn xuôi song ngữ thường thấy ở dòng "nơi cấp, ngày cấp", ví
  // dụ "Hà Nội, ngày/date 05 tháng/month 04 năm/year 2019" (áp dụng trên
  // chuỗi đã bỏ dấu: "ha noi, ngay/date 05 thang/month 04 nam/year 2019").
  // Dùng \D{0,12} (không phải \s*) ở hai phía mỗi từ khóa vì phôi bằng in
  // xen "/date", "/month", "/year" ngay sau từ khóa tiếng Việt.
  const PROSE_DATE_RE = /ngay\D{0,12}(\d{1,2})\D{0,12}thang\D{0,12}(\d{1,2})\D{0,12}nam\D{0,12}(\d{4})/;

  const NUMBER_RE = /\b\d{9,12}\b/;
  const NUMBER_RE_G = /\b\d{9,12}\b/g;
  const CLASS_RE = /\b(A1|A2|A3|A4|B1|B2|B3|C1|C|D1|D2|D|BE|C1E|CE|D1E|D2E|DE|FB2|FC|FD1|FD2|FD|FE)\b/i;

  function normalizeDate(m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    const y = m[3];
    return d + '/' + mo + '/' + y;
  }

  function parseGplxOcr(rawText) {
    rawText = rawText || '';
    const lines = rawText
      .split('\n')
      .map(function (l) { return l.trim(); })
      .filter(Boolean);
    const normalizedLines = lines.map(stripDiacritics);
    const normalizedFullText = stripDiacritics(rawText);

    let number = '';
    let licenseClass = '';
    let issueDate = '';
    let expiryDate = '';

    const dates = [];
    lines.forEach(function (line) {
      let m;
      const re = new RegExp(DATE_RE.source, 'g');
      while ((m = re.exec(line)) !== null) {
        dates.push(normalizeDate(m));
      }
    });

    for (let i = 0; i < lines.length; i += 1) {
      const norm = normalizedLines[i];
      const line = lines[i];

      if (
        !number &&
        (norm.indexOf('so/no') !== -1 ||
          norm.indexOf('so:') !== -1 ||
          norm.indexOf('no:') !== -1 ||
          norm.indexOf('so gplx') !== -1)
      ) {
        const m = line.match(NUMBER_RE);
        if (m) number = m[0];
      }

      if (!licenseClass && norm.indexOf('hang') !== -1) {
        const m = line.match(CLASS_RE);
        if (m) licenseClass = m[0].toUpperCase();
      }

      if (!expiryDate && (norm.indexOf('co gia tri den') !== -1 || norm.indexOf('expires') !== -1)) {
        if (norm.indexOf('khong thoi han') !== -1) {
          expiryDate = 'Không thời hạn';
        } else {
          const mm = new RegExp(DATE_RE.source).exec(line);
          if (mm) expiryDate = normalizeDate(mm);
        }
      }

      // Dòng "nơi cấp, ngày cấp" thường viết văn xuôi kiểu "TP. Hồ Chí
      // Minh, ngày 14 tháng 03 năm 2014" chứ không phải dd/mm/yyyy nên cần
      // regex riêng; không có nhãn "ngày cấp" rõ ràng đứng trước nên thử
      // bắt trên mọi dòng có đủ 2 từ khóa tháng/năm.
      if (!issueDate && norm.indexOf('thang') !== -1 && norm.indexOf('nam') !== -1) {
        const m = PROSE_DATE_RE.exec(norm);
        if (m) {
          issueDate = m[1].padStart(2, '0') + '/' + m[2].padStart(2, '0') + '/' + m[3];
        }
      }
    }

    // Không có nhãn "không thời hạn" tách riêng nhưng cụm này xuất hiện đâu
    // đó trong văn bản -> vẫn ưu tiên gán vào hạn sử dụng.
    if (!expiryDate && normalizedFullText.indexOf('khong thoi han') !== -1) {
      expiryDate = 'Không thời hạn';
    }

    // Ngày cấp dạng văn xuôi chưa bắt được qua từng dòng -> thử lại trên
    // toàn bộ văn bản đã nối liền.
    if (!issueDate) {
      const m = PROSE_DATE_RE.exec(normalizedFullText);
      if (m) {
        issueDate = m[1].padStart(2, '0') + '/' + m[2].padStart(2, '0') + '/' + m[3];
      }
    }

    // Số GPLX: nếu chưa tìm thấy qua nhãn, lấy dãy số 9-12 chữ số dài nhất
    // xuất hiện trong toàn bộ văn bản.
    if (!number) {
      const candidates = rawText.match(NUMBER_RE_G) || [];
      if (candidates.length) {
        candidates.sort(function (a, b) { return b.length - a.length; });
        number = candidates[0];
      }
    }

    // Hạng: nếu chưa tìm thấy qua nhãn, quét toàn văn bản.
    if (!licenseClass) {
      const m = rawText.match(CLASS_RE);
      if (m) licenseClass = m[0].toUpperCase();
    }

    // Hết hạn: nếu chưa gán được qua nhãn, suy đoán là ngày dd/mm/yyyy
    // muộn nhất tìm thấy trong văn bản.
    if (!expiryDate && dates.length) {
      const uniqueDates = Array.from(new Set(dates)).sort();
      expiryDate = uniqueDates[uniqueDates.length - 1];
    }

    return {
      number: number,
      licenseClass: licenseClass,
      issueDate: issueDate,
      expiryDate: expiryDate,
    };
  }

  App.GplxParser = { parse: parseGplxOcr };
})(window.App = window.App || {});
