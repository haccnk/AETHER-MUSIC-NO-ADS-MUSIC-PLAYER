# Aether Music

**Aether Music** là ứng dụng nghe nhạc máy tính không quảng cáo cho Windows (giao diện **Liquid Glass**), hỗ trợ phát nhạc trực tuyến độ trễ thấp, xem MV HD, lời bài hát đồng bộ dạng **Dynamic Island**, bộ chỉnh âm **Equalizer 10 dải** và tải trọn bộ Album/Playlist về máy ở chuẩn **MP3 320kbps** kèm ảnh bìa & file lời `.lrc`.

---

## Tải về & Sử dụng (Bản Portable Windows)

Không cần cài đặt, không cần Node.js hay môi trường lập trình:

1. Tải file `.zip` mới nhất tại mục **Releases** bên cột phải của repository.
2. **Giải nén toàn bộ** file `.zip` ra một thư mục (ví dụ `D:\Apps\Aether Music\`).
   > ⚠️ **Lưu ý:** Giữ nguyên toàn bộ các file `.dll`, `locales/` và `resources/` nằm cùng thư mục với `Aether Music.exe` — không chép riêng file `.exe` ra ngoài.
3. Mở **`Aether Music.exe`** bên trong thư mục vừa giải nén để sử dụng ngay.
   - *(Nếu Windows Defender SmartScreen hiện cảnh báo lần đầu vì app chưa ký chứng chỉ số, bấm **More info** → **Run anyway** để chạy).*

---

## Tính năng nổi bật

- **Khám phá thời gian thực (YouTube Music):**
  - **Nổi bật hôm nay:** Tự động hiển thị bài hát đang tăng hạng / thịnh hành #1 tại Việt Nam.
  - **Thịnh hành tại Việt Nam & Thịnh hành Quốc tế:** Bảng xếp hạng hàng ngày, Top 100 và các playlist hot cập nhật liên tục.
  - **Bài hát Thịnh hành:** Phát ngay lập tức hoặc mở chi tiết để nghe/tải trọn danh sách.
- **Nhập Album/Playlist từ Spotify & YouTube:**
  - Dán trực tiếp link **Spotify** (Album, Playlist, Track) hoặc **YouTube / YouTube Music / SoundCloud** vào thanh tìm kiếm hoặc mục **Nhập Spotify / URL** để nghe ngay hoặc tải hàng loạt.
- **Tải nhạc Offline chuẩn MP3 320kbps:**
  - Tự động nhúng ảnh bìa Album HD, thẻ ID3 và lưu file lời đồng bộ `.lrc` (từ LRCLIB).
- **Trình phát âm thanh & Equalizer 10 dải:**
  - Bộ chỉnh âm **10 dải tần** (`32Hz` – `16kHz`) kèm các preset (*Flat, Bass Boost, Vocal, Acoustic, Electronic, Hi-Fi, Late Night, Custom*).
  - **Crossfade** chuyển bài mượt (`0–12` giây), hẹn giờ tắt nhạc (*Sleep Timer*) và hàng đợi phát kéo thả đổi thứ tự.
- **Lời bài hát & Dynamic Island:**
  - **Dynamic Island (Lời nổi Desktop):** Cửa sổ nổi trong suốt dạng đảo ở cạnh trên màn hình với đĩa than xoay, sóng âm hướng tâm và chế độ **Khóa xuyên chuột**.
  - **Immersive Lyrics:** Giao diện lời toàn màn hình, hỗ trợ tinh chỉnh độ trễ lời (`±0.1s` hoặc khớp ngay câu đang hát).
- **Xem MV HD chính thức & Thư viện Offline:**
  - Tự tìm MV chính thức để phát ngay trong app; hỗ trợ quét thư mục nhạc có sẵn trên máy (`.mp3`, `.flac`, `.wav`, `.m4a`, `.ogg`, `.opus`, `.aac`).
- **Song ngữ:** Chuyển đổi tức thì giữa **Tiếng Việt** và **English** trong Cài đặt.

---

## Phím tắt

| Phím tắt | Chức năng |
| --- | --- |
| `Ctrl + K` | Focus nhanh vào thanh tìm kiếm |
| `Space` | Phát / Tạm dừng (khi không nhập văn bản) |
| Phím Media bàn phím | Phát / Tạm dừng, Bài tiếp theo, Bài trước |

---

## Lưu ý khi tải hàng loạt & Lưu dữ liệu

- **Vị trí lưu dữ liệu cá nhân:** Toàn bộ playlist, bài hát đã thích, cài đặt và phiên đăng nhập được lưu tại `%APPDATA%\aether-music\aether-library.json`. Khi cập nhật lên bản Portable mới, dữ liệu của bạn vẫn được giữ nguyên.
- **Nếu gặp lỗi `Sign in to confirm you're not a bot` khi tải nhiều bài:**
  1. Vào **Cài đặt → Tài khoản kết nối (YouTube & Spotify)** để kết nối tài khoản YouTube (khuyên dùng nút **Chọn file `cookies.txt`** xuất từ tiện ích *Get cookies.txt LOCALLY*, hoặc dùng **Firefox** để tránh việc Chrome/Edge trên Windows khóa file cookie khi đang mở).
  2. Giảm **Số luồng tải song song** trong Cài đặt xuống **`1`** khi tải playlist dài.
- **Playlist Spotify riêng tư:** Kết nối thêm tài khoản **Spotify** trong **Cài đặt** để đọc được các playlist cá nhân/riêng tư.

---

## Dành cho Developer (Tự build từ mã nguồn)

<details>
<summary>Xem hướng dẫn cài đặt & đóng gói từ source code</summary>

### Công nghệ sử dụng
- Electron `^35.0.2`, React `^19.0.0`, TypeScript `^5.8.2`, Vite `^6.2.1`, Tailwind CSS `^3.4.17`
- Zustand `^5.0.3`, Framer Motion `^12.4.10`, Web Audio API, `yt-dlp`, `ffmpeg-static`, `music-metadata`, `node-id3`

### Chạy phát triển & Build
```bash
# Cài đặt dependencies
npm install

# Chạy chế độ phát triển (Vite + Electron)
npm run dev

# Kiểm tra TypeScript
npm run typecheck

# Build production (dist/ và dist-electron/)
npm run build

# Đóng gói bản Portable Windows vào release/Aether Music/
npm run dist:win
```

> Lưu ý: `npm run dist:win` sử dụng trình biên dịch .NET tại `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` để tạo launcher `Aether Music.exe` từ `scripts/AetherLauncher.cs`. Bản Portable hoàn chỉnh nằm tại `release/Aether Music/`.

</details>
