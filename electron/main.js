const { app, BrowserWindow, ipcMain, BrowserView } = require('electron');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
let mainWindow;
let currentBrowserView = null; // To hold our single BrowserView for now
let lastKnownBounds = null; // Store the last precise bounds received from React
let tabs = [];
let activeTabId = null; // Track the currently active tab

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

    // Listener for when the page finishes loading
    webContents.on('did-finish-load', () => {
        console.log(`main.js: BrowserView did-finish-load event fired for tab: ${tabId}`);
        if (lastKnownBounds) {
            setBrowserViewBounds(lastKnownBounds);
        } else {
            console.warn('main.js: did-finish-load, but no lastKnownBounds. Visual alignment may be delayed. Trying default.');
            // Fallback for first load if bounds aren't ready yet
            const { width, height } = mainWindow.getBounds();
            // Assuming top bar height is roughly 80px (adjust if your header changes significantly)
            const headerHeight = 80;
            setBrowserViewBounds({ x: 0, y: headerHeight, width: width, height: height - headerHeight });
        }
        const loadedTab = tabs.find(tab => tab.id === tabId);
        if (loadedTab) {
            loadedTab.title = webContents.getTitle();
            loadedTab.url = webContents.getURL();
            sendTabsToRenderer();
            console.log(`main.js: Tab title updated (did-finish-load) for ${loadedTab.id}: ${loadedTab.title}`);
        }
        // If this tab is currently active, also update the address bar
        if (activeTabId === tabId && mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('update-address-bar', webContents.getURL());
        }
    });

    // Listener for when the page title changes dynamically
    webContents.on('page-title-updated', (event, title) => {
        const updatedTab = tabs.find(tab => tab.id === tabId);
        if (updatedTab) {
            updatedTab.title = title;
            updatedTab.url = webContents.getURL(); // URL might also update (e.g., hash changes)
            sendTabsToRenderer();
            console.log(`main.js: Page title updated for ${updatedTab.id}: ${updatedTab.title}`);
        }
    });

    // Listener for navigation events (e.g., clicking a link on the page)
    webContents.on('did-navigate', (event, url) => {
        const navigatedTab = tabs.find(tab => tab.id === tabId);
        if (navigatedTab) {
            navigatedTab.url = url;
            // If this tab is currently active, update the address bar immediately
            if (activeTabId === tabId && mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('update-address-bar', url);
            }
            sendTabsToRenderer(); // Send updated tabs list (just in case URL changed, though title update usually covers it)
            console.log(`main.js: Tab navigated for ${navigatedTab.id}: ${navigatedTab.url}`);
        }
    });

    // For development: Open dev tools for the BrowserView
    webContents.openDevTools();
}

function createAndActivateTab(url = 'https://nova.browser.com') { // Default to Nova's start page
    console.log('main.js: Creating and activating new tab for URL:', url);

    // Remove the previously active BrowserView from the window, if it exists
    if (currentBrowserView) {
        mainWindow.removeBrowserView(currentBrowserView);
    }

    // --- Tab and BrowserView Creation Logic (Refactored from load-url) ---
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
        title: url, // Initial title
        browserView: newBrowserView,
        isActive: true
    };

    tabs.forEach(tab => tab.isActive = false);
    tabs.push(newTab);
    activeTabId = newTabId;
    currentBrowserView = newBrowserView;

    mainWindow.setBrowserView(currentBrowserView);
    currentBrowserView.webContents.loadURL(url);

    sendTabsToRenderer(); // Inform renderer about the new active tab
}

