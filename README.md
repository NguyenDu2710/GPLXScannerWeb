# CCCD/GPLX Scanner — bản Web

Phiên bản **web thuần HTML/CSS/JS** (không framework, không bước build) của
app quét CCCD/GPLX, thay cho bản Flutter vì Flutter cần máy Mac mới build
được cho iOS. Bản web này chạy được trên **mọi trình duyệt hiện đại, kể cả
Safari trên iPhone/iPad**, chỉ cần mở 1 đường link.

Toàn bộ tính năng giữ nguyên như bản Flutter: quét QR CCCD, tự chuyển đổi
địa chỉ theo ĐVHC mới, chụp ảnh + OCR GPLX (nối "|" nếu 2 bằng lái), nhập
thông tin khóa học, lưu danh sách, xuất Excel/TXT, gửi lên Google Sheet.

## Gửi dữ liệu lên Google Sheet

App hỗ trợ 2 cách kết nối tới Google Sheet, chọn 1 trong màn "Kết nối
Google Sheet" (icon ☁️ trên màn chính):

- **Google Apps Script (khuyến nghị)**: dán 1 đoạn code có sẵn
  ([apps-script/Code.gs](apps-script/Code.gs), có thể copy trực tiếp ngay
  trong màn cấu hình của app) vào **chính Google Sheet muốn ghi vào**
  (Extensions > Apps Script), Deploy thành Web App 1 lần, dán URL vào app.
  Ghi thẳng vào đúng Sheet/tab bạn chỉ định, không cần tạo Form riêng,
  không cần khớp tên cột thủ công.
- **Google Form**: không muốn đụng tới Apps Script thì tạo 1 Google Form
  liên kết Sheet, xem hướng dẫn chi tiết ngay trong app.

## ⚠️ Yêu cầu bắt buộc: phải chạy qua HTTPS (hoặc localhost)

Trình duyệt (đặc biệt Safari/iOS) **chỉ cấp quyền Camera cho trang chạy
qua `https://` hoặc `http://localhost`**. Mở thẳng file `index.html` bằng
cách bấm đúp (địa chỉ `file://...`) hoặc host qua `http://` thường (không
phải localhost) sẽ **KHÔNG xin được quyền camera** — đây là quy định bảo
mật của trình duyệt, không phải lỗi của app.

→ Xem mục "Triển khai" bên dưới để đưa app lên một địa chỉ https:// miễn phí.

## Chạy thử trên máy tính (localhost)

Cần có Node.js (không cần cài thêm gói nào khác):

```bash
node serve.js
```

Mở `http://localhost:8080` trên trình duyệt máy tính (camera sẽ dùng
webcam máy tính). Để thử trên điện thoại qua mạng LAN, xem mục "Thử trên
điện thoại trong lúc phát triển" bên dưới.

## Triển khai lên Internet (để dùng thật trên điện thoại)

Chọn 1 trong các cách sau, đều **miễn phí** và cho ra 1 link `https://`:

- **GitHub Pages**: đẩy toàn bộ thư mục này lên 1 repo GitHub, vào
  Settings > Pages > bật cho branch chính. Có link dạng
  `https://<username>.github.io/<repo>/`.
- **Netlify / Vercel / Firebase Hosting**: kéo-thả cả thư mục vào trang
  deploy của các dịch vụ này (không cần tài khoản GitHub).
