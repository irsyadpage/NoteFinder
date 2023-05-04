"use strict";

const mainData = {
    tableAnnotation: undefined,
    config: undefined,
    tempConfig: undefined,
    platform: "unknown", // Possible value [win, mac, unix, linux, unknown]
    editorData: undefined
};

// Main method object access
const method = {};


// Handle app init process
method.initApp = async () => {

    try {
        // Get configuration data
        mainData.config = await window.backend.getConfig();
        console.log("[CONFIG_LOADED]", mainData.config);

        // Init table
        method.action.initTable();

        // Attach search button
        $("#inputSearchTable").keyup(function () {
            mainData.tableAnnotation.search($(this).val()).draw();
        })

        // Attach right click listener
        $(document).on("contextmenu", "#tableAnnotation .editable-data", method.action.getEditorInfo);

        // Attach table row click listener
        $("#tableAnnotation").on("dblclick", "tbody .dbclick-table-row", method.action.openFile);

        // Attach listener for button ripple effect
        $(".button").click(method.UI.ripple);

        // Attach listener for row group sort button
        $("#buttonSetGroupOrder").click(method.config.setGroupSort);

        // Attach listener for paging button
        $("#buttonSetPageLength").click(method.config.setPageLength);

        // Attach listener for menu button switch
        $(".common-button.switch").click(method.UI.onSwitchClick);

        // Attach listener for menu toggle
        $("#buttonOptionsToggle").click(method.UI.menuToggle);

        // Attach listener for input choose PDF folder and choose PDF application
        $(".button-choose").click(method.action.chooseFile);

        // Attach listener for refresh
        $("#buttonRefresh").click(method.action.checkDirectory);

        // Attach listener for reset config
        $("#buttonResetConfig").click(method.config.reset);

        // Attach listener for open appURL and show appLicense
        $("#appUrl").click(() => { window.backend.openAppUrl(); });
        $("#appLicense").click(method.UI.showAppLicense);

        // Attach backend status
        window.backend.updateStatus((_event, text) => { method.UI.setStatus(text); })

        // Attach listener for drag & drop
        method.action.attachDropListener();

        // Init Button & Switch component
        method.UI.initButton();

        // Trigger checkDirectory
        method.action.checkDirectory();

        // Show the content container
        $("#containerContent").addClass("active");

        // Show the content container
        $("#containerContent").addClass("active");

        // Init platform specific UI task
        method.UI.initPlatformInterface();

        // Attach listener for screen-resize
        $(window).on('resize', method.UI.resizeBox);

        // Trigger resize
        method.UI.resizeBox(); // Only trigger after initPlatform()

        // Attach listener for editor save and cancel
        $("#buttonEditorCancel").click(method.UI.editorToggle);
        $("#buttonEditorSave").click(method.action.saveEditorInfo);



        // Hide loader
        $("#containerLoader").addClass("hidden");

    } catch (error) {
        alert("INIT_ERROR: " + error);
    }
}


method.config = {
    setPath: (element, filePath) => {

        // Trigger checkDirectory
        if (element.attr("id") === "buttonChooseDirectory") {
            mainData.config.directoryList = filePath;
            console.log(filePath);
            method.action.checkDirectory().then(() => {
                window.backend.saveConfig(mainData.config);
            });
        }
        else if (element.attr("id") === "buttonChoosePdfApp") {
            mainData.config.pdfAppExecutablePath = filePath[0];
            window.backend.saveConfig(mainData.config);

            // Update UI
            method.UI.setPath(element.attr("id"), mainData.config.pdfAppExecutablePath);
        }

    },

    setSwitch: (key, state) => {
        mainData.config[key] = state;

        console.log("[CONFIG_SAVE]");
        window.backend.saveConfig(mainData.config);
    },
    setGroupSort: () => {
        mainData.config.sortGroupAsc = !mainData.config.sortGroupAsc;
        window.backend.saveConfig(mainData.config);

        mainData.tableAnnotation.order.fixed({ pre: [2, mainData.config.sortGroupAsc ? "asc" : "desc"] }).draw();

        method.UI.setGroupSort();
    },
    setPageLength: () => {

        let current = $("#infoPageLength").text();

        if (current == 10) {
            mainData.config.pageLength = 25;
        } else if (current == 25) {
            mainData.config.pageLength = 50;
        } else if (current == 50) {
            mainData.config.pageLength = 100;
        } else if (current == 100) {
            mainData.config.pageLength = -1;
        } else {
            mainData.config.pageLength = 10;
        }

        console.log("[CONFIG_SAVE]");
        window.backend.saveConfig(mainData.config);

        method.UI.setPageLength();

    },
    reset: async () => {
        // Reset config data
        mainData.config = await window.backend.getConfig(true);
        console.log("[CONFIG_RESET]", mainData.config);

        if ($("#boxEditor").hasClass("active") === true) {
            method.UI.editorToggle();
        }

        // Refresh component
        method.UI.initButton();

        // Toggle info
        method.UI.menuToggle();
    }
}


