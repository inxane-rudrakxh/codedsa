'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Check, Code2, BookOpen, Puzzle } from 'lucide-react';

export default function CreateTestWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createdTest, setCreatedTest] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    test_mode: 'CODING' as 'CODING' | 'QUIZ' | 'PUZZLE',
    bank_id: '',
    subject_name: 'DSA',
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
  const [questionBanks, setQuestionBanks] = useState<any[]>([]);

  useEffect(() => {
    const fetchInitData = async () => {
      const token = localStorage.getItem('admin_token');
      // Fetch divisions
      try {
        const res = await fetch('/api/admin/tests', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const d = await res.json();
          setDivisions(d.divisions || []);
        }
      } catch (err) {
        console.error(err);
      }

      // Fetch question banks
      try {
        const resQb = await fetch('/api/admin/questions', { headers: { Authorization: `Bearer ${token}` } });
        if (resQb.ok) {
          const dQb = await resQb.json();
          setQuestionBanks(dQb.questionBanks || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchInitData();
  }, []);

  const handleChange = (field: string, value: any) => {
    setFormData(p => ({ ...p, [field]: value }));
  };

  const handleSelectBank = (bank: any) => {
    setFormData(p => ({
      ...p,
      bank_id: bank.id,
      title: p.title || bank.name,
      total_marks: bank.total_marks || p.total_marks,
      duration_minutes: bank.duration_minutes || p.duration_minutes,
      questions_per_student: bank._count?.quizQuestions || p.questions_per_student,
    }));
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      alert('Please enter a test title');
      return;
    }
    setLoading(true);
    const token = localStorage.getItem('admin_token');
    
    let payload = { 
      action: 'create_test', 
      ...formData, 
      test_type: formData.test_mode,
      instructions: formData.description 
    };
    if (payload.start_time) {
      payload.start_time = new Date(payload.start_time).toISOString();
    }
    if (payload.end_time) {
      payload.end_time = new Date(payload.end_time).toISOString();
    }
    
    const res = await fetch('/api/admin/tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const result = await res.json();
      setCreatedTest(result.test);
      setStep(5);
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to create test');
    }
    setLoading(false);
  };

  const renderProgress = () => {
    const steps = ['Details & Mode', 'Questions Selection', 'Configuration', 'Review & Publish'];
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

  // Filter banks matching current mode
  const filteredBanks = questionBanks.filter(b => {
    if (formData.test_mode === 'PUZZLE') return b.category === 'PUZZLE' || b.name.toLowerCase().includes('puzzle');
    if (formData.test_mode === 'QUIZ') return b.category === 'QUIZ' || !b.name.toLowerCase().includes('puzzle');
    return true;
  });

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', paddingBottom: '60px' }}>
      {step < 5 && (
        <>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '32px' }}>
            Create Assessment Test
          </h1>
          {renderProgress()}
        </>
      )}

      <div style={{ background: 'var(--surface-1)', border: step < 5 ? '1px solid var(--border)' : 'none', borderRadius: '8px', padding: step < 5 ? '32px' : '0' }}>
        
        {/* STEP 1: TEST MODE & DETAILS */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Test Mode Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', letterSpacing: '0.02em' }}>
                SELECT TEST MODE
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                {/* Coding Test */}
                <div
                  onClick={() => {
                    handleChange('test_mode', 'CODING');
                    handleChange('bank_id', '');
                    if (formData.duration_minutes === 20 || formData.duration_minutes === 30) handleChange('duration_minutes', 60);
                  }}
                  style={{
                    padding: '18px',
                    borderRadius: '8px',
                    border: `2px solid ${formData.test_mode === 'CODING' ? 'var(--accent)' : 'var(--border)'}`,
                    background: formData.test_mode === 'CODING' ? 'var(--surface-2)' : 'var(--surface-1)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Code2 size={20} color={formData.test_mode === 'CODING' ? 'var(--accent)' : 'var(--text-secondary)'} />
                    <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>Coding Test</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    Algorithmic coding with Monaco editor, compiler, hidden testcases, and multi-language support.
                  </p>
                </div>

                {/* Quiz Test */}
                <div
                  onClick={() => {
                    handleChange('test_mode', 'QUIZ');
                    if (formData.duration_minutes === 60) handleChange('duration_minutes', 20);
                  }}
                  style={{
                    padding: '18px',
                    borderRadius: '8px',
                    border: `2px solid ${formData.test_mode === 'QUIZ' ? 'var(--accent)' : 'var(--border)'}`,
                    background: formData.test_mode === 'QUIZ' ? 'var(--surface-2)' : 'var(--surface-1)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <BookOpen size={20} color={formData.test_mode === 'QUIZ' ? 'var(--accent)' : 'var(--text-secondary)'} />
                    <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>Quiz Test</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    Conceptual, theory, multiple-choice & short answer questions (e.g. Unit IV Stacks & Recursion).
                  </p>
                </div>

                {/* Puzzle Test */}
                <div
                  onClick={() => {
                    handleChange('test_mode', 'PUZZLE');
                    if (formData.duration_minutes === 60) handleChange('duration_minutes', 30);
                  }}
                  style={{
                    padding: '18px',
                    borderRadius: '8px',
                    border: `2px solid ${formData.test_mode === 'PUZZLE' ? 'var(--accent)' : 'var(--border)'}`,
                    background: formData.test_mode === 'PUZZLE' ? 'var(--surface-2)' : 'var(--surface-1)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Puzzle size={20} color={formData.test_mode === 'PUZZLE' ? 'var(--accent)' : 'var(--text-secondary)'} />
                    <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>Puzzle Test</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    Visual pointer tracing, output prediction, and code structure challenges (e.g. Unit III Linked Lists).
                  </p>
                </div>
              </div>
            </div>

            {/* Test Name */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Test Title</label>
              <input 
                value={formData.title} 
                onChange={e => handleChange('title', e.target.value)} 
                placeholder={formData.test_mode === 'PUZZLE' ? 'e.g. Unit III – Linked Lists (Puzzle Test)' : formData.test_mode === 'QUIZ' ? 'e.g. Unit IV – Stacks (Quiz Test)' : 'e.g. DSA Midterm Assessment'}
                style={inputStyle} 
              />
            </div>
            
            {/* Subject & Division Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Subject</label>
                <input value={formData.subject_name} onChange={e => handleChange('subject_name', e.target.value)} placeholder="DSA" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Division Section</label>
                <select value={formData.target_division} onChange={e => handleChange('target_division', e.target.value)} style={inputStyle}>
                  <option value="">All Divisions (Both AIDS A & AIDS B)</option>
                  <option value="AIDS A">AIDS A (AD13 Series)</option>
                  <option value="AIDS B">AIDS B (AD14 Series)</option>
                </select>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Restricts test access to students from Division A (AD13) or Division B (AD14).
                </p>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Description / Guidelines</label>
              <textarea value={formData.description} onChange={e => handleChange('description', e.target.value)} style={{ ...inputStyle, height: '80px', resize: 'vertical' }} placeholder="Provide any test instructions or student guidelines..." />
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Start Schedule (Optional)</label>
                <input type="datetime-local" value={formData.start_time} onChange={e => handleChange('start_time', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>End Schedule (Optional)</label>
                <input type="datetime-local" value={formData.end_time} onChange={e => handleChange('end_time', e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: QUESTIONS */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {formData.test_mode === 'CODING' ? (
              <>
                <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Coding Questions</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                  <div style={{ padding: '24px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'center' }}>
                    <CheckCircle2 size={36} color="var(--accent)" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--text-primary)' }}>9 CODING PROBLEMS AVAILABLE IN BANK</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      Pre-seeded coding problems with automated testcases will be linked to this assessment. <br/>
                      Students will receive random coding problems from the pool.
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
                    Choose Question Bank for {formData.test_mode === 'PUZZLE' ? 'Puzzle' : 'Quiz'} Test
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Select an existing Question Bank to import all questions, marks, and durations automatically.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredBanks.map(bank => {
                    const isSelected = formData.bank_id === bank.id;
                    return (
                      <div
                        key={bank.id}
                        onClick={() => handleSelectBank(bank)}
                        style={{
                          padding: '16px',
                          borderRadius: '8px',
                          border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                          background: isSelected ? 'var(--surface-2)' : 'var(--surface-1)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{bank.name}</span>
                            <span style={{ 
                              fontSize: '10px', 
                              fontWeight: 600, 
                              padding: '2px 8px', 
                              borderRadius: '4px',
                              background: bank.category === 'PUZZLE' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: bank.category === 'PUZZLE' ? '#c084fc' : '#60a5fa'
                            }}>
                              {bank.category || 'QUIZ'}
                            </span>
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {bank.description || 'Question Bank'} · {bank._count?.quizQuestions || 0} Questions · {bank.total_marks || 30} Marks · {bank.duration_minutes || 30} Mins
                          </p>
                        </div>
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                          background: isSelected ? 'var(--accent)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                        </div>
                      </div>
                    );
                  })}

                  {filteredBanks.length === 0 && (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                      No question banks found for this category. You can also create and populate question banks in the Questions section.
                    </div>
                  )}
                </div>
              </>
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Anti-Cheat & Exam Rules</label>
              
              <div style={{ padding: '16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  ⚠️ Strict Alt-Tab Limit: Up to 3 Violations
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Tab switching, exiting fullscreen, or minimizing the window is recorded. On the <strong>3rd violation</strong>, the student's exam is automatically submitted immediately with their current answers.
                </p>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.randomize_questions} onChange={e => handleChange('randomize_questions', e.target.checked)} style={{ width: '18px', height: '18px' }} />
                <span style={{ fontSize: '14px' }}>Randomize questions order</span>
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.integrity_monitoring} onChange={e => handleChange('integrity_monitoring', e.target.checked)} style={{ width: '18px', height: '18px' }} />
                <span style={{ fontSize: '14px' }}>Enable integrity monitoring (window blur & tab switches)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.auto_submit} onChange={e => handleChange('auto_submit', e.target.checked)} style={{ width: '18px', height: '18px' }} />
                <span style={{ fontSize: '14px' }}>Auto-submit when timer expires</span>
              </label>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'var(--surface-2)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>REVIEW ASSESSMENT</h2>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  background: formData.test_mode === 'PUZZLE' ? 'rgba(168, 85, 247, 0.2)' : formData.test_mode === 'QUIZ' ? 'rgba(59, 130, 246, 0.2)' : 'var(--accent)',
                  color: formData.test_mode === 'PUZZLE' ? '#c084fc' : formData.test_mode === 'QUIZ' ? '#60a5fa' : '#fff'
                }}>
                  {formData.test_mode} TEST
                </span>
              </div>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px' }}>{formData.title || 'Untitled Test'}</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px' }}>
                <div><span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Test Mode:</span> <strong>{formData.test_mode === 'PUZZLE' ? '🧩 Puzzle Test' : formData.test_mode === 'QUIZ' ? '📝 Quiz Test' : '💻 Coding Test'}</strong></div>
                <div><span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Division Eligibility:</span> <strong>{formData.target_division === 'AIDS A' ? 'AIDS A (AD13 Series)' : formData.target_division === 'AIDS B' ? 'AIDS B (AD14 Series)' : 'All Divisions (AIDS A & B)'}</strong></div>
                <div><span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Duration:</span> <strong>{formData.duration_minutes} minutes</strong></div>
                <div><span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Total Marks:</span> <strong>{formData.total_marks} Marks</strong></div>
                <div><span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Alt-Tab Limit:</span> <strong>Max 3 strikes (Auto-submit on 3rd)</strong></div>
                <div><span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Questions per student:</span> <strong>{formData.questions_per_student}</strong></div>
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
              else router.push('/admin/tests');
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
            {loading ? 'CREATING...' : step < 4 ? 'NEXT STEP' : 'PUBLISH ASSESSMENT'}
          </button>
        </div>
      )}

      {/* STEP 5: SUCCESS */}
      {step === 5 && createdTest && (
        <div style={{ maxWidth: '600px', margin: '40px auto 0', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--success-dim)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Check size={32} strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            TEST CREATED SUCCESSFULLY
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '16px' }}>
            {createdTest.title}
          </p>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '32px' }}>
            Mode: <strong>{createdTest.test_type || formData.test_mode}</strong> · Division: <strong>{createdTest.target_division || 'All'}</strong>
          </p>

          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '32px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '16px', textTransform: 'uppercase' }}>
              STUDENT LINK
            </p>
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px', fontSize: '16px', color: 'var(--text-primary)', fontFamily: 'Söhne Mono, ui-monospace, monospace', marginBottom: '24px', wordBreak: 'break-all' }}>
              https://code.zealindori.com/{createdTest.unique_id}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                GO TO TESTS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
