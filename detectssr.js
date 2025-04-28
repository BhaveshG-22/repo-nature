const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

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
    // Determine if input is a GitHub URL
    const githubRegex = /github\.com\/([^\/]+)\/([^\/]+)/;
    const isGithubUrl = githubRegex.test(repoPathOrUrl);
    
    let packageJson = null;
    let repoPath = repoPathOrUrl;
    let repoContents = {};
    let repoStructure = [];
    
    // Initialize Octokit if GitHub token provided
    const octokit = githubToken ? new Octokit({ auth: githubToken }) : new Octokit();
    
    // Handle GitHub URL
    if (isGithubUrl) {
      const match = repoPathOrUrl.match(githubRegex);
      const owner = match[1];
      const repo = match[2].replace('.git', '');
      
      results.evidence.push(`Analyzing GitHub repository: ${owner}/${repo}`);
      
      // Get repository contents
      repoContents = await getGithubRepoContents(octokit, owner, repo);
      repoStructure = await buildRepoStructure(octokit, owner, repo);
      
      // Get package.json content if exists
      const packageJsonContent = await getFileFromGithub(octokit, owner, repo, 'package.json');
      if (packageJsonContent) {
        packageJson = JSON.parse(packageJsonContent);
      }
    } else {
      // Local file system analysis
      const packageJsonPath = path.join(repoPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      }
    }
    
    // Analyze package.json if found
    if (packageJson) {
      // Check dependencies for SSR frameworks
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
      
      const ssrLibraries = [
        'react-dom/server',
        'vue-server-renderer',
        'preact-render-to-string',
        'svelte/server',
        'express-react-views'
      ];
      
      // Check for SSR frameworks
      for (const [dep, framework] of Object.entries(ssrFrameworks)) {
        if (allDependencies[dep]) {
          results.evidence.push(`Found SSR framework: ${framework} (${dep})`);
          results.frameworkDetected = framework;
          results.confidence += 30;
          results.needsSSR = true;
        }
      }
      
      // Check for SSR libraries
      for (const lib of ssrLibraries) {
        const libName = lib.split('/')[0];
        if (allDependencies[libName]) {
          results.evidence.push(`Found potential SSR library: ${libName}`);
          results.confidence += 10;
        }
      }
      
      // Check for server packages
      const serverPackages = ['express', 'koa', 'fastify', 'hapi', '@nestjs/core'];
      for (const pkg of serverPackages) {
        if (allDependencies[pkg]) {
          results.evidence.push(`Found server package: ${pkg}`);
          results.confidence += 5;
        }
      }
    }
    
    // 2. Check for configuration files
    const configFiles = {
      'next.config.js': 'Next.js',
      'nuxt.config.js': 'Nuxt.js',
      'svelte.config.js': 'SvelteKit',
      'remix.config.js': 'Remix',
      'gatsby-config.js': 'Gatsby',
      'angular.json': 'Angular'
    };
    
    if (isGithubUrl) {
      const match = repoPathOrUrl.match(githubRegex);
      const owner = match[1];
      const repo = match[2].replace('.git', '');
      
      // Check if config files exist in GitHub repo
      for (const [file, framework] of Object.entries(configFiles)) {
        const fileExists = repoStructure.some(item => item === file);
        if (fileExists) {
          results.evidence.push(`Found configuration file for ${framework}: ${file}`);
          results.frameworkDetected = results.frameworkDetected || framework;
          results.confidence += 20;
          results.needsSSR = true;
        }
      }
    } else {
      // Local file system check
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
    
    // 3. Check for project structure indicators
    const ssrDirectories = [
      { path: 'pages', framework: 'Next.js' },
      { path: 'pages/api', framework: 'Next.js API Routes' },
      { path: 'app', framework: 'Next.js App Router' },
      { path: 'server', framework: 'Generic Server' },
      { path: 'serverless', framework: 'Serverless Functions' },
      { path: 'api', framework: 'API Routes' },
      { path: 'functions', framework: 'Serverless Functions' },
      { path: 'lambda', framework: 'AWS Lambda Functions' },
    ];
    
    if (isGithubUrl) {
      // Use repoStructure to check for SSR directories
      const match = repoPathOrUrl.match(githubRegex);
      const owner = match[1];
      const repo = match[2].replace('.git', '');
      
      for (const dir of ssrDirectories) {
        // Check if directory exists in structure
        const dirExists = repoStructure.some(item => 
          item === dir.path || item.startsWith(`${dir.path}/`)
        );
        
        if (dirExists) {
          results.evidence.push(`Found SSR-related directory: ${dir.path} (indicates ${dir.framework})`);
          results.confidence += 10;
          
          // For Next.js pages, check for getServerSideProps or getInitialProps
          if (dir.path === 'pages' || dir.path === 'app') {
            // This is harder to do with GitHub API, we'll sample a few files
            const hasSSRFunctions = await searchForSSRFunctionsInGithub(octokit, owner, repo, dir.path);
            if (hasSSRFunctions) {
              results.evidence.push(`Found SSR functions (getServerSideProps or getInitialProps) in ${dir.path}`);
              results.confidence += 15;
              results.needsSSR = true;
            }
          }
        }
      }
    } else {
      // Local file system check
      for (const dir of ssrDirectories) {
        const dirPath = path.join(repoPath, dir.path);
        if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
          results.evidence.push(`Found SSR-related directory: ${dir.path} (indicates ${dir.framework})`);
          results.confidence += 10;
          
          // For Next.js pages, check for getServerSideProps or getInitialProps
          if (dir.path === 'pages' || dir.path === 'app') {
            const hasSSRFunctions = searchForSSRFunctions(dirPath);
            if (hasSSRFunctions) {
              results.evidence.push(`Found SSR functions (getServerSideProps or getInitialProps) in ${dir.path}`);
              results.confidence += 15;
              results.needsSSR = true;
            }
          }
        }
      }
    }
    
    // 4. Check for SSR-specific patterns in code
    if (isGithubUrl) {
      const match = repoPathOrUrl.match(githubRegex);
      const owner = match[1];
      const repo = match[2].replace('.git', '');
      
      const hasRenderToString = await searchForPatternInGithub(octokit, owner, repo, 'renderToString');
      if (hasRenderToString) {
        results.evidence.push('Found renderToString calls (React SSR)');
        results.confidence += 15;
        results.needsSSR = true;
      }
    } else {
      const hasRenderToString = searchForPattern(repoPath, 'renderToString');
      if (hasRenderToString) {
        results.evidence.push('Found renderToString calls (React SSR)');
        results.confidence += 15;
        results.needsSSR = true;
      }
    }
    
    // Final confidence calculation
    if (results.confidence > 30) {
      results.needsSSR = true;
    }
    
  } catch (error) {
    results.evidence.push(`Error analyzing repository: ${error.message}`);
  }
  
  return results;
}