method.UI = {
    ripple: (event) => {
        var element = $(event.currentTarget);

        // Get click position
        var x = event.pageX - element.offset().left;
        var y = event.pageY - element.offset().top;

        // If element is button, check its status
        var isButtonRestricted = element.hasClass("button-restricted");
        var isButtonDisabled = element.hasClass("disabled");

        // Check button condition
        if (isButtonDisabled) {
            // do nothing 

        } else {
            // Append ripple span
            var span = $(`<span class="ripple"/>`);
            span.appendTo(element).css({ left: x, top: y });

            if (isButtonRestricted) {
                // Append deactivated
                element.addClass("disabled");

                // Attach self-destruct & activator
                setTimeout(function () { span.remove(); element.removeClass("disabled"); }, 1000);

            } else {
                // Attach self-destruct
                setTimeout(function () { span.remove(); }, 1000);
            }
        }
    },
    menuToggle: () => {
        if ($("#buttonOptionsToggle").hasClass("disabled") === false) { // Prevent double-trigger
            if ($("#sectionOptions").hasClass("active") === true) { // Hide the menu
                $("#buttonOptionsToggle").removeClass("active").children("span.common-button-icon").text("menu");
                $("#sectionOptions").removeClass("active");

                $("#buttonChooseDirectory").removeClass("disabled");

                if (mainData.config.directoryList.length > 0) {
                    $("#buttonRefresh").css("visibility", "unset");

                    // Trigger directoryCheck if switch change
                    if ((mainData.config.groupAnnotations !== mainData.tempConfig.groupAnnotations) ||
                        (mainData.config.showTitle !== mainData.tempConfig.showTitle) ||
                        (mainData.config.showModificationDate !== mainData.tempConfig.showModificationDate)) {

                        // Check if Row Grouping enabled/disabled
                        if (mainData.config.groupAnnotations !== mainData.tempConfig.groupAnnotations) {
                            // Clear and destroy current table
                            mainData.tableAnnotation.clear().destroy();

                            // re-Init table
                            method.action.initTable();

                        }
                        // Set search placeholder
                        method.UI.setSearchPlaceholder();

                        method.UI.resizeBox();

                        // Trigger directory check
                        method.action.checkDirectory();
                    }
                }


            } else { // Show the menu
                // Get temp config
                mainData.tempConfig = Object.assign({}, mainData.config);

                // Set UI
                $("#buttonOptionsToggle").addClass("active").children("span.common-button-icon").text("close");
                $("#sectionOptions").addClass("active");

                $("#buttonChooseDirectory").addClass("disabled");
                $("#buttonRefresh").css("visibility", "hidden");
            }
        }

    },
    initButton: () => {
        // Set Button Path
        if (mainData.config.directoryList.length > 0) {
            method.UI.setPath("buttonChooseDirectory", mainData.config.directoryList[0]); // Set initial path
        } else {
            method.UI.setPath("buttonChooseDirectory", $("#buttonChooseDirectory").attr("data-default"));
        }
        if (mainData.config.pdfAppExecutablePath.length > 0) {
            method.UI.setPath("buttonChoosePdfApp", mainData.config.pdfAppExecutablePath);
        } else {
            method.UI.setPath("buttonChoosePdfApp", $("#buttonChoosePdfApp").attr("data-default"));
        }

        // Set Button Switch
        method.UI.setSwitch("groupAnnotations", mainData.config.groupAnnotations);
        method.UI.setSwitch("showTitle", mainData.config.showTitle);
        method.UI.setSwitch("showModificationDate", mainData.config.showModificationDate);

        // Init statInfo
        // method.UI.setStatInfo(0, 0, 0);

        // Init groupSort
        method.UI.setGroupSort();

        // Init pageLength
        method.UI.setPageLength(false);

        // Reset table search value
        mainData.tableAnnotation.search("").draw();

        // Set search placeholder
        method.UI.setSearchPlaceholder();

        // Init status
        method.UI.resetStatus();

        // Hide refresh
        $("#buttonRefresh").css("visibility", "hidden");
    },
    resetStatus: () => {
        // Init status
        $("#boxStatus").addClass("active");
        $("#boxStatusError").hide();
        $("#boxStatusLoader").hide();
        $("#boxStatusText").removeClass("min-width");

        $("#boxStatusText").text($("#boxStatusText").attr("data-default"));
    },
    resizeBox: () => { // Resize the sectionContent
        let padding = 1 * parseFloat(getComputedStyle(document.documentElement).fontSize); // Padding for 1rem;

        let headerHeight = + $("#sectionNavigation").outerHeight();

        // Add TitleBar height if in windows or macos
        if (mainData.platform === "win" || mainData.platform === "mac") {
            headerHeight += $("#containerTitleBar").outerHeight();
        }

        $("#sectionContent").height(window.innerHeight - headerHeight); // Padding: 2rem; - (padding * 2)
        $("#tableAnnotation_wrapper").height($("#sectionContent").height() - $("#boxSearch").outerHeight() - padding);
        $("#sectionOptions").height(window.innerHeight - headerHeight - padding);

        $("#sectionOptions").css("top", headerHeight);
    },
    onSwitchClick: (event) => {
        const element = $(event.currentTarget);
        // Get current state to inverse it
        let state = true;
        if (element.attr("data-state") === "on") {
            state = false;
        }

        method.UI.setSwitch(element.attr("data-key"), state);
        method.config.setSwitch(element.attr("data-key"), state);
    },
    setSwitch: (key, switchOn) => {
        // Get switch element
        const element = $(`.common-button.switch[data-key="${key}"]`);

        if (switchOn) {
            element.attr("data-state", "on");
            element.children("span.common-button-icon").text("check_box");
        } else {
            element.attr("data-state", "off");

            element.children("span.common-button-icon").text("check_box_outline_blank");
        }


        // Change the Table header fo related switch
        if (key === "showTitle") {
            if (switchOn) {
                $(mainData.tableAnnotation.column(2).header()).text("Document Title").attr("title", "The PDF document's title");
                $("#buttonSetGroupOrder span.text").text("Sort Title");
                $("#buttonSetGroupOrder").attr("title", "Sort group annotions based on the PDF document's title");
            } else {
                $(mainData.tableAnnotation.column(2).header()).text("Document Filename").attr("title", "The PDF document's filename");
                $("#buttonSetGroupOrder").attr("title", "Sort group annotions based on the PDF document's filename");
                $("#buttonSetGroupOrder span.text").text("Sort Filename");
            }
        }
        else if (key === "showModificationDate") {
            if (switchOn) {
                $(mainData.tableAnnotation.column(6).header()).text("Modified Date").attr("title", "The annotation's last modified date and time");
            } else {
                $(mainData.tableAnnotation.column(6).header()).text("Created Date").attr("title", "The annotation's created date and time");
            }
        }
    },
    setPath: (id, text) => {
        $(`#${id} .button-choose-text`).text(text);
    },
    setStatInfo: (fileCount, fileSize, annotationCount) => {
        $("#infoFileCount").text(fileCount);
        $("#infoFileSize").text(method.tool.formatBytes(fileSize));
        $("#infoAnnotationCount").text(annotationCount);
    },
    setStatus: (text) => {
        $("#boxStatusText").text(text);
    },
    setGroupSort: () => {

        if (mainData.config.sortGroupAsc === true) {
            $("#infoGroupOrder").html(`<span class="material-icons-round">arrow_upward</span>`);
        } else {
            $("#infoGroupOrder").html(`<span class="material-icons-round">arrow_downward</span>`);
        }

    },
    setPageLength: (drawTable = true) => {
        if (mainData.config.pageLength === -1) { // Show All
            $("#infoPageLength").text("All");
        } else {
            $("#infoPageLength").text(mainData.config.pageLength);
        }

        if (drawTable === true) {
            mainData.tableAnnotation.page.len(mainData.config.pageLength).draw();
        }
    },
    disabledMenu: (disabled) => {
        if (disabled === true) {
            $("#buttonOptionsToggle").addClass("disabled");
            $("#buttonChooseDirectory").addClass("disabled");
            $("#buttonRefresh").addClass("disabled");
        } else {
            $("#buttonOptionsToggle").removeClass("disabled");
            $("#buttonChooseDirectory").removeClass("disabled");
            $("#buttonRefresh").removeClass("disabled");
        }
    },
    initPlatformInterface: () => { // Handle task related to specific OS platforms
        // Get platform
        if (navigator.userAgent.indexOf("Win") != -1) { mainData.platform = "win"; }
        else if (navigator.userAgent.indexOf("Mac") != -1) { mainData.platform = "mac"; }
        else if (navigator.userAgent.indexOf("X11") != -1) { mainData.platform = "unix"; }
        else if (navigator.userAgent.indexOf("Linux") != -1) { mainData.platform = "linux"; }

        if (mainData.platform === "win" || mainData.platform === "mac") {
            // do nothing
        } else if (mainData.platform === "win" || mainData.platform === "mac") {
            // Hide PDF Application Executable 
            $("#buttonChoosePdfAppHeader").remove();
            $("#buttonChoosePdfApp").remove();
        }
        else {
            // Remove TitleBar if outside Windows and macOS
            $("#containerTitleBar").remove();

            // Hide PDF Application Executable 
            $("#buttonChoosePdfAppHeader").remove();
            $("#buttonChoosePdfApp").remove();
        }
    },
    setSearchPlaceholder: () => {
        if (mainData.config.groupAnnotations === true) {
            $("#inputSearchTable").attr("placeholder", `Search Content and Date`);
        } else {
            $("#inputSearchTable").attr("placeholder", `Search ${(mainData.config.showTitle === true) ? "Title" : "Name"}, Content and Date`);
        }
    },
    showAppLicense: () => {
        const LICENSE = `
            NoteFinder - Search comments and highlights annotations in PDF documents
            Copyright (C) 2023 M. A. Irsyad M. Aminuddin

            This program is free software: you can redistribute it and/or modify
            it under the terms of the GNU Affero General Public License as published
            by the Free Software Foundation, either version 3 of the License, or
            (at your option) any later version.

            This program is distributed in the hope that it will be useful,
            but WITHOUT ANY WARRANTY; without even the implied warranty of
            MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
            GNU Affero General Public License for more details.

            You should have received a copy of the GNU Affero General Public License
            along with this program.  If not, see <https://www.gnu.org/licenses/>.
            `;

        alert(LICENSE);
    },
    editorToggle: () => {
        if ($("#boxEditor").hasClass("active") === true) {
            // Prevent close while disabled
            if ($("#buttonEditorCancel").hasClass("disabled") === true) {
                // do nothing
            } else {
                // Close the box
                $("#boxEditor").removeClass("active");

                // Reset data
                $("#editorInfoFilePath").text("");
                $("#editorBoxTitleInput").val("");
                $("#editorStatusText").removeClass("error").text("");

            }
        } else {
            // Open the box
            $("#boxEditor").addClass("active");

        }
    }
};


