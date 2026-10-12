# MonitorTester

螢幕測試圖樣產生器：單一 HTML、零依賴、可離線使用。

## 使用

下載 [`dist/MonitorTester.html`](dist/MonitorTester.html)，用瀏覽器開啟即可。

- **圖樣**：水平／垂直連續灰階、階梯灰階、外框與十字、純色、彩條、棋盤格、RGB 連續漸層
- **解析度**：常用預設、目前螢幕，或自訂（最大 7680×4320）
- **全螢幕 1:1**：以瀏覽器裝置像素 1:1 顯示（macOS 縮放顯示模式下需設為原生解析度才是實體像素 1:1）
- **下載**：
  - BMP 24-bit（8 bpc）
  - BMP 30-bit（10 bpc，32bpp BI_BITFIELDS，2-10-10-10）
  - PPM P3（ASCII，maxval 1023，每像素一行）

圖樣內部以 10-bit 產生；預覽與全螢幕受瀏覽器限制為 8-bit，10-bit 精度僅存在於下載檔。

## 開發

| 檔案 | 說明 |
|---|---|
| `core.js` | 圖樣產生與 BMP／PPM 編碼 |
| `index.html` | 操作介面（載入 `core.js`） |
| `test/core.test.js` | 單元測試 |
| `build.js` | 將 `core.js` 內嵌，輸出 `dist/MonitorTester.html` |

```bash
node --test      # 執行測試
node build.js    # 重新打包單一檔案
```

修改 `index.html` 或 `core.js` 後記得重新執行 `node build.js`。
