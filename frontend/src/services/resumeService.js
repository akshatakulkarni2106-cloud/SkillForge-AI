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

  const prompt = `You are a Principal Tech Recruiter and Senior ATS Evaluation Engineer specializing in ${targetRole} technical hiring.

Evaluate the candidate resume below specifically and objectively against the industry requirements for a "${targetRole}".

OBJECTIVE SCORING CRITERIA (0-100 scale, evaluate strictly based on alignment with "${targetRole}"):
1. Skills & Tech Stack Alignment (30% weight):
   - Compare candidate's specific programming languages, frameworks, libraries, databases, and tools directly against modern requirements for a ${targetRole}.
   - If the candidate's tech stack matches 80%+ of core ${targetRole} requirements (e.g. MERN stack for Full Stack/MERN Developer, React for Frontend), score high (78-95).
   - If the resume is missing fundamental technologies required for ${targetRole} (e.g. applying for DevOps without CI/CD/Cloud or AI/ML without Python/PyTorch), score proportionally lower (30-55).
2. Impact & Metrics (25% weight):
   - Check if bullet points include quantified business outcomes, metrics, scale, percentages, latency improvements, or user counts.
   - If bullets describe responsibilities without metrics, provide actionable advice on what numbers to quantify.
3. Role Relevance & Experience (25% weight):
   - Assess depth of projects, real-world internships, code ownership, system complexity, and production deployment relative to the seniority expectations of a ${targetRole}.
4. Brevity & ATS Scannability (20% weight):
   - Check section hierarchy, bullet structure, standard headings, clear contact links, and ATS parseability.

CRITICAL INSTRUCTIONS:
- Every comment, strength, weakness, and recommendation MUST directly quote or reference specific text, skills, projects, and experiences found in the candidate's actual resume below.
- Do NOT use generic placeholder text.
- Do NOT arbitrarily force scores into a narrow band. The score MUST genuinely reflect how well the candidate's actual profile matches "${targetRole}".

Resume Text:
---
${resumeText.slice(0, 10000)}
---

Target Role: ${targetRole}

Respond strictly with a JSON object in this exact schema (no markdown outside the JSON):
{
  "overallScore": <integer 0-100 calculated as weighted sum: Math.round(impact*0.25 + formatting*0.20 + skills*0.30 + experience*0.25)>,
  "summary": "<honest, role-tailored 2-3 sentence assessment of candidate fit for ${targetRole}, their greatest competitive edge, and key growth area>",
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
      "feedback": "<detailed feedback comparing candidate skills against requirements for ${targetRole}>"
    },
    "experience": {
      "score": <integer 0-100>,
      "feedback": "<detailed feedback on project complexity and experience relevance to ${targetRole}>"
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
      "rationale": "<Specific explanation of why this credential solves a concrete gap in this resume for ${targetRole}>",
      "difficulty": "<Foundational | Associate | Professional>"
    }
  ]
}`;

  const responseText = await callGroqModel(
    [
      { role: 'system', content: 'You are an expert technical resume reviewer and ATS ranking specialist. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.35, maxTokens: 2500 }
  );

  const parsed = extractJsonObject(responseText);

  // Mathematically guarantee that overallScore matches the weighted category scores
  if (parsed?.scoreBreakdown) {
    const impact = Number(parsed.scoreBreakdown.impact?.score) || 50;
    const formatting = Number(parsed.scoreBreakdown.formatting?.score) || 65;
    const skills = Number(parsed.scoreBreakdown.skills?.score) || 60;
    const experience = Number(parsed.scoreBreakdown.experience?.score) || 50;

    const weightedScore = Math.round(
      (skills * 0.30) + (impact * 0.25) + (experience * 0.25) + (formatting * 0.20)
    );

    parsed.overallScore = Math.min(100, Math.max(10, weightedScore));
  }

  return parsed;
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
