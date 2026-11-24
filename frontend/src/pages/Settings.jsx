import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useSettings, DEFAULT_SETTINGS } from '../context/SettingsContext';
import { progressService } from '../services/progressService';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'goals', label: 'Goals & Preferences', icon: '🎯' },
  { id: 'data', label: 'Data & Privacy', icon: '🔒' },
  { id: 'accessibility', label: 'Accessibility', icon: '♿' },
  { id: 'about', label: 'About', icon: 'ℹ️' },
];

const ROLES = [
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'Python Developer',
  'Java Developer',
  'Data Analyst',
  'AI/ML Engineer',
];

const PROGRAMMING_LANGUAGES = [
  { id: 'javascript', label: 'JavaScript (Node / React)' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'c++', label: 'C++' },
  { id: 'go', label: 'Go (Golang)' },
  { id: 'sql', label: 'SQL' },
];

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const {
    settings,
    updateSection,
    resetSection,
    resetAll,
    exportSettings,
    importSettings,
    accentPalettes,
  } = useSettings();

  const [activeTab, setActiveTab] = useState('profile');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInputText, setDeleteInputText] = useState('');
  const [inlineErrors, setInlineErrors] = useState({});

  const fileInputRef = useRef(null);

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    displayName: settings.profile.displayName || user?.name || '',
    avatarUrl: settings.profile.avatarUrl || user?.photoUrl || '',
    targetRole: settings.profile.targetRole || user?.targetRole || 'Full Stack Developer',
    college: settings.profile.college || user?.college || '',
    bio: settings.profile.bio || '',
  });

  const handleProfileSave = (e) => {
    e.preventDefault();
    if (!profileForm.displayName.trim()) {
      setInlineErrors({ displayName: 'Display name cannot be empty.' });
      return;
    }
    setInlineErrors({});

    updateSection('profile', profileForm);
    if (updateUser) {
      updateUser({
        name: profileForm.displayName.trim(),
        targetRole: profileForm.targetRole,
        college: profileForm.college,
        photoUrl: profileForm.avatarUrl,
      });
    }
    toast.success('Profile settings updated successfully!');
  };

  // Export JSON (Settings + Progress)
  const handleExportJson = () => {
    try {
      const fullBackup = {
        exportedAt: new Date().toISOString(),
        version: '0.2.0',
        user: {
          name: user?.name,
          email: user?.email,
          targetRole: user?.targetRole,
        },
        settings,
        progress: progressService.getState(),
      };

      const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `skillforge_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported complete data backup (JSON).');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export data.');
    }
  };

  // Export CSV (Activity History)
  const handleExportCsv = () => {
    try {
      const csv = progressService.exportToCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `skillforge_activities_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported activity log (CSV).');
    } catch (err) {
      console.error('CSV Export error:', err);
      toast.error('Failed to export CSV.');
    }
  };

  // Import JSON file
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        const parsed = JSON.parse(content);

        if (parsed.settings) {
          importSettings(JSON.stringify(parsed.settings));
        } else {
          importSettings(content);
        }

        if (parsed.progress) {
          progressService.saveState(parsed.progress);
          toast.success('Imported progress history.');
        }

        e.target.value = '';
      } catch (err) {
        console.error('Import parse error:', err);
        toast.error('Invalid backup file. Could not import.');
      }
    };
    reader.readAsText(file);
  };

  // Clear Progress
  const handleConfirmClearProgress = () => {
    progressService.clearProgress();
    setShowClearConfirm(false);
    toast.success('Learning progress and activity history reset.');
  };

  // Delete All Data & Account
  const handleConfirmDeleteAll = () => {
    if (deleteInputText.trim() !== 'DELETE') {
      toast.error('Please type DELETE to confirm.');
      return;
    }
    progressService.clearProgress();
    resetAll();
    setShowDeleteConfirm(false);
    toast.success('All local data cleared. Logging out…');
    setTimeout(() => {
      logout();
    }, 1000);
  };

  const getInitials = (name) => {
    if (!name) return 'SF';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1>Settings & Preferences</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Customize your learning experience, appearance, goals, accessibility, and data.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (window.confirm('Reset ALL settings across all sections to factory defaults?')) {
              resetAll();
            }
          }}
          style={{ fontSize: '.84rem' }}
        >
          Reset All Settings
        </button>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="settings-nav" role="tablist">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={activeTab === s.id}
            className={`settings-tab-btn ${activeTab === s.id ? 'active' : ''}`}
            onClick={() => setActiveTab(s.id)}
          >
            <span style={{ marginRight: 6 }}>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* SECTION 1: PROFILE */}
      {activeTab === 'profile' && (
        <form onSubmit={handleProfileSave} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h2>Personal Profile</h2>
            <button
              type="button"
              className="btn"
              style={{ fontSize: '.82rem', padding: '6px 12px' }}
              onClick={() => {
                resetSection('profile');
                setProfileForm({
                  displayName: DEFAULT_SETTINGS.profile.displayName,
                  avatarUrl: DEFAULT_SETTINGS.profile.avatarUrl,
                  targetRole: DEFAULT_SETTINGS.profile.targetRole,
                  college: DEFAULT_SETTINGS.profile.college,
                  bio: DEFAULT_SETTINGS.profile.bio,
                });
              }}
            >
              Reset to defaults
            </button>
          </div>

          {/* Avatar Preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 24, padding: 16, background: 'var(--pri-subtle)', borderRadius: 14 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'var(--pri-gradient)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: '1.4rem',
                fontWeight: 800,
                overflow: 'hidden',
                flexShrink: 0,
                boxShadow: '0 4px 14px var(--pri-shadow)',
              }}
            >
              {profileForm.avatarUrl ? (
                <img
                  src={profileForm.avatarUrl}
                  alt={profileForm.displayName || 'Avatar'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                getInitials(profileForm.displayName || user?.name)
              )}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--ink)' }}>
                {profileForm.displayName || user?.name || 'SkillForge Student'}
              </div>
              <div className="muted small" style={{ marginTop: 2 }}>
                {user?.email || 'Logged in user'} • {profileForm.targetRole}
              </div>
            </div>
          </div>

          <div className="grid2" style={{ marginBottom: 16 }}>
            <label>
              Display Name *
              <input
                type="text"
                value={profileForm.displayName}
                onChange={(e) => {
                  setProfileForm({ ...profileForm, displayName: e.target.value });
                  if (inlineErrors.displayName) setInlineErrors({});
                }}
                placeholder="e.g. Jane Doe"
              />
              {inlineErrors.displayName && (
                <span style={{ color: 'var(--pri)', fontSize: '.8rem', marginTop: 2 }}>{inlineErrors.displayName}</span>
              )}
            </label>

            <label>
              Account Email
              <input
                type="email"
                value={user?.email || 'student@skillforge.ai'}
                disabled
                style={{ opacity: 0.7, cursor: 'not-allowed' }}
                title="Email is bound to your account credentials"
              />
            </label>
          </div>

          <div className="grid2" style={{ marginBottom: 16 }}>
            <label>
              Target Career Role
              <select
                value={profileForm.targetRole}
                onChange={(e) => setProfileForm({ ...profileForm, targetRole: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>

            <label>
              College / University
              <input
                type="text"
                value={profileForm.college}
                onChange={(e) => setProfileForm({ ...profileForm, college: e.target.value })}
                placeholder="e.g. Stanford University"
              />
            </label>
          </div>

          <label style={{ marginBottom: 16 }}>
            Avatar Image URL (Optional)
            <input
              type="url"
              value={profileForm.avatarUrl}
              onChange={(e) => setProfileForm({ ...profileForm, avatarUrl: e.target.value })}
              placeholder="https://example.com/avatar.jpg"
            />
          </label>

          <label style={{ marginBottom: 22 }}>
            Short Bio / Learning Objective
            <textarea
              rows={3}
              value={profileForm.bio}
              onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              placeholder="Aspiring Full Stack Engineer preparing for summer 2026 internships..."
            />
          </label>

          <button type="submit" className="primary">
            Save Profile Settings
          </button>
        </form>
      )}

      {/* SECTION 2: APPEARANCE */}
      {activeTab === 'appearance' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h2>Appearance & Theme</h2>
            <button
              type="button"
              className="btn"
              style={{ fontSize: '.82rem', padding: '6px 12px' }}
              onClick={() => resetSection('appearance')}
            >
              Reset to defaults
            </button>
          </div>

          {/* Theme Selector */}
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Color Theme</span>
              <span className="settings-row-desc">Select light, dark, or sync with your operating system preference.</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['light', 'dark', 'system'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => updateSection('appearance', { theme: t })}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    border: '1.5px solid',
                    borderColor: settings.appearance.theme === t ? 'var(--pri)' : 'var(--line)',
                    background: settings.appearance.theme === t ? 'var(--pri-subtle)' : 'var(--card)',
                    color: settings.appearance.theme === t ? 'var(--pri)' : 'var(--ink)',
                  }}
                >
                  {t === 'light' ? '☀️ Light' : t === 'dark' ? '🌙 Dark' : '💻 System'}
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color Palette */}
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Accent Color</span>
              <span className="settings-row-desc">Changes primary action buttons, active badges, and focus rings.</span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(accentPalettes).map(([k, p]) => (
                <button
                  key={k}
                  type="button"
                  title={p.label}
                  onClick={() => updateSection('appearance', { accentColor: k })}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: p.priGradient,
                    border: settings.appearance.accentColor === k ? '3px solid var(--ink)' : '2px solid transparent',
                    boxShadow: settings.appearance.accentColor === k ? '0 0 0 2px var(--pri)' : 'none',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  {settings.appearance.accentColor === k && (
                    <span style={{ color: '#fff', fontSize: '1rem', fontWeight: 900 }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Font Size Scaling</span>
              <span className="settings-row-desc">Adjust UI text size for improved readability.</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { id: 'small', label: 'Small (92%)' },
                { id: 'medium', label: 'Default (100%)' },
                { id: 'large', label: 'Large (108%)' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => updateSection('appearance', { fontSize: s.id })}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: '.85rem',
                    border: '1.5px solid',
                    borderColor: settings.appearance.fontSize === s.id ? 'var(--pri)' : 'var(--line)',
                    background: settings.appearance.fontSize === s.id ? 'var(--pri-subtle)' : 'var(--card)',
                    color: settings.appearance.fontSize === s.id ? 'var(--pri)' : 'var(--ink)',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reduced Motion */}
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Reduced Motion</span>
              <span className="settings-row-desc">Disables transitions, celebratory animations, and skeleton pulses.</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.appearance.reducedMotion}
                onChange={(e) => updateSection('appearance', { reducedMotion: e.target.checked })}
              />
              <span className="slider" />
            </label>
          </div>
        </div>
      )}

      {/* SECTION 3: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h2>Notifications & Reminders</h2>
            <button
              type="button"
              className="btn"
              style={{ fontSize: '.82rem', padding: '6px 12px' }}
              onClick={() => resetSection('notifications')}
            >
              Reset to defaults
            </button>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Enable Daily Practice Reminders</span>
              <span className="settings-row-desc">Receive gentle daily alerts to maintain your preparation streak.</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.notifications.enabled}
                onChange={(e) => updateSection('notifications', { enabled: e.target.checked })}
              />
              <span className="slider" />
            </label>
          </div>

          {settings.notifications.enabled && (
            <>
              <div className="settings-row">
                <div className="settings-row-info">
                  <span className="settings-row-title">Reminder Preferred Time</span>
                  <span className="settings-row-desc">When should SkillForge nudge you to practice?</span>
                </div>
                <input
                  type="time"
                  value={settings.notifications.reminderTime}
                  onChange={(e) => updateSection('notifications', { reminderTime: e.target.value })}
                  style={{ width: 140 }}
                />
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <span className="settings-row-title">Reminder Frequency</span>
                  <span className="settings-row-desc">Days you want to receive study nudges.</span>
                </div>
                <select
                  value={settings.notifications.frequency}
                  onChange={(e) => updateSection('notifications', { frequency: e.target.value })}
                  style={{ width: 180 }}
                >
                  <option value="daily">Every Day</option>
                  <option value="weekdays">Weekdays Only (Mon-Fri)</option>
                  <option value="weekly">Once a Week</option>
                </select>
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <span className="settings-row-title">Quiet Hours</span>
                  <span className="settings-row-desc">Mute all alert sounds and notifications during rest hours.</span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.notifications.quietHoursEnabled}
                    onChange={(e) => updateSection('notifications', { quietHoursEnabled: e.target.checked })}
                  />
                  <span className="slider" />
                </label>
              </div>

              {settings.notifications.quietHoursEnabled && (
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-title">Quiet Window (Start - End)</span>
                    <span className="settings-row-desc">No notifications will be sent during this interval.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="time"
                      value={settings.notifications.quietHoursStart}
                      onChange={(e) => updateSection('notifications', { quietHoursStart: e.target.value })}
                    />
                    <span className="muted">to</span>
                    <input
                      type="time"
                      value={settings.notifications.quietHoursEnd}
                      onChange={(e) => updateSection('notifications', { quietHoursEnd: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* SECTION 4: GOALS & PREFERENCES */}
      {activeTab === 'goals' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h2>Goals & Learning Preferences</h2>
            <button
              type="button"
              className="btn"
              style={{ fontSize: '.82rem', padding: '6px 12px' }}
              onClick={() => resetSection('goals')}
            >
              Reset to defaults
            </button>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Daily Practice Questions Target</span>
              <span className="settings-row-desc">Number of technical problems to complete each day.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min="1"
                max="50"
                value={settings.goals.dailyQuestions}
                onChange={(e) => updateSection('goals', { dailyQuestions: Math.max(1, Number(e.target.value) || 1) })}
                style={{ width: 90, textAlign: 'center' }}
              />
              <span className="muted small">questions / day</span>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Weekly Mock Interviews Target</span>
              <span className="settings-row-desc">AI technical interviews target per week.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min="1"
                max="20"
                value={settings.goals.weeklyInterviews}
                onChange={(e) => updateSection('goals', { weeklyInterviews: Math.max(1, Number(e.target.value) || 1) })}
                style={{ width: 90, textAlign: 'center' }}
              />
              <span className="muted small">interviews / week</span>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Weekly Skill Assessments Target</span>
              <span className="settings-row-desc">Adaptive multiple-choice skill tests per week.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min="1"
                max="20"
                value={settings.goals.weeklyAssessments}
                onChange={(e) => updateSection('goals', { weeklyAssessments: Math.max(1, Number(e.target.value) || 1) })}
                style={{ width: 90, textAlign: 'center' }}
              />
              <span className="muted small">tests / week</span>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Daily Target Study Time</span>
              <span className="settings-row-desc">Target active time on SkillForge in minutes.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min="10"
                max="300"
                step="5"
                value={settings.goals.studyMinutesPerDay}
                onChange={(e) => updateSection('goals', { studyMinutesPerDay: Math.max(10, Number(e.target.value) || 10) })}
                style={{ width: 90, textAlign: 'center' }}
              />
              <span className="muted small">minutes / day</span>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Primary Programming Language</span>
              <span className="settings-row-desc">Default language for coding questions and code snippet generation.</span>
            </div>
            <select
              value={settings.goals.preferredLanguage}
              onChange={(e) => updateSection('goals', { preferredLanguage: e.target.value })}
              style={{ width: 220 }}
            >
              {PROGRAMMING_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>{lang.label}</option>
              ))}
            </select>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Week Start Day</span>
              <span className="settings-row-desc">Determines how weekly streaks and chart bars are grouped.</span>
            </div>
            <select
              value={settings.goals.weekStartDay}
              onChange={(e) => updateSection('goals', { weekStartDay: e.target.value })}
              style={{ width: 160 }}
            >
              <option value="monday">Monday</option>
              <option value="sunday">Sunday</option>
            </select>
          </div>
        </div>
      )}

      {/* SECTION 5: DATA & PRIVACY */}
      {activeTab === 'data' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h2>Data & Privacy Management</h2>
            <button
              type="button"
              className="btn"
              style={{ fontSize: '.82rem', padding: '6px 12px' }}
              onClick={() => resetSection('data')}
            >
              Reset to defaults
            </button>
          </div>

          {/* Export JSON */}
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Export All Data (JSON)</span>
              <span className="settings-row-desc">Download a complete, portable backup of your settings and activity history.</span>
            </div>
            <button type="button" className="btn" onClick={handleExportJson}>
              📥 Export JSON
            </button>
          </div>

          {/* Export CSV */}
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Export Activity Log (CSV)</span>
              <span className="settings-row-desc">Download a tabular spreadsheet log of all practice, interviews, and assessments.</span>
            </div>
            <button type="button" className="btn" onClick={handleExportCsv}>
              📊 Export CSV
            </button>
          </div>

          {/* Import JSON */}
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Import Data from Backup</span>
              <span className="settings-row-desc">Restore previously exported settings and activity records.</span>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
              <button
                type="button"
                className="btn"
                onClick={() => fileInputRef.current?.click()}
              >
                📤 Import Backup
              </button>
            </div>
          </div>

          {/* Clear Progress Data */}
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title" style={{ color: '#d97706' }}>Clear Progress History</span>
              <span className="settings-row-desc">Resets all streak counters, logged activities, and milestone badges.</span>
            </div>
            <button
              type="button"
              className="btn"
              style={{ borderColor: '#d97706', color: '#d97706' }}
              onClick={() => setShowClearConfirm(true)}
            >
              Clear Progress…
            </button>
          </div>

          {/* Danger Zone: Delete Account / All Data */}
          <div className="settings-row" style={{ borderTop: '2px dashed var(--line)' }}>
            <div className="settings-row-info">
              <span className="settings-row-title" style={{ color: 'var(--pri)' }}>Danger Zone: Reset All Account Data</span>
              <span className="settings-row-desc">Permanently erases all local progress, stored credentials, and preferences.</span>
            </div>
            <button
              type="button"
              className="btn primary"
              style={{ background: 'linear-gradient(135deg, #be123c, #9f1239)' }}
              onClick={() => {
                setDeleteInputText('');
                setShowDeleteConfirm(true);
              }}
            >
              Delete All Data…
            </button>
          </div>

          {/* Clear Progress Confirmation Dialog */}
          {showClearConfirm && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.65)',
                display: 'grid',
                placeItems: 'center',
                zIndex: 1000,
                padding: 20,
              }}
            >
              <div className="card" style={{ maxWidth: 440, width: '100%', margin: 0 }}>
                <h3>Confirm Progress Reset</h3>
                <p className="muted" style={{ margin: '12px 0 20px', lineHeight: 1.5 }}>
                  Are you sure you want to clear your learning activities and streaks? This action will reset your streak counter to 0 and remove all history records.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn" onClick={() => setShowClearConfirm(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    style={{ background: '#d97706' }}
                    onClick={handleConfirmClearProgress}
                  >
                    Yes, Clear Progress
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete All Data Confirmation Dialog */}
          {showDeleteConfirm && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.75)',
                display: 'grid',
                placeItems: 'center',
                zIndex: 1000,
                padding: 20,
              }}
            >
              <div className="card" style={{ maxWidth: 460, width: '100%', margin: 0, border: '2px solid var(--pri)' }}>
                <h3 style={{ color: 'var(--pri)' }}>⚠️ Irreversible Data Reset</h3>
                <p className="muted" style={{ margin: '12px 0 16px', lineHeight: 1.5 }}>
                  This will erase all progress, session records, and settings from this browser. Type <b>DELETE</b> below to confirm.
                </p>
                <input
                  type="text"
                  value={deleteInputText}
                  onChange={(e) => setDeleteInputText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  style={{ width: '100%', marginBottom: 20 }}
                />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn" onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={deleteInputText.trim() !== 'DELETE'}
                    onClick={handleConfirmDeleteAll}
                  >
                    Confirm Permanent Reset
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 6: ACCESSIBILITY */}
      {activeTab === 'accessibility' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h2>Accessibility Options</h2>
            <button
              type="button"
              className="btn"
              style={{ fontSize: '.82rem', padding: '6px 12px' }}
              onClick={() => resetSection('accessibility')}
            >
              Reset to defaults
            </button>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">High Contrast Mode</span>
              <span className="settings-row-desc">Enhances borders and text contrast to satisfy WCAG AAA standards.</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.accessibility.highContrast}
                onChange={(e) => updateSection('accessibility', { highContrast: e.target.checked })}
              />
              <span className="slider" />
            </label>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Larger Tap Targets</span>
              <span className="settings-row-desc">Increases clickable button, input, and link heights to at least 48px.</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.accessibility.largerTapTargets}
                onChange={(e) => updateSection('accessibility', { largerTapTargets: e.target.checked })}
              />
              <span className="slider" />
            </label>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Enhanced Focus Outlines</span>
              <span className="settings-row-desc">Displays a prominent colored ring around currently focused elements for keyboard navigation.</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.accessibility.enhancedFocus}
                onChange={(e) => updateSection('accessibility', { enhancedFocus: e.target.checked })}
              />
              <span className="slider" />
            </label>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-title">Screen Reader Enhancements</span>
              <span className="settings-row-desc">Adds explicit ARIA announcements and contextual score descriptions.</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.accessibility.screenReaderOptimized}
                onChange={(e) => updateSection('accessibility', { screenReaderOptimized: e.target.checked })}
              />
              <span className="slider" />
            </label>
          </div>
        </div>
      )}

      {/* SECTION 7: ABOUT */}
      {activeTab === 'about' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: 'var(--pri-gradient)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: '1.6rem',
                fontWeight: 900,
              }}
            >
              SF
            </div>
            <div>
              <h2 style={{ margin: 0 }}>SkillForge AI</h2>
              <div className="muted small" style={{ marginTop: 2 }}>
                Version 0.2.0 • Build 2026.11
              </div>
            </div>
          </div>

          <p className="muted" style={{ lineHeight: 1.6, marginBottom: 20 }}>
            SkillForge AI is an intelligent engineering career readiness accelerator designed to test, assess, critique, and prepare candidates for technical roles.
          </p>

          <div style={{ background: 'var(--pri-subtle)', padding: 18, borderRadius: 14, marginBottom: 24 }}>
            <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Changelog — What's New</div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: '.9rem', color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li><b>Stage 5 & 6 Added:</b> Dedicated Progress Dashboard with activity heatmaps and interactive streak-freeze management.</li>
              <li><b>Full Settings Module:</b> Centralized theme switcher, accent color customization, accessibility options, and data export.</li>
              <li><b>Resilient API Client:</b> Real-time socket keep-alive synchronization, preventing cold start proxy disconnects.</li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="btn"
            >
              GitHub Repository ↗
            </a>
            <a
              href="mailto:support@skillforge.ai"
              className="btn"
            >
              Feedback & Support ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
