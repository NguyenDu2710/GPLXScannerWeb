// Bộ điều khiển chính: quản lý state trong bộ nhớ, điều hướng giữa các
// "màn hình" (render thẳng HTML vào #app, không dùng framework), và nối
// các module logic (Person, CccdParser, GplxParser, DvhcConverter,
// GoogleForm, Export, Storage, Camera) lại với nhau.
(function (App) {
  'use strict';

  const state = {
    session: { saleName: '' },
    people: [],
    awaitingGplxId: null,
    formSettings: { formResponseUrl: '', entryIdByColumn: {} },
    appsScriptSettings: { webAppUrl: '' },
    activeSheetMethod: '', // 'appsScript' | 'form' | ''
    currentView: null,
    activeCleanup: null, // hàm dọn dẹp (dừng camera...) trước khi đổi màn hình
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function $(sel, root) { return (root || document).querySelector(sel); }

  function persistPeople() {
    App.Storage.savePeople(state.people);
    App.Storage.saveAwaitingGplxId(state.awaitingGplxId);
  }

  function findPersonById(id) {
    for (let i = 0; i < state.people.length; i += 1) {
      if (state.people[i].id === id) return state.people[i];
    }
    return null;
  }

  function isSheetConfigured() {
    if (state.activeSheetMethod === 'appsScript') return App.Storage.isAppsScriptConfigured(state.appsScriptSettings);
    if (state.activeSheetMethod === 'form') return App.Storage.isFormSettingsConfigured(state.formSettings);
    return false;
  }

  // ===========================================================
  // ĐIỀU HƯỚNG
  // ===========================================================

  function render(view, params) {
    if (state.activeCleanup) {
      try { state.activeCleanup(); } catch (e) { /* ignore */ }
      state.activeCleanup = null;
    }
    state.currentView = view;
    const app = $('#app');
    switch (view) {
      case 'login': app.innerHTML = renderLogin(params || {}); wireLogin(params || {}); break;
      case 'home': app.innerHTML = renderHome(); wireHome(); break;
      case 'cccdScan': app.innerHTML = renderCameraShell('cccd', 'Quét QR mặt sau CCCD', 'Đưa mã QR ở mặt sau thẻ CCCD gắn chip vào khung hình'); wireCccdScan(); break;
      case 'cccdConfirm': app.innerHTML = renderCccdConfirm(params.record); wireCccdConfirm(params.record); break;
      case 'gplxScan': app.innerHTML = renderGplxScan(params); wireGplxScan(params); break;
      case 'gplxConfirm': app.innerHTML = renderGplxConfirm(params); wireGplxConfirm(params); break;
      case 'sheetSettings': app.innerHTML = renderSheetSettings(); wireSheetSettings(); break;
      default: app.innerHTML = '<p>Không tìm thấy màn hình.</p>';
    }
    window.scrollTo(0, 0);
  }

  // ===========================================================
  // MÀN ĐĂNG NHẬP
  // ===========================================================

  function renderLogin(params) {
    const isEditing = !!params.isEditing;
    const prefill = params.session || { saleName: '' };
    return (
      '<div class="screen login-screen"><div class="login-card">' +
      (isEditing
        ? '<h1>Đổi tên Sale</h1>'
        : '<div class="login-icon">📷</div><h1>Quét CCCD / GPLX</h1>' +
          '<p class="muted">Nhập tên Sale trước khi bắt đầu quét.</p>') +
      '<form id="login-form">' +
      '<label>Tên Sale<input type="text" id="login-salename" value="' + esc(prefill.saleName) + '"></label>' +
      '<div class="field-error" id="err-salename" hidden>Bắt buộc nhập</div>' +
      '<div class="actions">' +
      (isEditing ? '<button type="button" id="login-cancel" class="btn btn-outline">Hủy</button>' : '') +
      '<button type="submit" class="btn btn-primary">' + (isEditing ? 'Lưu' : 'Bắt đầu') + '</button>' +
      '</div></form></div></div>'
    );
  }

  function wireLogin(params) {
    const isEditing = !!params.isEditing;
    $('#login-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      const saleName = $('#login-salename').value.trim();
      $('#err-salename').hidden = !!saleName;
      if (!saleName) return;
      const session = { saleName: saleName };
      App.Storage.saveSession(session);
      state.session = session;
      if (isEditing) {
        App.showToast('Đã lưu tên Sale.');
      }
      render('home');
    });
    if (isEditing) {
      $('#login-cancel').addEventListener('click', function () { render('home'); });
    }
  }

  // ===========================================================
  // MÀN CHÍNH (HOME)
  // ===========================================================

  function renderPersonRow(p) {
    const gplxLine = App.Person.hasGplx(p)
      ? 'GPLX: ' + esc(p.gplxNumber.split('|').join(', '))
      : 'Chưa có GPLX';
    const courseLine = p.course ? ' • Khóa ' + esc(p.course) : '';
    const initial = (p.fullName || '?').trim().charAt(0).toUpperCase() || '?';
    return (
      '<div class="person-row" data-id="' + esc(p.id) + '">' +
      '<div class="person-avatar">' + esc(initial) + '</div>' +
      '<div class="person-info">' +
      '<div class="person-name">' + esc(p.fullName || '(Chưa có tên)') + '</div>' +
      '<div class="person-sub">CCCD: ' + esc(p.cccdNumber) + courseLine + '</div>' +
      '<div class="person-sub">' + gplxLine + '</div>' +
      '</div>' +
      '<div class="person-actions">' +
      (p.sentToSheet ? '<span class="sent-badge" title="Đã gửi lên Sheet">☁️</span>' : '') +
      '<button class="icon-btn btn-attach-gplx" data-id="' + esc(p.id) + '" title="Gắn/Sửa GPLX">' +
      (App.Person.hasGplx(p) ? '🪪✅' : '🪪') +
      '</button>' +
      '<button class="icon-btn btn-delete-person" data-id="' + esc(p.id) + '" title="Xóa">🗑️</button>' +
      '</div></div>'
    );
  }

  function renderHome() {
    const configured = isSheetConfigured();
    const awaiting = state.awaitingGplxId ? findPersonById(state.awaitingGplxId) : null;
    return (
      '<div class="screen home-screen">' +
      '<header class="app-header">' +
      '<div><h1>Quét CCCD / GPLX</h1>' +
      '<div class="muted small">' + esc(state.session.saleName) + '</div></div>' +
      '<div class="header-actions">' +
      '<button id="btn-switch-user" class="icon-btn" title="Đổi tên Sale">👤</button>' +
      '<button id="btn-sheet-settings" class="icon-btn" title="Kết nối Google Sheet">' + (configured ? '☁️✅' : '☁️') + '</button>' +
      '</div></header>' +
      '<div class="scan-buttons">' +
      '<button id="btn-scan-cccd" class="btn btn-primary">🪪 Quét CCCD (người mới)</button>' +
      '<button id="btn-scan-gplx" class="btn btn-primary">🛵 Quét GPLX</button>' +
      '</div>' +
      (awaiting
        ? '<div class="banner">⏳ Đang chờ quét GPLX cho: <strong>' + esc(awaiting.fullName) + '</strong>' +
          '<button id="btn-skip-gplx" class="link-btn">Bỏ qua</button></div>'
        : '') +
      '<h2 class="list-title">Danh sách đã quét (' + state.people.length + ')</h2>' +
      '<div class="people-list">' +
      (state.people.length === 0
        ? '<p class="empty-hint">Chưa có dữ liệu.<br>Bấm "Quét CCCD" để bắt đầu thêm một người.</p>'
        : state.people.map(renderPersonRow).join('')) +
      '</div>' +
      '<div class="bottom-actions">' +
      '<button id="btn-send-sheet" class="btn btn-primary full">⬆️ Gửi lên Google Sheet</button>' +
      '<div class="row-2">' +
      '<button id="btn-export-excel" class="btn btn-outline">📊 Xuất Excel</button>' +
      '<button id="btn-export-txt" class="btn btn-outline">📄 Xuất TXT</button>' +
      '</div></div></div>'
    );
  }

  function wireHome() {
    $('#btn-switch-user').addEventListener('click', function () {
      render('login', { isEditing: true, session: state.session });
    });
    $('#btn-sheet-settings').addEventListener('click', function () { render('sheetSettings'); });
    $('#btn-scan-cccd').addEventListener('click', function () { startCccdScan(); });
    $('#btn-scan-gplx').addEventListener('click', function () { startGplxForActive(); });

    const skipBtn = $('#btn-skip-gplx');
    if (skipBtn) {
      skipBtn.addEventListener('click', function () {
        state.awaitingGplxId = null;
        persistPeople();
        render('home');
      });
    }

    $('#btn-send-sheet').addEventListener('click', handleSendToSheet);
    $('#btn-export-excel').addEventListener('click', function () {
      if (state.people.length === 0) { App.showToast('Danh sách đang trống, chưa có gì để xuất.'); return; }
      try { App.Export.exportToExcel(state.people); } catch (e) { App.showToast('Xuất file thất bại: ' + e.message); }
    });
    $('#btn-export-txt').addEventListener('click', function () {
      if (state.people.length === 0) { App.showToast('Danh sách đang trống, chưa có gì để xuất.'); return; }
      try { App.Export.exportToTxt(state.people); } catch (e) { App.showToast('Xuất file thất bại: ' + e.message); }
    });

    $('.people-list').addEventListener('click', function (ev) {
      const attachBtn = ev.target.closest('.btn-attach-gplx');
      if (attachBtn) { startGplxFor(attachBtn.dataset.id); return; }
      const delBtn = ev.target.closest('.btn-delete-person');
      if (delBtn) { deletePerson(delBtn.dataset.id); return; }
    });
  }

  function deletePerson(id) {
    const index = state.people.findIndex(function (p) { return p.id === id; });
    if (index === -1) return;
    const removed = state.people[index];
    state.people.splice(index, 1);
    if (state.awaitingGplxId === id) state.awaitingGplxId = null;
    persistPeople();
    render('home');
    App.showToast('Đã xóa: ' + (removed.fullName || removed.cccdNumber), {
      actionLabel: 'Hoàn tác',
      onAction: function () {
        state.people.splice(index, 0, removed);
        persistPeople();
        render('home');
      },
    });
  }

  async function handleSendToSheet() {
    if (state.people.length === 0) {
      App.showToast('Danh sách đang trống, chưa có gì để gửi.');
      return;
    }
    if (!isSheetConfigured()) {
      const go = confirm(
        'Bạn cần kết nối tới Google Sheet trước khi gửi dữ liệu.\n\nBấm OK để đi tới màn cấu hình.',
      );
      if (go) render('sheetSettings');
      return;
    }
    const unsent = state.people.filter(function (p) { return !p.sentToSheet; }).length;
    if (unsent === 0) {
      App.showToast('Tất cả bản ghi đã được gửi trước đó.');
      return;
    }

    const btn = $('#btn-send-sheet');
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Đang gửi...';
    try {
      const result = state.activeSheetMethod === 'appsScript'
        ? await App.AppsScriptSheet.submitAll(state.people, state.appsScriptSettings.webAppUrl)
        : await App.GoogleForm.submitAll(state.people, state.formSettings);
      persistPeople();
      App.showToast(
        'Đã gửi ' + result.successCount + ' bản ghi. Trình duyệt không đọc được phản hồi từ Google (CORS) ' +
        'nên hãy mở Google Sheet để xác nhận dữ liệu đã vào đúng chưa.',
        { duration: 8000 },
      );
    } catch (e) {
      App.showToast('Gửi thất bại: ' + e.message);
    } finally {
      if (state.currentView === 'home') render('home');
      else { btn.disabled = false; btn.textContent = originalText; }
    }
  }

  // ===========================================================
  // KHUNG CAMERA DÙNG CHUNG (CCCD & GPLX)
  // ===========================================================

  function renderCameraShell(idPrefix, title, hintText) {
    return (
      '<div class="screen camera-screen">' +
      '<div class="camera-topbar">' +
      '<button id="btn-cancel-' + idPrefix + '-scan" class="icon-btn">←</button>' +
      '<span>' + esc(title) + '</span><span class="spacer"></span>' +
      '</div>' +
      '<div class="camera-viewport"><video id="' + idPrefix + '-video" playsinline muted autoplay></video></div>' +
      '<div class="camera-hint" id="' + idPrefix + '-hint">' + esc(hintText) + '</div>' +
      '</div>'
    );
  }

  // ===========================================================
  // QUÉT CCCD (QR)
  // ===========================================================

  function startCccdScan() {
    render('cccdScan');
  }

  function wireCccdScan() {
    const video = $('#cccd-video');
    const hint = $('#cccd-hint');
    $('#btn-cancel-cccd-scan').addEventListener('click', function () { render('home'); });

    let stream = null;
    let scanController = null;
    let cancelled = false;

    state.activeCleanup = function () {
      cancelled = true;
      if (scanController) scanController.stop();
      App.Camera.stopStream(stream);
    };

    // Quét nhầm mã QR khác (không phải mặt sau CCCD) -> quét tiếp NGAY TRÊN
    // luồng camera đang mở, không xin cấp lại camera (tránh rò rỉ stream
    // cũ + xin quyền camera lặp lại nhiều lần).
    function startScanLoop() {
      scanController = App.Camera.startQrScan(
        video,
        function (text) {
          const record = App.CccdParser.parse(text);
          if (!record) {
            hint.textContent = 'Mã QR không đúng định dạng CCCD. Đang quét tiếp...';
            hint.classList.add('error');
            if (!cancelled) startScanLoop();
            return;
          }
          render('cccdConfirm', { record: record });
        },
        function (err) { hint.textContent = err.message; hint.classList.add('error'); },
      );
    }

    App.Camera.startStream({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(function (s) {
        if (cancelled) { App.Camera.stopStream(s); return; }
        stream = s;
        return App.Camera.attachToVideo(video, stream);
      })
      .then(function () {
        if (cancelled) return;
        startScanLoop();
      })
      .catch(function (err) {
        hint.textContent = 'Không thể mở Camera: ' + err.message;
        hint.classList.add('error');
      });
  }

  // ===========================================================
  // XÁC NHẬN CCCD + CHUYỂN ĐỔI ĐỊA CHỈ ĐVHC + THÔNG TIN KHÓA HỌC
  // ===========================================================

  function renderCccdConfirm(record) {
    const oldAddress = record.address || '';
    return (
      '<div class="screen form-screen">' +
      '<div class="form-topbar"><button id="btn-cancel-cccd-confirm" class="icon-btn">←</button><span>Xác nhận thông tin CCCD</span></div>' +
      '<form id="cccd-confirm-form" class="form-body">' +
      '<label>Số CCCD<input id="f-cccd-number" value="' + esc(record.cccdNumber) + '"></label>' +
      '<div class="field-error" id="err-cccd-number" hidden>Bắt buộc nhập</div>' +
      '<label>Họ và tên<input id="f-full-name" value="' + esc(record.fullName) + '"></label>' +
      '<div class="field-error" id="err-full-name" hidden>Bắt buộc nhập</div>' +
      '<label>Ngày sinh (dd/MM/yyyy)<input id="f-dob" value="' + esc(record.dateOfBirth) + '"></label>' +
      '<label>Giới tính<input id="f-gender" value="' + esc(record.gender) + '"></label>' +
      (oldAddress
        ? '<div class="field-static"><span class="field-label">Địa chỉ cũ (theo CCCD, để đối chiếu)</span>' +
          '<div class="static-value">' + esc(oldAddress) + '</div></div>'
        : '') +
      '<label>Nơi thường trú (địa chỉ mới sẽ được lưu)' +
      '<span class="input-with-spinner"><input id="f-address" value="' + esc(oldAddress) + '">' +
      '<span id="address-spinner" class="mini-spinner"></span></span></label>' +
      '<div class="warning-text" id="address-warning" hidden></div>' +
      '<label>Ngày cấp CCCD (dd/MM/yyyy)<input id="f-cccd-issue-date" value="' + esc(record.cccdIssueDate) + '"></label>' +
      '<hr>' +
      '<h3>Thông tin đăng ký khóa học</h3>' +
      '<label>Khóa (hạng đăng ký)<select id="f-course-class"><option value="">-- Hạng --</option>' +
      App.Person.COURSE_CLASS_OPTIONS.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('') +
      '</select></label>' +
      '<label>Mã lớp (VD: K24)<input id="f-course-batch"></label>' +
      '<label>Số điện thoại<input id="f-phone" type="tel"></label>' +
      '<label>Số tiền học phí đã đóng (VD: 2.000.000)<input id="f-tuition"></label>' +
      '<button type="submit" class="btn btn-primary full">💾 Lưu vào danh sách</button>' +
      '</form></div>'
    );
  }

  function wireCccdConfirm(record) {
    $('#btn-cancel-cccd-confirm').addEventListener('click', function () { render('home'); });

    const oldAddress = record.address || '';
    if (oldAddress.trim()) {
      const spinner = $('#address-spinner');
      spinner.hidden = false;
      App.DvhcConverter.resolveAddress(oldAddress).then(function (result) {
        spinner.hidden = true;
        if (result.fullNewAddress) {
          $('#f-address').value = result.fullNewAddress;
        }
        if (result.warning) {
          const w = $('#address-warning');
          w.hidden = false;
          w.textContent = '⚠ ' + result.warning + ' Vui lòng kiểm tra/sửa lại địa chỉ mới ở trên.';
        }
      }).catch(function () {
        spinner.hidden = true;
      });
    } else {
      $('#address-spinner').hidden = true;
    }

    $('#cccd-confirm-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      const cccdNumber = $('#f-cccd-number').value.trim();
      const fullName = $('#f-full-name').value.trim();
      $('#err-cccd-number').hidden = !!cccdNumber;
      $('#err-full-name').hidden = !!fullName;
      if (!cccdNumber || !fullName) return;

      const person = App.Person.create({
        cccdNumber: cccdNumber,
        fullName: fullName,
        dateOfBirth: $('#f-dob').value.trim(),
        gender: $('#f-gender').value.trim(),
        address: $('#f-address').value.trim(),
        cccdIssueDate: $('#f-cccd-issue-date').value.trim(),
        courseClass: $('#f-course-class').value,
        courseBatch: $('#f-course-batch').value.trim(),
        phoneNumber: $('#f-phone').value.trim(),
        tuitionPaid: $('#f-tuition').value.trim(),
        scannedByUser: state.session.saleName,
      });
      state.people.unshift(person);
      state.awaitingGplxId = person.id;
      persistPeople();
      App.showToast('Đã thêm người mới. Có thể quét GPLX ngay cho người này nếu có.');
      render('home');
    });
  }

  // ===========================================================
  // QUÉT GPLX (CHỤP ẢNH + OCR)
  // ===========================================================

  function startGplxForActive() {
    if (!state.awaitingGplxId || !findPersonById(state.awaitingGplxId)) {
      App.showToast('Cần quét CCCD trước. Nếu muốn gắn GPLX cho người đã có sẵn, bấm nút GPLX trên dòng người đó.');
      return;
    }
    startGplxFor(state.awaitingGplxId);
  }

  function startGplxFor(personId) {
    const person = findPersonById(personId);
    if (!person) {
      App.showToast('Không tìm thấy người này (có thể đã bị xóa).');
      return;
    }
    render('gplxScan', { targetId: personId, targetName: person.fullName });
  }

  function renderGplxScan(params) {
    const title = params.targetName ? 'Quét GPLX cho: ' + esc(params.targetName) : 'Chụp & quét GPLX';
    return (
      '<div class="screen camera-screen">' +
      '<div class="camera-topbar"><button id="btn-cancel-gplx-scan" class="icon-btn">←</button><span>' + title + '</span><span class="spacer"></span></div>' +
      (params.targetName ? '<div class="target-banner">Đang gắn cho: ' + esc(params.targetName) + '</div>' : '') +
      '<div class="camera-viewport"><video id="gplx-video" playsinline muted autoplay></video></div>' +
      '<div class="camera-hint" id="gplx-hint">Đưa mặt trước GPLX vào khung hình, giữ thẳng và đủ sáng</div>' +
      '<button id="btn-capture-gplx" class="capture-btn">📷</button>' +
      '</div>'
    );
  }

  function wireGplxScan(params) {
    const video = $('#gplx-video');
    const hint = $('#gplx-hint');
    const captureBtn = $('#btn-capture-gplx');
    $('#btn-cancel-gplx-scan').addEventListener('click', function () { render('home'); });

    let stream = null;
    let cancelled = false;
    state.activeCleanup = function () {
      cancelled = true;
      App.Camera.stopStream(stream);
    };

    App.Camera.startStream({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(function (s) {
        if (cancelled) { App.Camera.stopStream(s); return; }
        stream = s;
        return App.Camera.attachToVideo(video, stream);
      })
      .catch(function (err) {
        hint.textContent = 'Không thể mở Camera: ' + err.message;
        hint.classList.add('error');
        captureBtn.disabled = true;
      });

    captureBtn.addEventListener('click', function () {
      if (!stream) return;
      captureBtn.disabled = true;
      hint.classList.remove('error');
      hint.textContent = 'Đang nhận diện chữ (OCR)... có thể mất vài giây, lần đầu chậm hơn do tải dữ liệu ngôn ngữ.';
      const canvas = App.Camera.captureFrameToCanvas(video);

      if (typeof Tesseract === 'undefined') {
        hint.textContent = 'Chưa tải được thư viện OCR (Tesseract). Kiểm tra kết nối mạng rồi thử lại.';
        hint.classList.add('error');
        captureBtn.disabled = false;
        return;
      }

      Tesseract.recognize(canvas, 'vie')
        .then(function (result) {
          const text = (result && result.data && result.data.text) || '';
          if (!text.trim()) {
            hint.textContent = 'Không đọc được chữ trong ảnh. Vui lòng chụp lại rõ nét hơn.';
            hint.classList.add('error');
            captureBtn.disabled = false;
            return;
          }
          const data = App.GplxParser.parse(text);
          const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          render('gplxConfirm', {
            data: data,
            targetId: params.targetId,
            targetName: params.targetName,
            imageDataUrl: imageDataUrl,
            rawText: text,
          });
        })
        .catch(function (err) {
          hint.textContent = 'Có lỗi khi xử lý ảnh: ' + err.message;
          hint.classList.add('error');
          captureBtn.disabled = false;
        });
    });
  }

  // ===========================================================
  // XÁC NHẬN GPLX -> GẮN VÀO NGƯỜI ĐÃ CHỌN
  // ===========================================================

  function renderGplxConfirm(params) {
    const data = params.data || {};
    return (
      '<div class="screen form-screen">' +
      '<div class="form-topbar"><button id="btn-cancel-gplx-confirm" class="icon-btn">←</button><span>Xác nhận thông tin GPLX</span></div>' +
      '<form id="gplx-confirm-form" class="form-body">' +
      '<div class="target-banner">Gắn GPLX cho: ' + esc(params.targetName || '(chưa rõ tên)') + '</div>' +
      (params.imageDataUrl ? '<img class="captured-photo" src="' + params.imageDataUrl + '" alt="Ảnh GPLX vừa chụp">' : '') +
      '<p class="warning-text">Dữ liệu đọc bằng OCR có thể chưa chính xác hoàn toàn. Đối chiếu với ảnh/văn bản OCR bên dưới và sửa lại trước khi lưu.</p>' +
      '<label>Số GPLX<input id="f-gplx-number" value="' + esc(data.number) + '"></label>' +
      '<div class="field-error" id="err-gplx-number" hidden>Bắt buộc nhập</div>' +
      '<label>Hạng bằng lái<input id="f-gplx-class" value="' + esc(data.licenseClass) + '"></label>' +
      '<label>Ngày cấp (dd/MM/yyyy)<input id="f-gplx-issue-date" value="' + esc(data.issueDate) + '"></label>' +
      '<label>Có giá trị đến<input id="f-gplx-expiry-date" value="' + esc(data.expiryDate) + '"></label>' +
      (params.rawText
        ? '<details class="raw-ocr"><summary>Xem văn bản OCR đọc được (gốc)</summary><pre>' + esc(params.rawText) + '</pre></details>'
        : '') +
      '<button type="submit" class="btn btn-primary full">💾 Lưu GPLX cho người này</button>' +
      '</form></div>'
    );
  }

  function wireGplxConfirm(params) {
    $('#btn-cancel-gplx-confirm').addEventListener('click', function () { render('home'); });
    $('#gplx-confirm-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      const number = $('#f-gplx-number').value.trim();
      $('#err-gplx-number').hidden = !!number;
      if (!number) return;

      const person = findPersonById(params.targetId);
      if (!person) {
        App.showToast('Không tìm thấy người này (có thể đã bị xóa). Chưa lưu được GPLX.');
        render('home');
        return;
      }
      const alreadyHadGplx = App.Person.hasGplx(person);
      App.Person.mergeGplx(person, {
        number: number,
        licenseClass: $('#f-gplx-class').value.trim(),
        issueDate: $('#f-gplx-issue-date').value.trim(),
        expiryDate: $('#f-gplx-expiry-date').value.trim(),
      });
      if (state.awaitingGplxId === params.targetId) state.awaitingGplxId = null;
      persistPeople();
      App.showToast(
        alreadyHadGplx
          ? 'Đã thêm GPLX thứ 2 cho ' + person.fullName + ' (nối bằng "|").'
          : 'Đã gắn GPLX cho ' + person.fullName + '.',
      );
      render('home');
    });
  }

  // ===========================================================
  // CẤU HÌNH KẾT NỐI GOOGLE SHEET (QUA GOOGLE FORM)
  // ===========================================================

  function renderSheetSettings() {
    const appsScriptConfigured = App.Storage.isAppsScriptConfigured(state.appsScriptSettings);
    const formConfigured = App.Storage.isFormSettingsConfigured(state.formSettings);
    const activeLabel =
      state.activeSheetMethod === 'appsScript' ? 'Google Apps Script' :
      state.activeSheetMethod === 'form' ? 'Google Form' : null;

    return (
      '<div class="screen form-screen">' +
      '<div class="form-topbar"><button id="btn-back-sheet-settings" class="icon-btn">←</button><span>Kết nối Google Sheet</span></div>' +
      '<div class="form-body">' +
      (activeLabel
        ? '<div class="card status-card">☁️✅ Đang dùng: <strong>' + esc(activeLabel) + '</strong> để gửi dữ liệu.</div>'
        : '<div class="card status-card">☁️ Chưa kết nối Google Sheet nào.</div>') +

      '<div class="card method-card">' +
      '<h3>Cách 1: Google Apps Script (khuyến nghị)</h3>' +
      '<p class="muted small">Ghi thẳng vào đúng Google Sheet bạn chỉ định, không cần tạo Form riêng, không cần khớp tên cột thủ công.</p>' +
      '<ol>' +
      '<li>Mở đúng Google Sheet muốn ghi vào &gt; menu <strong>Extensions &gt; Apps Script</strong>.</li>' +
      '<li>Xóa code mẫu, dán TOÀN BỘ đoạn code bên dưới vào (bấm "Sao chép").</li>' +
      '<li>Sửa dòng <code>TARGET_GID</code> nếu Sheet của bạn ở tab khác (lấy số sau <code>gid=</code> trên link Sheet).</li>' +
      '<li>Bấm <strong>Deploy &gt; New deployment</strong> &gt; chọn loại <strong>Web app</strong> &gt; Execute as: <strong>Me</strong>, Who has access: <strong>Anyone</strong> &gt; Deploy &gt; cấp quyền khi được hỏi.</li>' +
      '<li>Copy "Web app URL" (dạng .../exec), dán vào ô bên dưới.</li>' +
      '</ol>' +
      '<div class="code-box">' +
      '<div class="code-box-header"><span>apps-script/Code.gs</span><button type="button" id="btn-copy-script" class="link-btn">Sao chép</button></div>' +
      '<pre id="apps-script-code">Đang tải mã nguồn...</pre>' +
      '</div>' +
      '<label>Web app URL<input id="apps-script-url-input" placeholder="https://script.google.com/macros/s/.../exec" value="' + esc(state.appsScriptSettings.webAppUrl) + '"></label>' +
      '<button id="btn-save-apps-script" class="btn btn-primary">💾 Lưu & dùng cách này</button> ' +
      (appsScriptConfigured ? '<button id="btn-clear-apps-script" class="btn btn-outline">🗑️ Xóa</button>' : '') +
      '</div>' +

      '<div class="card method-card">' +
      '<h3>Cách 2: Google Form</h3>' +
      '<p class="muted small">Không muốn đụng tới Apps Script? Dùng Google Form (cần dò tên cột thủ công hơn 1 chút).</p>' +
      '<ol>' +
      '<li>Tạo một Google Form mới (forms.google.com). Mỗi câu hỏi dùng loại "Đoạn (Paragraph)" hoặc "Trả lời ngắn".</li>' +
      '<li>Vào tab "Câu trả lời" &gt; bấm biểu tượng Google Sheets để tạo Sheet liên kết nhận phản hồi.</li>' +
      '<li>Quay lại Form, tạo mỗi câu hỏi ứng với 1 cột bạn muốn lưu (có thể chỉ chọn vài cột). Tên câu hỏi không quan trọng.</li>' +
      '<li>Bấm menu ⋮ (góc trên) &gt; "Nhận liên kết đã điền sẵn".</li>' +
      '<li>Ở mỗi câu hỏi, gõ ĐÚNG tên cột tương ứng (xem danh sách bên dưới) làm câu trả lời mẫu.</li>' +
      '<li>Bấm "Nhận liên kết", bấm "Sao chép liên kết", rồi dán vào ô bên dưới và bấm "Phân tích liên kết".</li>' +
      '</ol>' +
      '<div class="chips">' + App.Person.COLUMNS.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') + '</div>' +
      (formConfigured
        ? '<div class="sub-card">✅ Đã lưu cấu hình Form (' + Object.keys(state.formSettings.entryIdByColumn).length + ' cột): ' +
          esc(Object.keys(state.formSettings.entryIdByColumn).join(', ')) +
          '<br><button id="btn-clear-sheet-settings" class="btn btn-outline">🗑️ Xóa</button></div>'
        : '') +
      '<label>' + (formConfigured ? 'Dán liên kết mới để thay thế:' : 'Dán "liên kết đã điền sẵn" từ Google Form vào đây:') +
      '<textarea id="prefill-link-input" rows="3" placeholder="https://docs.google.com/forms/d/e/.../viewform?entry.123=..."></textarea></label>' +
      '<button id="btn-parse-link" class="btn btn-primary">🔍 Phân tích liên kết</button>' +
      '<div id="parsed-preview"></div>' +
      '</div>' +
      '</div></div>'
    );
  }

  function wireSheetSettings() {
    $('#btn-back-sheet-settings').addEventListener('click', function () { render('home'); });

    // ---- Cách 1: Apps Script ----
    fetch('./apps-script/Code.gs')
      .then(function (res) { return res.ok ? res.text() : Promise.reject(new Error('HTTP ' + res.status)); })
      .then(function (text) { const el = $('#apps-script-code'); if (el) el.textContent = text; })
      .catch(function () { const el = $('#apps-script-code'); if (el) el.textContent = 'Không tải được. Mở file apps-script/Code.gs trong thư mục dự án để copy thủ công.'; });

    $('#btn-copy-script').addEventListener('click', function () {
      const text = $('#apps-script-code').textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(function () { App.showToast('Đã sao chép mã nguồn.'); })
          .catch(function () { App.showToast('Không sao chép được, hãy tự bôi đen và copy.'); });
      } else {
        App.showToast('Trình duyệt không hỗ trợ sao chép tự động, hãy tự bôi đen và copy.');
      }
    });

    $('#btn-save-apps-script').addEventListener('click', function () {
      const url = $('#apps-script-url-input').value.trim();
      if (!url) { App.showToast('Chưa dán Web app URL.'); return; }
      const settings = { webAppUrl: url };
      App.Storage.saveAppsScriptSettings(settings);
      App.Storage.saveActiveSheetMethod('appsScript');
      state.appsScriptSettings = settings;
      state.activeSheetMethod = 'appsScript';
      App.showToast('Đã lưu & chuyển sang gửi qua Google Apps Script.');
      render('sheetSettings');
    });

    const clearAppsScriptBtn = $('#btn-clear-apps-script');
    if (clearAppsScriptBtn) {
      clearAppsScriptBtn.addEventListener('click', function () {
        App.Storage.clearAppsScriptSettings();
        state.appsScriptSettings = { webAppUrl: '' };
        if (state.activeSheetMethod === 'appsScript') {
          state.activeSheetMethod = '';
          App.Storage.saveActiveSheetMethod('');
        }
        App.showToast('Đã xóa cấu hình Apps Script.');
        render('sheetSettings');
      });
    }

    // ---- Cách 2: Google Form ----
    const clearFormBtn = $('#btn-clear-sheet-settings');
    if (clearFormBtn) {
      clearFormBtn.addEventListener('click', function () {
        App.Storage.clearFormSettings();
        state.formSettings = { formResponseUrl: '', entryIdByColumn: {} };
        if (state.activeSheetMethod === 'form') {
          state.activeSheetMethod = '';
          App.Storage.saveActiveSheetMethod('');
        }
        App.showToast('Đã xóa cấu hình Form.');
        render('sheetSettings');
      });
    }

    $('#btn-parse-link').addEventListener('click', function () {
      const link = $('#prefill-link-input').value.trim();
      if (!link) return;
      let parsed;
      try {
        parsed = App.GoogleForm.parsePrefillLink(link);
      } catch (e) {
        App.showToast('Liên kết không hợp lệ: ' + e.message);
        return;
      }
      const detectedCols = Object.keys(parsed.entryIdByColumn);
      const missingCols = App.Person.COLUMNS.filter(function (c) { return detectedCols.indexOf(c) === -1; });

      let html = '<div class="card parsed-preview-card"><h3>Kết quả phân tích</h3>';
      if (detectedCols.length === 0) {
        html += '<p>Không dò được cột nào. Kiểm tra lại: đã điền đúng tên cột (ví dụ "Họ và tên") vào từng câu hỏi trước khi lấy liên kết chưa?</p>';
      } else {
        html += '<p>Đã nhận diện ' + detectedCols.length + '/' + App.Person.COLUMNS.length + ' cột:</p><ul class="detected-list">';
        detectedCols.forEach(function (c) { html += '<li>✔ ' + esc(c) + '</li>'; });
        html += '</ul>';
      }
      if (missingCols.length) {
        html += '<p class="warning-text">Chưa nhận diện (sẽ không được gửi): ' + esc(missingCols.join(', ')) + '</p>';
      }
      html += '<button id="btn-save-parsed" class="btn btn-primary" ' + (detectedCols.length === 0 ? 'disabled' : '') + '>💾 Lưu & dùng cách này</button></div>';
      $('#parsed-preview').innerHTML = html;

      const saveBtn = $('#btn-save-parsed');
      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          App.Storage.saveFormSettings(parsed);
          App.Storage.saveActiveSheetMethod('form');
          state.formSettings = parsed;
          state.activeSheetMethod = 'form';
          App.showToast('Đã lưu & chuyển sang gửi qua Google Form.');
          render('sheetSettings');
        });
      }
    });
  }

  // ===========================================================
  // KHỞI ĐỘNG APP
  // ===========================================================

  function init() {
    state.session = App.Storage.loadSession();
    state.people = App.Storage.loadPeople();
    state.awaitingGplxId = App.Storage.loadAwaitingGplxId();
    state.formSettings = App.Storage.loadFormSettings();
    state.appsScriptSettings = App.Storage.loadAppsScriptSettings();
    state.activeSheetMethod = App.Storage.loadActiveSheetMethod();
    App.DvhcConverter.preload();

    if (App.Storage.isSessionValid(state.session)) {
      render('home');
    } else {
      render('login');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.App = window.App || {});
