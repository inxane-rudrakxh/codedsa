'use client';

import { useEffect, useState } from 'react';

interface Settings {
  exam_duration_minutes: string;
  max_integrity_warnings: string;
  show_scores_immediately: string;
  questions_per_student: string;
  exam_active: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    exam_duration_minutes: '60',
    max_integrity_warnings: '3',
    show_scores_immediately: '1',
    questions_per_student: '3',
    exam_active: '1',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const getToken = () => localStorage.getItem('admin_token') || '';

  useEffect(() => {
    fetch('/api/admin/settings', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.settings) setSettings(data.settings);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ settings }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'JetBrains Mono, monospace' }}>Loading...</div>;

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <p className="text-label" style={{ marginBottom: '8px' }}>Configuration</p>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Settings</h1>
      </div>

      <div style={{ maxWidth: '560px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
          {[
            {
              label: 'Exam Active',
              description: 'Allow students to log in and take the exam',
              type: 'toggle',
              key: 'exam_active',
            },
            {
              label: 'Show Scores Immediately',
              description: 'Show students their score immediately after submission',
              type: 'toggle',
              key: 'show_scores_immediately',
            },
            {
              label: 'Exam Duration',
              description: 'Duration in minutes for each student',
              type: 'number',
              key: 'exam_duration_minutes',
              min: 10,
              max: 180,
              unit: 'minutes',
            },
            {
              label: 'Max Integrity Warnings',
              description: 'Number of warnings before notification',
              type: 'number',
              key: 'max_integrity_warnings',
              min: 1,
              max: 10,
            },
            {
              label: 'Questions Per Student',
              description: 'Number of questions assigned per student (max 9)',
              type: 'number',
              key: 'questions_per_student',
              min: 1,
              max: 9,
            },
          ].map((setting, i) => (
            <div key={setting.key} style={{
              padding: '20px',
              background: 'var(--surface-1)',
              borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '24px',
            }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '3px' }}>
                  {setting.label}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{setting.description}</p>
              </div>

              {setting.type === 'toggle' ? (
                <button
                  onClick={() => setSettings(prev => ({
                    ...prev,
                    [setting.key]: prev[setting.key as keyof Settings] === '1' ? '0' : '1',
                  }))}
                  style={{
                    width: '44px',
                    height: '24px',
                    borderRadius: '12px',
                    background: settings[setting.key as keyof Settings] === '1' ? 'var(--success)' : 'var(--border)',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    left: settings[setting.key as keyof Settings] === '1' ? '22px' : '2px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.15s ease',
                  }} />
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min={setting.min}
                    max={setting.max}
                    value={settings[setting.key as keyof Settings]}
                    onChange={e => setSettings(prev => ({ ...prev, [setting.key]: e.target.value }))}
                    style={{
                      width: '80px',
                      padding: '8px 12px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: '3px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontFamily: 'JetBrains Mono, monospace',
                      textAlign: 'center',
                      outline: 'none',
                    }}
                  />
                  {setting.unit && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{setting.unit}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '11px 24px',
              background: saving ? 'var(--surface-2)' : 'var(--text-primary)',
              border: '1px solid transparent',
              borderRadius: '3px',
              color: saving ? 'var(--text-muted)' : 'var(--bg)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && (
            <span style={{ fontSize: '12px', color: 'var(--success)', fontFamily: 'JetBrains Mono, monospace' }}>
              ✓ Settings saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
