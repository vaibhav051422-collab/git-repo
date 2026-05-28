"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type Particle = {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
  opacity: number;
};

const TRAIL_COLORS = ["#7c5cfc", "#22d3ee", "#f472b6", "#f59e0b", "#4ade80"];

export default function LandingPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleIdRef = useRef(0);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log("Exploring repo:", repoUrl);
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const baseX = event.clientX;
      const baseY = event.clientY;

      const burst = Array.from({ length: 4 }, (_, index) => {
        const angle = Math.random() * Math.PI * 2;
        const distance = 8 + Math.random() * 20 + index * 3;

        return {
          id: particleIdRef.current + index,
          x: baseX,
          y: baseY,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          size: 6 + Math.random() * 10,
          color: TRAIL_COLORS[Math.floor(Math.random() * TRAIL_COLORS.length)],
          opacity: 0.9,
        } satisfies Particle;
      });

      particleIdRef.current += burst.length;
      setParticles((current) => [...current, ...burst].slice(-36));
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    const fadeTimer = window.setInterval(() => {
      setParticles((current) =>
        current
          .map((particle) => ({
            ...particle,
            x: particle.x + particle.dx * 0.08,
            y: particle.y + particle.dy * 0.08,
            opacity: particle.opacity - 0.06,
            size: Math.max(2, particle.size * 0.985),
          }))
          .filter((particle) => particle.opacity > 0),
      );
    }, 16);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.clearInterval(fadeTimer);
    };
  }, []);

  return (
    <div className="landing-root">
      <div className="cursor-trail" aria-hidden="true">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="trail-particle"
            style={{
              left: particle.x,
              top: particle.y,
              width: particle.size,
              height: particle.size,
              background: particle.color,
              opacity: particle.opacity,
              transform: `translate(-50%, -50%) translate(${particle.dx}px, ${particle.dy}px) scale(${Math.max(
                0.35,
                particle.opacity,
              )})`,
            }}
          />
        ))}
      </div>
      <div className="grid-bg" />
      <div className="glow" />

      <nav className="navbar">
        <div className="logo">
          <span className="logo-dot" />
          RepoMind
        </div>
        <ul className="nav-links">
          <li><a href="#how">How it works</a></li>
          <li><a href="#demo">Demo</a></li>
          <li><a href="/docs">Docs</a></li>
          <li><a href="/app" className="nav-cta">Try free</a></li>
        </ul>
      </nav>

      <section className="hero">
        <div className="badge">
          <span className="badge-dot" />
          RAG-powered codebase intelligence
        </div>

        <h1>
          Ask anything about<br />any <span className="accent">GitHub repo</span>
        </h1>

        <p className="hero-sub">
          Paste a GitHub link and get instant, accurate answers about the codebase -
          architecture, functions, dependencies, and more.
        </p>

        <form className="input-row" onSubmit={handleSubmit}>
          <input
            type="url"
            value={repoUrl}
            onChange={(event) => setRepoUrl(event.target.value)}
            placeholder="https://github.com/owner/repository"
            required
          />
          <button type="submit">Explore repo →</button>
        </form>

        <p className="hint">
          Try <code>vercel/next.js</code> or <code>fastapi/fastapi</code>
        </p>
      </section>

      <section className="section" id="how">
        <p className="section-label">How it works</p>
        <div className="how-grid">
          {[
            {
              num: "01",
              title: "Paste a GitHub URL",
              desc: "Drop any public repo link. We clone and index all the files automatically.",
            },
            {
              num: "02",
              title: "Repo gets indexed",
              desc: "Code is chunked, embedded, and stored in a vector database for fast retrieval.",
            },
            {
              num: "03",
              title: "Start asking",
              desc: "Ask questions in plain English. Get grounded answers with file references.",
            },
          ].map((step) => (
            <div className="how-card" key={step.num}>
              <div className="step-num">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="demo">
        <p className="section-label">See it in action</p>
        <div className="chat-preview">
          <div className="chat-repo-bar">
            <span>github.com/</span>tiangolo/fastapi
          </div>

          <ChatMessage role="user" text="How does dependency injection work in this repo?" />
          <ChatMessage
            role="ai"
            text={
              <>
                FastAPI uses <code>Depends()</code> to declare dependencies. When a route
                function lists a parameter typed with <code>Depends(some_func)</code>,
                FastAPI resolves it before calling your handler - supporting nested and async
                dependencies out of the box. See <code>fastapi/dependencies/utils.py</code>
                for the core resolution logic.
              </>
            }
          />

          <div className="divider" />

          <ChatMessage role="user" text="Which file handles OpenAPI schema generation?" />
          <ChatMessage
            role="ai"
            text={
              <>
                That&apos;s handled in <code>fastapi/openapi/utils.py</code> - specifically
                the <code>get_openapi()</code> function which aggregates route metadata and
                produces the spec dict.
              </>
            }
          />
        </div>
      </section>

      <footer className="footer">
        RepoMind - built with RAG  · {new Date().getFullYear()}
      </footer>

      <style jsx>{styles}</style>
    </div>
  );
}

function ChatMessage({
  role,
  text,
}: {
  role: "user" | "ai";
  text: ReactNode;
}) {
  return (
    <div className="msg">
      <div className={`msg-avatar avatar-${role}`}>{role === "user" ? "U" : "AI"}</div>
      <div className="msg-bubble">{text}</div>
    </div>
  );
}

const styles = `
  .landing-root {
    font-family: 'DM Sans', sans-serif;
    background: #0a0a0f;
    color: #e8e6f0;
    min-height: 100vh;
    overflow-x: hidden;
    position: relative;
    cursor: none;
  }

  .landing-root a,
  .landing-root button,
  .landing-root input {
    cursor: none;
  }

  .cursor-trail {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 60;
    mix-blend-mode: screen;
  }

  .trail-particle {
    position: fixed;
    border-radius: 999px;
    filter: blur(2px) saturate(1.5);
    box-shadow:
      0 0 18px currentColor,
      0 0 34px currentColor;
    will-change: transform, opacity;
  }

  .grid-bg {
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(rgba(100,80,255,0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(100,80,255,0.06) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    z-index: 0;
  }

  .glow {
    position: fixed;
    top: -200px;
    left: 50%;
    transform: translateX(-50%);
    width: 700px;
    height: 500px;
    background: radial-gradient(ellipse, rgba(99,74,255,0.18) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .navbar {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 3rem;
    border-bottom: 0.5px solid rgba(255,255,255,0.07);
  }

  .logo {
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 1.3rem;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logo-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #7c5cfc;
  }

  .nav-links {
    display: flex;
    gap: 2rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .nav-links a {
    color: rgba(255,255,255,0.5);
    text-decoration: none;
    font-size: 0.88rem;
    transition: color 0.2s;
  }

  .nav-links a:hover { color: #fff; }

  .nav-cta {
    background: #7c5cfc;
    color: #fff !important;
    padding: 0.45rem 1.1rem;
    border-radius: 8px;
  }

  .hero {
    position: relative;
    z-index: 5;
    text-align: center;
    padding: 6rem 2rem 4rem;
    max-width: 860px;
    margin: 0 auto;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(124,92,252,0.12);
    border: 0.5px solid rgba(124,92,252,0.35);
    color: #a78bfa;
    font-size: 0.78rem;
    padding: 0.35rem 0.9rem;
    border-radius: 99px;
    margin-bottom: 2rem;
    letter-spacing: 0.03em;
  }

  .badge-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #7c5cfc;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .hero h1 {
    font-family: 'Syne', sans-serif;
    font-size: clamp(2.8rem, 6vw, 4.2rem);
    font-weight: 800;
    line-height: 1.08;
    color: #fff;
    margin-bottom: 1.5rem;
  }

  .accent { color: #7c5cfc; }

  .hero-sub {
    font-size: 1.05rem;
    color: rgba(255,255,255,0.45);
    max-width: 520px;
    margin: 0 auto 2.5rem;
    line-height: 1.7;
    font-weight: 300;
  }

  .input-row {
    display: flex;
    align-items: center;
    max-width: 560px;
    margin: 0 auto 1rem;
    background: rgba(255,255,255,0.04);
    border: 0.5px solid rgba(255,255,255,0.12);
    border-radius: 12px;
    padding: 6px 6px 6px 16px;
    transition: border-color 0.2s;
  }

  .input-row:focus-within {
    border-color: rgba(124,92,252,0.5);
  }

  .input-row input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: #fff;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.9rem;
  }

  .input-row input::placeholder { color: rgba(255,255,255,0.25); }

  .input-row button {
    background: #7c5cfc;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 0.6rem 1.3rem;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.88rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s;
  }

  .input-row button:hover { background: #6a48f0; }

  .hint {
    font-size: 0.78rem;
    color: rgba(255,255,255,0.2);
  }

  .hint code {
    font-family: monospace;
    color: rgba(255,255,255,0.35);
  }

  .section {
    position: relative;
    z-index: 5;
    padding: 4rem 3rem;
    max-width: 1100px;
    margin: 0 auto;
  }

  .section-label {
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    color: #7c5cfc;
    text-transform: uppercase;
    margin-bottom: 1rem;
    font-weight: 500;
  }

  .how-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    background: rgba(255,255,255,0.06);
    border-radius: 16px;
    overflow: hidden;
    margin-top: 2.5rem;
  }

  .how-card {
    background: #0d0d15;
    padding: 2rem 1.75rem;
  }

  .step-num {
    font-family: 'Syne', sans-serif;
    font-size: 2.5rem;
    font-weight: 800;
    color: rgba(124,92,252,0.2);
    line-height: 1;
    margin-bottom: 1rem;
  }

  .how-card h3 {
    font-family: 'Syne', sans-serif;
    font-size: 1rem;
    font-weight: 700;
    color: #fff;
    margin-bottom: 0.5rem;
  }

  .how-card p {
    font-size: 0.85rem;
    color: rgba(255,255,255,0.38);
    line-height: 1.6;
  }

  .chat-preview {
    background: #0d0d15;
    border: 0.5px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    padding: 1.5rem;
    max-width: 640px;
    margin: 2rem auto 0;
  }

  .chat-repo-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0.6rem 0.9rem;
    background: rgba(255,255,255,0.03);
    border: 0.5px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    margin-bottom: 1.25rem;
    font-size: 0.8rem;
    color: rgba(255,255,255,0.35);
    font-family: monospace;
  }

  .chat-repo-bar span { color: rgba(255,255,255,0.6); }

  .msg {
    display: flex;
    gap: 10px;
    margin-bottom: 1rem;
    align-items: flex-start;
  }

  .msg-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    font-weight: 700;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .avatar-user {
    background: rgba(124,92,252,0.2);
    color: #a78bfa;
  }

  .avatar-ai {
    background: rgba(20,200,120,0.15);
    color: #4ade80;
  }

  .msg-bubble {
    background: rgba(255,255,255,0.04);
    border: 0.5px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    padding: 0.6rem 0.9rem;
    font-size: 0.83rem;
    line-height: 1.55;
    color: rgba(255,255,255,0.7);
    max-width: 480px;
  }

  .msg-bubble code {
    background: rgba(255,255,255,0.07);
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 0.78rem;
    color: #a78bfa;
    font-family: monospace;
  }

  .divider {
    height: 0.5px;
    background: rgba(255,255,255,0.05);
    margin: 1rem 0;
  }

  .footer {
    position: relative;
    z-index: 5;
    text-align: center;
    padding: 2rem;
    border-top: 0.5px solid rgba(255,255,255,0.05);
    font-size: 0.78rem;
    color: rgba(255,255,255,0.18);
  }

  @media (max-width: 768px) {
    .navbar {
      padding: 1rem 1.5rem;
    }

    .nav-links {
      gap: 1rem;
    }

    .how-grid {
      grid-template-columns: 1fr;
    }

    .section {
      padding: 3rem 1.5rem;
    }

    .hero {
      padding: 4rem 1.5rem 3rem;
    }
  }
`;