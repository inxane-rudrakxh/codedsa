import { loadEnvFile } from 'node:process';
loadEnvFile('.env.local');

async function clearRecords() {
  const { supabase } = await import('./lib/supabase');
  
  console.log('Clearing exam_sessions (this will cascade to assigned_questions and code_saves)...');
  const { error } = await supabase.from('exam_sessions').delete().neq('id', 'dummy');
  
  if (error) {
    console.error('Error clearing records:', error);
  } else {
    console.log('Successfully cleared all exam records!');
  }
}

clearRecords().catch(console.error);
