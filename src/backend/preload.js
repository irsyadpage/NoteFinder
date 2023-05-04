"use strict";

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('backend', {
    log: (text) => ipcRenderer.send('log:info', text),
    logError: (text) => ipcRenderer.send('log:error', text),
    getConfig: (reset) => ipcRenderer.invoke('config:get'),
    saveConfig: (configData) => ipcRenderer.invoke('config:save', configData),
    appReset: () => ipcRenderer.invoke('app:reset'),
    chooseFile: (options) => ipcRenderer.invoke('action:chooseFile', options), // Async
    checkDirectory: (directoryList, recursive) => ipcRenderer.invoke('data:checkDirectory', directoryList, recursive), // Async
    readDocument: (documentPath) => ipcRenderer.invoke('data:readDocument', documentPath), // Async
    openFile: (config, documentPath, documentPage) => ipcRenderer.invoke('action:openFile', config, documentPath, documentPage), 
    updateStatus: (callback) => ipcRenderer.on('update:status', callback),
    openAppUrl: () => ipcRenderer.send('open:appUrl'),
    getEditorInfo: (documentPath) => ipcRenderer.invoke('editor:getInfo', documentPath), // Async
    saveEditorInfo: (documentPath, newInfo) => ipcRenderer.invoke('editor:saveInfo', documentPath, newInfo) // Async
    
});
