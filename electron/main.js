const { app, BrowserWindow, ipcMain, BrowserView } = require('electron');
const path = require('path');

let mainWindow;
let currentBrowserView = null; // To hold our single BrowserView for now
let lastKnownBounds = null; // Store the last precise bounds received from React

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
        console.log('load-url received:', url);

        // Clean up previous BrowserView if it exists
        if (currentBrowserView) {
            mainWindow.removeBrowserView(currentBrowserView);
            currentBrowserView = null;
        }

        // Create a new BrowserView for the requested URL
        currentBrowserView = new BrowserView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            }
        });

        // Attach the new BrowserView to the main window
        mainWindow.setBrowserView(currentBrowserView);

        // Load the requested URL in the BrowserView
        currentBrowserView.webContents.loadURL(url);

        // --- Fix for DevTools dependency (positioning after load) ---
        // Position BrowserView ONLY after its content has finished loading
        currentBrowserView.webContents.on('did-finish-load', () => {
            console.log('main.js: BrowserView did-finish-load event fired.');
            if (lastKnownBounds) { // Use the most recently received bounds from React
                setBrowserViewBounds(lastKnownBounds);
            } else {
                console.warn('main.js: did-finish-load, but no lastKnownBounds. Visual alignment may be delayed. Try resizing window.');
                // Fallback: If for some reason lastKnownBounds is still null, try to get current main window bounds
                // This is a less precise fallback, but better than nothing.
                const { width, height } = mainWindow.getBounds(); // Get dimensions directly here for fallback
                setBrowserViewBounds({ x: 0, y: 0, width: width, height: height }); // Rough full-window bounds as fallback
            }
        });

        // Open DevTools for the BrowserView (for inspecting loaded websites)
        currentBrowserView.webContents.openDevTools();
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
} // CORRECT CLOSING BRACE FOR createWindow()


// --- Electron App Lifecycle Hooks (Outside createWindow) ---

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
    createWindow(); // This is where createWindow() is first called
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});