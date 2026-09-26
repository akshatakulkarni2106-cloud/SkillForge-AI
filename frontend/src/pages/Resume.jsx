import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, upload } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { analyzeResumeWithAi, tailorResumeToJob } from '../services/resumeService';

const getScoreGrade = (score) => {
  if (score >= 88) return { label: 'Top Tier (Interview Ready)', color: '#047857' };
  if (score >= 75) return { label: 'Strong & Competitive', color: '#db2777' };
  if (score >= 60) return { label: 'Solid (Room for Impact)', color: '#d97706' };
  return { label: 'Needs Optimization', color: '#e11d48' };
};

export default function Resume() {
  const { user } = useAuth();
  const [r, setR] = useState(null);
  const [targetRole, setTargetRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [activeSectionTab, setActiveSectionTab] = useState('experience');

  // Job tailoring state
  const [jobDescription, setJobDescription] = useState('');
  const [tailorBusy, setTailorBusy] = useState(false);
  const [tailorResult, setTailorResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');

  useEffect(() => {
    if (user?.targetRole) {
      setTargetRole(user.targetRole);
    }
    loadLatest();
  }, [user]);

  const loadLatest = async () => {
    try {
      const data = await api('/resume/latest');
      if (data) {
        setR(data);
        if (data.targetRole) setTargetRole(data.targetRole);
      }
    } catch {
      // No resume uploaded yet
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5 MB limit.');
      return;
    }

    const fd = new FormData();
    fd.append('resume', file);
    setBusy(true);

    try {
      const uploadedDoc = await upload('/resume/upload', fd);
      setR(uploadedDoc);
      toast.success('Resume parsed! Starting AI critique…');

      // Immediately run real AI critique on the extracted text
      if (uploadedDoc?.extractedText) {
        await runAiCritique(uploadedDoc.extractedText, targetRole || user?.targetRole || 'Software Engineer');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to upload resume.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const runAiCritique = async (textToAnalyze, roleToUse) => {
    const resumeText = textToAnalyze || r?.extractedText;
    if (!resumeText) {
      toast.error('No extracted text available to critique.');
      return;
    }

    setAnalyzingAi(true);
    const resolvedRole = roleToUse || targetRole || user?.targetRole || 'Software Engineer';

    try {
      const critiqueData = await analyzeResumeWithAi(resumeText, resolvedRole);

      // Persist critique to backend
      const updated = await api('/resume/critique', {
        method: 'PUT',
        body: { critique: critiqueData, targetRole: resolvedRole },
      });

      setR(updated);
      toast.success('Live AI critique completed and saved!');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'AI critique encountered an issue.');
    } finally {
      setAnalyzingAi(false);
    }
  };

  const handleTailorSubmit = async (e) => {
    e.preventDefault();
    if (!r?.extractedText) {
      toast.error('Please upload a resume first.');
      return;
    }
    if (!jobDescription.trim()) {
      toast.error('Please paste a job description.');
      return;
    }

    setTailorBusy(true);
    try {
      const result = await tailorResumeToJob(
        r.extractedText,
        jobDescription,
        targetRole || user?.targetRole || 'Software Engineer'
      );
      setTailorResult(result);
      toast.success('Resume tailored to Job Description!');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Tailoring analysis failed.');
    } finally {
      setTailorBusy(false);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedKey(''), 2500);
  };

  const critique = r?.critique;
  const grade = critique?.overallScore ? getScoreGrade(critique.overallScore) : null;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1>Resume Analyzer & ATS Optimizer</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: '.95rem' }}>
          Real AI evaluation reasoning over your actual resume content. Zero hardcoded scores or boilerplate advice.
        </p>
      </header>

      {/* Upload and Target Role configuration */}
      <section className="card" style={{ padding: '22px 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: 8, margin: 0 }}>
              <span style={{ fontSize: '.88rem', color: 'var(--mut)' }}>Target Role:</span>
              <input
                type="text"
                value={targetRole}
                placeholder="e.g. Senior Full Stack Engineer"
                onChange={(e) => setTargetRole(e.target.value)}
                style={{ padding: '8px 12px', minWidth: 260 }}
              />
            </label>
            {r && (
              <button
                type="button"
                className="btn"
                onClick={() => runAiCritique(r.extractedText, targetRole)}
                disabled={analyzingAi || busy}
                style={{ borderColor: 'var(--pri)', color: 'var(--pri)' }}
              >
                {analyzingAi ? 'Critiquing with AI…' : '🔄 Refresh AI Critique'}
              </button>
            )}
          </div>

          {r?.fileName && (
            <div style={{ fontSize: '.85rem', color: 'var(--mut)' }}>
              Current: <strong style={{ color: 'var(--ink)' }}>{r.fileName}</strong>
            </div>
          )}
        </div>

        <label className="drop">
          {busy
            ? 'Extracting text and preparing resume…'
            : r
            ? 'Click or drop a newer resume (PDF or DOCX, max 5 MB)'
            : 'Upload your resume (PDF or DOCX, max 5 MB) for live AI critique'}
          <input type="file" hidden accept=".pdf,.docx" onChange={handleFileUpload} disabled={busy || analyzingAi} />
        </label>
      </section>

      {/* AI Analyzing banner if in progress */}
      {analyzingAi && (
        <div className="card" style={{ textAlign: 'center', padding: 36, background: '#fff5f8', borderColor: 'var(--line-strong)' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--pri)', marginBottom: 8 }}>
            AI is analyzing your resume line by line…
          </div>
          <p className="muted" style={{ maxWidth: 500, margin: '0 auto' }}>
            Evaluating impact metrics, ATS formatting scannability, technical skill currency, and recommending verified credentials.
          </p>
        </div>
      )}

      {/* Critique Results */}
      {critique && !analyzingAi && (
        <>
          {/* Hero Score Container */}
          <div className="score-hero-container">
            <div className="score-circle-box">
              <div className="score-circle-val">{critique.overallScore}</div>
              <div className="score-circle-label">ATS / Recruiter Score</div>
              {grade && (
                <span className="tag" style={{ marginTop: 8, background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }}>
                  {grade.label}
                </span>
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span className="tag pink" style={{ background: 'rgba(251, 113, 133, 0.2)', color: '#fecdd3', borderColor: 'rgba(251, 113, 133, 0.4)' }}>
                  Evaluated for: {r?.targetRole || targetRole || 'Software Engineer'}
                </span>
              </div>
              <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: 10 }}>Executive Assessment</h2>
              <p style={{ color: '#fce7f1', fontSize: '.96rem', lineHeight: 1.6, margin: 0 }}>
                {critique.summary}
              </p>
            </div>
          </div>

          {/* Category Breakdown Cards */}
          <div className="score-breakdown-grid">
            {critique.scoreBreakdown &&
              Object.entries(critique.scoreBreakdown).map(([category, data]) => {
                const names = {
                  impact: 'Impact & Metrics',
                  formatting: 'Brevity & ATS Scan',
                  skills: 'Skills & Currency',
                  experience: 'Role Relevance',
                };
                return (
                  <div key={category} className="breakdown-card">
                    <div className="breakdown-header">
                      <span>{names[category] || category}</span>
                      <span className="breakdown-score">{data.score}/100</span>
                    </div>
                    <div className="bar" style={{ margin: '4px 0 8px' }}>
                      <i style={{ width: `${data.score}%` }} />
                    </div>
                    <p style={{ margin: 0, fontSize: '.84rem', color: 'var(--mut)', lineHeight: 1.45 }}>
                      {data.feedback}
                    </p>
                  </div>
                );
              })}
          </div>

          {/* Line-Specific Strengths vs Fixes */}
          <div className="grid2" style={{ marginBottom: 20 }}>
            <div className="card" style={{ margin: 0 }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#14532d' }}>
                <span style={{ fontSize: '1.2rem' }}>✓</span> What's Working (Strengths)
              </h2>
              <p className="muted small" style={{ marginBottom: 14 }}>
                Real lines & patterns from your resume that recruiters appreciate:
              </p>
              <ul className="critique-list">
                {critique.whatsWorking?.map((item, idx) => (
                  <li key={idx} className="critique-item pos">
                    <span className="critique-icon">✓</span>
                    <div>{item}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card" style={{ margin: 0 }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9f1239' }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span> What to Fix (Line-by-Line)
              </h2>
              <p className="muted small" style={{ marginBottom: 14 }}>
                Specific weak phrases, missing metrics, or red flags identified:
              </p>
              <ul className="critique-list">
                {critique.whatToFix?.map((item, idx) => (
                  <li key={idx} className="critique-item neg">
                    <span className="critique-icon">✕</span>
                    <div>{item}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Section by Section Deep Dive */}
          {critique.sectionFeedback && (
            <div className="card">
              <h2>Section Feedback</h2>
              <div className="tab-row" style={{ marginTop: 12 }}>
                {Object.keys(critique.sectionFeedback).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    className={`tab-btn ${activeSectionTab === sec ? 'active' : ''}`}
                    onClick={() => setActiveSectionTab(sec)}
                    style={{ textTransform: 'capitalize' }}
                  >
                    {sec}
                  </button>
                ))}
              </div>
              <div style={{ background: '#fff5f8', padding: '18px 20px', borderRadius: 12, border: '1px solid var(--line-strong)' }}>
                <p style={{ margin: 0, fontSize: '.94rem', lineHeight: 1.6, color: 'var(--ink)' }}>
                  {critique.sectionFeedback[activeSectionTab] || 'No specific notes for this section.'}
                </p>
              </div>
            </div>
          )}

          {/* Verified Certifications Recommendation */}
          {critique.verifiedCertifications?.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                <div>
                  <h2>Targeted Certification Recommendations</h2>
                  <p className="muted small">
                    Verifiable credentials from standard industry bodies tailored specifically to solve gaps found in your resume.
                  </p>
                </div>
                <span className="tag ok">Verifiable Bodies Only</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {critique.verifiedCertifications.map((cert, i) => (
                  <div key={i} className="cert-card">
                    <div className="cert-top">
                      <div>
                        <div className="cert-title">{cert.name}</div>
                        <div className="cert-issuer">🏛️ {cert.issuingBody}</div>
                      </div>
                      <span className="tag pink">{cert.difficulty || 'Professional'}</span>
                    </div>
                    <div className="cert-rationale">
                      <strong>Why this matters for your profile:</strong> {cert.rationale}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Extracted Skills and Downstream Connections */}
      {r && (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <h2>Detected Skills ({r.extractedSkills?.length || 0})</h2>
            <Link to="/skills" className="btn small" style={{ borderColor: 'var(--pri)', color: 'var(--pri)' }}>
              Take Assessment in Skill Profile →
            </Link>
          </div>
          <div className="chips">
            {r.extractedSkills?.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>
            Skills extracted from <strong>{r.fileName}</strong> join your Skill Profile. Take short assessments or complete projects to verify them.
          </p>
        </section>
      )}

      {/* Interactive Tool: Tailor for a Specific Job */}
      {r?.extractedText && (
        <section className="tailor-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', marginBottom: 4 }}>🎯 Tailor for a Specific Job</h2>
              <p className="muted" style={{ margin: 0, fontSize: '.9rem' }}>
                Paste the Job Description to check ATS match percentage, detect missing keywords, and get Google XYZ-formula bullet rewrites.
              </p>
            </div>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                setJobDescription(
                  `Looking for a Senior Full Stack Software Engineer with 3+ years experience building scalable web applications. Requirements: React, Node.js, TypeScript, PostgreSQL, Docker, AWS ECS/S3, and automated testing (Jest/Cypress). Candidates must demonstrate experience optimizing API response latencies, designing relational schemas, and deploying microservices.`
                );
              }}
            >
              Fill Sample JD
            </button>
          </div>

          <form onSubmit={handleTailorSubmit}>
            <textarea
              rows={5}
              placeholder="Paste the target job description or requirements here…"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              style={{ width: '100%', marginBottom: 14, fontSize: '.9rem', lineHeight: 1.5 }}
            />
            <button type="submit" className="primary" disabled={tailorBusy || !jobDescription.trim()} style={{ width: 'auto' }}>
              {tailorBusy ? 'Tailoring with AI…' : 'Analyze Fit & Tailor Resume'}
            </button>
          </form>

          {/* Tailoring Result View */}
          {tailorResult && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line-strong)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 18 }}>
                <div style={{ background: '#fff', border: '1.5px solid var(--pri)', borderRadius: 12, padding: '12px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--pri)', fontFamily: 'Bricolage Grotesque' }}>
                    {tailorResult.matchScore}%
                  </div>
                  <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--mut)' }}>
                    JD Match Score
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Fit Overview</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '.92rem', color: 'var(--ink)' }}>{tailorResult.overview}</p>
                </div>
              </div>

              {/* Keywords Comparison */}
              <div className="grid2" style={{ marginBottom: 20 }}>
                <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
                  <h4 style={{ margin: '0 0 10px', color: '#166534', fontSize: '.92rem' }}>
                    ✓ Matching Keywords Found ({tailorResult.matchingKeywords?.length || 0})
                  </h4>
                  <div className="chips">
                    {tailorResult.matchingKeywords?.map((kw, i) => (
                      <span key={i} style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
                  <h4 style={{ margin: '0 0 10px', color: '#991b1b', fontSize: '.92rem' }}>
                    ⚠️ Missing / Unemphasized Keywords ({tailorResult.missingKeywords?.length || 0})
                  </h4>
                  <div className="chips">
                    {tailorResult.missingKeywords?.map((kw, i) => (
                      <span key={i} style={{ background: '#fff1f2', color: '#9f1239', borderColor: '#fecdd3' }}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tailored Professional Summary */}
              {tailorResult.tailoredSummary && (
                <div style={{ background: '#fff', border: '1.5px solid var(--line-strong)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--pri)' }}>✨ Tailored Professional Summary</h3>
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={() => copyToClipboard(tailorResult.tailoredSummary, 'summary')}
                    >
                      {copiedKey === 'summary' ? '✓ Copied' : '📋 Copy Summary'}
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: '.94rem', lineHeight: 1.6, color: 'var(--ink)' }}>
                    {tailorResult.tailoredSummary}
                  </p>
                </div>
              )}

              {/* Bullet Point Rewrites */}
              {tailorResult.bulletRewrites?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: 12 }}>
                    High-Impact Bullet Point Rewrites (Google XYZ Formula)
                  </h3>
                  {tailorResult.bulletRewrites.map((rw, i) => (
                    <div key={i} className="rewrite-card">
                      <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#9f1239', marginBottom: 4 }}>
                        ORIGINAL WEAK / UNALIGNED BULLET:
                      </div>
                      <div className="rewrite-before">{rw.original}</div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 4px' }}>
                        <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#166534' }}>
                          OPTIMIZED REWRITE WITH JD KEYWORDS & IMPACT:
                        </div>
                        <button
                          type="button"
                          className="copy-btn"
                          onClick={() => copyToClipboard(rw.rewritten, `bullet-${i}`)}
                        >
                          {copiedKey === `bullet-${i}` ? '✓ Copied' : '📋 Copy Bullet'}
                        </button>
                      </div>
                      <div className="rewrite-after">{rw.rewritten}</div>

                      <div className="rewrite-why">
                        <strong>Recruiter rationale:</strong> {rw.reason}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Interview Prep Tips */}
              {tailorResult.interviewPrepTips?.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 18 }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>💡 Interview Prep Questions for this JD</h3>
                  <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: '.92rem', color: 'var(--ink)' }}>
                    {tailorResult.interviewPrepTips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
