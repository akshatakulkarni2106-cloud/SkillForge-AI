import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import {
  fetchGitHubRepoDetails,
  analyzeProjectWithAi,
} from '../services/projectService';

const getHealthScoreColor = (score) => {
  if (score >= 85) return { bg: '#ecfdf5', text: '#047857', label: 'Production-Grade Quality' };
  if (score >= 70) return { bg: '#fdf2f8', text: '#be185d', label: 'Substantial & Portfolio-Ready' };
  if (score >= 50) return { bg: '#fffbeb', text: '#b45309', label: 'Promising (Needs Hardening)' };
  return { bg: '#fff1f2', text: '#be123c', label: 'Toy / Starter Project' };
};

export default function ProjectAnalyzer() {
  const [mode, setMode] = useState('github'); // 'github' | 'paste'
  const [githubUrl, setGithubUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [codeSnippets, setCodeSnippets] = useState('');

  const [loadingStep, setLoadingStep] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [pastProjects, setPastProjects] = useState([]);
  const [copiedIndex, setCopiedIndex] = useState(null);

  useEffect(() => {
    loadPastProjects();
    loadLatestProject();
  }, []);

  const loadPastProjects = async () => {
    try {
      const data = await api('/project/list');
      if (Array.isArray(data)) setPastProjects(data);
    } catch {
      // ignore
    }
  };

  const loadLatestProject = async () => {
    try {
      const latest = await api('/project/latest');
      if (latest && !currentAnalysis) {
        setCurrentAnalysis(latest);
      }
    } catch {
      // ignore
    }
  };

  const handleGitHubAnalyze = async (e) => {
    e.preventDefault();
    if (!githubUrl.trim()) {
      toast.error('Please enter a GitHub repository URL.');
      return;
    }

    setAnalyzing(true);
    setLoadingStep('Connecting to GitHub & fetching repository metadata…');

    try {
      // 1. Fetch live repository details from GitHub API
      const repoDetails = await fetchGitHubRepoDetails(githubUrl);
      setLoadingStep(`Inspecting ${repoDetails.fileTree.length} files & manifest dependencies…`);

      // 2. Pass real evidence into Groq AI
      setLoadingStep('Groq AI analyzing architecture, tutorial clone risk, and stack evidence…');
      const analysisData = await analyzeProjectWithAi({
        title: repoDetails.title,
        githubUrl: repoDetails.htmlUrl || githubUrl,
        description: repoDetails.description,
        readme: repoDetails.readme,
        fileTree: repoDetails.fileTree,
        manifestName: repoDetails.manifestName,
        manifestContent: repoDetails.manifestContent,
      });

      // 3. Persist to backend
      setLoadingStep('Saving analysis & updating your Skill Profile…');
      const saved = await api('/project/save-analysis', {
        method: 'POST',
        body: analysisData,
      });

      setCurrentAnalysis(saved);
      loadPastProjects();
      toast.success('Project analysis complete! Skill profile and dashboard updated.');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to analyze GitHub repository.');
    } finally {
      setAnalyzing(false);
      setLoadingStep('');
    }
  };

  const handlePasteAnalyze = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a project title.');
      return;
    }
    if (!description.trim()) {
      toast.error('Please describe what the project does and its architecture.');
      return;
    }

    setAnalyzing(true);
    setLoadingStep('Groq AI reasoning over your architectural decisions & code…');

    try {
      const analysisData = await analyzeProjectWithAi({
        title,
        githubUrl: '',
        description,
        codeSnippets,
      });

      setLoadingStep('Saving analysis & updating dashboard health…');
      const saved = await api('/project/save-analysis', {
        method: 'POST',
        body: analysisData,
      });

      setCurrentAnalysis(saved);
      loadPastProjects();
      toast.success('Project analyzed successfully!');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Analysis failed.');
    } finally {
      setAnalyzing(false);
      setLoadingStep('');
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success('Copied bullet to clipboard!');
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const scoreMeta = currentAnalysis ? getHealthScoreColor(currentAnalysis.healthScore) : null;

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1>Project Analyzer & Architecture Auditor</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: '.95rem' }}>
          Real engineering critique reasoning over repository files, dependency manifests, and architecture. Detects tutorial clones, extracts verified stack proof, and crafts STAR resume bullets.
        </p>
      </header>

      {/* Input Section Card */}
      <section className="card" style={{ padding: '24px 28px' }}>
        <div className="tab-row" style={{ marginTop: 0 }}>
          <button
            type="button"
            className={`tab-btn ${mode === 'github' ? 'active' : ''}`}
            onClick={() => setMode('github')}
          >
            🐙 Public GitHub Repository
          </button>
          <button
            type="button"
            className={`tab-btn ${mode === 'paste' ? 'active' : ''}`}
            onClick={() => setMode('paste')}
          >
            📝 Paste Description & Code
          </button>
          {pastProjects.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '.84rem', color: 'var(--mut)' }}>Past Projects:</span>
              <select
                style={{ padding: '6px 12px', fontSize: '.84rem' }}
                value={currentAnalysis?._id || ''}
                onChange={(e) => {
                  const found = pastProjects.find((p) => p._id === e.target.value);
                  if (found) setCurrentAnalysis(found);
                }}
              >
                <option value="">Select past analysis…</option>
                {pastProjects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.title} ({p.healthScore}%)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {mode === 'github' && (
          <form onSubmit={handleGitHubAnalyze}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ marginBottom: 8, display: 'block' }}>
                GitHub Repository URL or "owner/repo"
              </label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="e.g. https://github.com/expressjs/express or vercel/next.js"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  disabled={analyzing}
                  style={{ flex: 1, minWidth: 280 }}
                />
                <button type="submit" className="primary" disabled={analyzing || !githubUrl.trim()}>
                  {analyzing ? 'Analyzing Repo…' : 'Inspect & Audit Repository'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="small muted">Quick samples:</span>
              <button
                type="button"
                className="btn small"
                onClick={() => setGithubUrl('https://github.com/facebook/react')}
                disabled={analyzing}
              >
                React
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => setGithubUrl('https://github.com/expressjs/express')}
                disabled={analyzing}
              >
                Express
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => setGithubUrl('https://github.com/axios/axios')}
                disabled={analyzing}
              >
                Axios
              </button>
            </div>
          </form>
        )}

        {mode === 'paste' && (
          <form onSubmit={handlePasteAnalyze}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
              <div>
                <label>Project Title</label>
                <input
                  type="text"
                  placeholder="e.g. Distributed Task Queue & Worker Service"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={analyzing}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label>System Overview & Architecture</label>
                <textarea
                  rows={4}
                  placeholder="Describe what the application does, key architectural decisions (e.g. event-driven, microservices vs monolith, Redis pub/sub, database schema, concurrency handling)…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={analyzing}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label>Key Code Snippets or Manifest / Dependencies (Optional)</label>
                <textarea
                  rows={4}
                  placeholder="Paste package.json dependencies, docker-compose, or critical core logic functions…"
                  value={codeSnippets}
                  onChange={(e) => setCodeSnippets(e.target.value)}
                  disabled={analyzing}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '.85rem' }}
                />
              </div>

              <div>
                <button type="submit" className="primary" disabled={analyzing || !title.trim() || !description.trim()}>
                  {analyzing ? 'Analyzing Architecture…' : 'Run Architecture Audit'}
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      {/* Loading Banner */}
      {analyzing && (
        <div className="card" style={{ textAlign: 'center', padding: 36, background: 'var(--pri-subtle)', borderColor: 'var(--line-strong)' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--pri)', marginBottom: 8 }}>
            Running Live AI Project Audit…
          </div>
          <p className="muted" style={{ maxWidth: 520, margin: '0 auto', fontSize: '.95rem' }}>
            {loadingStep || 'Reasoning over codebase architecture and dependencies…'}
          </p>
        </div>
      )}

      {/* Analysis Results View */}
      {currentAnalysis && !analyzing && (
        <>
          {/* Hero Score Container */}
          <div className="score-hero-container">
            <div className="score-circle-box">
              <div className="score-circle-val">{currentAnalysis.healthScore}</div>
              <div className="score-circle-label">Project Health</div>
              <span className="tag" style={{ marginTop: 8, background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }}>
                {scoreMeta?.label}
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <span className="tag pink" style={{ background: 'rgba(251, 113, 133, 0.2)', color: '#fecdd3', borderColor: 'rgba(251, 113, 133, 0.4)' }}>
                  Complexity: {currentAnalysis.complexityLevel || 'Substantial'}
                </span>
                {currentAnalysis.githubUrl && (
                  <a
                    href={currentAnalysis.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#fbcfe8', fontSize: '.85rem', textDecoration: 'underline' }}
                  >
                    View on GitHub ↗
                  </a>
                )}
              </div>

              <h2 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: 10 }}>{currentAnalysis.title}</h2>
              <p style={{ color: '#fce7f1', fontSize: '.95rem', lineHeight: 1.6, margin: 0 }}>
                {currentAnalysis.summary}
              </p>
            </div>
          </div>

          {/* Tutorial Clone Assessment Alert */}
          {currentAnalysis.isTutorialClone ? (
            <div className="clone-badge warning" style={{ width: '100%', display: 'flex', alignItems: 'flex-start', padding: 16 }}>
              <span style={{ fontSize: '1.4rem' }}>⚠️</span>
              <div>
                <strong style={{ display: 'block', fontSize: '.95rem' }}>
                  Tutorial-Clone Risk Detected by AI Evaluator
                </strong>
                <span style={{ fontSize: '.88rem', fontWeight: 400, marginTop: 4, display: 'block', lineHeight: 1.5 }}>
                  {currentAnalysis.tutorialCloneReasoning ||
                    'Recruiters may view this as a standard walkthrough or bootcamp clone. Elevate it with unique domain features, integration tests, or custom backend services.'}
                </span>
              </div>
            </div>
          ) : (
            <div className="clone-badge verified" style={{ width: '100%', display: 'flex', alignItems: 'flex-start', padding: 16 }}>
              <span style={{ fontSize: '1.4rem' }}>⭐</span>
              <div>
                <strong style={{ display: 'block', fontSize: '.95rem' }}>
                  Original Architectural Work
                </strong>
                <span style={{ fontSize: '.88rem', fontWeight: 400, marginTop: 4, display: 'block', lineHeight: 1.5 }}>
                  {currentAnalysis.tutorialCloneReasoning ||
                    'Demonstrates independent architectural choices, non-trivial engineering logic, and portfolio credibility.'}
                </span>
              </div>
            </div>
          )}

          {/* Detected Tech Stack & Downstream Impact */}
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <div>
                <h2>Inferred Tech Stack Evidence ({currentAnalysis.detectedStack?.length || 0})</h2>
                <p className="muted small">
                  Extracted from dependency manifests and codebase structure. Directly updates your Skill Profile baseline.
                </p>
              </div>
              <Link to="/skills" className="btn small" style={{ borderColor: 'var(--pri)', color: 'var(--pri)' }}>
                View in Skill Profile →
              </Link>
            </div>

            <div className="chips" style={{ marginBottom: 16 }}>
              {currentAnalysis.detectedStack?.map((tech) => (
                <span key={tech} style={{ fontWeight: 600 }}>
                  {tech}
                </span>
              ))}
            </div>

            {/* Categorized stack pills if available */}
            {currentAnalysis.stackCategorized && Object.keys(currentAnalysis.stackCategorized).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                {Object.entries(currentAnalysis.stackCategorized).map(([cat, list]) => {
                  if (!Array.isArray(list) || list.length === 0) return null;
                  return (
                    <div key={cat} style={{ background: 'var(--pri-subtle)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line-strong)' }}>
                      <span style={{ fontSize: '.78rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--pri)', display: 'block', marginBottom: 6 }}>
                        {cat}
                      </span>
                      <div style={{ fontSize: '.86rem', color: 'var(--ink)' }}>
                        {list.join(', ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Dual Column: What's Impressive vs Portfolio Gaps */}
          <div className="grid2" style={{ marginBottom: 20 }}>
            <div className="card" style={{ margin: 0 }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#14532d' }}>
                <span style={{ fontSize: '1.2rem' }}>✓</span> What's Impressive
              </h2>
              <p className="muted small" style={{ marginBottom: 14 }}>
                Key architectural decisions and engineering patterns that stand out:
              </p>
              <ul className="critique-list">
                {currentAnalysis.impressiveAspects?.map((item, i) => (
                  <li key={i} className="critique-item pos">
                    <span className="critique-icon">✓</span>
                    <div>{item}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card" style={{ margin: 0 }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9f1239' }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span> What's Missing / Portfolio Gaps
              </h2>
              <p className="muted small" style={{ marginBottom: 14 }}>
                Seniority gaps holding this project back from true production grade:
              </p>
              <ul className="critique-list">
                {currentAnalysis.portfolioGaps?.map((item, i) => (
                  <li key={i} className="critique-item neg">
                    <span className="critique-icon">✕</span>
                    <div>{item}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Quantified STAR Resume Bullets */}
          {currentAnalysis.resumeBullets?.length > 0 && (
            <section className="card" style={{ border: '1.5px solid var(--line-strong)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                <div>
                  <h2 style={{ color: 'var(--pri)' }}>📋 Quantified STAR Resume Bullets</h2>
                  <p className="muted small">
                    Engineered to showcase architectural impact, scale, and action verbs on your resume.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {currentAnalysis.resumeBullets.map((bullet, i) => (
                  <div
                    key={i}
                    className="star-bullet-card card-light"
                    style={{
                      background: 'var(--card-light, #ffffff)',
                      border: '1px solid var(--card-light-border, #fbcfe8)',
                      borderRadius: 12,
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 16,
                    }}
                  >
                    <div style={{ fontSize: '.94rem', lineHeight: 1.6, color: 'var(--text-on-light, #180a14)', userSelect: 'text' }}>
                      • {bullet}
                    </div>
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={() => copyToClipboard(bullet, i)}
                      style={{ flexShrink: 0 }}
                    >
                      {copiedIndex === i ? '✓ Copied' : '📋 Copy'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Actionable Engineering Roadmap */}
          {currentAnalysis.actionableRoadmap?.length > 0 && (
            <section className="card">
              <h2>🚀 Next Steps Roadmap: Elevate to Production-Grade</h2>
              <p className="muted small" style={{ marginBottom: 16 }}>
                Step-by-step milestones to transform this project into an undisputed senior-level showcase.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {currentAnalysis.actionableRoadmap.map((step, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 14,
                      padding: '12px 16px',
                      background: 'var(--card)',
                      color: 'var(--ink)',
                      border: '1px solid var(--line)',
                      borderRadius: 10,
                    }}
                  >
                    <span
                      style={{
                        background: 'var(--pri)',
                        color: '#fff',
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '.85rem',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span style={{ fontSize: '.92rem', color: 'var(--ink)', lineHeight: 1.5, marginTop: 2 }}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
