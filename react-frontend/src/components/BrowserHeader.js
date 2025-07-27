import React, { useState, useEffect } from 'react';
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

    const handleNewTabClick = () => {
        if (window.electron && window.electron.createNewTab) {
            // Tell Electron to create a new tab, loading a default page
            window.electron.createNewTab('https://nova.browser.com'); // Or 'about:blank' for a truly blank page
            console.log('BrowserHeader: Requesting new tab.');
        } else {
            console.error('window.electron.createNewTab is not defined. Preload script issue?');
        }
    };

    // NEW: Function to select all text when address bar is focused/clicked
    const handleAddressBarFocus = (event) => {
        event.target.select(); // Selects all text in the input field
    };

    const handleTabClick = (id) => {
        if (window.electron && window.electron.switchTab) {
            window.electron.switchTab(id); // Tell Electron to activate this tab ID
            console.log('BrowserHeader: Requesting tab switch to:', id);
        } else {
            console.error('window.electron.switchTab is not defined. Preload script issue?');
        }
    };

    const [tabsState, setTabsState] = useState([]); // State to hold the array of tab objects
    const [activeTabIdState, setActiveTabIdState] = useState(null); // State to hold the ID of the active tab
    // --- END NEW REACT STATE ---

    // --- NEW useEffect FOR TAB DATA FETCHING & LISTENING - ADD THIS useEffect BLOCK HERE ---
    useEffect(() => {
        // Function to fetch initial tabs data from Electron
        const fetchInitialTabs = async () => {
            if (window.electron && window.electron.getTabs) {
                const initialTabs = await window.electron.getTabs();
                setTabsState(initialTabs);
                const currentActive = initialTabs.find(tab => tab.isActive);
                if (currentActive) {
                    setActiveTabIdState(currentActive.id);
                }
                console.log('BrowserHeader: Fetched initial tabs:', initialTabs);
            }
        };

        // Function to handle updates from Electron when tabs change
        const handleTabsUpdated = (tabsData) => {
            setTabsState(tabsData);
            const currentActive = tabsData.find(tab => tab.isActive);
            if (currentActive) {
                setActiveTabIdState(currentActive.id);
            }
            console.log('BrowserHeader: Tabs updated from main process:', tabsData);
        };

        fetchInitialTabs(); // Call on component mount to get initial tabs

        // Subscribe to tabs updates from Electron
        if (window.electron && window.electron.onTabsUpdated) {
            window.electron.onTabsUpdated(handleTabsUpdated);
        }

        // Cleanup function: Unsubscribe from the event when the component unmounts
        return () => {
            if (window.electron && window.electron.onTabsUpdated) {
                // Note: Electron's ipcRenderer.removeListener can be complex with named functions,
                // For simplicity, we assume this component persists. For dynamic components, proper unsubscribe is needed.
                // For now, this line is a placeholder for proper cleanup in a more complex app.
                // ipcRenderer.removeListener('tabs-updated', handleTabsUpdated);
            }
        };
    }, []);




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

            {/* Tabs Container */}
            <div className="tabs-container">
                {tabsState.map(tab => (
                    <div
                        key={tab.id}
                        // MODIFIED LINE: Ensure active-tab class is applied and onClick is set
                        className={`tab ${tab.id === activeTabIdState ? 'active-tab' : ''}`}
                        onClick={() => handleTabClick(tab.id)} // This connects the click to the function
                    >
                        {tab.title}
                    </div>
                ))}
                <div className="tab new-tab-button" onClick={handleNewTabClick}>
                    + {/* Placeholder for New Tab Button */}
                </div>
            </div>
        </header>
    );
}

export default BrowserHeader;