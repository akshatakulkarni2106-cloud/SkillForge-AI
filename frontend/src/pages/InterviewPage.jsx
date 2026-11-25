import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import InterviewerAvatar, { generateRandomAvatarConfig } from '../components/InterviewerAvatar';
import { api } from '../services/api';
import {
  evaluateInterviewSession,
  evaluateQuestionAnswer,
  getNextAdaptiveQuestion,
  startInterview,
} from '../services/interviewService';
import { moveDifficulty, normalizeDifficulty, experienceLevelToDifficulty } from '../utils/difficultyUtils';
import { progressService } from '../services/progressService';

const PRESET_ROLES = [
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'Data Science / ML Engineer',
  'DevOps & Cloud Engineer',
  'Mobile Developer',
  'Custom Role',
];

const EXPERIENCE_LEVELS = [
  { value: 'fresher', label: 'Fresher / Entry-Level (0-1 yrs)', initialDiff: 'easy' },
  { value: 'mid', label: 'Mid-Level (2-4 yrs)', initialDiff: 'medium' },
  { value: 'senior', label: 'Senior / Lead (5+ yrs)', initialDiff: 'hard' },
];

const TIME_LIMITS = [
  { value: 0, label: 'No time limit (practice at your pace)' },
  { value: 15, label: '15 Minutes (quick screen)' },
  { value: 30, label: '30 Minutes (standard interview)' },
  { value: 45, label: '45 Minutes (deep technical dive)' },
];

