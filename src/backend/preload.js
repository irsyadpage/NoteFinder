"use strict";

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('backend', {
    log: (text) => ipcRenderer.send('log:info', text),
    logError: (text) => ipcRenderer.send('log:error', text),
    getConfig: (reset) => ipcRenderer.invoke('config:get', reset),
    saveConfig: (configData) => ipcRenderer.invoke('config:save', configData),
    chooseFile: (options) => ipcRenderer.invoke('action:chooseFile', options), // Async
    checkDirectory: (directoryList, recursive) => ipcRenderer.invoke('data:checkDirectory', directoryList, recursive), // Async
    getAnnotation: (directoryData, config) => ipcRenderer.invoke('data:getAnnotation', directoryData, config), // Async
    openFile: (config, documentPath, documentPage) => ipcRenderer.invoke('action:openFile', config, documentPath, documentPage), 
    updateStatus: (callback) => ipcRenderer.on('update:status', callback),
    openAppUrl: () => ipcRenderer.send('open:appUrl')
});

