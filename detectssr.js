const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Analyzes a repository to determine if it requires SSR
 * @param {string} repoPathOrUrl - Path to the repository or GitHub URL
 * @param {string} githubToken - Optional GitHub API token
 * @returns {Object} Analysis results
 */
async function detectSSR(repoPathOrUrl, githubToken = null) {
  const results = {
    needsSSR: false,
    evidence: [],
    frameworkDetected: null,
    confidence: 0
  };

  try {
    const githubRegex = /github\.com\/([^\/]+)\/([^\/]+)/;
    const isGithubUrl = githubRegex.test(repoPathOrUrl);

    let packageJson = null;
    let repoPath = repoPathOrUrl;
    let repoStructure = [];

    if (isGithubUrl) {
      const match = repoPathOrUrl.match(githubRegex);
      const owner = match[1];
      const repo = match[2].replace('.git', '');

      results.evidence.push(`Analyzing GitHub repository: ${owner}/${repo}`);

      repoStructure = await buildRepoStructure(owner, repo, githubToken);

      const packageJsonContent = await getFileFromGithub(owner, repo, 'package.json', githubToken);
      if (packageJsonContent) {
        packageJson = JSON.parse(packageJsonContent);
      }
    } else {
      const packageJsonPath = path.join(repoPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      }
    }

    if (packageJson) {
      const allDependencies = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {})
      };

      const ssrFrameworks = {
        'next': 'Next.js',
        'nuxt': 'Nuxt.js',
        '@nuxt/core': 'Nuxt.js',
        '@sveltejs/kit': 'SvelteKit',
        '@remix-run/react': 'Remix',
        'gatsby': 'Gatsby',
        'angular-universal': 'Angular Universal',
        '@angular/platform-server': 'Angular Universal',
        '@nestjs/ng-universal': 'Nest.js with Angular Universal'
      };

      for (const [dep, framework] of Object.entries(ssrFrameworks)) {
        if (allDependencies[dep]) {
          results.evidence.push(`Found SSR framework: ${framework} (${dep})`);
          results.frameworkDetected = framework;
          results.confidence += 30;
          results.needsSSR = true;
        }
      }
    }

    const configFiles = {
      'next.config.js': 'Next.js',
      'nuxt.config.js': 'Nuxt.js',
      'svelte.config.js': 'SvelteKit',
      'remix.config.js': 'Remix',
      'gatsby-config.js': 'Gatsby',
      'angular.json': 'Angular'
    };

    if (isGithubUrl) {
      for (const [file, framework] of Object.entries(configFiles)) {
        if (repoStructure.includes(file)) {
          results.evidence.push(`Found configuration file for ${framework}: ${file}`);
          results.frameworkDetected = results.frameworkDetected || framework;
          results.confidence += 20;
          results.needsSSR = true;
        }
      }
    } else {
      for (const [file, framework] of Object.entries(configFiles)) {
        const configPath = path.join(repoPath, file);
        if (fs.existsSync(configPath)) {
          results.evidence.push(`Found configuration file for ${framework}: ${file}`);
          results.frameworkDetected = results.frameworkDetected || framework;
          results.confidence += 20;
          results.needsSSR = true;
        }
      }
    }

    if (results.confidence > 30) {
      results.needsSSR = true;
    }

  } catch (error) {
    results.evidence.push(`Error analyzing repository: ${error.message}`);
  }

  return results;
}

async function buildRepoStructure(owner, repo, githubToken) {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    ...(githubToken && { Authorization: `token ${githubToken}` })
  };

  try {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/`, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status}`);
    }

    const data = await res.json();
    return data.map(item => item.name);
  } catch (err) {
    console.error('Error building repo structure:', err.message);
    return [];
  }
}

async function getFileFromGithub(owner, repo, filePath, githubToken) {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    ...(githubToken && { Authorization: `token ${githubToken}` })
  };

  try {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${filePath}`, { headers });
    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return Buffer.from(data.content, 'base64').toString('utf8');
  } catch (err) {
    console.error('Error fetching file from GitHub:', err.message);
    return null;
  }
}

/**
 * Main function (CLI mode)
 */
async function main() {
  const input = process.argv[2] || '.';
  const githubToken = process.env.GITHUB_TOKEN;

  console.log(`Analyzing repository: ${input}...`);
  try {
    const results = await detectSSR(input, githubToken);

    console.log('\n=== SSR DETECTION RESULTS ===');
    console.log(`Needs SSR: ${results.needsSSR ? 'YES' : 'NO'}`);
    console.log(`Framework Detected: ${results.frameworkDetected || 'None'}`);
    console.log(`Confidence: ${results.confidence}%`);
    console.log('\nEvidence:');
    results.evidence.forEach((item, index) => {
      console.log(`${index + 1}. ${item}`);
    });
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

// If run from terminal
if (require.main === module) {
  main().catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  detectSSR,
};
