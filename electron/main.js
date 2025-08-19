const { app, BrowserWindow, ipcMain, BrowserView } = require('electron');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
let mainWindow;
let currentBrowserView = null; // To hold our single BrowserView for now
let lastKnownBounds = null; // Store the last precise bounds received from React
let workspaces = {
    'default-ws': {
        id: 'default-ws',
        name: 'Default Workspace',
        tabs: []
    }
};
let activeWorkspaceId = 'default-ws';
let activeTabId = null; // To track the currently active tab

// Helper function to set BrowserView bounds using the PRECISE bounds from React
function setBrowserViewBounds(bounds) {
    if (!currentBrowserView || !mainWindow || !bounds) {
        console.warn('setBrowserViewBounds: Pre-conditions not met (BrowserView/mainWindow/bounds missing).');
        return;
    }

    // Store these bounds for later use (e.g., if a new URL is loaded before React sends new bounds)
    lastKnownBounds = bounds;

    // --- The Rounding Trick ---
    // Make the BrowserView slightly smaller than the reported React element bounds.
    // This allows the rounded background of the React MainContent div to show through
    // and create the visual illusion of rounded corners for the loaded webpage.
    const BROWSERVIEW_CORNER_INSET = 4; // Adjust this value (e.g., 1 to 5 pixels) for visual perfection

    // Calculate BrowserView's final bounds based directly on React's reported bounds
    // The bounds.x, bounds.y, bounds.width, bounds.height should now represent the
    // full white area of the MainContent div. We only subtract the inset for rounding.
    const finalX = bounds.x + BROWSERVIEW_CORNER_INSET;
    const finalY = bounds.y + BROWSERVIEW_CORNER_INSET;
    const finalWidth = bounds.width - (BROWSERVIEW_CORNER_INSET * 2);
    const finalHeight = bounds.height - (BROWSERVIEW_CORNER_INSET * 2);

    currentBrowserView.setBounds({
        x: finalX,
        y: finalY,
        width: finalWidth,
        height: finalHeight
    });
    console.log('BrowserView bounds set to:', currentBrowserView.getBounds());
}



function attachBrowserViewListeners(browserView, tabId) {
    const webContents = browserView.webContents;

    const findTabById = (id) => {
        const activeWorkspace = workspaces[activeWorkspaceId];
        return activeWorkspace ? activeWorkspace.tabs.find(tab => tab.id === id) : null;
    };

    webContents.on('did-finish-load', () => {
        if (lastKnownBounds) setBrowserViewBounds(lastKnownBounds);
        const loadedTab = findTabById(tabId);
        if (loadedTab) {
            loadedTab.title = webContents.getTitle();
            loadedTab.url = webContents.getURL();
            sendTabsToRenderer();
        }
        if (activeTabId === tabId) {
            mainWindow.webContents.send('update-address-bar', webContents.getURL());
        }
    });

    webContents.on('page-title-updated', (event, title) => {
        const updatedTab = findTabById(tabId);
        if (updatedTab) {
            updatedTab.title = title;
            sendTabsToRenderer();
        }
    });

    webContents.on('did-navigate', (event, url) => {
        const navigatedTab = findTabById(tabId);
        if (navigatedTab) {
            navigatedTab.url = url;
            if (activeTabId === tabId) {
                mainWindow.webContents.send('update-address-bar', url);
                const securityStatus = url.startsWith('https://') ? 'secure' : 'insecure';
                mainWindow.webContents.send('security-status-updated', securityStatus);
            }
            sendTabsToRenderer();
        }
    });
}

function createAndActivateTab(url = `file://${path.join(__dirname, 'new-tab.html')}`) {
    console.log('main.js: Creating and activating new tab for URL:', url);

    if (currentBrowserView) {
        mainWindow.removeBrowserView(currentBrowserView);
    }

    const newTabId = uuidv4();
    const newBrowserView = new BrowserView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

    attachBrowserViewListeners(newBrowserView, newTabId);

    const newTab = {
        id: newTabId,
        url: url,
        title: url,
        browserView: newBrowserView,
        isActive: true
    };

    // 1. Get the currently active workspace.
    const activeWorkspace = workspaces[activeWorkspaceId];

    // 2. Deactivate all tabs within that workspace.
    activeWorkspace.tabs.forEach(tab => tab.isActive = false);

    // 3. Add the new tab to that workspace's tabs array.
    activeWorkspace.tabs.push(newTab);

    // 4. Update the global view and ID references.
    activeTabId = newTabId;
    currentBrowserView = newBrowserView;

    mainWindow.setBrowserView(currentBrowserView);
    currentBrowserView.webContents.loadURL(url);

    sendTabsToRenderer();
}

