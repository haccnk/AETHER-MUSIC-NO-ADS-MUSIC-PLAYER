# Aether Music

**Aether Music** là ứng dụng nghe nhạc máy tính không quảng cáo giao diện **Liquid Glass** xây dựng bằng **Electron + React + TypeScript**, hỗ trợ phát nhạc trực tuyến độ trễ thấp, xem MV HD, lời bài hát đồng bộ dạng **Dynamic Island**, bộ chỉnh âm **Equalizer 10 dải** và tải trọn bộ Album/Playlist về máy ở chuẩn **MP3 320kbps** kèm ảnh bìa & file lời `.lrc`.

---

## Tính năng chính

- **Khám phá theo thời gian thực (YouTube Music):**
  - **Nổi bật hôm nay:** Tự động lấy bài hát đang tăng hạng/thịnh hành #1 tại Việt Nam kèm Art Track và ảnh bìa chất lượng cao.
  - **Thịnh hành tại Việt Nam & Thịnh hành Quốc tế:** Bảng xếp hạng hàng ngày/Top 100 từ YouTube Music, các playlist nổi bật và đĩa đơn mới thịnh hành.
  - **Bài hát Thịnh hành:** Danh sách các ca khúc hot trong ngày, bấm phát ngay hoặc mở chi tiết album/playlist.
- **Tìm kiếm & Nhập hàng loạt (Spotify / URL):**
  - Tìm kiếm trên kho Album/Catalog HD và YouTube Music.
  - Dán trực tiếp đường dẫn **Spotify** (Album, Playlist, Track) hoặc **YouTube / YouTube Music / SoundCloud** để nghe ngay hoặc chọn tải hàng loạt.
- **Tải nhạc Offline 320kbps:**
  - Tách luồng âm thanh chất lượng cao qua `yt-dlp` + `ffmpeg`, chuyển đổi MP3 320kbps.
  - Tự động nhúng ID3 tags, ảnh bìa Album (`node-id3`) và lưu kèm file lời `.lrc` khớp thời lượng từ LRCLIB.
  - Tuỳ chỉnh số luồng tải song song và thư mục lưu trữ trong Cài đặt.
- **Trình phát âm thanh & Equalizer:**
  - **Equalizer 10 dải tần** (`32Hz` – `16kHz`) với biểu đồ đáp tuyến và các preset sẵn có (*Flat, Bass Boost, Vocal, Acoustic, Electronic, Hi-Fi, Late Night, Custom*).
  - **Crossfade** chuyển bài mượt mà (`0–12` giây), hẹn giờ tắt nhạc (*Sleep Timer*), hàng đợi phát kéo thả đổi thứ tự.
- **Lời bài hát & Dynamic Island:**
  - **Panel phải:** Xem lời đồng bộ và hàng đợi phát song song ngay cạnh nội dung chính.
  - **Immersive Lyrics:** Giao diện lời bài hát toàn màn hình với hiệu ứng spring-scroll, tìm câu hát và tinh chỉnh độ trễ lời (`±0.1s` / khớp ngay tại vị trí đang phát).
  - **Dynamic Island (Lời nổi Desktop):** Cửa sổ nổi trong suốt ở cạnh trên màn hình, hỗ trợ thu gọn/mở rộng kèm đĩa than xoay, sóng âm hướng tâm và chế độ **Khóa xuyên chuột**.
- **Xem MV chính thức:** Tự động nhận diện và phát MV HD chính thức ngay trong ứng dụng.
- **Thư viện Offline & Playlist:** Quét thư mục nhạc có sẵn trên máy (`.mp3`, `.flac`, `.wav`, `.m4a`, `.ogg`, `.opus`, `.aac`), quản lý *Bài hát đã thích* và playlist cá nhân.
- **Xác thực YouTube & Spotify:**
  - Hỗ trợ kết nối tài khoản Spotify trong ứng dụng để đọc playlist cá nhân/riêng tư.
  - Hỗ trợ kết nối YouTube qua trình duyệt hệ thống (`--cookies-from-browser`) hoặc nạp trực tiếp file `cookies.txt` (khuyên dùng trên Windows nếu Chrome/Edge đang mở khóa file cookie) để hạn chế lỗi `Sign in to confirm you're not a bot` khi tải hàng loạt.
- **Song ngữ:** Chuyển đổi tức thì giữa **Tiếng Việt** và **English**.

---

## Phím tắt

| Phím tắt | Chức năng |
| --- | --- |
| `Ctrl + K` | Focus nhanh vào thanh tìm kiếm |
| `Space` | Phát / Tạm dừng (khi không nhập văn bản) |
| Phím Media bàn phím | Phát/Tạm dừng, Bài tiếp theo, Bài trước |

---

