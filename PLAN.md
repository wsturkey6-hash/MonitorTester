# MonitorTester 執行計畫

## 目標
單頁工具：產生螢幕測試圖樣、自訂解析度、全螢幕以「瀏覽器裝置像素 1:1」顯示、下載 BMP（24/30-bit）或 PPM（P3, maxval 1023）。

## 已確認決策
- 零依賴、可離線、雙擊 `index.html`（file://）即可用。
- 核心邏輯在 `core.js`：**classic script**（非 ES module，因 file:// 下 module 會被 CORS 擋），
  結尾 `if (typeof module !== 'undefined') module.exports = MT;` 供 Node 測試；瀏覽器端為 `window.MT`。
- 內部像素緩衝：`Uint16Array(W*H*3)`，RGB 交錯、列由上而下，值 0..1023（10-bit 唯一真值）。
- 8-bit 轉換：`to8(v) = Math.round(v * 255 / 1023)`（預覽、全螢幕、BMP24 共用）。
- 解析度：整數 1..7680 × 1..4320；非整數或超出範圍 → UI 顯示錯誤、不產生（`renderPattern` 對非法 W/H 拋 RangeError）。
- 參數正規化（`MT.normalizeParams(id, params)`，`renderPattern` 內部必呼叫）：缺項補 default；int → `Math.round` 後夾到 [min,max]；color10 每通道 `Math.round` 後夾到 [0,1023]；非數值（NaN）→ default；bool → `!!v`。UI 使用同一函式並把正規化後的值回寫到輸入框。
- 編碼器假設輸入 buffer 已合法（0..1023 整數，由 renderPattern 保證）；測試覆蓋極值輸出不超過 1023。
- 介面繁體中文；下載檔名 `{patternId}_{W}x{H}.{bmp|ppm}`，BMP 30-bit 為 `{patternId}_{W}x{H}_30bit.bmp`。
- 預覽與全螢幕僅 8-bit，介面註明「10-bit 精度僅存在於下載檔」。
- 1:1 定義為「瀏覽器裝置像素」1:1。介面必須註明：macOS 縮放顯示模式下裝置像素 ≠ 面板實體像素，真正實體 1:1 需將 OS 設為原生（不縮放）解析度；「目前螢幕」為瀏覽器回報值。

## 檔案
| 檔案 | 內容 |
|---|---|
| `core.js` | 圖樣註冊表、編碼器、`to8`、`filename` |
| `index.html` | UI（內嵌 CSS/JS），`<script src="core.js">` |
| `test/core.test.js` | `node --test` 單元測試（node:test + node:assert，零依賴） |

## core.js API（`MT` 物件）
- `MAX_W=7680, MAX_H=4320`
- `PATTERNS`: `{ [id]: { label, params: ParamSpec[], render(buf, w, h, p) } }`，依下表順序。
  `ParamSpec = { key, label, type: 'int'|'color10'|'bool', min?, max?, default }`；`color10` 值為 `[r,g,b]` 各 0..1023。
- `createBuffer(w,h)`、`renderPattern(id, w, h, params)` → `Uint16Array`（params 缺項以 default 補）
- `to8(v)`
- `encodeBMP24(buf,w,h)` → `Uint8Array`
- `encodeBMP30(buf,w,h)` → `Uint8Array`
- `encodePPM3(buf,w,h)` → `string[]`（分段，每段至多約 1MB 字元，含整數列；串接即完整檔）
- `filename(id,w,h,ext)`

## 圖樣規格（x∈[0,W)、y∈[0,H)，`ramp(i,n) = n<=1 ? 0 : Math.round(i*1023/(n-1))`）
| id | 名稱 | 參數 | 定義 |
|---|---|---|---|
| `hgray` | 水平連續灰階 | – | R=G=B=`ramp(x,W)` |
| `vgray` | 垂直連續灰階 | – | R=G=B=`ramp(y,H)` |
| `steps` | 階梯灰階 | `n` int 2..1024 預設 16 | `k=floor(x*n/W)`；值 `ramp(k,n)` |
| `border` | 外框＋十字 | `width` int 1..256 預設 1；`fg` color10 預設 [1023,1023,1023]；`bg` 預設 [0,0,0]；`cross` bool 預設 true | 底色 bg；距任一邊 < width 的像素為 fg；cross 時，欄 `cx0=floor((W-width)/2)` 至 `cx0+width-1` 及列 `cy0=floor((H-width)/2)` 至 `cy0+width-1` 為 fg（夾在範圍內） |
| `solid` | 純色 | `color` color10 預設 [1023,1023,1023] | 全畫面該色（UI 提供 黑/白/R/G/B 快捷鍵） |
| `bars` | 彩條 | – | `i=floor(x*8/W)`，序列 白、黃、青、綠、洋紅、紅、藍、黑，通道值 0 或 1023 |
| `checker` | 棋盤格 | `size` int 1..1024 預設 64 | `(floor(x/size)+floor(y/size))%2==0` → 白 1023，否則黑 0（左上為白） |
| `rgbramp` | RGB 連續漸層 | – | `band=floor(y*3/H)`（0=R,1=G,2=B）；該通道=`ramp(x,W)`，其餘 0 |

## 編碼規格（全部 little-endian）
**BMP24**：FileHeader 14B（`'BM'`, fileSize, 0, 0, offset=54）＋ BITMAPINFOHEADER 40B
（size=40, W, H(正值=由下往上), planes=1, bpp=24, compression=0, imageSize=stride*H, 2835, 2835, 0, 0）。
`stride = ceil(W*3/4)*4`，像素 B,G,R（`to8`），補零到 stride；檔案第一列 = 影像最底列。

