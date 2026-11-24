import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import {
  generateAssessmentQuestion,
  evaluateAssessmentAnswer,
  generateAssessmentReport,
  readUserRewards,
  saveUserRewards,
  evaluateSessionBadges,
  saveAssessmentSession,
  BADGES_CATALOG,
} from '../services/assessmentService';
import { moveDifficulty, normalizeDifficulty } from '../utils/difficultyUtils';
import { progressService } from '../services/progressService';

export default function Assessment() {
  // Setup & Metadata state
  const [meta, setMeta] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [form, setForm] = useState({
    skill: 'JavaScript',
    difficulty: 'medium',
    count: 5,
  });

  // Rewards & running gamification state
  const [rewards, setRewards] = useState(() => readUserRewards());
  const [sessionXp, setSessionXp] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [newlyUnlockedBadges, setNewlyUnlockedBadges] = useState([]);

  // Active session state
  const [sessionActive, setSessionActive] = useState(false);
  const [currentDifficulty, setCurrentDifficulty] = useState('medium');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(1);
  const [questionsHistory, setQuestionsHistory] = useState([]);

  // User input & evaluation state
  const [selectedOption, setSelectedOption] = useState('');
  const [writtenAnswer, setWrittenAnswer] = useState('');
  const [currentEvaluation, setCurrentEvaluation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryAction, setRetryAction] = useState(null);

  // Final Results state
  const [finalReport, setFinalReport] = useState(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [showDetailedReview, setShowDetailedReview] = useState(false);

  // Load backend metadata & user profile on mount
  useEffect(() => {
    let mounted = true;
    Promise.all([
      api('/assessment/meta').catch(() => ({ skills: ['JavaScript', 'React', 'Node.js', 'Python', 'SQL', 'TypeScript', 'Git', 'Docker'], levels: ['easy', 'medium', 'hard'] })),
      api('/user/profile').catch(() => null),
    ]).then(([m, u]) => {
      if (!mounted) return;
      setMeta(m);
      setUserProfile(u);
      if (m?.skills?.length) {
        setForm((prev) => ({ ...prev, skill: m.skills[0] }));
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Sync rewards to local storage whenever updated
  useEffect(() => {
    saveUserRewards(rewards);
  }, [rewards]);

  // Skill options combining meta dictionary, user resume skills, and target role
  const availableSkills = useMemo(() => {
    const list = new Set(meta?.skills || ['JavaScript', 'React', 'Node.js', 'Python', 'SQL']);
    if (userProfile?.skills) {
      userProfile.skills.forEach((s) => list.add(s.name));
    }
    return Array.from(list);
  }, [meta, userProfile]);

  // Start Assessment Session
  const handleStartAssessment = async () => {
    if (isLoadingQuestion) return;
    setIsLoadingQuestion(true);
    setErrorMessage('');
    setRetryAction(null);
    setFinalReport(null);
    setQuestionsHistory([]);
    setQuestionIndex(1);
    setSessionXp(0);
    setCurrentStreak(0);
    setMaxStreak(0);
    setNewlyUnlockedBadges([]);
    setSelectedOption('');
    setWrittenAnswer('');
    setCurrentEvaluation(null);
    setCurrentDifficulty(form.difficulty);

    try {
      const firstQuestion = await generateAssessmentQuestion({
        skill: form.skill,
        difficulty: form.difficulty,
        questionNumber: 1,
        totalQuestions: form.count,
        history: [],
      });
      setCurrentQuestion(firstQuestion);
      setCurrentDifficulty(firstQuestion.difficulty || form.difficulty);
      setSessionActive(true);
    } catch (err) {
      const msg = err?.message || 'Could not generate the first question. Please try again.';
      setErrorMessage(msg);
      setRetryAction(() => handleStartAssessment);
      toast.error(msg);
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  // Submit Answer for Live AI Evaluation
  const handleSubmitAnswer = async () => {
    if (!currentQuestion || isSubmitting) return;

    const answer = currentQuestion.questionType === 'mcq'
      ? selectedOption
      : writtenAnswer.trim();

    if (!answer) {
      toast.error('Please provide an answer before submitting.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const evaluation = await evaluateAssessmentAnswer({
        question: currentQuestion,
        userAnswer: answer,
        history: questionsHistory,
        currentStreak,
      });

      setCurrentEvaluation(evaluation);

      // Running streak & XP update
      const isStrong = evaluation.isCorrect;
      const nextStreak = isStrong ? currentStreak + 1 : 0;
      const nextMaxStreak = Math.max(maxStreak, nextStreak);
      const earnedXp = evaluation.xpAwarded || 0;

      setCurrentStreak(nextStreak);
      setMaxStreak(nextMaxStreak);
      setSessionXp((prev) => prev + earnedXp);

      // Record this question entry
      const questionRecord = {
        index: questionIndex,
        skill: form.skill,
        questionType: currentQuestion.questionType,
        difficulty: currentQuestion.difficulty || currentDifficulty,
        topic: currentQuestion.topic || form.skill,
        question: currentQuestion.question,
        codeSnippet: currentQuestion.codeSnippet || null,
        language: currentQuestion.language || null,
        scenarioContext: currentQuestion.scenarioContext || null,
        options: currentQuestion.options || null,
        correctIndex: currentQuestion.correctIndex ?? null,
        userAnswer: answer,
        score: evaluation.score,
        isCorrect: evaluation.isCorrect,
        quality: evaluation.quality,
        evaluation,
        xpAwarded: earnedXp,
      };

      const updatedHistory = [...questionsHistory, questionRecord];
      setQuestionsHistory(updatedHistory);

      // Check badge triggers live
      const currentUnlockedIds = new Set(rewards.unlockedBadges.map((b) => b.id));
      const newlyEarned = evaluateSessionBadges(
        {
          questions: updatedHistory,
          overallScore: evaluation.score,
          maxStreak: nextMaxStreak,
          isComplete: false,
        },
        currentUnlockedIds
      );

      if (newlyEarned.length > 0) {
        setNewlyUnlockedBadges((prev) => {
          const prevIds = new Set(prev.map((b) => b.id));
          const add = newlyEarned.filter((b) => !prevIds.has(b.id));
          add.forEach((b) => toast.success(`🏆 Badge Unlocked: ${b.name}!`, { icon: b.icon }));
          return [...prev, ...add];
        });
      }
    } catch (err) {
      const msg = err?.message || 'Answer evaluation failed. Please check your connection.';
      setErrorMessage(msg);
      setRetryAction(() => handleSubmitAnswer);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Proceed to Next Question or Finalize Results
  const handleNextStep = async () => {
    if (!currentEvaluation) return;

    // Check if this was the last question
    if (questionIndex >= form.count) {
      await handleFinalizeAssessment(questionsHistory);
      return;
    }

    // Adaptive next difficulty
    const nextDiff = moveDifficulty(currentDifficulty, currentEvaluation.suggestedNextDifficulty);
    setCurrentDifficulty(nextDiff);
    setSelectedOption('');
    setWrittenAnswer('');
    setCurrentEvaluation(null);
    setIsLoadingQuestion(true);
    setErrorMessage('');
    setRetryAction(null);

    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);

    try {
      const nextQ = await generateAssessmentQuestion({
        skill: form.skill,
        difficulty: nextDiff,
        questionNumber: nextIndex,
        totalQuestions: form.count,
        history: questionsHistory,
      });

      setCurrentQuestion(nextQ);
      setCurrentDifficulty(nextQ.difficulty || nextDiff);
    } catch (err) {
      const msg = err?.message || 'Failed to generate next question.';
      setErrorMessage(msg);
      setRetryAction(() => handleNextStep);
      toast.error(msg);
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  // Finalize Session and Generate Deep Results Report
  const handleFinalizeAssessment = async (finalQuestions) => {
    setIsGeneratingReport(true);
    setSessionActive(false);
    setCurrentQuestion(null);
    setCurrentEvaluation(null);

    // Compute genuine weighted score
    const diffWeights = { easy: 1.0, medium: 1.3, hard: 1.6 };
    let totalWeightedScore = 0;
    let totalWeight = 0;

    finalQuestions.forEach((q) => {
      const weight = diffWeights[normalizeDifficulty(q.difficulty)] || 1.0;
      totalWeightedScore += (q.score * weight);
      totalWeight += weight;
    });

    const finalOverallScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;

    // Evaluate all badges unlocked at completion
    const currentUnlockedIds = new Set(rewards.unlockedBadges.map((b) => b.id));
    const allSessionBadges = evaluateSessionBadges(
      {
        questions: finalQuestions,
        overallScore: finalOverallScore,
        maxStreak,
        isComplete: true,
      },
      currentUnlockedIds
    );

    // Update lifetime user rewards state
    const nextTotalXp = rewards.totalXp + sessionXp;
    const badgeEntries = allSessionBadges.map((b) => ({
      ...b,
      unlockedAt: new Date().toISOString(),
      skill: form.skill,
    }));

    const nextRewards = {
      totalXp: nextTotalXp,
      currentStreak: 0,
      maxStreak: Math.max(rewards.maxStreak, maxStreak),
      unlockedBadges: [...rewards.unlockedBadges, ...badgeEntries],
    };
    setRewards(nextRewards);
    saveUserRewards(nextRewards);
    setNewlyUnlockedBadges(allSessionBadges);

    try {
      // 1. Generate comprehensive AI report
      const report = await generateAssessmentReport({
        skill: form.skill,
        questions: finalQuestions,
        overallScore: finalOverallScore,
      });

      const fullReport = {
        ...report,
        skill: form.skill,
        score: finalOverallScore,
        totalQuestions: finalQuestions.length,
        correctCount: finalQuestions.filter((q) => q.isCorrect).length,
        sessionXp,
        maxStreak,
        difficultyPath: finalQuestions.map((q) => q.difficulty),
        questions: finalQuestions,
        newBadges: allSessionBadges,
      };

      setFinalReport(fullReport);

      // 2. Persist to local storage
      saveAssessmentSession({
        id: `asmt-${Date.now()}`,
        skill: form.skill,
        score: finalOverallScore,
        date: new Date().toISOString(),
        questionsCount: finalQuestions.length,
        xpEarned: sessionXp,
        maxStreak,
        questions: finalQuestions,
      });

      // Log progress activity for tracking, streaks & milestones
      progressService.addActivity({
        type: 'assessment',
        title: `${form.skill} Skill Assessment`,
        score: finalOverallScore,
        durationMinutes: Math.max(form.count * 3, 10),
        details: {
          skill: form.skill,
          questionsCount: finalQuestions.length,
          xpEarned: sessionXp,
        },
      });

      // 3. Feed results into backend data store for Skill Gap, Skill Profile & Dashboard
      api('/assessment/complete', {
        method: 'POST',
        body: {
          skill: form.skill,
          score: finalOverallScore,
          correctCount: fullReport.correctCount,
          totalCount: fullReport.totalQuestions,
          weakTopics: fullReport.weaknesses,
          strongTopics: fullReport.strengths,
        },
      })
        .then((res) => {
          toast.success(`Skill score updated in Skill Gap: ${res.score}%`);
        })
        .catch((err) => {
          console.warn('Backend sync note:', err.message);
        });
    } catch (err) {
      toast.error('Could not generate full assessment summary report.');
      setFinalReport({
        overallSummary: `Assessment completed for ${form.skill} with a score of ${finalOverallScore}%.`,
        skill: form.skill,
        score: finalOverallScore,
        totalQuestions: finalQuestions.length,
        correctCount: finalQuestions.filter((q) => q.isCorrect).length,
        sessionXp,
        maxStreak,
        difficultyPath: finalQuestions.map((q) => q.difficulty),
        strengths: finalQuestions.filter((q) => q.isCorrect).map((q) => q.topic).slice(0, 3),
        weaknesses: finalQuestions.filter((q) => !q.isCorrect).map((q) => q.topic).slice(0, 3),
        improvementSuggestions: [
          'Review fundamentals and core principles for missed topics.',
          'Solve practical coding drills focused on edge cases.',
        ],
        questions: finalQuestions,
        newBadges: allSessionBadges,
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // RENDER: Loading Skeleton
  if (!meta) {
    return (
      <div style={{ maxWidth: 860, margin: '24px auto' }}>
        <div className="skeleton" style={{ height: 180, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 260 }} />
      </div>
    );
  }

  // RENDER: Active Assessment Taking
  if (sessionActive) {
    const qType = currentQuestion?.questionType || 'short_answer';
    const isMcq = qType === 'mcq';
    const isCode = qType === 'code';
    const isScenario = qType === 'scenario';

    return (
      <div style={{ maxWidth: 900, margin: '16px auto' }}>
        {/* Persistent Rewards & Status Bar */}
        <div className="asmt-header">
          <div className="asmt-header-left">
            <div>
              <span className="small muted" style={{ display: 'block', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Skill Assessment
              </span>
              <strong style={{ fontSize: '1.15rem', color: '#fff' }}>{form.skill}</strong>
            </div>
            <span className={`asmt-diff-pill asmt-diff-${currentDifficulty}`}>
              {currentDifficulty}
            </span>
            <span className={`asmt-type-badge asmt-type-${qType}`}>
              {isMcq ? '📝 Multiple Choice' : isCode ? '💻 Code Debugging' : isScenario ? '🧭 Scenario' : '✍️ Written'}
            </span>
          </div>

          <div className="asmt-header-right">
            {currentStreak >= 1 && (
              <span className="asmt-streak-badge">
                🔥 {currentStreak} in a row!
              </span>
            )}
            <span className="asmt-xp-badge">
              ⚡ +{sessionXp} XP
            </span>
            <span className="small muted" style={{ color: '#8fa19b' }}>
              Q{questionIndex} of {form.count}
            </span>
          </div>
        </div>

        {/* Real Progress Bar */}
        <div className="bar" style={{ height: 8, margin: '0 0 20px', background: '#dce2de' }}>
          <i
            style={{
              width: `${((questionIndex - (currentEvaluation ? 0 : 1)) / form.count) * 100}%`,
              transition: 'width .4s ease',
            }}
          />
        </div>

        {/* Error Callout */}
        {errorMessage && (
          <div className="card" style={{ borderColor: 'var(--warm)', background: '#fff5f2', marginBottom: 16 }}>
            <strong style={{ color: 'var(--warm)' }}>Evaluation Notice</strong>
            <p style={{ margin: '6px 0 10px', fontSize: '.92rem' }}>{errorMessage}</p>
            {retryAction && (
              <button type="button" onClick={retryAction} className="btn" style={{ borderColor: 'var(--warm)' }}>
                Retry Action
              </button>
            )}
          </div>
        )}

        {/* Question Loading State */}
        {isLoadingQuestion ? (
          <section className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="skeleton" style={{ height: 40, width: '60%', margin: '0 auto 20px' }} />
            <div className="skeleton" style={{ height: 120, width: '90%', margin: '0 auto' }} />
            <p className="muted" style={{ marginTop: 20 }}>Generating next adaptive question with Groq AI…</p>
          </section>
        ) : currentQuestion ? (
          <section className="card" style={{ padding: '28px' }}>
            {/* Topic pill */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span className="small muted" style={{ fontWeight: 600 }}>
                Topic: {currentQuestion.topic || form.skill}
              </span>
              <span className="small muted">
                Question {questionIndex} of {form.count}
              </span>
            </div>

            {/* Question Text */}
            <h2 style={{ fontSize: '1.28rem', lineHeight: 1.5, marginBottom: 16 }}>
              {currentQuestion.question}
            </h2>

            {/* Scenario Context Box */}
            {isScenario && currentQuestion.scenarioContext && (
              <div className="asmt-scenario-box">
                <strong>Scenario Context:</strong>
                <p style={{ margin: '6px 0 0' }}>{currentQuestion.scenarioContext}</p>
              </div>
            )}

            {/* Code Box */}
            {isCode && currentQuestion.codeSnippet && (
              <div className="asmt-code-container">
                <div className="asmt-code-bar">
                  <span>Language: {currentQuestion.language || 'Code'}</span>
                  <span>Buggy / Incomplete snippet</span>
                </div>
                <pre className="asmt-code-pre">
                  <code>{currentQuestion.codeSnippet}</code>
                </pre>
              </div>
            )}

            {/* Interactive Inputs */}
            {!currentEvaluation ? (
              <div style={{ marginTop: 20 }}>
                {/* MCQ Options */}
                {isMcq && Array.isArray(currentQuestion.options) && (
                  <div className="opts" style={{ marginTop: 12 }}>
                    {currentQuestion.options.map((option, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedOption(option)}
                        className={`asmt-mcq-opt ${selectedOption === option ? 'selected' : ''}`}
                      >
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          border: selectedOption === option ? '2px solid var(--pri)' : '1px solid #c7d2cb',
                          fontSize: '.82rem',
                          fontWeight: 700,
                          background: selectedOption === option ? 'var(--pri)' : '#fff',
                          color: selectedOption === option ? '#fff' : 'inherit',
                        }}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span>{option}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Short Written Input */}
                {qType === 'short_answer' && (
                  <div>
                    <label style={{ marginBottom: 6 }}>
                      <span>Your Explanation</span>
                    </label>
                    <textarea
                      className="asmt-textarea"
                      rows={5}
                      value={writtenAnswer}
                      onChange={(e) => setWrittenAnswer(e.target.value)}
                      placeholder="Write your explanation here. Focus on the core mechanics, reason why, and trade-offs..."
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span className="small muted">Evaluated on conceptual reasoning, not keyword matching.</span>
                      <span className="small muted">{writtenAnswer.length} characters</span>
                    </div>
                  </div>
                )}

                {/* Code Debugging Input */}
                {isCode && (
                  <div>
                    <label style={{ marginBottom: 6 }}>
                      <span>Bug Diagnosis & Proposed Fix</span>
                    </label>
                    <textarea
                      className="asmt-textarea asmt-textarea-code"
                      rows={6}
                      value={writtenAnswer}
                      onChange={(e) => setWrittenAnswer(e.target.value)}
                      placeholder="// 1. Explain the root bug and why it fails...&#10;// 2. Provide the corrected code or fix here..."
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span className="small muted">Identify root cause and provide a clean fix.</span>
                      <span className="small muted">{writtenAnswer.length} characters</span>
                    </div>
                  </div>
                )}

                {/* Scenario Input */}
                {isScenario && (
                  <div>
                    <label style={{ marginBottom: 6 }}>
                      <span>Your Practical Decision & Rationale</span>
                    </label>
                    <textarea
                      className="asmt-textarea"
                      rows={6}
                      value={writtenAnswer}
                      onChange={(e) => setWrittenAnswer(e.target.value)}
                      placeholder="What would you do? Detail your immediate steps, reasoning, trade-offs, and how you would prevent recurrence..."
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span className="small muted">Evaluated on pragmatic engineering judgment and risk awareness.</span>
                      <span className="small muted">{writtenAnswer.length} characters</span>
                    </div>
                  </div>
                )}

                <div className="actions" style={{ marginTop: 22 }}>
                  <button
                    type="button"
                    className="primary"
                    onClick={handleSubmitAnswer}
                    disabled={isSubmitting || (isMcq ? !selectedOption : !writtenAnswer.trim())}
                  >
                    {isSubmitting ? 'Evaluating with AI…' : 'Submit Answer'}
                  </button>
                </div>
              </div>
            ) : (
              /* Evaluation Feedback Screen */
              <div className="asmt-feedback asmt-feedback-pass" style={{
                background: currentEvaluation.score >= 70 ? '#ecfdf5' : currentEvaluation.score >= 40 ? '#fffbeb' : '#fff1f2',
                borderColor: currentEvaluation.score >= 70 ? '#6ee7b7' : currentEvaluation.score >= 40 ? '#fde68a' : '#fecdd3',
                color: currentEvaluation.score >= 70 ? '#064e3b' : currentEvaluation.score >= 40 ? '#78350f' : '#881337',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.6rem' }}>
                      {currentEvaluation.score >= 90 ? '🌟' : currentEvaluation.score >= 70 ? '✅' : currentEvaluation.score >= 40 ? '⚠️' : '❌'}
                    </span>
                    <div>
                      <strong style={{ fontSize: '1.1rem', textTransform: 'capitalize' }}>
                        {currentEvaluation.quality} ({currentEvaluation.score}%)
                      </strong>
                      <div className="small" style={{ opacity: 0.85 }}>
                        {currentEvaluation.isCorrect ? 'Accurate reasoning demonstrated' : 'Opportunity for improvement'}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span className="asmt-xp-badge" style={{ fontSize: '.84rem' }}>
                      +{currentEvaluation.xpAwarded} XP
                    </span>
                    <span className="small" style={{ display: 'block', marginTop: 4, fontWeight: 600 }}>
                      Next: {currentEvaluation.suggestedNextDifficulty} difficulty
                    </span>
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid currentColor', opacity: 0.18, margin: '14px 0' }} />

                <div style={{ fontSize: '.94rem', lineHeight: 1.6 }}>
                  <strong>AI Evaluation:</strong>
                  <p style={{ margin: '6px 0 12px' }}>{currentEvaluation.explanation}</p>

                  {currentEvaluation.idealAnswer && (
                    <div style={{
                      background: 'rgba(255,255,255,0.7)',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,0.06)',
                      color: 'var(--ink)',
                      marginTop: 8,
                    }}>
                      <small style={{ fontWeight: 700, color: 'var(--pri)', display: 'block', marginBottom: 2 }}>
                        Canonical / Optimal Solution:
                      </small>
                      <span style={{ fontSize: '.9rem' }}>{currentEvaluation.idealAnswer}</span>
                    </div>
                  )}
                </div>

                <div className="actions" style={{ marginTop: 20 }}>
                  <button type="button" className="primary" onClick={handleNextStep}>
                    {questionIndex >= form.count ? 'Complete Assessment & View Report →' : 'Next Question →'}
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : null}
      </div>
    );
  }

  // RENDER: Final Results Report
  if (finalReport) {
    const accuracy = finalReport.totalQuestions > 0
      ? Math.round((finalReport.correctCount / finalReport.totalQuestions) * 100)
      : 0;

    return (
      <div style={{ maxWidth: 940, margin: '20px auto' }}>
        {/* Results Hero Header */}
        <div className="asmt-results-hero">
          {/* Score Box */}
          <div className="asmt-score-box">
            <span style={{ fontSize: '.88rem', textTransform: 'uppercase', letterSpacing: '.08em', color: '#93c5fd' }}>
              Skill Assessment Complete
            </span>
            <h1 style={{ color: '#fff', fontSize: '1.8rem', margin: '6px 0 2px' }}>
              {finalReport.skill}
            </h1>
            <div className="asmt-score-big">
              {finalReport.score}%
            </div>
            <p style={{ margin: 0, color: '#d1fae5', fontSize: '.95rem' }}>
              {finalReport.score >= 85 ? 'Exceptional Mastery Level' : finalReport.score >= 70 ? 'Verified Proficient' : finalReport.score >= 50 ? 'Developing Competency' : 'Foundational Stage'}
            </p>
            <div className="small muted" style={{ color: '#9ca3af', marginTop: 12 }}>
              {finalReport.correctCount} of {finalReport.totalQuestions} questions met passing criteria ({accuracy}% accuracy).
            </div>
          </div>

          {/* Rewards Summary Box */}
          <div className="asmt-rewards-box">
            <h3 style={{ margin: '0 0 14px', fontSize: '1.1rem' }}>Session Rewards & Stats</h3>
            <div className="cards" style={{ margin: '0 0 14px', gridTemplateColumns: '1fr 1fr' }}>
              <div className="card stat" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', padding: 14 }}>
                <small>XP Gained</small>
                <b style={{ color: '#15803d' }}>+{finalReport.sessionXp}</b>
              </div>
              <div className="card stat" style={{ background: '#fff7ed', borderColor: '#fed7aa', padding: 14 }}>
                <small>Best Streak</small>
                <b style={{ color: '#c2410c' }}>{finalReport.maxStreak} 🔥</b>
              </div>
            </div>

            <div className="asmt-breakdown-row">
              <span className="muted">Total Lifetime XP</span>
              <strong>{rewards.totalXp} XP</strong>
            </div>
            <div className="asmt-breakdown-row">
              <span className="muted">Difficulty Trajectory</span>
              <span className="small">{finalReport.difficultyPath?.join(' → ')}</span>
            </div>
            <div className="asmt-breakdown-row">
              <span className="muted">Skill Gap Status</span>
              <span className="tag ok">Updated & Verified</span>
            </div>
          </div>
        </div>

        {/* Unlocked Badges Section */}
        {newlyUnlockedBadges.length > 0 && (
          <section className="card" style={{ borderColor: 'var(--pri)', background: '#f8fdfb', marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🏆</span> Badges Unlocked This Session!
            </h3>
            <p className="muted small" style={{ margin: '0 0 14px' }}>
              Earned through genuine performance and verified trigger thresholds.
            </p>
            <div className="asmt-badge-grid">
              {newlyUnlockedBadges.map((badge) => (
                <div key={badge.id} className="asmt-badge-card newly-unlocked">
                  <span className="asmt-badge-icon">{badge.icon}</span>
                  <div>
                    <strong style={{ display: 'block', fontSize: '.95rem' }}>{badge.name}</strong>
                    <p className="small muted" style={{ margin: '4px 0 0' }}>{badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Performance Insights & Improvement Plan */}
        <section className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.25rem' }}>Assessment Performance Report</h2>
          <p style={{ lineHeight: 1.6, fontSize: '.98rem' }}>{finalReport.overallSummary}</p>

          <div className="grid2" style={{ marginTop: 18, gap: 18 }}>
            <div className="card" style={{ margin: 0, background: '#f8faf9', borderColor: '#d1fae5' }}>
              <h3 style={{ color: '#065f46', margin: '0 0 8px' }}>Verified Strengths</h3>
              {finalReport.strengths?.length ? (
                <ul style={{ paddingLeft: 18, margin: 0, fontSize: '.92rem', lineHeight: 1.6 }}>
                  {finalReport.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              ) : (
                <p className="small muted">Strengths are still developing.</p>
              )}
            </div>

            <div className="card" style={{ margin: 0, background: '#fffaf8', borderColor: '#fed7aa' }}>
              <h3 style={{ color: '#9a3412', margin: '0 0 8px' }}>Target Areas to Improve</h3>
              {finalReport.weaknesses?.length ? (
                <ul style={{ paddingLeft: 18, margin: 0, fontSize: '.92rem', lineHeight: 1.6 }}>
                  {finalReport.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              ) : (
                <p className="small muted">No major weaknesses detected! Excellent work.</p>
              )}
            </div>
          </div>

          <div style={{ marginTop: 18, padding: 16, background: '#f6faf9', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem', color: 'var(--pri)' }}>Concrete Action Plan:</h3>
            <ol style={{ paddingLeft: 20, margin: 0, fontSize: '.92rem', lineHeight: 1.7 }}>
              {finalReport.improvementSuggestions?.map((item, idx) => (
                <li key={idx}><strong>{item}</strong></li>
              ))}
            </ol>
          </div>
        </section>

        {/* Detailed Question Review Toggle */}
        <div style={{ marginBottom: 20 }}>
          <button
            type="button"
            className="btn"
            style={{ width: '100%', padding: '12px', background: '#fff', fontWeight: 600 }}
            onClick={() => setShowDetailedReview(!showDetailedReview)}
          >
            {showDetailedReview ? 'Hide Question-by-Question Transcript ▲' : 'View Question-by-Question Transcript ▼'}
          </button>
        </div>

        {showDetailedReview && (
          <section className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 14 }}>Full Session Transcript</h3>
            {finalReport.questions?.map((item, idx) => (
              <div key={idx} style={{
                padding: '14px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                marginBottom: 12,
                background: item.isCorrect ? '#fcfdfc' : '#fffdfd',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>
                    Q{item.index}: {item.topic} ({item.questionType})
                  </span>
                  <span className={`tag ${item.isCorrect ? 'ok' : 'low'}`}>
                    Score: {item.score}% ({item.quality})
                  </span>
                </div>
                <p style={{ margin: '6px 0', fontSize: '.92rem' }}>{item.question}</p>
                <div style={{ background: '#f1f5f9', padding: '8px 12px', borderRadius: 6, fontSize: '.86rem', margin: '8px 0' }}>
                  <strong>Your Answer:</strong> {item.userAnswer}
                </div>
                <p className="small muted" style={{ margin: '4px 0 0' }}>
                  <strong>AI Feedback:</strong> {item.evaluation?.explanation}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* Navigation & Next Actions */}
        <div className="actions" style={{ gap: 12 }}>
          <button
            type="button"
            className="primary"
            style={{ flex: 1, padding: 14 }}
            onClick={() => {
              setFinalReport(null);
              setSessionActive(false);
            }}
          >
            Take Another Assessment
          </button>
          <Link to="/skill-gap" className="btn" style={{ padding: 14, textAlign: 'center' }}>
            Check Skill Gap Report →
          </Link>
        </div>
      </div>
    );
  }

  // RENDER: Setup & Start Screen
  return (
    <div style={{ maxWidth: 880, margin: '20px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.85rem' }}>Skill Assessment</h1>
          <p className="muted" style={{ margin: '6px 0 0', maxWidth: 580 }}>
            Live adaptive assessment with dynamic formats (MCQ, short answer, code debugging, and scenario judgment) powered by Groq AI.
          </p>
        </div>

        {/* Lifetime Rewards Header Widget */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="asmt-xp-badge" title="Lifetime SkillForge XP">
            ⚡ {rewards.totalXp} XP
          </span>
          <span className="asmt-streak-badge" title="Best Streak Achieved">
            🔥 Best: {rewards.maxStreak}
          </span>
        </div>
      </div>

      <div className="grid2" style={{ gap: 20, alignItems: 'start' }}>
        {/* Left: Configuration Card */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Configure Assessment</h2>

          {errorMessage && (
            <div style={{ background: '#fff5f2', border: '1px solid var(--warm)', padding: 12, borderRadius: 8, color: 'var(--warm)', fontSize: '.88rem' }}>
              <strong>Notice:</strong> {errorMessage}
            </div>
          )}

          <label>
            <span>Target Skill</span>
            <select
              value={form.skill}
              onChange={(e) => setForm({ ...form, skill: e.target.value })}
            >
              {availableSkills.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Starting Difficulty</span>
            <select
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
            >
              <option value="easy">Easy (Fundamentals & Core Recall)</option>
              <option value="medium">Medium (Standard Practical Application)</option>
              <option value="hard">Hard (Complex Architecture & Nuance)</option>
            </select>
          </label>

          <label>
            <span>Number of Questions</span>
            <select
              value={form.count}
              onChange={(e) => setForm({ ...form, count: Number(e.target.value) })}
            >
              <option value={3}>3 Questions (Quick Skill Check)</option>
              <option value={5}>5 Questions (Comprehensive Rigor)</option>
              <option value={6}>6 Questions (Deep Mastery Drill)</option>
            </select>
          </label>

          <button
            type="button"
            className="primary"
            onClick={handleStartAssessment}
            disabled={isLoadingQuestion}
            style={{ marginTop: 8, padding: 13, fontSize: '.96rem' }}
          >
            {isLoadingQuestion ? 'Starting Assessment…' : 'Start Live Assessment'}
          </button>
        </section>

        {/* Right: How It Works & Unlocked Badges */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="card" style={{ margin: 0, background: '#f8faf9' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '1rem', color: 'var(--pri)' }}>How This Assessment Works</h3>
            <ul style={{ paddingLeft: 18, margin: 0, fontSize: '.88rem', lineHeight: 1.6, color: '#334155' }}>
              <li><strong>Dynamic Formats:</strong> The AI decides the optimal format per question — MCQ, written reasoning, code debugging, or practical scenario.</li>
              <li><strong>Adaptive Progression:</strong> Question difficulty adjusts live based on your actual demonstrated reasoning.</li>
              <li><strong>Genuine AI Grading:</strong> Written and code answers are graded on actual depth and root-cause understanding, never keyword matching.</li>
              <li><strong>Permanent Skill Sync:</strong> Results automatically update your Skill Gap analysis and verified Skill Profile.</li>
            </ul>
          </section>

          {/* Catalog of Unlocked Badges */}
          <section className="card" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Earned Badges ({rewards.unlockedBadges.length})</h3>
              <span className="small muted">Catalog: {BADGES_CATALOG.length}</span>
            </div>

            {rewards.unlockedBadges.length === 0 ? (
              <p className="small muted" style={{ margin: '8px 0 0' }}>
                No badges earned yet. Complete an assessment with high accuracy, strong written depth, or code mastery to unlock your first achievement!
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {rewards.unlockedBadges.map((badge, idx) => (
                  <span
                    key={idx}
                    className="tag ok"
                    style={{ padding: '6px 12px', fontSize: '.84rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    title={badge.description}
                  >
                    <span>{badge.icon}</span>
                    <strong>{badge.name}</strong>
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