- **Server riêng có SSL**: copy cả thư mục vào server, phục vụ qua Nginx/
  Apache có chứng chỉ HTTPS (Let's Encrypt miễn phí).

Sau khi có link https://, mở bằng Safari (iPhone) hoặc Chrome (Android),
có thể **"Thêm vào Màn hình chính"** để dùng như 1 app thật (icon riêng,
mở toàn màn hình).

### Thử trên điện thoại trong lúc phát triển

`http://localhost` chỉ tính là "an toàn" trên chính máy tính đang chạy
server — điện thoại truy cập qua IP LAN (`http://192.168.x.x:8080`) vẫn bị
chặn camera vì không phải https. Cách thử nhanh không cần deploy thật:
dùng `ngrok` (`ngrok http 8080`) hoặc Cloudflare Tunnel (`cloudflared
tunnel --url http://localhost:8080`) để có 1 link https tạm thời trỏ vào
server đang chạy trên máy.

## Cấu trúc mã nguồn

```
index.html          Trang duy nhất, nạp toàn bộ script + CDN
serve.js             Server tĩnh nhỏ để chạy thử (node serve.js)
css/style.css         Toàn bộ giao diện
data/dvhc.json        Danh mục chuyển đổi địa chỉ ĐVHC cũ -> mới
js/
  vietnamese-text-utils.js   Bỏ dấu tiếng Việt (dùng chung)
  person.js                  Model "1 người" + cột dữ liệu + gộp "|"
  cccd-parser.js              Parse chuỗi QR CCCD
  gplx-parser.js               Trích xuất trường GPLX từ text OCR
  dvhc-converter.js            Chuyển đổi địa chỉ ĐVHC cũ -> mới
  storage.js                    Lưu/đọc localStorage (session, danh sách, cấu hình Sheet)
  google-form.js                 Gửi dữ liệu lên Google Sheet qua Google Form
  apps-script-sheet.js            Gửi dữ liệu thẳng vào Sheet qua Apps Script Web App
  export.js                        Xuất Excel (.xlsx)/TXT
  camera.js                         Bọc getUserMedia + quét QR bằng jsQR
  toast.js                           Thông báo nổi ngắn (SnackBar)
  app.js                              Bộ điều khiển chính + toàn bộ màn hình
apps-script/Code.gs      Code Apps Script dán vào Google Sheet (xem hướng dẫn trong app)
test/node-smoke-test.js  Test nhanh logic thuần bằng Node (không cần trình duyệt)
```

## Chạy test logic (không cần trình duyệt)

```bash
node test/node-smoke-test.js
```

Kiểm tra CccdParser, GplxParser, Person (gộp "|"), và DvhcConverter (đối
chiếu đúng ví dụ mẫu trong tài liệu bàn giao DVHC).

## Thư viện ngoài (nạp qua CDN, không cần cài/build)

- [jsQR](https://github.com/cozmo/jsQR) — quét mã QR từ khung hình camera.
- [Tesseract.js](https://github.com/naptha/tesseract.js) — OCR đọc chữ
  trên ảnh GPLX (ngôn ngữ `vie`). **Lần OCR đầu tiên sẽ chậm hơn** vì trình
  duyệt phải tải dữ liệu ngôn ngữ (~vài MB, được cache lại cho các lần
  sau).
- [SheetJS (xlsx)](https://github.com/SheetJS/sheetjs) — xuất file Excel.

## Giới hạn cần biết (khác với bản app di động)

- **Gửi Google Sheet không xác nhận được chắc chắn** (cả 2 cách Apps
  Script lẫn Form): trình duyệt web không được phép đọc phản hồi từ tên
  miền Google (chính sách CORS), nên phải gửi qua `<form>` ẩn thay vì gọi
  API trực tiếp như bản app — và vì vậy **không biết chắc Google đã ghi
  nhận hay chưa**, chỉ biết "đã gửi yêu cầu". Sau khi gửi, thỉnh thoảng nên
  mở Google Sheet lên kiểm tra lại.
- **Không có đèn flash/torch**: API bật đèn flash qua trình duyệt không ổn
  định trên nhiều điện thoại nên bản web này không có nút bật đèn (bản
  Flutter có).
- **Dữ liệu chỉ lưu trên trình duyệt đang mở** (`localStorage`): xóa dữ
  liệu duyệt web (Clear browsing data) hoặc dùng chế độ ẩn danh sẽ mất
  toàn bộ danh sách chưa xuất/gửi — nên xuất Excel hoặc gửi Sheet thường
  xuyên, đừng để dữ liệu tồn đọng quá lâu chỉ trong trình duyệt.
"# GPLXScannerWeb" 
