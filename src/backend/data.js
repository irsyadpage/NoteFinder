"use strict";

const fs = require('fs');
const path = require('path');
const { dialog } = require('electron');
const { exec } = require('child_process');
const { PDFDocument } = require('pdf-lib');
const Store = require('electron-store');
const log = require('electron-log');

log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';


// Define the configuration data scheme. This sceheme will be store persistently.
const configSchema = {
    config: {
        type: "object",
        required: ["ver", "directoryList", "pdfAppExecutablePath", "enableRecursive", "showRelativePath", "showTitle", "trimNewline", "pageLength", "showModificationDate", "groupAnnotations", "sortGroupAsc"],
        properties: {
            ver: { type: "string", default: "0.8.23" }, // Config version -> for future update checking
            directoryList: { type: "array", default: [] },
            pdfAppExecutablePath: { type: "string", default: "" },
            enableRecursive: { type: "boolean", default: true },
            showRelativePath: { type: "boolean", default: true },
            showTitle: { type: "boolean", default: true },
            trimNewline: { type: "boolean", default: true },
            pageLength: { type: "number", default: 10, maximum: 100, minimum: -1 },
            showModificationDate: { type: "boolean", default: false },
            groupAnnotations: { type: "boolean", default: true },
            sortGroupAsc: { type: "boolean", default: true }
        },
        default: {}
    }
};
const store = new Store({ schema: configSchema, clearInvalidConfig: true });


// Recursive loop to get all files and directories
const getAllPdfFiles = async (parentDirectory, directoryList, enableRecursive, pdfFileList, statCounter) => {

    // Initialize array for this directory
    let currentFileList = [];

    // Iterate on each item in the directory
    for (const item of directoryList) {

        let currentItemFullPath = path.join(parentDirectory, item);

        try {
            // Check item existence and read access 
            await fs.promises.access(currentItemFullPath, fs.constants.R_OK);

        } catch {
            console.error("Unable to access: " + currentItemFullPath);
            continue;  // Skip item
        }

        let currentItemStat = await fs.promises.stat(currentItemFullPath);
        // If item is directory (and recursive is enabled), iterate inside it
        if (currentItemStat.isDirectory()) {
            if (enableRecursive === true) { // Proceed only if recursion enable. Seperate from previous if to avoid go to else -> UNKNOWN_FILE_TYPE

                try {
                    // Get list of files in directory
                    let currentItemInsideList = await fs.promises.readdir(currentItemFullPath);

                    let currentCounter = { byte: 0, file: 0, directory: 0 };

                    // Recursively call
                    await getAllPdfFiles(currentItemFullPath, currentItemInsideList, enableRecursive, currentFileList, currentCounter);

                    // Update counter
                    statCounter.directory++; // This add the count of itself TODO: if the given path is a directory, it will count in
                    statCounter.directory += currentCounter.directory;
                    statCounter.file += currentCounter.file;
                    statCounter.byte += currentCounter.byte;

                } catch {
                    console.error("Unable to read directory: " + currentItemFullPath);
                    return;  // Skip item
                }

            }

        }
        else if (currentItemStat.isFile()) {  // The item is a file
            // Ensure has .pdf extenstion // Don't combine with above else-if, it will always trigger the else when a file is not .pdf
            if (path.extname(item).toLowerCase() === '.pdf') {
                currentFileList.push(currentItemFullPath);

                // Get file size
                let fileSize = currentItemStat.size;

                // Update counter
                statCounter.file++;
                statCounter.byte += fileSize;
            }
        }
        else {
            log.error("UNKNOWN_FILE_TYPE", item);
        }
    }

    // Store the info of items inside the directory
    currentFileList.forEach((item) => {
        pdfFileList.push(item);
    });

}


