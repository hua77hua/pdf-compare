# PDF 活動比較系統

專為 Apple 銷售人員設計的活動 PDF 比較工具，可快速找出兩份活動文件的價格差異、新增品項與下架品項，並自動產生行銷話術與銷售建議。

---

## 功能介紹

- **上傳比較**：上傳兩份活動 PDF，自動解析表格並逐行比對差異
- **差異檢視**：依產品類別（iPhone / iPad / Mac / Apple Watch / 配件）分頁顯示，支援機型篩選
- **歷史記錄**：所有上傳的文件自動儲存，可隨時重新比對任意兩份
- **活動賣點分析**：自動產生降價品項、新增優惠、注意下架等行銷卡片，可一鍵複製分享
- **銷售話術參考**：依比較結果偵測產品類別，自動顯示對應銷售情境話術

---

## 安裝說明

### 環境需求

- Python 3.9 以上
- pip

### 步驟

```bash
# 1. Clone 專案
git clone https://github.com/hua77hua/pdf-compare.git
cd pdf-compare

# 2. 安裝套件
pip install -r requirements.txt

# 3. 啟動伺服器
python app.py
```

啟動後在瀏覽器開啟：`http://localhost:5001`

---

## 使用說明

### 上傳並比較

1. 在左上角「上傳 PDF」區塊，點擊**文件 A**（舊活動）欄位選擇 PDF
2. 點擊**文件 B**（新活動）欄位選擇 PDF
3. 可自訂文件名稱，方便識別
4. 點擊「**✦ 上傳並開始比較**」

### 查看比較結果

- 右上角「比較差異」區塊會依類別分頁顯示差異
- 可使用**機型篩選**下拉選單縮小範圍
- 綠色 = 新增、紅色 = 移除、黃色 = 變動、白色 = 無變化

### 歷史記錄比較

1. 左下角「歷史記錄」區塊顯示所有曾上傳的文件
2. 點選兩筆記錄（顯示藍色 A / 紅色 B 標記）
3. 點擊「**⇌ 比較**」按鈕

### 活動賣點分析

- 比較完成後，右下角自動產生行銷卡片
- 點擊「**複製**」可直接貼到 LINE、Email 等通訊工具
- 下方「💬 銷售話術參考」依產品類別提供銷售情境話術

---

## 部署說明（PythonAnywhere）

網站部署於：`https://tk244apple.pythonanywhere.com`

### 更新程式碼步驟

**Step 1 — 本機 push 到 GitHub**

```bash
cd /Users/haideechou/Documents/pdf-compare
git add .
git commit -m "更新說明"
git push origin main
```

**Step 2 — PythonAnywhere 拉取更新**

登入 [PythonAnywhere](https://www.pythonanywhere.com/user/tk244apple/) → **Consoles → Bash**：

```bash
cd ~/pdf-compare
git fetch origin
git reset --hard FETCH_HEAD
```

**Step 3 — 重新啟動**

點選 **Web** → 按綠色 **Reload** 鈕

---

## 專案結構

```
pdf-compare/
├── app.py              # Flask 後端：上傳、解析、比較、建議
├── requirements.txt    # Python 套件清單
├── static/
│   ├── index.html      # 網頁頁面
│   ├── app.js          # 前端邏輯
│   └── style.css       # 樣式
├── uploads/            # 上傳的 PDF（不需備份）
└── pdf_compare.db      # SQLite 歷史記錄（各環境獨立）
```

---

## 技術架構

| 層級 | 技術 |
|------|------|
| 後端 | Python / Flask |
| PDF 解析 | pdfplumber |
| 差異比對 | difflib SequenceMatcher |
| 資料庫 | SQLite |
| 前端 | Vanilla JS / CSS |
| 部署 | PythonAnywhere / Gunicorn |
