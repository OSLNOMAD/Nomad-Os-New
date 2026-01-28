import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatWidgetProps {
  token: string;
  dataLoaded?: boolean;
}

function parseMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) {
      elements.push(<br key={`br-${lineIdx}`} />);
    }
    
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let partIdx = 0;
    
    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(<span key={`text-${lineIdx}-${partIdx++}`}>{remaining.slice(0, boldMatch.index)}</span>);
        }
        parts.push(<strong key={`bold-${lineIdx}-${partIdx++}`} className="font-semibold">{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      } else {
        parts.push(<span key={`text-${lineIdx}-${partIdx++}`}>{remaining}</span>);
        remaining = '';
      }
    }
    
    elements.push(...parts);
  });
  
  return <>{elements}</>;
}

export function ChatWidget({ token, dataLoaded = false }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setError(null);
    setIsLoading(true);

    // Capture current messages for the request
    const currentMessages = [...messages];
    
    // Add user message immediately to show in UI
    const userMsg: ChatMessage = { role: 'user', content: userMessage };
    setMessages([...currentMessages, userMsg]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: currentMessages
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send message');
      }

      const data = await response.json();
      // Use server's authoritative history to ensure consistency
      setMessages(data.updatedHistory);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      // Revert to previous state on error
      setMessages(currentMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!dataLoaded) {
    return null;
  }

  return (
    <>
      {/* Chat Button with JADA Avatar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform z-50 overflow-hidden border-3 border-primary"
        style={{ 
          backgroundColor: '#10a37f',
          borderWidth: '3px',
          borderColor: '#10a37f'
        }}
        aria-label="Chat with JADA AI assistant"
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          <img 
            src="/jada-avatar.png" 
            alt="JADA" 
            className="w-full h-full object-cover"
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-gray-200"
          >
            {/* Header with JADA branding */}
            <div 
              className="p-4 text-white flex items-center gap-3"
              style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0a8f6a 100%)' }}
            >
              <img 
                src="/jada-avatar.png" 
                alt="JADA" 
                className="w-10 h-10 rounded-full border-2 border-white/30"
              />
              <div>
                <h3 className="font-semibold text-lg">JADA</h3>
                <p className="text-sm opacity-90">Your AI Assistant</p>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted py-8">
                  <img 
                    src="/jada-avatar.png" 
                    alt="JADA" 
                    className="w-20 h-20 mx-auto mb-4 rounded-full border-2"
                    style={{ borderColor: '#10a37f' }}
                  />
                  <p className="text-sm font-medium text-gray-700">Hi! I'm JADA, your AI assistant.</p>
                  <p className="text-sm text-gray-500 mt-1">I can help you with:</p>
                  <ul className="text-sm mt-2 space-y-1 text-gray-500">
                    <li>Your subscription details</li>
                    <li>Invoice and billing questions</li>
                    <li>Order status and tracking</li>
                    <li>Device information</li>
                  </ul>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <img 
                      src="/jada-avatar.png" 
                      alt="JADA" 
                      className="w-8 h-8 rounded-full mr-2 flex-shrink-0"
                    />
                  )}
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                      msg.role === 'user'
                        ? 'rounded-br-sm text-white'
                        : 'bg-gray-50 text-gray-800 rounded-bl-sm border border-gray-100'
                    }`}
                    style={msg.role === 'user' ? { backgroundColor: '#10a37f' } : {}}
                  >
                    <div className="text-sm leading-relaxed">
                      {msg.role === 'assistant' ? parseMarkdown(msg.content) : msg.content}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <img 
                    src="/jada-avatar.png" 
                    alt="JADA" 
                    className="w-8 h-8 rounded-full mr-2 flex-shrink-0"
                  />
                  <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask a question..."
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                  style={{ '--tw-ring-color': '#10a37f20' } as any}
                  disabled={isLoading}
                />
                <button
                  onClick={sendMessage}
                  disabled={isLoading || !inputValue.trim()}
                  className="w-10 h-10 rounded-full text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#10a37f' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
