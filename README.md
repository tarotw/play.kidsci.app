# 宇宙好好聽 · universe.kidsci.app

科學好好聽的「萬物宇宙」互動地圖：轉動萬物旋鈕，從一顆原子、一隻動物、整個地球，一路調到 930 億光年的宇宙邊界；再搭時光機回到恐龍與牛頓的年代。每一站都能聽 Podcast、打開 [lab.kidsci.app](https://lab.kidsci.app/) 的實驗，收集星章。

提案文件：宇宙好好聽：互動網頁提案（Claude 文件）。

## 目前進度：P0

- `index.html` + `app.js` + `style.css` + `explorer.js`：萬物旋鈕預覽版。每一格是一個可以拖曳、縮放的探索場景（Canvas 2D，不載入外部圖檔），每一集是一顆發光的頻道，點了耳機號就飛過去；轉旋鈕換格時有曲速穿越效果與調頻音效。右上角 ☰ 切換清單模式（給鍵盤、螢幕閱讀器與檢查分類用）。
- `explorer3d.js`：3D 探索畫面（Three.js r170，跟 lab.kidsci.app/solar-system 同一套技術，放在 `vendor/three/`，不連外部 CDN）。每格有自己的 3D 主視覺：原子與電子軌道、半透明細胞、浮空生物島與海、霓虹城市、剖開的地球、地球與月球、會流動的太陽、星團、旋臂銀河、宇宙網；時光機是一條發光的時間河，法則航道是七條光管。每一區站在會發光、有波紋的全像平台上，每台頻道有光柱與底座光圈（訂閱者限定多一圈金色軌道）。天空是每格各自烤出來的星雲（`fx3d.js`），還有八大行星、人造衛星、城市車流、瀑布、飛鳥與光塵。耳機號上坐著科學隊長和好奇博士，誰在說話誰就會跳；飛到頻道會有衝擊波和碎片，拿到星章會放彩色煙火，放著不動畫面會慢慢自轉。加上泛光（bloom）、曲速穿越，太慢的裝置會自動降畫質（`?hq` 固定高畫質）。共用的 shader 與貼圖在 `kit3d.js`；整體光暈強度集中在 `kit3d.js` 的 `SOFT`（光暈、邊光、點雲），想更柔或更亮改這裡。配色是「繪本夜空」：暮色藍紫底、桃子、蜂蜜、薄荷，頻道是奶油色貼紙。
- `zoom.html` + `zoom.js` + `zoom3d.js`：**一路放大縮小（小樣本）**。同一個宇宙，從「你」的大小出發：鑽進去看皮膚、細胞、原子，退出來看地球、太陽系。操作只有拖曳轉著看、兩指／滾輪放大縮小（一直放大就鑽進去、一直縮小就退出來）、點東西聽故事；左邊的「萬物電梯」顯示你在哪一層，點一層就直接過去。每一層有哪些東西、每個東西放哪幾集寫在 `data/zoom.json`（`things[].codes`，第一集最先出現；`door: true` 是鑽進下一層的入口），改 JSON 就能調整，不用改程式。頻道卡、播放、實驗、航行日誌在 `channel.js`，兩個版本共用，航行日誌也是同一本。
- 效能：一格裡所有頻道合成幾批畫完（`channels3d.js`：徽章畫在同一張圖集、光柱／光圈／金色軌道用 InstancedMesh），浮空島的樹和城市大樓合成一個網格，生物格從每格 821 次繪圖降到 63 次。換格時下一格先在背景準備好、shader 先編好再換上。手機不開光暈後製（`?bloom` 可強制打開）。網址加 `?debug` 會在左下角顯示每秒格數、繪圖次數、建場景時間，回報卡頓時可以截這個給我們。
- 相容：`compat.js` 幫舊版 iPad（iOS 15.4 以前）補上 `<dialog>` 與 canvas `roundRect`；不支援 import map 或 WebGL2 的瀏覽器會自動改用 2D 版。shader 字串裡只放 ASCII（舊 Safari 會因中文註解編譯失敗）。各格正中間的主角在 `heroes3d.js`：會冒日珥的太陽和八大行星（木星大紅斑、土星環、小行星帶）、有夜間城市燈光的地球與月球、標出地殼／地函／外核／內核的地球剖面、帶電子雲與拖尾的原子、會蠕動的細胞（細胞核、粒線體、高基氏體、內質網）、ON AIR 錄音室。大小依那一格中間留下的空間決定；手機版鏡頭從頻道那一區往中心看，主角在後面。滑鼠左鍵／單指拖曳移動，右鍵／雙指旋轉，滾輪／雙指縮放。裝置不支援 WebGL 時自動改用 2D 版（`explorer.js`）；網址加 `?gl=0` 可以強制看 2D 版。
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
