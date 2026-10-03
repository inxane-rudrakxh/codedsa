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

  // Construct the Azure OpenAI REST endpoint
  // Format: https://{endpoint}/openai/deployments/{deployment-id}/chat/completions?api-version=2024-02-15-preview
  const url = `${endpoint.replace(/\/+$/, '')}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-15-preview`;

  const systemPrompt = `You are an expert Computer Science professor evaluating student code.
Evaluate the code strictly and return ONLY a valid JSON object matching the format below.
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

Based on the code's logic, time complexity, and the number of test cases passed, assign a fair score and brief feedback.
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
        max_tokens: 200,
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
