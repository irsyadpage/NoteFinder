"use strict";

method.pdf = {
    config: {
        errorDateValue: "N/A", // When date parsing failed.
        // parseStarted: false,
    },
    // counter: { totalDocument: 0, currentDocument: 0, annotation: 0, comment: 0, highlight: 0 },
    // list: { allAnnotation: [], failedDocument: [] },
    getAllAnnotations: (directoryData) => { // Iterate each documentPath to get all annotations

        return new Promise(async (resolve) => {

            // Set resolve reference
            method.pdf.resolve = resolve;

            // Set pdfjs worker
            pdfjsLib.GlobalWorkerOptions.workerSrc = "assets/pdfjs/pdf.worker.js";

            // Reset list and counter
            method.pdf.list = { allAnnotation: [], failedDocument: [] };
            method.pdf.counter = { totalDocument: directoryData.pdfFileList.length, currentDocument: 0, annotation: 0, comment: 0, highlight: 0, preparing: 0 };
            method.pdf.config.parseStarted = false;
            // Iterate over each PDF document
            for (const documentPath of directoryData.pdfFileList) {

                // Call checkCompletion() each time error happen to ensure that if last document is error, resolve can be called.
                try {
                    method.pdf.updateStatus();
                    // Read PDF document (from backend). Then parse into pdfjs object
                    pdfjsLib.getDocument({ data: await window.backend.readDocument(documentPath) }).promise.then((pdfObject) => {
                        // Read metada and iterate each document page
                        method.pdf.parseDocument(documentPath, pdfObject).then(() => {
                            if (method.pdf.config.parseStarted !== true) {// For update status
                                method.pdf.config.parseStarted = true;
                            }
                            method.pdf.updateStatus();
                            method.pdf.counter.currentDocument++;
                            method.pdf.checkCompletion();

                        }).catch((error) => {
                            method.pdf.errorHandler("parseDocument", documentPath, error);
                            method.pdf.checkCompletion();
                        });

                    }).catch((error) => {
                        method.pdf.errorHandler("readDocument", documentPath, error);
                        method.pdf.checkCompletion();
                    });

                } catch (error) {
                    method.pdf.errorHandler("getAllAnnotations", documentPath, error);
                    method.pdf.checkCompletion();
                }
            }

        });


    },

    parseDocument: async (documentPath, pdfObject) => { // Parse PDF content to get all page's annotations


        // Current document annotation list
        let currentPDFannotation = [];

        let documentName = documentPath.split('\\').pop().split('/').pop();

        // Set the PDF's title as document name if showTitle is enabled
        if (mainData.config.showTitle === true) {
            let pdfMetadata = await pdfObject.getMetadata();
            if (pdfMetadata.hasOwnProperty('info') && pdfMetadata.info.hasOwnProperty('Title')) {
                let title = pdfMetadata.info['Title'].trim();
                // Ensure title exist and has non-empty string value
                if (title.length > 0) {
                    documentName = title;
                }
            }
        }

        // Iterate each PDF's page
        let totalPage = pdfObject.numPages;
        for (let currentPageNo = 1; currentPageNo <= totalPage; currentPageNo++) {
            // Get current page annotation
            let currentPageContent = await pdfObject.getPage(currentPageNo);
            let currentPageAnnotationList = await method.pdf.getPageAnnotation(currentPageContent);

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
                let type;
                // Set HTML code & increase counter
                if (item[0] === "comment") {
                    type = `<span class="material-icons-round table-comment">chat</span>`;
                    method.pdf.counter.comment++;
                } else if (item[0] === "highlight") {
                    type = `<span class="material-icons-round table-highlight">border_color</span>`;
                    method.pdf.counter.highlight++;
                }

                method.pdf.list.allAnnotation.push([documentPath, ++method.pdf.counter.annotation, documentName, currentPageNo, type, item[1], method.pdf.parseDate(item[2])]);

            }

        }

        return currentPDFannotation;
    },

    getPageAnnotation: async (pageContent) => {  // Get all annotation in a PDF's page

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
                let dateTime = (mainData.config.showModificationDate === true) ? annotationRawList[i].modificationDate : annotationRawList[i].creationDate;

                if (annotateText.length > 0) {
                    if (mainData.config.trimNewline === true) {
                        pageAnnotationList.push(["comment", annotateText.replace(/(?:\r\n|\r|\n)/g, " "), dateTime]);
                    } else {// Convert newline char to <br> tags
                        pageAnnotationList.push(["comment", annotateText.replace(/(?:\r\n|\r|\n)/g, "<br>"), dateTime]);
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
                    pageAnnotationList.push(["highlight", textArray.join(' '), rectangleDimensions[4]]); // [4] is the creationDate / modificationDate
                }
            }
        }

        return pageAnnotationList;
    },

    updateStatus: () => {
        if(method.pdf.config.parseStarted === true) { // Print info "Reading" using mainCounter 
            method.UI.setStatus(`Reading PDF Document: ${method.pdf.counter.currentDocument}/${method.pdf.counter.totalDocument} 
            (${(method.pdf.counter.currentDocument / method.pdf.counter.totalDocument * 100).toFixed(1)}%)`);
        } else {
            // Print info "Preparing" using preparingCounter
            method.pdf.counter.preparing++;
            method.UI.setStatus(`Preparing PDF Document: ${method.pdf.counter.preparing}`);
        }
        
    },

    checkCompletion: () => { // Check if all document read and parsed
        if (method.pdf.counter.currentDocument === method.pdf.counter.totalDocument) {
            method.pdf.resolve({ annotationList: method.pdf.list.allAnnotation, failedList: method.pdf.list.failedDocument, counter: method.pdf.counter });
        }
    },

    errorHandler: (type, documentPath, error) => { // Print log, add to failed list and write log

        console.error(type, documentPath, error);
        method.pdf.list.failedDocument.push(documentPath);
        window.backend.logError(type + " -> " + documentPath + " -> " + error);

        // Increase counter
        method.pdf.counter.currentDocument++;
    }

}