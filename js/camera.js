// Bọc các API camera của trình duyệt (getUserMedia) + quét QR bằng thư
// viện jsQR (nạp qua CDN trong index.html).
//
// LƯU Ý: getUserMedia chỉ hoạt động trong "secure context" — tức trang
// phải chạy qua https://, hoặc http://localhost lúc phát triển. Mở trực
// tiếp file index.html (file://) hoặc qua http:// thường (không phải
// localhost) sẽ KHÔNG xin được quyền camera — đây là giới hạn bảo mật của
// trình duyệt (đặc biệt Safari/iOS kiểm tra rất nghiêm), không phải lỗi
// của app.
(function (App) {
  'use strict';

  async function startStream(constraints) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'Trình duyệt không hỗ trợ truy cập Camera, hoặc trang đang mở không an toàn ' +
        '(cần chạy qua https:// hoặc http://localhost).',
      );
    }
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  function stopStream(stream) {
    if (!stream) return;
    stream.getTracks().forEach(function (track) { track.stop(); });
  }

  // Gắn stream vào <video>, chờ tới khi có kích thước khung hình thật.
  async function attachToVideo(videoEl, stream) {
    videoEl.srcObject = stream;
    await videoEl.play();
    if (!videoEl.videoWidth) {
      await new Promise(function (resolve) {
        videoEl.addEventListener('loadedmetadata', resolve, { once: true });
      });
    }
  }

  // Quét QR liên tục từ khung hình camera cho tới khi tìm thấy mã hoặc bị
  // dừng. Trả về 1 "controller" có hàm stop() để huỷ vòng lặp giữa chừng.
  function startQrScan(videoEl, onDetect, onError) {
    if (typeof jsQR === 'undefined') {
      onError && onError(new Error('Chưa tải được thư viện quét QR (jsQR). Kiểm tra kết nối mạng rồi thử lại.'));
      return { stop: function () {} };
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let stopped = false;
    let rafId = null;

    function tick() {
      if (stopped) return;
      if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let result = null;
        try {
          result = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
        } catch (e) {
          // Bỏ qua lỗi decode 1 khung hình lẻ, thử tiếp khung sau.
        }
        if (result && result.data) {
          stopped = true;
          onDetect(result.data);
          return;
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    return {
      stop: function () {
        stopped = true;
        if (rafId) cancelAnimationFrame(rafId);
      },
    };
  }

  // Chụp 1 khung hình hiện tại của video thành canvas (dùng cho GPLX: vừa
  // để hiển thị lại ảnh vừa chụp, vừa để đưa vào OCR).
  function captureFrameToCanvas(videoEl) {
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  App.Camera = {
    startStream: startStream,
    stopStream: stopStream,
    attachToVideo: attachToVideo,
    startQrScan: startQrScan,
    captureFrameToCanvas: captureFrameToCanvas,
  };
})(window.App = window.App || {});
