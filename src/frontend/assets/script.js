"use strict";

const mainData = {
    tableAnnotation: undefined,
    config: undefined,
    tempConfig: undefined,
    platform: "unknown", // Possible value [win, mac, unix, linux, unknown]
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
        mainData.tableAnnotation = $("#tableAnnotation").DataTable({
            dom: "rtip",
            deferRender: true,
            autoWidth: false,
            fixedHeader: true,
            rowGroup: { dataSrc: 1 },
            pageLength: mainData.config.pageLength,
            searchHighlight: true, // Enable SearchHighlight
            ordering: false,
            columnDefs: [
                { visible: false, target: [0, 1] }, // Hide row
                { searchable: false, target: [0, 1, 2, 3] }, // Disabled searching
                { className: "dbclick-table-row", target: [2, 3, 4] }, // Enable double-click to openFile
                { className: "no-highlight", target: [2, 3] } // Prevent searchHighlight style
            ],
            language: {
                emptyTable: "No annotation available in this folder.",
                info: "Showing _START_ to _END_ of _TOTAL_ annotations",
                infoEmpty: "Showing 0 to 0 of 0 annotations",
                infoFiltered: "(filtered from _MAX_ total annotations)",
                zeroRecords: "No matching annotations found",
            },
            drawCallback: function (settings) {
                // Remove table header
                $("#tableAnnotation thead").remove();

                // Add bottom-row and transparent row
                let api = this.api();
                let rows = api.rows({ page: "current" }).nodes();
                let last = null;

                let columnData = api.column(1, { page: "current" }).data();
                let totalColumnData = columnData.length;
                for (let index = 0; index < totalColumnData; index++) {
                    if (last === null) { // Avoid first row
                        last = columnData[index];
                    }
                    else if (last !== columnData[index]) {
                        $(rows).eq(index).before(`<tr class="group-last-row"><td colspan="3"></td></tr>`).before(`<tr class="group-last-row-transparent"><td colspan="3"></td></tr>`);
                        last = columnData[index];
                    }

                    if (totalColumnData === (index + 1)) { // Get last row
                        $(rows).eq(index).after(`<tr class="group-last-row"><td colspan="3"></td></tr>`);
                    }
                }

                // Add pagination style and scroll to top
                $(".paginate_button").addClass("button").click(function () {
                    if ($(this).hasClass("disabled") === false) {
                        $("#sectionTable").animate({ scrollTop: 0 }, 250);
                    }
                });

            },

        });

        // Attach search button
        $("#inputSearchTable").keyup(function () {
            mainData.tableAnnotation.search($(this).val()).draw();
        })

        // Attach table row click listener
        $("#tableAnnotation").on("dblclick", ".dbclick-table-row", method.action.openFile);

        // Attach listener for screen-resize
        $(window).on('resize', method.UI.resizeBox);

        // Attach listener for button ripple effect
        $(".button").click(method.UI.ripple);

        // Attach listener for paging button
        $("#buttonSetPageLength").click(method.config.setPageLength);

        // Attach listener for menu button switch
        $(".menu-button.switch").click(method.UI.onSwitchClick);

        // Attach listener for menu toggle
        $("#buttonMenuToggle").click(method.UI.menuToggle);

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

        // Trigger resize
        method.UI.resizeBox(); // Only trigger after initPlatform()

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
        var isButtonDeactivated = (element.attr("deactivated") === "true");
        var isButtonDisabled = element.hasClass("disabled");

        // Check button condition
        if (isButtonDeactivated || isButtonDisabled) {
            // do nothing 

        } else {
            // Append ripple span
            var span = $(`<span class="ripple"/>`);
            span.appendTo(element).css({ left: x, top: y });

            if (isButtonRestricted) {
                // Append deactivated
                element.attr("deactivated", "true");

                // Attach self-destruct & activator
                setTimeout(function () { span.remove(); element.removeAttr("deactivated"); }, 1000);

            } else {
                // Attach self-destruct
                setTimeout(function () { span.remove(); }, 1000);
            }
        }
    },
    menuToggle: () => {
        if ($("#buttonMenuToggle").hasClass("disabled") === false) { // Prevent double-trigger
            if ($("#sectionInfo").hasClass("active") === true) { // Hide the menu
                $("#buttonMenuToggle").removeClass("active").children("span.menu-button-icon").text("menu");
                $("#sectionInfo").removeClass("active");

                $("#buttonChooseDirectory").removeClass("disabled");

                if (mainData.config.directoryList.length > 0) {
                    $("#buttonRefresh").css("visibility", "unset");

                    // Trigger directoryCheck if switch change
                    if ((mainData.config.enableRecursive !== mainData.tempConfig.enableRecursive) ||
                        (mainData.config.showTitle !== mainData.tempConfig.showTitle) ||
                        (mainData.config.trimNewline !== mainData.tempConfig.trimNewline)) {
                        method.action.checkDirectory();
                    }
                }


            } else { // Show the menu
                // Get temp config
                mainData.tempConfig = Object.assign({}, mainData.config);

                // Set UI
                $("#buttonMenuToggle").addClass("active").children("span.menu-button-icon").text("close");
                $("#sectionInfo").addClass("active");

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
        method.UI.setSwitch("enableRecursive", mainData.config.enableRecursive);
        method.UI.setSwitch("showTitle", mainData.config.showTitle);
        method.UI.setSwitch("trimNewline", mainData.config.trimNewline);

        // Init statInfo
        method.UI.setStatInfo(0, 0, 0);

        // Init pageLength
        method.UI.setPageLength(false);

        // Reset table search value
        mainData.tableAnnotation.search("").draw();

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
    resizeBox: () => { // Resize the sectionTable
        let padding = 1 * parseFloat(getComputedStyle(document.documentElement).fontSize); // Padding for 1rem;

        let headerHeight = + $("#sectionMenu").outerHeight();

        // Add TitleBar height if in windows or macos
        if (mainData.platform === "win" || mainData.platform === "mac") {
            headerHeight += $("#containerTitleBar").outerHeight();
        }

        $("#sectionTable").height(window.innerHeight - headerHeight - (padding * 2)); // Padding: 2rem;
        $("#sectionInfo").height(window.innerHeight - headerHeight - padding);
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
        const element = $(`.menu-button.switch[data-key="${key}"]`);

        if (switchOn) {
            element.attr("data-state", "on");
            element.children("span.menu-button-icon").text("check_box");
        } else {
            element.attr("data-state", "off");

            element.children("span.menu-button-icon").text("check_box_outline_blank");
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
    setPageLength: (drawTable = true) => {
        if (mainData.config.pageLength === -1) { // Show All and Hide Pagination 
            $("#infoPageLength").text("All");
            $("#tableAnnotation_paginate").hide();
        } else {
            $("#infoPageLength").text(mainData.config.pageLength);
            $("#tableAnnotation_paginate").show();
        }

        // TODO: Check if pageLength already exceed rowCount (filtered), hence only have 1 page -> So can hide the paging button

        if (drawTable === true) {
            mainData.tableAnnotation.page.len(mainData.config.pageLength).draw();
        }
    },
    disabledMenu: (disabled) => {
        if (disabled === true) {
            $("#buttonMenuToggle").addClass("disabled");
            $("#buttonChooseDirectory").addClass("disabled");
            $("#buttonRefresh").addClass("disabled");
        } else {
            $("#buttonMenuToggle").removeClass("disabled");
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
    showAppLicense: () => {
        const LICENSE = `
            NoteFinder - Search comment and highlight annotations in PDF documents.
            Copyright (C) 2022 Irsyad Ler

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

        alert (LICENSE);
    }
}


method.action = {
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
        let result = window.backend.openFile(mainData.config, rowData[0], rowData[2]); // TODO: check ape kesan ni?
        console.log(result);
    },
    checkDirectory: async () => {

        if ($("#buttonRefresh").hasClass("disabled") === false) { // Prevent double-trigger
            // Reset table search and content
            mainData.tableAnnotation.search("").clear().draw();
            // Reset table search box and info
            $("#inputSearchTable").val("");
            method.UI.setStatInfo(0, 0, 0);

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
                                method.UI.setStatInfo(directoryData.statCounter.file, directoryData.statCounter.byte, result.annotationList.length);

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
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, function (event) {
                event.preventDefault();
                event.stopPropagation();
            }, false);
        });

        // Attach listener to enable highlight
        ['dragenter', 'dragover'].forEach(eventName => {
            document.addEventListener(eventName, function (event) {
                document.getElementById("sectionMenu").classList.add('highlight');
            }, false);
        });

        // Attach listener to disable highlight
        ['dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, function (event) {
                document.getElementById("sectionMenu").classList.remove('highlight');
            }, false);
        });


        // Attach listener to get the dropped files
        document.addEventListener("drop", async (event) => {

            let fileList = [];
            for (const file of event.dataTransfer.files) {
                // Using the path attribute to get absolute file path
                console.log('File Path of dragged files: ', file.path)
                fileList.push(file.path);
            }

            // Set directory path
            mainData.config.directoryList = fileList;

            // Update UI
            method.UI.setPath("buttonChooseDirectory", mainData.config.directoryList[0]); // Set initial path

            // Trigger directory check
            method.action.checkDirectory().then(() => {
                window.backend.saveConfig(mainData.config);
            });

        });
    }
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


// Trigger initApp
window.addEventListener('load', async (event) => {
    method.initApp();
});

