// 基本引入和設定
const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const iconv = require('iconv-lite');

// DOM 元素
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const status = document.getElementById('status');
const loading = document.getElementById('loading');

// 日期欄位處理相關變數
let dateFieldsResolve = null;
let unknownFieldsResolve = null;
let currentFileName = '';  // 追蹤當前處理的檔案名稱
let processingFiles = false; // 追蹤是否正在處理檔案

// 初始化日期欄位設定
let dateFieldsSettings = new Map();
let statusMessages = [];

// 設定允許多檔案選擇
fileInput.setAttribute('multiple', 'true');

// 根據系統類型獲取包路徑的函數
function getSystemTypeInfo() {
    const systemType = document.getElementById('systemType').value;
    
    // 定義各系統類型的相關資訊
    const systemTypeMap = {
        'ren': {
            packageSuffix: 'ren',
            tableSuffix: 'REN',
            fullTablePrefix: 'TRANS_REN_',
            sequencePrefix: 'sequenceRen'
        },
        'clm': {
            packageSuffix: 'clm',
            tableSuffix: 'CLM',
            fullTablePrefix: 'TRANS_CLM_',
            sequencePrefix: 'sequenceClm'
        },
        'policy': {
            packageSuffix: 'policy',
            tableSuffix: 'POLICY',
            fullTablePrefix: 'TRANS_',
            sequencePrefix: 'sequence' // 承保系統不需要前綴
        }
    };
    
    return systemTypeMap[systemType] || systemTypeMap['ren']; // 預設為再保
}

// 將 tableSuffix 轉換為駝峰式命名（首字母大寫，其餘小寫）
function getCamelCaseMapperPrefix(tableSuffix) {
    return 'Trans' + tableSuffix.charAt(0).toUpperCase() + 
           tableSuffix.slice(1).toLowerCase();
}

// UI 事件處理
dropZone.addEventListener('click', () => {
    if (!processingFiles) {
        fileInput.click();
    }
});

// 處理檔案選擇事件
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleMultipleFiles(Array.from(e.target.files));
    }
});

// 防止檔案被瀏覽器開啟
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

// 拖放區域處理
dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!processingFiles) {
        dropZone.classList.add('dragover');
    }
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!processingFiles) {
        dropZone.classList.add('dragover');
    }
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
    
    if (!processingFiles && e.dataTransfer.files.length) {
        handleMultipleFiles(Array.from(e.dataTransfer.files));
    }
});

// DOM 載入完成後的初始化
document.addEventListener('DOMContentLoaded', () => {
    // 日期欄位對話框按鈕
    document.getElementById('dateFieldsConfirm')?.addEventListener('click', () => {
        handleDateFieldsAction('confirm');
    });
    document.getElementById('dateFieldsCancel')?.addEventListener('click', () => {
        handleDateFieldsAction('cancel');
    });

    // 未知欄位對話框按鈕
    document.getElementById('unknownFieldsConfirm')?.addEventListener('click', () => {
        handleUnknownFieldsAction('confirm');
    });
    document.getElementById('unknownFieldsCancel')?.addEventListener('click', () => {
        handleUnknownFieldsAction('cancel');
    });

    // 全選/取消全選按鈕
    document.getElementById('selectAllUnknownFields')?.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('#unknownFieldsList input[type="checkbox"]');
        checkboxes.forEach(checkbox => checkbox.checked = true);
    });

    document.getElementById('deselectAllUnknownFields')?.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('#unknownFieldsList input[type="checkbox"]');
        checkboxes.forEach(checkbox => checkbox.checked = false);
    });
});

// 處理日期欄位對話框動作
function handleDateFieldsAction(action) {
    const dialog = document.getElementById('dateFieldsDialog');
    
    if (action === 'cancel') {
        dialog.style.display = 'none';
        dateFieldsSettings = new Map();
        if (dateFieldsResolve) {
            dateFieldsResolve(dateFieldsSettings);
            dateFieldsResolve = null;
        }
    } else {
        // 收集勾選的欄位
        const settings = new Map();
        Array.from(document.querySelectorAll('.date-field-item')).forEach((item) => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            const content = item.querySelector('.field-content').textContent;
            const match = content.match(/\((.*?)\)/);
            const englishName = match ? match[1] : '';
            
            if (checkbox && checkbox.checked) {
                settings.set(englishName, true);
            } else {
                settings.set(englishName, false);
            }
        });

        dialog.style.display = 'none';
        dateFieldsSettings = settings;
        if (dateFieldsResolve) {
            dateFieldsResolve(settings);
            dateFieldsResolve = null;
        }
    }
}

