# 宇宙好好聽 · universe.kidsci.app

科學好好聽的「萬物宇宙」互動地圖：轉動萬物旋鈕，從一顆原子、一隻動物、整個地球，一路調到 930 億光年的宇宙邊界；再搭時光機回到恐龍與牛頓的年代。每一站都能聽 Podcast、打開 [lab.kidsci.app](https://lab.kidsci.app/) 的實驗，收集星章。

提案文件：宇宙好好聽：互動網頁提案（Claude 文件）。

## 目前進度：P0

- `knob.html` + `app.js` + `style.css` + `explorer.js`：萬物旋鈕（舊版，隱藏，不在首頁連結，`noindex`）。每一格是一個可以拖曳、縮放的探索場景（Canvas 2D，不載入外部圖檔），每一集是一顆發光的頻道，點了耳機號就飛過去；轉旋鈕換格時有曲速穿越效果與調頻音效。右上角 ☰ 切換清單模式（給鍵盤、螢幕閱讀器與檢查分類用）。
- `explorer3d.js`：3D 探索畫面（Three.js r170，跟 lab.kidsci.app/solar-system 同一套技術，放在 `vendor/three/`，不連外部 CDN）。每格有自己的 3D 主視覺：原子與電子軌道、半透明細胞、浮空生物島與海、霓虹城市、剖開的地球、地球與月球、會流動的太陽、星團、旋臂銀河、宇宙網；時光機是一條發光的時間河，法則航道是七條光管。每一區站在會發光、有波紋的全像平台上，每台頻道有光柱與底座光圈（訂閱者限定多一圈金色軌道）。天空是每格各自烤出來的星雲（`fx3d.js`），還有八大行星、人造衛星、城市車流、瀑布、飛鳥與光塵。耳機號上坐著科學隊長和好奇博士，誰在說話誰就會跳；飛到頻道會有衝擊波和碎片，拿到星章會放彩色煙火，放著不動畫面會慢慢自轉。加上泛光（bloom）、曲速穿越，太慢的裝置會自動降畫質（`?hq` 固定高畫質）。共用的 shader 與貼圖在 `kit3d.js`；整體光暈強度集中在 `kit3d.js` 的 `SOFT`（光暈、邊光、點雲），想更柔或更亮改這裡。配色是「繪本夜空」：暮色藍紫底、桃子、蜂蜜、薄荷，頻道是奶油色貼紙。
- `zoom.html` + `zoom.js` + `zoom3d.js`：**一路放大縮小（小樣本，隱藏，`noindex`）**。同一個宇宙，從「你」的大小出發：鑽進去看皮膚、細胞、原子，退出來看地球、太陽系。操作只有拖曳轉著看、兩指／滾輪放大縮小（一直放大就鑽進去、一直縮小就退出來）、點東西聽故事；左邊的「萬物電梯」顯示你在哪一層，點一層就直接過去。每一層有哪些東西、每個東西放哪幾集寫在 `data/zoom.json`（`things[].codes`，第一集最先出現；`door: true` 是鑽進下一層的入口），改 JSON 就能調整，不用改程式。頻道卡、播放、實驗、航行日誌在 `channel.js`，兩個版本共用，航行日誌也是同一本。
- `mindmap.html` + `mindmap.js` + `mapfx.js`：**宇宙地圖（迷宮開圖，隱藏，`noindex`）**。舊版的 `?lv=大主題` 也接得起來。整張心智圖一開始被星雲蓋住，只看得到中心和一圈發光的「？」。點「？」雲就散開，露出下一層的「？」：中心 → 大主題（生物、太陽系…）→ 小主題（雨林、行星…）→ 一集一集的故事，點到故事就打開頻道卡。地圖直接從 `data/world.json` 和 `data/catalog.json` 長出來，新的集數會自動出現在對應的枝條上；兩個大主題有同一集時，兩邊都打開會亮起「祕密通道」。打開的地方會變成那個大主題顏色的「大陸」，存在 `kidsci-universe-map-v1`，下次回來還在。操作：拖曳移動、兩指／滾輪縮放、右上小地圖點一下飛過去、⌂ 回到中心；手機直拿時，長長一串的故事會自動把地圖轉成直的。隊長選單可以帶你去最近還沒打開的地方、看整張地圖、重新蓋上雲朵。`?ch=代碼` 會打開通往那一集的路。節點是網頁按鈕（Tab 移動、Enter 打開），星雲、枝條、光暈是 WebGL。
- `index.html` + `islands.js` + `isles3d.js` + `isleprops.js`：**宇宙群島（正式版首頁）**。舊網址 `islands.html` 會轉到首頁（帶著 `?ch=`、`?isle=`）；舊版的 `?lv=大主題` 會飛到住最多那個主題的島。只有一個概念：每一集故事都是一個小居民，住在浮在白天太空裡的島上（明亮的藍天、雲海、粉彩星球）。21 座島（錄音室島在中間，雨林、莽原、沙漠、恐龍化石、火山、冰雪、深海、濕地花園、動物大觀園、雲朵天空、身體樂園、原子實驗、力與能量、光與電、科學家小鎮、未來城市、飛行基地圍成兩圈，月亮、行星、星星天文台在高處），每一集住哪座島寫在 `data/islands.json`（`sources` 是 catalog 的 home 或 home:zone，改 JSON 就能搬家）。島和島之間坐火箭：按「🚀 火箭站」選一座島、或直接點遠方的島，火箭會點火、飛一條弧線過去，鏡頭跟在後面；天上也有別的小火箭在島之間飛。每座島有自己的地標和會動的小東西（瀑布、摩天輪、冒煙的火山、轉動的原子模型、太陽系儀、鯨魚、熱氣球、會掉的蘋果…），還有站牌和踏腳石小路。居民是會走路的貼紙小人（頭是那一集的圖示、下面有兩隻小腳），訂閱的戴皇冠、還在準備中的坐著打瞌睡 💤、聽過的有綠色勾勾；點一下會跳起來，再打開頻道卡。「👥 居民」是這座島的居民名單（也給鍵盤和螢幕閱讀器用），拉遠或按「🗺️ 全部的島」看整個群島。`?ch=代碼` 從那一集住的島出發並打開卡片，`?isle=島` 從那座島出發。去過的島存在 `kidsci-universe-isles-v1`，航行日誌跟其他版本共用。所有居民用一次繪圖畫完（貼圖集 + instanced billboard），遠的島只畫島本身。
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

`.github/workflows/status.yml` 每天台灣時間 07:43 讀 [listensci](https://github.com/tarotw/listensci) 更新好的 `soundon.xml` 與 `apple.json`，重跑上架狀態與目錄。Spotify 要在 repo 的 Settings → Secrets 加上 `SPOTIFY_CLIENT_ID`、`SPOTIFY_CLIENT_SECRET` 才會檢查（節目 ID 預設已填好）。

每一集的 **Apple Podcasts、Spotify 連結**由 `tools/platform_links.py` 找（同一個每日工作，存在 `data/platforms.json`），頻道卡上每一集都會列出這兩個平台：有連結就按住打開，找不到就寫「即將推出」。最準的來源是每一集的 Firstory 單集頁：Firstory 自己把節目發佈到 Spotify 和 Apple，單集頁上就寫著那一集在兩個平台的網址（看過的頁面會記下來，還沒有連結的每週再看一次）。另外也用 iTunes Lookup／搜尋補 Apple，再用標題對到代碼（`build_catalog.py`）。只在 Firstory 會員區、不在公開 RSS 裡的訂閱集數，平台上找不到公開連結，會顯示「即將推出」。如果之後想改用 Spotify 官方 API，把 `SPOTIFY_CLIENT_ID`、`SPOTIFY_CLIENT_SECRET` 加到 repo 的 Actions Secrets 就會自動使用（節目 ID `1eyISRdcgDTwZqIqrP1qKv` 已寫在程式裡）。

## 本機預覽

```bash
python3 -m http.server 8000   # 然後開 http://localhost:8000/（其他版本：/mindmap.html、/knob.html?lv=l07、/zoom.html）
```

網址參數：`?lv=l07`（某一格）、`?lv=era:life`（時光機）、`?ch=112`（直接打開某一台）、`?mode=list`（清單模式）。

## 發布

GitHub Pages（Settings → Pages → Deploy from branch → `main` / root），`CNAME` 已設為 `universe.kidsci.app`；kidsci.app 的 DNS 要加一筆 `universe` CNAME 指向 `tarotw.github.io`。

`bridge/kidsci-bridge.js` 要放進 lab.kidsci.app 的根目錄，並在每個實驗頁加 `<script src="/kidsci-bridge.js" defer></script>`。