method.action = {
    initTable: () => {
        let config = annotationTableConfig();

        if (mainData.config.groupAnnotations === true) {
            // Remove table class
            $("#tableAnnotation").addClass("row-grouping").removeClass("full-column");
            // Enable Row Grouping
            mainData.tableAnnotation = $("#tableAnnotation").DataTable(config);
            // Set orderFixed
            mainData.tableAnnotation.order.fixed({ pre: [2, mainData.config.sortGroupAsc ? "asc" : "desc"] }); // Draw() will be call after this
            // Show groupSort button
            $("#buttonSetGroupOrder").css("display", "flex");
        } else {
            // Add table class
            $("#tableAnnotation").addClass("full-column").removeClass("row-grouping");
            // Disabled Row Grouping
            mainData.tableAnnotation = $("#tableAnnotation").DataTable(config);
            // Hide groupSort button
            $("#buttonSetGroupOrder").css("display", "none");
        }

    },
    chooseFile: async function () {
        const element = $(this);
        if (element.hasClass("disabled") === false) { // Prevent double-trigger

            const options = { title: element.attr("data-default") };
            // Add properties based on electron dialog api
            if (element.attr("id") === "buttonChooseDirectory") {
                options.properties = ["openDirectory", "multiSelections"];
            } else if (element.attr("id") === "buttonChoosePdfApp") {
                options.properties = ["openFile"];
            }

            console.log("[CHOOSE_FILE]");
            const filePath = await window.backend.chooseFile(options);

            if (filePath !== undefined) {
                method.config.setPath(element, filePath);
            }
        }

    },
    openFile: function () {
        let rowData = mainData.tableAnnotation.row($(this).parents('tr')).data();
        console.log(rowData);

        // Set pathData: [parentDirectory, relativeFilePath, pageNumber]
        let result = window.backend.openFile(mainData.config, rowData[0], rowData[3]);

        // Show loading to simulate (delay) opening operation 
        $("#tableAnnotation tbody tr:hover .dbclick-table-row").css("cursor", "wait");
        setTimeout(function () { $("#tableAnnotation tbody tr:hover .dbclick-table-row").css("cursor", "pointer"); }, 1000);

        console.log(result);
    },
    checkDirectory: async () => {

        if ($("#buttonRefresh").hasClass("disabled") === false) { // Prevent double-trigger
            // Reset table search and content
            mainData.tableAnnotation.search("").clear().draw();
            // Reset table search box and info
            $("#inputSearchTable").val("");
            // method.UI.setStatInfo(0, 0, 0);

            // Close editor
            if ($("#boxEditor").hasClass("active") === true) {
                method.UI.editorToggle();
            }
            // Reset status
            method.UI.resetStatus();

            // Disable menu
            method.UI.disabledMenu(true);

            // Check if directory config
            if (mainData.config.directoryList.length > 0) {
                $("#boxStatusLoader").show();
                $("#boxStatusText").addClass("min-width");
                method.UI.setStatus("Checking folder...");

                try {

                    let directoryData = await window.backend.checkDirectory(mainData.config.directoryList, mainData.config.enableRecursive);
                    console.log(directoryData);

                    // Set parentDirectory
                    method.UI.setPath("buttonChooseDirectory", directoryData.parentDirectory);

                    if (directoryData.success === true) {


                        if (directoryData.statCounter.file > 0) {
                            method.UI.setStatus("Reading file...");
                            let result = await window.backend.getAnnotation(directoryData, mainData.config);
                            console.log(result);
                            if (result.annotationList.length > 0) {
                                mainData.tableAnnotation.clear().rows.add(result.annotationList);
                                mainData.tableAnnotation.draw();

                                // Set statInfo
                                // method.UI.setStatInfo(directoryData.statCounter.file, directoryData.statCounter.byte, result.annotationList.length);

                                $("#boxStatus").removeClass("active");
                            } else {
                                method.UI.setStatus("No annotation available.");
                            }

                            // Alert if there is reading error
                            if (result.failedList.length > 0) {
                                alert("READING_ERROR: " + result.failedList.join("\n"));
                            }

                        } else {
                            $("#boxStatusError").show();
                            $("#boxStatusText").text("No PDF document available.");

                        }
                    } else {
                        // alert("FOLDER_ERROR: " + directoryData.reason);
                        $("#boxStatusError").show();
                        $("#boxStatusText").text(directoryData.reason);
                    }


                } catch (error) {
                    alert("CHECK_ERROR: " + error);
                }

                // During initApp, only remove visilibility if directory is set
                $("#buttonRefresh").css("visibility", "unset");
                $("#boxStatusLoader").hide();
                $("#boxStatusText").removeClass("min-width");
            }

            // Enable menu
            method.UI.disabledMenu(false);
        }

    },
    attachDropListener: () => {

        // Attach listener to prevent default
        $("#sectionNavigation").on("dragenter dragover dragleave drop", null, (event) => {
            event.preventDefault();
            event.stopPropagation();
        });

        // Attach listener to enable highlight
        $("#sectionNavigation").on("dragenter dragover", null, (event) => {
            $("#sectionNavigation").addClass("highlight");
        });

        // Attach listener to disable highlight
        $("#sectionNavigation").on("dragleave drop", null, (event) => {
            $("#sectionNavigation").removeClass("highlight");
        });

        // Attach listener to get the dropped files
        $("#sectionNavigation").on("drop", null, (event) => {

            let fileList = [];
            for (const file of event.originalEvent.dataTransfer.files) {
                // Using the path attribute to get absolute file path
                // console.log('File Path of dragged files: ', file.path)
                fileList.push(file.path);
            }

            // Trigger only if filelist has content
            if (fileList.length > 0) {
                // Set directory path
                mainData.config.directoryList = fileList;

                // Update UI
                method.UI.setPath("buttonChooseDirectory", mainData.config.directoryList[0]); // Set initial path

                // Trigger directory check
                method.action.checkDirectory().then(() => {
                    window.backend.saveConfig(mainData.config);
                });
            }
        });
    },
    getEditorInfo: async (event) => {

        const documentPath = $(event.currentTarget).attr("data-document");
        mainData.editorData = documentPath;
        let documentInfo = await window.backend.getEditorInfo(documentPath);
        if (documentInfo.success === true) {
            method.UI.editorToggle();
            $("#editorInfoFilePath").text(documentPath);
            $("#editorBoxTitleInput").val(documentInfo.documentTitle);

            if (documentInfo.documentTitle === "") {
                $("#editorStatusText").html("<span><b>Info:</b> The title is currently empty</span>");
            }
        } else {
            alert(documentInfo.reason);
        }

        return false;
    },
    saveEditorInfo: async () => {
        // Disabled the button
        $("#buttonEditorSave").addClass("disabled");
        $("#buttonEditorCancel").addClass("disabled");
        // Add status text 
        $("#editorStatusText").text("Saving...");

        // Save document
        let result = await window.backend.saveEditorInfo(mainData.editorData, { documentTitle: $("#editorBoxTitleInput").val() });

        // Re-enable button
        $("#buttonEditorSave").removeClass("disabled");
        $("#buttonEditorCancel").removeClass("disabled");

        if (result.success === true) {
            method.UI.editorToggle();
            // Trigger directory check
            method.action.checkDirectory();
        } else {
            $("#editorStatusText").addClass("error").text(result.reason);
        }
    },
}


