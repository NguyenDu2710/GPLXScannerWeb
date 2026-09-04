// Chuyển đổi địa chỉ theo Căn cước công dân (ghi theo ĐVHC CŨ) sang ĐVHC MỚI
// (sau sáp nhập xã/tỉnh). Port từ code-doi-dvhc.js (nguồn: LOI TRAN, DVHC
// v1.0.0.16) — thuật toán giữ nguyên, chỉ đổi cách nạp danh mục cho khớp
// cấu trúc file của web app này.
(function (App) {
  'use strict';

  const stripDiacritics = App.stripVietnameseDiacritics;

  let rowsPromise = null;

  function loadRows() {
    if (!rowsPromise) {
      rowsPromise = fetch('./data/dvhc.json', { cache: 'no-cache' })
        .then(function (res) { return res.ok ? res.json() : []; })
        .then(function (rows) {
          return rows.map(function (row) {
            return Object.assign({}, row, { p: row.a.split('|') });
          });
        })
        .catch(function () { return []; });
    }
    return rowsPromise;
  }

  // Gọi trước (lúc app khởi động) để "làm nóng" danh mục, tránh lần chuyển
  // đổi đầu tiên phải chờ tải + parse file JSON ~1.5MB.
  function preload() {
    loadRows();
  }

  function normalizeAddressPart(value) {
    let s = stripDiacritics(String(value || '').trim());
    s = s.replace(
      /^(?:(?:thanh pho|thi xa|thi tran|phuong|quan|huyen|tinh|xa)\s+|(?:tp|tx|tt|p|q|h|t|x)\.\s*|(?:tp|tx|tt|p|q|h|t|x)\s+)/,
      '',
    );
    s = s.replace(/[.;]+$/, '');
    s = s.replace(/\s+/g, ' ');
    return s.trim();
  }

  async function resolveAddress(address) {
    const rawParts = String(address || '')
      .split(',')
      .map(function (p) { return p.trim(); })
      .filter(Boolean);
    const parts = rawParts.map(normalizeAddressPart);
    const rows = await loadRows();

    let bestLength = 0;
    let best = [];

    for (const row of rows) {
      const length = row.p.length;
      if (length > parts.length || length < 2 || length < bestLength) continue;

      let matches = true;
      for (let i = 1; i <= length; i += 1) {
        if (parts[parts.length - i] !== row.p[length - i]) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;

      if (length > bestLength) {
        bestLength = length;
        best = [row];
      } else {
        best.push(row);
      }
    }

    if (bestLength) {
      const codes = Array.from(new Set(best.map(function (row) { return row.c; })));
      const warning =
        codes.length === 1 ? '' : 'Địa chỉ trùng ' + codes.length + ' mã ĐVHC, cần chọn/sửa thủ công.';
      const selected = codes.length === 1 ? best.find(function (row) { return row.c === codes[0]; }) : null;

      const detail = rawParts.slice(0, rawParts.length - bestLength).join(', ');
      const newAddress = (selected && selected.n) || '';
      return {
        detail: detail,
        code: codes.length === 1 ? codes[0] : '',
        newAddress: newAddress,
        warning: warning,
        fullNewAddress: newAddress ? (detail ? detail + ', ' + newAddress : newAddress) : '',
      };
    }

    const labelIndex = rawParts.findIndex(function (part) {
      return /^(xã|phường|thị trấn)\s+/i.test(part);
    });

    return {
      detail: labelIndex >= 0 ? rawParts.slice(0, labelIndex).join(', ') : address,
      code: '',
      newAddress: '',
      warning: 'Không tìm thấy địa chỉ trong danh mục ĐVHC.',
      fullNewAddress: '',
    };
  }

  App.DvhcConverter = {
    preload: preload,
    normalizeAddressPart: normalizeAddressPart,
    resolveAddress: resolveAddress,
  };
})(window.App = window.App || {});