const formatTimeMMSS = (totalSeconds) => {
  const mins = Math.floor(Math.max(0, totalSeconds) / 60);
  const secs = Math.max(0, totalSeconds) % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export default function InterviewPage() {
  const [searchParams] = useSearchParams();

  // Interview History & Stats State
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const [isReviewingPast, setIsReviewingPast] = useState(false);

  // Active Session Persistence State
  const [sessionId, setSessionId] = useState(null);

  // Session Configuration State
  const [selectedRole, setSelectedRole] = useState('Full Stack Developer');
  const [customRoleInput, setCustomRoleInput] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('mid');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(0);
  const [resumeSuggestion, setResumeSuggestion] = useState(null);

  // Live Interview State
  const [isInterviewStarted, setIsInterviewStarted] = useState(false);
  const [isInterviewOver, setIsInterviewOver] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [error, setError] = useState('');
  const [currentDifficulty, setCurrentDifficulty] = useState('medium');

  // Messages & Transcript
  const [messages, setMessages] = useState([]);
  const [transcript, setTranscript] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentAnswer, setCurrentAnswer] = useState('');

  // Timing State
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const questionStartTimeRef = useRef(null);
  const sessionTimerRef = useRef(null);

  // Avatar & Speech State
  const [avatarConfig, setAvatarConfig] = useState(() => generateRandomAvatarConfig());
  const [avatarExpression, setAvatarExpression] = useState('neutral');
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);

  // Voice Input (SpeechRecognition) State
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);

  // Final Results
  const [finalResults, setFinalResults] = useState(null);

  // Load Real Interview Stats & History
  const loadInterviewSummary = () => {
    setSummaryLoading(true);
    setSummaryError('');
    api('/interview/summary')
      .then((data) => {
        setSummaryData(data);
        setSummaryLoading(false);
      })
      .catch((err) => {
        setSummaryError(err.message || 'Failed to load interview history and statistics.');
        setSummaryLoading(false);
      });
  };

  useEffect(() => {
    loadInterviewSummary();
  }, []);

  // Fetch Resume suggestion on mount
  useEffect(() => {
    let cancelled = false;
    api('/resume/latest')
      .then((data) => {
        if (cancelled || !data) return;
        const skills = Array.isArray(data.extractedSkills) ? data.extractedSkills.filter(Boolean) : [];
        if (skills.length > 0) {
          const lower = skills.map((s) => s.toLowerCase());
          let suggested = 'Full Stack Developer';
          if (lower.some((s) => s.includes('react') || s.includes('css') || s.includes('frontend'))) {
            suggested = lower.some((s) => s.includes('node') || s.includes('sql') || s.includes('mongo'))
              ? 'Full Stack Developer'
              : 'Frontend Developer';
          } else if (lower.some((s) => s.includes('python') || s.includes('data') || s.includes('pandas'))) {
            suggested = 'Data Science / ML Engineer';
          } else if (lower.some((s) => s.includes('docker') || s.includes('kubernetes') || s.includes('aws'))) {
            suggested = 'DevOps & Cloud Engineer';
          } else if (lower.some((s) => s.includes('node') || s.includes('java') || s.includes('sql') || s.includes('backend'))) {
            suggested = 'Backend Developer';
          }
          setResumeSuggestion({ role: suggested, topSkills: skills.slice(0, 4) });
        }
      })
      .catch(() => {
        // No saved resume, ignore
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Resume In-Progress Interview Session
  const resumeSessionById = async (id) => {
    try {
      setIsEvaluating(true);
      setError('');
      const session = await api(`/interview/${id}`);
      if (!session) throw new Error('Session not found');

      setSessionId(session._id);
      setSelectedRole(session.role);
      setExperienceLevel(session.experienceLevel || 'mid');
      setTimeLimitMinutes(session.timeLimitMinutes || 0);
      setCurrentDifficulty(session.currentDifficulty || 'medium');
      setSessionSeconds(session.sessionSeconds || 0);

      const pastTranscript = session.transcript || [];
      setTranscript(pastTranscript);

      // Reconstruct messages for the conversation UI
      const rebuiltMessages = [];
      pastTranscript.forEach((entry, idx) => {
        rebuiltMessages.push({
          id: `q-${idx + 1}`,
          sender: 'ai',
          type: 'question',
          text: entry.question,
          difficulty: entry.difficulty || 'medium',
          timestamp: Date.now() - (pastTranscript.length - idx) * 60000,
        });
        if (entry.answer) {
          rebuiltMessages.push({
            id: `ans-${idx + 1}`,
            sender: 'candidate',
            type: 'answer',
            text: entry.answer,
            responseTimeSeconds: entry.responseTimeSeconds,
            timestamp: Date.now() - (pastTranscript.length - idx) * 60000 + 30000,
          });
        }
        if (entry.detailedFeedback) {
          rebuiltMessages.push({
            id: `fb-${idx + 1}`,
            sender: 'ai',
            type: 'feedback',
            verdict: entry.verdict,
            score: entry.score,
            text: entry.detailedFeedback,
            spokenText: entry.spokenFeedback,
            timestamp: Date.now() - (pastTranscript.length - idx) * 60000 + 35000,
          });
        }
      });

      const activeQ = session.currentQuestion || (pastTranscript.length > 0 ? `Follow-up question on ${session.role}` : '');
      if (activeQ) {
        setCurrentQuestion(activeQ);
        rebuiltMessages.push({
          id: `q-${pastTranscript.length + 1}`,
          sender: 'ai',
          type: 'question',
          text: activeQ,
          difficulty: session.currentDifficulty || 'medium',
          timestamp: Date.now(),
        });
        speakText(activeQ);
      }

      setMessages(rebuiltMessages);
      setIsInterviewStarted(true);
      setIsInterviewOver(false);
    } catch (err) {
      setError(err.message || 'Could not resume interview session.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Check URL query parameter for resume
  useEffect(() => {
    const urlSession = searchParams.get('session');
    if (urlSession && !isInterviewStarted && !isInterviewOver) {
      resumeSessionById(urlSession);
    }
  }, [searchParams]);

  // Discard In-Progress Session
  const handleDiscardSession = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await api(`/interview/${id}`, { method: 'DELETE' });
      loadInterviewSummary();
    } catch (err) {
      setError('Failed to discard interview session.');
    }
  };

  // Review Past Completed Session Debrief
  const handleReviewPastSession = async (item) => {
    try {
      setIsEvaluating(true);
      setError('');
      const session = await api(`/interview/${item.id}`);
      setFinalResults({
        overallScore: session.overallScore || item.overallScore,
        categoryScores: session.categoryScores || {},
        verdict: session.verdict || item.verdict,
        strengths: session.strengths || [],
        weaknesses: session.weaknesses || [],
        suggestions: session.suggestions || [],
        pacingFeedback: session.pacingFeedback || '',
        transcript: session.transcript || [],
        role: session.role || item.role,
        experienceLevel: session.experienceLevel || item.experienceLevel,
      });
      setSessionSeconds(session.sessionSeconds || item.durationSeconds || 0);
      setIsReviewingPast(true);
      setIsInterviewOver(true);
      setIsInterviewStarted(false);
    } catch (err) {
      setError('Could not load past debrief report.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Initialize SpeechRecognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return undefined;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let voiceText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        voiceText += event.results[i][0].transcript;
      }
      if (voiceText.trim()) {
        setCurrentAnswer((prev) => (prev ? `${prev} ${voiceText.trim()}` : voiceText.trim()));
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch (err) {
        // Ignore stop error on unmount
      }
    };
  }, []);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isEvaluating]);

  // Overall session timer
  useEffect(() => {
    if (!isInterviewStarted || isInterviewOver) {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      return undefined;
    }

    sessionTimerRef.current = setInterval(() => {
      setSessionSeconds((prev) => {
        const next = prev + 1;
        if (timeLimitMinutes > 0 && next >= timeLimitMinutes * 60) {
          clearInterval(sessionTimerRef.current);
          handleTriggerEndInterview(true);
        }
        return next;
      });
    }, 1000);

    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [isInterviewStarted, isInterviewOver, timeLimitMinutes]);

  // SpeechSynthesis Helper synced to Avatar
  const speakText = (text) => {
    if (voiceMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsAvatarSpeaking(true);
    };

    utterance.onend = () => {
      setIsAvatarSpeaking(false);
    };

    utterance.onerror = () => {
      setIsAvatarSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Expression shift with auto-reset to neutral
  const triggerExpressionShift = (expr) => {
    setAvatarExpression(expr);
    setTimeout(() => {
      setAvatarExpression('neutral');
    }, 3500);
  };

  const effectiveRole = selectedRole === 'Custom Role' ? customRoleInput.trim() : selectedRole;

  // Start interview handler
  const handleStartInterview = async () => {
    if (!effectiveRole) {
      setError('Please choose or enter a valid role.');
      return;
    }

    setError('');
    setIsEvaluating(true);
    setMessages([]);
    setTranscript([]);
    setCurrentAnswer('');
    setSessionSeconds(0);
    setFinalResults(null);
    setIsInterviewOver(false);

    const initialDiff = experienceLevelToDifficulty(experienceLevel);
    setCurrentDifficulty(initialDiff);

    try {
      const response = await startInterview(effectiveRole, experienceLevel, {
        focusSkills: resumeSuggestion?.topSkills || [],
      });

      const questionText = response.question;
      setCurrentQuestion(questionText);
      questionStartTimeRef.current = Date.now();

      // Persist new interview session in MongoDB
      try {
        const startRes = await api('/interview/start', {
          method: 'POST',
          body: {
            role: effectiveRole,
            experienceLevel,
            timeLimitMinutes,
            firstQuestion: questionText,
            currentDifficulty: initialDiff,
          },
        });
        if (startRes?.session?._id) {
          setSessionId(startRes.session._id);
        }
      } catch (e) {
        // Continue even if database sync encounters a transient network issue
      }

      setMessages([
        {
          id: 'q-1',
          sender: 'ai',
          type: 'question',
          text: questionText,
          timestamp: Date.now(),
        },
      ]);

      setIsInterviewStarted(true);
      speakText(questionText);
    } catch (err) {
      setError(err?.message || 'Failed to start the interview session. Please check your Groq API key.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Submit Answer & Immediate Per-Question Live Evaluation
  const handleSubmitAnswer = async () => {
    const answer = currentAnswer.trim();
    if (!answer || isEvaluating || isInterviewOver || !isInterviewStarted) {
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsAvatarSpeaking(false);
    }

    const elapsedSeconds = questionStartTimeRef.current
      ? Math.max(1, Math.round((Date.now() - questionStartTimeRef.current) / 1000))
      : 30;

    const answerMsgId = `ans-${Date.now()}`;
    const userMessage = {
      id: answerMsgId,
      sender: 'candidate',
      type: 'answer',
      text: answer,
      responseTimeSeconds: elapsedSeconds,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setCurrentAnswer('');
    setError('');
    setIsEvaluating(true);

    try {
      const evalResult = await evaluateQuestionAnswer({
        role: effectiveRole,
        experienceLevel,
        currentDifficulty,
        question: currentQuestion,
        answer,
        history: transcript,
        responseTimeSeconds: elapsedSeconds,
      });

      const updatedTranscriptEntry = {
        question: currentQuestion,
        answer,
        responseTimeSeconds: elapsedSeconds,
        verdict: evalResult.verdict,
        score: evalResult.score,
        spokenFeedback: evalResult.spokenFeedback,
        detailedFeedback: evalResult.detailedFeedback,
        difficulty: currentDifficulty,
      };

      const nextTranscript = [...transcript, updatedTranscriptEntry];
      setTranscript(nextTranscript);

      triggerExpressionShift(evalResult.verdict === 'strong' ? 'positive' : 'thoughtful');
      speakText(evalResult.spokenFeedback);

      const feedbackMessage = {
        id: `fb-${Date.now()}`,
        sender: 'ai',
        type: 'feedback',
        verdict: evalResult.verdict,
        score: evalResult.score,
        text: evalResult.detailedFeedback,
        spokenText: evalResult.spokenFeedback,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, feedbackMessage]);

      const nextDiff = moveDifficulty(currentDifficulty, evalResult.suggestedNextDifficulty);
      setCurrentDifficulty(nextDiff);

      const nextQResponse = await getNextAdaptiveQuestion({
        role: effectiveRole,
        experienceLevel,
        currentDifficulty: nextDiff,
        transcript: nextTranscript,
        lastEvaluation: evalResult,
      });

      const nextQuestionText = nextQResponse.question;
      setCurrentQuestion(nextQuestionText);
      questionStartTimeRef.current = Date.now();

      // Persist in-progress state to backend MongoDB
      if (sessionId) {
        api(`/interview/${sessionId}/progress`, {
          method: 'POST',
          body: {
            transcript: nextTranscript,
            currentQuestion: nextQuestionText,
            currentDifficulty: nextDiff,
            sessionSeconds,
          },
        }).catch(() => {});
      }

      const nextQMessage = {
        id: `q-${nextTranscript.length + 1}`,
        sender: 'ai',
        type: 'question',
        text: nextQuestionText,
        difficulty: nextDiff,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, nextQMessage]);

      setTimeout(() => {
        speakText(nextQuestionText);
      }, 1500);
    } catch (err) {
      setError(err?.message || 'Error evaluating your answer. Please retry.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // End Interview & Holistic Final Evaluation
  const handleTriggerEndInterview = async (isAutoTimeLimit = false) => {
    if (!isInterviewStarted || isInterviewOver || isEndingSession) {
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsAvatarSpeaking(false);
    }

    setIsEndingSession(true);
    setError('');

    let finalTranscript = [...transcript];
    if (currentAnswer.trim() && currentQuestion) {
      const elapsed = questionStartTimeRef.current
        ? Math.max(1, Math.round((Date.now() - questionStartTimeRef.current) / 1000))
        : 30;
      finalTranscript.push({
        question: currentQuestion,
        answer: currentAnswer.trim(),
        responseTimeSeconds: elapsed,
      });
    }

    try {
      const evaluation = await evaluateInterviewSession({
        role: effectiveRole,
        experienceLevel,
        transcript: finalTranscript,
        totalDurationSeconds: sessionSeconds,
      });

      // Save complete session in backend MongoDB & create Activity record
      const activeSessionId = sessionId || 'new';
      try {
        await api(`/interview/${activeSessionId}/complete`, {
          method: 'POST',
          body: {
            overallScore: evaluation.overallScore,
            categoryScores: evaluation.categoryScores,
            verdict: evaluation.verdict,
            strengths: evaluation.strengths,
            weaknesses: evaluation.weaknesses,
            suggestions: evaluation.suggestions,
            pacingFeedback: evaluation.pacingFeedback,
            transcript: finalTranscript,
            sessionSeconds,
            role: effectiveRole,
            experienceLevel,
          },
        });
        loadInterviewSummary();

        // Track completed mock interview in progress dashboard
        progressService.addActivity({
          type: 'interview',
          title: `Mock Interview: ${effectiveRole}`,
          score: evaluation.overallScore,
          durationMinutes: Math.max(Math.round(sessionSeconds / 60), 5),
          details: {
            role: effectiveRole,
            verdict: evaluation.verdict,
            questionsAnswered: finalTranscript.filter((t) => t.type === 'user').length,
          },
        });
      } catch (err) {
        // Non-blocking error
      }

      setFinalResults({
        ...evaluation,
        wasAutoEnded: isAutoTimeLimit,
        transcript: finalTranscript,
      });
      setIsInterviewOver(true);
    } catch (err) {
      setError(err?.message || 'Failed to complete final evaluation.');
    } finally {
      setIsEndingSession(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setError('Voice recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setError('');
      } catch (err) {
        setIsListening(false);
      }
    }
  };

  const handleRepeatQuestion = () => {
    if (currentQuestion) {
      speakText(currentQuestion);
    }
  };

  const handleResetSession = () => {
    setIsInterviewStarted(false);
    setIsInterviewOver(false);
    setIsReviewingPast(false);
    setSessionId(null);
    setFinalResults(null);
    setMessages([]);
    setTranscript([]);
    setCurrentAnswer('');
    setCurrentQuestion('');
    setSessionSeconds(0);
    setError('');
    setAvatarConfig(generateRandomAvatarConfig());
    loadInterviewSummary();
  };

  // ==========================================
  // VIEW 1: Interview Dashboard & Setup Screen
  // ==========================================
  if (!isInterviewStarted && !isInterviewOver) {
    const stats = summaryData?.stats || {
      totalInterviews: 0,
      averageScore: null,
      lastScore: null,
      categoryAverages: null,
    };
    const inProgressList = Array.isArray(summaryData?.inProgress) ? summaryData.inProgress : [];
    const recentInterviewsList = Array.isArray(summaryData?.recentInterviews) ? summaryData.recentInterviews : [];

    return (
      <div style={{ maxWidth: 1040, margin: '20px auto', padding: '0 16px' }}>
        {/* Page Title */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>AI Mock Interview</h1>
          <p className="muted" style={{ margin: '8px 0 0', lineHeight: 1.5 }}>
            Prepare for technical interviews with adaptive, speech-enabled simulations and detailed committee evaluations.
          </p>
        </div>

        {/* Loading State for Interview Data */}
        {summaryLoading && !summaryData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <div className="skeleton-grid">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 80 }} />
              ))}
            </div>
          </div>
        )}

        {/* Error Handling for Interview Data */}
        {summaryError && (
          <div className="card" style={{ background: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.35)', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#ef4444' }}>Could not sync interview history</strong>
                <p className="muted small" style={{ margin: '4px 0 0' }}>{summaryError}</p>
              </div>
              <button type="button" className="ghost" onClick={loadInterviewSummary} style={{ fontSize: '0.85rem' }}>
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Real Interview-Specific Stat Cards */}
        {!summaryLoading && summaryData && (
          <>
            <section className="cards" style={{ marginBottom: 20 }}>
              <div className="card stat">
                <small>Total Interviews Taken</small>
                <b>{stats.totalInterviews}</b>
                <span className="muted small">All recorded sessions</span>
              </div>

              <div className="card stat">
                <small>Average Interview Score</small>
                <b>{stats.averageScore !== null ? `${stats.averageScore}%` : '—'}</b>
                <span className="muted small">
                  {stats.averageScore !== null ? 'Cumulative quality' : 'Take first interview'}
                </span>
              </div>

              <div className="card stat">
                <small>Latest Session Score</small>
                <b>{stats.lastScore !== null ? `${stats.lastScore}%` : '—'}</b>
                <span className="muted small">
                  {stats.lastScore !== null ? 'Most recent performance' : 'No sessions yet'}
                </span>
              </div>

              <div className="card stat">
                <small>Interview Readiness</small>
                <b>
                  {stats.averageScore !== null
                    ? stats.averageScore >= 80
                      ? 'Ready'
                      : stats.averageScore >= 65
                        ? 'Solid'
                        : 'Developing'
                    : 'Unrated'}
                </b>
                <span className="muted small">
                  {stats.averageScore !== null
                    ? `${stats.averageScore >= 75 ? 'Hiring candidate' : 'Practice recommended'}`
                    : 'Complete an interview'}
                </span>
              </div>
            </section>

            {/* Category Performance Breakdown */}
            {stats.categoryAverages && (
              <div className="card" style={{ marginBottom: 20, padding: '20px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem' }}>Interview Competency Averages</h3>
                <div className="grid2" style={{ gap: 14 }}>
                  {Object.entries(stats.categoryAverages).map(([cat, score]) => {
                    const label = cat.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
                    const scoreVal = score !== null ? score : 0;
                    return (
                      <div key={cat} style={{ background: 'var(--pri-subtle)', border: '1px solid var(--line)', padding: '12px 14px', borderRadius: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
                          <b style={{ color: 'var(--ink)' }}>{score !== null ? `${score}%` : '—'}</b>
                        </div>
                        <div className="bar" style={{ height: 6, margin: 0 }}>
                          <i style={{ width: `${Math.min(100, Math.max(0, scoreVal))}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* In-Progress Interviews Section */}
            {inProgressList.length > 0 && (
              <div
                className="card"
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  padding: '18px 20px',
                  marginBottom: 20,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.2rem' }}>⏳</span>
                    <strong style={{ color: '#d97706', fontSize: '1.05rem' }}>Unfinished Interview In Progress</strong>
                  </div>
                  <span className="tag mid" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#d97706' }}>
                    {inProgressList.length} In Progress
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {inProgressList.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div>
                        <strong>{item.role}</strong>{' '}
                        <span className="muted small">({item.experienceLevel} level · {item.questionCount} questions answered)</span>
                        {item.currentQuestion && (
                          <p className="muted small" style={{ margin: '4px 0 0', fontStyle: 'italic' }}>
                            Current question: "{item.currentQuestion.slice(0, 90)}…"
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="ghost"
                          onClick={(e) => handleDiscardSession(item.id, e)}
                          style={{ fontSize: '0.82rem', padding: '6px 12px', color: '#991b1b' }}
                        >
                          Discard
                        </button>
                        <button
                          type="button"
                          className="primary"
                          onClick={() => resumeSessionById(item.id)}
                          style={{ fontSize: '0.85rem', padding: '7px 16px', width: 'auto' }}
                        >
                          Resume Interview →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Interview History */}
            <div className="card" style={{ marginBottom: 24, padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Past Interview History</h3>
                <span className="muted small">{recentInterviewsList.length} recorded</span>
              </div>

              {recentInterviewsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--pri-subtle)', border: '1px dashed var(--line)', borderRadius: 8 }}>
                  <p className="muted small" style={{ margin: 0, color: 'var(--mut)' }}>
                    No completed interviews yet. Configure your interview parameters below to begin your first session!
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recentInterviewsList.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '12px 16px',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12,
                        background: 'var(--card)',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <strong>{item.role}</strong>
                          <span className="tag mid" style={{ textTransform: 'capitalize', fontSize: '0.72rem' }}>
                            {item.experienceLevel || 'mid'}
                          </span>
                          <span
                            className={item.overallScore >= 75 ? "tag ok" : "tag mid"}
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            {item.overallScore}% score
                          </span>
                        </div>
                        <p className="muted small" style={{ margin: 0 }}>
                          {item.verdict ? `${item.verdict.slice(0, 100)}…` : 'Completed technical session'}
                          {item.createdAt && ` · ${new Date(item.createdAt).toLocaleDateString()}`}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="ghost"
                        onClick={() => handleReviewPastSession(item)}
                        style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                      >
                        Review Debrief →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Start New Interview Configuration Section */}
        <section className="card" style={{ padding: '26px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.3rem' }}>Start New Interview Simulation</h2>

          {/* Resume Suggestion Callout Banner */}
          {resumeSuggestion && (
            <div
              className="card"
              style={{
                background: 'var(--pri-subtle)',
                border: '1px solid var(--line-strong)',
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div>
                <strong style={{ color: 'var(--pri)' }}>Resume Signal Detected</strong>
                <p className="muted small" style={{ margin: '4px 0 0', color: 'var(--mut)' }}>
                  Your uploaded resume emphasizes <b>{resumeSuggestion.topSkills.join(', ')}</b>. We recommend targeting{' '}
                  <b>{resumeSuggestion.role}</b>.
                </p>
              </div>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setSelectedRole(resumeSuggestion.role);
                }}
                style={{
                  borderColor: 'var(--pri)',
                  color: 'var(--pri)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                Use Suggested Role
              </button>
            </div>
          )}

          {error && (
            <div className="card" style={{ borderColor: 'var(--warm)', background: 'rgba(239, 68, 68, 0.1)', marginBottom: 20 }}>
              <strong style={{ color: 'var(--warm)' }}>Notice</strong>
              <p style={{ margin: '6px 0 0', color: 'var(--ink)' }}>{error}</p>
            </div>
          )}

          <div className="grid2" style={{ gap: 20 }}>
            {/* Role Selection */}
            <div className="card" style={{ margin: 0, padding: '18px' }}>
              <label htmlFor="role-select" style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>
                Target Role / Tech Stack
              </label>
              <select
                id="role-select"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8 }}
              >
                {PRESET_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>

              {selectedRole === 'Custom Role' && (
                <div style={{ marginTop: 12 }}>
                  <label htmlFor="custom-role" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>
                    Specify Your Custom Role or Focus
                  </label>
                  <input
                    id="custom-role"
                    type="text"
                    placeholder="e.g. Distributed Systems Engineer, Golang Microservices"
                    value={customRoleInput}
                    onChange={(e) => setCustomRoleInput(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>

            {/* Experience Level Selection */}
            <div className="card" style={{ margin: 0, padding: '18px' }}>
              <label htmlFor="exp-level" style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>
                Experience Level
              </label>
              <select
                id="exp-level"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8 }}
              >
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
                ))}
              </select>
              <p className="muted small" style={{ margin: '8px 0 0' }}>
                Sets the initial baseline difficulty. The interviewer will adapt question complexity dynamically based on your answers.
              </p>
            </div>
          </div>

          {/* Time Limit Option */}
          <div className="card" style={{ marginTop: 20, padding: '18px' }}>
            <label htmlFor="time-limit" style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>
              Session Time Limit (Optional)
            </label>
            <select
              id="time-limit"
              value={timeLimitMinutes}
              onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8 }}
            >
              {TIME_LIMITS.map((limit) => (
                <option key={limit.value} value={limit.value}>{limit.label}</option>
              ))}
            </select>
            <p className="muted small" style={{ margin: '8px 0 0' }}>
              {timeLimitMinutes > 0
                ? `The session will run for ${timeLimitMinutes} minutes and automatically conclude with your comprehensive evaluation.`
                : 'Take as long as you need. You can wrap up and evaluate the interview at any time.'}
            </p>
          </div>

          {/* Start Button */}
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="primary"
              onClick={handleStartInterview}
              disabled={isEvaluating || (selectedRole === 'Custom Role' && !customRoleInput.trim())}
              style={{ minWidth: 220, padding: '13px 24px', fontSize: '1rem' }}
            >
              {isEvaluating ? 'Preparing Interviewer…' : 'Start Mock Interview →'}
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: Final Results & Report Card Screen
  // ==========================================
  if (isInterviewOver && finalResults) {
    const scoreColor =
      finalResults.overallScore >= 80 ? 'var(--pri)' : finalResults.overallScore >= 60 ? '#d97706' : 'var(--warm)';

    return (
      <section className="card" style={{ maxWidth: 960, margin: '24px auto', padding: '28px' }}>
        {/* Header with Circular Score Badge */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 20,
            paddingBottom: 20,
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div>
            <span className="tag ok" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isReviewingPast ? 'Historical Review' : 'Interview Complete'}
            </span>
            <h1 style={{ margin: '8px 0 4px', fontSize: '1.8rem' }}>Executive Evaluation Debrief</h1>
            <p className="muted" style={{ margin: 0 }}>
              Role: <b>{finalResults.role || effectiveRole}</b> ({finalResults.experienceLevel || experienceLevel}) · Duration: {formatTimeMMSS(sessionSeconds)} · Questions Answered: {finalResults.transcript?.length || 0}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 110,
              height: 110,
              borderRadius: '50%',
              border: `4px solid ${scoreColor}`,
              boxShadow: `0 0 20px ${scoreColor}33`,
              flexDirection: 'column',
            }}
          >
            <span style={{ fontSize: '2rem', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
              {finalResults.overallScore}
            </span>
            <span className="muted small" style={{ fontSize: '0.72rem', textTransform: 'uppercase', marginTop: 2 }}>
              Score / 100
            </span>
          </div>
        </div>

        {/* Executive Verdict */}
        <div className="card" style={{ marginTop: 20, background: 'var(--card)', border: '1px solid var(--line)', padding: '18px' }}>
          <strong style={{ display: 'block', marginBottom: 6, fontSize: '1rem', color: 'var(--ink)' }}>Hiring Committee Verdict</strong>
          <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--ink)' }}>{finalResults.verdict}</p>
          {finalResults.pacingFeedback && (
            <p className="muted small" style={{ margin: '8px 0 0', fontStyle: 'italic', color: 'var(--mut)' }}>
              ⏱ Pacing Analysis: {finalResults.pacingFeedback}
            </p>
          )}
        </div>

        {/* Category Breakdown */}
        {finalResults.categoryScores && (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem' }}>Category Competency Breakdown</h3>
            <div className="grid2" style={{ gap: 14 }}>
              {Object.entries(finalResults.categoryScores).map(([category, score]) => {
                const label = category
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, (str) => str.toUpperCase());
                return (
                  <div key={category} className="card" style={{ margin: 0, padding: '14px 16px', background: 'var(--card)', border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink)' }}>{label}</span>
                      <b style={{ color: 'var(--ink)' }}>{score}%</b>
                    </div>
                    <div className="bar" style={{ margin: 0, height: 8 }}>
                      <i style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Strengths & Weaknesses Grid */}
        <div className="grid2" style={{ marginTop: 20, gap: 16 }}>
          <div className="card" style={{ margin: 0, padding: '18px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
            <h3 style={{ margin: '0 0 10px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✓</span> Demonstrated Strengths
            </h3>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, color: 'var(--ink)' }}>
              {(finalResults.strengths || []).map((item, idx) => (
                <li key={idx} style={{ marginBottom: 4 }}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="card" style={{ margin: 0, padding: '18px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <h3 style={{ margin: '0 0 10px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚠</span> Areas for Growth
            </h3>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, color: 'var(--ink)' }}>
              {(finalResults.weaknesses || []).map((item, idx) => (
                <li key={idx} style={{ marginBottom: 4 }}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Actionable Suggestions */}
        <div className="card" style={{ marginTop: 20, padding: '18px', background: 'var(--card)', border: '1px solid var(--line)' }}>
          <h3 style={{ margin: '0 0 10px' }}>Actionable Recommendations</h3>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, color: 'var(--ink)' }}>
            {(finalResults.suggestions || []).map((item, idx) => (
              <li key={idx} style={{ marginBottom: 4 }}>{item}</li>
            ))}
          </ul>
        </div>

        {/* Question-by-Question Review */}
        {finalResults.transcript && finalResults.transcript.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ margin: '0 0 12px' }}>Detailed Q&A Transcript Review</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              {finalResults.transcript.map((entry, idx) => (
                <div key={idx} className="card" style={{ margin: 0, padding: '16px', background: 'var(--card)', border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                    <strong>Question {idx + 1}</strong>
                    {entry.responseTimeSeconds && (
                      <span className="muted small">Time taken: {entry.responseTimeSeconds}s</span>
                    )}
                  </div>
                  <p style={{ margin: '0 0 10px', fontWeight: 600, color: 'var(--ink)' }}>{entry.question}</p>
                  <div
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                      marginBottom: 8,
                      color: 'var(--ink)',
                    }}
                  >
                    <small className="muted" style={{ display: 'block', marginBottom: 2 }}>Candidate Response:</small>
                    {entry.answer || '(No answer recorded)'}
                  </div>
                  {entry.detailedFeedback && (
                    <p className="muted small" style={{ margin: 0, borderLeft: '3px solid var(--pri)', paddingLeft: 10 }}>
                      <b>Interviewer Feedback:</b> {entry.detailedFeedback}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Link to="/roadmap" className="btn" style={{ padding: '11px 20px' }}>
            View Learning Roadmap
          </Link>
          <button
            type="button"
            className="primary"
            onClick={handleResetSession}
            style={{ width: 'auto', padding: '11px 24px' }}
          >
            ← Back to Interview Center
          </button>
        </div>
      </section>
    );
  }

  // ==========================================
  // VIEW 3: Live Interview Session View
  // ==========================================
  return (
    <section style={{ maxWidth: 1080, margin: '16px auto', padding: '0 16px' }}>
      {/* Top Header & Session Bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          padding: '14px 20px',
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{effectiveRole}</h2>
          <span className="muted small">
            Seniority: <b>{experienceLevel}</b> · Adaptive Difficulty:{' '}
            <span className="tag mid" style={{ textTransform: 'capitalize' }}>
              {currentDifficulty}
            </span>
          </span>
        </div>

        {/* Timer & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <span className="muted small" style={{ display: 'block' }}>Elapsed Time</span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '1.2rem',
                fontWeight: 700,
                color: timeLimitMinutes > 0 && sessionSeconds >= timeLimitMinutes * 60 - 120 ? 'var(--warm)' : 'var(--ink)',
              }}
            >
              {formatTimeMMSS(sessionSeconds)}
              {timeLimitMinutes > 0 && ` / ${formatTimeMMSS(timeLimitMinutes * 60)}`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleTriggerEndInterview(false)}
            disabled={isEndingSession || isEvaluating}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              borderColor: 'rgba(239, 68, 68, 0.35)',
              padding: '8px 14px',
              fontWeight: 600,
            }}
          >
            {isEndingSession ? 'Finalizing Evaluation…' : 'End Interview'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.12)', marginBottom: 16 }}>
          <strong style={{ color: 'var(--warm)' }}>Notice</strong>
          <p style={{ margin: '4px 0 0' }}>{error}</p>
        </div>
      )}

      {/* Main Split Layout: Left Avatar Pod / Right Conversation Feed */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          gap: 16,
          alignItems: 'start',
        }}
        className="interview-split-container"
      >
        {/* Left Column: Avatar & Stage Controls */}
        <div className="card" style={{ margin: 0, padding: '20px', textAlign: 'center' }}>
          <InterviewerAvatar
            isSpeaking={isAvatarSpeaking}
            expression={avatarExpression}
            avatarConfig={avatarConfig}
            onRegenerate={() => setAvatarConfig(generateRandomAvatarConfig())}
            size={160}
          />

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              className="ghost"
              onClick={handleRepeatQuestion}
              disabled={isAvatarSpeaking || isEvaluating}
              style={{ width: '100%', fontSize: '0.85rem' }}
            >
              🔊 Repeat Question
            </button>

            <button
              type="button"
              className="ghost"
              onClick={() => {
                const nextMuted = !voiceMuted;
                setVoiceMuted(nextMuted);
                if (nextMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                  setIsAvatarSpeaking(false);
                }
              }}
              style={{ width: '100%', fontSize: '0.85rem' }}
            >
              {voiceMuted ? '🔇 AI Voice: Muted' : '🔊 AI Voice: Active'}
            </button>
          </div>

          <div
            style={{
              marginTop: 18,
              padding: '10px 12px',
              background: 'var(--pri-subtle)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              fontSize: '0.78rem',
              color: 'var(--mut)',
              lineHeight: 1.4,
            }}
          >
            Mouth moves dynamically with SpeechSynthesis audio events.
          </div>
        </div>

        {/* Right Column: Chat History & Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Conversation Transcript Feed */}
          <div
            className="card"
            style={{
              margin: 0,
              padding: '18px',
              minHeight: 380,
              maxHeight: 520,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {messages.map((msg) => {
              if (msg.sender === 'ai' && msg.type === 'question') {
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      background: 'var(--card)',
                      border: '1.5px solid var(--pri)',
                      borderRadius: 12,
                      padding: '16px 18px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                    }}
                  >
                    <span style={{ fontSize: '1.2rem', marginTop: 2 }}>🎙</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <strong style={{ color: 'var(--pri)', fontSize: '0.88rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Interviewer</strong>
                        {msg.difficulty && (
                          <span className="muted small" style={{ textTransform: 'capitalize', color: 'var(--mut)' }}>
                            {msg.difficulty}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, lineHeight: 1.6, fontSize: '1.02rem', color: 'var(--ink)', fontWeight: 500 }}>{msg.text}</p>
                    </div>
                  </div>
                );
              }

              if (msg.sender === 'ai' && msg.type === 'feedback') {
                const verdictStyle =
                  msg.verdict === 'strong'
                    ? { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.35)', text: '#22c55e', label: 'Strong Answer' }
                    : msg.verdict === 'satisfactory'
                      ? { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.35)', text: '#f59e0b', label: 'Satisfactory' }
                      : { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.35)', text: '#ef4444', label: 'Needs Improvement' };

                return (
                  <div
                    key={msg.id}
                    style={{
                      background: verdictStyle.bg,
                      border: `1px solid ${verdictStyle.border}`,
                      borderRadius: 10,
                      padding: '12px 16px',
                      fontSize: '0.9rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: verdictStyle.text }}>
                        {verdictStyle.label} ({msg.score}/100)
                      </span>
                    </div>
                    <p style={{ margin: 0, lineHeight: 1.5, color: 'var(--ink)' }}>{msg.text}</p>
                  </div>
                );
              }

              // Candidate Answer
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignSelf: 'flex-end',
                    maxWidth: '85%',
                    background: 'var(--card)',
                    border: '1px solid var(--line-strong)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    borderRadius: '12px 12px 2px 12px',
                    padding: '12px 16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                    <strong style={{ fontSize: '0.82rem', color: 'var(--pri)' }}>You</strong>
                    {msg.responseTimeSeconds && (
                      <span className="muted small" style={{ fontSize: '0.75rem', color: 'var(--mut)' }}>
                        ⏱ {msg.responseTimeSeconds}s
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--ink)' }}>{msg.text}</p>
                </div>
              );
            })}

            {isEvaluating && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  color: 'var(--pri)',
                  fontSize: '0.9rem',
                }}
              >
                <span className="skeleton" style={{ width: 14, height: 14, borderRadius: '50%' }} />
                AI is evaluating your response and adapting the next question…
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Candidate Answer Input Card */}
          <div className="card" style={{ margin: 0, padding: '16px' }}>
            <label htmlFor="candidate-answer" style={{ fontWeight: 600, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>Your Answer</span>
              {voiceSupported && isListening && (
                <span style={{ color: 'var(--warm)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--warm)',
                      display: 'inline-block',
                      animation: 'pulse 1s infinite',
                    }}
                  />
                  Listening… Speak clearly
                </span>
              )}
            </label>

            <textarea
              id="candidate-answer"
              rows={4}
              placeholder="Speak using the microphone or type your technical answer here..."
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              disabled={isEvaluating || isInterviewOver}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 8,
                resize: 'vertical',
                fontFamily: 'inherit',
                fontSize: '0.95rem',
                lineHeight: 1.5,
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmitAnswer();
                }
              }}
            />

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              {/* Mic voice input toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {voiceSupported ? (
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={isEvaluating}
                    style={{
                      background: isListening ? 'rgba(239, 68, 68, 0.15)' : 'var(--card)',
                      color: isListening ? '#ef4444' : 'var(--ink)',
                      borderColor: isListening ? '#ef4444' : 'var(--line)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {isListening ? '⏹ Stop Mic' : '🎙 Speak Answer'}
                  </button>
                ) : (
                  <span className="muted small">Voice input not supported in this browser</span>
                )}
                {currentAnswer && (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setCurrentAnswer('')}
                    style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Submit Answer Button */}
              <button
                type="button"
                className="primary"
                onClick={handleSubmitAnswer}
                disabled={!currentAnswer.trim() || isEvaluating}
                style={{ width: 'auto', minWidth: 160 }}
              >
                {isEvaluating ? 'Evaluating…' : 'Submit Answer ↵'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
