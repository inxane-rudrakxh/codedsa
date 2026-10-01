

async function testPiston() {
  const execRes = await fetch('https://wandbox.org/api/compile.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: '#include <iostream>\nusing namespace std;\nint main() { int x; cin >> x; cout << x * 2; return 0; }',
      compiler: 'gcc-head',
      stdin: '5'
    })
  });
  console.log(await execRes.json());
  console.log(await execRes.json());
}

testPiston();
