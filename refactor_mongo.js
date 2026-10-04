const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all .ts and .tsx files
const files = execSync('find app -name "*.ts" -o -name "*.tsx"').toString().split('\n').filter(Boolean);

let totalReplacements = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace parseInt(id_fields) -> id_fields
  content = content.replace(/parseInt\((question_id|id|test_id|subject_id|qid)\)/g, '$1');
  
  // Replace object shorthand where applicable
  content = content.replace(/test_id:\s*parseInt\(test_id\)/g, 'test_id');
  content = content.replace(/question_id:\s*parseInt\(question_id\)/g, 'question_id');
  
  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
    totalReplacements++;
  }
}

console.log(`Total files updated: ${totalReplacements}`);
