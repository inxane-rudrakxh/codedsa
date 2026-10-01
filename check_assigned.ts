import { loadEnvFile } from 'node:process';
loadEnvFile('.env.local');

async function checkAssigned() {
  const { supabase } = await import('./lib/supabase');
  
  const rolls = ['AD1306', 'AD1308', 'AD1315', 'AD1354'];
  
  for (const roll of rolls) {
    // get latest session
    const { data: sessions } = await supabase.from('exam_sessions')
      .select('id')
      .eq('student_roll', roll)
      .order('start_time', { ascending: false })
      .limit(1);
      
    if (sessions && sessions.length > 0) {
      const sessionId = sessions[0].id;
      const { data: assigned } = await supabase.from('assigned_questions')
        .select('question_id, order_index, questions(title)')
        .eq('session_id', sessionId)
        .order('order_index', { ascending: true });
        
      console.log(`\nRoll No: ${roll}`);
      if (assigned && assigned.length > 0) {
        assigned.forEach(a => {
          console.log(`  - Q${a.question_id}: ${a.questions.title}`);
        });
      } else {
        console.log(`  (No questions assigned yet - session exists but no questions)`);
      }
    } else {
      console.log(`\nRoll No: ${roll}`);
      console.log(`  (Has not logged in yet - questions will be randomized upon first login)`);
    }
  }
}

checkAssigned().catch(console.error);
