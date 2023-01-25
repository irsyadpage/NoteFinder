"use strict";

const { app, BrowserWindow, ipcMain } = require('electron');
const nativeImage = require('electron').nativeImage;
const path = require('path');
const log = require('electron-log');

const data = require('./data');
const frontend = { setStatus: undefined };

const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 900,
        minWidth: 900,
        minHeight: 640,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#333',
            symbolColor: '#00bcd4',
        },

        icon: nativeImage.createFromPath(path.join(path.dirname(__dirname), 'frontend/assets/images/icon-1024.png')),
    });

    // Set log formats
    log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';

    // Load main html page
    mainWindow.loadFile(path.join(path.dirname(__dirname), 'frontend/index.html'));

    // Attach setStatus for the frontend
    frontend.setStatus = (text) => { mainWindow.webContents.send('update:status', text); };

    // Open the DevTools.
    // mainWindow.webContents.openDevTools();
};

app.whenReady().then(() => {

    // Define ipc events
    ipcMain.on('log:info', (event, text) => { log.info(text); });
    ipcMain.on('log:error', (event, text) => { log.error(text); });
    ipcMain.handle('config:get', data.getConfig);
    ipcMain.handle('config:save', data.saveConfig);
    ipcMain.handle('action:chooseFile', data.chooseFile)
    ipcMain.handle('data:checkDirectory', data.checkDirectory);
    ipcMain.handle('data:getAnnotation', (event, directoryData, config) => { return data.getAllPdfAnnotation(event, directoryData, config, frontend); });
    ipcMain.handle('action:openFile', data.openPdfFile);

    ipcMain.on('open:appUrl', (event) => {
        require('electron').shell.openExternal('https://github.com/irsyadler/NoteFinder');
    });

    createWindow();

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



