-- ZCOER CODING ASSESSMENT PLATFORM - V2 MIGRATION SCRIPT
-- Run this directly in the Supabase SQL Editor.

-- STEP 1: RENAME OLD TABLES
ALTER TABLE IF EXISTS test_results RENAME TO old_test_results;
ALTER TABLE IF EXISTS submissions RENAME TO old_submissions;
ALTER TABLE IF EXISTS code_saves RENAME TO old_code_saves;
ALTER TABLE IF EXISTS assigned_questions RENAME TO old_assigned_questions;
ALTER TABLE IF EXISTS exam_sessions RENAME TO old_exam_sessions;
ALTER TABLE IF EXISTS test_cases RENAME TO old_test_cases;
ALTER TABLE IF EXISTS questions RENAME TO old_questions;
ALTER TABLE IF EXISTS students RENAME TO old_students;
ALTER TABLE IF EXISTS admins RENAME TO old_admins;
ALTER TABLE IF EXISTS integrity_events RENAME TO old_integrity_events;

-- STEP 2: CREATE NEW SCHEMA
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
  year TEXT NOT NULL,
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

CREATE TABLE admins (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  topic TEXT NOT NULL,
  difficulty TEXT DEFAULT 'MEDIUM' CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
  marks INTEGER NOT NULL,
  input_format TEXT NOT NULL,
  output_format TEXT NOT NULL,
  constraints TEXT NOT NULL,
  sample_input TEXT NOT NULL,
  sample_output TEXT NOT NULL,
  explanation TEXT,
  reference_solution TEXT,
  created_by UUID REFERENCES teachers(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'APPROVED' CHECK (status IN ('DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED')),
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

CREATE TABLE test_questions (
  test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  PRIMARY KEY (test_id, question_id)
);

CREATE TABLE exam_sessions (
  id TEXT PRIMARY KEY,
  test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'SUBMITTED', 'EXPIRED', 'PENDING_APPROVAL')),
  is_submitted BOOLEAN DEFAULT false,
  integrity_warnings INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- STEP 3: SEED ESSENTIAL DATA
INSERT INTO languages (name, slug, file_extension, compiler_command, run_command, version) VALUES
('C++', 'cpp', 'cpp', 'g++ -O2 -std=c++17', './a.out', 'C++17'),
('C', 'c', 'c', 'gcc -O2 -std=c11', './a.out', 'C11'),
('Python', 'python', 'py', NULL, 'python3', '3.10'),
('Java', 'java', 'java', 'javac', 'java', '17');

INSERT INTO branches (name, code) VALUES ('Artificial Intelligence & Data Science', 'AI&DS');
INSERT INTO subjects (name, code, branch_id, description) VALUES ('Data Structures and Algorithms', 'DSA', 1, 'Core DSA subject for SY');

-- Generate a fake admin user to own the migration
INSERT INTO users (id, email, full_name, role, password_hash) VALUES 
(gen_random_uuid(), 'admin@zcoer.edu.in', 'System Admin', 'ADMIN', '$2b$12$ecDX3F8AQZ4HluwbqMljzuSRGBoPD/Jr4FzL1Pdri5kMBLmaOqqd.');

-- STEP 4: MIGRATE OLD DATA
-- Students
INSERT INTO users (id, email, full_name, role, password_hash)
SELECT gen_random_uuid(), roll_no || '@student.zcoer.edu.in', name, 'STUDENT', 'default_hash' FROM old_students;

INSERT INTO students (id, roll_number, branch_id)
SELECT u.id, s.roll_no, 1
FROM users u JOIN old_students s ON u.full_name = s.name AND u.role = 'STUDENT';

-- Questions
INSERT INTO questions (id, title, slug, description, subject_id, topic, difficulty, marks, input_format, output_format, constraints, sample_input, sample_output, explanation)
SELECT id, title, REPLACE(LOWER(title), ' ', '-'), statement, 1, topic, 'MEDIUM', 10, input_format, output_format, constraints, example_input, example_output, 'Migrated from V1'
FROM old_questions;

-- Test Cases
INSERT INTO test_cases (id, question_id, input, expected_output, is_hidden, marks, order_index)
SELECT id, question_id, input, expected_output, (type = 'hidden' OR type = 'edge'), weight, id
FROM old_test_cases;

-- Create the DSA Test
INSERT INTO tests (id, title, description, subject_id, duration_minutes, total_marks, status, randomize_questions, questions_per_student)
VALUES (1, 'Unit II – DSA 30 Marks Online Coding Test', 'Existing DSA Test', 1, 60, 30, 'PUBLISHED', true, 3);

-- Link Questions to Test
INSERT INTO test_questions (test_id, question_id, order_index)
SELECT 1, id, id FROM old_questions;

-- Re-sync primary key sequences
SELECT setval('questions_id_seq', (SELECT MAX(id) FROM questions));
SELECT setval('test_cases_id_seq', (SELECT MAX(id) FROM test_cases));
SELECT setval('tests_id_seq', (SELECT MAX(id) FROM tests));

-- STEP 5: DROP OLD TABLES (Commented out for safety during migration phase)
-- DROP TABLE old_test_results;
-- DROP TABLE old_submissions;
-- DROP TABLE old_code_saves;
-- DROP TABLE old_assigned_questions;
-- DROP TABLE old_exam_sessions;
-- DROP TABLE old_test_cases;
-- DROP TABLE old_questions;
-- DROP TABLE old_students;
-- DROP TABLE old_admins;
-- DROP TABLE old_integrity_events;
