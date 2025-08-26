import React, { useState, useEffect, useRef } from 'react';

import './BrowserHeader.css';
import { IoIosArrowBack, IoIosArrowForward, IoMdRefresh, IoMdList, IoMdLock, IoMdWarning } from 'react-icons/io';
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
    const [securityStatus, setSecurityStatus] = useState('secure');

    // Refs
    const dropdownRef = useRef(null); // used to wrap active-tab pill + dropdown for outside click detection
    const workspaceMenuRef = useRef(null);
    const createWorkspacePanelRef = useRef(null);
    const wsInputRef = useRef(null);

    // State
    const [workspaces, setWorkspaces] = useState([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
    const [isWsPromptOpen, setIsWsPromptOpen] = useState(false);
    const [wsName, setWsName] = useState('');
    const [tabsState, setTabsState] = useState([]);
    const [activeTabIdState, setActiveTabIdState] = useState(null);
    const [addressBarValue, setAddressBarValue] = useState('https://nova.browser.com');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);

    // -------------------------------
    // Sync BrowserView visibility whenever any UI overlay/menu opens
    // -------------------------------
    useEffect(() => {
        if (isWsPromptOpen || isWorkspaceMenuOpen || isDropdownOpen) {
            hideBrowserView();
            if (isWsPromptOpen) {
                // focus only for the prompt
                setTimeout(() => wsInputRef.current?.focus(), 0);
            }
        } else {
            showBrowserView();
        }
    }, [isWsPromptOpen, isWorkspaceMenuOpen, isDropdownOpen]);

    // -------------------------------
    // Address bar handlers
    // -------------------------------
    const handleAddressBarKeyDown = (event) => {
        if (event.key === 'Enter') {
            let url = addressBarValue;
            if (!url.startsWith('http://') && !url.startsWith('https://') && url.includes('.')) {
                url = 'https://' + url;
            }
            if (!url.includes('.') && url.trim().length > 0) {
                url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
            }
            if (window.electron && window.electron.loadURL) {
                window.electron.loadURL(url);
                console.log(`Loading URL: ${url}`);
            } else {
                console.error('window.electron.loadURL is not defined. Preload script issue?');
            }
        }
    };

    const handleGoBack = () => {
        if (window.electron && window.electron.goBack) {
            window.electron.goBack();
            console.log('Requesting navigation back.');
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
            console.log('Requesting navigation forward.');
        } else {
            console.error('window.electron.goForward is not defined. Preload script issue?');
        }
    };

    const handleReload = () => {
        if (window.electron && window.electron.reload) {
            window.electron.reload();
            console.log('Requesting page reload.');
        } else {
            console.error('window.electron.reload is not defined. Preload script issue?');
        }
    };

    // -------------------------------
    // Workspace handlers
    // -------------------------------
    const handleCreateWorkspace = () => {
        setIsWsPromptOpen(true);
        // hideBrowserView() will also be executed by the effect above, but call it now to reduce race
        hideBrowserView();
    };

    const confirmCreateWorkspace = () => {
        const name = wsName.trim();
        if (!name) {
            setIsWsPromptOpen(false);
            setWsName('');
            showBrowserView();
            return;
        }
        // Make sure preload exposes createWorkspace; many apps use ipcRenderer.send('create-workspace', name)
        if (window.electron?.createWorkspace) {
            window.electron.createWorkspace(name);
        } else if (window.electron?.ipcSend) {
            window.electron.ipcSend('create-workspace', name);
        } else {
            console.error('createWorkspace not exposed by preload.');
        }
        setIsWsPromptOpen(false);
        setWsName('');
        showBrowserView();
    };

    const cancelCreateWorkspace = () => {
        setIsWsPromptOpen(false);
        setWsName('');
        showBrowserView();
    };

    const handleSwitchWorkspace = (id) => {
        if (window.electron?.switchWorkspace) {
            window.electron.switchWorkspace(id);
            setActiveWorkspaceId(id);
            setIsWorkspaceMenuOpen(false);
        } else {
            console.error('switchWorkspace not exposed by preload.');
        }
    };

    const handleWorkspaceMenuToggle = () => {
        const newState = !isWorkspaceMenuOpen;
        setIsWorkspaceMenuOpen(newState);
        // effect will hide/show BrowserView; call hide/show now to reduce visual flicker
        if (newState) hideBrowserView(); else showBrowserView();
    };

    // -------------------------------
    // Tab handlers
    // -------------------------------
    const handleNewTabClick = () => {
        if (window.electron && window.electron.createNewTab) {
            window.electron.createNewTab();
            console.log('BrowserHeader: Requesting new tab.');
        } else {
            console.error('window.electron.createNewTab is not defined. Preload script issue?');
        }
    };

    const handleCloseTab = (id, event) => {
        if (event) event.stopPropagation();
        if (window.electron && window.electron.closeTab) {
            window.electron.closeTab(id);
        } else {
            console.error('window.electron.closeTab is not defined. Preload script issue?');
        }
    };

    const handleAddressBarFocus = (event) => {
        event.target.select();
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

    const handleDropdownToggle = () => {
        const newDropdownState = !isDropdownOpen;
        setIsDropdownOpen(newDropdownState);
        if (newDropdownState) hideBrowserView(); else showBrowserView();
    };

    const handleDropdownOpen = () => {
        setIsDropdownOpen(true);
        hideBrowserView();
    };

    const handleDropdownClose = () => {
        setIsDropdownOpen(false);
        showBrowserView();
    };

    // -------------------------------
    // Init and event listeners (mount)
    // -------------------------------
    useEffect(() => {
        let mounted = true;

        const fetchInitialTabs = async () => {
            if (window.electron && window.electron.getTabs) {
                const initialTabs = await window.electron.getTabs();
                if (!mounted) return;
                setTabsState(initialTabs);
                const currentActive = initialTabs.find(tab => tab.isActive);
                if (currentActive) {
                    setActiveTabIdState(currentActive.id);
                    setAddressBarValue(currentActive.url);
                }
                // attach security status if available
                if (window.electron?.onSecurityStatusUpdated) {
                    window.electron.onSecurityStatusUpdated(setSecurityStatus);
                }
                console.log('BrowserHeader: Fetched initial tabs:', initialTabs);
            }
        };

        const fetchInitialWorkspaces = async () => {
            if (window.electron?.getWorkspaces) {
                const initialWorkspaces = await window.electron.getWorkspaces();
                if (!mounted) return;
                setWorkspaces(initialWorkspaces);
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
                if (typeof onActiveTabChange === 'function') onActiveTabChange(currentActive.url);
            } else {
                setAddressBarValue('nova://newtab');
                if (typeof onActiveTabChange === 'function') onActiveTabChange('nova://newtab');
            }
        };

        const handleWorkspacesUpdated = (workspacesData) => {
            setWorkspaces(workspacesData);
            const active = workspacesData.find(ws => ws.active);
            if (active) setActiveWorkspaceId(active.id);
            else if (workspacesData.length > 0 && !workspacesData.find(ws => ws.id === activeWorkspaceId)) {
                setActiveWorkspaceId(workspacesData[0].id);
            }
        };

        const handleAddressBarUpdate = (url) => {
            setAddressBarValue(url);
        };

        const handleClickOutside = (event) => {
            // dropdown wrapper
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
                showBrowserView();
            }
            // workspace menu
            if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target)) {
                setIsWorkspaceMenuOpen(false);
                showBrowserView();
            }
            // workspace prompt
            if (isWsPromptOpen && createWorkspacePanelRef.current && !createWorkspacePanelRef.current.contains(event.target)) {
                cancelCreateWorkspace();
            }
        };

        fetchInitialTabs();
        fetchInitialWorkspaces();

        if (window.electron) {
            // these should be provided by your preload wrapper; adapt names if different
            if (window.electron.onTabsUpdated) window.electron.onTabsUpdated(handleTabsUpdated);
            if (window.electron.onWorkspacesUpdated) window.electron.onWorkspacesUpdated(handleWorkspacesUpdated);
            if (window.electron.onUpdateAddressBar) window.electron.onUpdateAddressBar(handleAddressBarUpdate);
        }

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            mounted = false;
            document.removeEventListener('mousedown', handleClickOutside);
            // try removing listeners if your preload exposes removal APIs
            if (window.electron) {
                if (window.electron.removeTabsUpdated) window.electron.removeTabsUpdated(handleTabsUpdated);
                if (window.electron.removeWorkspacesUpdated) window.electron.removeWorkspacesUpdated(handleWorkspacesUpdated);
                if (window.electron.removeUpdateAddressBar) window.electron.removeUpdateAddressBar(handleAddressBarUpdate);
                if (window.electron.removeSecurityStatusUpdated) window.electron.removeSecurityStatusUpdated(setSecurityStatus);
            }
        };
    }, [onActiveTabChange, activeWorkspaceId, isWsPromptOpen]);

    // -------------------------------
    // Render
    // -------------------------------
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
                        onClick={() => { isDropdownOpen ? handleDropdownClose() : handleDropdownOpen(); }}
                    >
                        <IoMdList />
                    </button>
                    <button className="nav-button new-tab-button" onClick={handleNewTabClick}>
                        +
                    </button>
                </div>

                {/* wrapper for the active-tab pill + dropdown so outside-click detection works */}
                <div className="tab-dropdown-wrapper" ref={dropdownRef}>
                    {tabsState.find(tab => tab.isActive) && (
                        <div className="active-tab-pill" onClick={handleDropdownToggle}>
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
                </div>

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
                            <div key={ws.id} className={`workspace-item ${ws.active ? 'active' : ''}`} onClick={() => handleSwitchWorkspace(ws.id)}>
                                <span className="workspace-icon">💼</span>
                                <span>{ws.name}</span>
                            </div>
                        ))}
                        <div className="workspace-divider" />
                        <div className="workspace-action" onClick={() => handleCreateWorkspace()}>
                            Create New Workspace
                        </div>
                    </div>
                )}

            </header>

            {/* workspace prompt overlay */}
            {isWsPromptOpen && (
                <div className="ws-overlay">
                    <div className="ws-card" ref={createWorkspacePanelRef} onClick={(e) => e.stopPropagation()}>
                        <div className="ws-title">Enter a name for a new workspace:</div>
                        <input
                            ref={wsInputRef}
                            type="text"
                            value={wsName}
                            onChange={(e) => setWsName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmCreateWorkspace();
                                if (e.key === 'Escape') cancelCreateWorkspace();
                            }}
                            onFocus={hideBrowserView}
                            onBlur={showBrowserView}
                            className="ws-input"
                            placeholder="e.g. Work, Project X"
                        />
                        <div className="ws-actions">
                            <button className="btn btn-secondary" onClick={cancelCreateWorkspace}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={confirmCreateWorkspace}
                                disabled={!wsName.trim()}
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
