"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

const COLORS = ["#7c5cfc", "#22d3ee", "#f472b6", "#f59e0b", "#4ade80"];
const THEMES = ["Dark", "Neon", "Dracula", "Custom"];
const HEIGHTS = [18, 34, 52, 78, 58, 42, 24, 12, 28, 48, 70, 84, 60, 38, 20];

export default function LandingPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleIdRef = useRef(0);
  const router = useRouter();

  const handleLetsBegin = () => {
    router.push("/dashboard");
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const x = event.clientX;
      const y = event.clientY;

      const burst = Array.from({ length: 5 }, (_, index) => {
        const angle = Math.random() * Math.PI * 2;
        const distance = 10 + Math.random() * 18 + index * 2;

        return {
          id: particleIdRef.current + index,
          x,
          y,
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          size: 6 + Math.random() * 10,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          opacity: 0.92,
        } satisfies Particle;
      });

      particleIdRef.current += burst.length;
      setParticles((current) => [...current, ...burst].slice(-42));
    };

    const timer = window.setInterval(() => {
      setParticles((current) =>
        current
          .map((particle) => ({
            ...particle,
            x: particle.x + particle.dx * 0.08,
            y: particle.y + particle.dy * 0.08,
            opacity: particle.opacity - 0.055,
            size: Math.max(2, particle.size * 0.985),
          }))
          .filter((particle) => particle.opacity > 0),
      );
    }, 16);

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.clearInterval(timer);
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
              transform: `translate(-50%, -50%) translate(${particle.dx}px, ${particle.dy}px) scale(${Math.max(0.35, particle.opacity)})`,
            }}
          />
        ))}
      </div>

      <div className="grid-bg" />
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <div className="glow" />

      <nav className="navbar">
        <div className="brand">
          <span className="brand-mark" />
          RepoMind
        </div>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#preview">Demo</a>
          <a href="#features">Why it works</a>
          <a href="#studio" className="nav-button">Try it</a>
        </div>
      </nav>

      <main>
        <section className="hero">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            RAG-powered GitHub repo chat
          </div>

          <h1>
            Ask anything about any <span>GitHub repo</span>.
          </h1>

          <p className="hero-copy">
            Drop in a GitHub link, index the codebase, and ask plain-English questions about
            architecture, dependencies, functions, and file ownership. The look stays premium;
            the purpose stays RAG-based.
          </p>

          <div className="hero-tools" id="studio">
            <form className="url-form">
              <input
                type="url"
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                placeholder="https://github.com/owner/repository"
                required
              />
              <button type="button" onClick={handleLetsBegin}>Let's Begin</button>
            </form>

            <div className="hero-actions">
              <button type="button" className="ghost-button">Ask a question</button>
              <button type="button" className="ghost-button accent">Open customization studio</button>
            </div>
          </div>

          <div className="theme-row" aria-label="theme presets">
            {THEMES.map((theme) => (
              <span className="theme-chip" key={theme}>{theme}</span>
            ))}
          </div>
        </section>

        <section className="section" id="preview">
          <div className="preview-shell">
            <div className="preview-head">
              <div>
                <p className="section-tag">See it in action</p>
                <h2>Ask questions with grounded answers</h2>
              </div>
              <div className="preview-badges">
                <span className="badge live">Live sync</span>
                <span className="badge">RAG retrieval</span>
                <span className="badge">File references</span>
              </div>
            </div>

            <div className="preview-grid">
              <div className="monolith-panel">
                <div className="scan-line" />
                <div className="monolith-scene">
                  {HEIGHTS.map((height, index) => (
                    <div key={`${height}-${index}`} className="tower" style={{ height: `${height}px`, animationDelay: `${index * 0.05}s` }}>
                      <span className="tower-top" />
                      <span className="tower-front" />
                      <span className="tower-side" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="preview-copy-wrap">
                <p className="section-tag">Live demo</p>
                <h3>Paste a repo, then ask anything.</h3>
                <p>
                  The page keeps the cinematic theme, but the product flow is back to the real
                  job: accept a GitHub URL, retrieve code context, and answer questions with
                  precise references.
                </p>

                <div className="stats-grid">
                  <div className="stat-card"><span>Input</span><strong>GitHub link</strong></div>
                  <div className="stat-card"><span>Engine</span><strong>RAG search</strong></div>
                  <div className="stat-card"><span>Output</span><strong>Answers + files</strong></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="features">
          <p className="section-tag">Why it helps</p>
          <div className="feature-grid">
            {[
              {
                title: "Repo indexing",
                text: "Drop a GitHub URL and index the codebase so every answer is grounded in the repo itself.",
              },
              {
                title: "Question answering",
                text: "Ask architecture, dependency, or implementation questions in plain English and get direct answers.",
              },
              {
                title: "File references",
                text: "Answers can point back to source files so the result feels trustworthy and easy to verify.",
              },
            ].map((feature) => (
              <article className="feature-card" key={feature.title}>
                <div className="feature-glow" />
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section split-section">
          <div className="split-copy">
            <p className="section-tag">How it works</p>
            <h2>From GitHub link to answer in three steps.</h2>
            <p>
              The frontend stays dramatic, but the product flow is simple: submit a repo, index
              it, and ask questions against the retrieved code context.
            </p>
          </div>

          <div className="how-grid">
            {[
              { num: "01", title: "Paste a GitHub URL", desc: "Drop any public repo link into the input field." },
              { num: "02", title: "Index the codebase", desc: "Chunk and store the repository so the system can retrieve relevant context." },
              { num: "03", title: "Ask any question", desc: "Ask about functions, architecture, dependencies, or any file in the repo." },
            ].map((step) => (
              <div className="how-card" key={step.num}>
                <div className="step-num">{step.num}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="quote-card">
            <p className="quote-mark">“</p>
            <h2>Built for builders who want grounded repo answers in a premium interface.</h2>
            <p>
              The theme is inspired by the same high-contrast, editorial style direction, but the
              purpose remains your original RAG workflow for GitHub repositories.
            </p>
          </div>
        </section>

        <footer className="footer">
          RepoMind - RAG-powered GitHub repo assistant · {new Date().getFullYear()}
        </footer>
      </main>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .landing-root {
    position: relative;
    min-height: 100vh;
    overflow-x: hidden;
    background:
      radial-gradient(circle at top, rgba(124, 92, 252, 0.18), transparent 30%),
      radial-gradient(circle at 80% 12%, rgba(34, 211, 238, 0.12), transparent 24%),
      linear-gradient(180deg, #05060a 0%, #0a0b12 55%, #06070a 100%);
    color: #e8e6f0;
    font-family: 'DM Sans', sans-serif;
    cursor: none;
  }

  .landing-root a,
  .landing-root button,
  .landing-root input { cursor: none; }

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
    will-change: transform, opacity;
    filter: blur(2px) saturate(1.4);
    box-shadow: 0 0 18px currentColor, 0 0 32px currentColor;
  }

  .ambient {
    position: fixed;
    pointer-events: none;
    z-index: 0;
    border-radius: 999px;
    filter: blur(26px);
    opacity: 0.7;
  }

  .ambient-left {
    top: 28vh;
    left: -70px;
    width: 260px;
    height: 260px;
    background: rgba(124, 92, 252, 0.18);
  }

  .ambient-right {
    top: 48vh;
    right: -90px;
    width: 300px;
    height: 300px;
    background: rgba(34, 211, 238, 0.16);
  }

  .grid-bg {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  .glow {
    position: fixed;
    top: -240px;
    left: 50%;
    width: 760px;
    height: 540px;
    transform: translateX(-50%);
    background: radial-gradient(ellipse, rgba(124, 92, 252, 0.2) 0%, transparent 70%);
    z-index: 0;
    pointer-events: none;
  }

  .navbar {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 3rem;
    background: rgba(5, 6, 10, 0.34);
    backdrop-filter: blur(16px);
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.08);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 1.35rem;
    color: #fff;
  }

  .brand-mark {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: linear-gradient(135deg, #7c5cfc, #22d3ee);
    box-shadow: 0 0 14px rgba(124, 92, 252, 0.9);
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 1.2rem;
    flex-wrap: wrap;
  }

  .nav-links a {
    color: rgba(255, 255, 255, 0.56);
    text-decoration: none;
    font-size: 0.88rem;
    transition: color 0.2s ease, transform 0.2s ease;
  }

  .nav-links a:hover {
    color: #fff;
    transform: translateY(-1px);
  }

  .nav-button {
    padding: 0.7rem 1rem;
    border-radius: 999px;
    background: rgba(124, 92, 252, 0.16);
    border: 0.5px solid rgba(124, 92, 252, 0.28);
    color: #fff !important;
  }

  .hero {
    position: relative;
    z-index: 5;
    max-width: 1120px;
    margin: 0 auto;
    padding: 6.5rem 2rem 2rem;
    text-align: center;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 1.8rem;
    padding: 0.42rem 0.95rem;
    border-radius: 999px;
    background: rgba(124, 92, 252, 0.14);
    border: 0.5px solid rgba(124, 92, 252, 0.35);
    color: #c4b5fd;
    font-size: 0.8rem;
    letter-spacing: 0.03em;
  }

  .eyebrow-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: #7c5cfc;
    animation: pulse 2s infinite;
  }

  .hero h1 {
    margin: 0 auto 1.25rem;
    max-width: 11ch;
    font-family: 'Syne', sans-serif;
    font-size: clamp(3rem, 6.4vw, 5.3rem);
    line-height: 0.96;
    letter-spacing: -0.05em;
    color: #fff;
  }

  .hero h1 span { color: #7c5cfc; }

  .hero-copy {
    max-width: 760px;
    margin: 0 auto 2rem;
    color: rgba(255, 255, 255, 0.48);
    line-height: 1.8;
    font-size: 1.02rem;
  }

  .hero-tools {
    max-width: 860px;
    margin: 0 auto;
  }

  .url-form {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.9rem;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.04);
    border: 0.5px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 18px 80px rgba(0, 0, 0, 0.34);
    transition: transform 0.2s ease, border-color 0.2s ease;
  }

  .url-form:focus-within {
    transform: translateY(-1px);
    border-color: rgba(124, 92, 252, 0.52);
  }

  .url-form input {
    flex: 1;
    min-width: 0;
    padding: 0.95rem 1rem;
    border: none;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.04);
    color: #fff;
    font-size: 0.95rem;
    outline: none;
  }

  .url-form input::placeholder { color: rgba(255, 255, 255, 0.3); }

  .url-form button {
    padding: 0.95rem 1.3rem;
    border: none;
    border-radius: 14px;
    background: linear-gradient(135deg, #7c5cfc, #22d3ee);
    color: #fff;
    font-size: 0.9rem;
    font-weight: 500;
    transition: transform 0.2s ease, filter 0.2s ease;
  }

  .url-form button:hover {
    transform: translateY(-1px);
    filter: brightness(1.05);
  }

  .hero-actions {
    display: flex;
    justify-content: center;
    gap: 0.8rem;
    flex-wrap: wrap;
    margin-top: 0.9rem;
  }

  .ghost-button {
    padding: 0.88rem 1.15rem;
    border-radius: 999px;
    border: 0.5px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.03);
    color: #fff;
    font-size: 0.9rem;
    transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
  }

  .ghost-button:hover {
    transform: translateY(-1px);
    border-color: rgba(124, 92, 252, 0.42);
    background: rgba(124, 92, 252, 0.08);
  }

  .ghost-button.accent { background: rgba(34, 211, 238, 0.08); }

  .theme-row {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 1.5rem;
  }

  .theme-chip,
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.85rem;
    border-radius: 999px;
    border: 0.5px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.03);
    color: rgba(255, 255, 255, 0.72);
    font-size: 0.78rem;
  }

  .section {
    position: relative;
    z-index: 5;
    max-width: 1120px;
    margin: 0 auto;
    padding: 4rem 2rem 0;
  }

  .section-tag {
    margin: 0 0 0.7rem;
    color: #7c5cfc;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-size: 0.72rem;
  }

  .preview-shell {
    padding: 1.35rem;
    border-radius: 30px;
    border: 0.5px solid rgba(255, 255, 255, 0.08);
    background: rgba(9, 10, 16, 0.84);
    box-shadow: 0 30px 100px rgba(0, 0, 0, 0.44);
  }

  .preview-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1.2rem;
    margin-bottom: 1.2rem;
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.08);
  }

  .preview-head h2,
  .split-copy h2,
  .quote-card h2,
  .preview-copy-wrap h3 {
    margin: 0;
    font-family: 'Syne', sans-serif;
    color: #fff;
    letter-spacing: -0.04em;
  }

  .preview-head h2 {
    margin-top: 0.2rem;
    font-size: 1.6rem;
  }

  .preview-badges {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .badge.live {
    color: #8b5cf6;
    border-color: rgba(124, 92, 252, 0.26);
    background: rgba(124, 92, 252, 0.12);
  }

  .preview-grid {
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 1.2rem;
    align-items: center;
  }

  .monolith-panel {
    position: relative;
    border-radius: 24px;
    overflow: hidden;
    min-height: 360px;
    border: 0.5px solid rgba(255, 255, 255, 0.08);
    background:
      radial-gradient(circle at 50% 45%, rgba(124, 92, 252, 0.18), transparent 42%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
    padding: 2rem 1.2rem 1.6rem;
  }

  .monolith-panel::before {
    content: "";
    position: absolute;
    inset: 10px;
    border-radius: 18px;
    opacity: 0.26;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 28px 28px;
  }

  .scan-line {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 0%, rgba(34, 211, 238, 0.08) 50%, transparent 100%);
    animation: sweep 6s linear infinite;
    pointer-events: none;
  }

  .monolith-scene {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: end;
    justify-content: center;
    min-height: 320px;
    perspective: 1200px;
  }

  .tower {
    position: relative;
    width: 22px;
    margin: 0 7px;
    transform-style: preserve-3d;
    transform: skewY(-24deg) rotateX(62deg);
    animation: floatTower 4.6s ease-in-out infinite;
  }

  .tower-top,
  .tower-front,
  .tower-side {
    position: absolute;
    display: block;
  }

  .tower-front {
    inset: auto 0 0 0;
    height: 100%;
    border-radius: 5px 5px 2px 2px;
    background: linear-gradient(180deg, rgba(124, 92, 252, 0.96), rgba(74, 222, 128, 0.28));
    box-shadow:
      0 0 20px rgba(124, 92, 252, 0.45),
      inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  }

  .tower-top {
    inset: -8px 0 auto 0;
    height: 14px;
    border-radius: 4px;
    transform: skewX(-44deg);
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.48), rgba(34, 211, 238, 0.95));
    opacity: 0.85;
  }

  .tower-side {
    top: 0;
    right: -8px;
    width: 8px;
    height: 100%;
    border-radius: 0 4px 4px 0;
    transform: skewY(42deg);
    background: linear-gradient(180deg, rgba(34, 211, 238, 0.55), rgba(10, 10, 15, 0.12));
    opacity: 0.85;
  }

  .preview-copy-wrap {
    padding: 0.2rem;
  }

  .preview-copy-wrap h3 {
    font-size: 2rem;
    line-height: 1.04;
    margin-bottom: 0.8rem;
  }

  .preview-copy-wrap p {
    color: rgba(255, 255, 255, 0.46);
    line-height: 1.8;
    font-size: 0.95rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
    margin-top: 1.4rem;
  }

  .stat-card {
    padding: 0.95rem;
    border-radius: 18px;
    border: 0.5px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  .stat-card span {
    display: block;
    margin-bottom: 0.35rem;
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.76rem;
  }

  .stat-card strong {
    color: #fff;
    font-size: 1rem;
  }

  .feature-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    margin-top: 1.4rem;
  }

  .feature-card {
    position: relative;
    overflow: hidden;
    min-height: 180px;
    padding: 1.35rem;
    border-radius: 22px;
    border: 0.5px solid rgba(255, 255, 255, 0.08);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
  }

  .feature-glow {
    position: absolute;
    inset: auto -20px -60px auto;
    width: 160px;
    height: 160px;
    border-radius: 999px;
    filter: blur(10px);
    background: radial-gradient(circle, rgba(124, 92, 252, 0.25), transparent 68%);
  }

  .feature-card h3 {
    position: relative;
    margin: 0 0 0.7rem;
    font-family: 'Syne', sans-serif;
    color: #fff;
    font-size: 1.1rem;
  }

  .feature-card p {
    position: relative;
    max-width: 28ch;
    color: rgba(255, 255, 255, 0.44);
    line-height: 1.7;
    font-size: 0.92rem;
  }

  .split-section {
    display: grid;
    grid-template-columns: 0.8fr 1.2fr;
    gap: 1.5rem;
    align-items: start;
  }

  .split-copy h2 {
    margin: 0.3rem 0 1rem;
    font-size: clamp(2rem, 3vw, 3rem);
  }

  .split-copy p {
    color: rgba(255, 255, 255, 0.44);
    line-height: 1.8;
    font-size: 0.96rem;
  }

  .how-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
  }

  .how-card {
    padding: 1.4rem;
    border-radius: 20px;
    border: 0.5px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  .step-num {
    margin-bottom: 1rem;
    color: rgba(124, 92, 252, 0.24);
    font-family: 'Syne', sans-serif;
    font-size: 2rem;
    font-weight: 800;
    line-height: 1;
  }

  .how-card h3 {
    margin: 0 0 0.5rem;
    color: #fff;
    font-family: 'Syne', sans-serif;
    font-size: 1rem;
  }

  .how-card p {
    color: rgba(255, 255, 255, 0.42);
    line-height: 1.6;
    font-size: 0.85rem;
  }

  .quote-card {
    position: relative;
    overflow: hidden;
    padding: 2rem;
    border-radius: 30px;
    border: 0.5px solid rgba(255, 255, 255, 0.09);
    background: linear-gradient(135deg, rgba(124, 92, 252, 0.12), rgba(34, 211, 238, 0.08));
  }

  .quote-mark {
    margin: 0 0 0.3rem;
    color: rgba(255, 255, 255, 0.24);
    font-family: 'Syne', sans-serif;
    font-size: 4rem;
    line-height: 0.7;
  }

  .quote-card h2 {
    max-width: 16ch;
    margin-bottom: 1rem;
    font-size: clamp(2rem, 3.4vw, 3.4rem);
  }

  .quote-card p {
    max-width: 60ch;
    color: rgba(255, 255, 255, 0.46);
    line-height: 1.8;
  }

  .footer {
    position: relative;
    z-index: 5;
    padding: 2rem 0 2.5rem;
    border-top: 0.5px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.22);
    font-size: 0.78rem;
    text-align: center;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }

  @keyframes sweep {
    0% { transform: translateY(-18%); opacity: 0; }
    10% { opacity: 0.8; }
    100% { transform: translateY(135%); opacity: 0; }
  }

  @keyframes floatTower {
    0%, 100% { transform: skewY(-24deg) rotateX(62deg) translateY(0); }
    50% { transform: skewY(-24deg) rotateX(62deg) translateY(-6px); }
  }

  @media (max-width: 960px) {
    .preview-grid,
    .split-section,
    .feature-grid,
    .how-grid,
    .stats-grid {
      grid-template-columns: 1fr;
    }

    .preview-head {
      flex-direction: column;
      align-items: flex-start;
    }

    .preview-badges { justify-content: flex-start; }
  }

  @media (max-width: 768px) {
    .navbar {
      flex-direction: column;
      align-items: flex-start;
      padding: 1rem 1.5rem;
    }

    .hero {
      padding: 4.5rem 1.5rem 1rem;
    }

    .hero h1 {
      max-width: 12ch;
      font-size: clamp(2.6rem, 12vw, 4rem);
    }

    .url-form {
      flex-direction: column;
      align-items: stretch;
    }

    .section {
      padding: 3rem 1.5rem 0;
    }

    .monolith-panel {
      min-height: 320px;
    }

    .tower {
      width: 16px;
      margin: 0 4px;
    }

    .quote-card,
    .preview-shell {
      border-radius: 24px;
    }
  }
`;