module.exports = {
    getConfig: (event) => { // Read config file
        const config = store.get('config');
        config.configFilePath = store.path; // For debugging
        return config;
    },
    saveConfig: (event, configData) => { // Save config file
        store.set('config', configData);
        return { success: true };
    },
    chooseFile: async (event, options) => {
        const { canceled, filePaths } = await dialog.showOpenDialog(options);
        if (canceled) {
            return;
        } else {
            return filePaths;
        }
    },
    checkDirectory: async (event, directoryList, enableRecursive) => { // Get all pdf files in the given directoryList

        // List and information
        let statCounter = { byte: 0, file: 0, directory: 0 };
        let pdfFileList = [];

        // Get all items
        await getAllPdfFiles("", directoryList, enableRecursive, pdfFileList, statCounter);

        // Get parent directory based on the user choosen path
        let parentDirectory = path.normalize(directoryList[0]); // Default: only one item, hence use the whole path
        if (directoryList.length > 1) { // Multiple items, hence use the parent dir
            parentDirectory = path.join(path.parse(parentDirectory).dir, "\\...");
        }

        if (pdfFileList.length > 0) {
            return { success: true, parentDirectory: parentDirectory, pdfFileList: pdfFileList, statCounter: statCounter };
        } else {
            return { success: false, parentDirectory: parentDirectory, reason: "No PDF document(s) found." };
        }

    },
   
    readDocument: async (event, documentPath) => {
        return await fs.promises.readFile(documentPath);
    },
    openPdfFile: (event, config, documentPath, documentPage) => { // Execute command to open PDF files

        let command;
        if (process.platform === "win32") { // Open file command for windows
            command = `start "" "${documentPath}"`; // Refer to: https://ss64.com/nt/start.html

            // Set page number if available and pdfAppExecutablePath is exist
            if (config.pdfAppExecutablePath.length > 0 && documentPage > 0) {
                command = `"${config.pdfAppExecutablePath}" /A "page=${documentPage}=OpenActions" "${documentPath}"`; // Refer to: https://www.robvanderwoude.com/commandlineswitches.php#Acrobat
            }
        }
        else if (process.platform === "darwin") { // Open file command for macos
            command = `open "${documentPath}"` // Refer to: https://apple.stackexchange.com/questions/74353/how-to-launch-pdf-viewer-from-the-terminal
        }
        else { // Open file command for linux 
            command = `xdg-open "${documentPath}"`
        }

        log.info(command);
        try {
            let stdout = exec(command);
            // log.info(stdout);
            return { success: true };
        } catch (error) {
            log.error(error);
            return { success: false, reason: "Unable to open the PDF file: " + documentPath };
        }
    },
    getEditorInfo: async (event, documentPath) => { // Get PDF document info for editor

        // Seperate exist check, access check and document read for clearer error info
        try {
            // Check existence
            if (fs.existsSync(documentPath) !== true) {
                return { success: false, reason: "Unable to find the PDF document file." };
            }

            // Check read permission
            await fs.promises.access(documentPath, fs.constants.R_OK);
        } catch (error) {
            log.error(error);
            return { success: false, reason: "Unable to access the PDF document file." };
        }

        try {
            // Read document
            const contents = await fs.promises.readFile(documentPath);
            const pdfDoc = await PDFDocument.load(contents);
            const documentTitle = pdfDoc.getTitle();

            if (documentTitle === undefined) {
                return { success: true, documentTitle: "" };
            } else {
                return { success: true, documentTitle: documentTitle };
            }
        } catch (error) {
            log.error(error);
            return { success: false, reason: "Unable to read the PDF document file." };
        }
    },
    saveEditorInfo: async (event, documentPath, newInfo) => { // Save PDF document info from editor

        // Seperate exist check, access check and document write for clearer error info
        try {
            // Check existence
            if (fs.existsSync(documentPath) !== true) {
                return { success: false, reason: "Failed to find the PDF document file." };
            }

            // Check write permission
            await fs.promises.access(documentPath, fs.constants.W_OK);
        } catch (error) {
            log.error(error);
            return { success: false, reason: "Failed to write the PDF document file. Close any application that is open the PDF document file." };
        }

        // Read document
        let contents = null;
        let pdfDoc = null;

        try {
            // Read document
            contents = await fs.promises.readFile(documentPath);
            pdfDoc = await PDFDocument.load(contents);

            // Set title
            pdfDoc.setTitle(newInfo.documentTitle);

            // Set PDF producer
            // pdfDoc.setProducer((pdfDoc.getProducer() === undefined) ? "" : pdfDoc.getProducer());

        } catch (error) {
            log.error(error);
            return { success: false, reason: "Failed to save the PDF document's title." };
        }

        // Made backup copy first
        try {
            await fs.promises.copyFile(documentPath, documentPath + ".backup", fs.constants.COPYFILE_EXCL);
        } catch (error) {
            log.info(error);
        }


        try {
            // Save document
            await fs.promises.writeFile(documentPath, await pdfDoc.save());

            return { success: true };
        } catch (error) {
            log.error(error);
            return { success: false, reason: "Failed to save the PDF document's title. Close any application that is open the PDF document file." };
        }
    }

}



