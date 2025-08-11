import React from 'react';
import './MainContent.css';

function MainContent() {
    // This component is now just for display. All logic has been moved to App.js.
    return (
        <main className="main-content">
            <h1>Welcome to Nova Browser!</h1>
            <p>Your intelligent, minimalist, and privacy-focused Browse experience.</p>
        </main>
    );
}

export default MainContent;