## Công nghệ sử dụng

- **Desktop & Backend:** Electron (`^35.0.2`), Node.js, `esbuild`, `yt-dlp`, `ffmpeg-static`
- **Frontend:** React (`^19.0.0`), TypeScript (`^5.8.2`), Vite (`^6.2.1`), Tailwind CSS (`^3.4.17`)
- **State & Motion:** Zustand (`^5.0.3`), Framer Motion (`^12.4.10`), Phosphor Icons (`@phosphor-icons/react`)
- **Audio & Metadata:** Web Audio API (EQ 10 dải + Visualizer), `music-metadata`, `node-id3`

---

## Cấu trúc thư mục

```text
musicplayer/
├── electron/
│   ├── main.ts                 # Tiến trình chính Electron, cửa sổ & IPC handlers
│   ├── preload.ts              # ContextBridge API cho renderer
│   └── services/
│       ├── authService.ts      # Xác thực YouTube (trình duyệt / cookies.txt) & Spotify
│       ├── binaryManager.ts    # Quản lý yt-dlp.exe & ffmpeg.exe
│       ├── catalogService.ts   # Khám phá YouTube Music, tìm kiếm & phân tích URL
│       ├── downloadManager.ts  # Hàng đợi tải MP3 320kbps + nhúng tag & .lrc
│       ├── libraryScanner.ts   # Quét thư viện nhạc offline trên ổ cứng
│       ├── lyricsService.ts    # Đọc .lrc nội bộ & tra cứu LRCLIB
│       ├── mediaServer.ts      # HTTP proxy cục bộ cho stream & ảnh bìa nội bộ
│       ├── mvService.ts        # Tìm và phát MV chính thức
│       ├── spotifyService.ts   # Phân tích link Album/Playlist/Track Spotify
│       └── store.ts            # Lưu cài đặt, playlist & lịch sử nghe (%APPDATA%)
├── src/
│   ├── audio/                  # AudioEngine (Crossfade, EQ, Analyzer)
│   ├── components/             # UI layout, Dynamic Island, Immersive Lyrics, MV Modal
│   ├── i18n/                   # Từ điển giao diện Tiếng Việt / English
│   ├── store/                  # Zustand store (usePlayerStore)
│   └── views/                  # Discover, Search, Album, BatchURL, Library, Downloads, Settings
├── scripts/
│   ├── package-win.mjs         # Đóng gói bản Portable Windows vào release/Aether Music/
│   └── AetherLauncher.cs       # Mã nguồn launcher Aether Music.exe (Win32 Job Object)
└── resources/                  # Biểu tượng app (icon.ico) & binary nhúng
```

---

## Cài đặt & Chạy phát triển

### Yêu cầu
- **Node.js** (khuyên dùng v20 trở lên)
- **npm**
- Kết nối Internet (ứng dụng sẽ dùng `resources/bin/yt-dlp.exe` hoặc tự tải `yt-dlp.exe` vào `%APPDATA%\aether-music\bin\` nếu chưa có)

### Các lệnh chính

```bash
# Cài đặt dependencies
npm install

# Chạy chế độ phát triển (Vite + Electron hot-reload)
npm run dev

# Kiểm tra kiểu TypeScript
npm run typecheck

# Build production (dist/ và dist-electron/)
npm run build

# Build và chạy thử bản production
npm start
```

### Đóng gói bản Portable cho Windows

```bash
npm run dist:win
```

> Lưu ý: Script [scripts/package-win.mjs](scripts/package-win.mjs) yêu cầu trình biên dịch .NET Framework tại `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` để tạo launcher `Aether Music.exe` ở thư mục gốc. Bản chạy đầy đủ nằm tại `release/Aether Music/Aether Music.exe`.

---

## Lưu ý lưu trữ dữ liệu & Xác thực YouTube trên Windows

- **Vị trí lưu dữ liệu người dùng:** Thư viện, playlist, cài đặt và phiên đăng nhập được lưu riêng tại `%APPDATA%\aether-music\aether-library.json` (tách biệt khỏi thư mục mã nguồn và `release/` nên không bị mất khi cập nhật app).
- **Xác thực YouTube với Chrome/Edge trên Windows:** Khi Chrome hoặc Edge đang mở, Windows có thể khóa/mã hóa file cookie (App-Bound Encryption). Nếu gặp cảnh báo khóa cookie khi kiểm tra kết nối, app sẽ tự động fallback để không làm gián đoạn việc nghe nhạc; để tải hàng loạt playlist ổn định nhất mà không cần tắt Chrome, hãy dùng nút **Chọn file `cookies.txt`** (xuất bằng tiện ích *Get cookies.txt LOCALLY*) hoặc dùng **Firefox** trong mục **Cài đặt**.
