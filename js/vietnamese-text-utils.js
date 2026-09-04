// Bỏ dấu tiếng Việt + chuyển thường, dùng chung cho OCR GPLX và chuyển đổi
// địa chỉ ĐVHC. Không dùng cho giá trị hiển thị cho người dùng.
(function (App) {
  'use strict';

  const WITH_DIACRITICS =
    'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ' +
    'ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ';
  const WITHOUT_DIACRITICS =
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd' +
    'AAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYD';

  function stripVietnameseDiacritics(input) {
    const lower = String(input || '').toLowerCase();
    let out = '';
    for (let i = 0; i < lower.length; i += 1) {
      const ch = lower[i];
      const idx = WITH_DIACRITICS.indexOf(ch);
      out += idx === -1 ? ch : WITHOUT_DIACRITICS[idx].toLowerCase();
    }
    return out;
  }

  App.stripVietnameseDiacritics = stripVietnameseDiacritics;
})(window.App = window.App || {});