function activateTab(idToSwitchTo) {
    // 1. Get the currently active workspace.
    const activeWorkspace = workspaces[activeWorkspaceId];
    if (!activeWorkspace) return; // Safety check

    // 2. Find the target tab within the active workspace.
    const targetTab = activeWorkspace.tabs.find(tab => tab.id === idToSwitchTo);

    if (targetTab && !targetTab.isActive) {
        if (currentBrowserView) {
            mainWindow.removeBrowserView(currentBrowserView);
        }

        // 3. Deactivate all tabs in the active workspace.
        activeWorkspace.tabs.forEach(tab => tab.isActive = false);
        targetTab.isActive = true;

        // 4. Update global references (this logic remains the same).
        activeTabId = targetTab.id;
        currentBrowserView = targetTab.browserView;

        mainWindow.setBrowserView(currentBrowserView);
        if (lastKnownBounds) {
            setBrowserViewBounds(lastKnownBounds);
        }

        sendTabsToRenderer();
        console.log('main.js: Switched to tab ID:', idToSwitchTo);
    } else if (targetTab && targetTab.isActive) {
        console.log('main.js: Tab is already active:', idToSwitchTo);
    } else {
        console.warn('main.js: Attempted to activate non-existent tab:', idToSwitchTo);
    }
}

function sendTabsToRenderer() {
    if (mainWindow && mainWindow.webContents) {
        // 1. Get the currently active workspace.
        const activeWorkspace = workspaces[activeWorkspaceId];

        // 2. Add a safety check in case there is no active workspace.
        if (!activeWorkspace) {
            console.error(`sendTabsToRenderer: Could not find active workspace with ID: ${activeWorkspaceId}`);
            return;
        }

        // 3. Send the tabs from the active workspace to the renderer.
        mainWindow.webContents.send('tabs-updated', activeWorkspace.tabs.map(tab => ({
            id: tab.id,
            url: tab.url,
            title: tab.title,
            isActive: tab.isActive
        })));
        console.log('Tabs data sent to renderer for workspace', activeWorkspaceId, ':', activeWorkspace.tabs.length, 'tabs');
    }
}

ipcMain.handle('get-tabs', async () => {
    console.log('Renderer requested tabs data.');
    const activeWorkspace = workspaces[activeWorkspaceId];
    if (activeWorkspace) {
        return activeWorkspace.tabs.map(tab => ({
            id: tab.id,
            url: tab.url,
            title: tab.title,
            isActive: tab.isActive
        }));
    }
    return []; // Return an empty array if no active workspace
});


