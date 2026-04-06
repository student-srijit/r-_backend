import axios from "axios";

// Map of provider keys to their default base URLs (OpenAI-compatible unless noted)
const PROVIDER_BASE_URLS = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  together: "https://api.together.xyz/v1",
  deepinfra: "https://api.deepinfra.com/v1/openai",
  openrouter: "https://openrouter.ai/api/v1",
  mistral: "https://api.mistral.ai/v1",
  perplexity: "https://api.perplexity.ai",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  // 'anthropic' is handled separately — different API format
  // 'custom' requires caller to supply baseUrl
};

export class LLMService {
  constructor(apiKey, provider, model, baseUrl) {
    if (!apiKey) throw new Error("API key is required");
    if (!provider) throw new Error("Provider is required");
    if (!model) throw new Error("Model name is required");

    this.apiKey = apiKey;
    this.provider = provider.toLowerCase().trim();
    this.model = model.trim();

    if (this.provider === "custom") {
      if (!baseUrl) throw new Error("baseUrl is required for custom provider");
      this.baseURL = baseUrl.replace(/\/$/, "");
    } else if (this.provider === "anthropic") {
      this.baseURL = "https://api.anthropic.com/v1";
    } else {
      const resolved = PROVIDER_BASE_URLS[this.provider];
      if (!resolved) {
        throw new Error(
          `Unknown provider "${provider}". Valid providers: ${Object.keys(PROVIDER_BASE_URLS).concat(["anthropic", "custom"]).join(", ")}`,
        );
      }
      this.baseURL = resolved;
    }
  }

  async analyzeContent(content, type = "general", options = {}) {
    try {
      const evidenceMode = Boolean(options?.evidenceMode);
      const baseShape = evidenceMode
        ? `{
  "summary": "string",
  "keyPoints": ["string"],
  "evidence": [
    {
      "claim": "string",
      "quote": "string",
      "confidence": "high|medium|low"
    }
  ],
  "importantConcepts": ["string"],
  "practicalApplications": ["string"],
  "discussionQuestions": ["string"]
}`
        : `{
  "summary": "string",
  "keyPoints": ["string"],
  "importantConcepts": ["string"],
  "practicalApplications": ["string"],
  "discussionQuestions": ["string"]
}`;

      const evidenceRules = evidenceMode
        ? `
- evidence must contain 3-6 entries.
- quote must be a verbatim excerpt from the provided content.
- each claim should be directly supported by its quote.
- confidence must be one of: high, medium, low.`
        : "";

      const prompt =
        type === "research_paper"
          ? `You are analyzing a technical research paper. Return ONLY valid JSON with this exact shape:
${baseShape}

Requirements:
- summary must be very detailed (350-500 words), technically accurate, and easy to follow.
- keyPoints must contain 6-10 concrete takeaways.
${evidenceRules}
- importantConcepts must contain 5-8 concept+definition bullets.
- practicalApplications must contain 4-7 real-world applications.
- discussionQuestions must contain 4-6 thought-provoking questions.
- No markdown, no code fences, no extra keys.

Content:
${content}`
          : `You are analyzing general technical content. Return ONLY valid JSON with this exact shape:
${baseShape}

Requirements:
- summary must be very detailed (300-450 words), clear, and structured.
- keyPoints must contain 6-10 concrete takeaways.
${evidenceRules}
- importantConcepts must contain 4-7 concept+definition bullets.
- practicalApplications must contain 3-6 real-world applications.
- discussionQuestions must contain 3-5 thought-provoking questions.
- No markdown, no code fences, no extra keys.

Content:
${content}`;

      return await this.callLLM(prompt, "json");
    } catch (error) {
      throw new Error(`Content analysis failed: ${error.message}`);
    }
  }