/**
 * Search for SSR functions in Next.js pages
 * @param {string} dirPath - Path to directory to search
 * @returns {boolean} True if SSR functions found
 */
function searchForSSRFunctions(dirPath) {
  const files = getAllFiles(dirPath, ['.js', '.jsx', '.ts', '.tsx']);
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      if (
        content.includes('getServerSideProps') ||
        content.includes('getInitialProps') ||
        content.includes('getStaticProps') ||
        // For App Router
        content.includes('export async function generateMetadata') ||
        content.includes('export const generateMetadata')
      ) {
        return true;
      }
    } catch (error) {
      // Skip file if cannot read
    }
  }
  
  return false;
}

/**
 * Search for specific pattern in code files
 * @param {string} dirPath - Path to directory to search
 * @param {string} pattern - Pattern to search for
 * @returns {boolean} True if pattern found
 */
function searchForPattern(dirPath, pattern) {
  const files = getAllFiles(dirPath, ['.js', '.jsx', '.ts', '.tsx']);
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes(pattern)) {
        return true;
      }
    } catch (error) {
      // Skip file if cannot read
    }
  }
  
  return false;
}

/**
 * Get all files recursively from a directory with specific extensions
 * @param {string} dirPath - Directory path to search
 * @param {Array} extensions - File extensions to include
 * @returns {Array} List of file paths
 */
