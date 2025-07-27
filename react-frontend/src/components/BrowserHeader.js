import React from 'react';
import './BrowserHeader.css';
import { IoIosArrowBack, IoIosArrowForward, IoMdRefresh } from 'react-icons/io';

function BrowserHeader() {
    // Function to handle when the user presses a key in the address bar
    const handleAddressBarKeyDown = (event) => {
        // Check if the pressed key is 'Enter'
        if (event.key === 'Enter') {
            let url = event.target.value; // Get the text from the input field
            // --- NEW AUTO-PREFIXING LOGIC ---
            // Check if the URL starts with a protocol, if not, prepend 'https://'
            if (!url.startsWith('http://') && !url.startsWith('https://') && url.includes('.')) {
                url = 'https://' + url;
            }
            // Basic search fallback: if it doesn't look like a URL, assume it's a search query
            // This is a simplified fallback; a real browser would send to a search engine
            if (!url.includes('.') && url.trim().length > 0) {
                // For now, let's make it load a Google search. Later, this will be AI-enhanced search.
                url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
            }
            // --- END NEW AUTO-PREFIXING LOGIC ---
            // Check if window.electron.loadURL exists (exposed by preload.js)
            if (window.electron && window.electron.loadURL) {
                // Call the Electron main process to load the URL
                window.electron.loadURL(url);
                console.log(`Loading URL: ${url}`); // For debugging in React DevTools
            } else {
                console.error('window.electron.loadURL is not defined. Preload script issue?');
            }
        }
    };

    const handleGoBack = () => {
        if (window.electron && window.electron.goBack) {
            window.electron.goBack();
            console.log('Requesting navigation back.'); // Console log for debugging
        } else {
            console.error('window.electron.goBack is not defined. Preload script issue?');
        }
    };

    const handleGoForward = () => {
        if (window.electron && window.electron.goForward) {
            window.electron.goForward();
            console.log('Requesting navigation forward.'); // Console log for debugging
        } else {
            console.error('window.electron.goForward is not defined. Preload script issue?');
        }
    };

    const handleReload = () => {
        if (window.electron && window.electron.reload) {
            window.electron.reload();
            console.log('Requesting page reload.'); // Console log for debugging
        } else {
            console.error('window.electron.reload is not defined. Preload script issue?');
        }
    };

    // NEW: Function to select all text when address bar is focused/clicked
    const handleAddressBarFocus = (event) => {
        event.target.select(); // Selects all text in the input field
    };


    return (
        <header className="browser-header">
            <div className="nav-buttons">
                <button className="nav-button" onClick={handleGoBack}>
                    <IoIosArrowBack /> {/* Back Arrow Icon */}
                </button>
                <button className="nav-button" onClick={handleGoForward}>
                    <IoIosArrowForward /> {/* Forward Arrow Icon */}
                </button>
                <button className="nav-button" onClick={handleReload}>
                    <IoMdRefresh /> {/* Refresh Icon */}
                </button>
            </div>

            {/* The Address Bar */}
            <div className="address-bar-container">
                <input
                    type="text"
                    className="address-bar"
                    placeholder="Search or type URL..."
                    defaultValue="https://nova.browser.com" // Default to a valid URL for testing
                    onKeyDown={handleAddressBarKeyDown} // Attach the keydown event listener
                    onFocus={handleAddressBarFocus}
                />
            </div>

            {/* Placeholder for Tabs - will add later */}
            <div className="tabs-placeholder">
                <p>Tabs Placeholder</p>
            </div>
        </header>
    );
}

export default BrowserHeader;