**BMP30**：FileHeader（offset=138）＋ BITMAPV5HEADER 124B：
size=124, W, H(正), planes=1, bpp=32, compression=3(BI_BITFIELDS), imageSize=W*4*H, 2835, 2835, 0, 0,
Rmask=0x3FF00000, Gmask=0x000FFC00, Bmask=0x000003FF, Amask=0, CSType=0x73524742('sRGB'),
endpoints 36B=0, gammaRGB=0×3, intent=4, profileData=0, profileSize=0, reserved=0。
像素 uint32 = `(R<<20)|(G<<10)|B`（無號，高 2 bits=0），由下往上。

**PPM P3**：`"P3\n# This PPM is created by MonitorTester\n{W} {H}\n1023\n"`，之後每個像素一行（由左而右、由上而下）：R、G、B 各自靠右對齊寬 5 字元、以單一空白分隔、行尾 `\n`，例 `   64    64    64`。

## UI（index.html）
- 左側控制面板：圖樣下拉 → 動態參數欄位（int: number input；color10: 3 個 0..1023 數字框＋8-bit `<input type=color>` 同步換算 `round(v8*1023/255)`；bool: checkbox）。
- 解析度：預設下拉（1920×1080、2560×1440、3440×1440、3840×2160、1280×720、目前螢幕 = `round(screen.width*dpr)×round(screen.height*dpr)`、自訂）＋寬/高輸入。
- 預覽：canvas 以實際 W×H 繪製（8-bit ImageData），CSS 等比縮放適應容器；放大時 `image-rendering: pixelated`。參數變更後自動重繪（debounce ~150ms）。
- 「全螢幕 1:1」：全螢幕黑底容器內 canvas，CSS 尺寸 = W/dpr × H/dpr，左上對齊，`image-rendering: pixelated`；Esc／點擊離開。
- 下載：格式下拉（BMP 24-bit 預設／BMP 30-bit／PPM P3 10-bit）＋按鈕；用 Blob + `<a download>`；PPM 以 `new Blob(chunks)`。產生期間按鈕停用並顯示「產生中…」。
- 註明 8-bit 預覽限制、P3 大檔警示（4K 約 150MB）。

## Slices
**S1 core.js + 測試**（owner: pilotfish:executor）
驗收：`node --test`（於專案目錄）全綠，至少涵蓋：
- 每個圖樣在 W=1/H=1 與一般尺寸不崩潰，且值皆在 0..1023
- hgray 頭尾 0/1023、W=1920 時 x=959 的值；steps n=4 各段值；border 外圈與十字位置（奇偶寬）；checker 左上白；bars 8 段顏色；rgbramp 三帶
- BMP24：W=1,2,3,4,5 的 stride/檔案大小、header 每個欄位、底列先存、BGR 順序
- BMP30：header 124B 各欄位與 masks、像素打包（例 R=1023,G=0,B=1 → 0x3FF00001）
- PPM3：header（含註解行）、行數=W×H、每行一像素且格式逐字正確、內容可 parse 回原 buffer；分段串接正確
- `to8` 0→0, 1023→255, 512→128
- 參數正規化：color [2000,-5,1023.7] → [1023,0,1023]；steps n=0→2、n=5000→1024；checker size=0→1；border width=0→1、2.6→3；NaN→default；渲染後 buffer 所有值為 0..1023 整數；renderPattern 對 W=0、W=7681、W=1.5 拋 RangeError
- 以正規化後極值色產生的 BMP30/PPM 中無任何樣本 >1023

前置：無。預算：每個失敗的驗收項最多 3 次修正迭代。
停止條件（停止並回報主控，不自行改規格）：規格有歧義或自相矛盾；預算用盡；Node 無法以 CommonJS 載入 core.js。

**S2 index.html**（owner: 同一 executor，接續 S1）
驗收：以瀏覽器開啟 file:// 無 console 錯誤；切換每個圖樣與參數會重繪；非法解析度顯示錯誤；三種格式皆能下載且檔名正確。
全螢幕 1:1：進入後全螢幕 canvas `width===W && height===H`；`getBoundingClientRect()` 寬×`devicePixelRatio` ≈ W（高同理，誤差 ≤1px），left/top = 0；computed `image-rendering` 為 `pixelated`；Esc 與點擊皆可離開並移除/隱藏該 canvas。
為方便驗證，全螢幕 canvas 設 `id="fs-canvas"`，進入按鈕 `id="btn-fullscreen"`。
index.html 內含上述 OS 縮放（實體 1:1）註記文字與 8-bit 註記文字。
參數欄位輸入非法值後，欄位顯示正規化後的值。

前置：S1 全綠。預算：每個失敗的驗收項最多 3 次修正迭代。
停止條件（停止並回報主控）：預算用盡；分數 dpr 下全螢幕幾何無法達 ≤1px；`requestFullscreen` 或 Blob 下載在 file:// 失敗；7680×4320 產生/編碼在瀏覽器中記憶體不足或當掉；任何規格歧義。

**非目標**：P6、16-bit、HDR/WebGPU 10-bit 顯示、伽瑪/抖動、建置工具、git。

**完成後**：pilotfish:verifier 獨立驗證（跑測試、用 Python 從頭解析三種下載檔比對像素、瀏覽器實測）。
回滾：專案全新，刪除檔案即可。

## 打包（單檔分享）
`node build.js` → 把 `core.js` 內嵌進 `index.html`，輸出 `dist/MonitorTester.html`。只要給別人這一個檔案即可；改過 `index.html` 或 `core.js` 後需重新執行。
