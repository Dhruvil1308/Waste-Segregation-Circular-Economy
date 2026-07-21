import React, { useState, useEffect, useRef } from 'react';
import { api } from './api';
import { Send, MessageSquare, Loader2, Sparkles, User, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const ChatPage = () => {
    const [messages, setMessages] = useState([
        { role: 'model', content: 'Hello! I am your AI assistant. How can I help you with waste management today?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        startChat();
    }, []);

    const startChat = async () => {
        try {
            const role = localStorage.getItem("user_role") || 'urban';
            const intent = role === 'cooperative' ? 'FIND_WASTE' : 'GIVE_WASTE';
            const res = await api.startChat(intent, role);
            setSessionId(res.session_id);
            if (res.message) {
                setMessages([{ role: 'model', content: res.message }]);
            }
        } catch (e) {
            console.error("Chat start failed", e);
        }
    };

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

    return (
        <div className="min-h-screen bg-[#EFFDEE] flex flex-col">
            {/* Header */}
            <header className="bg-white shadow-sm p-4 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeft size={24} className="text-slate-600" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-[#97fa9a]">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h1 className="font-black text-slate-900 text-lg">EcoEmpower Assistant</h1>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Powered by OpenAI</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-3xl mx-auto space-y-6">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Avatar */}
                            <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${m.role === 'user' ? 'bg-slate-200' : 'bg-[#97fa9a]/20'}`}>
                                {m.role === 'user' ? <User size={20} className="text-slate-500" /> : <Sparkles size={20} className="text-slate-900" />}
                            </div>

                            {/* Bubble */}
                            <div className={`flex-1 max-w-[80%] space-y-2`}>
                                <div className={`p-6 rounded-3xl text-base leading-relaxed ${m.role === 'user'
                                    ? 'bg-slate-900 text-white rounded-tr-none'
                                    : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none shadow-sm'
                                    }`}>
                                    {m.content}
                                </div>

                                {/* Rich Data Cards */}
                                {m.data && m.data.length > 0 && (
                                    <div className="grid gap-3 pt-2">
                                        <p className="text-xs font-black uppercase tracking-widest text-[#7edb81] ml-2">Relevant Listings</p>
                                        {m.data.map(item => (
                                            <div
                                                key={item.id}
                                                onClick={() => navigate('/available-waste')}
                                                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow cursor-pointer group"
                                            >
                                                <div>
                                                    <p className="font-bold text-slate-900 capitalize group-hover:text-[#7edb81] transition-colors">{item.waste_type} Waste</p>
                                                    <p className="text-sm text-slate-500">{item.quantity_kg} kg • {item.location}</p>
                                                </div>
                                                <div className="px-3 py-1 bg-[#EFFDEE] text-slate-900 text-xs font-black rounded-lg group-hover:bg-[#97fa9a] transition-colors">
                                                    View
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-[#97fa9a]/20 flex items-center justify-center animation-pulse">
                                <Sparkles size={20} className="text-slate-900" />
                            </div>
                            <div className="flex items-center gap-2 p-4 bg-white rounded-3xl rounded-tl-none border border-slate-100 shadow-sm">
                                <Loader2 className="animate-spin text-[#97fa9a]" size={20} />
                                <span className="text-slate-400 font-bold text-sm">Thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-50 sticky bottom-0">
                <div className="max-w-3xl mx-auto relative">
                    <input
                        className="w-full pl-6 pr-16 py-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-[#97fa9a] font-medium text-lg placeholder:text-slate-300 transition-all"
                        placeholder="Ask about recycling, policies, or find waste..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                    />
                    <button
                        onClick={handleSend}
                        className="absolute right-2 top-2 p-2 bg-slate-900 text-[#97fa9a] rounded-xl hover:bg-slate-800 transition-colors shadow-lg"
                    >
                        <Send size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatPage;
