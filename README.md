# 兆豐Z系統至Jasmine核心之Layout轉換工具

這是一個將兆豐Z系統的CSV規格表轉換成Jasmine核心系統所需的Java代碼的工具。支援承保(POLICY)、理賠(CLM)和再保(REN)三種系統類型。

## 功能特色

- 支援拖放多個CSV檔案進行批次處理
- 自動識別日期欄位並允許用戶選擇是否轉換為LocalDateTime
- 自動處理OCCURS欄位，生成對應的多個欄位
- 支援承保、理賠、再保三種系統類型，自動調整生成代碼的路徑和表名
- 生成完整的Entity、SaveCmd、TransService、SaveService和Repository類

## 安裝方式

### Windows用戶

1. 下載最新的`.exe`安裝檔
2. 執行安裝檔，按照提示完成安裝

### Mac用戶

1. 下載最新的`.dmg`檔案
2. 打開`.dmg`檔案
3. 將應用拖到Applications資料夾

## 操作詳細說明

### 前置準備：Excel轉CSV

在使用本工具前，您需要先將兆豐Z系統的Excel規格表轉換為CSV格式：

1. 打開Excel檔案
2. 點選「檔案」>「另存新檔」
3. 在「存檔類型」下拉選單中，選擇「CSV UTF-8 (逗號分隔) (*.csv)」
4. 選擇儲存位置，並點擊「儲存」
5. 如果Excel提示可能會遺失功能，點擊「是」繼續

### CSV檔案格式要求

本工具需要處理特定格式的CSV檔案。以下是對CSV檔案格式的詳細要求：

#### 標題行格式

CSV檔案必須包含一個標題行，程式會自動尋找包含以下內容的行作為標題行：
- 包含「目,值,中」的行，或
- 包含「目,鍵,欄位名稱」的行

#### 欄位排列順序

標題行之後的數據行應按以下順序排列欄位（以Excel欄位標示說明）：
- A列：**項目** - 欄位項目編號
- B列：**鍵值** - 欄位鍵值標識
- C列：**中文** - 欄位的中文名稱
- D列：**英文** - 欄位的英文名稱（這是生成Java代碼時的主要依據）
- E列：**POS** - 欄位在記錄中的起始位置
- F列：**LEN** - 欄位的長度
- G列：**性質大小** - COBOL資料類型說明（如X(10)、9(8)、S9(5)V9(2)等）
- H列：**說明** - 欄位的附加說明，特別是包含OCCURS信息

例如，Excel中的排列應該如下：

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| 項目 | 鍵值 | 中文 | 英文 | POS | LEN | 性質大小 | 說明 |
| 1 | K | 保單號碼 | POLICY-NO | 1 | 10 | X(10) | 主鍵 |
| 2 |  | 生效日期 | EFF-DATE | 11 | 8 | 9(8) | YYYYMMDD |
| 3 |  | 繳費次數 | FREQ-TIME | 19 | 2 | 9(2) | OCCURS 12 TIMES |

#### 欄位識別規則

程式會依據以下邏輯來識別CSV中的欄位：

1. **標題行識別**：
   - 程式會掃描CSV中的每一行
   - 當發現包含「目,值,中」或「目,鍵,欄位名稱」的行時，將其視為標題行
   - 從標題行的下一行開始讀取數據

2. **欄位解析**：
   - 從標題行之後的每一行，按逗號分隔提取各欄位的值
   - 各欄位的值會被映射到相應的屬性（項目、鍵值、中文、英文、POS、LEN、性質大小、說明）

> [!IMPORTANT] 
> 請確保您的CSV檔案符合上述格式要求，否則程式可能無法正確識別和處理欄位。

### 使用工具步驟

1. **啟動應用程式**
   - 雙擊已安裝的應用程式圖標啟動

2. **設定專案路徑**
   - 在「專案路徑」欄位中輸入您希望生成Java代碼的目標目錄路徑
   - 如果不填寫，程式會預設將檔案生成到桌面上的`generated-code`資料夾

3. **選擇系統類型**
   - 從下拉選單中選擇您要處理的系統類型：
     - 承保 (POLICY)
     - 理賠 (CLM)
     - 再保 (REN)

4. **上傳CSV檔案**
   - 您可以拖放一個或多個CSV檔案到應用程式視窗
   - 或者點擊區域開啟檔案選取器選擇CSV檔案

5. **日期欄位確認**
   - 當程式識別到可能的日期欄位時，會彈出確認對話框
   - 勾選您希望轉換為`LocalDateTime`類型的欄位
   - 點擊「確認」繼續處理

