import { callGroqModel, extractJsonObject } from './interviewService.js';

/**
 * Analyzes resume content using Groq LLM.
 * Returns an unsparing, realistic critique, category score breakdown,
 * line-specific feedback quoting real content, and verifiable certifications.
 */
export async function analyzeResumeWithAi(resumeText, targetRole = 'Software Engineer') {
  if (!resumeText || !resumeText.trim()) {
    throw new Error('Resume text is required for AI critique.');
  }

  const prompt = `You are a Principal Tech Recruiter and Senior ATS Engineer specializing in technical career progression for ${targetRole} positions.

Evaluate the following resume text rigorously, realistically, and constructively.
CRITICAL INSTRUCTIONS:
1. Do NOT use hardcoded or generic boilerplate text. Every comment, score, and recommendation MUST directly quote or reference specific text, skills, projects, and experiences found in the candidate's actual resume below.
2. Calibrate scores realistically (most unoptimized resumes score between 55 and 75).
3. Identify line-specific strengths (quote exact words or phrasing) and line-specific weaknesses (quote vague bullet points and explain how to improve them with metrics, scale, and action verbs).
4. For verified certifications: Recommend ONLY standard, recognized, verifiable credentials from established bodies (e.g. AWS, Microsoft Azure, Google Cloud, Meta/Coursera, CompTIA, Linux Foundation / CNCF, HashiCorp). For each certification, explain specifically why it closes a tangible gap identified in THIS resume.

Resume Text:
---
${resumeText.slice(0, 10000)}
---

Target Role: ${targetRole}

Respond strictly with a JSON object in this exact schema (no markdown outside the JSON):
{
  "overallScore": <integer 0-100>,
  "summary": "<honest 2-3 sentence assessment of the candidate's core strengths and main liability>",
  "scoreBreakdown": {
    "impact": {
      "score": <integer 0-100>,
      "feedback": "<detailed feedback on metrics, quantified results, scale, and business impact in their bullets>"
    },
    "formatting": {
      "score": <integer 0-100>,
      "feedback": "<detailed feedback on ATS readability, layout scannability, section hierarchy, and length>"
    },
    "skills": {
      "score": <integer 0-100>,
      "feedback": "<detailed feedback on relevance, currency, and depth of technical skills for the target role>"
    },
    "experience": {
      "score": <integer 0-100>,
      "feedback": "<detailed feedback on career progression, complexity of responsibilities, and seniority level>"
    }
  },
  "whatsWorking": [
    "<strong point 1 quoting or citing specific bullet/project>",
    "<strong point 2 quoting or citing specific bullet/project>",
    "<strong point 3 quoting or citing specific bullet/project>"
  ],
  "whatToFix": [
    "<weak point 1 quoting weak wording, missing metric, or gap, with direct fix suggestion>",
    "<weak point 2 quoting weak wording, missing metric, or gap, with direct fix suggestion>",
    "<weak point 3 quoting weak wording, missing metric, or gap, with direct fix suggestion>"
  ],
  "sectionFeedback": {
    "summary": "<evaluation of professional summary or objective, or recommendation to add one>",
    "experience": "<evaluation of work experience bullet depth and action verbs>",
    "projects": "<evaluation of projects: do they demonstrate real problem solving or look like basic tutorials?>",
    "skills": "<evaluation of how skills are grouped and organized>",
    "education": "<evaluation of education details and positioning>"
  },
  "verifiedCertifications": [
    {
      "name": "<Exact official certification name, e.g. AWS Certified Solutions Architect – Associate>",
      "issuingBody": "<Official issuing organization, e.g. Amazon Web Services>",
      "rationale": "<Specific explanation of why this credential solves a concrete gap in this resume>",
      "difficulty": "<Foundational | Associate | Professional>"
    }
  ]
}`;

  const responseText = await callGroqModel(
    [
      { role: 'system', content: 'You are an expert technical resume reviewer and ATS specialist. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.25, maxTokens: 2500 }
  );

  return extractJsonObject(responseText);
}

/**
 * Compares resume text with a specific Job Description (JD).
 * Generates match score, keyword comparison, tailored summary, and targeted bullet rewrites.
 */
export async function tailorResumeToJob(resumeText, jobDescription, targetRole = 'Software Engineer') {
  if (!resumeText || !resumeText.trim()) {
    throw new Error('Resume text is required.');
  }
  if (!jobDescription || !jobDescription.trim()) {
    throw new Error('Please provide a job description to tailor against.');
  }

  const prompt = `You are an elite Tech Career Coach and ATS optimization expert.
Compare the candidate's actual resume against the specific target Job Description (JD).

Resume Text:
---
${resumeText.slice(0, 8000)}
---

Target Job Description:
---
${jobDescription.slice(0, 6000)}
---

Target Role: ${targetRole}

Provide a deep, realistic gap analysis and optimization guide.
Return strictly a JSON object with this exact structure:
{
  "matchScore": <integer 0-100 reflecting true keyword and experience overlap>,
  "overview": "<2 sentence summary of candidate fit for this specific job>",
  "matchingKeywords": ["<keyword 1>", "<keyword 2>", "<keyword 3>", "<keyword 4>", "<keyword 5>"],
  "missingKeywords": ["<critical requirement 1 in JD missing from resume>", "<critical requirement 2>", "<critical requirement 3>", "<critical requirement 4>"],
  "tailoredSummary": "<A compelling 3-4 sentence professional summary written specifically to hook this hiring team, blending candidate background with JD requirements>",
  "bulletRewrites": [
    {
      "original": "<An actual weak or unaligned bullet from the candidate's resume>",
      "rewritten": "<The rewritten bullet using the Google XYZ formula (Accomplished [X] as measured by [Y] by doing [Z]), weaving in JD keywords without lying>",
      "reason": "<Explanation of why this rewrite catches the recruiter's eye for this specific role>"
    },
    {
      "original": "<Second weak or unaligned bullet from resume>",
      "rewritten": "<Rewritten bullet>",
      "reason": "<Explanation>"
    },
    {
      "original": "<Third weak or unaligned bullet from resume>",
      "rewritten": "<Rewritten bullet>",
      "reason": "<Explanation>"
    }
  ],
  "interviewPrepTips": [
    "<High-probability interview question targeting the candidate's biggest gap against this JD, and how to address it>",
    "<Technical question likely to be asked given the tech stack in JD>",
    "<Behavioral or situational tip for this team>"
  ]
}`;

  const responseText = await callGroqModel(
    [
      { role: 'system', content: 'You are an ATS resume tailoring specialist. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.25, maxTokens: 2500 }
  );

  return extractJsonObject(responseText);
}