// 處理未知欄位對話框動作
function handleUnknownFieldsAction(action) {
    const dialog = document.getElementById('unknownFieldsDialog');
    
    if (action === 'cancel') {
        dialog.style.display = 'none';
        if (unknownFieldsResolve) {
            unknownFieldsResolve([]);
            unknownFieldsResolve = null;
        }
    } else {
        const selectedFields = [];
        const fields = Array.from(document.querySelectorAll('.unknown-field-item')).map((item) => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            return { checkbox, field: item.dataset.field };
        });

        fields.forEach(({ checkbox, field }) => {
            if (checkbox && checkbox.checked) {
                selectedFields.push(JSON.parse(field));
            }
        });

        dialog.style.display = 'none';
        if (unknownFieldsResolve) {
            unknownFieldsResolve(selectedFields);
            unknownFieldsResolve = null;
        }
    }
}

// UI 相關函數
function showLoading(show) {
    loading.style.display = show ? 'block' : 'none';
    processingFiles = show;
    dropZone.style.pointerEvents = show ? 'none' : 'auto';
}

function showStatus(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    statusMessages.push({ message, type, timestamp });
    
    if (statusMessages.length > 10) {
        statusMessages.shift();
    }
    
    status.innerHTML = statusMessages.map(msg => 
        `<div class="status-message ${msg.type}">
            <span class="timestamp">[${msg.timestamp}]</span>
            ${msg.message.replace(/\n/g, '<br>')}
         </div>`
    ).join('');

    // 自動滾動到最新消息
    status.scrollTop = status.scrollHeight;
}

// 重置狀態函數
function resetFileState() {
    // 只重置與當前檔案相關的狀態
    dateFieldsSettings = new Map();
    dateFieldsResolve = null;
    unknownFieldsResolve = null;
    
    const dateDialog = document.getElementById('dateFieldsDialog');
    if (dateDialog) {
        dateDialog.style.display = 'none';
    }
    
    const unknownDialog = document.getElementById('unknownFieldsDialog');
    if (unknownDialog) {
        unknownDialog.style.display = 'none';
    }
    
    const listContainer = document.getElementById('unknownFieldsList');
    if (listContainer) {
        listContainer.innerHTML = '';
    }

    const dateListContainer = document.getElementById('dateFieldsList');
    if (dateListContainer) {
        dateListContainer.innerHTML = '';
    }
}

function resetAllState() {
    statusMessages = [];
    status.innerHTML = '';
    preview.innerHTML = '';
    resetFileState();
    
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.value = '';
    }
}

// 找出所有日期相關欄位
function findDateFields(results) {
    return results.filter(row => {
        const fieldNameUpper = (row['英文'] || '').trim().toUpperCase();
        return fieldNameUpper.includes('DATE') || 
               fieldNameUpper === 'SYS-DATE' || 
               fieldNameUpper === 'SYSDATE';
    });
}

// 處理日期欄位選擇
// 修改 handleDateFields 函數中的項目生成部分
function handleDateFields(dateFields) {
    return new Promise((resolve) => {
        const dialog = document.getElementById('dateFieldsDialog');
        const listContainer = document.getElementById('dateFieldsList');
        const dialogTitle = document.getElementById('dateFieldsDialogTitle');
        
        if (!dialog || !listContainer) {
            console.error('找不到日期欄位對話框元素');
            resolve(new Map());
            return;
        }

        dialogTitle.textContent = `日期欄位確認 - ${currentFileName}`;
        
        listContainer.innerHTML = '';
        dateFields.forEach((field, index) => {
            const item = document.createElement('div');
            item.className = 'date-field-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `date-field-${index}`;
            checkbox.checked = dateFieldsSettings.get(field.英文) || false;
            
            const content = document.createElement('div');
            content.className = 'field-content';
            content.textContent = `${field.中文} (${field.英文}) | 長度: ${field.LEN || '無'} | 性質大小: ${field.性質大小 || '無'} ${field.說明 ? `| 說明: ${field.說明}` : ''}`;
            
            item.appendChild(checkbox);
            item.appendChild(content);
            
            // 為整個行添加點擊事件
            item.addEventListener('click', (e) => {
                // 如果點擊的是 checkbox 本身，不需要做任何事情（讓 checkbox 自己處理狀態）
                if (e.target === checkbox) {
                    return;
                }
                // 如果點擊的是其他區域，切換 checkbox 的狀態
                checkbox.checked = !checkbox.checked;
            });
            
            listContainer.appendChild(item);
        });

        dateFieldsResolve = resolve;
        dialog.style.display = 'block';
    });
}

