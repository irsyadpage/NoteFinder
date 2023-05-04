"use strict";

const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const log = require('electron-log');

const data = require('./data');
const frontend = { setStatus: undefined };

const createWindow = () => {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 900,
        minWidth: 900,
        minHeight: 720,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            devTools: (app.commandLine.getSwitchValue("mode") === "dev") ? true : false, // Enable chrome dev tools if arg --mode=dev  
        },
        autoHideMenuBar: true,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#333',
            symbolColor: '#fff',
        },

        icon: nativeImage.createFromPath(path.join(path.dirname(__dirname), 'frontend/assets/images/icon-1024.png')),
    });

    // Set log formats
    log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';

    // Load main html page
    mainWindow.loadFile(path.join(path.dirname(__dirname), 'frontend/index.html'));

    // Attach setStatus for the frontend
    frontend.setStatus = (text) => { mainWindow.webContents.send('update:status', text); };

    // Enable development evironment if --mode=dev argument exist
    if (app.commandLine.getSwitchValue("mode") === "dev") {
        // Currently, below command unable to show the devtools window properly. Need to press Ctrl+Shift+I 3 times (while focusing on the main-window)
        // mainWindow.webContents.openDevTools();
    }

};

app.whenReady().then(() => {

    createWindow();

    // Define ipc events
    ipcMain.on('log:info', (event, text) => { log.info(text); });
    ipcMain.on('log:error', (event, text) => { log.error(text); });
    ipcMain.handle('config:get', data.getConfig);
    ipcMain.handle('config:save', data.saveConfig);

    ipcMain.handle('action:chooseFile', data.chooseFile)
    ipcMain.handle('data:checkDirectory', data.checkDirectory);
    ipcMain.handle('data:readDocument', data.readDocument);
    ipcMain.handle('action:openFile', data.openPdfFile);
    ipcMain.on('open:appUrl', (event) => {
        require('electron').shell.openExternal('https://github.com/irsyadpage/NoteFinder');
    });
    ipcMain.handle('editor:getInfo', data.getEditorInfo);
    ipcMain.handle('editor:saveInfo', data.saveEditorInfo);

    // Reset application 
    ipcMain.handle('app:reset', (event) => {
        log.info('Triggered: app:reset');

        // Get appData path
        const appDataPath = path.join(app.getPath('appData'), app.getName());
       
        // Delete appData and relaunch
        fs.rm(appDataPath, { recursive: true, force: true }, () => {
            log.info('Completed: app:reset');
            app.relaunch();
            app.exit();
        });
    });


    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    })
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