function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webviewTag: true
        },
        title: 'Nova Browser',
        frame: true
    });



    // --- IPC Main Listeners (These must be inside createWindow because they rely on mainWindow) ---
    ipcMain.handle('summarize-page', async () => {
        if (!currentBrowserView) {
            return "There is no active page to summarize.";
        }

        // 1. Initialize the Google AI client with your API key.
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // 2. Specify the model we want to use.
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        const webContents = currentBrowserView.webContents;

        try {
            // 3. Extract the text from the page, just like before.
            const pageText = await webContents.executeJavaScript('document.body.innerText');

            // 4. Create the prompt for the AI.
            const prompt = `Please provide a concise, easy-to-read summary of the following web page content. Focus on the key points and main ideas. Here is the content: "${pageText}"`;

            // 5. Send the prompt to the model and wait for the result.
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const summary = response.text();

            // 6. Return the AI's summary.
            return summary;

        } catch (error) {
            console.error("Error during AI summarization:", error);
            return "Sorry, an error occurred while summarizing the page.";
        }
    });

    ipcMain.handle('get-workspaces', async () => {
        return Object.values(workspaces).map(ws => ({ id: ws.id, name: ws.name }));
    });

    // ADD THIS BLOCK
    ipcMain.on('create-workspace', (event, name) => {
        const newId = uuidv4();
        workspaces[newId] = {
            id: newId,
            name: name,
            tabs: []
        };
        // For now, we'll just create it. Switching will be a separate step.
        sendWorkspacesToRenderer(); // We'll create this function next.
    });

    // Listener 1: Receive precise bounds from React's MainContent.js
    ipcMain.on('set-webview-bounds', (event, bounds) => {
        // Only attempt to set bounds if a BrowserView has already been created (i.e., a URL has been loaded)
        if (currentBrowserView) {
            setBrowserViewBounds(bounds);
        } else {
            // If BrowserView doesn't exist yet, just store the bounds for when it *does* get created
            lastKnownBounds = bounds;
            console.log('set-webview-bounds: BrowserView not yet created, storing bounds for later.');
        }
    });

    // Listener 2: When a URL is requested from the Address Bar
    ipcMain.on('load-url', (event, url) => {
        console.log('load-url received:', url);
        if (currentBrowserView) {
            currentBrowserView.webContents.loadURL(url);
            const activeWorkspace = workspaces[activeWorkspaceId];
            const activeTab = activeWorkspace.tabs.find(tab => tab.isActive); // <--- Corrected
            if (activeTab) {
                activeTab.url = url;
                sendTabsToRenderer();
            }
        } else {
            createAndActivateTab(url);
        }
    });

    ipcMain.on('create-new-tab', () => {
        // This now calls createAndActivateTab with no URL, 
        // so it will use the default file path we set up earlier.
        createAndActivateTab();
    });

    ipcMain.on('navigate-back', () => {
        if (currentBrowserView && currentBrowserView.webContents.canGoBack()) {
            currentBrowserView.webContents.goBack();
            console.log('Navigating back.');
        } else {
            console.log('Cannot go back: No BrowserView or no history.');
        }
    });

    ipcMain.on('navigate-forward', () => {
        if (currentBrowserView && currentBrowserView.webContents.canGoForward()) {
            currentBrowserView.webContents.goForward();
            console.log('Navigating forward.');
        } else {
            console.log('Cannot go forward: No BrowserView or no future history.');
        }
    });

    ipcMain.on('navigate-reload', () => {
        if (currentBrowserView) {
            currentBrowserView.webContents.reload();
            console.log('Reloading page.');
        } else {
            console.log('Cannot reload: No BrowserView present.');
        }
    });

    ipcMain.on('go-home', () => {
        if (currentBrowserView) {
            // You can define your home URL here, or make it configurable later.
            // For now, let's use the same default as new tabs.
            const homeUrl = `file://${path.join(__dirname, 'new-tab.html')}`;
            currentBrowserView.webContents.loadURL(homeUrl);
            console.log('Navigating to home page:', homeUrl);
        } else {
            console.log('Cannot go home: No BrowserView present. Creating new tab instead.');
            createAndActivateTab(`file://${path.join(__dirname, 'new-tab.html')}`); // Create a new tab if none exist
        }
    });

    ipcMain.on('toggle-browser-view-visibility', (event, isVisible) => {
        const activeWorkspace = workspaces[activeWorkspaceId];
        if (!activeWorkspace) return;
        const activeTab = activeWorkspace.tabs.find(tab => tab.id === activeTabId); // <--- Corrected
        if (activeTab && activeTab.browserView) {
            const view = activeTab.browserView;
            const window = BrowserWindow.getFocusedWindow();
            if (isVisible) {
                window.setBrowserView(view);
                if (lastKnownBounds) {
                    view.setBounds(lastKnownBounds);
                }
            } else {
                window.setBrowserView(null);
            }
        }
    });




    ipcMain.on('close-tab', (event, tabIdToClose) => {
        console.log(`main.js: Received request to close tab ${tabIdToClose}`);

        // 1. Get the currently active workspace.
        const activeWorkspace = workspaces[activeWorkspaceId];
        if (!activeWorkspace) return; // Safety check

        // 2. Find the tab to close within the active workspace.
        const tabToClose = activeWorkspace.tabs.find(tab => tab.id === tabIdToClose);
        if (!tabToClose) return;

        // 3. Destroy the tab's BrowserView.
        try {
            if (tabToClose.browserView && tabToClose.browserView.webContents) {
                mainWindow.removeBrowserView(tabToClose.browserView);
                tabToClose.browserView.webContents.destroy();
            }
        } catch (error) {
            console.error(`Failed to destroy BrowserView for tab ${tabIdToClose}:`, error);
        }

        // 4. Remove the tab from the active workspace's tabs array.
        const indexToRemove = activeWorkspace.tabs.findIndex(tab => tab.id === tabIdToClose);
        if (indexToRemove !== -1) {
            activeWorkspace.tabs.splice(indexToRemove, 1);
        }

        // 5. Activate the next available tab.
        if (activeWorkspace.tabs.length > 0) {
            // This logic remains mostly the same, just referencing the workspace tabs.
            const nextTab = activeWorkspace.tabs[Math.max(0, indexToRemove - 1)] || activeWorkspace.tabs[0];
            activateTab(nextTab.id); // Use our updated activateTab function
        } else {
            // If no tabs are left, create a new default tab.
            currentBrowserView = null;
            createAndActivateTab();
        }

        sendTabsToRenderer();
    });


    ipcMain.on('switch-tab', (event, idToSwitchTo) => {
        console.log('main.js: Request to switch to tab ID:', idToSwitchTo);
        // This now correctly calls our updated activateTab function
        activateTab(idToSwitchTo);
    });

    // Listen for main window resize events
    // MainContent.js already sends its bounds on resize, so setBrowserViewBounds
    // will be called via 'set-webview-bounds' listener. No direct action here.
    mainWindow.on('resize', () => {
        // No direct setBounds here. MainContent.js will send updated bounds
        // which will trigger the ipcMain.on('set-webview-bounds') listener.
        // This ensures pixel-perfect dynamic resizing.
        // You might see the BrowserView briefly lag as React measures, sends, and Electron applies.
        if (lastKnownBounds && currentBrowserView) { // if there are bounds AND a browser view is active, trigger
            setBrowserViewBounds(lastKnownBounds); // Re-apply the last known bounds directly
        }
    });

    // --- CRITICAL: These lines MUST be inside createWindow() ---
    // Load the React app's index.html
    mainWindow.loadFile(path.join(__dirname, '../react-frontend/build/index.html'));

    // Open the DevTools for the main window (your React UI)
    mainWindow.webContents.openDevTools();

    sendTabsToRenderer();
} // CORRECT CLOSING BRACE FOR createWindow()


// --- Electron App Lifecycle Hooks (Outside createWindow) ---

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
    createWindow(); // This is where createWindow() is first called
    // --- NEW LINE: Create and activate a default tab on launch ---
    createAndActivateTab(`file://${path.join(__dirname, 'new-tab.html')}`);

    sendTabsToRenderer();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});