// 相似地修改 handleUnknownFields 函數
function handleUnknownFields(unknownFields) {
    return new Promise((resolve) => {
        const dialog = document.getElementById('unknownFieldsDialog');
        const listContainer = document.getElementById('unknownFieldsList');
        const dialogTitle = document.getElementById('unknownFieldsDialogTitle');
        
        if (!dialog || !listContainer) {
            console.error('Dialog elements not found');
            resolve([]);
            return;
        }

        dialogTitle.textContent = `未知欄位類型確認 - ${currentFileName}`;
        
        listContainer.innerHTML = '';
        unknownFields.forEach((field, index) => {
            const item = document.createElement('div');
            item.className = 'unknown-field-item';
            item.dataset.field = JSON.stringify(field);
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `field-${index}`;
            checkbox.checked = true; // 預設勾選
            
            const content = document.createElement('div');
            content.className = 'field-content';
            content.textContent = `${field.中文} (${field.英文}) | 長度: ${field.LEN || '無'} | 性質大小: ${field.性質大小 || '無'} ${field.說明 ? `| 說明: ${field.說明}` : ''}`;
            
            item.appendChild(checkbox);
            item.appendChild(content);
            
            // 為整個行添加點擊事件
            item.addEventListener('click', (e) => {
                // 如果點擊的是 checkbox 本身，不需要做任何事情
                if (e.target === checkbox) {
                    return;
                }
                // 如果點擊的是其他區域，切換 checkbox 的狀態
                checkbox.checked = !checkbox.checked;
            });
            
            listContainer.appendChild(item);
        });

        unknownFieldsResolve = resolve;
        dialog.style.display = 'block';
    });
}

// 多檔案處理函數
async function handleMultipleFiles(files) {
    resetAllState();
    showLoading(true);
    
    try {
        for (const file of files) {
            currentFileName = file.name;
            resetFileState();
            
            showStatus(`開始處理檔案: ${file.name}`, 'info');
            
            const rawResults = await parseCSV(file);
            console.log(`解析完成的原始資料 (${file.name}):`, rawResults);
            
            const dateFields = findDateFields(rawResults);
            console.log(`找到的日期欄位 (${file.name}):`, dateFields);
            
            if (dateFields.length > 0) {
                dateFieldsSettings = await handleDateFields(dateFields);
                console.log(`日期欄位設定 (${file.name}):`, dateFieldsSettings);
            } else {
                dateFieldsSettings = new Map();
            }

            const unknownFields = rawResults.filter(row => !isValidCobolType(row['性質大小'], row['英文']));
            console.log(`找到的未知類型欄位 (${file.name}):`, unknownFields);
            
            let filteredResults = rawResults;
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

            await generateAndSaveJavaCode(filteredResults, file);
            showStatus(`檔案 ${file.name} 處理完成`, 'success');
        }
    } catch (error) {
        console.error('處理檔案時發生錯誤:', error);
        showStatus(`處理檔案時發生錯誤：${error.message}`, 'error');
        await ipcRenderer.invoke('show-error', error.message);
    } finally {
        showLoading(false);
    }
}

// CSV 檔案解析
async function parseCSV(file) {
    return new Promise(async (resolve, reject) => {
        try {showStatus(`開始解析 CSV 檔案：${file.name}`, 'info');
        const buffer = fs.readFileSync(file.path);
        let fileContent = iconv.decode(buffer, 'utf8');
        
        const lines = fileContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        showStatus("正在尋找標題行...", 'info');
        const headerIndex = lines.findIndex(line => 
            line.includes('目,值,中') || 
            line.includes('目,鍵,欄位名稱')
        );

        if (headerIndex === -1) {
            throw new Error('找不到標題行');
        }

        const results = [];

        for (let i = headerIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            const cols = line.split(',').map(col => col.trim());
            
            if (!cols[3] || !cols[4] || !cols[5]) continue;

            const row = {
                '項目': cols[0] || '',
                '鍵值': cols[1] || '',
                '中文': cols[2] || '',
                '英文': cols[3] || '',
                'POS': cols[4] || '',
                'LEN': cols[5] || '',
                '性質大小': cols[6] || '',
                '說明': cols[7] || ''
            };

            row['LEN'] = String(getActualLength(row['LEN']));
            results.push(row);
        }

        const occursGroups = identifyOccursGroup(results);
        const finalResults = [];
        
        let skipToIndex = -1;
        for (let i = 0; i < results.length; i++) {
            if (i <= skipToIndex) continue;

            const row = results[i];
            const occursCount = detectOccurs(row['說明']);
            
            if (occursCount) {
                const group = occursGroups.find(g => 
                    g.originalFields[0]['POS'] === row['POS'] && 
                    g.originalFields[0]['英文'] === row['英文']
                );

                if (group) {
                    finalResults.push(...group.expandedFields);
                    skipToIndex = i + group.originalFields.length - 1;
                }
            } else {
                finalResults.push(row);
            }
        }

        showStatus(`處理完成: 總處理欄位數: ${finalResults.length}`, 'success');
        resolve(finalResults);

    } catch (error) {
        console.error('解析 CSV 時發生錯誤:', error);
        showStatus(`解析錯誤：${error.message}`, 'error');
        reject(error);
    }
});
}