  async generateInterviewQuestions(
    researchContent,
    company,
    difficulty,
    companyContext,
  ) {
    try {
      const difficultyPrompt =
        difficulty === "easy"
          ? "straightforward and fundamental"
          : difficulty === "hard"
            ? "highly challenging and advanced"
            : "moderately challenging";

      const contextSection = companyContext
        ? `\nCompany Interview Style for ${company}:\n${companyContext}\n`
        : "";

      const prompt = `Based on the following research content, generate 8 interview questions for a ${company} interview at ${difficultyPrompt} level. The questions should rigorously test understanding of the concepts in the research.${contextSection}
Important: Match the exact difficulty and style described above for ${company}. Do NOT make questions generic.

For each question, provide:
- The question itself
- A topic area
- Difficulty level (easy/medium/hard)
- 2-3 helpful hints

Format as JSON array only, no markdown: [{"question": "...", "topic": "...", "difficulty": "...", "hints": [...]}]

Research Content:
${researchContent}`;

      const response = await this.callLLM(prompt, "json");
      return response;
    } catch (error) {
      throw new Error(`Interview generation failed: ${error.message}`);
    }
  }

  async generateFeedback(question, userAnswer) {
    try {
      const prompt = `Provide feedback on the following answer to an interview question. Be constructive and specific.

Question: ${question}
User's Answer: ${userAnswer}

Provide feedback in 2-3 sentences mentioning:
1. What was done well
2. Areas for improvement`;

      return await this.callLLM(prompt, "feedback");
    } catch (error) {
      throw new Error(`Feedback generation failed: ${error.message}`);
    }
  }

  async generateVoiceScript(
    researchTitle,
    researchField,
    description,
    notes,
    analysisSummaries,
  ) {
    try {
      const contentParts = [
        `Title: ${researchTitle}`,
        `Field: ${researchField}`,
        description && `Description: ${description}`,
        notes && `Notes: ${notes}`,
        analysisSummaries.length > 0 &&
          `Key Findings:\n${analysisSummaries.join("\n")}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      const prompt = `Generate a clear, engaging voice narration script (300-400 words) for the following research topic.

    Style requirements (important):
    - Sound like a real human mentor speaking naturally, not an AI assistant.
    - Use short, conversational sentences with occasional emphasis phrases.
    - Avoid robotic list formatting and avoid repetitive sentence openings.
    - Include smooth transitions and one short practical takeaway at the end.
    - Do not include stage directions, headers, markdown, or bullet points.

${contentParts}`;

      return await this.callLLM(prompt, "text");
    } catch (error) {
      throw new Error(`Voice script generation failed: ${error.message}`);
    }
  }

  async generateFlashcards(researchTitle, analysisSummaries) {
    try {
      const contentParts = [
        `Research Topic: ${researchTitle}`,
        analysisSummaries.length > 0
          ? `Content:\n${analysisSummaries.join("\n\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const prompt = `Generate 10 study flashcards for the following research topic. Each flashcard should have a concise question and a clear, accurate answer.

Format as JSON array only, no markdown or extra text: [{"question": "...", "answer": "..."}]

${contentParts}`;

      return await this.callLLM(prompt, "json");
    } catch (error) {
      throw new Error(`Flashcard generation failed: ${error.message}`);
    }
  }

  async callLLM(prompt, type = "text") {
    try {
      let content;

      if (this.provider === "anthropic") {
        content = await this._callAnthropic(prompt);
      } else {
        content = await this._callOpenAICompat(prompt);
      }

      if (type === "json") {
        // Strip potential markdown code fences
        const cleaned = content
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        try {
          return JSON.parse(cleaned);
        } catch {
          return cleaned;
        }
      }

      return content;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error("Invalid API key for the selected provider");
      }
      if (error.response?.status === 403) {
        throw new Error("API key does not have permission for this operation");
      }
      if (error.response?.data?.error?.message) {
        throw new Error(error.response.data.error.message);
      }
      throw error;
    }
  }

  async _callOpenAICompat(prompt) {
    const response = await axios.post(
      `${this.baseURL}/chat/completions`,
      {
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful AI assistant specializing in research analysis and interview preparation.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          // OpenRouter requires this; harmless for others
          "HTTP-Referer": "https://research-plus.app",
          "X-Title": "Research Plus",
        },
        timeout: 60000,
      },
    );
    return response.data.choices[0].message.content;
  }

  async _callAnthropic(prompt) {
    const response = await axios.post(
      `${this.baseURL}/messages`,
      {
        model: this.model,
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        system:
          "You are a helpful AI assistant specializing in research analysis and interview preparation.",
      },
      {
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        timeout: 60000,
      },
    );
    return response.data.content[0].text;
  }
}

export const createLLMService = (apiKey, provider, model, baseUrl) => {
  return new LLMService(apiKey, provider, model, baseUrl);
};
