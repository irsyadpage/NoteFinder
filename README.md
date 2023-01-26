<p align="center">
  <img src="https://raw.githubusercontent.com/irsyadler/NoteFinder/main/src/frontend/assets/images/logo-full-dark.svg" width="400" alt="NoteFinder Logo">
</p>

<p align="center">An application for searching comments and highlights annotations in PDF documents.</p>



## 📝 Features
- Search **all PDF documents** in the given folder.
  - Examine the documents' **commented annotation**.
  - Examine the documents' **highlighted annotation** (see [Limitations](#Limitations)).
- **List all found annotations with related information**: PDF filename, annotation's page number, annotation type, and annotation content.
- Keyword Filtering: Users can **type keywords to filter** the comments and highlighted texts.
- Double-click to open: Users can **open the annotated PDF document** by double-clicking an annotation.
- Open-at-page: Open annotated PDF documents **at a specific page number** of the annotation content (for Windows users & Adobe Acrobat Reader).
- **Drag-and-drop** a files or folders containing PDF documents into the application (for Windows users).
- Group Annotations: Group annotations list per PDF document.
- PDF Document Title Editor: Right-click on a document filename/title to edit the PDF document title.

<p align="center">
  Screenshot of NoteFinder Application:
  <br>
  <img src="https://raw.githubusercontent.com/irsyadler/NoteFinder/main/docs/screenshot-v0.8.5-1.png" width="700" alt="NoteFinder Application Screenshot">
</p>



## 🤷‍♂️ But Why?
While doing my research, I use a lot of annotations (highlights and comments) in the PDF documents as a method of taking notes. The problem arises when I search for the highlights and comments I put in the PDF documents. I have over 400 documents, and checking them one by one every time to find a note is improbable. Although [EndNote](https://endnote.com/) provides a field for document notes, there could be more than ten notes per document. Hence, shuffling all information into a single tiny field is inconvenient. Also, EndNote does not provide a text-highlighting feature.

On the other hand, [Mendeley Desktop App](https://www.mendeley.com/) does provide annotation searching. However, it only works for annotations that are created in the application. Existing annotation using other PDF reader apps, such as [Adobe Acrobat Reader](https://get.adobe.com/reader/), would not appear in the search result. To make matter difficult, annotations created in the Mendeley stays in Mendeley and does not apply to the original PDF document. Hence, I need to export the document if I want to see the annotations outside Mendeley Desktop App. If a new annotation is added, another export is required. 

Therefore, these problems limit the portability and ease of access to my notes (highlight and comments). Besides, Windows Search does not provide such capabilities to search for PDF annotations.


## ℹ️ Download & How to Use
1. Download the latest [NoteFinder release](https://github.com/irsyadler/NoteFinder/releases/).
2. Open the downloaded executable (`.exe` for Windows) or extract the archive (`.tar.gz` for macOS and Linux) to open the executable.
3. Choose a folder containing PDF documents for annotations searching by clicking the `Choose PDF Folder` button on the top. Users may also drag-and-drop a folder/files containing PDF documents into the NoteFinder application.
4. NoteFinder will start searching PDF annotations in the chosen folder. Scanning and analysing each document might take time if the folder contains many PDF documents. Only PDF documents containing annotations (comments or highlights) will appear in the annotations table.
5. Double-click on an annotation row to open the related PDF documents.

Note: To enable the open-at-page feature, a user needs to click the top-left `≡` button. Then, click the `Choose PDF Application Executable` button to set the Adobe Acrobat Reader's executable location. An example of Adobe Acrobat Reader executable location is `C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe`.

**Important**: The NoteFinder is tested in Windows and Linux environments. Unexpected bugs might appear in macOS. 
 
#### PDF Document Title Editor (⚠️ Please read before use ⚠️)

The PDF document editor feature enables users to edit a document's title. It is difficult to do with popular PDF viewers such as Adobe Acrobat Reader, Google Chrome, or Microsoft Edge. However, the edit feature will re-generate the document using [pdf-lib](https://pdf-lib.js.org/). Although it is unlikely, a re-generated document may contain errors or corrupted data where it will no longer be accessible or readable. Hence, NoteFinder will make a backup copy of an original PDF document before the new document title is applied to ensure the original file remains unchanged. The backup file name is similar to the existing document with the ending `.pdf.backup.` To open this backup file, rename the file to remove the `.backup` extension.


## 🧪 Development & Testing
NoteFinder is developed and tested on Windows (32/64 bit) environment. But all necessary items (including icon files) are already in place for other platform distributions. To develop and test the NoteFinder, please do the following:
1. Ensure the [Node.js](https://nodejs.org/en/) version `18.12.1` or later is installed on the system.
2. Download the source code or clone this repository by executing the following commands:
    - `git clone https://github.com/irsyadler/NoteFinder`
    - `cd NoteFinder`
3. In the source code directory, run the `npm install` command to install all necessary dependencies.
4. To start the NoteFinder, run the `npm start` command.

#### Notable Code Structure
- The [src/frontend/](src/frontend/) directory contains all the files related to NoteFinder's user interface (renderer process).
- The [src/backend/](src/backend/) directory contains all the files related to NoteFinder's Node.js environment (main process).
- The `getPageAnnotation()` function in [src/backend/data.js](src/backend/data.js) defines the annotations data extraction from a PDF document.
- The [resources/](resources/) directory contains the build resources uses to build the NoteFinder application.

#### Build Application Distribution
- NoteFinder primarily uses [Electron Builder](https://github.com/electron-userland/electron-builder) to generate the application distribution.
- To build a distribution, run the `npx electron-builder` command inside the source code directory. This command will generate a NoteFinder distribution in the [dist/](dist/) directory.
- For custom build commands, please refer to [Electron Builder - CLI](https://www.electron.build/cli). 

#### Local Files
NoteFinder store configuration data and logs persistently. These files can be found in the following:
- Windows: `%USERPROFILE%\AppData\Roaming\NoteFinder\`
- macOS: `~/Library/Application Support/NoteFinder/`
- Linux: `~/.config/NoteFinder/`


## 🚩 Limitations
- The date localisation is not properly tested. A messy date string format might appears based on the user localisation.
- Currently, right-click context menu for copy/paste/cut operations is disabled. Only keyboard shortcuts ([Windows](https://support.microsoft.com/en-us/topic/keyboard-shortcut-to-copy-and-paste-in-word-e0e561c3-02fe-f256-7b19-dabef7b879e1) / [macOS](https://support.apple.com/en-us/HT209651)) for these operations are enabled.
- The open-at-page feature **only works for [Adobe Acrobat Reader](https://get.adobe.com/reader/) in Windows**. Further refinement needs to be implemented to support other PDF reader applications and platforms.
- NoteFinder obtains a highlighted-text annotation by measuring the highlight's rectangle area (`x` & `y` coordinate). Therefore, the following issues arise:
  - The highlight annotation might show an empty text because the highlighted's rectangle area was smaller than the text-rectangle area defined in the PDF document.


## ©️ Licensing
NoteFinder is available under the [AGPL-3.0-only](LICENSE) license.


## 📧 Contact 
For any inquiries please contact: `contact [at] irsyadler [dot] com`.