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

  // BarcodeDetector là API quét mã vạch/QR có sẵn của trình duyệt, chạy
  // bằng engine nhận diện của hệ điều hành (VD ML Kit trên Chrome Android) -
  // đọc được QR nhỏ/mờ/xa tốt hơn hẳn so với jsQR (thư viện JS thuần, tự
  // decode từng pixel). Hiện chỉ Chrome/Edge (desktop + Android) hỗ trợ,
  // Safari/Firefox chưa có -> luôn cần jsQR làm phương án dự phòng.
  function createNativeDetector() {
    if (typeof BarcodeDetector === 'undefined') return null;
    try {
      return new BarcodeDetector({ formats: ['qr_code'] });
    } catch (e) {
      return null;
    }
  }

  // Quét QR liên tục từ khung hình camera cho tới khi tìm thấy mã hoặc bị
  // dừng. Trả về 1 "controller" có hàm stop() để huỷ vòng lặp giữa chừng.
  function startQrScan(videoEl, onDetect, onError) {
    let detector = createNativeDetector();
    if (!detector && typeof jsQR === 'undefined') {
      onError && onError(new Error('Chưa tải được thư viện quét QR (jsQR). Kiểm tra kết nối mạng rồi thử lại.'));
      return { stop: function () {} };
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let stopped = false;
    let rafId = null;
    let nativeBusy = false;

    function scanWithJsQr() {
      if (typeof jsQR === 'undefined') return null;
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      try {
        const result = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        return result && result.data ? result.data : null;
      } catch (e) {
        // Bỏ qua lỗi decode 1 khung hình lẻ, thử tiếp khung sau.
        return null;
      }
    }

    function tick() {
      if (stopped) return;
      if (videoEl.readyState !== videoEl.HAVE_ENOUGH_DATA) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      if (detector) {
        if (nativeBusy) {
          rafId = requestAnimationFrame(tick);
          return;
        }
        nativeBusy = true;
        detector.detect(videoEl)
          .then(function (codes) {
            nativeBusy = false;
            if (stopped) return;
            const value = codes && codes[0] && codes[0].rawValue;
            if (value) {
              stopped = true;
              onDetect(value);
              return;
            }
            rafId = requestAnimationFrame(tick);
          })
          .catch(function () {
            // Trình duyệt khai báo có BarcodeDetector nhưng không thực sự
            // hỗ trợ 'qr_code' (hoặc lỗi khác) -> chuyển hẳn sang jsQR.
            nativeBusy = false;
            detector = null;
            if (!stopped) rafId = requestAnimationFrame(tick);
          });
        return;
      }

      const text = scanWithJsQr();
      if (text) {
        stopped = true;
        onDetect(text);
        return;
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

  // Lấy khoảng zoom camera hỗ trợ (nếu có) để hiển thị thanh trượt zoom -
  // giúp phóng to vùng chứa QR nhỏ (VD mã QR mặt trước CCCD gắn chip) mà
  // không cần đưa điện thoại sát tới mức camera không lấy nét được. Chỉ
  // một số trình duyệt/thiết bị hỗ trợ (chủ yếu Chrome Android).
  function getZoomRange(track) {
    if (!track || typeof track.getCapabilities !== 'function') return null;
    let caps;
    try {
      caps = track.getCapabilities();
    } catch (e) {
      return null;
    }
    if (!caps || !caps.zoom) return null;
    return { min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 };
  }

  function setZoom(track, value) {
    if (!track || typeof track.applyConstraints !== 'function') return Promise.resolve();
    return track.applyConstraints({ advanced: [{ zoom: value }] }).catch(function () {});
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
    getZoomRange: getZoomRange,
    setZoom: setZoom,
    captureFrameToCanvas: captureFrameToCanvas,
  };
})(window.App = window.App || {});
