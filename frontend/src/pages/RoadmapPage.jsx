import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import {
  generateRoadmap,
  extractWeakSkills,
  hasUnderlyingDataChanged,
  mergeChecklistState,
  readPracticeSessionData,
  readStoredChecklist,
  readStoredRoadmap,
  readStoredSelectedSkills,
  writeStoredChecklist,
  writeStoredRoadmap,
  writeStoredSelectedSkills,
  ROADMAP_CHECKLIST_KEY,
  ROADMAP_STORAGE_KEY,
  ROADMAP_SELECTED_SKILLS_KEY,
} from '../services/roadmapService';

const buildChecklistFromRoadmap = (roadmap = null) => {
  const milestones = Array.isArray(roadmap?.milestones) ? roadmap.milestones : [];
  return Object.fromEntries(milestones.map((milestone) => [milestone.id, Boolean(milestone.status === 'done')]));
};

export default function RoadmapPage() {
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');
  const [roadmap, setRoadmap] = useState(null);
  const [checklist, setChecklist] = useState({});
  const [userData, setUserData] = useState({ skillGap: { rows: [] }, resume: { extractedSkills: [] }, practice: [] });
  const [dataChanged, setDataChanged] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [isSelectingSkills, setIsSelectingSkills] = useState(false);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [customSkills, setCustomSkills] = useState([]);

  const milestones = useMemo(() => (Array.isArray(roadmap?.milestones) ? roadmap.milestones : []), [roadmap]);
  const completedCount = useMemo(
    () => milestones.filter((milestone) => Boolean(checklist[milestone.id])).length,
    [checklist, milestones],
  );
  const progressLabel = milestones.length ? `${completedCount} of ${milestones.length} milestones complete` : 'No milestones yet';
  const progressPercent = milestones.length ? Math.round((completedCount / milestones.length) * 100) : 0;

  const weakSkills = useMemo(() => extractWeakSkills(userData.skillGap), [userData.skillGap]);

  const otherSkills = useMemo(() => {
    const weakSet = new Set(weakSkills.map((w) => w.skill.toLowerCase()));
    const customSet = new Set(customSkills.map((c) => c.toLowerCase()));
    const resumeSkills = (userData?.resume?.extractedSkills || []).filter(Boolean);
    const gapRows = (userData?.skillGap?.rows || []).map((r) => r.skill).filter(Boolean);
    const allPool = [...new Set([...gapRows, ...resumeSkills])];
    return allPool.filter((skill) => !weakSet.has(skill.toLowerCase()) && !customSet.has(skill.toLowerCase()));
  }, [weakSkills, customSkills, userData]);

  const persistChecklist = (nextChecklist) => {
    setChecklist(nextChecklist);
    writeStoredChecklist(nextChecklist);
  };

  const loadCurrentData = async () => {
    const [gapData, resumeData, practiceHistory] = await Promise.all([
      api('/skill-gap/analyze'),
      api('/resume/latest').catch(() => null),
      Promise.resolve(readPracticeSessionData()),
    ]);

    return {
      skillGap: gapData,
      resume: resumeData,
      practice: practiceHistory,
    };
  };

  const refreshRoadmap = async (nextData, preserveExistingChecklist = true, skillsToUse = selectedSkills) => {
    setRegenerating(true);
    setError('');

    try {
      const previousRoadmap = readStoredRoadmap();
      const previousChecklist = preserveExistingChecklist ? (checklist || readStoredChecklist()) : {};

      // Send completed milestones to Groq so it creates progressive, non-duplicate milestones
      const completedMilestones = (previousRoadmap?.milestones || []).filter((m) =>
        Boolean(previousChecklist[m.id])
      );

      console.log('[Roadmap] Regenerating roadmap.');
      console.log('[Roadmap] Stored data hash before generation:', previousRoadmap?.basedOnDataHash);
      console.log('[Roadmap] Selected skills passed to Groq:', skillsToUse);
      console.log('[Roadmap] Completed milestones count passed to prompt context:', completedMilestones.length);

      const nextRoadmap = await generateRoadmap(nextData, skillsToUse, {
        checklist: previousChecklist,
        completedMilestones,
      });

      console.log('[Roadmap] Fresh Groq API call succeeded. New roadmap data hash:', nextRoadmap.basedOnDataHash);

      const mergedChecklist = mergeChecklistState(previousRoadmap, nextRoadmap, previousChecklist);

      setRoadmap(nextRoadmap);
      setChecklist(mergedChecklist);
      setSelectedSkills(skillsToUse);
      setDataChanged(false);
      setIsSelectingSkills(false);

      writeStoredRoadmap(nextRoadmap);
      writeStoredChecklist(mergedChecklist);
      writeStoredSelectedSkills(skillsToUse);

      return nextRoadmap;
    } catch (err) {
      setError(err?.message || 'The roadmap could not be generated.');
      throw err;
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        setLoading(true);
        const nextData = await loadCurrentData();
        if (cancelled) return;

        setUserData(nextData);

        const storedRoadmap = readStoredRoadmap();
        const storedChecklist = readStoredChecklist();
        const storedSelectedSkills = readStoredSelectedSkills();

        const weakList = extractWeakSkills(nextData.skillGap);
        const weakNames = weakList.map((w) => w.skill);

        const hasUsefulSavedRoadmap = Boolean(
          storedRoadmap && Array.isArray(storedRoadmap.milestones) && storedRoadmap.milestones.length > 0,
        );

        if (hasUsefulSavedRoadmap) {
          const activeSkills = storedSelectedSkills.length
            ? storedSelectedSkills
            : (storedRoadmap.selectedSkills || weakNames);
          setSelectedSkills(activeSkills);
          setRoadmap(storedRoadmap);
          const currentChecklist = storedChecklist || buildChecklistFromRoadmap(storedRoadmap);
          setChecklist(currentChecklist);
          setIsSelectingSkills(false);

          // Track any custom skills previously stored
          const customAdded = activeSkills.filter(
            (s) => !nextData.skillGap?.rows?.some((r) => r.skill.toLowerCase() === s.toLowerCase()),
          );
          if (customAdded.length) {
            setCustomSkills(customAdded);
          }

          const changed = hasUnderlyingDataChanged(
            nextData,
            storedRoadmap.basedOnDataHash,
            activeSkills,
            currentChecklist,
          );
          setDataChanged(changed);
        } else {
          // Pre-generation skill selection screen
          setIsSelectingSkills(true);
          if (storedSelectedSkills.length) {
            setSelectedSkills(storedSelectedSkills);
          } else if (weakNames.length) {
            setSelectedSkills(weakNames);
          } else {
            const fallbackSkills = (nextData.resume?.extractedSkills || []).slice(0, 3);
            setSelectedSkills(fallbackSkills);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Unable to load your roadmap right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleDone = (milestone) => {
    const milestoneId = milestone.id;
    const nextChecklist = {
      ...checklist,
      [milestoneId]: !Boolean(checklist[milestoneId]),
    };

    persistChecklist(nextChecklist);
  };

  const toggleSkill = (skill) => {
    setSelectedSkills((prev) => {
      if (prev.includes(skill)) {
        return prev.filter((s) => s !== skill);
      }
      return [...prev, skill];
    });
  };

  const handleSelectAll = () => {
    const allAvailable = [
      ...new Set([
        ...weakSkills.map((w) => w.skill),
        ...customSkills,
      ]),
    ];
    setSelectedSkills(allAvailable);
  };

  const handleClearAll = () => {
    setSelectedSkills([]);
  };

  const handleAddCustomSkill = (event) => {
    if (event) event.preventDefault();
    const trimmed = customSkillInput.trim();
    if (!trimmed) return;

    if (!customSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setCustomSkills((prev) => [...prev, trimmed]);
    }
    if (!selectedSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSelectedSkills((prev) => [...prev, trimmed]);
    }
    setCustomSkillInput('');
  };

  const handleRemoveCustomSkill = (skillToRemove) => {
    setCustomSkills((prev) => prev.filter((s) => s !== skillToRemove));
    setSelectedSkills((prev) => prev.filter((s) => s !== skillToRemove));
  };

  const handleGenerateFromSelection = async () => {
    if (selectedSkills.length === 0) {
      setError('Please select at least one skill to generate your roadmap.');
      return;
    }
    try {
      const nextData = await loadCurrentData();
      setUserData(nextData);
      await refreshRoadmap(nextData, false, selectedSkills);
    } catch (err) {
      // Error handled in refreshRoadmap
    }
  };

  const handleRegenerate = async () => {
    try {
      const nextData = await loadCurrentData();
      setUserData(nextData);
      await refreshRoadmap(nextData, true, selectedSkills);
    } catch (error) {
      // Error is already surfaced.
    }
  };

  if (loading) {
    return (
      <section className="card" style={{ maxWidth: 980, margin: '24px auto', padding: '24px' }}>
        <div className="skeleton" style={{ height: 140 }} />
      </section>
    );
  }

  // View 1: Pre-generation Skill Selection Screen / Edit Skill Selection
  if (isSelectingSkills) {
    return (
      <section className="card" style={{ maxWidth: 980, margin: '24px auto', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0 }}>Select Focus Skills</h1>
            <p className="muted" style={{ margin: '8px 0 0' }}>
              Choose which weak skills from your assessment or custom technologies you want this roadmap to target.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="ghost" onClick={handleSelectAll} style={{ color: 'var(--ink)' }}>
              Select all
            </button>
            <button type="button" className="ghost" onClick={handleClearAll} style={{ color: 'var(--ink)' }}>
              Clear all
            </button>
            <span className={`tag ${selectedSkills.length > 0 ? 'ok' : 'low'}`} style={{ fontWeight: 600 }}>
              {selectedSkills.length} selected
            </span>
          </div>
        </div>

        {error && (
          <div className="card" style={{ marginTop: 18, borderColor: 'var(--warm)', background: '#fff4f0' }}>
            <strong style={{ color: 'var(--warm)' }}>Error</strong>
            <p style={{ margin: '8px 0 0' }}>{error}</p>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Weak Skills Identified from Skill Gap
          </h2>

          {!weakSkills.length ? (
            <div className="card" style={{ background: 'var(--pri-subtle)', padding: '16px' }}>
              <p className="muted" style={{ margin: 0 }}>
                No weak skills currently identified in your Skill Gap profile. You can pick from other skills or add custom skills below.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {weakSkills.map((item) => {
                const isSelected = selectedSkills.includes(item.skill);
                return (
                  <div
                    key={item.skill}
                    onClick={() => toggleSkill(item.skill)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: 10,
                      border: isSelected ? '2px solid var(--pri)' : '1px solid var(--line)',
                      background: isSelected ? '#f0fdf4' : 'var(--card)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      gap: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Row onClick handles toggle
                        style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--pri)' }}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <b style={{ fontSize: '1rem' }}>{item.skill}</b>
                          <span className={`tag ${item.status === 'improve' ? 'mid' : 'low'}`}>
                            {item.status === 'improve' ? 'To improve' : 'To learn'}
                          </span>
                        </div>
                        <span className="muted small" style={{ display: 'block', marginTop: 4 }}>
                          Current: {item.current}% / Target: {item.required}%
                        </span>
                      </div>
                    </div>
                    <div style={{ width: 120, minWidth: 80 }}>
                      <div className="bar" style={{ margin: 0, height: 8 }}>
                        <i
                          style={{ width: `${Math.min(item.current, 100)}%` }}
                          className={item.status === 'strong' ? '' : 'warm'}
                        />
                        <u style={{ left: `${Math.min(item.required, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {customSkills.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: '1rem', color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              Custom Skills Added
            </h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {customSkills.map((skill) => {
                const isSelected = selectedSkills.includes(skill);
                return (
                  <div
                    key={`custom-${skill}`}
                    onClick={() => toggleSkill(skill)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: 10,
                      border: isSelected ? '2px solid var(--pri)' : '1px solid var(--line)',
                      background: isSelected ? '#f0fdf4' : 'var(--card)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      gap: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--pri)' }}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <b style={{ fontSize: '1rem' }}>{skill}</b>
                          <span className="tag" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                            Custom
                          </span>
                        </div>
                        <span className="muted small" style={{ display: 'block', marginTop: 4 }}>
                          User-specified focus skill
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCustomSkill(skill);
                      }}
                      className="ghost"
                      style={{ padding: '4px 8px', fontSize: '0.85rem', color: 'var(--warm)', borderColor: 'transparent' }}
                      title="Remove custom skill"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: 20, background: 'var(--pri-subtle)', borderStyle: 'dashed' }}>
          <label htmlFor="custom-skill-input" style={{ fontWeight: 600, marginBottom: 8 }}>
            Add a custom skill or technology
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              id="custom-skill-input"
              type="text"
              placeholder="e.g. Docker, GraphQL, System Design, Rust..."
              value={customSkillInput}
              onChange={(e) => setCustomSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomSkill();
                }
              }}
              style={{ flex: 1, minWidth: 220 }}
            />
            <button
              type="button"
              onClick={handleAddCustomSkill}
              disabled={!customSkillInput.trim()}
              style={{ whiteSpace: 'nowrap' }}
            >
              + Add skill
            </button>
          </div>
        </div>

        {otherSkills.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <span className="muted small" style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>
              Other available skills from your profile:
            </span>
            <div className="chips">
              {otherSkills.map((skill) => {
                const isSelected = selectedSkills.includes(skill);
                return (
                  <span
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    style={{
                      cursor: 'pointer',
                      border: isSelected ? '1px solid var(--pri)' : '1px solid var(--line)',
                      background: isSelected ? 'var(--pri)' : '#f4f5f2',
                      color: isSelected ? '#fff' : 'var(--ink)',
                      userSelect: 'none',
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {skill}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {selectedSkills.length === 0 && (
          <div className="card" style={{ marginTop: 18, borderColor: 'var(--warm)', background: '#fff7ee' }}>
            <strong style={{ color: 'var(--warm)' }}>Selection required</strong>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              Please select at least one skill to generate your learning roadmap.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {roadmap?.milestones?.length > 0 && (
            <button
              type="button"
              onClick={() => setIsSelectingSkills(false)}
              disabled={regenerating}
              style={{ minWidth: 120 }}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className="primary"
            onClick={handleGenerateFromSelection}
            disabled={regenerating || selectedSkills.length === 0}
            style={{ minWidth: 200, width: 'auto' }}
          >
            {regenerating ? 'Generating roadmap…' : `Generate Roadmap (${selectedSkills.length})`}
          </button>
        </div>
      </section>
    );
  }

  // View 2: Generated Roadmap View
  return (
    <section className="card" style={{ maxWidth: 980, margin: '24px auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1 style={{ margin: 0 }}>Learning Roadmap</h1>
          {roadmap?.summary && <p className="muted" style={{ margin: '8px 0 0' }}>{roadmap.summary}</p>}
          {selectedSkills.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="muted small" style={{ fontWeight: 600 }}>Focus skills:</span>
              <div className="chips">
                {selectedSkills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setIsSelectingSkills(true)}
            disabled={regenerating}
          >
            Edit skill selection
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleRegenerate}
            disabled={regenerating || selectedSkills.length === 0}
            style={{ width: 'auto' }}
          >
            {regenerating ? 'Refreshing…' : 'Regenerate roadmap'}
          </button>
        </div>
      </div>

      {dataChanged && (
        <div className="card" style={{ marginTop: 18, borderColor: 'var(--warm)', background: '#fff7ee' }}>
          <strong style={{ color: 'var(--warm)' }}>
            Your skill data has changed since this roadmap was generated — regenerate for an updated plan?
          </strong>
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" className="primary" onClick={handleRegenerate} disabled={regenerating} style={{ width: 'auto' }}>
              Regenerate
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="card" style={{ marginTop: 18, borderColor: 'var(--warm)', background: '#fff4f0' }}>
          <strong style={{ color: 'var(--warm)' }}>Error</strong>
          <p style={{ margin: '8px 0 0' }}>{error}</p>
        </div>
      )}

      <div className="card" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <strong>{progressLabel}</strong>
          <span className="muted small">{progressPercent}% complete</span>
        </div>
        <div className="bar" style={{ marginTop: 12 }}>
          <i style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {!milestones.length ? (
        <div className="card" style={{ marginTop: 18 }}>
          <p className="muted">Your current data does not yet produce a roadmap. Choose skills above to generate a plan.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>
          {milestones.map((milestone) => {
            const isDone = Boolean(checklist[milestone.id]);
            const statusLabel = isDone ? 'done' : String(milestone.status || 'not_started');

            return (
              <div key={milestone.id} className="card" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{milestone.title}</h3>
                    <p className="muted small" style={{ margin: '6px 0 0' }}>{milestone.skill}</p>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                    <input type="checkbox" checked={isDone} onChange={() => handleToggleDone(milestone)} />
                    Done
                  </label>
                </div>

                <p style={{ marginTop: 12, lineHeight: 1.6 }}>{milestone.reason}</p>

                <div className="grid2" style={{ marginTop: 12, gap: 10 }}>
                  <div className="card" style={{ margin: 0, padding: '12px 14px' }}>
                    <small className="muted">Estimated time</small>
                    <div style={{ marginTop: 4, fontWeight: 600 }}>{milestone.estimatedTime}</div>
                  </div>
                  <div className="card" style={{ margin: 0, padding: '12px 14px' }}>
                    <small className="muted">Status</small>
                    <div style={{ marginTop: 4, fontWeight: 600 }}>{statusLabel}</div>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <strong>Suggested resources</strong>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                    {(milestone.resources || []).map((resource) => (
                      <li key={`${milestone.id}-${resource}`}>{resource}</li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

