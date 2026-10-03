-- ZCOER CODING ASSESSMENT PLATFORM - V2 SCHEMA

-- 1. USERS & ROLES
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'TEACHER', 'STUDENT')),
  password_hash TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. ACADEMIC STRUCTURE
CREATE TABLE branches (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE divisions (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  year TEXT NOT NULL, -- e.g., 'FE', 'SE', 'TE', 'BE'
  semester TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subjects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  description TEXT,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. SPECIFIC USER PROFILES
CREATE TABLE students (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  roll_number TEXT UNIQUE NOT NULL,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL,
  batch TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teachers (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  employee_id TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teacher_subjects (
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, subject_id)
);

CREATE TABLE admins (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. QUESTION BANK
CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  topic TEXT NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
  marks INTEGER NOT NULL,
  input_format TEXT NOT NULL,
  output_format TEXT NOT NULL,
  constraints TEXT NOT NULL,
  sample_input TEXT NOT NULL,
  sample_output TEXT NOT NULL,
  explanation TEXT,
  reference_solution TEXT,
  created_by UUID REFERENCES teachers(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE languages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  file_extension TEXT NOT NULL,
  compiler_command TEXT,
  run_command TEXT NOT NULL,
  version TEXT,
  enabled BOOLEAN DEFAULT true
);

CREATE TABLE question_languages (
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  language_id INTEGER REFERENCES languages(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, language_id)
);

CREATE TABLE question_starter_code (
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  language_id INTEGER REFERENCES languages(id) ON DELETE CASCADE,
  starter_code TEXT NOT NULL,
  PRIMARY KEY (question_id, language_id)
);

CREATE TABLE question_rubrics (
  id SERIAL PRIMARY KEY,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  criterion TEXT NOT NULL,
  description TEXT NOT NULL,
  max_marks INTEGER NOT NULL,
  order_index INTEGER NOT NULL
);

CREATE TABLE test_cases (
  id SERIAL PRIMARY KEY,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  input TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  is_hidden BOOLEAN DEFAULT false,
  marks INTEGER DEFAULT 1,
  order_index INTEGER NOT NULL
);

-- 5. TESTS (EXAMS)
CREATE TABLE tests (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
  created_by UUID REFERENCES teachers(id) ON DELETE SET NULL,
  duration_minutes INTEGER NOT NULL,
  total_marks INTEGER NOT NULL,
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEW', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'ARCHIVED')),
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  randomize_questions BOOLEAN DEFAULT false,
  questions_per_student INTEGER,
  allow_multiple_languages BOOLEAN DEFAULT true,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE test_eligibility (
  id SERIAL PRIMARY KEY,
  test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('BRANCH', 'DIVISION', 'STUDENT')),
  target_id TEXT NOT NULL -- Can be branch_id, division_id, or student_id depending on target_type
);

CREATE TABLE test_questions (
  test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  PRIMARY KEY (test_id, question_id)
);

-- 6. EXAM EXECUTION
CREATE TABLE exam_sessions (
  id TEXT PRIMARY KEY,
  test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'SUBMITTED', 'EXPIRED')),
  is_submitted BOOLEAN DEFAULT false,
  integrity_warnings INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assigned_questions (
  session_id TEXT REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  PRIMARY KEY (session_id, question_id)
);

CREATE TABLE code_drafts (
  session_id TEXT REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  language_id INTEGER REFERENCES languages(id) ON DELETE CASCADE,
  source_code TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, question_id)
);

-- 7. SUBMISSIONS & EVALUATION
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  language_id INTEGER REFERENCES languages(id) ON DELETE CASCADE,
  source_code TEXT NOT NULL,
  automated_score INTEGER NOT NULL,
  ai_score INTEGER,
  teacher_score INTEGER,
  final_score INTEGER,
  status TEXT DEFAULT 'PENDING_AI' CHECK (status IN ('PENDING_AI', 'AI_EVALUATED', 'TEACHER_REVIEWED', 'FINALIZED')),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE submission_test_results (
  id SERIAL PRIMARY KEY,
  submission_id TEXT REFERENCES submissions(id) ON DELETE CASCADE,
  test_case_id INTEGER REFERENCES test_cases(id) ON DELETE CASCADE,
  passed BOOLEAN NOT NULL,
  actual_output TEXT NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  memory_usage_kb INTEGER,
  status TEXT NOT NULL -- SUCCESS, WRONG_ANSWER, TIME_LIMIT, etc.
);

CREATE TABLE ai_evaluations (
  id SERIAL PRIMARY KEY,
  submission_id TEXT UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
  confidence NUMERIC(3,2),
  raw_response JSONB,
  strengths JSONB,
  issues JSONB,
  suggestions JSONB,
  evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_evaluation_items (
  id SERIAL PRIMARY KEY,
  evaluation_id INTEGER REFERENCES ai_evaluations(id) ON DELETE CASCADE,
  rubric_id INTEGER REFERENCES question_rubrics(id) ON DELETE CASCADE,
  awarded_marks INTEGER NOT NULL,
  reason TEXT NOT NULL
);

CREATE TABLE teacher_reviews (
  id SERIAL PRIMARY KEY,
  submission_id TEXT UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  is_override BOOLEAN DEFAULT false,
  teacher_comment TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. SYSTEM
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
