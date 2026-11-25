import { useEffect, useMemo, useState } from 'react';
import mermaid from 'mermaid';
import { evaluateAnswer, generateQuestion, generateSessionSummary } from '../services/practiceService';
import { moveDifficulty } from '../utils/difficultyUtils.js';
import { progressService } from '../services/progressService';

const PRACTICE_HISTORY_KEY = 'sf_practice_history';

const difficultyOptions = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const difficultyStyles = {
  easy: { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' },
  medium: { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' },
  hard: { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' },
};

const createSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `practice-${Date.now()}`;
};

export default function PracticePage() {
  const [sessionId] = useState(() => createSessionId());
  const [topic, setTopic] = useState('React Hooks');
  const [startingDifficulty, setStartingDifficulty] = useState('medium');
  const [questionLimit, setQuestionLimit] = useState(5);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [currentDifficulty, setCurrentDifficulty] = useState('medium');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answerValue, setAnswerValue] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ attempted: 0, correct: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [summary, setSummary] = useState(null);
  const [retryAction, setRetryAction] = useState(null);
  const [diagramRenderError, setDiagramRenderError] = useState('');

  const safeHistory = useMemo(() => (Array.isArray(history) ? history : []), [history]);
  const accuracy = stats.attempted > 0 ? Math.round((stats.correct / stats.attempted) * 100) : 0;
  const diagramId = useMemo(() => {
    const rawKey = currentQuestion?.question ? currentQuestion.question.slice(0, 60) : 'practice-diagram';
    return `practice-diagram-${sessionId}-${rawKey.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  }, [sessionId, currentQuestion]);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      flowchart: { useMaxWidth: true, htmlLabels: true },
      themeVariables: {
        primaryColor: '#0f766e',
        primaryTextColor: '#ffffff',
        primaryBorderColor: '#0f766e',
        lineColor: '#e08a5f',
        secondaryColor: '#12313a',
        tertiaryColor: '#0b3b35',
      },
    });
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PRACTICE_HISTORY_KEY, JSON.stringify(history));
    }
  }, [history]);

  useEffect(() => {
    if (!currentQuestion || typeof currentQuestion.diagram !== 'string' || !currentQuestion.diagram.trim()) {
      setDiagramRenderError('');
      return undefined;
    }

    let cancelled = false;

    const renderDiagram = async () => {
      const container = document.getElementById(diagramId);

      if (!container) {
        return;
      }

      setDiagramRenderError('');
      container.innerHTML = '';
      container.classList.add('mermaid');
      container.textContent = currentQuestion.diagram;

      try {
        await mermaid.run({ nodes: [container], suppressErrors: true });
      } catch (err) {
        console.error('Mermaid render error:', err, currentQuestion.diagram);

        if (!cancelled) {
          setDiagramRenderError("Diagram couldn't be rendered — here's the question in text form.");
        }
      }
    };

    renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [currentQuestion, diagramId]);

  const resetAnswerInputs = () => {
    setAnswerValue('');
    setSelectedOption('');
  };

  const finalizeSession = async (finalHistory = safeHistory) => {
    setIsLoading(true);
    setError('');
    setDiagramRenderError('');
    setRetryAction(() => () => finalizeSession(finalHistory));

    try {
      const sessionSummary = await generateSessionSummary(finalHistory);
      setSummary(sessionSummary);
      setSessionEnded(true);
      setCurrentQuestion(null);
      setEvaluation(null);

      progressService.addActivity({
        type: 'practice',
        title: `Practice: ${topic.trim() || 'General Practice'}`,
        score: sessionSummary?.masteryScore || (stats.attempted > 0 ? Math.round((stats.correct / stats.attempted) * 100) : 70),
        durationMinutes: Math.max(Math.round(finalHistory.length * 3), 5),
        details: {
          topic: topic.trim(),
          attempted: stats.attempted,
          correct: stats.correct,
        },
      });
    } catch (err) {
      setError(err?.message || 'The session summary could not be generated.');
      setRetryAction(() => () => finalizeSession(finalHistory));
    } finally {
      setIsLoading(false);
    }
  };

  const startSession = async () => {
    const trimmedTopic = topic.trim();

    if (!trimmedTopic) {
      setError('Choose a topic or enter a skill name to begin the practice session.');
      return;
    }

    setIsLoading(true);
    setError('');
    setDiagramRenderError('');
    setRetryAction(() => () => startSession());
    setSessionEnded(false);
    setSummary(null);
    setEvaluation(null);
    setHistory([]);
    setStats({ attempted: 0, correct: 0 });
    resetAnswerInputs();
    setCurrentDifficulty(startingDifficulty);

    try {
      const nextQuestion = await generateQuestion(trimmedTopic, startingDifficulty, []);
      setCurrentQuestion(nextQuestion);
      setSessionStarted(true);
      setCurrentDifficulty(nextQuestion.difficulty || startingDifficulty);
    } catch (err) {
      setError(err?.message || 'The first question could not be generated. Please try again.');
      setSessionStarted(false);
      setCurrentQuestion(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    if (typeof retryAction === 'function') {
      await retryAction();
    }
  };

  const handleSubmitAnswer = async () => {
    if (!sessionStarted || !currentQuestion || isLoading) {
      return;
    }

    const answer = currentQuestion.questionType === 'mcq'
      ? selectedOption
      : answerValue.trim();

    if (!answer) {
      setError('Please provide a response before continuing.');
      return;
    }

    setIsLoading(true);
    setError('');
    setRetryAction(() => () => handleSubmitAnswer());

    try {
      const updatedHistory = [
        ...safeHistory,
        {
          question: currentQuestion.question,
          userAnswer: answer,
          difficulty: currentQuestion.difficulty || currentDifficulty,
        },
      ];

      const result = await evaluateAnswer(currentQuestion, answer, updatedHistory);
      const nextAttempted = stats.attempted + 1;
      const nextCorrect = result.isCorrect ? stats.correct + 1 : stats.correct;
      const nextHistory = [
        ...updatedHistory,
        {
          question: currentQuestion.question,
          userAnswer: answer,
          difficulty: currentQuestion.difficulty || currentDifficulty,
          isCorrect: result.isCorrect,
          explanation: result.explanation,
          suggestedNextDifficulty: result.suggestedNextDifficulty,
        },
      ];

      setHistory(nextHistory);
      setStats({ attempted: nextAttempted, correct: nextCorrect });
      setEvaluation({ ...result, isCorrect: result.isCorrect });
      setCurrentDifficulty(moveDifficulty(currentQuestion.difficulty || currentDifficulty, result.suggestedNextDifficulty));
      resetAnswerInputs();

      if (nextAttempted >= Number(questionLimit)) {
        window.setTimeout(async () => {
          await finalizeSession(nextHistory);
        }, 900);
        return;
      }

      window.setTimeout(async () => {
        try {
          const nextQuestion = await generateQuestion(topic.trim() || topic, result.suggestedNextDifficulty, nextHistory);
          setCurrentQuestion(nextQuestion);
          setCurrentDifficulty(nextQuestion.difficulty || moveDifficulty(currentQuestion.difficulty || currentDifficulty, result.suggestedNextDifficulty));
          setEvaluation(null);
        } catch (err) {
          setError(err?.message || 'The next question could not be generated. Please try again.');
          setRetryAction(() => () => handleSubmitAnswer());
        } finally {
          setIsLoading(false);
        }
      }, 900);
    } catch (err) {
      setError(err?.message || 'The answer could not be evaluated. Please try again.');
      setRetryAction(() => () => handleSubmitAnswer());
      setIsLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!sessionStarted) return;
    await finalizeSession(safeHistory);
  };

  if (sessionEnded && summary) {
    return (
      <section className="card" style={{ maxWidth: 980, margin: '24px auto', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0 }}>Practice Summary</h1>
            <p className="muted" style={{ margin: '8px 0 0' }}>Session: {sessionId}</p>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--brand)' }}>{summary.masteryScore}/100</div>
        </div>

        <div className="grid2" style={{ marginTop: 20, gap: 16 }}>
          <div className="card" style={{ margin: 0 }}>
            <h3>Strong areas</h3>
            {(summary.strongAreas || []).length > 0 ? (
              <ul>
                {(summary.strongAreas || []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <p className="muted">The model did not identify clear strong areas.</p>
            )}
          </div>

          <div className="card" style={{ margin: 0 }}>
            <h3>Weak areas</h3>
            {(summary.weakAreas || []).length > 0 ? (
              <ul>
                {(summary.weakAreas || []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <p className="muted">No major weak areas were detected in this session.</p>
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h3>Recommendations</h3>
          {(summary.recommendations || []).length > 0 ? (
            <ul>
              {(summary.recommendations || []).map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : (
            <p className="muted">No additional recommendations were returned by the model.</p>
          )}
        </div>

        <div className="actions" style={{ marginTop: 18 }}>
          <button className="primary" onClick={() => {
            setSessionEnded(false);
            setSummary(null);
            setSessionStarted(false);
            setCurrentQuestion(null);
            setHistory([]);
            setStats({ attempted: 0, correct: 0 });
            setError('');
            setEvaluation(null);
            setCurrentDifficulty(startingDifficulty);
          }}>Start a new session</button>
        </div>
      </section>
    );
  }

  return (
    <section className="card" style={{ maxWidth: 980, margin: '24px auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Adaptive Practice</h1>
          <p className="muted" style={{ margin: '8px 0 0' }}>One live technical question at a time, generated by Groq.</p>
        </div>
        <div className="chip" style={{ ...difficultyStyles[currentDifficulty] || difficultyStyles.medium, padding: '6px 12px', borderRadius: 999, fontWeight: 700 }}>
          {currentDifficulty}
        </div>
      </div>

      {!sessionStarted ? (
        <div className="card" style={{ marginTop: 20 }}>
          {error && (
            <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.12)' }}>
              <strong style={{ color: 'var(--warm)' }}>Error</strong>
              <p style={{ margin: '8px 0 0' }}>{error}</p>
              <div className="actions" style={{ marginTop: 12 }}>
                <button onClick={handleRetry}>Retry</button>
              </div>
            </div>
          )}

          <div className="grid2" style={{ gap: 16 }}>
            <label>
              <span>Skill / topic</span>
              <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="React Hooks, SQL Joins, System Design basics..." />
            </label>

            <label>
              <span>Starting difficulty</span>
              <select value={startingDifficulty} onChange={(event) => setStartingDifficulty(event.target.value)}>
                {difficultyOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ marginTop: 16, display: 'block' }}>
            <span>Questions per session</span>
            <input type="number" min="1" max="10" value={questionLimit} onChange={(event) => setQuestionLimit(Math.min(10, Math.max(1, Number(event.target.value) || 1)))} />
          </label>

          <div className="actions" style={{ marginTop: 18 }}>
            <button className="primary" onClick={startSession} disabled={isLoading}>{isLoading ? 'Loading…' : 'Start session'}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="cards" style={{ marginTop: 20 }}>
            <div className="card stat" style={{ margin: 0 }}>
              <small>Questions attempted</small>
              <b>{stats.attempted}/{questionLimit}</b>
            </div>
            <div className="card stat" style={{ margin: 0 }}>
              <small>Accuracy</small>
              <b>{accuracy}%</b>
            </div>
            <div className="card stat" style={{ margin: 0 }}>
              <small>Current difficulty</small>
              <b>{currentDifficulty}</b>
            </div>
          </div>

          {error && (
            <div className="card" style={{ marginTop: 16, borderColor: 'rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.12)' }}>
              <strong style={{ color: 'var(--warm)' }}>Error</strong>
              <p style={{ margin: '8px 0 0' }}>{error}</p>
              <div className="actions" style={{ marginTop: 12 }}>
                <button onClick={handleRetry}>Retry</button>
              </div>
            </div>
          )}

          {currentQuestion && !evaluation && (
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Question {Math.min(stats.attempted + 1, questionLimit)}</h3>
                <span className="tag" style={{ ...difficultyStyles[currentQuestion.difficulty || currentDifficulty] }}>{currentQuestion.difficulty || currentDifficulty}</span>
              </div>

              {currentQuestion.diagram && (
                <div style={{ marginBottom: 18, padding: 16, borderRadius: 12, border: '1px solid #d8e2df', background: '#0d1d20', overflow: 'auto' }}>
                  {diagramRenderError ? (
                    <p className="muted" style={{ margin: 0, color: '#dfe6e3' }}>{diagramRenderError}</p>
                  ) : (
                    <div id={diagramId} className="mermaid-diagram" style={{ minHeight: 120 }} />
                  )}
                </div>
              )}

              {currentQuestion.questionType === 'code' && currentQuestion.codeSnippet && (
                <div style={{ marginBottom: 18, borderRadius: 12, border: '1px solid #1f2937', background: '#0b1120', overflow: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #253244', background: '#111827', color: '#dbeafe', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    <span>{currentQuestion.language || 'code'}</span>
                    <span>Buggy example</span>
                  </div>
                  <pre style={{ margin: 0, padding: '16px 18px', color: '#e2e8f0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace', fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                    {currentQuestion.codeSnippet}
                  </pre>
                </div>
              )}

              <p style={{ fontSize: '1.05rem', lineHeight: 1.6, marginBottom: 16 }}>{currentQuestion.question}</p>

              {currentQuestion.questionType === 'mcq' && (
                <div className="opts">
                  {currentQuestion.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedOption(option)}
                      style={{
                        background: selectedOption === option ? 'var(--pri)' : 'var(--card)',
                        color: selectedOption === option ? '#fff' : 'var(--ink)',
                        borderColor: selectedOption === option ? 'var(--pri)' : 'var(--line)',
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {(currentQuestion.questionType === 'short_answer' || currentQuestion.questionType === 'diagram') && (
                <textarea
                  rows={6}
                  value={answerValue}
                  onChange={(event) => setAnswerValue(event.target.value)}
                  placeholder={currentQuestion.questionType === 'diagram' ? 'Explain what is wrong with the diagram, or describe the correct behavior...' : 'Write your answer here...'}
                />
              )}

              {currentQuestion.questionType === 'code' && (
                <textarea
                  rows={10}
                  value={answerValue}
                  onChange={(event) => setAnswerValue(event.target.value)}
                  placeholder="Explain the bug and, if you can, show the fix..."
                />
              )}

              <div className="actions" style={{ marginTop: 18 }}>
                <button className="primary" onClick={handleSubmitAnswer} disabled={isLoading || (!selectedOption && currentQuestion.questionType === 'mcq') || (!answerValue.trim() && currentQuestion.questionType !== 'mcq')}>
                  {isLoading ? 'Checking answer…' : 'Submit answer'}
                </button>
                <button onClick={handleEndSession} disabled={isLoading}>End Session</button>
              </div>
            </div>
          )}

          {evaluation && (
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}>{evaluation.isCorrect ? 'Correct' : 'Not quite'}</h3>
                <span className="tag" style={{ ...difficultyStyles[moveDifficulty(currentDifficulty, evaluation.suggestedNextDifficulty)] || difficultyStyles.medium }}>
                  Next: {evaluation.suggestedNextDifficulty}
                </span>
              </div>

              <p style={{ marginTop: 12, lineHeight: 1.6 }}>{evaluation.explanation}</p>

              <div className="actions" style={{ marginTop: 18 }}>
                <button className="primary" onClick={() => setEvaluation(null)}>{isLoading ? 'Loading…' : 'Continue'}</button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
