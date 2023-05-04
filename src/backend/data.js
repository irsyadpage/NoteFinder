"use strict";

const fs = require('fs');
const path = require('path');
const { dialog } = require('electron');
const { exec } = require('child_process');
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const { PDFDocument } = require('pdf-lib');
const Store = require('electron-store');
const log = require('electron-log');
const fns = require('date-fns')


log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';

// Define the configuration data scheme. This sceheme will be store persistently.
const configSchema = {
    config: {
        type: "object",
        required: ["ver", "directoryList", "pdfAppExecutablePath", "enableRecursive", "showRelativePath", "showTitle", "trimNewline", "pageLength", "showModificationDate", "groupAnnotations", "sortGroupAsc"],
        properties: {
            ver: { type: "string", default: "0.8.5" }, // Config version -> for future update checking
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

const standardFontDataUrl = path.join(__dirname, '../../node_modules/pdfjs-dist/standard_fonts/');

const errorDateValue = "N/A"; // When date parsing failed.

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


// Read PDF content to get all page's annotations
const readPdfDocument = async (config, documentPath) => {

    // Get document filename
    let documentName = path.basename(documentPath);

    // Current document annotation list
    let currentPDFannotation = [];

    // Read PDF document
    // Set standardFontDataUrl to avoid warning on missing fonts
    let documentObject = pdfjsLib.getDocument({ url: documentPath, standardFontDataUrl: standardFontDataUrl });
    let pdf = await documentObject.promise;

    // Set the PDF's title as document name if showTitle is enabled
    if (config.showTitle === true) {
        let pdfMetadata = await pdf.getMetadata();
        if (pdfMetadata.hasOwnProperty('info') && pdfMetadata.info.hasOwnProperty('Title')) {
            let title = pdfMetadata.info['Title'].trim();
            // Ensure title exist and has non-empty string value
            if (title.length > 0) {
                documentName = title;
            }
        }
    }

    // Iterate each PDF's page
    let totalPage = pdf.numPages;
    for (let currentPageNo = 1; currentPageNo <= totalPage; currentPageNo++) {
        // Get current page annotation
        let currentPageContent = await pdf.getPage(currentPageNo);
        let currentPageAnnotationList = await getPageAnnotation(currentPageContent, config);

        /*  DataTable's array format:
                0 - Full PDF File Path (including PDF Filename)
                1 - Annotation Counter - for sorting (value is assigned after the return)
                2 - PDF Filename / Document Title
                3 - Page Number
                4 - Annotation Type
                5 - Annotation Content
                6 - Creation Date / Modification Date
        */

        for (const item of currentPageAnnotationList) {
            currentPDFannotation.push([documentPath, null, documentName, currentPageNo, item[0], item[1], parsePdfDate(item[2])]);

        }

    }

    return currentPDFannotation;
}


// Get all annotation in a PDF's page
const getPageAnnotation = async (pageContent, config) => {

    let pageAnnotationList = []; // Store both comment & highlight annotations
    let annotationRectangleList = []; // Store rectangle dimensions for all highlight annotations

    // Get annotations list
    let annotationRawList = await pageContent.getAnnotations("display");
    let arrayLength = annotationRawList.length;

    // Iterate over annotations list
    for (let i = 0; i < arrayLength; i++) {
        if (annotationRawList[i].subtype == "Highlight") {
            // Get annotate string
            let annotateText = annotationRawList[i].contentsObj.str;

            // Get creationDateTime / modificationDateTime
            let dateTime = (config.showModificationDate === true) ? annotationRawList[i].modificationDate : annotationRawList[i].creationDate;

            if (annotateText.length > 0) {
                if (config.trimNewline === true) {
                    pageAnnotationList.push([`<span class="material-icons-round table-comment">chat</span>`, annotateText.replace(/(?:\r\n|\r|\n)/g, " "), dateTime]);
                } else {// Convert newline char to <br> tags
                    pageAnnotationList.push([`<span class="material-icons-round table-comment">chat</span>`, annotateText.replace(/(?:\r\n|\r|\n)/g, "<br>"), dateTime]);
                }

            } else {

                // No annotate string, so this is highlight only without comment
                // Store the rectangle dimensions value
                // Before store, insert creationDateTime / modificationDateTime as the 5th item
                annotationRawList[i].rect.push(dateTime);
                annotationRectangleList.push(annotationRawList[i].rect);
            }
        }
    }

    // Get the text content of highlighted annotations 
    if (annotationRectangleList.length > 0) {
        // Get all text content from page
        let textContent = await pageContent.getTextContent();

        if (textContent.items.length != 0) {
            // Get text content properties
            let textList = textContent.items
                .filter(item => item.str != null && item.str.trim() != "")
                .map(item => ({
                    text: item.str,
                    width: item.width,
                    height: item.height,
                    top: item.transform[5],
                    left: item.transform[4],
                    // transform: item.transform,
                }));

            // Iterate the list of rectangle dimensions value to find matching position of text content
            for (const rectangleDimensions of annotationRectangleList) {

                // There might be multiple text content annotation's rectangle dimensions
                // Get all text content per ractangle dimension
                let textArray = [];
                for (const currentText of textList) {
                    // Rectangle dimensions' coordinate format: x,y,x,y
                    if (currentText.top >= rectangleDimensions[1] && currentText.top <= rectangleDimensions[3] && currentText.left >= rectangleDimensions[0] && currentText.left <= rectangleDimensions[2]) {
                        textArray.push(currentText.text);
                    }
                }
                pageAnnotationList.push([`<span class="material-icons-round table-highlight">border_color</span>`, textArray.join(' '), rectangleDimensions[4]]); // [4] is the creationDate / modificationDate
            }
        }
    }

    return pageAnnotationList;
}


const parsePdfDate = (dateString) => {

    // Ensure date string is non-empty
    if (dateString === undefined || dateString === null || typeof dateString !== "string" || dateString === "") {
        return errorDateValue;
    }

    try {
        // Slice string for primary data without unrelated token
        // Slice based on -> D:YYYYMMDDHHmmSSOHH'mm'. Refer: https://www.verypdf.com/pdfinfoeditor/pdf-date-format.htm
        dateString = dateString.slice(2, 19) + dateString.slice(20, 22);
        let date = fns.parse(dateString, "yyyyMMddHHmmssxx", new Date()); // Refer: https://date-fns.org/v2.29.3/docs/parse

        return date.toLocaleString().toUpperCase().replace(", ", "<br>");
    } catch (error) {
        console.error(error);
        return errorDateValue;
    }
}


module.exports = {
    getConfig: (event, reset) => { // Read config file
        // Reset config if set
        if (reset === true) {
            store.clear();
        }

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
    getAllPdfAnnotation: async (event, directoryData, config, frontend) => { // Iterate over list file to read each PDF

        let currentPdfCount = 1;
        let currentAnnotationCount = 1;
        let allAnotationList = []
        let failedFileList = []
        // Iterate over each PDF file
        for (const file of directoryData.pdfFileList) {

            frontend.setStatus(`Reading PDF Document: ${currentPdfCount}/${directoryData.statCounter.file} (${(currentPdfCount / directoryData.statCounter.file * 100).toFixed(1)}%)`);
            try {
                let documentAnnotationList = await readPdfDocument(config, file);
                for (const annotationItem of documentAnnotationList) {
                    // Add annotation counter value
                    annotationItem[1] = currentAnnotationCount++;

                    allAnotationList.push(annotationItem);
                }
            } catch (error) {
                log.error(file, error);
                failedFileList.push(file);
            }
            currentPdfCount++;
        }

        return { annotationList: allAnotationList, failedList: failedFileList };
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






