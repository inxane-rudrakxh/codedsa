'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { generateCollegeResultsPDF } from '@/lib/pdfGenerator';

interface Question {
  id: string; title: string; topic: string; description: string;
  input_format: string; output_format: string; constraints: string;
  example_input: string; example_output: string; is_enabled: number;
  testCases: Array<{ id: string; input: string; expected_output: string; is_hidden: boolean; marks: number }>;
}
interface RequestRow {
  session_id: string; test_id: string; test_title: string; name: string;
  roll_no: string; branch: string; division: string; status: string;
}
interface QuestionResult {
  question_id: string; question_title: string; order_index: number;
  submission_id: string | null; source_code: string | null; status: string | null;
  passed_test_cases: number | null; total_test_cases: number | null;
  marks_awarded: number | null; max_marks: number; ai_feedback: string | null;
}
interface ResultRow {
  roll_no: string; name: string; division: string; branch: string;
  session_id: string | null; status: string | null; is_submitted: number;
  start_time: string | null; end_time: string | null; integrity_warnings: number;
  questions: QuestionResult[]; total_score: number; max_total: number;
}

export default function TestDetailPage() {
  const { testId } = useParams<{ testId: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<'questions' | 'requests' | 'results'>('questions');
  const [test, setTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const getToken = () => localStorage.getItem('admin_token') || '';

  useEffect(() => {
    fetch('/api/admin/tests', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(data => {
        const found = (data.tests || []).find((t: any) => t.id === testId);
        setTest(found || null);
        setLoading(false);
      });
  }, [testId]);

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>;
  if (!test) return <div style={{ padding: '40px', color: 'var(--error)', fontSize: '13px' }}>Test not found.</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <Link href="/admin/tests" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}>Tests</Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{test.title}</span>
      </div>
      <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <p className="text-label" style={{ marginBottom: '4px' }}>{test.subject_name || 'Assessment'}</p>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{test.title}</h1>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
            {[{l:'Duration',v:`${test.duration_minutes}min`},{l:'Q/student',v:test.questions_per_student},{l:'Marks',v:test.total_marks},{l:'Division',v:test.target_division||'All'}].map(({l,v})=>(
              <span key={l} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text-muted)' }}>{l}:</span> {v}</span>
            ))}
          </div>
        </div>
        <button onClick={() => router.push('/admin/tests')} style={outlineBtn}>← Back</button>
      </div>
      <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid var(--border)', marginBottom: '28px' }}>
        {([{key:'questions',label:'Question Bank'},{key:'requests',label:'Access Requests'},{key:'results',label:'Results'}] as const).map(({key,label})=>(
          <button key={key} onClick={()=>setTab(key)} style={{ padding:'10px 18px',background:'transparent',border:'none',borderBottom:tab===key?'2px solid var(--accent)':'2px solid transparent',color:tab===key?'var(--text-primary)':'var(--text-muted)',fontSize:'12px',fontWeight:tab===key?700:500,letterSpacing:'0.06em',textTransform:'uppercase',cursor:'pointer',marginBottom:'-1px',transition:'all 0.15s ease' }}>
            {label}
          </button>
        ))}
      </div>
      {tab==='questions' && <QuestionBankTab testId={testId} getToken={getToken} />}
      {tab==='requests' && <AccessRequestsTab testId={testId} getToken={getToken} />}
      {tab==='results' && <ResultsTab testId={testId} test={test} getToken={getToken} />}
    </div>
  );
}

