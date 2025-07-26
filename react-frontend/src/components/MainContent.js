import React, { useRef, useEffect } from 'react'; // Import useRef and useEffect hooks
import './MainContent.css';

function MainContent() {
    const mainContentRef = useRef(null); // Create a ref to attach to the main content div

    // useEffect hook to run code after render and on component mount/unmount
    useEffect(() => {
        const sendMainContentBounds = () => {
            if (mainContentRef.current && window.electron && window.electron.sendBounds) {
                const rect = mainContentRef.current.getBoundingClientRect();

                // Send the exact dimensions and position of the main content area to Electron
                window.electron.sendBounds({
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                });
                console.log('MainContent bounds sent:', {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                }); // For debugging in React DevTools
            }
        };

        // Send bounds immediately after the component mounts
        sendMainContentBounds();

        // Add a resize listener to send bounds whenever the window is resized
        window.addEventListener('resize', sendMainContentBounds);

        // Cleanup function: Remove the event listener when the component unmounts
        return () => {
            window.removeEventListener('resize', sendMainContentBounds);
        };
    }, []); // Empty dependency array ensures this effect runs only once on mount and cleanup on unmount

    return (
        <main className="main-content" ref={mainContentRef}>
            {/* This is where the actual web page content will be rendered by BrowserView */}
            <h1>Welcome to Nova Browser!</h1>
            <p>Your intelligent, minimalist, and privacy-focused Browse experience.</p>
        </main>
    );
}

export default MainContent;