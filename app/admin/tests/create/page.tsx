'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateTestWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createdTest, setCreatedTest] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    subject_name: '',
    description: '',
    duration_minutes: 60,
    total_marks: 30,
    target_division: '',
    start_time: '',
    end_time: '',
    questionMode: 'menu',
    
    // Configuration
    questions_per_student: 3,
    randomize_questions: true,
    allowed_languages: ['c', 'cpp', 'python', 'java'],
    max_submissions: 3,
    integrity_monitoring: true,
    auto_submit: true,
  });

  const [divisions, setDivisions] = useState<{ id: string, name: string }[]>([]);

  useEffect(() => {
    const fetchDiv = async () => {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/tests', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setDivisions(d.divisions || []);
      }
    };
    fetchDiv();
  }, []);

  const handleChange = (field: string, value: any) => {
    setFormData(p => ({ ...p, [field]: value }));
  };

  const handleCreate = async () => {
    setLoading(true);
    const token = localStorage.getItem('admin_token');
    const res = await fetch('/api/admin/tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'create_test', ...formData, instructions: formData.description }),
    });

    if (res.ok) {
      const result = await res.json();
      setCreatedTest(result.test);
      setStep(5);
    } else {
      alert('Failed to create test');
    }
    setLoading(false);
  };

  const renderProgress = () => {
    const steps = ['Details', 'Questions', 'Configuration', 'Review'];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '40px' }}>
        {steps.map((s, i) => {
          const num = i + 1;
          const active = step >= num;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                width: '24px', height: '24px', borderRadius: '50%', 
                background: active ? 'var(--accent)' : 'var(--surface-2)', 
                color: active ? '#fff' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 600
              }}>
                {num}
              </div>
              <span style={{ fontSize: '13px', fontWeight: active ? 600 : 500, color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {s}
              </span>
              {num < 4 && <div style={{ width: '40px', height: '1px', background: active ? 'var(--accent)' : 'var(--border)' }} />}
            </div>
          );
        })}
      </div>
    );
  };

  const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)', fontSize: '14px' };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {step < 5 && (
        <>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '32px' }}>
            Create Assessment
          </h1>
          {renderProgress()}
        </>
      )}

      <div style={{ background: 'var(--surface-1)', border: step < 5 ? '1px solid var(--border)' : 'none', borderRadius: '8px', padding: step < 5 ? '32px' : '0' }}>
        
        {/* STEP 1: DETAILS */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Test Name</label>
              <input value={formData.title} onChange={e => handleChange('title', e.target.value)} style={inputStyle} placeholder="e.g. Data Structures — Unit II" />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Subject</label>
                <input value={formData.subject_name} onChange={e => handleChange('subject_name', e.target.value)} style={inputStyle} placeholder="e.g. Data Structures" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Division Eligibility</label>
                <select value={formData.target_division} onChange={e => handleChange('target_division', e.target.value)} style={inputStyle}>
                  <option value="">All Divisions</option>
                  {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Description</label>
              <textarea value={formData.description} onChange={e => handleChange('description', e.target.value)} style={{ ...inputStyle, height: '100px', resize: 'vertical' }} placeholder="Provide any instructions or context..." />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Duration (minutes)</label>
                <input type="number" value={formData.duration_minutes} onChange={e => handleChange('duration_minutes', parseInt(e.target.value) || 0)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Total Marks</label>
                <input type="number" value={formData.total_marks} onChange={e => handleChange('total_marks', parseInt(e.target.value) || 0)} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Start Schedule</label>
                <input type="datetime-local" value={formData.start_time} onChange={e => handleChange('start_time', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>End Schedule</label>
                <input type="datetime-local" value={formData.end_time} onChange={e => handleChange('end_time', e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {formData.questionMode === 'menu' && (
              <>
                <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Add Questions</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                  <div style={{ padding: '24px', background: 'var(--success-dim)', border: '1px solid var(--success)', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>❖</div>
                    <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--success)' }}>9 QUESTIONS AUTOMATICALLY SELECTED</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '8px' }}>The 9 pre-seeded coding problems have been automatically attached to this assessment. <br/>When students start the test, they will receive 3 random questions out of these 9.</div>
                  </div>
                </div>
                <div style={{ textAlign: 'center', marginTop: '24px' }}>
                  <button onClick={() => setStep(3)} style={{ padding: '12px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    Continue to Configuration →
                  </button>
                </div>
              </>
            )}

            {formData.questionMode === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--surface-2)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>✦</span> GENERATE WITH AI
                  </h2>
                  <button onClick={() => handleChange('questionMode', 'menu')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                    Cancel
                  </button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Topic</label>
                    <input style={inputStyle} placeholder="e.g. Binary Search" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Difficulty</label>
                    <select style={inputStyle}>
                      <option>Easy</option>
                      <option>Medium</option>
                      <option>Hard</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Number of Questions</label>
                    <input type="number" defaultValue={5} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Marks per Question</label>
                    <input type="number" defaultValue={10} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Language</label>
                    <select style={inputStyle}>
                      <option>C++</option>
                      <option>Python</option>
                      <option>Java</option>
                      <option>C</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Additional Instructions</label>
                  <textarea style={{ ...inputStyle, height: '80px', resize: 'vertical' }} placeholder="Provide any specific context or constraints for the AI..." />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button onClick={() => {
                    alert('AI Generation initiated. (Backend generation will be connected in next phase)');
                    setStep(3);
                  }} style={{ padding: '12px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(204, 120, 92, 0.3)' }}>
                    <span>✦</span> GENERATE QUESTIONS
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: CONFIGURATION */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Questions per student</label>
                <input type="number" value={formData.questions_per_student} onChange={e => handleChange('questions_per_student', parseInt(e.target.value) || 0)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Maximum submissions</label>
                <input type="number" value={formData.max_submissions} onChange={e => handleChange('max_submissions', parseInt(e.target.value) || 0)} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Test Rules</label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.randomize_questions} onChange={e => handleChange('randomize_questions', e.target.checked)} style={{ width: '18px', height: '18px' }} />
                <span style={{ fontSize: '14px' }}>Randomize questions</span>
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.integrity_monitoring} onChange={e => handleChange('integrity_monitoring', e.target.checked)} style={{ width: '18px', height: '18px' }} />
                <span style={{ fontSize: '14px' }}>Enable integrity monitoring (tab switching detection)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.auto_submit} onChange={e => handleChange('auto_submit', e.target.checked)} style={{ width: '18px', height: '18px' }} />
                <span style={{ fontSize: '14px' }}>Auto-submit when time expires</span>
              </label>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'var(--surface-2)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>REVIEW ASSESSMENT</h2>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px' }}>{formData.title || 'Untitled Test'}</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px' }}>
                <div><span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Duration:</span> <strong>{formData.duration_minutes} minutes</strong></div>
                <div><span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Total Marks:</span> <strong>{formData.total_marks}</strong></div>
                <div><span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Eligible Division:</span> <strong>{formData.target_division || 'All Divisions'}</strong></div>
                <div><span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Questions per student:</span> <strong>{formData.questions_per_student}</strong></div>
                <div><span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Randomization:</span> <strong>{formData.randomize_questions ? 'Enabled' : 'Disabled'}</strong></div>
                <div><span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Integrity Monitoring:</span> <strong>{formData.integrity_monitoring ? 'Enabled' : 'Disabled'}</strong></div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* FOOTER ACTIONS */}
      {step < 5 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
          <button 
            onClick={() => {
              if (step > 1) setStep(step - 1);
              else router.push('/admin/dashboard');
            }} 
            style={{ padding: '12px 24px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}
          >
            {step === 1 ? 'CANCEL' : 'BACK'}
          </button>
          
          <button 
            onClick={() => {
              if (step < 4) setStep(step + 1);
              else handleCreate();
            }}
            disabled={loading}
            style={{ padding: '12px 24px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'CREATING...' : step < 4 ? 'NEXT STEP' : 'CREATE TEST'}
          </button>
        </div>
      )}

      {/* STEP 5: SUCCESS */}
      {step === 5 && createdTest && (
        <div style={{ maxWidth: '600px', margin: '40px auto 0', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--success-dim)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 24px' }}>
            ✓
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            TEST CREATED SUCCESSFULLY
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '16px' }}>
            {createdTest.title}
          </p>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '40px' }}>
            Your assessment is ready to share.
          </p>

          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '32px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '16px', textTransform: 'uppercase' }}>
              STUDENT LINK
            </p>
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px', fontSize: '16px', color: 'var(--text-primary)', fontFamily: 'Söhne Mono, ui-monospace, monospace', marginBottom: '24px', wordBreak: 'break-all' }}>
              https://code.zealindori.com/{createdTest.unique_id}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <button 
                onClick={() => navigator.clipboard.writeText(`https://code.zealindori.com/${createdTest.unique_id}`)}
                style={{ padding: '12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                COPY LINK
              </button>
              <button 
                onClick={() => router.push(`/admin/tests`)}
                style={{ padding: '12px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                OPEN TEST
              </button>
              <button 
                style={{ padding: '12px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                QR CODE
              </button>
            </div>
            
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '24px' }}>
              Students open this link to request access.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
