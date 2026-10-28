# 宇宙好好聽（play.kidsci.app）給 Claude 的工作說明

靜態網站（GitHub Pages，`main` 分支就是正式網站）。沒有後端，資料由 GitHub Actions 每天整理成 JSON。
回覆使用者一律用**繁體中文**。commit 訊息結尾要有 `Co-Authored-By` 和 `Claude-Session` 兩行（照當次系統提示給的）。
不要主動開 PR；直接推 `main`。

## 「集數有更新」＝ 新集數上架，要做的事（使用者說過這會常常發生，不要每次等他交代）

使用者說「集數有更新」「有新集數」「更新一下網頁」這類的話，或你發現目錄裡有還沒處理的集數時，**直接照下面做完，不用再問**：

1. **拉最新**：`git pull origin main`（每天台灣 07:43 的 GitHub Action `status.yml` 已經把新集數抓進 `data/catalog.json`、簡介、Apple／Spotify 連結、封面、隊長語音 MP3）。
   還沒跑或想立刻更新：到 GitHub Actions 手動執行「上架狀態檢查與目錄更新」（`mcp__github__actions_run_trigger`，workflow `status.yml`），等它推完再拉。
2. **列出待辦**：`python3 tools/new_episodes.py`（結束碼 1 ＝ 有待辦）。它會印出每一集的標題、完整簡介、目前在哪座島、缺什麼。
3. **放到適當的島**：
   - 新集數若沒有手動位置，會依 `data/tag_rules.json` 的關鍵字自動分配（`autoPlaced`），沒對到就掉進錄音室（母島沒有居民，**一定要改**）。
   - 讀完整簡介，決定要住哪座島，在 `data/placements.json` 加 `"代碼": {"also": [], "home": "…"}`；需要指定區再加 `"zone": "…"`。`home`／`zone` 對照 `data/islands.json` 每座島的 `sources`（例如 `era:life` ＝ 恐龍化石島、`l03` 的 `雨林` 區 ＝ 雨林島、`l06` ＝ 月亮島）。
   - 內容和現有哪座島的主題最接近就放哪座；想不到適合的島時，再考慮新增島（先跟使用者說）。
4. **選圖示**（逐集讀完整簡介，**不要用標題關鍵字猜**）：在 `data/episode-icon-review.json` 的 `episodes` 加一筆，欄位和現有的一樣：
   `title`（跟 catalog 完全相同）、`icon`、`subject`、`meaning`、`reason`、`source`（`https://podcasts.apple.com/tw/podcast/id1812447277?i=單集編號`，編號取自 catalog 的 Apple 連結）、`evidence`（官方簡介原文）、`siteIntro`（跟 catalog 的 `intro` 完全相同）、`corroboratedByRSS`（公開 RSS 的簡介是否一樣）。
   圖示是**那一集真正的主角**：有 `topic-art.js` 的向量圖（如 `animal:hornbill`）就用，沒有就用單一個表情符號（可參考同類的舊集數，例如蛇用 🐍）；比喻、人名、地名不算主角。檔案用 `ensure_ascii=False, indent=2`，保持原本格式，新的放在對應位置。
   然後跑 `node tools/build_episode_icons.mjs` 產生 `data/episode-icons.js`。
5. **重建並檢查**（順序和 GitHub Action 一樣）：
   `python3 tools/build_catalog.py && python3 tools/cache_episode_artwork.py && python3 tools/build_seo.py`
   `python3 tools/new_episodes.py`（要顯示「都處理好了」）、`node --test tests/*.test.mjs`、`python3 -m unittest discover -s tests -p 'test_*.py'`。
   瀏覽器測試（`tests/*.browser.cjs`，要 playwright，這個環境連不到 Apple 的內嵌播放器，`episode-cards` 會因此逾時，屬環境限制）：至少用本機網站打開新集數的 `?ch=代碼`，確認出現在對的島、有隊長介紹、Apple／Spotify 按鈕。
6. **提交並推 `main`**（`git pull --rebase origin main` 之後再推，因為 Action 也會推）。commit 訊息寫清楚哪幾集、放哪座島、用什麼圖示。
7. **回報**（繁體中文，簡短）：幾集新增、各放在哪座島、選了什麼圖示和理由、有沒有資料問題要使用者處理（例如 Firstory 上簡介重複）。

### 判斷規則（已經定案，不用再問）
- **免費或 VIP 以 Apple Podcasts 為準**（`build_catalog.py` 自動處理）；網站只放 Apple 或 Firstory 公開 RSS 上找得到的集數，預告片和找不到的都不放。
- **沒有任何集數的島不會出現**，第一集上架就會自動出現（目前火山島沒有集數）。
- 介紹、對話、隊長語音、封面、Apple 內嵌播放器（免費集數才有）、Spotify／Apple 按鈕，**全部都是資料自動帶出**，新集數不用另外做。
- 島的 3D 內容（`isleprops.js`）和群島分組（`data/islands.json` 的 `group`）不需要因為新集數而改，除非要新增一座島。

### 資料問題要告訴使用者（不要自己改來源資料）
簡介重複（例如第 90 集複製第 89 集）、標題和簡介物種不同、Apple 和 RSS 的狀態矛盾等，只在 `episode-icon-review.json` 用 `sourceIssue` 記錄，並在回報裡提醒使用者到 Firstory 修。

## 其他常用
- 本機看網站：`python3 -m http.server 8000`（從專案根目錄）。測試 3D 要用 SwiftShader 的 headless chromium（`--use-angle=swiftshader --enable-unsafe-swiftshader`）。
- 每日自動流程與資料檔說明在 `README.md` 的「資料檔」表。