function QuestionBankTab({ testId, getToken }: { testId: string; getToken: () => string }) {
  const [testQuestions, setTestQuestions] = useState<any[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Question>>({});
  const [addingTC, setAddingTC] = useState<string | null>(null);
  const [newTC, setNewTC] = useState({ input: '', expected_output: '', is_hidden: true, marks: 1 });
  const [isCreating, setIsCreating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [newData, setNewData] = useState({ title:'', topic:'', description:'', input_format:'', output_format:'', constraints:'', sample_input:'', sample_output:'', subject_name:'' });

  const fetchData = useCallback(async () => {
    const [testsRes, questionsRes] = await Promise.all([
      fetch('/api/admin/tests', { headers: { Authorization: `Bearer ${getToken()}` } }),
      fetch('/api/admin/questions', { headers: { Authorization: `Bearer ${getToken()}` } }),
    ]);
    const testsData = await testsRes.json();
    const questionsData = await questionsRes.json();
    const found = (testsData.tests || []).find((t: any) => t.id === testId);
    setTestQuestions(found?.testQuestions || []);
    setAllQuestions(questionsData.questions || []);
    setLoading(false);
  }, [testId, getToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const post = (body: any) => fetch('/api/admin/tests', { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${getToken()}`}, body:JSON.stringify(body) });
  const postQ = (body: any) => fetch('/api/admin/questions', { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${getToken()}`}, body:JSON.stringify(body) });

  const assignedIds = new Set(testQuestions.map((tq: any) => tq.question_id));
  const available = allQuestions.filter(q => !assignedIds.has(q.id));

  const handleAssign = async (id: string) => { await post({ action:'assign_question', test_id:testId, question_id:id }); fetchData(); };
  const handleRemove = async (id: string) => { await post({ action:'remove_question', test_id:testId, question_id:id }); fetchData(); };
  const handleCreate = async () => { await postQ({ action:'create', ...newData }); setIsCreating(false); fetchData(); };
  const handleSaveEdit = async (id: string) => { await postQ({ action:'update', id, ...editData }); setEditingId(null); fetchData(); };
  const handleAddTC = async (qid: string) => { await postQ({ action:'add_test_case', question_id:qid, ...newTC }); setAddingTC(null); setNewTC({input:'',expected_output:'',is_hidden:true,marks:1}); fetchData(); };
  const handleDeleteTC = async (tcId: string) => { await postQ({ action:'delete_test_case', id:tcId }); fetchData(); };
  const handleAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    const res = await postQ({ action:'generate_ai', prompt:aiPrompt });
    const data = await res.json();
    if (data.question) { setNewData(data.question); setIsCreating(true); }
    setAiGenerating(false); setAiPrompt('');
  };

  if (loading) return <p style={{fontSize:'13px',color:'var(--text-muted)'}}>Loading...</p>;

  const fieldRows = (d: any, set: any, fields: string[]) => fields.map(key => (
    <div key={key}>
      <p className="text-label" style={{marginBottom:'4px',fontSize:'10px'}}>{key.replace(/_/g,' ').toUpperCase()}</p>
      <textarea rows={key==='description'?3:1} value={d[key]||''} onChange={e=>set((p:any)=>({...p,[key]:e.target.value}))} style={{...inputStyle,resize:'vertical',fontFamily:'inherit'}} />
    </div>
  ));

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'24px'}}>
      {/* Assigned */}
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
          <p className="text-label">Assigned to This Test ({testQuestions.length})</p>
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            <select id="qsel" style={{...inputStyle,width:'220px',padding:'6px 12px'}} defaultValue="">
              <option value="" disabled>Add from bank...</option>
              {available.map(q=><option key={q.id} value={q.id}>[{q.topic}] {q.title}</option>)}
            </select>
            <button onClick={()=>{ const s=document.getElementById('qsel') as HTMLSelectElement; if(s.value){handleAssign(s.value);s.value='';} }} style={outlineBtn}>Add</button>
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
          {testQuestions.length===0 ? <p style={{fontSize:'13px',color:'var(--text-muted)',fontStyle:'italic'}}>No questions assigned yet.</p>
          : testQuestions.map((tq:any,idx:number)=>(
            <div key={tq.question_id} style={{border:'1px solid var(--border)',borderRadius:'4px',background:'var(--surface-1)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px'}}>
                <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
                  <span style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'Söhne Mono,monospace',minWidth:'20px'}}>{idx+1}</span>
                  <span style={{fontSize:'13px',color:'var(--text-primary)',fontWeight:500}}>{tq.question.title}</span>
                  <span style={{fontSize:'11px',color:'var(--text-muted)'}}>{tq.question.topic}</span>
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  <button onClick={()=>setExpandedId(expandedId===tq.question_id?null:tq.question_id)} style={ghostBtn}>{expandedId===tq.question_id?'Hide':'Details'}</button>
                  <button onClick={()=>handleRemove(tq.question_id)} style={{...ghostBtn,color:'var(--error)'}}>Remove</button>
                </div>
              </div>
              {expandedId===tq.question_id&&<TCPanel q={tq.question} addingTC={addingTC===tq.question_id} newTC={newTC} setNewTC={setNewTC} onAdd={()=>setAddingTC(addingTC===tq.question_id?null:tq.question_id)} onSave={()=>handleAddTC(tq.question_id)} onDelete={handleDeleteTC} />}
            </div>
          ))}
        </div>
      </div>

      <hr style={{border:'none',borderTop:'1px solid var(--border)'}} />

      {/* Bank */}
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
          <p className="text-label">Question Bank ({allQuestions.length})</p>
          <div style={{display:'flex',gap:'8px'}}>
            <div style={{display:'flex',gap:'6px'}}>
              <input value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="AI: describe a question..." style={{...inputStyle,width:'240px',padding:'6px 12px'}} onKeyDown={e=>e.key==='Enter'&&handleAI()} />
              <button onClick={handleAI} disabled={aiGenerating} style={outlineBtn}>{aiGenerating?'...':'✦ AI'}</button>
            </div>
            <button onClick={()=>setIsCreating(!isCreating)} style={outlineBtn}>{isCreating?'Cancel':'+ New'}</button>
          </div>
        </div>
        {isCreating&&(
          <div style={{marginBottom:'16px',padding:'16px',background:'var(--surface-1)',border:'1px solid var(--border)',borderRadius:'4px',display:'flex',flexDirection:'column',gap:'10px'}}>
            <p className="text-label">New Question</p>
            {fieldRows(newData, setNewData, ['title','topic','description','input_format','output_format','constraints','sample_input','sample_output'])}
            <div style={{display:'flex',justifyContent:'flex-end',gap:'8px'}}>
              <button onClick={()=>setIsCreating(false)} style={outlineBtn}>Cancel</button>
              <button onClick={handleCreate} style={primaryBtn}>Create</button>
            </div>
          </div>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
          {allQuestions.map(q=>(
            <div key={q.id} style={{border:'1px solid var(--border)',borderRadius:'4px',background:'var(--surface-1)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px'}}>
                <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
                  <span style={{fontSize:'13px',color:'var(--text-primary)',fontWeight:500}}>{q.title}</span>
                  <span style={{fontSize:'11px',color:'var(--text-muted)'}}>{q.topic}</span>
                  <span style={{fontSize:'10px',color:'var(--text-muted)',background:'var(--surface-2)',padding:'2px 6px',borderRadius:'2px'}}>{q.testCases?.length||0} tc</span>
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  {!assignedIds.has(q.id)&&<button onClick={()=>handleAssign(q.id)} style={{...ghostBtn,color:'var(--accent)'}}>+ Add</button>}
                  <button onClick={()=>{ setEditingId(q.id===editingId?null:q.id); setEditData(q); }} style={ghostBtn}>Edit</button>
                  <button onClick={()=>setExpandedId(expandedId===q.id?null:q.id)} style={ghostBtn}>{expandedId===q.id?'Hide':'Details'}</button>
                </div>
              </div>
              {editingId===q.id&&(
                <div style={{padding:'14px 16px',borderTop:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:'10px'}}>
                  {fieldRows(editData, setEditData, ['title','topic','description','input_format','output_format','constraints'])}
                  <div style={{display:'flex',justifyContent:'flex-end',gap:'8px'}}>
                    <button onClick={()=>setEditingId(null)} style={outlineBtn}>Cancel</button>
                    <button onClick={()=>handleSaveEdit(q.id)} style={primaryBtn}>Save</button>
                  </div>
                </div>
              )}
              {expandedId===q.id&&<TCPanel q={q} addingTC={addingTC===q.id} newTC={newTC} setNewTC={setNewTC} onAdd={()=>setAddingTC(addingTC===q.id?null:q.id)} onSave={()=>handleAddTC(q.id)} onDelete={handleDeleteTC} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TCPanel({ q, addingTC, newTC, setNewTC, onAdd, onSave, onDelete }: any) {
  return (
    <div style={{padding:'14px 16px',borderTop:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:'10px'}}>
      {q.description&&<p style={{fontSize:'13px',color:'var(--text-secondary)',lineHeight:1.6,margin:0}}>{q.description}</p>}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <p className="text-label" style={{fontSize:'10px',margin:0}}>Test Cases ({q.testCases?.length||0})</p>
        <button onClick={onAdd} style={{...ghostBtn,fontSize:'11px'}}>{addingTC?'Cancel':'+ Add TC'}</button>
      </div>
      {addingTC&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto auto',gap:'8px',alignItems:'end'}}>
          <div><p className="text-label" style={{marginBottom:'2px',fontSize:'10px'}}>Input</p><textarea rows={2} value={newTC.input} onChange={e=>setNewTC((p:any)=>({...p,input:e.target.value}))} style={{...inputStyle,resize:'none',fontSize:'12px'}} /></div>
          <div><p className="text-label" style={{marginBottom:'2px',fontSize:'10px'}}>Expected Output</p><textarea rows={2} value={newTC.expected_output} onChange={e=>setNewTC((p:any)=>({...p,expected_output:e.target.value}))} style={{...inputStyle,resize:'none',fontSize:'12px'}} /></div>
          <div>
            <p className="text-label" style={{marginBottom:'2px',fontSize:'10px'}}>Marks</p>
            <input type="number" min="0" value={newTC.marks} onChange={e=>setNewTC((p:any)=>({...p,marks:parseInt(e.target.value)||1}))} style={{...inputStyle,width:'60px',fontSize:'12px'}} />
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
            <label style={{fontSize:'11px',color:'var(--text-muted)',display:'flex',alignItems:'center',gap:'4px'}}><input type="checkbox" checked={newTC.is_hidden} onChange={e=>setNewTC((p:any)=>({...p,is_hidden:e.target.checked}))} /> Hidden</label>
            <button onClick={onSave} style={{...primaryBtn,padding:'6px 12px'}}>Save</button>
          </div>
        </div>
      )}
      {(q.testCases||[]).map((tc:any)=>(
        <div key={tc.id} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto auto auto',gap:'8px',padding:'8px',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'3px',alignItems:'center'}}>
          <pre style={{margin:0,fontSize:'11px',color:'var(--text-muted)',fontFamily:'Söhne Mono,monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tc.input||'(empty)'}</pre>
          <pre style={{margin:0,fontSize:'11px',color:'var(--text-muted)',fontFamily:'Söhne Mono,monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tc.expected_output}</pre>
          <span style={{fontSize:'10px',color:'var(--text-muted)'}}>{tc.marks}pts</span>
          <span style={{fontSize:'9px',padding:'2px 6px',background:tc.is_hidden?'var(--surface-2)':'rgba(34,197,94,0.1)',color:tc.is_hidden?'var(--text-muted)':'#22c55e',borderRadius:'2px',fontWeight:600,letterSpacing:'0.06em'}}>{tc.is_hidden?'HIDDEN':'VISIBLE'}</span>
          <button onClick={()=>onDelete(tc.id)} style={{background:'none',border:'none',color:'var(--error)',fontSize:'14px',cursor:'pointer',lineHeight:1}}>×</button>
        </div>
      ))}
    </div>
  );
}

function AccessRequestsTab({ testId, getToken }: { testId: string; getToken: () => string }) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/admin/dashboard', { headers: { Authorization: `Bearer ${getToken()}` } });
    if (res.ok) {
      const d = await res.json();
      const pending = (d.active_sessions || []).filter((s: any) => s.status === 'pending_approval' && s.test_id === testId);
      setRequests(pending);
    }
    setLoading(false);
  }, [testId, getToken]);

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 3000); return () => clearInterval(iv); }, [fetchData]);

  const handleAction = async (sessionId: string, action: 'approve' | 'reject') => {
    await fetch('/api/admin/approve', { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${getToken()}`}, body:JSON.stringify({session_id:sessionId,action}) });
    setRequests(p => p.filter(r => r.session_id !== sessionId));
  };

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
        <div>
          <h2 style={{fontSize:'16px',fontWeight:600,color:'var(--text-primary)',margin:0}}>
            Live Access Requests
            {requests.length>0&&<span style={{marginLeft:'10px',background:'var(--accent)',color:'#fff',fontSize:'10px',fontWeight:700,padding:'2px 8px',borderRadius:'999px'}}>{requests.length}</span>}
          </h2>
          <p style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'4px'}}>Auto-refreshes every 3s</p>
        </div>
      </div>
      {loading ? <p style={{fontSize:'13px',color:'var(--text-muted)'}}>Loading...</p>
      : requests.length===0 ? (
        <div style={{padding:'40px',textAlign:'center',border:'1px dashed var(--border)',borderRadius:'4px'}}>
          <p style={{fontSize:'13px',color:'var(--text-muted)'}}>No pending access requests for this test.</p>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {requests.map(r=>(
            <div key={r.session_id} style={{display:'grid',gridTemplateColumns:'140px 1fr 100px 80px auto',gap:'16px',alignItems:'center',padding:'14px 16px',background:'var(--surface-1)',border:'1px solid var(--border)',borderRadius:'4px'}}>
              <span style={{fontFamily:'Söhne Mono,monospace',fontSize:'13px',color:'var(--text-primary)',fontWeight:600}}>{r.roll_no}</span>
              <span style={{fontSize:'13px',color:'var(--text-secondary)'}}>{r.name}</span>
              <span style={{fontSize:'11px',color:'var(--text-muted)'}}>{r.division}</span>
              <span style={{fontSize:'11px',color:'var(--text-muted)'}}>{r.branch}</span>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={()=>handleAction(r.session_id,'approve')} style={{padding:'6px 14px',background:'var(--success)',border:'none',borderRadius:'3px',color:'#fff',fontSize:'11px',fontWeight:700,cursor:'pointer'}}>Approve</button>
                <button onClick={()=>handleAction(r.session_id,'reject')} style={{padding:'6px 14px',background:'transparent',border:'1px solid var(--error)',borderRadius:'3px',color:'var(--error)',fontSize:'11px',fontWeight:700,cursor:'pointer'}}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultsTab({ testId, test, getToken }: { testId: string; test: any; getToken: () => string }) {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [selectedTest, setSelectedTest] = useState<any>(test);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [divFilter, setDivFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCode, setSelectedCode] = useState<{name:string;roll:string;q:QuestionResult;editMarks:number;session_id:string}|null>(null);
  const [sessionToReset, setSessionToReset] = useState<string|null>(null);
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<any[]|null>(null);

  const loadResults = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/results?test_id=${testId}`, { headers:{Authorization:`Bearer ${getToken()}`} });
    const data = await res.json();
    setResults(data.results||[]);
    setSelectedTest(data.test||test);
    setLoading(false);
  }, [testId, getToken, test]);

  useEffect(() => { loadResults(); }, [loadResults]);

  const post = (body: any) => fetch('/api/admin/results', { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${getToken()}`}, body:JSON.stringify(body) });

  const handleUpdateMarks = async () => {
    if(!selectedCode) return;
    await post({ action:'update_marks', submission_id:selectedCode.q.submission_id, session_id:selectedCode.session_id, question_id:selectedCode.q.question_id, marks_awarded:selectedCode.editMarks });
    setSelectedCode(null); loadResults();
  };
  const handleResetSession = async (sid: string) => {
    setLoading(true);
    await post({ action:'reset_session', session_id:sid });
    await loadResults();
  };
  const handlePublishMarks = async () => {
    await fetch('/api/admin/tests', { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${getToken()}`}, body:JSON.stringify({action:'publish_marks',id:testId}) });
    setSelectedTest((p:any)=>p?{...p,marks_published:true}:p);
  };
  const handleGenerateReport = async () => {
    setGenerating(true);
    const res = await post({ action:'generate_report', test_id:testId });
    const data = await res.json();
    if(data.success) setReportData(data.data);
    setGenerating(false);
  };

  const divisions = [...new Set(results.map(r=>r.division).filter(Boolean))];
  const filtered = results.filter(r=>{
    const s = !search||r.name.toLowerCase().includes(search.toLowerCase())||r.roll_no.toLowerCase().includes(search.toLowerCase());
    const d = divFilter==='all'||r.division===divFilter;
    const st = r.is_submitted?'submitted':(r.session_id?'active':'not_started');
    const ss = statusFilter==='all'||st===statusFilter;
    return s&&d&&ss;
  });
  const submitted = results.filter(r=>r.is_submitted);
  const avgScore = submitted.length>0?(submitted.reduce((a,r)=>a+r.total_score,0)/submitted.length).toFixed(1):'—';
  const maxQ = Math.max(...results.map(r=>r.questions.length),0);
  const qH = Array.from({length:maxQ},(_,i)=>`Q${i+1}`);

  const exportPDF = () => {
    const list = filtered.length>0?filtered:results;
    if(list.length===0){alert('No results to export.');return;}
    generateCollegeResultsPDF({title:selectedTest?.title||test.title,subject_name:selectedTest?.subject_name||'DSA',target_division:selectedTest?.target_division||(divFilter!=='all'?divFilter:'All'),duration_minutes:selectedTest?.duration_minutes||60,total_marks:selectedTest?.total_marks||30},
      list.map(r=>({roll_no:r.roll_no,name:r.name,division:r.division,branch:r.branch,is_submitted:r.is_submitted,total_score:r.total_score,max_total:r.max_total||30,questions:r.questions.map(q=>({title:q.question_title,marks_awarded:q.marks_awarded,max_marks:q.max_marks,status:q.status||undefined}))})));
  };
  const exportCSV = () => {
    const list = filtered.length>0?filtered:results;
    if(list.length===0) return;
    const blob=new Blob([['Roll No,Name,Division,Branch,Status,Score,Max,Violations',...list.map(r=>[`"${r.roll_no}"`,`"${r.name}"`,`"${r.division}"`,`"${r.branch}"`,`"${r.is_submitted?'SUBMITTED':'ABSENT'}"`,r.total_score,r.max_total||30,r.integrity_warnings].join(','))].join('\n')],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${test.title}_results.csv`;a.click();
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:'8px',marginBottom:'20px',flexWrap:'wrap'}}>
        {!selectedTest?.marks_published&&<button onClick={handlePublishMarks} style={{...outlineBtn,color:'var(--success)',borderColor:'var(--success)'}}>Publish Marks</button>}
        <button onClick={handleGenerateReport} disabled={generating} style={outlineBtn}>{generating?'Generating...':'Refresh Report'}</button>
        {results.length>0&&<><button onClick={exportPDF} style={{...primaryBtn,display:'inline-flex',alignItems:'center',gap:'6px'}}>✦ Export PDF</button><button onClick={exportCSV} style={outlineBtn}>Export CSV</button></>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'1px',background:'var(--border)',border:'1px solid var(--border)',borderRadius:'4px',overflow:'hidden',marginBottom:'20px'}}>
        {[{label:'Total Students',value:results.length},{label:'Submitted',value:submitted.length},{label:'Avg Score',value:submitted.length>0?`${avgScore}/${selectedTest?.total_marks||'?'}`:'—'},{label:'Marks Published',value:selectedTest?.marks_published?'YES':'NO'}].map(({label,value})=>(
          <div key={label} style={{padding:'16px 20px',background:'var(--surface-1)'}}>
            <p className="text-label" style={{marginBottom:'4px'}}>{label}</p>
            <p style={{fontSize:'22px',fontWeight:700,fontFamily:'Söhne Mono,monospace',color:'var(--text-primary)'}}>{value}</p>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap'}}>
        <input type="text" placeholder="Search name or roll..." value={search} onChange={e=>setSearch(e.target.value)} style={{...filterInput,flex:1,maxWidth:'260px'}} />
        <select value={divFilter} onChange={e=>setDivFilter(e.target.value)} style={filterInput}><option value="all">All Divisions</option>{divisions.map(d=><option key={d} value={d}>{d}</option>)}</select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={filterInput}><option value="all">All Status</option><option value="submitted">Submitted</option><option value="active">Active</option><option value="not_started">Not Started</option></select>
        <span style={{fontSize:'12px',color:'var(--text-muted)',alignSelf:'center'}}>{filtered.length} students</span>
      </div>
      <div style={{border:'1px solid var(--border)',borderRadius:'4px',overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',minWidth:'700px'}}>
          <thead><tr style={{background:'var(--surface-2)'}}>{['Roll','Name','Div',...qH,'Total','Status','Warns','Actions'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {loading?<tr><td colSpan={8+qH.length} style={{padding:'24px',textAlign:'center',color:'var(--text-muted)',fontSize:'13px'}}>Loading...</td></tr>
            :filtered.length===0?<tr><td colSpan={8+qH.length} style={{padding:'24px',textAlign:'center',color:'var(--text-muted)',fontSize:'13px'}}>No results found.</td></tr>
            :filtered.map((r,i)=>{
              const st=r.is_submitted?'submitted':(r.session_id?'active':'not_started');
              return(
                <tr key={r.roll_no} style={{borderBottom:i<filtered.length-1?'1px solid var(--border-subtle)':'none',background:'var(--surface-1)'}}>
                  <td style={tdStyle}><span style={{fontFamily:'Söhne Mono,monospace',fontSize:'12px',color:'var(--text-primary)'}}>{r.roll_no}</span></td>
                  <td style={tdStyle}><span style={{fontSize:'13px',color:'var(--text-secondary)'}}>{r.name}</span></td>
                  <td style={tdStyle}><span style={{fontSize:'11px',color:'var(--text-muted)'}}>{r.division}</span></td>
                  {qH.map((_,qi)=>{const q=r.questions.find(q=>q.order_index===qi+1);return(
                    <td key={qi} style={tdStyle}>
                      {q&&(q.submission_id||q.status==='DRAFT')?<button onClick={()=>setSelectedCode({name:r.name,roll:r.roll_no,q,editMarks:q.marks_awarded??0,session_id:r.session_id!})} style={{background:'transparent',border:'none',cursor:'pointer',fontFamily:'Söhne Mono,monospace',fontSize:'13px',textDecoration:'underline',textDecorationStyle:'dotted',textUnderlineOffset:'3px',color:q.marks_awarded===null?'var(--text-muted)':q.marks_awarded>=q.max_marks*0.7?'var(--success)':q.marks_awarded>=q.max_marks*0.4?'var(--warning,#f0a500)':'var(--error)'}}>{q.marks_awarded!==null?`${q.marks_awarded}/${q.max_marks}`:`?/${q.max_marks}`}</button>
                      :<span style={{color:'var(--text-muted)',fontFamily:'Söhne Mono,monospace',fontSize:'13px'}}>—</span>}
                    </td>
                  );})}
                  <td style={tdStyle}><span style={{fontFamily:'Söhne Mono,monospace',fontSize:'13px',fontWeight:600,color:r.is_submitted?'var(--text-primary)':'var(--text-muted)'}}>{r.is_submitted?`${r.total_score}/${r.max_total}`:'—'}</span></td>
                  <td style={tdStyle}><StatusPill status={st} /></td>
                  <td style={tdStyle}>{r.integrity_warnings>0?<span style={{fontSize:'11px',color:'var(--error)',fontFamily:'Söhne Mono,monospace'}}>⚠ {r.integrity_warnings}</span>:<span style={{fontSize:'11px',color:'var(--text-muted)'}}>—</span>}</td>
                  <td style={tdStyle}>{r.session_id?<button onClick={()=>setSessionToReset(r.session_id!)} style={{background:'transparent',border:'1px solid var(--error-dim)',borderRadius:'3px',color:'var(--error)',fontSize:'10px',padding:'4px 8px',cursor:'pointer',fontWeight:600,letterSpacing:'0.05em',textTransform:'uppercase'}}>Reset</button>:<span style={{color:'var(--text-muted)'}}>—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selectedCode&&(
        <div className="modal-overlay"><div className="modal-content animate-fade-up" style={{maxWidth:'860px'}}>
          <div className="modal-header">
            <div><h3 style={{color:'var(--text-primary)',fontSize:'15px',fontWeight:600}}>{selectedCode.roll} · {selectedCode.name} — Q{selectedCode.q.order_index}: {selectedCode.q.question_title}</h3><p style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'2px'}}>{selectedCode.q.passed_test_cases}/{selectedCode.q.total_test_cases} test cases passed</p></div>
            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}><span style={{fontSize:'12px',color:'var(--text-muted)'}}>Marks (/{selectedCode.q.max_marks}):</span><input type="number" min="0" max={selectedCode.q.max_marks} value={selectedCode.editMarks} onChange={e=>setSelectedCode({...selectedCode,editMarks:parseFloat(e.target.value)||0})} style={{...filterInput,width:'70px',padding:'4px 8px'}} /><button onClick={handleUpdateMarks} style={{...primaryBtn,padding:'6px 14px'}}>Save</button></div>
              <button onClick={()=>setSelectedCode(null)} style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:'22px',cursor:'pointer'}}>×</button>
            </div>
          </div>
          <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            <div style={{background:'var(--surface-1)',padding:'16px',borderRadius:'6px',border:'1px solid var(--border)'}}><p className="text-label" style={{marginBottom:'8px'}}>Submitted Code</p><pre style={{fontFamily:'Söhne Mono,monospace',fontSize:'13px',color:'var(--text-primary)',margin:0,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{selectedCode.q.source_code||'// No code submitted'}</pre></div>
            {selectedCode.q.ai_feedback&&<div style={{background:'var(--surface-1)',padding:'16px',borderRadius:'6px',border:'1px solid var(--border)'}}><p className="text-label" style={{marginBottom:'8px',color:selectedCode.q.status==='COMPILATION_ERROR'?'var(--error)':'var(--text-secondary)'}}>{selectedCode.q.status==='COMPILATION_ERROR'?'Compiler Error':'AI Feedback'}</p><pre style={{fontFamily:'Söhne Mono,monospace',fontSize:'13px',color:selectedCode.q.status==='COMPILATION_ERROR'?'var(--error)':'var(--text-primary)',margin:0,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{selectedCode.q.ai_feedback}</pre></div>}
          </div>
        </div></div>
      )}
      {sessionToReset&&(
        <div className="modal-overlay"><div className="modal-content animate-fade-up" style={{maxWidth:'400px'}}>
          <div className="modal-header"><h3 style={{fontSize:'18px',fontWeight:600}}>Reset Session?</h3><button onClick={()=>setSessionToReset(null)} style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:'22px',cursor:'pointer'}}>×</button></div>
          <div className="modal-body"><p style={{fontSize:'14px',color:'var(--text-secondary)',lineHeight:1.5}}>This will permanently delete all code and marks for this session.</p></div>
          <div className="modal-footer">
            <button onClick={()=>setSessionToReset(null)} style={{padding:'8px 16px',border:'1px solid var(--border)',borderRadius:'6px',background:'transparent',color:'var(--text-secondary)',cursor:'pointer',fontSize:'14px'}}>Cancel</button>
            <button onClick={async()=>{const id=sessionToReset!;setSessionToReset(null);await handleResetSession(id);}} style={{padding:'8px 16px',border:'none',borderRadius:'6px',background:'var(--error)',color:'#fff',cursor:'pointer',fontSize:'14px',fontWeight:500}}>Reset Session</button>
          </div>
        </div></div>
      )}
    </div>
  );
}

function StatusPill({status}:{status:string}){
  const c:Record<string,any>={submitted:{label:'SUBMITTED',color:'var(--success)',bg:'var(--success-dim)'},active:{label:'ACTIVE',color:'var(--accent)',bg:'var(--accent-dim)'},not_started:{label:'NOT STARTED',color:'var(--text-muted)',bg:'var(--surface-2)'}};
  const s=c[status]||c.not_started;
  return <span style={{fontSize:'9px',fontWeight:700,letterSpacing:'0.10em',color:s.color,background:s.bg,padding:'3px 7px',borderRadius:'2px'}}>{s.label}</span>;
}

const inputStyle:React.CSSProperties={width:'100%',padding:'8px 12px',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'3px',color:'var(--text-primary)',fontSize:'13px',outline:'none'};
const outlineBtn:React.CSSProperties={padding:'8px 16px',background:'transparent',border:'1px solid var(--border)',borderRadius:'3px',color:'var(--text-secondary)',fontSize:'11px',fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',cursor:'pointer'};
const primaryBtn:React.CSSProperties={padding:'8px 16px',background:'var(--accent)',border:'1px solid transparent',borderRadius:'3px',color:'#ffffff',fontSize:'11px',fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',cursor:'pointer'};
const ghostBtn:React.CSSProperties={background:'none',border:'none',color:'var(--text-muted)',fontSize:'12px',cursor:'pointer',padding:'2px 6px'};
const thStyle:React.CSSProperties={padding:'10px 14px',textAlign:'left',fontSize:'10px',fontWeight:600,letterSpacing:'0.10em',textTransform:'uppercase',color:'var(--text-muted)',borderBottom:'1px solid var(--border)'};
const tdStyle:React.CSSProperties={padding:'10px 14px',verticalAlign:'middle'};
const filterInput:React.CSSProperties={padding:'8px 12px',background:'var(--surface-1)',border:'1px solid var(--border)',borderRadius:'3px',color:'var(--text-secondary)',fontSize:'13px',outline:'none'};
