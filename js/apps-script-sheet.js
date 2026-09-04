// Gửi dữ liệu THẲNG vào 1 Google Sheet cụ thể thông qua Google Apps Script
// (Web App) gắn ngay trong chính file Sheet đó — xem hướng dẫn + đoạn code
// mẫu trong apps-script/Code.gs. Đơn giản hơn cách Google Form vì:
//   - Không cần tạo Form riêng.
//   - Không cần dò "entry ID": gửi thẳng theo TÊN CỘT, script tự khớp với
//     dòng tiêu đề (header) trên Sheet.
//   - Ghi đúng vào 1 Sheet/tab do chính bạn chỉ định trong code.
//
// Cũng dùng kỹ thuật <form> POST + <iframe> ẩn như Google Form (xem ghi chú
// CORS trong google-form.js) vì cùng lý do: trình duyệt không cho đọc phản
// hồi cross-origin từ script.google.com.
(function (App) {
  'use strict';

  // Ký tự phân cách khi gửi kèm danh sách tên cột theo đúng thứ tự chuẩn,
  // để Apps Script biết tạo dòng tiêu đề theo thứ tự nào khi Sheet còn
  // trống. Dùng ký tự hiếm gặp trong tên cột tiếng Việt để an toàn.
  const ORDER_SEPARATOR = '||';

  function submitRecord(person, webAppUrl) {
    return new Promise(function (resolve) {
      if (!webAppUrl || !webAppUrl.trim()) {
        resolve(false);
        return;
      }
      const valueByColumn = App.Person.toColumnValueMap(person);

      const iframeName = 'gas_submit_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
      const iframe = document.createElement('iframe');
      iframe.name = iframeName;
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const form = document.createElement('form');
      form.action = webAppUrl;
      form.method = 'POST';
      form.target = iframeName;
      form.style.display = 'none';

      function addField(name, value) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value == null ? '' : value;
        form.appendChild(input);
      }

      App.Person.COLUMNS.forEach(function (col) { addField(col, valueByColumn[col]); });
      addField('__order', App.Person.COLUMNS.join(ORDER_SEPARATOR));

      document.body.appendChild(form);

      let done = false;
      function cleanup(result) {
        if (done) return;
        done = true;
        form.remove();
        setTimeout(function () { iframe.remove(); }, 1000);
        resolve(result);
      }

      iframe.addEventListener('load', function () { cleanup(true); });
      setTimeout(function () { cleanup(true); }, 4000);

      try {
        form.submit();
      } catch (e) {
        cleanup(false);
      }
    });
  }

  async function submitAll(records, webAppUrl, options) {
    options = options || {};
    const toSend = options.resend ? records.slice() : records.filter(function (r) { return !r.sentToSheet; });
    let success = 0;
    let fail = 0;
    for (let i = 0; i < toSend.length; i += 1) {
      const record = toSend[i];
      const ok = await submitRecord(record, webAppUrl);
      if (ok) {
        record.sentToSheet = true;
        success += 1;
      } else {
        fail += 1;
      }
      if (options.onProgress) options.onProgress(i + 1, toSend.length);
      if (i !== toSend.length - 1) {
        await new Promise(function (r) { setTimeout(r, 300); });
      }
    }
    return { successCount: success, failCount: fail };
  }

  App.AppsScriptSheet = { submitRecord: submitRecord, submitAll: submitAll, ORDER_SEPARATOR: ORDER_SEPARATOR };
})(window.App = window.App || {});
