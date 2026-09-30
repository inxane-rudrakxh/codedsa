import { loadEnvFile } from 'node:process';
loadEnvFile('.env.local');

async function test() {
  const { supabase } = await import('./lib/supabase');
  const { data, error } = await supabase.from('students').select('*').limit(5);
  console.log("Error:", error);
  console.log("Students:", data);
}

test();
