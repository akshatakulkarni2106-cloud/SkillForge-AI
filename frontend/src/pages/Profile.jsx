import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user: authUser, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');

  // Form State
  const [form, setForm] = useState({
    name: '',
    targetRole: '',
    college: '',
    degree: '',
    branch: '',
    year: '',
    githubUsername: '',
    photoUrl: '',
  });

  const fetchProfile = () => {
    setLoading(true);
    setError('');
    api('/user/profile')
      .then((data) => {
        setProfile(data);
        setForm({
          name: data.name || '',
          targetRole: data.targetRole || '',
          college: data.college || '',
          degree: data.degree || '',
          branch: data.branch || '',
          year: data.year ? String(data.year) : '',
          githubUsername: data.githubUsername || '',
          photoUrl: data.photoUrl || '',
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load profile details.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name cannot be empty.');
      return;
    }

    setSaving(true);
    setError('');
    setSaveSuccess('');

    const payload = {
      name: form.name.trim(),
      targetRole: form.targetRole.trim(),
      college: form.college.trim(),
      degree: form.degree.trim(),
      branch: form.branch.trim(),
      githubUsername: form.githubUsername.trim(),
      photoUrl: form.photoUrl.trim(),
    };

    if (form.year && !Number.isNaN(Number(form.year))) {
      payload.year = Number(form.year);
    }

    try {
      const updated = await api('/user/profile', {
        method: 'PUT',
        body: payload,
      });

      setProfile(updated);
      updateUser(updated);
      setSaveSuccess('Profile updated successfully!');
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to update profile. Please verify your input.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 840, margin: '24px auto', padding: '0 16px' }}>
        <div className="skeleton" style={{ height: 140, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 260 }} />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="empty" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
        <h2>Could Not Load Profile</h2>
        <p className="muted" style={{ margin: '8px 0 16px' }}>{error}</p>
        <button type="button" className="primary" onClick={fetchProfile}>
          Try Again
        </button>
      </div>
    );
  }

  const initials = (profile?.name || 'User')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div style={{ maxWidth: 880, margin: '20px auto', padding: '0 16px' }}>
      {/* Header Banner */}
      <section
        className="card"
        style={{
          padding: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
          background: 'linear-gradient(135deg, var(--card) 0%, var(--pri-subtle) 100%)',
          border: '1px solid var(--line-strong)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {profile?.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt={profile.name}
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid #ffffff',
                boxShadow: '0 4px 12px rgba(225, 29, 72, 0.15)',
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--pri), #be123c)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(225, 29, 72, 0.25)',
              }}
            >
              {initials}
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.7rem' }}>{profile?.name}</h1>
              <span className="tag ok" style={{ textTransform: 'capitalize' }}>
                {profile?.role || 'student'}
              </span>
            </div>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '1rem', fontWeight: 500 }}>
              {profile?.targetRole || 'Full Stack Developer'}
            </p>
            <small className="muted" style={{ display: 'block', marginTop: 2 }}>
              {profile?.college || 'Institution not specified'}
              {profile?.degree && ` · ${profile.degree}`}
              {profile?.branch && ` in ${profile.branch}`}
              {profile?.year && ` (Year ${profile.year})`}
            </small>
          </div>
        </div>

        <div>
          {!isEditing ? (
            <button
              type="button"
              className="primary"
              onClick={() => {
                setIsEditing(true);
                setError('');
              }}
              style={{ padding: '9px 20px', fontSize: '0.9rem' }}
            >
              ✎ Edit Profile
            </button>
          ) : (
            <button
              type="button"
              className="ghost"
              onClick={() => setIsEditing(false)}
              style={{ padding: '9px 18px', fontSize: '0.9rem' }}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </section>

      {/* Notifications */}
      {saveSuccess && (
        <div className="card" style={{ background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.35)', marginTop: 16 }}>
          <p style={{ margin: 0, color: '#10b981', fontWeight: 600 }}>✓ {saveSuccess}</p>
        </div>
      )}

      {error && (
        <div className="card" style={{ background: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.35)', marginTop: 16 }}>
          <p style={{ margin: 0, color: '#ef4444', fontWeight: 600 }}>⚠ {error}</p>
        </div>
      )}

      {/* Edit Form */}
      {isEditing && (
        <section className="card" style={{ marginTop: 20, padding: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.25rem' }}>Edit Personal & Academic Details</h2>
          <form onSubmit={handleSaveProfile}>
            <div className="grid2" style={{ gap: 16 }}>
              <div>
                <label htmlFor="form-name" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                  Full Name *
                </label>
                <input
                  id="form-name"
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleInputChange}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="form-role" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                  Target Career Role
                </label>
                <input
                  id="form-role"
                  type="text"
                  name="targetRole"
                  placeholder="e.g. Full Stack Developer, ML Engineer"
                  value={form.targetRole}
                  onChange={handleInputChange}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="form-college" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                  College / University
                </label>
                <input
                  id="form-college"
                  type="text"
                  name="college"
                  placeholder="e.g. Sample Institute of Technology"
                  value={form.college}
                  onChange={handleInputChange}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="form-degree" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                  Degree
                </label>
                <input
                  id="form-degree"
                  type="text"
                  name="degree"
                  placeholder="e.g. B.Tech, M.S., B.Sc."
                  value={form.degree}
                  onChange={handleInputChange}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="form-branch" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                  Branch / Major
                </label>
                <input
                  id="form-branch"
                  type="text"
                  name="branch"
                  placeholder="e.g. Computer Science, Information Tech"
                  value={form.branch}
                  onChange={handleInputChange}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="form-year" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                  Current Year of Study (1-5)
                </label>
                <input
                  id="form-year"
                  type="number"
                  name="year"
                  min="1"
                  max="5"
                  placeholder="3"
                  value={form.year}
                  onChange={handleInputChange}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="form-github" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                  GitHub Username
                </label>
                <input
                  id="form-github"
                  type="text"
                  name="githubUsername"
                  placeholder="e.g. octocat"
                  value={form.githubUsername}
                  onChange={handleInputChange}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="form-photo" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                  Profile Photo URL
                </label>
                <input
                  id="form-photo"
                  type="text"
                  name="photoUrl"
                  placeholder="https://example.com/avatar.jpg"
                  value={form.photoUrl}
                  onChange={handleInputChange}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="ghost"
                onClick={() => setIsEditing(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary"
                disabled={saving}
                style={{ minWidth: 140 }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Main Details View */}
      <div className="grid2" style={{ marginTop: 20, gap: 20 }}>
        {/* Account Details Card */}
        <section className="card" style={{ margin: 0, padding: '22px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>Account Information</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <small className="muted" style={{ display: 'block', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                Email Address
              </small>
              <strong style={{ fontSize: '0.95rem' }}>{profile?.email}</strong>
            </div>

            <div>
              <small className="muted" style={{ display: 'block', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                Account Role
              </small>
              <span className="tag mid" style={{ textTransform: 'capitalize', marginTop: 2 }}>
                {profile?.role || 'student'}
              </span>
            </div>

            <div>
              <small className="muted" style={{ display: 'block', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                GitHub Profile
              </small>
              {profile?.githubUsername ? (
                <a
                  href={`https://github.com/${profile.githubUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--pri)', fontWeight: 600, textDecoration: 'none' }}
                >
                  github.com/{profile.githubUsername} ↗
                </a>
              ) : (
                <span className="muted small">No GitHub linked</span>
              )}
            </div>

            <div>
              <small className="muted" style={{ display: 'block', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                Member Since
              </small>
              <span style={{ fontSize: '0.92rem' }}>
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </section>

        {/* Academic Details Card */}
        <section className="card" style={{ margin: 0, padding: '22px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>Academic Profile</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <small className="muted" style={{ display: 'block', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                College / University
              </small>
              <strong style={{ fontSize: '0.95rem' }}>{profile?.college || 'Not specified'}</strong>
            </div>

            <div className="grid2" style={{ gap: 10 }}>
              <div>
                <small className="muted" style={{ display: 'block', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Degree
                </small>
                <span style={{ fontSize: '0.92rem' }}>{profile?.degree || 'Not specified'}</span>
              </div>
              <div>
                <small className="muted" style={{ display: 'block', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Year
                </small>
                <span style={{ fontSize: '0.92rem' }}>{profile?.year ? `Year ${profile.year}` : 'Not specified'}</span>
              </div>
            </div>

            <div>
              <small className="muted" style={{ display: 'block', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                Branch / Specialization
              </small>
              <span style={{ fontSize: '0.92rem' }}>{profile?.branch || 'Not specified'}</span>
            </div>

            <div>
              <small className="muted" style={{ display: 'block', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                Target Career Path
              </small>
              <span className="tag ok" style={{ marginTop: 2 }}>
                {profile?.targetRole || 'Full Stack Developer'}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Skills Profile Section */}
      <section className="card" style={{ marginTop: 20, padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Skills & Verifications</h2>
          <Link to="/skills" className="btn" style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
            View Full Skill Matrix →
          </Link>
        </div>

        {!profile?.skills || profile.skills.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <p className="muted small">No verified skills yet.</p>
            <Link to="/resume" className="btn" style={{ fontSize: '0.85rem', marginTop: 8 }}>
              Upload Resume to Extract Skills
            </Link>
          </div>
        ) : (
          <div className="cards wideCards" style={{ marginTop: 12 }}>
            {profile.skills.map((s) => (
              <div key={s.name} className="card" style={{ margin: 0, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <strong style={{ fontSize: '0.95rem' }}>{s.name}</strong>
                  <span className={`tag ${s.verified ? 'ok' : 'mid'}`} style={{ fontSize: '0.72rem' }}>
                    {s.verified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
                <div className="bar" style={{ height: 6, margin: '8px 0' }}>
                  <i style={{ width: `${s.score}%` }} className={s.score < 50 ? 'warm' : ''} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span className="muted">{s.score}% score</span>
                  <Link to="/assessment" className="small" style={{ color: 'var(--pri)' }}>
                    Practice
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
