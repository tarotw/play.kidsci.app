# 科學好好聽-宇宙島 · play.kidsci.app

科學好好聽的「萬物宇宙」互動地圖：轉動萬物旋鈕，從一顆原子、一隻動物、整個地球，一路調到 930 億光年的宇宙邊界；再搭時光機回到恐龍與牛頓的年代。每一站都能聽 Podcast、打開 [lab.kidsci.app](https://lab.kidsci.app/) 的實驗，收集星章。

提案文件：宇宙好好聽：互動網頁提案（Claude 文件）。

## 目前進度：P0

- `knob.html` + `app.js` + `style.css` + `explorer.js`：萬物旋鈕（舊版，隱藏，不在首頁連結，`noindex`）。每一格是一個可以拖曳、縮放的探索場景（Canvas 2D，不載入外部圖檔），每一集是一顆發光的頻道，點了耳機號就飛過去；轉旋鈕換格時有曲速穿越效果與調頻音效。右上角 ☰ 切換清單模式（給鍵盤、螢幕閱讀器與檢查分類用）。
- `explorer3d.js`：3D 探索畫面（Three.js r170，跟 lab.kidsci.app/solar-system 同一套技術，放在 `vendor/three/`，不連外部 CDN）。每格有自己的 3D 主視覺：原子與電子軌道、半透明細胞、浮空生物島與海、霓虹城市、剖開的地球、地球與月球、會流動的太陽、星團、旋臂銀河、宇宙網；時光機是一條發光的時間河，法則航道是七條光管。每一區站在會發光、有波紋的全像平台上，每台頻道有光柱與底座光圈（訂閱者限定多一圈金色軌道）。天空是每格各自烤出來的星雲（`fx3d.js`），還有八大行星、人造衛星、城市車流、瀑布、飛鳥與光塵。耳機號上坐著科學隊長，朗讀時會跳；飛到頻道會有衝擊波和碎片，拿到星章會放彩色煙火，放著不動畫面會慢慢自轉。加上泛光（bloom）、曲速穿越，太慢的裝置會自動降畫質（`?hq` 固定高畫質）。共用的 shader 與貼圖在 `kit3d.js`；整體光暈強度集中在 `kit3d.js` 的 `SOFT`（光暈、邊光、點雲），想更柔或更亮改這裡。配色是「繪本夜空」：暮色藍紫底、桃子、蜂蜜、薄荷，頻道是奶油色貼紙。
- `zoom.html` + `zoom.js` + `zoom3d.js`：**一路放大縮小（小樣本，隱藏，`noindex`）**。同一個宇宙，從「你」的大小出發：鑽進去看皮膚、細胞、原子，退出來看地球、太陽系。操作只有拖曳轉著看、兩指／滾輪放大縮小（一直放大就鑽進去、一直縮小就退出來）、點東西聽故事；左邊的「萬物電梯」顯示你在哪一層，點一層就直接過去。每一層有哪些東西、每個東西放哪幾集寫在 `data/zoom.json`（`things[].codes`，第一集最先出現；`door: true` 是鑽進下一層的入口），改 JSON 就能調整，不用改程式。頻道卡、播放、實驗、航行日誌在 `channel.js`，兩個版本共用，航行日誌也是同一本。
- `mindmap.html` + `mindmap.js` + `mapfx.js`：**宇宙地圖（迷宮開圖，隱藏，`noindex`）**。舊版的 `?lv=大主題` 也接得起來。整張心智圖一開始被星雲蓋住，只看得到中心和一圈發光的「？」。點「？」雲就散開，露出下一層的「？」：中心 → 大主題（生物、太陽系…）→ 小主題（雨林、行星…）→ 一集一集的故事，點到故事就打開頻道卡。地圖直接從 `data/world.json` 和 `data/catalog.json` 長出來，新的集數會自動出現在對應的枝條上；兩個大主題有同一集時，兩邊都打開會亮起「祕密通道」。打開的地方會變成那個大主題顏色的「大陸」，存在 `kidsci-universe-map-v1`，下次回來還在。操作：拖曳移動、兩指／滾輪縮放、右上小地圖點一下飛過去、⌂ 回到中心；手機直拿時，長長一串的故事會自動把地圖轉成直的。隊長選單可以帶你去最近還沒打開的地方、看整張地圖、重新蓋上雲朵。`?ch=代碼` 會打開通往那一集的路。節點是網頁按鈕（Tab 移動、Enter 打開），星雲、枝條、光暈是 WebGL。
- `index.html` + `islands.js` + `isles3d.js` + `isleprops.js` + `residents3d.js`：**科學好好聽-宇宙島（正式版首頁）**。舊版的 `?lv=大主題` 會飛到住最多那個主題的島。只有一個概念：每一集故事都是一個小居民，住在浮在白天太空裡的島上（明亮的藍天、雲海、粉彩星球）。島分成五個群島，同一群的排在一起，全景時寫出群島的名字：🐾 動物群島（雨林、莽原、沙漠、淡水濕地、動物大觀園、深海、天空冰原）、🦴 遠古群島（恐龍化石、遠古人類：洞穴壁畫、營火、長毛象、巨石陣）、🔬 科學群島（原子實驗、力與能量、光與電、身體樂園、科學家小鎮）、🚀 科技群島（未來城市、飛行基地）、🌌 太空群島（月亮、行星、星星天文台，在高處）；好好聽島在正中間，是母島（沒有居民）。火箭站也照群島分類，每一集住哪座島寫在 `data/islands.json`（放錯區的集數在 `data/placements.json` 寫 `home` 和 `zone` 指定）（`sources` 是 catalog 的 home 或 home:zone，改 JSON 就能搬家）。島和島之間坐火箭：按下面的「🚀 去別的島」（火箭站）選一座島、或直接點遠方的島，火箭會點火、飛一條弧線過去，鏡頭跟在後面；天上也有別的小火箭在島之間飛。每座島有自己的 3D 地形（`isleprops.js` 的 `TERRAIN`：雨林的山丘、河谷和湖，沙漠的沙丘和紅色台地，恐龍島露出岩層的化石崖，火山島整座是一座有火山口和岩漿流的火山，冰雪島的雪山和結冰的湖，深海島的潟湖和沙洲，濕地的小水塘，原子島的階梯台地，光與電島的晶體山脊，月亮的隕石坑…；地面顏色跟著高度、坡度變，陡坡露出岩石、高處積雪、低處有水），所有東西都站在地形上，大建築底下會自動整平。每座島有自己的地標和會動的小東西（瀑布、摩天輪、冒煙的火山、轉動的原子模型、太陽系儀、鯨魚、熱氣球、會掉的蘋果…），再加上 `EXTRA` 的加碼物件（雨林的板根大樹、吊橋、樹屋，莽原的獵遊吉普車，沙漠的駱駝和石拱，暴龍雕像和翼龍，溫泉，極光和企鵝，沉船、海龜、浮標，荷葉和石拱橋、白鷺、蜻蜓，旋轉木馬，風箏和風車，神經元樹和會轉的大眼睛，晶體結構和飄浮的分子，雲霄飛車大迴圈和牛頓擺，電線桿、太陽能板和會打雷的小烏雲，比薩斜塔和地球儀，高架單軌電車，飛船和航廈，月球基地和太空人，小行星帶，電波望遠鏡…），還有站牌和踏腳石小路。居民只走得到的地方：不穿過建築、不走進湖裡、不爬太陡的坡。居民是會走路的立體小公仔（`residents3d.js`）：圓潤的 3D 頭殼印著每集原有圖示，搭配同色系身體、奶油色肚皮、小手、領巾與雙層鞋底；免費集數配薄荷色領巾、VIP 配蜂蜜金色領巾。播放標記是奶油色外殼、薄荷色鼓面和圓角白色三角形組成的立體徽章，接受場景光照並始終朝向鏡頭，曲面邊緣使用 WebGL 抗鋸齒。頭部和身體都接受場景光照，頭稍微抬向鏡頭；走路時擺動手腳，點一下會抬手打招呼。減少動態效果模式會停用走路、跳躍、呼吸與徽章脈動。能不能聽一眼就看得出來：頭上綠色 ▶、腳下綠色光圈＝可以在這裡聽；金色皇冠、金色光圈＝VIP 故事（請大人幫忙）。網站只放 podcast 上真的找得到的集數：Firstory 公開 RSS 裡的，或 Apple Podcasts 上的（含「Apple Podcasts 訂閱頻道」的訂閱者專屬集數，由 `tools/platform_links.py` 透過 Apple 網頁用的 API 抓全部單集）；只有預告片或兩邊都找不到的不放。是不是 VIP 以 Apple Podcasts 為準：Apple 上標「僅限訂閱者」的才是 VIP，其餘（包括標題寫 VIP.33、SP.24 但 Apple 上大家都聽得到的）算免費；只在 Firstory、不在 Apple 的才退回看代碼（c／s 開頭是 VIP），所以只有這兩種；還沒有任何一集上架的島（目前是火山島）先不出現，有集數上架就會自動出現。島名下面也列出這座島「▶ 可以聽／👑 VIP」各幾個，滑鼠移到居民上會寫能不能聽，居民名單也有同樣的標示。深海島的居民泡在水裡游泳，只露出頭。聽過的有綠色勾勾；點一下會跳起來，再打開頻道卡。島名下面那一塊「👥 幾位居民 ›」（一起寫出幾個可以聽、幾個 VIP）按了就是這座島的居民名單（也給鍵盤和螢幕閱讀器用）；有居民的島，底部會出現三個小公仔的「找居民」大按鈕，直接打開這座島的居民名單；旁邊是「🚀 去別的島」和「🗺️ 全部的島」（在全景時變成「🏝️ 回到島上」），拉遠也會到全景。`?ch=代碼` 從那一集住的島出發並打開卡片，`?isle=島` 從那座島出發。去過的島存在 `kidsci-universe-isles-v1`，航行日誌跟其他版本共用。居民共用一份貼圖集，各個立體部位以 instancing 批次繪製，播放徽章的三個部位只批次繪製可收聽的居民，皇冠、拜訪標記與腳下光圈也各自合成一批；遠島居民先不繪製立體部位，靠近且進入視野後才顯示，遠島保留島本身。
- 效能：一格裡所有頻道合成幾批畫完（`channels3d.js`：徽章畫在同一張圖集、光柱／光圈／金色軌道用 InstancedMesh），浮空島的樹和城市大樓合成一個網格，生物格從每格 821 次繪圖降到 63 次。換格時下一格先在背景準備好、shader 先編好再換上。手機不開光暈後製（`?bloom` 可強制打開）。網址加 `?debug` 會在左下角顯示每秒格數、繪圖次數、建場景時間，回報卡頓時可以截這個給我們。
- 相容：`compat.js` 幫舊版 iPad（iOS 15.4 以前）補上 `<dialog>` 與 canvas `roundRect`；不支援 import map 或 WebGL2 的瀏覽器會自動改用 2D 版。shader 字串裡只放 ASCII（舊 Safari 會因中文註解編譯失敗）。各格正中間的主角在 `heroes3d.js`：會冒日珥的太陽和八大行星（木星大紅斑、土星環、小行星帶）、有夜間城市燈光的地球與月球、標出地殼／地函／外核／內核的地球剖面、帶電子雲與拖尾的原子、會蠕動的細胞（細胞核、粒線體、高基氏體、內質網）、ON AIR 錄音室。大小依那一格中間留下的空間決定；手機版鏡頭從頻道那一區往中心看，主角在後面。滑鼠左鍵／單指拖曳移動，右鍵／雙指旋轉，滾輪／雙指縮放。裝置不支援 WebGL 時自動改用 2D 版（`explorer.js`）；網址加 `?gl=0` 可以強制看 2D 版。
- 科學隊長當導航員：第一次來有開場導覽、每進一格有一問一答、頻道卡上有隊長的故事介紹、拿到星章會說話、發呆 25 秒會建議下一台並可「帶我去」。右上角隊長頭像打開選單：大小猜猜看、現在的任務、帶我去一台、先不要說話。台詞都在 `data/dialogue.json`，可以直接改；🔈 用瀏覽器內建語音念出來。
- 每一格有任務（拜訪 3 台、找到金色頻道、聽完一集），完成拿 🏅 任務勳章。頭像是從 `assets/logo-square.jpg` 裁出來的 `assets/avatar-*.png`。
- 10 格全部打開，方便檢查每一集放的位置；正式版把 `app.js` 的 `PREVIEW` 改成 `false`，只開 `data/world.json` 的 `mvp_levels`（生物、地球、太陽系）。
- 每一格裡的「區」（海洋、雨林、火山…）由 `data/world.json` 的區域關鍵字自動分，`build_catalog.py` 寫進每一集的 `zone`；分錯的話改關鍵字或在 `placements.json` 加 `zone`。
- 收聽都連到 Apple Podcasts、Spotify（點一下就打開），網站上不直接播放。
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

`.github/workflows/status.yml` 每天台灣時間 07:43 讀 [listensci](https://github.com/tarotw/listensci) 更新好的 `soundon.xml` 與 `apple.json`，重跑上架狀態與目錄。Spotify 用 repo Actions Secrets 裡的 `SPOTIFY_CLIENT_ID`、`SPOTIFY_CLIENT_SECRET` 呼叫官方 API（已設定；節目 ID 預設已填好）。

每一集的 **Apple Podcasts、Spotify 連結**由 `tools/platform_links.py` 找（同一個每日工作，存在 `data/platforms.json`），頻道卡上每一集都會列出這兩個平台：有連結就點一下打開，找不到就不顯示那個平台。最準的來源是每一集的 Firstory 單集頁：Firstory 自己把節目發佈到 Spotify 和 Apple，單集頁上就寫著那一集在兩個平台的網址（看過的頁面會記下來，還沒有連結的每週再看一次）。另外也用 iTunes Lookup／搜尋補 Apple，再用標題對到代碼（`build_catalog.py`）。Spotify 另外用官方 API（repo 的 Actions Secrets 有 `SPOTIFY_CLIENT_ID`、`SPOTIFY_CLIENT_SECRET`，節目 ID `1eyISRdcgDTwZqIqrP1qKv` 已寫在程式裡）拿到全部集數，包含不在公開 RSS 裡的 VIP 集數，再用標題對到代碼。金鑰拿掉的話只能讀 Spotify 公開頁面（通常只有最新一集），VIP 集數就沒有 Spotify 連結。某一集 Firstory 沒同步到平台，那個平台就不顯示。

## 本機預覽

```bash
python3 -m http.server 8000   # 然後開 http://localhost:8000/（其他版本：/mindmap.html、/knob.html?lv=l07、/zoom.html）
```

網址參數：`?lv=l07`（某一格）、`?lv=era:life`（時光機）、`?ch=112`（直接打開某一台）、`?mode=list`（清單模式）。

選島流程的瀏覽器回歸測試：本機伺服器開啟、已安裝 Playwright 與 Chromium 後，執行 `node tests/island-navigation.browser.cjs`。可用 `BASE_URL` 指定正式網站、`CHROMIUM_PATH` 指定瀏覽器。測試會實際起飛與抵達，涵蓋全景鏡頭移動時立即選島、觸控島名、飛行中避免重複出發，以及火箭站選島。

## 發布

GitHub Pages（Settings → Pages → Deploy from branch → `main` / root），`CNAME` 已設為 `play.kidsci.app`；kidsci.app 的 DNS 要加一筆 `play` CNAME 指向 `tarotw.github.io`。

`bridge/kidsci-bridge.js` 要放進 lab.kidsci.app 的根目錄，並在每個實驗頁加 `<script src="/kidsci-bridge.js" defer></script>`。


## 分享縮圖

分享到 Facebook、LINE、X 時顯示 `assets/og-cover.jpg`（1200×630）：3D 畫面裡的雨林島近景，後面有其他浮空島，左邊是標誌、「科學好好聽 宇宙島」和一句說明，右下是科學隊長和好奇博士。要重做（例如島的樣子改了）：開本機網站後執行 `node tools/og/make_og.mjs`；版面在 `tools/og/card.html`。Facebook 會快取舊圖，換圖後到 Facebook 分享偵錯工具（Sharing Debugger）按「再次抓取」。

## SEO（搜尋引擎）

宇宙島是 3D 畫布，搜尋引擎看不到字，所以 `tools/build_seo.py` 依 `data/islands.json`、`data/catalog.json` 產生：`index.html` 裡的標題、描述、關鍵字、Open Graph／Twitter、JSON-LD（WebSite、PodcastSeries、島的清單、常見問題）和一份**文字版**（每個群島、每座島、每一集的標題，連結是 `?isle=`、`?ch=`；畫面上收起來，給搜尋引擎和螢幕閱讀器，關掉 JS 時會直接顯示），另外 `sitemap.xml`、`robots.txt`（心智圖、旋鈕、縮放那幾頁不收錄）。每次目錄更新後由 GitHub Actions（`status.yml`）自動重跑，集數會跟著變；手動跑：`python3 tools/build_seo.py`。

## 頻道卡與收聽

點小居民打開的卡片：上方的單集預覽顯示該集專屬封面、標題、日期及長度，接著是科學隊長的故事介紹，內容是這一集的介紹（`catalog.json` 的 `intro`，來自 Firstory 單集說明，沒有的話用 Apple Podcasts 上的說明，所以 VIP 集數也有介紹；只留第一段，去掉連結和宣傳句，由 `status_check.py` 的 `intro_text` 整理）。`episode-intro.js` 將介紹縮成一段、最多 90 字，畫面與語音共用同一段內容。
免費的集數在卡片上方直接放 **Apple Podcasts 內嵌播放器**（`embed.podcasts.apple.com`，網址由單集的 Apple 連結換主機而來）：小朋友不用離開網站就能聽完整一集；它是從 Firstory 串流音檔，所以算進 Firstory 的下載數（不算進 Apple Podcasts Connect 的數據）。點隊長圖像時先移除 Podcast 播放器，再播放介紹；改按「聽完整 Podcast」先結束介紹、再載入播放器，兩種聲音互斥。切換至介紹會結束目前的 Podcast 播放，播放器不保留進度。按下 Podcast 播放器時蓋👂耳朵章；關掉卡片時播放器一起拿掉，聲音才會停。VIP 集數不放播放器。下面另有 **Apple Podcasts、Spotify** 按鈕（點一下開新分頁，給想在 App 裡追蹤的大人）。網站上不直接播放 RSS 的音檔，也不連 Firstory。VIP 集數一樣只放 Apple／Spotify 的單集連結。

單集封面由 Apple Podcasts 單集資料與 RSS 的 `itunes:image` 取得，`build_catalog.py` 以實際 Apple 單集 ID 對應封面，並補上平台提供的日期與長度，未提供的欄位不顯示。`tools/cache_episode_artwork.py` 將原圖原樣快取在 `assets/episode-covers/`，網頁不必等待外部播放器載入才顯示圖片；每日更新也會補齊新封面。`episode-profile.js` 統一圖片選取與日期、長度格式；圖片載入失敗時使用節目封面。聽隊長介紹、暫時移除 Apple 播放器時，這張單集預覽仍保留，回到完整 Podcast 的按鈕也顯示該集封面。Apple 內嵌播放器裡的圖片由 Apple 決定，可能仍是節目共用封面。

單集封面、資訊與 Apple 播放控制整合在同一張播放器卡片，隊長介紹放在卡片下方。卡片縮圖由本站提供，不依賴 Apple 內嵌圖片是否顯示；快取圖片失敗時依序嘗試原始單集封面、節目封面。播放器卡片及「聽完整 Podcast」按鈕使用相同的圖片備援，保持原有的介紹／Podcast 聲音互斥。
快速關閉再開下一集時，忽略上一張卡片延後送達的關閉事件，避免新播放器被移除。

## 對話語音

全站導覽與故事介紹優先播放網站自帶的科學隊長台灣華語女聲音檔（`assets/speech/`，固定 `zh-TW-HsiaoChenNeural`），不依賴 Android、iOS 或電腦上的系統語音名稱。`narration-audio.js` 只預載文字／檔名清單，音檔在需要朗讀時才下載；`speech.js` 使用真正的 Audio 播放事件驅動朗讀狀態。未錄製的動態文字才使用可辨識的系統華語女聲，不切換男聲、粵語或壓低音調。`tools/build_speech_audio.py` 收集導覽、島嶼介紹及精簡故事介紹，產生 MP3 與清單；安裝 `edge-tts` 後執行即可補上新內容，已有音檔會重用。每日目錄更新也會嘗試補齊新故事音檔；語音服務失敗不阻擋目錄更新。
- **預設安靜**：進站、開啟故事卡與一般點擊都不自動朗讀，也不沿用舊版自動朗讀偏好。孩子點科學隊長圖像上的 ▶ 才播放，播放中點同一圖像暫停，再點一次從原位置繼續。
- 每次進島都顯示該島的科學隊長介紹，包含重新到訪、直接開啟島嶼連結與重新整理；到訪紀錄不限制顯示次數。關閉介紹只收起當下這次，下一次進島仍會出現。進入全景或火箭出發時清掉上一座島的介紹與語音，抵達後換成目的地介紹。單集分享連結則直接打開故事卡，避免同時疊上島嶼介紹。
- 故事卡只顯示一個隊長圖像與一段短介紹；不把文字段落做成隱藏播放按鈕，也沒有「停」按鈕。播放／暫停圖示、輔助文字與螢幕閱讀器標籤同步更新。
- 開啟故事卡或其他視窗會結束背景導覽，清除排隊台詞；關閉卡片後不自動續播。首頁歡迎介紹也已合併成一小段。
- 即使裝置沒有系統語音，已錄製的導覽與故事仍能播放；音檔僅在孩子按下播放後才下載。

## 母島玩法與火箭音效

好好聽島沿用 `studio` ID 與舊連結，作為宇宙島的母島。每次進島、重訪或重新整理都顯示四頁玩法說明（`data/islands.json` 的 `tour`），從第一頁開始；上方科學隊長按鈕可隨時重新開啟。用上一頁／下一頁切換，最後「出發探險」打開火箭站；點文字不跳頁。每頁點隊長圖像播放固定台灣華語女聲，換頁會結束上一頁語音，新頁保持安靜。打開故事卡或其他視窗會關閉說明，不在背景續播。其他島的隊長選單也能回母島。

火箭點火時使用 `Sound.launch()` 的 Web Audio 引擎轟鳴與漸強噴射聲，抵達時結束並播放提示音；關閉遊戲音效會立即停止發射聲，不影響手動播放的隊長語音。Android Chrome 的音效 context 在點擊時恢復，合成音效不依賴網路下載。

居民入口以三個彩色小公仔呈現，圖案取自當地居民，並顯示實際居民數量；保留島名下的原有入口。手機將三顆底部按鈕排成大圖示，320px 螢幕也可操作。母島沒有居民，全景與飛行途中不顯示居民按鈕；抵達有居民的島才出現，避免打開上一座島的名單。母島玩法第三頁同步說明新入口，並有對應女聲。

## 新集數更新流程

每天自動抓進新集數（簡介、封面、隊長語音、Apple／Spotify 連結）。之後還要人（或 Claude）做兩件事：**指定住哪座島**（`data/placements.json`）和**逐集判讀簡介選圖示**（`data/episode-icon-review.json` → `node tools/build_episode_icons.mjs`）。`python3 tools/new_episodes.py` 會列出還沒處理的集數；步驟寫在 `CLAUDE.md`。沒處理時 `tests/episode-icons.test.mjs` 會失敗，所以 push 後的功能回歸檢查會變紅，就是提醒。

## 角色圖示核對

逐集閱讀 191 集完整官方單集簡介（Apple Podcasts，125 集另與公開 RSS 交叉核對），將內容摘要、選圖理由、來源連結及原文證據保存在 `data/episode-icon-review.json`。這是官方簡介的內容判讀，並非全長音訊或逐字稿查核。C12 的標題與簡介物種不同，依簡介選冥河水母並記錄疑義；第 90 集的官方簡介與第 89 集重複，也保留資料問題註記。

`tools/build_episode_icons.mjs` 產生精簡的 `data/episode-icons.js`。全站只透過 `episode-icons.js` 選圖，不以人名、地名、標題比喻或字串關鍵字猜測。核對結果必須同時符合代碼、標題及目前介紹的內容識別值；新集數或介紹變更時先用分類圖示，待逐集判讀後再更新。

`topic-art.js` 為缺少合適表情符號的 41 種主題提供原創向量圖示與辨認特徵，例如水豚、㺢㹢狓、犀鳥、美西螈、水熊蟲、白蟻丘及各類行星。同一份路徑以 Canvas 畫上立體公仔貼圖，並以 SVG 顯示於找居民入口、居民名單、故事卡、日誌及其他版本的列表，保持圖案一致。測試涵蓋全目錄、內容變更、物種差異及標題比喻造成的誤判。

## 功能回歸與檢查紀錄（2026-10-26）

本次查核修正四項問題：居民打招呼的延後開卡會蓋住新開的火箭站；異常的舊航行紀錄會令首頁載入失敗；語音載入失敗時缺少提示；放大縮小版會推薦未上架故事而開出空白卡。四種地圖改用 `progress-store.js` 讀取紀錄，損壞欄位會復原，其他有效紀錄保留。

| 範圍 | 本次驗證 |
| --- | --- |
| 島嶼探索 | 實際飛遍 20 座島；逐島播放介紹；核對 191 筆居民清單、19 座有人島嶼的上下入口與代表故事卡 |
| 母島 | 四頁前後切換、末頁出發、關閉重開、回母島與重整回第一頁、預設安靜 |
| 故事卡 | 191 集封面與公眾／VIP 狀態；本地封面→遠端封面→節目封面的備援；快速關閉重開；320px 版面 |
| 聲音 | 288 份 MP3 完整解碼成功；介紹實際播放／暫停／續播／重播；失敗重試；火箭音效、靜音與停止 |
| Podcast | 127 個公開 Apple 內嵌播放器均載入；代表單集實際媒體播放時間前進；與介紹互斥；關卡停止播放 |
| 平台與實驗 | 125 個 Spotify 連結回應成功；91 個不同實驗能在 iframe 載入，未發現 JS 例外或失敗資源；關閉、計時取消及蓋章 |
| 紀錄與視窗 | 拜訪／收聽／實驗紀錄、日誌重開故事、重新整理保存、清除取消／確認、Escape 關閉 |
| 操作與版面 | 實際 3D 居民觸控、拖曳防誤觸、雙指縮放、鍵盤捷徑、桌面一般動畫、減少動態效果、320px／393px／橫向／桌面版面 |
| 失敗復原 | 必要資料載入失敗與重試、破損或禁止儲存、無 WebGL 改用 2D、語音失敗後重試 |
| 其他地圖 | 2D 搜尋／清單／旋鈕／猜題；心智圖分享連結、探索保存與鍵盤開卡；六層電梯、邊界、返回及故事入口 |

本次 Android Chrome 使用 Pixel 7 觸控模擬，另測桌面 Chromium；尚未使用實體 Android／iPhone。VIP 已驗證頁面與連結流程，未使用付費訂閱帳號驗證平台授權。實驗內部科學模型的正確性不在這份網站功能測試內；外部服務結果反映當次檢查狀態。

可重跑的測試（先啟動本機伺服器，安裝 Playwright 與 Chromium）：

```bash
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
node tests/island-navigation.browser.cjs
node tests/full-site.browser.cjs
node tests/mother-tour.browser.cjs
node tests/episode-cards.browser.cjs
node tests/player-lab.browser.cjs
node tests/gestures.browser.cjs
node tests/resilience.browser.cjs
node tests/other-views.browser.cjs
```

瀏覽器測試支援 `BASE_URL`（可指向正式網址）與 `CHROMIUM_PATH`；`full-site.browser.cjs` 支援 `QA_REPORT` 輸出逐島結果與失敗截圖。母島與封面測試的圖像／音效證據輸出到 `ARTIFACT_DIR`（預設 `/tmp/kidsci-qa`）。`episode-cards` 與 `player-lab` 會存取實際外部平台，需可連網。

[功能回歸檢查](.github/workflows/functional.yml) 會在相關程式、資料與測試修改時自動執行資料測試、導覽、手勢、失敗復原及逐島流程，並保存報告。平台播放與外部封面備援另外以實際服務測試，避免將外部服務的登入、限流或中斷誤認為本機程式錯誤。
