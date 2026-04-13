import { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../lib/api';
import type { ChatMessage, ToolResult } from '../lib/api';

interface ChatViewProps {
  companyId: string;
}

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  toolResults?: ToolResult[];
}

export function ChatView({ companyId }: ChatViewProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');

    const newMessages: DisplayMessage[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const chatHistory: ChatMessage[] = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await sendChatMessage(chatHistory, companyId);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.reply,
          toolResults: result.toolResults,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'შეცდომა: AI სერვისი ვერ გამოიძახა. სცადეთ თავიდან.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [
    'რა ანგარიშები გვაქვს?',
    'შექმენი ჩანაწერი: საოფისე ხარჯი 500 ლარი',
    'საცდელი ბალანსი მაჩვენე',
    'რა არის დღგ-ს განაკვეთი?',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">AI ბუღალტერი</h2>
        <span className="text-xs text-gray-400">Claude-ზე მომუშავე</span>
      </div>

      <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border p-4 mb-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              გამარჯობა! მე ვარ თქვენი AI ბუღალტერი
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              შემიძლია ბუღალტრული ჩანაწერების შექმნა, ანგარიშების ნახვა, ბალანსის შემოწმება
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-sm hover:bg-blue-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <div className="whitespace-pre-wrap text-sm">{msg.content}</div>

              {msg.toolResults && msg.toolResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  {msg.toolResults.map((tr, j) => (
                    <details key={j} className="bg-white/10 rounded-lg p-2">
                      <summary className="text-xs cursor-pointer opacity-70">
                        Tool: {tr.tool}
                      </summary>
                      <pre className="text-xs mt-1 overflow-x-auto opacity-60">
                        {JSON.stringify(tr.result, null, 2)}
                      </pre>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="დაწერეთ შეტყობინება..."
          disabled={loading}
          className="flex-1 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          გაგზავნა
        </button>
      </form>
    </div>
  );
}
