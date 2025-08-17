import React, { useState, useEffect, useRef } from 'react';
import { IoMdSend } from 'react-icons/io';
import { v4 as uuidv4 } from 'uuid';
import './ChatbotSidebar.css'; // Import its specific styles

function ChatbotSidebar() {
    const [messages, setMessages] = useState([
        { id: 1, text: "I'm Nova, your intelligent Browse assistant. Ask me anything about this page or a new topic.", sender: 'ai' }
    ]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);

    // --- FUNCTIONS ---
    const handleSendMessage = (e) => {
        e.preventDefault();
        if (input.trim() === '') return;

        const userMessage = {
            id: uuidv4(), // Use uuid for a unique ID
            text: input,
            sender: 'user'
        };
        setMessages(currentMessages => [...currentMessages, userMessage]);
        setInput('');

        setTimeout(() => {
            const aiResponse = {
                id: uuidv4(), // Use uuid for the AI response too
                text: `This is a placeholder response for: "${input}"`,
                sender: 'ai'
            };
            setMessages(currentMessages => [...currentMessages, aiResponse]);
        }, 500);
    };

    const handleSummarizeClick = async () => {
        const thinkingMessage = {
            id: uuidv4(), // Use uuid for a unique ID
            text: 'Summarizing page...',
            sender: 'ai',
            type: 'status'
        };
        setMessages(currentMessages => [...currentMessages, thinkingMessage]);

        const summary = await window.electron.summarizePage();

        const aiResponse = {
            id: uuidv4(), // Use uuid for the final response
            text: summary,
            sender: 'ai'
        };

        // This will now correctly find and remove the status message before adding the new one.
        setMessages(currentMessages => [
            ...currentMessages.filter(msg => msg.type !== 'status'),
            aiResponse
        ]);
    };

    // --- EFFECT ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    return (
        <aside className="chatbot-sidebar">
            <h2 className="sidebar-title">Nova Assistant</h2>

            <div className="context-actions">
                <button className="context-button" onClick={handleSummarizeClick}>
                    Summarize Page
                </button>
            </div>
            <div className="chat-history">
                {messages.map(message => (
                    <div key={message.id} className={`chat-message ${message.sender}`}>
                        <p>{message.text}</p>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-form" onSubmit={handleSendMessage}>
                <input
                    type="text"
                    className="chat-input"
                    placeholder="Ask me anything..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />
                <button type="submit" className="send-button">
                    <IoMdSend />
                </button>
            </form>
        </aside>
    );
}

export default ChatbotSidebar;