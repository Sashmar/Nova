import React from 'react';
import './App.css'; // Global styles for Nova

// Import placeholder components (we will create these files next)
import BrowserHeader from './components/BrowserHeader';
import MainContent from './components/MainContent';
import ChatbotSidebar from './components/ChatbotSidebar';

function App() {
  return (
    <div className="nova-browser-container">
      {/* Browser Header (Tabs, Address Bar, Nav Buttons) */}
      <BrowserHeader />

      {/* Main Area: Content + Sidebar - uses flexbox to arrange horizontally */}
      <div className="nova-main-area">
        <MainContent /> {/* Where actual web pages will load */}
        <ChatbotSidebar /> {/* The AI chatbot interface */}
      </div>
    </div>
  );
}

export default App;