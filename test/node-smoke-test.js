// Kiểm tra nhanh logic thuần JS (không cần trình duyệt/camera) bằng Node.
// Chạy: node test/node-smoke-test.js
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

global.window = { App: {} };

require('../js/vietnamese-text-utils.js');
require('../js/person.js');
require('../js/cccd-parser.js');
require('../js/gplx-parser.js');

// Mock fetch để dvhc-converter.js đọc file cục bộ thay vì gọi mạng thật.
const dvhcJsonPath = path.join(__dirname, '..', 'data', 'dvhc.json');
global.fetch = async function (url) {
  if (String(url).indexOf('dvhc.json') !== -1) {
    const text = fs.readFileSync(dvhcJsonPath, 'utf8');
    return { ok: true, json: async () => JSON.parse(text) };
  }
  return { ok: false, json: async () => [] };
};

require('../js/dvhc-converter.js');

const App = global.window.App;
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  OK  ' + name);
    passed += 1;
  } catch (e) {
    console.error('FAIL  ' + name);
    console.error('      ' + (e && e.stack ? e.stack : e));
    failed += 1;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log('  OK  ' + name);
    passed += 1;
  } catch (e) {
    console.error('FAIL  ' + name);
    console.error('      ' + (e && e.stack ? e.stack : e));
    failed += 1;
  }
}

// ---- CccdParser ----
test('CccdParser.parse: parse đúng chuỗi QR CCCD chuẩn', () => {
  const raw = '079123456789|012345678|NGUYEN VAN A|01011990|Nam|123 Le Loi, P1, Q1, TPHCM|01012021';
  const r = App.CccdParser.parse(raw);
  assert.strictEqual(r.cccdNumber, '079123456789');
  assert.strictEqual(r.fullName, 'NGUYEN VAN A');
  assert.strictEqual(r.dateOfBirth, '01/01/1990');
  assert.strictEqual(r.gender, 'Nam');
  assert.strictEqual(r.address, '123 Le Loi, P1, Q1, TPHCM');
  assert.strictEqual(r.cccdIssueDate, '01/01/2021');
});

test('CccdParser.parse: trả null nếu không đủ trường/không giống số CCCD', () => {
  assert.strictEqual(App.CccdParser.parse('abc|def'), null);
  assert.strictEqual(App.CccdParser.parse('12|a|b|c'), null); // số quá ngắn
});

// ---- GplxParser ----
test('GplxParser.parse: mẫu GPLX A1 không thời hạn (song ngữ ngày/date...)', () => {
  const rawText = [
    'BỘ GTVT',
    'MOT',
    "GIẤY PHÉP LÁI XE/DRIVER'S LICENSE",
    'Số/No: 791149379530',
    'Họ tên/Full name: ĐẶNG NGỌC TRÂM',
    'Ngày sinh/Date of Birth: 19/02/1993',
    'TP. Hồ Chí Minh, ngày/date 14 tháng/month 03 năm/year 2014',
    'Hạng/Class: A1',
    'Có giá trị đến/Expires: Không thời hạn',
  ].join('\n');
  const r = App.GplxParser.parse(rawText);
  assert.strictEqual(r.number, '791149379530');
  assert.strictEqual(r.licenseClass, 'A1');
  assert.strictEqual(r.issueDate, '14/03/2014');
  assert.strictEqual(r.expiryDate, 'Không thời hạn');
});

test('GplxParser.parse: mẫu GPLX B2 có hạn sử dụng (khác ngày cấp)', () => {
  const rawText = [
    'Số/No: 123456789012',
    'Hà Nội, ngày/date 05 tháng/month 04 năm/year 2019',
    'Hạng/Class: B2',
    'Có giá trị đến/Expires: 05/04/2029',
  ].join('\n');
  const r = App.GplxParser.parse(rawText);
  assert.strictEqual(r.number, '123456789012');
  assert.strictEqual(r.licenseClass, 'B2');
  assert.strictEqual(r.issueDate, '05/04/2019');
  assert.strictEqual(r.expiryDate, '05/04/2029');
});

// ---- Person ----
test('Person.mergeGplx: gán trực tiếp lần đầu, nối "|" lần 2', () => {
  const p = App.Person.create({ cccdNumber: '001', fullName: 'A', dateOfBirth: '01/01/2000' });
  App.Person.mergeGplx(p, { number: '111', licenseClass: 'A1', issueDate: '01/01/2020' });
  assert.strictEqual(p.gplxNumber, '111');
  assert.strictEqual(App.Person.hasGplx(p), true);

  App.Person.mergeGplx(p, { number: '222', licenseClass: 'B2', issueDate: '02/02/2021' });
  assert.strictEqual(p.gplxNumber, '111|222');
  assert.strictEqual(p.gplxClass, 'A1|B2');
});

test('Person.toRow/toColumnValueMap: đúng số cột và ánh xạ', () => {
  const p = App.Person.create({ cccdNumber: '001', fullName: 'A', dateOfBirth: '01/01/2000', branch: 'CN1' });
  const row = App.Person.toRow(p);
  assert.strictEqual(row.length, App.Person.COLUMNS.length);
  const map = App.Person.toColumnValueMap(p);
  assert.strictEqual(map['Chi nhánh'], 'CN1');
  assert.strictEqual(map['Số CCCD'], '001');
});

// ---- DvhcConverter ----
(async () => {
  await asyncTest('DvhcConverter.resolveAddress: khớp đúng ví dụ mẫu trong tài liệu bàn giao', async () => {
    const r = await App.DvhcConverter.resolveAddress('12 Nguyễn Huệ, Phường 4, Thành phố Tân An, Long An');
    assert.strictEqual(r.detail, '12 Nguyễn Huệ');
    assert.strictEqual(r.code, '27694');
    assert.strictEqual(r.newAddress, 'Phường Long An, Tỉnh Tây Ninh');
    assert.strictEqual(r.warning, '');
    assert.strictEqual(r.fullNewAddress, '12 Nguyễn Huệ, Phường Long An, Tỉnh Tây Ninh');
  });

  await asyncTest('DvhcConverter.resolveAddress: báo "không tìm thấy" khi không khớp', async () => {
    const r = await App.DvhcConverter.resolveAddress('1 Đường X, Xã Không Có Thật, Tỉnh Không Có Thật');
    assert.strictEqual(r.code, '');
    assert.ok(r.warning.indexOf('Không tìm thấy') !== -1);
  });

  test('DvhcConverter.normalizeAddressPart: bỏ dấu + tiền tố hành chính', () => {
    assert.strictEqual(App.DvhcConverter.normalizeAddressPart('Phường 4'), '4');
    assert.strictEqual(App.DvhcConverter.normalizeAddressPart('Thành phố Tân An'), 'tan an');
  });

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