6. **未知欄位類型確認**
   - 當程式無法識別某些欄位的類型時，會彈出確認對話框
   - 勾選您希望保留在生成代碼中的欄位
   - 可以使用「全選」或「取消全選」按鈕快速選擇
   - 點擊「確認」繼續處理

7. **處理結果**
   - 程式會在右下方狀態區域顯示處理進度和結果
   - 處理完成後，生成的Java代碼將保存在指定路徑的相應目錄結構中

## 欄位檢測規則

本工具使用多種規則來分析和處理CSV檔案中的欄位。檢測過程基於標題行之後的數據結構：

### 日期欄位識別

程式會分析D列(英文名稱)來自動識別以下欄位作為可能的日期欄位：
- 英文名稱中包含「DATE」字串的欄位
- 英文名稱完全等於「SYS-DATE」或「SYSDATE」的欄位

識別過程中使用的程式碼片段：
```javascript
function findDateFields(results) {
    return results.filter(row => {
        const fieldNameUpper = (row['英文'] || '').trim().toUpperCase();
        return fieldNameUpper.includes('DATE') || 
               fieldNameUpper === 'SYS-DATE' || 
               fieldNameUpper === 'SYSDATE';
    });
}
```

對於被識別的日期欄位，您可以選擇是否將其轉換為Java的`LocalDateTime`類型。若選擇轉換，程式會根據欄位是否為COMP-3格式，使用適當的方法處理。

### COBOL類型識別

程式會分析G列(性質大小)來識別COBOL資料類型，支援以下類型的識別和轉換：

1. **字串類型**:
   - 格式：`X(n)`，其中n為長度
   - 轉換為Java的`String`類型

2. **數值類型**:
   - 格式：`9(n)`、`S9(n)`、`9(n)V9(m)`或`S9(n)V9(m)`
   - 根據格式不同轉換為`String`或`BigDecimal`類型
   - 如果包含小數點(V)或帶符號(S)，則轉換為`BigDecimal`
   - 如果宣告長度大於實際長度(F列中的值)，判定為COMP-3壓縮格式

COBOL類型識別的核心邏輯：
```javascript
function isValidCobolType(type, englishName) {
    // 如果是被選中的日期欄位，就視為有效類型
    if (dateFieldsSettings && dateFieldsSettings.has(englishName) && dateFieldsSettings.get(englishName)) {
        return true;
    }

    if (!type) return false;
    type = removeTrailingF(type).trim().toUpperCase();

    if (type.match(/^X\(\d+\)$/)) return true;
    if (type.match(/^(S)?9\(\d+\)(V9\(\d+\)|V9+)?$/)) return true;

    return false;
}

function getJavaType(format, length, englishName) {
    // 先檢查是否為日期欄位
    if (dateFieldsSettings && dateFieldsSettings.has(englishName) && dateFieldsSettings.get(englishName)) {
        return 'LocalDateTime';
    }

    // 如果不是日期欄位，且格式為空，設置預設格式
    if (!format) {
        format = `X(${length})`;
    }

    format = removeTrailingF(format).trim().toUpperCase();

    if (format.startsWith('X')) return 'String';

    if (format.match(/^(S)?9/) || format.includes('V')) {
        if (format.includes('V')) return 'BigDecimal';
        if (format.startsWith('S')) return 'BigDecimal';
        
        const match = format.match(/^9\((\d+)\)$/);
        if (match) {
            const declaredLength = parseInt(match[1]);
            const actualLength = parseInt(length);
            return declaredLength > actualLength ? 'BigDecimal' : 'String';
        }
        
        return 'BigDecimal';
    }

    return 'String';
}
```

### OCCURS欄位處理

程式可以自動識別和處理COBOL中的OCCURS結構，分析過程主要針對H列(說明)：
- 識別「說明」欄位中包含`OCCURS n`模式的欄位
- 自動創建n個副本的欄位，每個副本根據其位置調整POS值(E列)
- 為每個副本添加序號以區分(如: FIELD-NAME1, FIELD-NAME2等)

OCCURS識別與處理的核心邏輯：
```javascript
function detectOccurs(description) {
    if (!description) return null;
    const match = description.match(/OCCURS\s+(\d+)/i);
    return match ? parseInt(match[1]) : null;
}

function identifyOccursGroup(rows) {
    const groups = [];
    let skipToIndex = -1;

    for (let i = 0; i < rows.length; i++) {
        if (i <= skipToIndex) continue;

        const row = rows[i];
        const occursCount = detectOccurs(row['說明']);
        
        if (occursCount) {
            // 找到OCCURS欄位，處理分組並生成多個副本欄位
            // ...
        }
    }
    return groups;
}
```