// OCCURS 相關函數
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
        const groupFields = [];
        let j = i;
        
        while (j < rows.length) {
            const nextRow = rows[j];
            const nextOccursCount = detectOccurs(nextRow['說明']);
            
            if (j === i || nextOccursCount === occursCount) {
                groupFields.push(nextRow);
                j++;
            } else {
                break;
            }
        }
        
        if (groupFields.length > 0) {
            const firstPos = parseInt(groupFields[0]['POS']);
            const lastField = groupFields[groupFields.length - 1];
            const lastPos = parseInt(lastField['POS']);
            const lastLen = parseInt(lastField['LEN']);
            const totalLength = (lastPos - firstPos) + lastLen;

            const expandedFields = [];
            
            for (let count = 1; count <= occursCount; count++) {
                groupFields.forEach((field) => {
                    const originalPos = parseInt(field['POS']);
                    const posOffset = (count - 1) * totalLength;
                    const newPos = originalPos + posOffset;

                    const newField = {
                        ...field,
                        '中文': `${field['中文']}${count}`,
                        '英文': `${field['英文']}${count}`,
                        'POS': String(newPos),
                        '說明': `${field['說明'].replace(/OCCURS \d+ TIMES/, '')} (${count}/${occursCount})`
                    };
                    expandedFields.push(newField);
                });
            }

            groups.push({
                occursCount: occursCount,
                originalFields: groupFields,
                expandedFields: expandedFields,
                startPos: firstPos,
                totalLength: totalLength
            });
            
            skipToIndex = j - 1;
        }
    }
}

return groups;
}

