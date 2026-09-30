-- Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Admins
CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

-- Students
CREATE TABLE students (
  roll_no TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  division TEXT NOT NULL,
  branch TEXT NOT NULL,
  is_active INTEGER DEFAULT 1
);

-- Questions
CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  statement TEXT NOT NULL,
  input_format TEXT NOT NULL,
  output_format TEXT NOT NULL,
  constraints TEXT NOT NULL,
  example_input TEXT NOT NULL,
  example_output TEXT NOT NULL,
  is_enabled INTEGER DEFAULT 1
);

-- Test Cases
CREATE TABLE test_cases (
  id SERIAL PRIMARY KEY,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  input TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  type TEXT NOT NULL, -- 'visible', 'hidden', 'edge'
  is_visible INTEGER DEFAULT 0,
  weight INTEGER DEFAULT 1
);

-- Exam Sessions
CREATE TABLE exam_sessions (
  id TEXT PRIMARY KEY,
  student_roll TEXT REFERENCES students(roll_no) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active',
  is_submitted INTEGER DEFAULT 0,
  integrity_warnings INTEGER DEFAULT 0
);

-- Assigned Questions
CREATE TABLE assigned_questions (
  session_id TEXT REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  PRIMARY KEY (session_id, question_id)
);

-- Code Saves
CREATE TABLE code_saves (
  session_id TEXT REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, question_id)
);

-- Submissions
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  score INTEGER NOT NULL,
  compile_score INTEGER NOT NULL,
  logic_score INTEGER NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Test Results
CREATE TABLE test_results (
  id SERIAL PRIMARY KEY,
  submission_id TEXT REFERENCES submissions(id) ON DELETE CASCADE,
  test_case_id INTEGER REFERENCES test_cases(id) ON DELETE CASCADE,
  passed INTEGER NOT NULL,
  actual_output TEXT NOT NULL,
  execution_time INTEGER NOT NULL
);

-- Integrity Events
CREATE TABLE integrity_events (
  id SERIAL PRIMARY KEY,
  session_id TEXT REFERENCES exam_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);