### 未知類型欄位

如果欄位的G列(性質大小)無法被識別為有效的COBOL類型，程式會：
- 顯示對話框列出所有無法識別的欄位
- 允許用戶選擇要保留哪些欄位
- 被保留的欄位會根據最佳判斷轉換為適當的Java類型

未知欄位識別的處理過程：
```javascript
const unknownFields = rawResults.filter(row => !isValidCobolType(row['性質大小'], row['英文']));
console.log(`找到的未知類型欄位 (${file.name}):`, unknownFields);

if (unknownFields.length > 0) {
    const selectedFields = await handleUnknownFields(unknownFields);
    console.log(`選擇保留的未知類型欄位 (${file.name}):`, selectedFields);
    
    if (selectedFields && selectedFields.length >= 0) {
        filteredResults = rawResults.filter(row => {
            const isDateField = dateFieldsSettings.has(row.英文) && dateFieldsSettings.get(row.英文);
            if (isDateField) return true;
            
            const isValid = isValidCobolType(row['性質大小']);
            const isSelected = selectedFields.some(field => 
                field.英文 === row.英文 && field.中文 === row.中文
            );
            return isValid || isSelected;
        });
    }
}
```

## 生成的Java代碼架構

程式會為每個CSV檔案生成以下Java代碼文件：

1. **Entity類**
   - 路徑：`{專案路徑}/impl/src/main/java/tw/com/softleader/jasmine/fir/trans/{系統類型}/repository/entity/`
   - 命名：`{檔名}Entity.java`
   - 功能：定義JPA實體，對應資料庫表結構

2. **SaveCmd類**
   - 路徑：`{專案路徑}/impl/src/main/java/tw/com/softleader/jasmine/fir/trans/{系統類型}/saveCmd/`
   - 命名：`{檔名}SaveCmd.java`
   - 功能：用於資料儲存的數據傳輸對象

3. **TransService類**
   - 路徑：`{專案路徑}/impl/src/main/java/tw/com/softleader/jasmine/fir/trans/{系統類型}/service/trans/`
   - 命名：`{檔名}TransService.java`
   - 功能：負責從檔案讀取資料並轉換為Java對象

4. **SaveService類**
   - 路徑：`{專案路徑}/impl/src/main/java/tw/com/softleader/jasmine/fir/trans/{系統類型}/service/save/`
   - 命名：`{檔名}SaveService.java`
   - 功能：負責將資料儲存到資料庫

5. **Repository類**
   - 路徑：`{專案路徑}/impl/src/main/java/tw/com/softleader/jasmine/fir/trans/{系統類型}/repository/`
   - 命名：`{檔名}Repository.java`
   - 功能：提供數據訪問接口

此外，程式還會更新相應的`Mapper`類，添加必要的方法以支援資料轉換。

## 常見問題

1. **為什麼我的欄位沒有被正確識別？**
   - 確保您的CSV檔案格式正確，且包含所有必需的欄位
   - 檢查「性質大小」欄位的格式是否符合COBOL類型規範
   - 確認您的CSV檔案有正確的標題行（包含「目,值,中」或「目,鍵,欄位名稱」）
   - 檢查欄位順序是否正確（項目、鍵值、中文、英文、POS、LEN、性質大小、說明）

2. **我的Excel格式轉換後CSV欄位位置不對怎麼辦？**
   - 確保Excel中的欄位順序符合程式所需：A列(項目)、B列(鍵值)、C列(中文)等
   - 如果您的Excel有合併儲存格或複雜格式，請先整理成標準表格再轉換
   - 可以在轉換後用文字編輯器查看CSV檔案，確認欄位被正確地以逗號分隔

2. **如何判斷哪些日期欄位需要轉換為LocalDateTime？**
   - 通常情況下，實際代表日期的欄位應該轉換
   - 某些僅在名稱上包含「DATE」但實際存儲的是代碼或其他值的欄位可能不需要轉換

3. **為什麼生成的代碼中某些欄位沒有包含？**
   - 檢查是否有欄位被識別為「未知類型」，並且您在對話框中沒有選擇保留它們
   - 確保CSV中的欄位數據完整，包含POS、LEN等必要信息

## 開發指南

### 環境設置

```bash
# 安裝依賴
pnpm install

# 啟動應用程式
pnpm start

# 打包應用程式
pnpm build        # 依據當前平台打包
pnpm build:all    # 同時打包Windows和Mac版本
pnpm build:win    # 僅打包Windows版本
pnpm build:mac    # 僅打包Mac版本
```

## 授權

Tom.Tang