function getAllFiles(dirPath, extensions = [], arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    
    if (fs.statSync(filePath).isDirectory()) {
      // Skip node_modules and .git directories
      if (file !== 'node_modules' && file !== '.git') {
        getAllFiles(filePath, extensions, arrayOfFiles);
      }
    } else {
      const ext = path.extname(file);
      if (extensions.length === 0 || extensions.includes(ext)) {
        arrayOfFiles.push(filePath);
      }
    }
  });
  
  return arrayOfFiles;
}

/**
 * Get contents of a GitHub repository
 * @param {Octokit} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Object} Repository contents
 */
async function getGithubRepoContents(octokit, owner, repo) {
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path: ''
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching repo contents: ${error.message}`);
    return [];
  }
}

/**
 * Build a flat structure of the repository
 * @param {Octokit} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - Current path in repository
 * @param {Array} structure - Accumulated structure
 * @returns {Array} Flat structure of repository paths
 */
async function buildRepoStructure(octokit, owner, repo, path = '', structure = []) {
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path
    });
    
    const contents = Array.isArray(response.data) ? response.data : [response.data];
    
    for (const item of contents) {
      const itemPath = path ? `${path}/${item.name}` : item.name;
      structure.push(itemPath);
      
      // Don't go too deep to avoid rate limiting
      if (item.type === 'dir' && structure.length < 100) {
        await buildRepoStructure(octokit, owner, repo, itemPath, structure);
      }
    }
    
    return structure;
  } catch (error) {
    console.error(`Error building repo structure: ${error.message}`);
    return structure;
  }
}

/**
 * Get a file from GitHub
 * @param {Octokit} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @returns {string|null} File content or null
 */
async function getFileFromGithub(octokit, owner, repo, path) {
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path
    });
    
    // Content is base64 encoded
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    return content;
  } catch (error) {
    // File doesn't exist or other error
    return null;
  }
}

/**
 * Search for SSR functions in GitHub repository
 * @param {Octokit} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} dirPath - Directory path to check
 * @returns {boolean} True if SSR functions found
 */
async function searchForSSRFunctionsInGithub(octokit, owner, repo, dirPath) {
  try {
    // Search GitHub code API
    const searchResults = await octokit.search.code({
      q: `repo:${owner}/${repo} path:${dirPath} getServerSideProps OR getInitialProps OR getStaticProps OR generateMetadata`,
      per_page: 10
    });
    
    return searchResults.data.total_count > 0;
  } catch (error) {
    console.error(`Error searching for SSR functions: ${error.message}`);
    return false;
  }
}

/**
 * Search for pattern in GitHub repository
 * @param {Octokit} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} pattern - Pattern to search for
 * @returns {boolean} True if pattern found
 */
async function searchForPatternInGithub(octokit, owner, repo, pattern) {
  try {
    // Search GitHub code API
    const searchResults = await octokit.search.code({
      q: `repo:${owner}/${repo} ${pattern}`,
      per_page: 10
    });
    
    return searchResults.data.total_count > 0;
  } catch (error) {
    console.error(`Error searching for pattern: ${error.message}`);
    return false;
  }
}

/**
 * Main function
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

// Run the script if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  detectSSR,
  searchForSSRFunctions,
  searchForPattern,
  getAllFiles,
  searchForSSRFunctionsInGithub,
  searchForPatternInGithub,
  getGithubRepoContents,
  getFileFromGithub,
  buildRepoStructure
};