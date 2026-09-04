// Thông báo nổi ngắn ở đáy màn hình (tương đương SnackBar), có thể kèm 1
// nút hành động (ví dụ "Hoàn tác").
(function (App) {
  'use strict';

  let container = null;

  function ensureContainer() {
    if (container) return container;
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
    return container;
  }

  function showToast(message, options) {
    options = options || {};
    const el = document.createElement('div');
    el.className = 'toast';

    const text = document.createElement('span');
    text.textContent = message;
    el.appendChild(text);

    if (options.actionLabel && options.onAction) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-action';
      btn.textContent = options.actionLabel;
      btn.addEventListener('click', function () {
        options.onAction();
        remove();
      });
      el.appendChild(btn);
    }

    ensureContainer().appendChild(el);
    // Kích hoạt animation (thêm class sau khi đã chèn vào DOM).
    requestAnimationFrame(function () { el.classList.add('show'); });

    let removed = false;
    function remove() {
      if (removed) return;
      removed = true;
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 250);
    }

    setTimeout(remove, options.duration || 4000);
  }

  App.showToast = showToast;
})(window.App = window.App || {});