function activateTab(idToSwitchTo) {
    const targetTab = tabs.find(tab => tab.id === idToSwitchTo);

    if (targetTab && !targetTab.isActive) {
        if (currentBrowserView) {
            mainWindow.removeBrowserView(currentBrowserView);
        }

        tabs.forEach(tab => tab.isActive = false);
        targetTab.isActive = true;

        activeTabId = targetTab.id;
        currentBrowserView = targetTab.browserView;

        mainWindow.setBrowserView(currentBrowserView);
        if (lastKnownBounds) {
            setBrowserViewBounds(lastKnownBounds);
        } else {
            console.warn('activateTab: No lastKnownBounds. BrowserView might not be positioned perfectly.');
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
        // Send the current list of tabs to the renderer process
        mainWindow.webContents.send('tabs-updated', tabs.map(tab => ({
            id: tab.id,
            url: tab.url,
            title: tab.title,
            isActive: tab.isActive
        })));
        console.log('Tabs data sent to renderer:', tabs.length, 'tabs');
    }
}

// Handler for when the renderer requests the current list of tabs
ipcMain.handle('get-tabs', async () => {
    console.log('Renderer requested tabs data.');
    return tabs.map(tab => ({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        isActive: tab.isActive
    }));
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
        console.log('load-url received:', url); // KEEP THIS LINE, it was part of previous block
        if (currentBrowserView) {
            // If so, load the URL in the existing, active tab.
            currentBrowserView.webContents.loadURL(url);
            // We also need to update the tab's data immediately since the load-url event
            // doesn't happen until later, which can cause a visual lag.
            const activeTab = tabs.find(tab => tab.isActive);
            if (activeTab) {
                activeTab.url = url; // Update the URL in our local tabs array
                sendTabsToRenderer(); // Send the updated list to the UI
            }
        } else {
            // If there are no tabs open, create a new one as a fallback.
            createAndActivateTab(url);
        }
    });

    ipcMain.on('create-new-tab', (event, url = 'https://nova.browser.com') => { // Default URL for new tab
        console.log('create-new-tab received: Requesting blank tab for URL:', url);
        createAndActivateTab(url); // Reuse our helper to create and load the new tab
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
            const homeUrl = 'https://nova.browser.com';
            currentBrowserView.webContents.loadURL(homeUrl);
            console.log('Navigating to home page:', homeUrl);
        } else {
            console.log('Cannot go home: No BrowserView present. Creating new tab instead.');
            createAndActivateTab('https://nova.browser.com'); // Create a new tab if none exist
        }
    });

    ipcMain.on('toggle-browser-view-visibility', (event, isDropdownOpen) => {
        console.log('main.js: Toggle BrowserView visibility to:', !isDropdownOpen);
        if (isDropdownOpen) {
            // Dropdown is open, so hide the BrowserView
            if (currentBrowserView) {
                mainWindow.removeBrowserView(currentBrowserView);
            }
        } else {
            // Dropdown is closed, so show the BrowserView again
            if (currentBrowserView) {
                mainWindow.setBrowserView(currentBrowserView);
                // CRITICAL: Re-apply the last known bounds to position it correctly
                if (lastKnownBounds) {
                    setBrowserViewBounds(lastKnownBounds);
                }
            }
        }
    });

    ipcMain.on('close-tab', (event, tabIdToClose) => {
        console.log(`main.js: Received request to close tab ${tabIdToClose}`);
        const tabToClose = tabs.find(tab => tab.id === tabIdToClose);

        if (!tabToClose) {
            console.warn(`main.js: No tab found with id ${tabIdToClose}`);
            return;
        }

        // DEBUG LOGGING
        console.log('main.js: Tab to close:', tabToClose);
        console.log('main.js: typeof tabToClose.browserView:', typeof tabToClose.browserView);
        console.log('main.js: instanceof BrowserView:', tabToClose.browserView instanceof BrowserView);

        try {
            if (
                tabToClose.browserView instanceof BrowserView &&
                tabToClose.browserView.webContents &&
                !tabToClose.browserView.webContents.isDestroyed()
            ) {
                mainWindow.removeBrowserView(tabToClose.browserView);
                tabToClose.browserView.destroy();
                console.log(`main.js: Destroyed BrowserView for tab ${tabIdToClose}`);
            } else {
                console.warn(`main.js: Skipped destroying. browserView is not valid for tab ${tabIdToClose}`);
            }
        } catch (error) {
            console.error(`main.js: Failed to destroy BrowserView for tab ${tabIdToClose}:`, error);
        }

        // Remove the tab from the tabs array
        const indexToRemove = tabs.findIndex(tab => tab.id === tabIdToClose);
        if (indexToRemove !== -1) {
            tabs.splice(indexToRemove, 1);
        }

        // Activate the next available tab if there are any left
        if (tabs.length > 0) {
            const nextTab = tabs[Math.max(0, indexToRemove - 1)] || tabs[0];
            nextTab.isActive = true;
            currentBrowserView = nextTab.browserView;
            mainWindow.setBrowserView(nextTab.browserView);
            if (lastKnownBounds) {
                setBrowserViewBounds(lastKnownBounds);
            } else {
                console.warn('close-tab: No lastKnownBounds. Using fallback bounds.');
                const { width, height } = mainWindow.getBounds();
                const fallbackBounds = { x: 0, y: 80, width, height: height - 80 };
                nextTab.browserView.setBounds(fallbackBounds);
            }

            nextTab.browserView.webContents.focus();
            console.log(`main.js: Switched to tab ${nextTab.id}`);
        } else {
            currentBrowserView = null;
        }

        // Update tabs state in renderer
        sendTabsToRenderer();
    });


    ipcMain.on('switch-tab', (event, idToSwitchTo) => {
        console.log('main.js: Request to switch to tab ID:', idToSwitchTo);

        // Find the tab to activate
        const targetTab = tabs.find(tab => tab.id === idToSwitchTo);

        if (targetTab && !targetTab.isActive) { // Check if tab exists and is not already active
            // 1. Remove currently active BrowserView (if any)
            if (currentBrowserView) {
                mainWindow.removeBrowserView(currentBrowserView);
            }

            // 2. Update active status in tabs array
            tabs.forEach(tab => tab.isActive = false); // Deactivate all
            targetTab.isActive = true; // Activate target tab

            // 3. Update global references
            activeTabId = targetTab.id;
            currentBrowserView = targetTab.browserView;

            // 4. Attach the new active BrowserView
            mainWindow.setBrowserView(currentBrowserView);

            // 5. Re-position the BrowserView using last known bounds
            if (lastKnownBounds) {
                setBrowserViewBounds(lastKnownBounds);
            } else {
                console.warn('switch-tab: No lastKnownBounds. BrowserView might not be positioned perfectly.');
            }

            mainWindow.webContents.send('update-address-bar', targetTab.url);

            // 6. Inform renderer that tabs have updated (visual change in active tab)
            sendTabsToRenderer();
            console.log('main.js: Switched to tab ID:', idToSwitchTo);
        } else if (targetTab && targetTab.isActive) {
            console.log('main.js: Tab is already active:', idToSwitchTo);
        } else {
            console.warn('main.js: Attempted to switch to non-existent tab:', idToSwitchTo);
        }
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
    createAndActivateTab('https://nova.browser.com');

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