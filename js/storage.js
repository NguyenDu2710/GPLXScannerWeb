// Lưu/đọc dữ liệu bằng localStorage của trình duyệt (tương đương
// shared_preferences ở bản app di động). Toàn bộ dữ liệu chỉ nằm trên máy
// đang mở trang web, không gửi đi đâu trừ khi bấm "Gửi lên Google Sheet".
(function (App) {
  'use strict';

  const KEYS = {
    session: 'cccd_web_user_session_v1',
    people: 'cccd_web_people_v1',
    awaitingGplxId: 'cccd_web_awaiting_gplx_id_v1',
    formSettings: 'cccd_web_google_form_settings_v1',
    appsScriptSettings: 'cccd_web_apps_script_settings_v1',
    activeSheetMethod: 'cccd_web_active_sheet_method_v1',
  };

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // localStorage đầy hoặc bị chặn (chế độ riêng tư...) -> bỏ qua, dữ
      // liệu trong phiên hiện tại vẫn dùng được, chỉ là không lưu bền.
      console.warn('Không thể lưu vào localStorage:', e);
    }
  }

  // ---- Phiên "đăng nhập" (tên Sale) ----
  function loadSession() {
    return readJson(KEYS.session, { saleName: '' });
  }
  function saveSession(session) {
    writeJson(KEYS.session, session);
  }
  function isSessionValid(session) {
    return !!(session && session.saleName && session.saleName.trim());
  }

  // ---- Danh sách người đã quét ----
  function loadPeople() {
    return readJson(KEYS.people, []);
  }
  function savePeople(people) {
    writeJson(KEYS.people, people);
  }

  function loadAwaitingGplxId() {
    return localStorage.getItem(KEYS.awaitingGplxId) || null;
  }
  function saveAwaitingGplxId(id) {
    if (id == null) {
      localStorage.removeItem(KEYS.awaitingGplxId);
    } else {
      localStorage.setItem(KEYS.awaitingGplxId, id);
    }
  }

  // ---- Cấu hình kết nối Google Form ----
  function loadFormSettings() {
    return readJson(KEYS.formSettings, { formResponseUrl: '', entryIdByColumn: {} });
  }
  function saveFormSettings(settings) {
    writeJson(KEYS.formSettings, settings);
  }
  function isFormSettingsConfigured(settings) {
    return !!(
      settings &&
      settings.formResponseUrl &&
      settings.entryIdByColumn &&
      Object.keys(settings.entryIdByColumn).length > 0
    );
  }
  function clearFormSettings() {
    localStorage.removeItem(KEYS.formSettings);
  }

  // ---- Cấu hình kết nối Google Apps Script (ghi thẳng vào 1 Sheet cụ thể) ----
  function loadAppsScriptSettings() {
    return readJson(KEYS.appsScriptSettings, { webAppUrl: '' });
  }
  function saveAppsScriptSettings(settings) {
    writeJson(KEYS.appsScriptSettings, settings);
  }
  function isAppsScriptConfigured(settings) {
    return !!(settings && settings.webAppUrl && settings.webAppUrl.trim());
  }
  function clearAppsScriptSettings() {
    localStorage.removeItem(KEYS.appsScriptSettings);
  }

  // ---- Phương thức gửi Sheet đang được chọn: 'appsScript' | 'form' | '' ----
  function loadActiveSheetMethod() {
    return localStorage.getItem(KEYS.activeSheetMethod) || '';
  }
  function saveActiveSheetMethod(method) {
    if (!method) {
      localStorage.removeItem(KEYS.activeSheetMethod);
    } else {
      localStorage.setItem(KEYS.activeSheetMethod, method);
    }
  }

  App.Storage = {
    loadSession: loadSession,
    saveSession: saveSession,
    isSessionValid: isSessionValid,
    loadPeople: loadPeople,
    savePeople: savePeople,
    loadAwaitingGplxId: loadAwaitingGplxId,
    saveAwaitingGplxId: saveAwaitingGplxId,
    loadFormSettings: loadFormSettings,
    saveFormSettings: saveFormSettings,
    isFormSettingsConfigured: isFormSettingsConfigured,
    clearFormSettings: clearFormSettings,
    loadAppsScriptSettings: loadAppsScriptSettings,
    saveAppsScriptSettings: saveAppsScriptSettings,
    isAppsScriptConfigured: isAppsScriptConfigured,
    clearAppsScriptSettings: clearAppsScriptSettings,
    loadActiveSheetMethod: loadActiveSheetMethod,
    saveActiveSheetMethod: saveActiveSheetMethod,
  };
})(window.App = window.App || {});
