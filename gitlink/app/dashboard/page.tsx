"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type JobStatus = "idle" | "pending" | "cloning" | "chunking" | "embedding" | "done" | "failed";

const STATUS_STEPS: Record<string, number> = {
  idle: 0, pending: 5, cloning: 20, chunking: 45, embedding: 75, done: 100,
};

const STATUS_LABEL: Record<string, string> = {
  idle:      "Waiting…",
  pending:   "Job queued",
  cloning:   "Cloning repository…",
  chunking:  "Parsing & chunking files…",
  embedding: "Embedding chunks into Pinecone…",
  done:      "Done! Redirecting…",
  failed:    "Something went wrong",
};

export default function DashboardPage() {
  const router = useRouter();
  const [url, setUrl]           = useState("");
  const [jobId, setJobId]       = useState<string | null>(null);
  const [status, setStatus]     = useState<JobStatus>("idle");
  const [message, setMessage]   = useState("");
  const [chunks, setChunks]     = useState<number | null>(null);
  const [error, setError]       = useState("");
  const [repoName, setRepoName] = useState("");
  const pollRef                 = useRef<NodeJS.Timeout | null>(null);

  // ── Parse repo name from URL ──────────────────────────────────────────────
  const parseRepoName = (ghUrl: string) => {
    const m = ghUrl.match(/github\.com\/([^/]+\/[^/]+)/);
    return m ? m[1] : ghUrl;
  };

  // ── Submit URL ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!url.trim()) {
      setError("Paste a GitHub URL first.");
      return;
    }
    setError("");
    setStatus("pending");
    setRepoName(parseRepoName(url));

    try {
      const res  = await fetch(`${API}/analyse`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ github_url: url }),
      });
      const data = await res.json();
      setJobId(data.job_id);
    } catch (e) {
      setError("Could not reach the backend. Is it running on port 8000?");
      setStatus("idle");
    }
  };

  // ── Poll status
  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const res  = await fetch(`${API}/status/${jobId}`);
        const data = await res.json();

        setStatus(data.status as JobStatus);
        setMessage(data.message || "");
        if (data.chunk_count) setChunks(data.chunk_count);

        if (data.status === "done") {
          clearInterval(pollRef.current!);
          setTimeout(() => router.push(`/chat/${data.repo_id}`), 1200);
        }

        if (data.status === "failed") {
          clearInterval(pollRef.current!);
          setError(data.error || "Unknown error");
        }
      } catch {
        setError("Lost connection to backend");
        clearInterval(pollRef.current!);
      }
    };

    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => clearInterval(pollRef.current!);
  }, [jobId, router]);

  const progress   = STATUS_STEPS[status] ?? 0;
  const isRunning  = !["idle", "done", "failed"].includes(status);

  return (
    <div className="dashboard-root">
      {/* ── BG grid ── */}
      <div className="bg-grid" />
      <div className="bg-glow" />

      {/* ── Nav ── */}
      <nav className="nav">
        <a href="/" className="nav-logo">
          <span className="logo-icon">⬡</span>
          RepoChat
        </a>
        <span className="nav-tag">Dashboard</span>
      </nav>

      {/* ── Main card ── */}
      <main className="main">
        <div className="card">

          {/* Header */}
          <div className="card-header">
            <h1>Analyse a repository</h1>
            <p>Paste any public GitHub URL. We'll index it and open a chat session.</p>
          </div>

          {/* Input */}
          <div className="input-group">
            <div className={`url-input-wrap ${isRunning ? "disabled" : ""}`}>
              <svg className="gh-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
              <input
                className="url-input"
                type="text"
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !isRunning && handleSubmit()}
                disabled={isRunning}
              />
            </div>
            <button
              className={`analyse-btn ${isRunning ? "loading" : ""}`}
              onClick={handleSubmit}
              disabled={isRunning}
            >
              {isRunning ? <span className="spinner" /> : "Analyse →"}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="error-banner">
              <span>⚠</span> {error}
            </div>
          )}

         
          {status !== "idle" && (
            <div className="progress-section">

              {/* Repo name */}
              {repoName && (
                <div className="repo-label">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
                  </svg>
                  {repoName}
                </div>
              )}

              {/* Steps */}
              <div className="steps-row">
                {["cloning","chunking","embedding","done"].map((step, i) => {
                  const stepOrder = ["cloning","chunking","embedding","done"];
                  const currentIdx = stepOrder.indexOf(status);
                  const stepIdx    = stepOrder.indexOf(step);
                  const done   = stepIdx < currentIdx || status === "done";
                  const active = stepIdx === currentIdx && status !== "done";
                  return (
                    <div key={step} className={`step-item ${done ? "done" : ""} ${active ? "active" : ""}`}>
                      <div className="step-dot">
                        {done ? "✓" : active ? <span className="pulse-dot" /> : i + 1}
                      </div>
                      <span className="step-label">{step}</span>
                      {i < 3 && <div className={`step-line ${done ? "done" : ""}`} />}
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>

              {/* Message */}
              <div className="status-msg">
                <span className={`status-dot ${status}`} />
                {message || STATUS_LABEL[status]}
              </div>

              {/* Chunk count */}
              {chunks && (
                <div className="chunk-count">
                  {chunks.toLocaleString()} vectors indexed
                </div>
              )}
            </div>
          )}

          {/* Example repos */}
          {status === "idle" && (
            <div className="examples">
              <span className="examples-label">Try an example:</span>
              {[
                "https://github.com/tiangolo/fastapi",
                "https://github.com/vercel/next.js",
                "https://github.com/langchain-ai/langchain",
              ].map(ex => (
                <button key={ex} className="example-chip" onClick={() => setUrl(ex)}>
                  {ex.replace("https://github.com/", "")}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* How it works mini */}
        {status === "idle" && (
          <div className="how-row">
            {[
              { icon: "⬡", title: "Clone",  desc: "Shallow clone of repo" },
              { icon: "⬡", title: "Chunk",  desc: "AST-aware code splitting" },
              { icon: "⬡", title: "Embed",  desc: "OpenAI text-embedding-3-large" },
              { icon: "⬡", title: "Chat",   desc: "GPT-4o with cited answers" },
            ].map(s => (
              <div key={s.title} className="how-item">
                <div className="how-icon">{s.icon}</div>
                <div className="how-title">{s.title}</div>
                <div className="how-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .dashboard-root {
          min-height: 100vh;
          background: #0A0A0F;
          color: #F0EFF8;
          font-family: 'DM Sans', system-ui, sans-serif;
          position: relative;
          overflow-x: hidden;
        }

        .bg-grid {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image:
            linear-gradient(rgba(123,110,246,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(123,110,246,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 80%);
        }

        .bg-glow {
          position: fixed; top: -100px; left: 50%; transform: translateX(-50%);
          width: 600px; height: 400px; pointer-events: none; z-index: 0;
          background: radial-gradient(ellipse, rgba(123,110,246,0.15) 0%, transparent 70%);
        }

        .nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 40px; height: 60px;
          background: rgba(10,10,15,0.8); backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .nav-logo {
          display: flex; align-items: center; gap: 8px;
          font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 700;
          color: #F0EFF8; text-decoration: none;
        }

        .logo-icon { color: #7B6EF6; font-size: 20px; }

        .nav-tag {
          font-size: 11px; font-family: 'JetBrains Mono', monospace;
          color: rgba(255,255,255,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 3px 10px; border-radius: 99px;
        }

        .main {
          position: relative; z-index: 1;
          min-height: 100vh;
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 28px;
          padding: 100px 24px 60px;
        }

        .card {
          width: 100%; max-width: 580px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px; padding: 36px;
          display: flex; flex-direction: column; gap: 24px;
        }

        .card-header h1 {
          font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 700;
          letter-spacing: -0.02em; margin-bottom: 6px;
        }

        .card-header p { font-size: 14px; color: rgba(240,239,248,0.5); font-weight: 300; }

        .input-group { display: flex; gap: 10px; }

        .url-input-wrap {
          flex: 1; display: flex; align-items: center; gap: 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; padding: 0 14px;
          transition: border-color 0.2s;
        }

        .url-input-wrap:focus-within { border-color: rgba(123,110,246,0.5); }
        .url-input-wrap.disabled { opacity: 0.5; }

        .gh-icon { width: 16px; height: 16px; color: rgba(255,255,255,0.3); flex-shrink: 0; }

        .url-input {
          flex: 1; background: transparent; border: none; outline: none;
          font-family: 'JetBrains Mono', monospace; font-size: 12px;
          color: #F0EFF8; padding: 12px 0;
        }

        .url-input::placeholder { color: rgba(255,255,255,0.2); }

        .analyse-btn {
          padding: 12px 20px; background: #7B6EF6; color: #fff;
          border: none; border-radius: 10px; font-size: 14px; font-weight: 500;
          cursor: pointer; white-space: nowrap; transition: background 0.2s;
          display: flex; align-items: center; gap: 6px; min-width: 110px;
          justify-content: center;
        }

        .analyse-btn:hover:not(:disabled) { background: #9288f8; }
        .analyse-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .analyse-btn.loading { background: rgba(123,110,246,0.5); }

        .spinner {
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .error-banner {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 14px; background: rgba(255,80,80,0.08);
          border: 1px solid rgba(255,80,80,0.2); border-radius: 8px;
          font-size: 13px; color: #ff8080;
        }

        .progress-section { display: flex; flex-direction: column; gap: 16px; }

        .repo-label {
          display: flex; align-items: center; gap: 6px;
          font-family: 'JetBrains Mono', monospace; font-size: 12px;
          color: rgba(255,255,255,0.4);
        }

        .steps-row {
          display: flex; align-items: center; gap: 0;
        }

        .step-item {
          display: flex; align-items: center; gap: 8px;
          flex: 1;
        }

        .step-dot {
          width: 26px; height: 26px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 500; flex-shrink: 0;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.3);
          transition: all 0.3s;
        }

        .step-item.done .step-dot {
          background: rgba(45,212,160,0.15);
          border-color: rgba(45,212,160,0.4);
          color: #2DD4A0;
        }

        .step-item.active .step-dot {
          background: rgba(123,110,246,0.2);
          border-color: rgba(123,110,246,0.6);
          color: #7B6EF6;
        }

        .pulse-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #7B6EF6;
          animation: pulse 1s ease infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.7); opacity: 0.5; }
        }

        .step-label {
          font-size: 11px; color: rgba(255,255,255,0.3);
          text-transform: capitalize;
        }

        .step-item.done .step-label,
        .step-item.active .step-label { color: rgba(255,255,255,0.7); }

        .step-line {
          flex: 1; height: 1px; background: rgba(255,255,255,0.08);
          transition: background 0.3s;
        }

        .step-line.done { background: rgba(45,212,160,0.3); }

        .progress-track {
          height: 3px; background: rgba(255,255,255,0.06);
          border-radius: 99px; overflow: hidden;
        }

        .progress-fill {
          height: 100%; background: linear-gradient(90deg, #7B6EF6, #2DD4A0);
          border-radius: 99px; transition: width 0.6s ease;
        }

        .status-msg {
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; color: rgba(255,255,255,0.5);
        }

        .status-dot {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
          background: rgba(255,255,255,0.2);
        }

        .status-dot.cloning, .status-dot.pending { background: #7B6EF6; animation: pulse 1.2s infinite; }
        .status-dot.chunking  { background: #a89df9; animation: pulse 1.2s infinite; }
        .status-dot.embedding { background: #f9a825; animation: pulse 1.2s infinite; }
        .status-dot.done      { background: #2DD4A0; }
        .status-dot.failed    { background: #ff5555; }

        .chunk-count {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          color: rgba(45,212,160,0.7);
        }

        .examples { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

        .examples-label { font-size: 12px; color: rgba(255,255,255,0.3); }

        .example-chip {
          padding: 5px 12px; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08); border-radius: 99px;
          font-size: 11px; font-family: 'JetBrains Mono', monospace;
          color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s;
        }

        .example-chip:hover {
          background: rgba(123,110,246,0.1);
          border-color: rgba(123,110,246,0.3);
          color: #A89DF9;
        }

        .how-row {
          display: flex; gap: 12px; width: 100%; max-width: 580px;
        }

        .how-item {
          flex: 1; padding: 16px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px; text-align: center;
        }

        .how-icon { font-size: 18px; color: #7B6EF6; margin-bottom: 8px; }
        .how-title { font-size: 13px; font-weight: 500; margin-bottom: 4px; }
        .how-desc { font-size: 11px; color: rgba(255,255,255,0.3); line-height: 1.4; }

        @media (max-width: 520px) {
          .card { padding: 24px; }
          .input-group { flex-direction: column; }
          .how-row { display: none; }
          .nav { padding: 0 20px; }
        }
      `}</style>
    </div>
  );
}
