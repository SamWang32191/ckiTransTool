const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// 主視窗物件
let mainWindow;

/**
 * 建立主視窗
 */
function createWindow() {
    // 建立瀏覽器視窗
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,      // 啟用 Node.js 整合
            contextIsolation: false,    // 關閉上下文隔離
            enableRemoteModule: true    // 啟用遠端模組
        },
        icon: path.join(__dirname, 'assets/icon.png') // 視窗圖示
    });

    // 載入 index.html 檔案
    mainWindow.loadFile('index.html');

    // 開發時可以打開開發者工具
    // mainWindow.webContents.openDevTools();
}

/**
 * 當 Electron 完成初始化時創建視窗
 */
app.whenReady().then(() => {
    createWindow();

    // macOS 特定處理：當應用程式被啟動時重新建立視窗
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

/**
 * 當所有視窗都被關閉時結束程式
 */
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

/**
 * 處理儲存檔案的 IPC 事件
 */
ipcMain.handle('save-files', async (event, { files }) => {
    try {
        // 儲存所有檔案
        for (const [filePath, content] of Object.entries(files)) {
            // 確保目錄存在
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // // 檢查檔案是否已存在
            // if (fs.existsSync(filePath)) {
            //     const backupPath = `${filePath}.bak`;
            //     fs.renameSync(filePath, backupPath);
            // }
            
            // 寫入新檔案
            fs.writeFileSync(filePath, content, 'utf8');
        }

        return { 
            success: true, 
            message: `檔案已成功儲存` 
        };
        
    } catch (error) {
        console.error('儲存檔案時發生錯誤:', error);
        return { 
            success: false, 
            message: `儲存失敗: ${error.message}` 
        };
    }
});

/**
 * 處理錯誤訊息的 IPC 事件
 */
ipcMain.handle('show-error', async (event, message) => {
    const options = {
        type: 'error',
        title: '錯誤',
        message: '發生錯誤',
        detail: message,
        buttons: ['確定']
    };
    
    await dialog.showMessageBox(mainWindow, options);
});

/**
 * 處理成功訊息的 IPC 事件
 */
ipcMain.handle('show-success', async (event, message) => {
    const options = {
        type: 'info',
        title: '成功',
        message: '操作成功',
        detail: message,
        buttons: ['確定']
    };
    
    await dialog.showMessageBox(mainWindow, options);
});

// 錯誤處理
process.on('uncaughtException', (error) => {
    console.error('未捕獲的例外:', error);
    dialog.showErrorBox('程式錯誤', `發生未預期的錯誤: ${error.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未處理的 Promise 拒絕:', reason);
    dialog.showErrorBox('程式錯誤', `發生未預期的錯誤: ${reason}`);
});

// 在 main.js 中添加新的 IPC 處理程序
ipcMain.handle('show-confirmation', async (event, options) => {
    const response = await dialog.showMessageBox(mainWindow, options);
    return response.response;
});