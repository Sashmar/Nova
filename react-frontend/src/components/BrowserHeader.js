import React, { useState, useEffect, useRef } from 'react';

import './BrowserHeader.css';
import { IoIosArrowBack, IoIosArrowForward, IoMdRefresh, IoMdHome, IoMdList, IoMdLock, IoMdWarning } from 'react-icons/io';
import { IoBriefcase } from "react-icons/io5";
const hideBrowserView = () => {
    if (window.electron?.toggleBrowserViewVisibility) {
        window.electron.toggleBrowserViewVisibility(false);
    }
};

const showBrowserView = () => {
    if (window.electron?.toggleBrowserViewVisibility) {
        window.electron.toggleBrowserViewVisibility(true);
    }
};


function BrowserHeader({ onActiveTabChange }) {
    // BrowserHeader.js (at the top of the function)

    const [securityStatus, setSecurityStatus] = useState('secure');
    const dropdownRef = useRef(null);
    const workspaceMenuRef = useRef(null);
    const [workspaces, setWorkspaces] = useState([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);

    const [isWsPromptOpen, setIsWsPromptOpen] = useState(false);
    const [wsName, setWsName] = useState('');
    const wsInputRef = useRef(null);

    useEffect(() => {
        if (isWsPromptOpen) {
            hideBrowserView();
            setTimeout(() => wsInputRef.current?.focus(), 0);
        } else {
            showBrowserView();
        }
    }, [isWsPromptOpen]);
    // Function to handle when the user presses a key in the address bar
    const handleAddressBarKeyDown = (event) => {
        // Check if the pressed key is 'Enter'
        if (event.key === 'Enter') {
            let url = addressBarValue; // Get the text from the input field
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

    const handleGoHome = () => {
        if (window.electron && window.electron.goHome) {
            window.electron.goHome();
            console.log('Requesting navigation to home.');
        } else {
            console.error('window.electron.goHome is not defined. Preload script issue?');
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

    const handleCreateWorkspace = () => {
        setIsWsPromptOpen(true); // open the modal
    };

    const confirmCreateWorkspace = () => {
        const name = wsName.trim();
        if (!name) {
            setIsWsPromptOpen(false);
            setWsName('');
            return;
        }
        window.electron?.createWorkspace?.(name);
        setIsWsPromptOpen(false);
        setWsName('');
    };

    const cancelCreateWorkspace = () => {
        setIsWsPromptOpen(false);
        setWsName('');
    };
    const handleSwitchWorkspace = (id) => {
        if (window.electron?.switchWorkspace) {
            window.electron.switchWorkspace(id);
            setIsWorkspaceMenuOpen(false); // Close the menu after switching
        }
    };

    const handleNewTabClick = () => {
        if (window.electron && window.electron.createNewTab) {
            // Tell Electron to create a new tab, loading a default page
            window.electron.createNewTab();
            console.log('BrowserHeader: Requesting new tab.');
        } else {
            console.error('window.electron.createNewTab is not defined. Preload script issue?');
        }
    };


    const handleCloseTab = (id, event) => {
        console.log(`BrowserHeader: handleCloseTab called. ID to close: ${id}`);
        if (event) {
            event.stopPropagation();
        }
        if (window.electron && window.electron.closeTab) {
            window.electron.closeTab(id);
            console.log('BrowserHeader: Requesting to close tab:', id);
        } else {
            console.error('window.electron.closeTab is not defined. Preload script issue?');
        }
    };

    // NEW: Function to select all text when address bar is focused/clicked
    const handleAddressBarFocus = (event) => {
        event.target.select(); // Selects all text in the input field

        // --- NEW/MODIFIED LOGIC: Ensure address bar shows active tab's URL on focus ---
        const currentActiveTab = tabsState.find(tab => tab.isActive);
        if (currentActiveTab && addressBarValue !== currentActiveTab.url) {
            setAddressBarValue(currentActiveTab.url);
        }
    };

    const handleTabClick = (id) => {
        if (window.electron && window.electron.switchTab) {
            window.electron.switchTab(id);
            setIsDropdownOpen(false);
            console.log('BrowserHeader: Requesting tab switch to:', id);
        } else {
            console.error('window.electron.switchTab is not defined. Preload script issue?');
        }
    };

    const [tabsState, setTabsState] = useState([]); // State to hold the array of tab objects
    const [activeTabIdState, setActiveTabIdState] = useState(null); // State to hold the ID of the active tab
    const [addressBarValue, setAddressBarValue] = useState('https://nova.browser.com');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);

    const handleDropdownToggle = () => {
        const newDropdownState = !isDropdownOpen;
        setIsDropdownOpen(newDropdownState);

        if (window.electron && window.electron.toggleBrowserViewVisibility) {
            window.electron.toggleBrowserViewVisibility(!newDropdownState);
            // Hide view if dropdown is open
        }
    };

    const handleDropdownOpen = () => {
        setIsDropdownOpen(true);
        hideBrowserView(); // Hide web content when dropdown is open
    };

    const handleDropdownClose = () => {
        setIsDropdownOpen(false);
        showBrowserView(); // Show web content again when dropdown is closed
    };

    const handleWorkspaceMenuToggle = () => {
        const newState = !isWorkspaceMenuOpen;
        setIsWorkspaceMenuOpen(newState);

        if (newState) {
            hideBrowserView(); // hide page while menu is open
        } else {
            showBrowserView(); // show page again
        }
    };

    // --- END NEW REACT STATE ---

    // --- NEW useEffect FOR TAB DATA FETCHING & LISTENING - ADD THIS useEffect BLOCK HERE ---
    useEffect(() => {
        const fetchInitialTabs = async () => {
            if (window.electron && window.electron.getTabs) {
                const initialTabs = await window.electron.getTabs();
                setTabsState(initialTabs);
                const currentActive = initialTabs.find(tab => tab.isActive);
                window.electron.onSecurityStatusUpdated(setSecurityStatus);
                if (currentActive) {
                    setActiveTabIdState(currentActive.id);
                    setAddressBarValue(currentActive.url);
                }
                console.log('BrowserHeader: Fetched initial tabs:', initialTabs);
            }
        };

        const fetchInitialWorkspaces = async () => {
            if (window.electron?.getWorkspaces) {
                const initialWorkspaces = await window.electron.getWorkspaces();
                setWorkspaces(initialWorkspaces);
                // Assuming the first one is active for now
                if (initialWorkspaces.length > 0) {
                    setActiveWorkspaceId(initialWorkspaces[0].id);
                }
            }
        };

        const handleTabsUpdated = (tabsData) => {
            setTabsState(tabsData);
            const currentActive = tabsData.find(tab => tab.isActive);
            if (currentActive) {
                setActiveTabIdState(currentActive.id);
                setAddressBarValue(currentActive.url);
                onActiveTabChange(currentActive.url);
            } else {
                setAddressBarValue('nova://newtab');
                onActiveTabChange('nova://newtab');
            }
            console.log('BrowserHeader: Tabs updated from main process:', tabsData);
        };

        const handleWorkspacesUpdated = (workspacesData) => {
            setWorkspaces(workspacesData);

            if (workspacesData.length > 0 && !workspacesData.find(ws => ws.id === activeWorkspaceId)) {
                setActiveWorkspaceId(workspacesData[0].id);
            }
        };

        const handleAddressBarUpdate = (url) => {
            setAddressBarValue(url);
            console.log('BrowserHeader: Address bar updated from main process:', url);
        };

        const handleClickOutside = (event) => {
            // Check for tab dropdown
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
                showBrowserView();
            }
            // Check for workspace menu
            if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target)) {
                setIsWorkspaceMenuOpen(false);
                showBrowserView();
            }
        };

        fetchInitialTabs();
        fetchInitialWorkspaces();
        if (window.electron) {
            window.electron.onTabsUpdated(handleTabsUpdated);
            window.electron.onWorkspacesUpdated(handleWorkspacesUpdated);
            window.electron.onUpdateAddressBar(handleAddressBarUpdate);
        }

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            if (window.electron) {
                // ipcRenderer.removeListener('tabs-updated', handleTabsUpdated);
                // ipcRenderer.removeListener('update-address-bar', handleAddressBarUpdate);
            }
        };
    }, [onActiveTabChange]);




    return (
        <div className="header-container">
            <header className="browser-header">
                <div className="nav-buttons">
                    <button className="nav-button" onClick={handleGoBack}>
                        <IoIosArrowBack />
                    </button>
                    <button className="nav-button" onClick={handleGoForward}>
                        <IoIosArrowForward />
                    </button>
                    <button className="nav-button" onClick={handleReload}>
                        <IoMdRefresh />
                    </button>
                    <button className="nav-button" onClick={handleWorkspaceMenuToggle}>
                        <IoBriefcase />
                    </button>
                    <button
                        className="nav-button tab-list-button"
                        onClick={() => {
                            isDropdownOpen ? handleDropdownClose() : handleDropdownOpen();
                        }}
                    >

                        <IoMdList />
                    </button>
                    <button className="nav-button new-tab-button" onClick={handleNewTabClick}>
                        +
                    </button>
                </div>

                {tabsState.find(tab => tab.isActive) && (
                    <div
                        className="active-tab-pill"
                        onClick={handleDropdownToggle}
                    >
                        <span className="active-tab-title">
                            {tabsState.find(tab => tab.isActive).title}
                        </span>
                        <button
                            className="tab-close-button"
                            onClick={(event) => handleCloseTab(activeTabIdState, event)}
                        >
                            &times;
                        </button>
                    </div>
                )}
                <div className="security-icon-container">
                    {securityStatus === 'secure' ? (
                        <IoMdLock className="security-icon secure" />
                    ) : (
                        <IoMdWarning className="security-icon insecure" />
                    )}
                </div>

                <div className="address-bar-container">
                    <input
                        type="text"
                        className="address-bar"
                        placeholder="Search or type URL..."
                        value={addressBarValue}
                        onChange={(e) => setAddressBarValue(e.target.value)}
                        onKeyDown={handleAddressBarKeyDown}
                        onFocus={handleAddressBarFocus}
                    />
                </div>
                {isWorkspaceMenuOpen && (
                    <div className="workspace-menu" ref={workspaceMenuRef}>
                        {workspaces.map(ws => (
                            <div key={ws.id} className={`workspace-item ${ws.id === activeWorkspaceId ? 'active' : ''}`} onClick={() => handleSwitchWorkspace(ws.id)}>
                                <span className="workspace-icon">💼</span>
                                <span>{ws.name}</span>
                            </div>
                        ))}
                        <div className="workspace-divider" />
                        <div className="workspace-action" onClick={handleCreateWorkspace}>
                            Create New Workspace
                        </div>
                    </div>
                )}
            </header>




            {isDropdownOpen && (
                <div className="tab-list-dropdown">
                    {tabsState.map(tab => (
                        <div
                            key={tab.id}
                            className={`tab-list-item ${tab.id === activeTabIdState ? 'active' : ''}`}
                            onClick={() => handleTabClick(tab.id)}
                        >
                            {tab.title}
                            <button
                                className="tab-close-button dropdown-close-button"
                                onClick={(event) => handleCloseTab(tab.id, event)}
                            >
                                &times;
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {isWsPromptOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div className="bg-white rounded-xl shadow-lg p-6 w-80">
                        <h2 className="text-lg font-semibold mb-4">Enter a name for the new workspace:</h2>
                        <input
                            ref={wsInputRef}
                            type="text"
                            value={wsName}
                            onChange={(e) => setWsName(e.target.value)}
                            className="w-full border border-gray-300 rounded p-2 mb-4"
                            placeholder="e.g. Work, Project X"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setIsWsPromptOpen(false)}
                                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmCreateWorkspace} // <-- CORRECT
                                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default BrowserHeader;