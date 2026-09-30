import { loadEnvFile } from 'node:process';
loadEnvFile('.env.local');

async function migrate() {
  console.log('Starting migration from SQLite to Supabase...');
  const { default: getDb } = await import('./lib/db');
  const { supabase } = await import('./lib/supabase');
  const { hashPassword } = await import('./lib/auth');

  const db = getDb();

  // 1. Settings
  console.log('Migrating settings...');
  const settings = db.prepare('SELECT * FROM settings').all() as any[];
  if (settings.length > 0) {
    await supabase.from('settings').upsert(settings);
  }

  // 2. Admins
  console.log('Migrating admins...');
  const admins = db.prepare('SELECT * FROM admins').all() as any[];
  if (admins.length > 0) {
    const adminInserts = admins.map(a => ({ username: a.username, password_hash: a.password_hash }));
    await supabase.from('admins').upsert(adminInserts);
  }

  // 3. Students
  console.log('Migrating students...');
  const students = db.prepare('SELECT * FROM students').all() as any[];
  if (students.length > 0) {
    const studentInserts = students.map(s => ({
      roll_no: s.roll_no,
      name: s.name,
      division: s.division,
      branch: s.branch,
      is_active: s.is_active
    }));
    await supabase.from('students').upsert(studentInserts);
  }

  // 4. Questions
  console.log('Migrating questions...');
  const questions = db.prepare('SELECT * FROM questions').all() as any[];
  if (questions.length > 0) {
    await supabase.from('questions').upsert(questions);
  }

  // 5. Test Cases
  console.log('Migrating test cases...');
  const testCases = db.prepare('SELECT * FROM test_cases').all() as any[];
  if (testCases.length > 0) {
    // We omit ID so Supabase assigns new IDs based on its serial
    const tcInserts = testCases.map(tc => ({
      id: tc.id,
      question_id: tc.question_id,
      input: tc.input,
      expected_output: tc.expected_output,
      type: tc.type,
      is_visible: tc.is_visible,
      weight: tc.weight
    }));
    await supabase.from('test_cases').upsert(tcInserts);
  }

  console.log('Migration complete!');
}

migrate().catch(console.error);
