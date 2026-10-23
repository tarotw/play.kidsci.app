# 宇宙好好聽 · universe.kidsci.app

科學好好聽的「萬物宇宙」互動地圖：轉動萬物旋鈕，從一顆原子、一隻動物、整個地球，一路調到 930 億光年的宇宙邊界；再搭時光機回到恐龍與牛頓的年代。每一站都能聽 Podcast、打開 [lab.kidsci.app](https://lab.kidsci.app/) 的實驗，收集星章。

提案文件：宇宙好好聽：互動網頁提案（Claude 文件）。

## 目前進度：P0

- `index.html` + `app.js` + `style.css` + `explorer.js`：萬物旋鈕預覽版。每一格是一個可以拖曳、縮放的探索場景（Canvas 2D，不載入外部圖檔），每一集是一顆發光的頻道，點了耳機號就飛過去；轉旋鈕換格時有曲速穿越效果與調頻音效。右上角 ☰ 切換清單模式（給鍵盤、螢幕閱讀器與檢查分類用）。
- `explorer3d.js`：3D 探索畫面（Three.js r170，跟 lab.kidsci.app/solar-system 同一套技術，放在 `vendor/three/`，不連外部 CDN）。每格有自己的 3D 主視覺：原子與電子軌道、半透明細胞、浮空生物島與海、霓虹城市、剖開的地球、地球與月球、會流動的太陽、星團、旋臂銀河、宇宙網；時光機是一條發光的時間河，法則航道是七條光管。加上泛光（bloom）、閃爍星空、曲速穿越、耳機號 3D 模型與尾焰。滑鼠左鍵／單指拖曳移動，右鍵／雙指旋轉，滾輪／雙指縮放。裝置不支援 WebGL 時自動改用 2D 版（`explorer.js`）；網址加 `?gl=0` 可以強制看 2D 版。
- 科學隊長（女孩，解說）與好奇博士（男孩，發問）當導航員：第一次來有開場導覽、每進一格有一問一答、頻道卡上有兩人對話、拿到星章會說話、發呆 25 秒會建議下一台並可「帶我去」。右上角隊長頭像打開選單：大小猜猜看、現在的任務、帶我去一台、先不要說話。台詞都在 `data/dialogue.json`，可以直接改；🔈 用瀏覽器內建語音念出來。
- 每一格有任務（拜訪 3 台、找到金色頻道、聽完一集），完成拿 🏅 任務勳章。頭像是從 `assets/logo-square.jpg` 裁出來的 `assets/avatar-*.png`。
- 10 格全部打開，方便檢查每一集放的位置；正式版把 `app.js` 的 `PREVIEW` 改成 `false`，只開 `data/world.json` 的 `mvp_levels`（生物、地球、太陽系）。
- 每一格裡的「區」（海洋、雨林、火山…）由 `data/world.json` 的區域關鍵字自動分，`build_catalog.py` 寫進每一集的 `zone`；分錯的話改關鍵字或在 `placements.json` 加 `zone`。
- 公開集數在頁面裡直接播放，重點句跟著播放時間亮起；訂閱者限定（`c`、`s` 開頭）連到 Firstory，按鈕要按住 2 秒（請大人幫忙）。
- 實驗以 iframe 全螢幕打開，開 60 秒或收到 `kidsci-bridge.js` 的通知就蓋小手章；聽到 80% 蓋耳朵章。星章存在瀏覽器（localStorage）。

## 資料

| 檔案 | 內容 | 誰維護 |
| --- | --- | --- |
| `data/world.json` | 10 格、7 條法則航道、6 個年代 | 手動 |
| `data/source_titles.tsv` | Drive `listensci` 每個集數資料夾的代碼與主題（2026-10-02 盤點） | 手動／新集數時補 |
| `data/placements.json` | 每一集的主位置與次位置 | 手動；`tools/make_placements.py` 是第一版的來源 |
| `data/tag_rules.json` | 沒有手動位置的新集數，依標題或 tags 自動歸位的規則 | 手動 |
| `data/feed_overrides.json` | 標題沒有代碼的單集要對到哪個 Drive 代碼 | 手動 |
| `data/labs.json` | lab 的 144 個實驗與對應集數 | 由 lab 的 `catalog/data.js` 與 136 項計劃產生 |
| `data/status.json`、`STATUS.md` | 上架狀態與需要確認的清單 | `tools/status_check.py`（每天自動） |
| `data/catalog.json` | 網站讀的總目錄 | `tools/build_catalog.py`（每天自動） |
| `data/episodes/<代碼>.json` | 重點句、知識卡、測驗、好奇問題 | `tools/build_episodes.py`（在你的電腦執行） |

位置代碼：`l01`–`l10` 是旋鈕的格，`lane:<id>` 是法則航道，`era:<id>` 是時光機年代，`studio` 是錄音室，`skip` 不上地圖。

## 規則

- 公開與訂閱：Drive 代碼 `c`、`s` 開頭是訂閱者限定，其餘公開。`s` 以 `SP.編號` 發布、`c` 以 `VIP.編號` 發布。
- 上架狀態：`STATUS.md` 列出代碼與 feed 標題不一致的單集（例如 `s37` 標題寫「公開｜」），以及 Apple／Spotify 找不到的單集。
- 勘誤：`suspect.md` 有未處理 ❌ 的集數，`build_episodes.py` 不輸出；處理完把代碼加進 `data/factcheck_ok.json`。
- 測驗：只用第 1–2 級題目，而且只有列在 `data/quiz_reviewed.json` 的集數才顯示。

## 在你的電腦上更新單集內容

```bash
python3 -m pip install pillow   # 轉 WebP 用；沒有也能跑，只是不產生圖片
python3 tools/build_episodes.py --drive "~/Library/CloudStorage/GoogleDrive-<帳號>/我的雲端硬碟/科學podcast/workspace/listensci"
python3 tools/build_catalog.py
```

`data/episodes/s4.json` 目前是用 `tests/fixtures/` 的節錄資料產生的樣本，跑過上面的指令就會換成完整內容。

## 每天自動執行

`.github/workflows/status.yml` 每天台灣時間 07:43 讀 [listensci](https://github.com/tarotw/listensci) 更新好的 `soundon.xml` 與 `apple.json`，重跑上架狀態與目錄。Spotify 要在 repo 的 Settings → Secrets 加上 `SPOTIFY_SHOW_ID`、`SPOTIFY_CLIENT_ID`、`SPOTIFY_CLIENT_SECRET` 才會檢查。

## 本機預覽

```bash
python3 -m http.server 8000   # 然後開 http://localhost:8000/?lv=l07
```

網址參數：`?lv=l07`（某一格）、`?lv=era:life`（時光機）、`?ch=112`（直接打開某一台）、`?mode=list`（清單模式）。

## 發布

GitHub Pages（Settings → Pages → Deploy from branch → `main` / root），`CNAME` 已設為 `universe.kidsci.app`；kidsci.app 的 DNS 要加一筆 `universe` CNAME 指向 `tarotw.github.io`。

`bridge/kidsci-bridge.js` 要放進 lab.kidsci.app 的根目錄，並在每個實驗頁加 `<script src="/kidsci-bridge.js" defer></script>`。
