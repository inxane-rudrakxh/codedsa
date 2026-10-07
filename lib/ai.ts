interface AIEvaluationResult {
  is_correct: boolean;
  score: number;
  feedback: string;
}

export async function evaluateCodeWithAI(
  questionTitle: string,
  questionStatement: string,
  studentCode: string,
  testCasesPassed: number,
  totalTestCases: number,
  maxMarks: number
): Promise<AIEvaluationResult | null> {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!apiKey || !endpoint || !deploymentName) {
    console.warn("Azure OpenAI credentials not fully configured.");
    return null;
  }

  // Clean up endpoint if it has trailing paths
  const cleanEndpoint = endpoint.replace(/\/openai\/.*$/, '').replace(/\/+$/, '');
  const url = `${cleanEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-15-preview`;

  const systemPrompt = `You are an expert Computer Science professor evaluating student code.
Evaluate the code and return ONLY a valid JSON object matching the format below.
Do not wrap it in markdown block quotes. Just the raw JSON.
{
  "is_correct": boolean,
  "score": number, // an integer from 0 to ${maxMarks}
  "feedback": "string explaining the assessment, max 2 sentences"
}
`;

  const userPrompt = `
Question Title: ${questionTitle}
Statement: ${questionStatement}

Student Code:
\`\`\`cpp
${studentCode}
\`\`\`

Test Cases Passed: ${testCasesPassed} out of ${totalTestCases}
Max Marks Available: ${maxMarks}

IMPORTANT GRADING RULES:
1. There is NO STRICTNESS on input and output formats. 
2. Students are allowed to use different examples, custom prompts (e.g. "Enter a number"), or even hardcoded arrays in their main function.
3. If 'Test Cases Passed' is 0, do NOT automatically fail them. They likely used their own custom inputs/outputs.
4. If their core algorithmic logic (e.g., sorting algorithm, searching logic, array operations) is correct and works for their own example, give them full marks.
5. Only deduct marks if the algorithmic logic itself is flawed or incomplete.

Based on these rules, assign a fair score and brief feedback.
`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_completion_tokens: 200,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Azure OpenAI Error:", errText);
      return null;
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const result = JSON.parse(content) as AIEvaluationResult;
    return result;
  } catch (error) {
    console.error("Failed to evaluate code with Azure OpenAI:", error);
    return null;
  }
}

export async function simulateCodeExecutionWithAI(code: string, language: string, customInput: string) {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!apiKey || !endpoint || !deploymentName) {
    return "Error: AI configuration missing.";
  }

  const cleanEndpoint = endpoint.replace(/\/openai\/.*$/, '').replace(/\/+$/, '');
  const url = `${cleanEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-15-preview`;

  const systemPrompt = `You are an incredibly fast and accurate C++ (or specified language) compiler and code executor.
Given the source code and the standard input provided by the user, you must output exactly what the program would print to standard output (stdout).
If there is a compilation error, output "COMPILATION_ERROR: <reason>".
If there is no output, just leave it blank.
DO NOT provide any markdown formatting, explanations, or backticks. Return ONLY the exact raw text output that the program would produce in a terminal.`;

  const userPrompt = `Language: ${language}

Source Code:
${code}

Standard Input (stdin):
${customInput}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_completion_tokens: 1500,
      }),
    });

    if (!response.ok) {
      return "Error: AI Simulation Failed.";
    }

    const data = await response.json();
    let content = data.choices[0].message.content || "";
    // Remove potential markdown block if the AI ignored instructions
    if (content.startsWith("```")) {
       const lines = content.split("\n");
       if (lines.length > 2) {
         lines.shift();
         if (lines[lines.length - 1].startsWith("```")) {
           lines.pop();
         }
         content = lines.join("\n");
       }
    }
    return content;
  } catch (err) {
    console.error("AI Simulation error", err);
    return "Error: AI Simulation crashed.";
  }
}