method.tool = {
    formatBytes: (bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes'

        const k = 1024
        const dm = decimals < 0 ? 0 : decimals
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

        const i = Math.floor(Math.log(bytes) / Math.log(k))

        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
    }
}


const annotationTableConfig = () => {
    return {
        dom: "rtip",
        deferRender: true,
        autoWidth: false,
        rowGroup: (mainData.config.groupAnnotations) ? {
            dataSrc: 2,
            startRender: function (rows, group) {
                // Add tooltip at rowgroup header
                return $(`<tr class="dtrg-group dtrg-start dtrg-level-0 editable-data" data-document="${rows.data().pluck(0)[0]}"><th colspan="4" scope="row">${group}</th></tr>`);
            },
        } : undefined,
        pageLength: mainData.config.pageLength,
        searchHighlight: true, // Enable SearchHighlight
        columnDefs: [
            { visible: false, target: (mainData.config.groupAnnotations) ? [0, 1, 2] : [0, 1] }, // Hide row
            { searchable: false, target: (mainData.config.groupAnnotations) ? [0, 1, 2, 3, 4] : [0, 1, 3, 4] }, // Disabled searching
            { className: "highlightable", target: [2, 5, 6] }, // Show search highlight style
            { className: "dbclick-table-row", target: [1, 2, 3, 4, 5, 6] }, // Enable double-click to openFile
            { className: "document-title", target: [2] }, // Enable document title styling
            { className: "annotation-content", target: [5] }, // Enable annotation-content styling

        ],
        language: {
            emptyTable: "No annotation available in this folder.",
            info: "Showing _START_ to _END_ of _TOTAL_ annotations",
            infoEmpty: "Showing 0 annotations",
            infoFiltered: "(filtered from _MAX_ total annotations)",
            zeroRecords: "No matching annotations found",
        },
        infoCallback: function (settings, start, end, max, total, pre) {

            // Replace text if paging is larger than existing total annotations
            if (mainData.config.pageLength === -1 || mainData.config.pageLength > total) {
                let textToReplace = `Showing ${start} to ${end} of ${total} annotations`;
                let textReplaceTo = `Showing ${total} annotations`;
                pre = pre.replace(textToReplace, textReplaceTo);

                // Hide pagination button
                $("#tableAnnotation_paginate").hide();
            } else {
                // Show pagination button
                $("#tableAnnotation_paginate").show();
            }

            $("#infoTableStats").text(pre);
        },
        drawCallback: function (settings) {

            // Add tooltip on annotations icons
            $("#tableAnnotation tbody span.material-icons-round.table-comment").attr("title", "Comment annotation");
            $("#tableAnnotation tbody span.material-icons-round.table-highlight").attr("title", "Highlight annotation");

            const api = this.api();
            const rows = api.rows({ page: "current" }).nodes();
            const documentTitleColumn = api.column(2, { page: "current" }).data();
            const totaldocumentTitleColumn = documentTitleColumn.length;
            const filePathColumn = api.column(0, { page: "current" }).data();

            // Add class for styling
            // Add transparent bottom row
            if (mainData.config.groupAnnotations === true) {

                let last = null;
                let getTopGroup = false;


                for (let index = 0; index < totaldocumentTitleColumn; index++) {
                    // Reset all class
                    $(rows).eq(index - 1).removeClass("group-top-row group-bottom-row");

                    if (last === null) { // Avoid first row
                        $(rows).eq(index).before(`<tr class="group-bottom-transparent-row top-group"><td colspan="4"></td></tr>`);
                        last = documentTitleColumn[index];
                        getTopGroup = true;

                    } else if (getTopGroup) { // Get the group-top-row(row after row-grouping)
                        // Add group-top styles
                        $(rows).eq(index - 1).addClass("group-top-row");
                        getTopGroup = false; // Reset flag
                    }

                    if (last !== documentTitleColumn[index]) {
                        // Add transparent row
                        $(rows).eq(index).before(`<tr class="group-bottom-transparent-row"><td colspan="4"></td></tr>`);

                        // Add group-bottom styles
                        $(rows).eq(index - 1).addClass("group-bottom-row");

                        last = documentTitleColumn[index];
                        getTopGroup = true;
                    }

                    if (totaldocumentTitleColumn === (index + 1)) { // Get last row
                        // $(rows).eq(index).after(`<tr class="group-last-row"><td colspan="3"></td></tr>`);
                    }
                }
            } else {
                // Add tooltip
                for (let index = 0; index < totaldocumentTitleColumn; index++) {
                    $(rows).eq(index).children().first().addClass("editable-data").attr("data-document", filePathColumn[index]);
                }
            }

            // Add pagination style and scroll to top
            $(".paginate_button").addClass("button").click(function () {
                if ($(this).hasClass("disabled") === false) {
                    $("#tableAnnotation_wrapper").animate({ scrollTop: 0 }, 250);
                }
            });
        },

    };
};


// Trigger initApp
window.addEventListener('load', async (event) => {
    method.initApp();
});

