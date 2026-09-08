// Model "1 người" (không phải 1 lượt quét) + các hàm liên quan.
// Dùng window.App làm namespace chung để tránh phải dùng build tool/module.
(function (App) {
  'use strict';

  const PERSON_COLUMNS = [
    'Sale',
    'Số CCCD',
    'Họ và tên',
    'Ngày sinh',
    'Giới tính',
    'Địa chỉ',
    'Ngày cấp CCCD',
    'Khóa',
    'Số điện thoại',
    'Học phí đã đóng',
    'Số GPLX',
    'Hạng GPLX',
    'Ngày cấp GPLX',
    'Ngày hết hạn GPLX',
  ];

  const COURSE_CLASS_OPTIONS = ['A', 'A1', 'B.01', 'B', 'C1', 'BC', 'BD2', 'C1D2'];

  // Gộp "hạng đăng ký" (dropdown) + "mã lớp" (nhập tay) thành 1 giá trị "Khóa"
  // duy nhất lúc lưu, ví dụ: "A1 (K24)".
  function formatCourse(courseClass, courseBatch) {
    const cls = (courseClass || '').trim();
    const batch = (courseBatch || '').trim();
    if (cls && batch) return cls + ' (' + batch + ')';
    return cls || batch;
  }

  let idCounter = 0;
  function nextId() {
    idCounter += 1;
    return Date.now() + '_' + idCounter;
  }

  function createPerson(fields) {
    fields = fields || {};
    return {
      id: fields.id || nextId(),
      // Từ CCCD
      cccdNumber: fields.cccdNumber || '',
      fullName: fields.fullName || '',
      dateOfBirth: fields.dateOfBirth || '',
      gender: fields.gender || '',
      address: fields.address || '',
      cccdIssueDate: fields.cccdIssueDate || '',
      // Đăng ký khóa học (nhập tay) - gộp hạng đăng ký + mã lớp thành 1 ô "Khóa"
      course: fields.course != null ? fields.course : formatCourse(fields.courseClass, fields.courseBatch),
      phoneNumber: fields.phoneNumber || '',
      tuitionPaid: fields.tuitionPaid || '',
      // GPLX (gắn thêm sau, tùy chọn)
      gplxNumber: fields.gplxNumber || '',
      gplxClass: fields.gplxClass || '',
      gplxIssueDate: fields.gplxIssueDate || '',
      gplxExpiryDate: fields.gplxExpiryDate || '',
      // Sale đã đăng nhập lúc quét
      scannedByUser: fields.scannedByUser || '',
      scannedAt: fields.scannedAt || new Date().toISOString(),
      sentToSheet: !!fields.sentToSheet,
    };
  }

  function hasGplx(person) {
    return !!(person.gplxNumber && person.gplxNumber.trim());
  }

  function appendPiped(existing, next) {
    const nextTrim = (next || '').trim();
    if (!nextTrim) return existing || '';
    const existingTrim = (existing || '').trim();
    if (!existingTrim) return next;
    return existing + '|' + next;
  }

  // Gắn dữ liệu GPLX vừa quét vào 1 người. Nếu người đó đã có GPLX từ trước
  // (quét lần 2 vì có 2 bằng lái), nối thêm bằng "|" thay vì ghi đè.
  function mergeGplx(person, data) {
    data = data || {};
    person.gplxNumber = appendPiped(person.gplxNumber, data.number || '');
    person.gplxClass = appendPiped(person.gplxClass, data.licenseClass || '');
    person.gplxIssueDate = appendPiped(person.gplxIssueDate, data.issueDate || '');
    person.gplxExpiryDate = appendPiped(person.gplxExpiryDate, data.expiryDate || '');
  }

  function two(n) {
    return String(n).padStart(2, '0');
  }

  function formatScannedAt(isoString) {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return (
      two(d.getDate()) + '/' + two(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + two(d.getHours()) + ':' + two(d.getMinutes())
    );
  }

  function personToRow(p) {
    return [
      p.scannedByUser,
      p.cccdNumber,
      p.fullName,
      p.dateOfBirth,
      p.gender,
      p.address,
      p.cccdIssueDate,
      p.course,
      p.phoneNumber,
      p.tuitionPaid,
      p.gplxNumber,
      p.gplxClass,
      p.gplxIssueDate,
      p.gplxExpiryDate,
    ];
  }

  function personToColumnValueMap(p) {
    const row = personToRow(p);
    const map = {};
    PERSON_COLUMNS.forEach(function (col, i) {
      map[col] = row[i];
    });
    return map;
  }

  App.Person = {
    COLUMNS: PERSON_COLUMNS,
    COURSE_CLASS_OPTIONS: COURSE_CLASS_OPTIONS,
    create: createPerson,
    hasGplx: hasGplx,
    mergeGplx: mergeGplx,
    toRow: personToRow,
    toColumnValueMap: personToColumnValueMap,
    formatScannedAt: formatScannedAt,
  };
})(window.App = window.App || {});
