import { callGroqModel, extractJsonObject } from './interviewService.js';

export function parseGitHubUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim().replace(/\/+$/, '');
  const match = trimmed.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)/i) ||
                trimmed.match(/^([^/\s]+)\/([^/\s#?]+)$/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/i, ''),
  };
}

export function decodeBase64Utf8(base64Str) {
  if (!base64Str) return '';
  try {
    const clean = base64Str.replace(/[\r\n\s]/g, '');
    const binary = atob(clean);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch (err) {
    try {
      return atob(base64Str.replace(/[\r\n\s]/g, ''));
    } catch {
      return '';
    }
  }
}

/**
 * Fetches real repository evidence from GitHub Public REST API.
 * Gathers repo metadata, decoded README, file structure tree, and manifest files (package.json/requirements.txt).
 */
export async function fetchGitHubRepoDetails(url) {
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    throw new Error('Please enter a valid GitHub repository URL (e.g. https://github.com/owner/repo or owner/repo).');
  }

  const { owner, repo } = parsed;
  const headers = { Accept: 'application/vnd.github.v3+json' };

  // 1. Fetch Repository Metadata
  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (repoRes.status === 404) {
    throw new Error(`Repository "${owner}/${repo}" was not found or is private. Make sure the repository is public.`);
  }
  if (repoRes.status === 403 || repoRes.status === 429) {
    throw new Error('GitHub API rate limit exceeded. You can switch to "Paste Description/Code" mode below.');
  }
  if (!repoRes.ok) {
    throw new Error(`Failed to fetch GitHub repo: ${repoRes.statusText}`);
  }
  const repoData = await repoRes.json();

  // 2. Fetch README
  let readme = '';
  try {
    const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers });
    if (readmeRes.ok) {
      const readmeData = await readmeRes.json();
      readme = decodeBase64Utf8(readmeData.content);
    }
  } catch {
    // README optional if not present
  }

  // 3. Fetch File Tree
  let fileTree = [];
  const defaultBranch = repoData.default_branch || 'main';
  try {
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, { headers });
    if (treeRes.ok) {
      const treeData = await treeRes.json();
      fileTree = (treeData.tree || []).map((node) => node.path);
    }
  } catch {
    // Tree fetch optional fallback
  }

  // 4. Fetch Manifest / Dependencies if present (package.json, requirements.txt, go.mod, Cargo.toml)
  let manifestName = '';
  let manifestContent = '';
  const manifestCandidates = ['package.json', 'requirements.txt', 'go.mod', 'Cargo.toml', 'pom.xml', 'docker-compose.yml', 'Dockerfile'];

  for (const candidate of manifestCandidates) {
    const foundPath = fileTree.find((p) => p.toLowerCase() === candidate || p.toLowerCase().endsWith('/' + candidate));
    if (foundPath) {
      try {
        const fileRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${foundPath}`, { headers });
        if (fileRes.ok) {
          const fileData = await fileRes.json();
          manifestName = foundPath;
          manifestContent = decodeBase64Utf8(fileData.content).slice(0, 3500);
          break;
        }
      } catch {
        // continue to next candidate
      }
    }
  }

  return {
    owner,
    repo,
    title: repoData.name,
    description: repoData.description || '',
    language: repoData.language || '',
    stars: repoData.stargazers_count,
    forks: repoData.forks_count,
    topics: repoData.topics || [],
    defaultBranch,
    readme: readme.slice(0, 7000),
    fileTree: fileTree.slice(0, 150),
    manifestName,
    manifestContent,
    htmlUrl: repoData.html_url,
  };
}

/**
 * Analyzes project using Groq LLM reasoning over real repo evidence or pasted architecture details.
 * Evaluates production health score, complexity level, tutorial clone probability,
 * detected tech stack, impressive strengths, gaps, and resume STAR bullets.
 */
export async function analyzeProjectWithAi(projectInput) {
  const {
    title,
    githubUrl = '',
    description = '',
    readme = '',
    fileTree = [],
    manifestName = '',
    manifestContent = '',
    codeSnippets = '',
  } = projectInput;

  const rawEvidence = `
Project Title: ${title}
GitHub URL: ${githubUrl || 'N/A'}
Project Description: ${description || 'N/A'}
Key File Tree Structure (Sample of ${fileTree.length} files):
${fileTree.slice(0, 80).join('\n') || 'N/A'}

Manifest (${manifestName || 'None'}):
${manifestContent || 'N/A'}

README Content (excerpt):
${readme.slice(0, 4500) || 'N/A'}

Code Snippets / Architecture Notes:
${codeSnippets.slice(0, 3000) || 'N/A'}
`.trim();

  const prompt = `You are a Principal Software Architect and Senior Technical Hiring Manager reviewing a software engineer's portfolio project.

Evaluate this project with rigorous engineering standards based on the real evidence provided below:
CRITICAL EVALUATION GUIDELINES:
1. Zero boilerplate and zero hardcoded metrics. All scores, detected tech, feedback, and resume bullets must reflect this exact project.
2. Tutorial Clone Assessment: Be honest. Does this look like a standard tutorial/bootcamp clone (e.g. basic ToDo list, weather app, standard Pokedex, unoriginal clone of Twitter/Netflix with no real backend or unique problem)? Or does it demonstrate original architectural thought, non-trivial data structures, custom workflows, or production considerations?
3. Complexity Level: Classify realistically as "Toy / Intro", "Moderate", "Substantial", or "Production-Grade".
4. Health Score (0-100):
   - Under 50: Toy app or superficial tutorial clone with minimal logic.
   - 50-69: Good starter project, but missing automated testing, CI/CD, security, or robust error handling.
   - 70-84: Substantial, well-structured full stack or backend project with clear domain logic.
   - 85+: Production-grade architecture with testing, dockerization, decoupled services, clear documentation, and scale considerations.
5. Quantified Resume Bullets: Provide 3-4 STAR-formatted bullet points demonstrating technical accomplishments, engineering decisions, and measurable scale or optimization that the candidate can copy directly onto their resume.

Evidence:
---
${rawEvidence}
---

Respond strictly with a JSON object adhering to this schema:
{
  "title": "${title || 'Project'}",
  "githubUrl": "${githubUrl}",
  "healthScore": <integer 0-100>,
  "complexityLevel": "<Toy / Intro | Moderate | Substantial | Production-Grade>",
  "isTutorialClone": <true | false>,
  "tutorialCloneReasoning": "<Honest 2-sentence rationale regarding whether this is a generic tutorial clone or original work>",
  "detectedStack": ["<Specific Tech 1>", "<Specific Tech 2>", "<Specific Tech 3>", "<Specific Tech 4>", "<Specific Tech 5>"],
  "stackCategorized": {
    "frontend": ["<frontend tech/libraries>"],
    "backend": ["<backend frameworks/runtimes>"],
    "database": ["<databases/ORMs/caches>"],
    "devops": ["<docker/ci/cd/cloud>"],
    "testing": ["<testing tools/patterns>"]
  },
  "impressiveAspects": [
    "<Concrete engineering strength 1 referencing actual files/architecture>",
    "<Concrete engineering strength 2>",
    "<Concrete engineering strength 3>"
  ],
  "portfolioGaps": [
    "<Tangible portfolio gap 1 (e.g. lack of integration tests, missing rate limiting, no db migrations)>",
    "<Tangible portfolio gap 2>",
    "<Tangible portfolio gap 3>"
  ],
  "resumeBullets": [
    "<STAR bullet 1: Designed and implemented [Feature] using [Stack], achieving [Outcome/Latency/Scale]>",
    "<STAR bullet 2: Engineered [Component], addressing [Challenge] with [Technique]>",
    "<STAR bullet 3: Optimized [System/API], reducing [Metric] through [Approach]>"
  ],
  "actionableRoadmap": [
    "<Step 1: Next high-impact improvement to elevate this project>",
    "<Step 2: Architecture or testing addition>",
    "<Step 3: DevOps or production readiness task>"
  ],
  "summary": "<2-3 sentence candid executive critique of the project's engineering caliber and portfolio readiness>"
}`;

  const responseText = await callGroqModel(
    [
      { role: 'system', content: 'You are a Principal Software Architect and Portfolio Evaluator. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.25, maxTokens: 2500 }
  );

  const parsedJson = extractJsonObject(responseText);
  parsedJson.rawEvidence = rawEvidence.slice(0, 1500);
  return parsedJson;
}
