"use client";
import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "";

type AIProvider = "openai" | "gemini";

const AI_SETTINGS_KEY = "repochat_ai_settings";

type Message = {
  role:    "user" | "assistant";
  content: string;
  sources?: Source[];
};

type Source = {
  file_path:  string;
  start_line: number;
  end_line:   number;
  language:   string;
  score:      number;
};

export default function ChatPage() {
  const params                    = useParams();
  const repoId                    = params.repoId as string;
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [repoName, setRepoName]   = useState("");
  const [provider, setProvider]   = useState<AIProvider>("openai");
  const [apiKey, setApiKey]       = useState("");
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const textareaRef               = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const stored = localStorage.getItem(`repo_name_${repoId}`);
    if (stored) setRepoName(stored);
  }, [repoId]);

  useEffect(() => {
    const stored = localStorage.getItem(AI_SETTINGS_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as { provider?: AIProvider; apiKey?: string };
      if (parsed.provider === "openai" || parsed.provider === "gemini") {
        setProvider(parsed.provider);
      }
      if (typeof parsed.apiKey === "string") {
        setApiKey(parsed.apiKey);
      }
    } catch {
      // Ignore malformed stored settings.
    }
  }, []);

  const persistSettings = (nextProvider: AIProvider, nextApiKey: string) => {
    localStorage.setItem(
      AI_SETTINGS_KEY,
      JSON.stringify({ provider: nextProvider, apiKey: nextApiKey }),
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    const history = messages.map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);
    persistSettings(provider, apiKey);

    try {
      const res  = await fetch(`${API}/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          query:   userMsg.content,
          repo_id: repoId,
          history: history,
          provider,
          api_key: apiKey,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = typeof data?.detail === "string"
          ? data.detail
          : `Request failed with status ${res.status}`;
        setMessages(prev => [...prev, {
          role:    "assistant",
          content: `⚠ ${message}`,
        }]);
        return;
      }

      const assistantMsg: Message = {
        role:    "assistant",
        content: typeof data?.answer === "string" ? data.answer : "",
        sources: Array.isArray(data?.sources) ? data.sources : undefined,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        role:    "assistant",
        content: "⚠ Could not reach the backend. Check your backend URL and deployment status.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const scoreColor = (s: number) =>
    s > 0.85 ? "#2DD4A0" : s > 0.7 ? "#A89DF9" : "rgba(255,255,255,0.3)";

  return (
    <div className="chat-root">
      <div className="bg-grid" />

      <aside className="sidebar">
        <a href="/" className="nav-logo">
          <span className="logo-icon">⬡</span> RepoChat
        </a>

        <div className="sidebar-section">
          <div className="sidebar-label">Current repo</div>
          <div className="repo-pill">
            <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
            {repoName || repoId.slice(0, 12) + "…"}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">AI provider</div>
          <div className="ai-settings">
            <select
              className="provider-select"
              value={provider}
              onChange={e => setProvider(e.target.value as AIProvider)}
            >
              <option value="openai">OpenAI / ChatGPT</option>
              <option value="gemini">Gemini</option>
            </select>
            <input
              className="api-key-input"
              type="password"
              placeholder="Paste your API key"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <p className="settings-note">Saved only in this browser and sent to your backend.</p>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Suggested questions</div>
          {[
            "Give me an overview of this codebase",
            "Where is the main entry point?",
            "How is error handling done?",
            "What are the main dependencies?",
            "Where is authentication handled?",
          ].map(q => (
            <button key={q} className="suggestion" onClick={() => setInput(q)}>
              {q}
            </button>
          ))}
        </div>

        <a href="/dashboard" className="new-repo-btn">+ Analyse another repo</a>
      </aside>

      <div className="chat-area">
        <div className="messages">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">⬡</div>
              <h2>Ready to explore</h2>
              <p>Ask anything about this repository — functions, architecture, patterns, or dependencies.</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`msg-row ${msg.role}`}>
              <div className="msg-avatar">
                {msg.role === "user" ? "U" : "R"}
              </div>
              <div className="msg-body">
                <div className="msg-name">{msg.role === "user" ? "You" : "RepoChat"}</div>
                <div className="msg-text">
                  <MessageContent content={msg.content} />
                </div>

                {msg.sources && msg.sources.length > 0 && (
                  <div className="sources">
                    <div className="sources-label">Sources</div>
                    <div className="sources-list">
                      {msg.sources.map((s, j) => (
                        <div key={j} className="source-chip">
                          <span className="source-file">{s.file_path}</span>
                          <span className="source-lines">:{s.start_line}–{s.end_line}</span>
                          <span className="source-score" style={{ color: scoreColor(s.score) }}>
                            {(s.score * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="msg-row assistant">
              <div className="msg-avatar">R</div>
              <div className="msg-body">
                <div className="msg-name">RepoChat</div>
                <div className="typing">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="input-bar">
          <div className="input-wrap">
            <textarea
              ref={textareaRef}
              className="chat-input"
              placeholder="Ask about this repository…"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
            />
            <button
              className={`send-btn ${loading ? "loading" : ""}`}
              onClick={sendMessage}
              disabled={loading || !input.trim()}
            >
              {loading
                ? <span className="spinner" />
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
              }
            </button>
          </div>
          <p className="input-hint">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>

      <style>{` 
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .chat-root {
          display: flex; height: 100vh; overflow: hidden;
          background: #0A0A0F; color: #F0EFF8;
          font-family: 'DM Sans', system-ui, sans-serif;
        }

        .bg-grid {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image:
            linear-gradient(rgba(123,110,246,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(123,110,246,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        .sidebar {
          width: 240px; flex-shrink: 0;
          border-right: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.01);
          padding: 20px 16px;
          display: flex; flex-direction: column; gap: 24px;
          overflow-y: auto; position: relative; z-index: 1;
        }

        .nav-logo {
          display: flex; align-items: center; gap: 8px;
          font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700;
          color: #F0EFF8; text-decoration: none;
        }

        .logo-icon { color: #7B6EF6; }

        .sidebar-section { display: flex; flex-direction: column; gap: 8px; }

        .sidebar-label {
          font-size: 10px; font-family: 'JetBrains Mono', monospace;
          color: rgba(255,255,255,0.25); letter-spacing: 0.1em; text-transform: uppercase;
        }

        .repo-pill {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 10px;
          background: rgba(123,110,246,0.1);
          border: 1px solid rgba(123,110,246,0.2);
          border-radius: 8px;
          font-size: 11px; font-family: 'JetBrains Mono', monospace;
          color: #A89DF9; word-break: break-all;
        }

        .ai-settings {
          display: flex; flex-direction: column; gap: 8px;
          padding: 10px; border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
        }

        .provider-select,
        .api-key-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; padding: 10px 12px;
          color: #F0EFF8; outline: none;
          font-family: 'DM Sans', system-ui, sans-serif; font-size: 12px;
        }

        .provider-select:focus,
        .api-key-input:focus { border-color: rgba(123,110,246,0.5); }

        .api-key-input::placeholder { color: rgba(255,255,255,0.2); }

        .settings-note {
          font-size: 10px; line-height: 1.4; color: rgba(255,255,255,0.3);
        }

        .suggestion {
          text-align: left; padding: 8px 10px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 7px; font-size: 12px; color: rgba(255,255,255,0.4);
          cursor: pointer; transition: all 0.2s; line-height: 1.4;
        }

        .suggestion:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.7);
        }

        .new-repo-btn {
          margin-top: auto; padding: 10px;
          text-align: center;
          background: rgba(123,110,246,0.1);
          border: 1px solid rgba(123,110,246,0.25);
          border-radius: 8px;
          font-size: 12px; color: #A89DF9;
          text-decoration: none; transition: all 0.2s;
        }

        .new-repo-btn:hover { background: rgba(123,110,246,0.2); }

        .chat-area {
          flex: 1; display: flex; flex-direction: column;
          overflow: hidden; position: relative; z-index: 1;
        }

        .messages {
          flex: 1; overflow-y: auto; padding: 32px 24px;
          display: flex; flex-direction: column; gap: 28px;
        }

        .empty-state {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; padding: 80px 24px; gap: 12px;
          opacity: 0.5;
        }

        .empty-icon { font-size: 36px; color: #7B6EF6; }

        .empty-state h2 {
          font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 600;
        }

        .empty-state p { font-size: 14px; color: rgba(255,255,255,0.4); max-width: 380px; }

        .msg-row {
          display: flex; gap: 14px; align-items: flex-start;
          max-width: 800px;
        }

        .msg-row.user { flex-direction: row-reverse; align-self: flex-end; }

        .msg-avatar {
          width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 600; font-family: 'Syne', sans-serif;
        }

        .msg-row.user .msg-avatar {
          background: rgba(123,110,246,0.2); color: #A89DF9;
        }

        .msg-row.assistant .msg-avatar {
          background: rgba(45,212,160,0.15); color: #2DD4A0;
        }

        .msg-body { flex: 1; display: flex; flex-direction: column; gap: 8px; }

        .msg-name {
          font-size: 11px; color: rgba(255,255,255,0.3);
          font-family: 'JetBrains Mono', monospace;
        }

        .msg-row.user .msg-name { text-align: right; }

        .msg-text {
          font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.85);
          white-space: pre-wrap; word-break: break-word;
        }

        .msg-row.user .msg-text {
          background: rgba(123,110,246,0.12);
          border: 1px solid rgba(123,110,246,0.2);
          border-radius: 12px; padding: 12px 16px;
          color: #F0EFF8;
        }

        .msg-text pre {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; padding: 14px;
          margin: 8px 0; overflow-x: auto;
          font-family: 'JetBrains Mono', monospace; font-size: 12px;
          line-height: 1.6;
        }

        .msg-text code {
          font-family: 'JetBrains Mono', monospace; font-size: 12px;
          background: rgba(255,255,255,0.07); padding: 2px 6px;
          border-radius: 4px; color: #A89DF9;
        }

        .sources { display: flex; flex-direction: column; gap: 8px; }

        .sources-label {
          font-size: 10px; font-family: 'JetBrains Mono', monospace;
          color: rgba(255,255,255,0.2); letter-spacing: 0.08em; text-transform: uppercase;
        }

        .sources-list { display: flex; flex-wrap: wrap; gap: 6px; }

        .source-chip {
          display: flex; align-items: center; gap: 4px;
          padding: 4px 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px;
        }

        .source-file { color: rgba(255,255,255,0.5); }
        .source-lines { color: rgba(255,255,255,0.3); }
        .source-score { font-size: 10px; margin-left: 4px; }

        .typing {
          display: flex; gap: 4px; padding: 10px 0;
        }

        .typing span {
          width: 6px; height: 6px; border-radius: 50%;
          background: rgba(255,255,255,0.3);
          animation: bounce 1.2s ease infinite;
        }

        .typing span:nth-child(2) { animation-delay: 0.2s; }
        .typing span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }

        .input-bar {
          padding: 16px 24px 20px;
          border-top: 1px solid rgba(255,255,255,0.06);
          background: rgba(10,10,15,0.9);
          display: flex; flex-direction: column; gap: 6px;
        }

        .input-wrap {
          display: flex; align-items: flex-end; gap: 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px; padding: 10px 12px;
          transition: border-color 0.2s;
        }

        .input-wrap:focus-within { border-color: rgba(123,110,246,0.4); }

        .chat-input {
          flex: 1; background: transparent; border: none; outline: none;
          font-family: 'DM Sans', system-ui, sans-serif; font-size: 14px;
          color: #F0EFF8; resize: none; max-height: 140px; line-height: 1.5;
        }

        .chat-input::placeholder { color: rgba(255,255,255,0.2); }

        .send-btn {
          width: 34px; height: 34px; flex-shrink: 0;
          background: #7B6EF6; border: none; border-radius: 8px;
          color: #fff; cursor: pointer; transition: background 0.2s;
          display: flex; align-items: center; justify-content: center;
        }

        .send-btn:hover:not(:disabled) { background: #9288f8; }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .send-btn.loading { background: rgba(123,110,246,0.4); }

        .spinner {
          width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .input-hint {
          font-size: 11px; color: rgba(255,255,255,0.2);
          text-align: center;
        }

        @media (max-width: 640px) {
          .sidebar { display: none; }
        }
      `}</style>
    </div>
  );
}

function MessageContent({ content }: { content?: string }) {
  const text = content ?? "";
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const lines = part.slice(3, -3).split("\n");
          const code  = lines.slice(1).join("\n");
          return <pre key={i}><code>{code}</code></pre>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
