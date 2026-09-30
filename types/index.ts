// Core Types for CODE//DSA

export interface Student {
  roll_no: string;
  name: string;
  division: string;
  branch: string;
  is_active: number;
}

export interface Admin {
  id: number;
  username: string;
  password_hash: string;
}

export interface Question {
  id: number;
  title: string;
  topic: string;
  statement: string;
  input_format: string;
  output_format: string;
  constraints: string;
  example_input: string;
  example_output: string;
  is_enabled: number;
  created_at: string;
}

export interface TestCase {
  id: number;
  question_id: number;
  input: string;
  expected_output: string;
  type: 'visible' | 'hidden' | 'edge';
  is_visible: number;
  weight: number;
}

export interface ExamSession {
  id: string;
  student_roll: string;
  start_time: string;
  end_time: string | null;
  status: 'active' | 'submitted' | 'expired';
  is_submitted: number;
  integrity_warnings: number;
}

export interface AssignedQuestion {
  session_id: string;
  question_id: number;
  order_index: number;
}

export interface CodeSave {
  session_id: string;
  question_id: number;
  code: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  session_id: string;
  question_id: number;
  code: string;
  score: number;
  compile_score: number;
  logic_score: number;
  submitted_at: string;
}

export interface TestResult {
  id: number;
  submission_id: string;
  test_case_id: number;
  passed: number;
  actual_output: string;
  execution_time: number;
}

export interface IntegrityEvent {
  id: number;
  session_id: string;
  event_type: string;
  timestamp: string;
}

export interface Setting {
  key: string;
  value: string;
}

// API Response types
export interface StudentLoginResponse {
  student: Student;
  session_token: string;
}

export interface ExamSessionData {
  session: ExamSession;
  questions: Question[];
  submissions: { [questionId: number]: Submission };
  saves: { [questionId: number]: string };
}

export interface RunCodeRequest {
  code: string;
  question_id: number;
  session_token: string;
}

export interface TestCaseResult {
  test_case_id: number;
  input: string;
  expected_output: string;
  actual_output: string;
  passed: boolean;
  execution_time: number;
  type: string;
  is_visible: number;
}

export interface RunCodeResponse {
  success: boolean;
  compile_error?: string;
  test_results: TestCaseResult[];
  passed: number;
  total: number;
  visible_passed: number;
  visible_total: number;
}

export interface SubmitCodeRequest {
  code: string;
  question_id: number;
  session_token: string;
}

export interface SubmitCodeResponse {
  success: boolean;
  score: number;
  max_score: number;
  details: string;
}

// Admin types
export interface AdminDashboardData {
  total_students: number;
  started: number;
  submitted: number;
  live_sessions: LiveSession[];
}

export interface LiveSession {
  roll_no: string;
  name: string;
  division: string;
  current_question: string;
  status: string;
  time_remaining: string;
}

export interface ResultRow {
  roll_no: string;
  name: string;
  division: string;
  q1_score: number | null;
  q2_score: number | null;
  q3_score: number | null;
  total_score: number;
  status: string;
  submitted_at: string | null;
}
