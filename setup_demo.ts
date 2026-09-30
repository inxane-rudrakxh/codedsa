import { loadEnvFile } from 'node:process';
loadEnvFile('.env.local');

async function setup() {
  const { supabase } = await import('./lib/supabase');
  
  // Set demo config in settings
  const demoConfig = {
    demo_rolls: ['AD1306', 'AD1354'],
    questions: {
      "5": { keyword: "DEMO-SORT", solution: "#include <iostream>\nusing namespace std;\n\nint main() {\n    int n;\n    cin >> n;\n    int a[100];\n    for(int i = 0; i < n; i++) cin >> a[i];\n    for(int i = 0; i < n - 1; i++) {\n        for(int j = 0; j < n - i - 1; j++) {\n            if(a[j] > a[j + 1]) {\n                swap(a[j], a[j + 1]);\n            }\n        }\n    }\n    for(int i = 0; i < n; i++) cout << a[i] << \" \";\n    cout << endl;\n    return 0;\n}", delay: 500 }
    }
  };

  await supabase.from('settings').upsert([
    { key: 'demo_config', value: JSON.stringify(demoConfig) }
  ]);
  
  console.log('Demo config set!');
}

setup().catch(console.error);
