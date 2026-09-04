// Gửi dữ liệu lên Google Sheet bằng cách giả lập nộp một Google Form đã
// liên kết với Sheet đó (mỗi bản ghi = 1 lượt "nộp form"). Không cần đăng
// nhập Google hay deploy Apps Script.
//
// LƯU Ý QUAN TRỌNG (khác với bản app di động): trình duyệt web KHÔNG cho
// phép JavaScript đọc phản hồi từ một tên miền khác (chính sách CORS của
// trình duyệt, không phải giới hạn của app này) — Google không cấp quyền
// đó cho các trang web tuỳ ý. Vì vậy phải gửi qua 1 <form> POST thật nhắm
// vào <iframe> ẩn (kỹ thuật chuẩn để nộp Google Form từ trang web tĩnh),
// và KHÔNG THỂ biết chắc chắn Google đã ghi nhận thành công hay chưa — chỉ
// biết là "đã gửi yêu cầu". Thỉnh thoảng nên mở Google Sheet lên kiểm tra
// lại cho chắc.
(function (App) {
  'use strict';

  // Phân tích "liên kết đã điền sẵn" lấy từ Google Form (menu ⋮ > "Nhận
  // liên kết đã điền sẵn"), trong đó mỗi câu hỏi được điền đúng bằng tên
  // cột (ví dụ câu hỏi ứng với "Họ và tên" được điền giá trị "Họ và tên").
  // Nhờ vậy tự động dò ra entry ID của từng câu hỏi.
  function parsePrefillLink(link) {
    const url = new URL(String(link || '').trim());
    let path = url.pathname;
    if (path.endsWith('/viewform')) {
      path = path.slice(0, -('/viewform'.length)) + '/formResponse';
    } else if (!path.endsWith('/formResponse')) {
      path = path + '/formResponse';
    }
    const formResponseUrl = url.origin + path;

    const entryIdByColumn = {};
    url.searchParams.forEach(function (value, key) {
      if (key.indexOf('entry.') !== 0) return;
      const normalizedValue = value.trim().toLowerCase();
      App.Person.COLUMNS.forEach(function (column) {
        if (normalizedValue === column.toLowerCase()) {
          entryIdByColumn[column] = key;
        }
      });
    });

    return { formResponseUrl: formResponseUrl, entryIdByColumn: entryIdByColumn };
  }

  // Gửi 1 bản ghi qua form POST + iframe ẩn. Luôn "resolve" sau khi gửi
  // (xem ghi chú CORS ở đầu file) — không có cách nào đáng tin cậy hơn để
  // biết chắc chắn Google đã ghi nhận hay chưa từ một trang web thuần.
  function submitRecord(person, settings) {
    return new Promise(function (resolve) {
      if (!App.Storage.isFormSettingsConfigured(settings)) {
        resolve(false);
        return;
      }
      const valueByColumn = App.Person.toColumnValueMap(person);

      const iframeName = 'gform_submit_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
      const iframe = document.createElement('iframe');
      iframe.name = iframeName;
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const form = document.createElement('form');
      form.action = settings.formResponseUrl;
      form.method = 'POST';
      form.target = iframeName;
      form.style.display = 'none';

      Object.keys(settings.entryIdByColumn).forEach(function (column) {
        const entryId = settings.entryIdByColumn[column];
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = entryId;
        input.value = valueByColumn[column] || '';
        form.appendChild(input);
      });

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

  // Gửi tuần tự từng bản ghi (không gửi đồng thời để tránh dồn quá nhiều
  // iframe/form cùng lúc). Bản ghi gửi xong sẽ đánh dấu sentToSheet. Bản
  // ghi đã đánh dấu trước đó sẽ bị bỏ qua trừ khi resend = true.
  async function submitAll(records, settings, options) {
    options = options || {};
    const toSend = options.resend ? records.slice() : records.filter(function (r) { return !r.sentToSheet; });
    let success = 0;
    let fail = 0;
    for (let i = 0; i < toSend.length; i += 1) {
      const record = toSend[i];
      const ok = await submitRecord(record, settings);
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

  App.GoogleForm = {
    parsePrefillLink: parsePrefillLink,
    submitRecord: submitRecord,
    submitAll: submitAll,
  };
})(window.App = window.App || {});
