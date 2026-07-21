import React, { useState, useEffect } from 'react';
import { api } from './api';
import { Send, MessageSquare, Loader2, Sparkles, X } from 'lucide-react';

// --- CHATBOT COMPONENT ---
const ChatbotWidget = ({ userRole, isLoggedIn }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'model', content: 'Hello! I am your AI assistant. Ask me anything about waste management!' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);

    const startChat = async () => {
        try {
            // userRole is the backend role string, only ever 'urban' or 'cooperative'.
            const role = userRole === 'cooperative' ? 'cooperative' : 'urban';
            const intent = role === 'cooperative' ? 'FIND_WASTE' : 'GIVE_WASTE';
            const res = await api.startChat(intent, role);
            setSessionId(res.session_id);
            if (res.message) {
                setMessages([{ role: 'model', content: res.message }]);
            }
        } catch (e) {
            console.error("Chat start failed", e);
            // Surface it, otherwise the widget just sits there ignoring every message.
            setMessages([{ role: 'model', content: "Sorry, I couldn't start the chat. Please try again." }]);
        }
    };

    useEffect(() => {
        if (isOpen && !sessionId && isLoggedIn) {
            startChat();
        }
    }, [isOpen, isLoggedIn]);

    const handleSend = async () => {
        if (!input.trim() || !sessionId) return;
        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            const res = await api.sendMessage(sessionId, userMsg);
            setMessages(prev => [...prev, { role: 'model', content: res.message, data: res.data }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'model', content: "Sorry, I encountered an error." }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isLoggedIn) return null; // Only show if logged in

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {isOpen && (
                <div className="bg-white w-80 h-96 rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden mb-4 animate-in slide-in-from-bottom-4">
                    <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
                        <span className="font-bold flex items-center gap-2"><Sparkles size={16} className="text-[#97fa9a]" /> AI Assistant</span>
                        <button onClick={() => setIsOpen(false)}><X size={16} /></button>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-slate-900 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'}`}>
                                    {m.content}
                                    {/* Render Listings Cards if data exists */}
                                    {m.data && m.data.length > 0 && (
                                        <div className="mt-2 space-y-2">
                                            <p className="text-xs font-bold uppercase text-[#97fa9a] mb-1">Found Listings:</p>
                                            {m.data.map(item => (
                                                <div key={item.id} className="bg-slate-50 p-2 rounded border border-slate-700/50 text-xs">
                                                    Need: {item.waste_type} ({item.quantity_kg}kg)
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && <div className="flex justify-start"><div className="bg-white p-3 rounded-2xl border border-slate-200"><Loader2 className="animate-spin text-slate-400" size={16} /></div></div>}
                    </div>
                    <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
                        <input
                            className="flex-1 bg-slate-50 rounded-xl px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#97fa9a]"
                            placeholder="Type a message..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                        />
                        <button onClick={handleSend} className="p-2 bg-[#97fa9a] rounded-xl hover:bg-[#7edb81] transition-colors"><Send size={16} /></button>
                    </div>
                </div>
            )}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-14 h-14 bg-slate-900 rounded-full flex items-center justify-center text-[#97fa9a] shadow-2xl hover:scale-110 transition-transform"
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </button>
        </div>
    );
};

export default ChatbotWidget;
