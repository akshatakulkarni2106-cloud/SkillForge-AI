import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export default function LandingPage() {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useSettings();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('resume');

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh', overflowX: 'hidden' }}>
      {/* Top Navbar */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(16px)',
          background: 'var(--card)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontFamily: 'Bricolage Grotesque, Inter, sans-serif',
                fontWeight: 900,
                fontSize: '1.45rem',
                color: 'var(--ink)',
                letterSpacing: '-0.03em',
              }}
            >
              SkillForge<span style={{ color: 'var(--pri)', marginLeft: 3 }}>AI</span>
            </span>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 24, flexDirection: 'row', overflow: 'visible' }}>
            <a href="#features" style={{ color: 'var(--mut)', textDecoration: 'none', fontSize: '.92rem', fontWeight: 500 }}>
              Features
            </a>
            <a href="#modules" style={{ color: 'var(--mut)', textDecoration: 'none', fontSize: '.92rem', fontWeight: 500 }}>
              Modules
            </a>
            <a href="#comparison" style={{ color: 'var(--mut)', textDecoration: 'none', fontSize: '.92rem', fontWeight: 500 }}>
              Why Us
            </a>
            <a href="#cta" style={{ color: 'var(--mut)', textDecoration: 'none', fontSize: '.92rem', fontWeight: 500 }}>
              Get Started
            </a>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="btn theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 999,
                fontSize: '.86rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>{isDark ? '☀️' : '🌙'}</span>
              <span>{isDark ? 'Light' : 'Dark'}</span>
            </button>

            {user ? (
              <Link to="/dashboard" className="btn primary" style={{ textDecoration: 'none', padding: '9px 18px' }}>
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn" style={{ textDecoration: 'none', padding: '9px 16px' }}>
                  Log In
                </Link>
                <Link to="/register" className="btn primary" style={{ textDecoration: 'none', padding: '9px 18px' }}>
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        style={{
          padding: '80px 24px 70px',
          background: 'radial-gradient(ellipse at 50% 10%, var(--pri-subtle) 0%, var(--bg) 75%)',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--card)',
              border: '1px solid var(--line-strong)',
              padding: '6px 16px',
              borderRadius: 999,
              fontSize: '.86rem',
              fontWeight: 600,
              color: 'var(--pri)',
              boxShadow: '0 4px 14px rgba(225, 29, 72, 0.1)',
              marginBottom: 24,
            }}
          >
            <span>✨</span> Next-Gen AI Technical Career Accelerator
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.4rem, 5.2vw, 3.8rem)',
              fontWeight: 900,
              lineHeight: 1.12,
              letterSpacing: '-0.035em',
              marginBottom: 20,
              color: 'var(--ink)',
            }}
          >
            Turn Your Code & Resume Into{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #e11d48 0%, #db2777 50%, #f43f5e 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Dream Job Offers
            </span>
          </h1>

          <p
            style={{
              fontSize: 'clamp(1.05rem, 1.8vw, 1.25rem)',
              lineHeight: 1.6,
              color: 'var(--mut)',
              maxWidth: 720,
              margin: '0 auto 36px',
            }}
          >
            Zero boilerplate or generic scores. SkillForge AI leverages live LLM reasoning over your real resume text,
            GitHub repository manifests, and code architectures to land top-tier software engineering positions.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 48 }}>
            <button
              type="button"
              className="primary"
              onClick={() => navigate(user ? '/resume' : '/register')}
              style={{ padding: '14px 28px', fontSize: '1rem', borderRadius: 12 }}
            >
              🚀 Analyze Your Resume with AI
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => navigate(user ? '/projects' : '/login')}
              style={{ padding: '14px 26px', fontSize: '1rem', borderRadius: 12, borderColor: 'var(--pri)', color: 'var(--pri)' }}
            >
              🐙 Audit GitHub Project
            </button>
          </div>

          {/* Proof Badges */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 36,
              flexWrap: 'wrap',
              paddingTop: 16,
              borderTop: '1px solid var(--line)',
            }}
          >
            <div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: 'var(--pri)', fontFamily: 'Bricolage Grotesque' }}>
                94%
              </div>
              <div style={{ fontSize: '.82rem', color: 'var(--mut)', fontWeight: 500 }}>ATS Scannability Rate</div>
            </div>
            <div style={{ width: 1, height: 32, background: 'var(--line)' }} />
            <div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: 'var(--warm)', fontFamily: 'Bricolage Grotesque' }}>
                3.4x
              </div>
              <div style={{ fontSize: '.82rem', color: 'var(--mut)', fontWeight: 500 }}>More Recruiter Callbacks</div>
            </div>
            <div style={{ width: 1, height: 32, background: 'var(--line)' }} />
            <div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: 'var(--ink)', fontFamily: 'Bricolage Grotesque' }}>
                100%
              </div>
              <div style={{ fontSize: '.82rem', color: 'var(--mut)', fontWeight: 500 }}>Live AI Reasoning (No Fake Scores)</div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Feature Tabs Section */}
      <section id="features" style={{ padding: '70px 24px', maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <h2 style={{ fontSize: '2.1rem', fontWeight: 800, marginBottom: 12 }}>
            Engineered for Modern Software Developers
          </h2>
          <p className="muted" style={{ maxWidth: 600, margin: '0 auto', fontSize: '1rem' }}>
            Explore how each module works in tandem to diagnose weaknesses, prove your engineering depth, and unlock competitive offers.
          </p>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 36, flexWrap: 'wrap' }}>
          {[
            { id: 'resume', label: '📄 Resume Analyzer & ATS Optimizer' },
            { id: 'project', label: '🐙 Project & GitHub Auditor' },
            { id: 'interview', label: '🎙️ Adaptive AI Mock Interview' },
            { id: 'skills', label: '📊 Skill Profile & Gap Analysis' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '11px 20px',
                borderRadius: 999,
                fontWeight: 600,
                fontSize: '.92rem',
                border: activeTab === tab.id ? 'none' : '1px solid var(--line-strong)',
                background: activeTab === tab.id ? 'var(--pri-gradient)' : 'var(--card)',
                color: activeTab === tab.id ? '#fff' : 'var(--ink)',
                boxShadow: activeTab === tab.id ? '0 4px 14px rgba(225, 29, 72, 0.3)' : 'none',
                transition: 'all .2s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Resume */}
        {activeTab === 'resume' && (
          <div
            className="card"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 32,
              padding: 36,
              border: '1.5px solid var(--line-strong)',
              boxShadow: '0 12px 36px rgba(225, 29, 72, 0.08)',
            }}
          >
            <div>
              <span className="tag pink" style={{ marginBottom: 12 }}>
                ATS Optimization & Line-by-Line Critique
              </span>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '8px 0 14px' }}>
                Unsparing, Calibrated Feedback That Actually Gets You Interviews
              </h3>
              <p style={{ color: 'var(--mut)', lineHeight: 1.6, fontSize: '.95rem', marginBottom: 20 }}>
                Traditional resume scanners just check keywords against a generic dictionary. SkillForge AI reads your real bullets, checks for quantified metrics (Google XYZ formula), flags vague phrasing, and recommends verifiable credentials from standard bodies.
              </p>
              <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: '.92rem', color: 'var(--ink)' }}>
                <li><strong>Line-by-Line Strengths:</strong> Quotes real high-impact phrases recruiters love.</li>
                <li><strong>Concrete Fixes:</strong> Highlights weak bullets and offers exact quantified rewrites.</li>
                <li><strong>Verified Certifications:</strong> Recommends AWS, Azure, GCP, Meta, CompTIA with gap-closing rationales.</li>
                <li><strong>Interactive Job Tailoring:</strong> Paste any Job Description for instant keyword gap matching.</li>
              </ul>
              <div style={{ marginTop: 26 }}>
                <Link to={user ? '/resume' : '/register'} className="btn primary" style={{ textDecoration: 'none' }}>
                  Try Resume Analyzer →
                </Link>
              </div>
            </div>

            {/* Visual Preview Card */}
            <div style={{ background: 'var(--pri-subtle)', borderRadius: 16, padding: 22, border: '1px solid var(--line-strong)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--ink)' }}>ATS Diagnostic Preview</div>
                <span className="tag ok">78/100 · Strong</span>
              </div>
              <div className="score-breakdown-grid" style={{ marginBottom: 16 }}>
                <div style={{ background: 'var(--card)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '.78rem', color: 'var(--mut)', fontWeight: 600 }}>Impact & Metrics</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--pri)' }}>82%</div>
                </div>
                <div style={{ background: 'var(--card)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '.78rem', color: 'var(--mut)', fontWeight: 600 }}>Role Relevance</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--warm)' }}>75%</div>
                </div>
              </div>
              <div style={{ background: 'var(--card)', padding: 14, borderRadius: 10, borderLeft: '3px solid #10b981', marginBottom: 10 }}>
                <div style={{ fontSize: '.78rem', color: '#10b981', fontWeight: 700 }}>✓ HIGH-IMPACT BULLET IDENTIFIED</div>
                <div style={{ fontSize: '.86rem', color: 'var(--ink)', marginTop: 4 }}>
                  "Engineered distributed cache invalidation pipeline reducing P99 latency by 34%."
                </div>
              </div>
              <div style={{ background: 'var(--card)', padding: 14, borderRadius: 10, borderLeft: '3px solid #f43f5e' }}>
                <div style={{ fontSize: '.78rem', color: 'var(--pri)', fontWeight: 700 }}>⚠️ WEAK LINE DETECTED</div>
                <div style={{ fontSize: '.86rem', color: 'var(--ink)', marginTop: 4 }}>
                  "Worked on frontend bugs and added components."
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--pri)', marginTop: 4, fontStyle: 'italic' }}>
                  → Suggestion: Quantify sprint velocity or component reuse metrics.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Project */}
        {activeTab === 'project' && (
          <div
            className="card"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 32,
              padding: 36,
              border: '1.5px solid var(--line-strong)',
              boxShadow: '0 12px 36px rgba(225, 29, 72, 0.08)',
            }}
          >
            <div>
              <span className="tag pink" style={{ marginBottom: 12 }}>
                GitHub Public API & Live Code Tree Inspection
              </span>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '8px 0 14px' }}>
                Audit Your Codebase Like a Principal Staff Architect
              </h3>
              <p style={{ color: 'var(--mut)', lineHeight: 1.6, fontSize: '.95rem', marginBottom: 20 }}>
                Paste any public GitHub repository URL. SkillForge AI reads your README, parses your file tree, inspects manifest dependencies (<code>package.json</code>, <code>requirements.txt</code>, <code>Dockerfile</code>), and determines if your work looks like a generic tutorial clone or a production-ready application.
              </p>
              <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: '.92rem', color: 'var(--ink)' }}>
                <li><strong>Tutorial-Clone Detection:</strong> Candid evaluation on whether recruiters will dismiss your project as a basic walkthrough.</li>
                <li><strong>Quantified STAR Bullets:</strong> Generates ready-to-copy bullet points for your resume.</li>
                <li><strong>Downstream Verification:</strong> High project scores automatically bolster your verified skills in your profile and dashboard.</li>
                <li><strong>Actionable Roadmap:</strong> Concrete next steps (e.g. testing, CI/CD, caching, migrations) to elevate the project.</li>
              </ul>
              <div style={{ marginTop: 26 }}>
                <Link to={user ? '/projects' : '/register'} className="btn primary" style={{ textDecoration: 'none' }}>
                  Audit a GitHub Project →
                </Link>
              </div>
            </div>

            {/* Visual Preview */}
            <div style={{ background: 'var(--pri-subtle)', borderRadius: 16, padding: 22, border: '1px solid var(--line-strong)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Project Audit Report</div>
                <span className="tag pink">Production-Grade</span>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', padding: 12, borderRadius: 10, marginBottom: 14 }}>
                <div style={{ fontSize: '.84rem', fontWeight: 700, color: '#10b981' }}>⭐ Verified Original Architectural Work</div>
                <div style={{ fontSize: '.8rem', color: 'var(--ink)', marginTop: 2 }}>
                  Custom domain modeling, decoupled service layers, and concurrency controls detected.
                </div>
              </div>
              <div style={{ background: 'var(--card)', padding: 14, borderRadius: 10, border: '1px solid var(--line)', marginBottom: 12 }}>
                <div style={{ fontSize: '.78rem', textTransform: 'uppercase', color: 'var(--pri)', fontWeight: 700 }}>
                  Generated STAR Resume Bullet
                </div>
                <div style={{ fontSize: '.86rem', color: 'var(--ink)', marginTop: 4, lineHeight: 1.5 }}>
                  "Architected distributed WebSocket cluster in Go with Redis pub/sub adapter, supporting 10k+ concurrent active connections with &lt;15ms delivery latency."
                </div>
              </div>
              <div className="chips">
                <span style={{ fontWeight: 600 }}>Go</span>
                <span style={{ fontWeight: 600 }}>Redis</span>
                <span style={{ fontWeight: 600 }}>WebSockets</span>
                <span style={{ fontWeight: 600 }}>Docker</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Interview */}
        {activeTab === 'interview' && (
          <div
            className="card"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 32,
              padding: 36,
              border: '1.5px solid var(--line-strong)',
              boxShadow: '0 12px 36px rgba(225, 29, 72, 0.08)',
            }}
          >
            <div>
              <span className="tag pink" style={{ marginBottom: 12 }}>
                Adaptive Voice & Code Mock Interviewer
              </span>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '8px 0 14px' }}>
                Practice Under Realistic Pressure with AI Avatars
              </h3>
              <p style={{ color: 'var(--mut)', lineHeight: 1.6, fontSize: '.95rem', marginBottom: 20 }}>
                Experience dynamic multi-turn technical interviews. Our AI adjusts difficulty in real-time based on your responses, analyzes code structure in the browser editor, and gives actionable feedback on speech, clarity, and system design trade-offs.
              </p>
              <div style={{ marginTop: 26 }}>
                <Link to={user ? '/interview' : '/register'} className="btn primary" style={{ textDecoration: 'none' }}>
                  Start Mock Interview →
                </Link>
              </div>
            </div>
            <div style={{ background: '#180815', color: '#fff', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--pri-gradient)', display: 'grid', placeItems: 'center', fontSize: '1.2rem' }}>
                  🎙️
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>AI Technical Lead</div>
                  <div style={{ fontSize: '.8rem', color: '#fbcfe8' }}>Full Stack & Distributed Systems</div>
                </div>
              </div>
              <p style={{ fontSize: '.9rem', color: '#fce7f1', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>
                "Can you walk me through how you would handle race conditions when two concurrent requests try to update the same account balance?"
              </p>
            </div>
          </div>
        )}

        {/* Tab 4: Skills */}
        {activeTab === 'skills' && (
          <div
            className="card"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 32,
              padding: 36,
              border: '1.5px solid var(--line-strong)',
              boxShadow: '0 12px 36px rgba(225, 29, 72, 0.08)',
            }}
          >
            <div>
              <span className="tag pink" style={{ marginBottom: 12 }}>
                Downstream Skill Verification
              </span>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '8px 0 14px' }}>
                A Single Unified Truth for Your Engineering Mastery
              </h3>
              <p style={{ color: 'var(--mut)', lineHeight: 1.6, fontSize: '.95rem', marginBottom: 20 }}>
                Every skill extracted from your resume, proven through project audits, or tested via assessments feeds your Skill Profile. Compare against real hiring benchmarks with instant Skill Gap analysis.
              </p>
              <div style={{ marginTop: 26 }}>
                <Link to={user ? '/skills' : '/register'} className="btn primary" style={{ textDecoration: 'none' }}>
                  View Skill Matrix →
                </Link>
              </div>
            </div>
            <div style={{ background: 'var(--pri-subtle)', borderRadius: 16, padding: 22, border: '1px solid var(--line-strong)' }}>
              <div style={{ fontWeight: 800, marginBottom: 12 }}>Skill Verification Hierarchy</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: 'var(--card)', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>React</span>
                  <span className="tag ok">Verified · 84%</span>
                </div>
                <div style={{ background: 'var(--card)', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Node.js</span>
                  <span className="tag ok">Verified (Project Proof) · 78%</span>
                </div>
                <div style={{ background: 'var(--card)', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Docker</span>
                  <span className="tag mid">Unverified (Resume Only) · 0%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Comparison Grid Section */}
      <section id="comparison" style={{ padding: '60px 24px', background: 'var(--pri-subtle)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 10 }}>
              Why Developers Choose SkillForge AI
            </h2>
            <p className="muted" style={{ fontSize: '.95rem' }}>
              How we compare to generic resume checkers and static course portals:
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            <div className="card" style={{ margin: 0, border: '1px solid var(--line)', background: 'var(--card)' }}>
              <h3 style={{ color: 'var(--pri)', fontSize: '1.1rem', marginBottom: 14 }}>
                ❌ Traditional Tools
              </h3>
              <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10, fontSize: '.9rem', color: 'var(--mut)' }}>
                <li>Hardcoded, fixed scoring formulas with zero reasoning.</li>
                <li>Vague boilerplate advice: "Use more action verbs".</li>
                <li>No awareness of GitHub repositories or codebase architecture.</li>
                <li>Praises generic tutorial clones that recruiters discard.</li>
                <li>Disjointed modules with no downstream profile persistence.</li>
              </ul>
            </div>

            <div className="card" style={{ margin: 0, border: '2px solid var(--pri)', background: 'var(--card)', position: 'relative', boxShadow: '0 8px 30px rgba(225, 29, 72, 0.12)' }}>
              <div style={{ position: 'absolute', top: -12, right: 16, background: 'var(--pri)', color: '#fff', padding: '2px 10px', borderRadius: 999, fontSize: '.74rem', fontWeight: 700 }}>
                SUPERIOR APPROACH
              </div>
              <h3 style={{ color: 'var(--pri)', fontSize: '1.1rem', marginBottom: 14 }}>
                ✨ SkillForge AI
              </h3>
              <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10, fontSize: '.9rem', color: 'var(--ink)' }}>
                <li><strong>Live Groq LLM Reasoning:</strong> 100% evaluated over your actual text & files.</li>
                <li><strong>Line-by-Line Quotes:</strong> Tells you exactly which sentences are hurting you.</li>
                <li><strong>GitHub Dependency Scans:</strong> Inspects real manifests, file trees, and READMEs.</li>
                <li><strong>Tutorial-Clone Detection:</strong> Honest assessment to prevent recruiter rejections.</li>
                <li><strong>Unified Career Hub:</strong> Resume and project proof directly boost your verified skills and dashboard score.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section id="cta" style={{ padding: '80px 24px', maxWidth: 1040, margin: '0 auto', textAlign: 'center' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #180815 0%, #340c26 100%)',
            color: '#fff',
            borderRadius: 24,
            padding: '50px 32px',
            boxShadow: '0 16px 48px rgba(32, 10, 24, 0.2)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -60,
              right: -60,
              width: 220,
              height: 220,
              background: 'radial-gradient(circle, rgba(225, 29, 72, 0.4) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', color: '#fff', fontWeight: 900, marginBottom: 14 }}>
            Ready to Take Your Engineering Career to the Next Level?
          </h2>
          <p style={{ color: '#fce7f1', fontSize: '1.05rem', maxWidth: 620, margin: '0 auto 30px', lineHeight: 1.6 }}>
            Upload your resume and connect your GitHub repository today. Get real, unvarnished feedback and calibrated ATS optimization in under 60 seconds.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Link
              to={user ? '/dashboard' : '/register'}
              className="btn primary"
              style={{
                textDecoration: 'none',
                padding: '14px 32px',
                fontSize: '1.05rem',
                borderRadius: 12,
              }}
            >
              {user ? 'Go to Dashboard →' : 'Create Free Account →'}
            </Link>
            {!user && (
              <Link
                to="/login"
                className="btn"
                style={{
                  textDecoration: 'none',
                  padding: '14px 26px',
                  fontSize: '1.05rem',
                  borderRadius: 12,
                  background: 'transparent',
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.3)',
                }}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--line)', padding: '36px 24px', textAlign: 'center', color: 'var(--mut)', fontSize: '.88rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ fontWeight: 800, color: 'var(--ink)' }}>
            SkillForge<span style={{ color: 'var(--pri)' }}>AI</span>
          </div>
          <div>Empowering software engineers with real AI intelligence.</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link to="/resume" style={{ color: 'var(--mut)', textDecoration: 'none' }}>Resume Analyzer</Link>
            <Link to="/projects" style={{ color: 'var(--mut)', textDecoration: 'none' }}>Project Auditor</Link>
            <Link to="/assessment" style={{ color: 'var(--mut)', textDecoration: 'none' }}>Assessments</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
