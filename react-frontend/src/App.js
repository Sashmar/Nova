import React, { useRef, useEffect, useState } from 'react';
import './App.css';

import BrowserHeader from './components/BrowserHeader';
import MainContent from './components/MainContent';
import ChatbotSidebar from './components/ChatbotSidebar';

function App() {
  // --- STATE ---
  // This state will hold the URL of the currently active tab.
  const [activeUrl, setActiveUrl] = useState('');
  // This ref will be attached to the container that holds the web content.
  const webviewContainerRef = useRef(null);

  // --- EFFECT for sending bounds ---
  useEffect(() => {
    // This function measures the container and sends its bounds to Electron.
    const sendBounds = () => {
      if (webviewContainerRef.current) {
        const rect = webviewContainerRef.current.getBoundingClientRect();
        window.electron.sendBounds({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        });
      }
    };

    // We use a ResizeObserver for a more performant and accurate way to detect size changes.
    const observer = new ResizeObserver(sendBounds);
    if (webviewContainerRef.current) {
      observer.observe(webviewContainerRef.current);
    }

    // Cleanup function to stop observing when the component unmounts.
    return () => {
      observer.disconnect();
    };
  }, []); // Empty array means this effect runs only once on mount.

  // --- JSX ---
  return (
    <div className="nova-browser-container">
      {/* We pass the setActiveUrl function down to the header. */}
      <BrowserHeader onActiveTabChange={setActiveUrl} />

      <div className="nova-main-area">
        {/* This is the container we measure. */}
        <div className="webview-container" ref={webviewContainerRef}>
          {/* CONDITIONALLY RENDER the Welcome message. */}
          {activeUrl.startsWith('file://') && <MainContent />}
        </div>
        <ChatbotSidebar />
      </div>
    </div>
  );
}

export default App;