// 欄位類型和格式相關函數
function isComp3Field(length, cobolType) {
if (!cobolType || !length) return false;

cobolType = cobolType.trim().toUpperCase();
const actualLength = parseInt(length);
let totalDigits = 0;

const s9Match = cobolType.match(/^(S)?9\((\d+)\)V9\((\d+)\)$/);
if (s9Match) {
    totalDigits = parseInt(s9Match[2]) + parseInt(s9Match[3]);
    return totalDigits > actualLength;
}

const s9v99Match = cobolType.match(/^(S)?9\((\d+)\)V9+$/);
if (s9v99Match) {
    const afterV = cobolType.split('V')[1];
    totalDigits = parseInt(s9v99Match[2]) + afterV.length;
    return totalDigits > actualLength;
}

const pureMatch = cobolType.match(/^(S)?9\((\d+)\)$/);
if (pureMatch) {
    totalDigits = parseInt(pureMatch[2]);
    return totalDigits > actualLength;
}

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

// 處理欄位長度
function getActualLength(lenStr) {
if (!lenStr) return 0;
const parts = lenStr.split('*');
return parseInt(parts[0]) || 0;
}

function getPrecisionAndScale(format) {
if (!format) return null;
format = format.trim().toUpperCase();

const match = format.match(/^(S)?9\((\d+)\)(V9\((\d+)\)|V9+)?$/);
if (match) {
    const integerLength = parseInt(match[2]);
    let decimalLength = 0;
    
    if (match[3]) {
        if (match[4]) {
            decimalLength = parseInt(match[4]);
        } else {
            decimalLength = (match[3].match(/9/g) || []).length;
        }
    }
    
    return {
        precision: integerLength + decimalLength,
        scale: decimalLength
    };
}

return null;
}

// 名稱格式化函數
function formatFieldName(englishName) {
if (!englishName) return '';
const words = englishName.trim().split(/[-_\s]+/);
return words[0].toLowerCase() + 
       words.slice(1)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
}

function formatColumnName(englishName) {
if (!englishName) return '';
return englishName.trim().replace(/-/g, '_').toUpperCase();
}

function formatColumnDefinition(field) {
const columnName = formatColumnName(field.englishName);

if (field.type === 'String' && field.cobolType) {
    const lengthMatch = field.cobolType.match(/X\((\d+)\)/i);
    if (lengthMatch) {
        const length = parseInt(lengthMatch[1]);
        if (length > 255) {
            return `@Column(name = "${columnName}", length = ${length})`;
        }
    }
}

if (field.type === 'BigDecimal') {
    const precisionInfo = getPrecisionAndScale(field.cobolType);
    if (precisionInfo) {
        return `@Column(name = "${columnName}", precision = ${precisionInfo.precision}, scale = ${precisionInfo.scale})`;
    }
}

return `@Column(name = "${columnName}")`;
}

function getTableName(originalFileName) {
const endIndex = originalFileName.search(/[._-]/);
const baseFileName = endIndex !== -1 ? originalFileName.substring(0, endIndex) : originalFileName;
return baseFileName.toUpperCase();
}

function generateJavaDoc(field) {
    return `/** ${field.originalName} (${field.englishName}) POS: ${field.number} LEN: ${field.length} 性質大小: ${removeTrailingF(field.cobolType) || ''} */`;
}

// COBOL 相關處理函數
function removeTrailingF(type) {
    if (!type) return '';
    return type.replace(/F$/i, '').trim();
}
function standardizeCobolFormat(cobolType) {
    if (!cobolType) return '';
    cobolType = removeTrailingF(cobolType).trim().toUpperCase();
    return cobolType.replace(/S?9\((\d+)\)/g, (match, number) => {
        return '9'.repeat(parseInt(number));
    });
}

function generateSetterCode(field) {
const fieldNumber = parseInt(field.number) - 1;
const fieldLength = parseInt(field.length);
const cobolType = field.cobolType ? field.cobolType.trim().toUpperCase() : '';
const englishName = field.englishName.trim();

if (dateFieldsSettings.has(englishName) && dateFieldsSettings.get(englishName)) {
    let declaredLength = 0;
    if (cobolType.startsWith('9')) {
        const match = cobolType.match(/9\((\d+)\)/);
        if (match) {
            declaredLength = parseInt(match[1]);
        }
    }

    if (declaredLength > fieldLength) {
        return `convertToLocalDateTimeWithComp3(StringUtil.getBytes(data, index + ${fieldNumber}, ${fieldLength}))`;
    }
    return `convertToLocalDateTime(StringUtil.getString(data, index + ${fieldNumber}, ${fieldLength}))`;
}

if (getJavaType(field.cobolType, field.length, field.englishName) === 'String') {
    return `removeFullWidthSpace(StringUtil.getString(data, index + ${fieldNumber}, ${fieldLength}))`;
}

if (cobolType.match(/^(S)?9/) || cobolType.includes('V')) {
    const standardizedFormat = standardizeCobolFormat(cobolType);
    let totalDigits = 0;
    let scale = 0;
    
    if (standardizedFormat.includes('V')) {
        const parts = standardizedFormat.split('V');
        totalDigits = parts[0].length + parts[1].length;
        scale = parts[1].length;
    } else {
        totalDigits = standardizedFormat.replace(/[^9]/g, '').length;
    }
    
    const isComp3 = totalDigits > fieldLength;
    
    if (isComp3) {
        return `convertToBigDecimalWithComp3(data, index + ${fieldNumber}, ${fieldLength}, ${scale})`;
    } else {
        return `convertToBigDecimal(data, index + ${fieldNumber}, ${fieldLength}, ${scale})`;
    }
}

return `removeFullWidthSpace(StringUtil.getString(data, index + ${fieldNumber}, ${fieldLength}))`;
}

// Java 代碼生成相關函數
async function generateAndSaveJavaCode(filteredResults, file) {
    let fileName = 'Unknown';
    if (filteredResults && filteredResults.length > 0) {
        const firstRow = filteredResults.find(row => row['英文'] && row['英文'].includes('-'));
        if (firstRow) {
            fileName = firstRow['英文'].split('-')[0].toLowerCase();
        }
    }

    const className = fileName.charAt(0).toUpperCase() + fileName.slice(1).toLowerCase();
    const systemInfo = getSystemTypeInfo();
    const generatedCode = generateJavaCode(fileName, filteredResults, file.name, systemInfo);
    
    const basePath = document.getElementById('projectPath').value || 
                    path.join(require('os').homedir(), 'Desktop', 'generated-code');

    const javaBasePath = path.join(basePath, 'impl', 'src', 'main', 'java', 'tw', 'com', 'softleader', 'jasmine', 'fir', 'trans', systemInfo.packageSuffix);
    
    const paths = {
        entity: path.join(javaBasePath, 'repository', 'entity'),
        saveCmd: path.join(javaBasePath, 'saveCmd'),
        serviceTrans: path.join(javaBasePath, 'service', 'trans'),
        serviceSave: path.join(javaBasePath, 'service', 'save'),
        serviceMapper: path.join(javaBasePath, 'service', 'mapper'),
        repository: path.join(javaBasePath, 'repository')
    };

    const files = {};

    if (generatedCode[`repository/entity/${className}Entity.java`]) {
        files[path.join(paths.entity, `${className}Entity.java`)] = 
            generatedCode[`repository/entity/${className}Entity.java`];
    }

    if (generatedCode[`saveCmd/${className}SaveCmd.java`]) {
        files[path.join(paths.saveCmd, `${className}SaveCmd.java`)] = 
            generatedCode[`saveCmd/${className}SaveCmd.java`];
    }

    if (generatedCode[`service/trans/${className}TransService.java`]) {
        files[path.join(paths.serviceTrans, `${className}TransService.java`)] = 
            generatedCode[`service/trans/${className}TransService.java`];
    }

    if (generatedCode[`service/save/${className}SaveService.java`]) {
        files[path.join(paths.serviceSave, `${className}SaveService.java`)] = 
            generatedCode[`service/save/${className}SaveService.java`];
    }

    const repositoryCode = generateRepositoryCode(className, systemInfo);
    if (repositoryCode) {
        files[path.join(paths.repository, `${className}Repository.java`)] = repositoryCode;
    }

    // 使用駝峰式命名的 Mapper 名稱
    const mapperPrefix = getCamelCaseMapperPrefix(systemInfo.tableSuffix);
    const mapperPath = path.join(paths.serviceMapper, `${mapperPrefix}VoMapper.java`);
    
    if (fs.existsSync(mapperPath)) {
        let mapperContent = fs.readFileSync(mapperPath, 'utf8');
        
        const methodSignature = `to${className}Entities(List<${className}SaveCmd>`;
        if (!mapperContent.includes(methodSignature)) {
            const lastBraceIndex = mapperContent.lastIndexOf('}');
            if (lastBraceIndex !== -1) {
                const newMethod = `\n    /** saveCmds to entities */\n    List<${className}Entity> to${className}Entities(List<${className}SaveCmd> cmd);\n\n`;
                mapperContent = 
                    mapperContent.slice(0, lastBraceIndex) + 
                    newMethod + 
                    mapperContent.slice(lastBraceIndex);
                
                files[mapperPath] = mapperContent;
            }
        }
    }

    const result = await ipcRenderer.invoke('save-files', { files });
    
    if (result.success) {
        showStatus(`${file.name} 的 Java 檔案已成功儲存`, 'success');
    } else {
        throw new Error(result.message);
    }
}

function generateJavaCode(fileName, data, originalFileName, systemInfo) {
    console.log("\n=== 生成 Java 代碼 ===");
    
    if (fileName === 'Unknown' && data && data.length > 0) {
        const firstRow = data.find(row => row['英文'] && row['英文'].includes('-'));
        if (firstRow) {
            fileName = firstRow['英文'].split('-')[0].toLowerCase();
        }
    }

    const className = fileName.charAt(0).toUpperCase() + fileName.slice(1).toLowerCase();
    console.log(`類名: ${className}`);

    const validFields = data
        .filter(row => row['英文'])
        .map(row => ({
            number: row['POS']?.trim() || '0',
            name: formatFieldName(row['英文']),
            length: row['LEN']?.trim() || '0',
            originalName: row['中文']?.trim(),
            englishName: row['英文']?.trim(),
            type: getJavaType(row['性質大小'], row['LEN'], row['英文']),
            cobolType: row['性質大小']?.trim() || `X(${row['LEN']})`,
            isComp3: isComp3Field(row['LEN'], row['性質大小']),
            description: row['說明']?.trim() || ''
        }))
        .filter(field => {
            const isValid = field.name && 
                          field.englishName && 
                          parseInt(field.length) > 0 && 
                          parseInt(field.number) >= 0;
            if (!isValid) {
                console.warn(`無效欄位: ${field.englishName}`);
            }
            return isValid;
        });

    if (validFields.length === 0) {
        throw new Error('沒有找到有效的欄位定義');
    }

    return {
        [`repository/entity/${className}Entity.java`]: generateEntityClass(className, validFields, originalFileName, systemInfo),
        [`saveCmd/${className}SaveCmd.java`]: generateSaveCmdClass(className, validFields, systemInfo),
        [`service/trans/${className}TransService.java`]: generateTransformerClass(className, validFields, originalFileName, systemInfo),
        [`service/save/${className}SaveService.java`]: generateSaveServiceClass(className, systemInfo)
    };
}

// Java 類生成函數
function generateEntityClass(fileName, fields, originalFileName, systemInfo) {
    const tableName = getTableName(originalFileName);
    
    return `package tw.com.softleader.jasmine.fir.trans.${systemInfo.packageSuffix}.repository.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;
import tw.com.softleader.jasmine.jpa.entity.JasmineAuditingEntity;
import tw.com.softleader.kapok.data.jpa.Comment;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/** ${fileName} Entity */
@Getter
@Setter
@Entity
@ToString
@Table(name = "${systemInfo.fullTablePrefix}${tableName}")
public class ${fileName}Entity extends JasmineAuditingEntity<String> {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "${systemInfo.sequencePrefix}${fileName}")
    @SequenceGenerator(name = "${systemInfo.sequencePrefix}${fileName}", sequenceName = "SEQ_TRANS_${systemInfo.tableSuffix}_${fileName.toUpperCase()}", allocationSize = 1000)
    @Column(name = "ID", updatable = false)
    private Long id;

    ${fields.map(field => `
    /** ${field.originalName} (${field.englishName}) POS: ${field.number} LEN: ${field.length} 性質大小: ${removeTrailingF(field.cobolType) || ''} */
    ${formatColumnDefinition(field)}
    @Comment("${field.originalName} (${field.englishName}) POS: ${field.number} LEN: ${field.length} 性質大小: ${removeTrailingF(field.cobolType) || ''}")
    private ${field.type} ${formatFieldName(field.englishName)};`).join('\n')}
}`;
}

function generateSaveCmdClass(className, fields, systemInfo) {
    return `package tw.com.softleader.jasmine.fir.trans.${systemInfo.packageSuffix}.saveCmd;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.experimental.SuperBuilder;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@SuperBuilder(toBuilder = true)
@EqualsAndHashCode(callSuper = false)
public class ${className}SaveCmd {
    ${fields.map(field => `
    /** ${field.originalName} (${field.englishName}) POS: ${field.number} LEN: ${field.length} 性質大小: ${removeTrailingF(field.cobolType) || ''} */
    private ${field.type} ${field.name};`).join('\n')}
}`;
}

function generateSaveServiceClass(className, systemInfo) {
    // 使用駝峰式命名的 Mapper 前綴
    const mapperPrefix = getCamelCaseMapperPrefix(systemInfo.tableSuffix);
    
    return `package tw.com.softleader.jasmine.fir.trans.${systemInfo.packageSuffix}.service.save;

import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tw.com.softleader.jasmine.fir.trans.${systemInfo.packageSuffix}.repository.${className}Repository;
import tw.com.softleader.jasmine.fir.trans.${systemInfo.packageSuffix}.saveCmd.${className}SaveCmd;
import tw.com.softleader.jasmine.fir.trans.${systemInfo.packageSuffix}.service.mapper.${mapperPrefix}VoMapper;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class ${className}SaveService {

    private final ${mapperPrefix}VoMapper mapper;
    private final ${className}Repository repository;

    @Transactional
    public void save(List<${className}SaveCmd> dataList) {
        repository.saveAll((mapper.to${className}Entities(dataList)));
    }
}`;
}

function generateRepositoryCode(className, systemInfo) {
    return `package tw.com.softleader.jasmine.fir.trans.${systemInfo.packageSuffix}.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import tw.com.softleader.data.jpa.spec.starter.repository.QueryBySpecExecutor;
import tw.com.softleader.jasmine.fir.trans.${systemInfo.packageSuffix}.repository.entity.${className}Entity;

public interface ${className}Repository
    extends JpaRepository<${className}Entity, Long>, QueryBySpecExecutor<${className}Entity> {}`;
}

function generateTransformerClass(className, fields, originalFileName, systemInfo) {
    const tableName = getTableName(originalFileName);
    // 使用駝峰式命名的 Mapper 前綴
    const mapperPrefix = getCamelCaseMapperPrefix(systemInfo.tableSuffix);
    
    return `package tw.com.softleader.jasmine.fir.trans.${systemInfo.packageSuffix}.service.trans;

import static tw.com.softleader.jasmine.fir.trans.ImportJobUtils.convertToBigDecimal;
import static tw.com.softleader.jasmine.fir.trans.ImportJobUtils.convertToBigDecimalWithComp3;
import static tw.com.softleader.jasmine.fir.trans.ImportJobUtils.convertToLocalDateTime;
import static tw.com.softleader.jasmine.fir.trans.ImportJobUtils.removeFullWidthSpace;
import static tw.com.softleader.jasmine.fir.trans.ImportJobUtils.convertToLocalDateTimeWithComp3;

import com.google.common.collect.Lists;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tw.com.softleader.jasmine.fir.trans.StreamLineIterator;
import tw.com.softleader.jasmine.fir.trans.StringUtil;
import tw.com.softleader.jasmine.fir.trans.${systemInfo.packageSuffix}.saveCmd.${className}SaveCmd;
import tw.com.softleader.jasmine.fir.trans.common.saveCmd.TransErrorRecordSaveCmd;
import tw.com.softleader.jasmine.fir.trans.common.service.TransErrorRecordService;
import tw.com.softleader.jasmine.fir.trans.common.service.TransService;
import tw.com.softleader.jasmine.fir.trans.${systemInfo.packageSuffix}.service.save.${className}SaveService;

@Slf4j
@Service
@RequiredArgsConstructor
public class ${className}TransService implements TransService<${className}SaveCmd> {

    private final TransErrorRecordService errorService;
    private final ${className}SaveService saveService;

    /** 用於讀取 ${className} 檔案 */
    public void transData(
      File files,
      Integer startLine,
      Integer endLine,
      Integer batchSize,
      List<TransErrorRecordSaveCmd> errorList) {
        List<${className}SaveCmd> dataList = Lists.newArrayList();

        try (FileInputStream fs = new FileInputStream(files)) {
            int index = 0;
            StreamLineIterator lineIt = new StreamLineIterator(fs);
            byte[] data;

            int currentLine = 1;
            
            while (currentLine < startLine && lineIt.hasNext()) {
              lineIt.next();
              currentLine++;
            }
            
            while (lineIt.hasNext() && currentLine <= endLine) {
                ${className}SaveCmd model = new ${className}SaveCmd();
                data = lineIt.next();

                try {
                    ${fields.map(field => {
                        const fieldNameCamelCase = field.name.charAt(0).toUpperCase() + field.name.slice(1);
                        const setterCode = generateSetterCode(field);
                        return `model.set${fieldNameCamelCase}(${setterCode}); // ${field.originalName}`;
                    }).join('\n                    ')}

                    dataList.add(model);

                    if (dataList.size() >= batchSize) {
                        saveService.save(dataList);
                        dataList = new ArrayList<>(batchSize);
                    }
                } catch (Exception e) {
                    StackTraceElement serviceTrace =
                        Arrays.stream(e.getStackTrace())
                        .filter(trace -> trace.getClassName().contains("TransService"))
                        .findFirst()
                        .orElse(null);

                    if (serviceTrace != null) {
                        TransErrorRecordSaveCmd errorRecord =
                            TransErrorRecordSaveCmd.builder()
                                .serviceName(
                                    serviceTrace
                                        .getClassName()
                                        .substring(serviceTrace.getClassName().lastIndexOf('.') + 1))
                                .message(e.getMessage())
                                .params(files.getName())
                                .errorLine(serviceTrace.getLineNumber())
                                .build();

                        errorService.save(Collections.singletonList(errorRecord));

                        log.error(
                            "處理檔案時發生錯誤 - 在服務層: {} 第 {} 行",
                            serviceTrace.getClassName(),
                            serviceTrace.getLineNumber(),
                            e);
                    } else {
                        TransErrorRecordSaveCmd errorRecord =
                            TransErrorRecordSaveCmd.builder()
                                .serviceName("Unknown Service")
                                .message(e.getMessage())
                                .params(files.getName())
                                .errorLine(-1)
                                .build();

                        errorService.save(Collections.singletonList(errorRecord));
                        log.error("資料轉換失敗:" + StringUtil.getString(data, 0, data.length), e);
                    }
                }
                currentLine++;
            }
            
            if (!dataList.isEmpty()) {
                saveService.save(dataList);
            }
            lineIt.close();
        } catch (IOException e) {
            log.error("讀取檔案[${className}]失敗\\n", e);
        }
    }

    @Override
    public String getFileType() {
        return "${tableName}";
    }
}`;
}