# Repo Nature

A service to detect if a repository requires Server-Side Rendering (SSR).

## Description

Repo Nature is a tool that analyzes GitHub repositories or local project directories to determine if they require Server-Side Rendering (SSR). It examines various indicators such as framework dependencies, configuration files, directory structures, and code patterns to identify the need for SSR.

The tool can identify popular SSR frameworks like:
- Next.js
- Nuxt.js
- SvelteKit
- Remix
- Gatsby
- Angular Universal
- And more

## Features

- Analyze local repositories or GitHub URLs
- Detect SSR frameworks and libraries
- Identify server-side packages
- Recognize SSR-specific configuration files
- Examine project structures for SSR indicators
- Search code for SSR-specific patterns
- Provide confidence score for SSR detection
- Generate detailed evidence for findings

## Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd repo-nature

# Install dependencies
npm install
```

## Usage

### As a CLI Tool

```bash
# Analyze the current directory
node index.js

# Analyze a specific local repository
node index.js /path/to/repository

# Analyze a GitHub repository (requires GitHub token)
GITHUB_TOKEN=your_github_token node index.js https://github.com/username/repo
```

### As an API Server

```bash
# Start the server
npm start

# Start with hot-reloading (development)
npm run dev
```

#### API Endpoints

1. **Health Check**
   - `GET /health`
   - Returns a simple health status to confirm the service is running

2. **Check Repository**
   - `GET /check-repo?repoPath=<path-or-url>&githubToken=<github-token>`
   - Parameters:
     - `repoPath`: Path to local repository or GitHub URL (required)
     - `githubToken`: GitHub API token for accessing private repositories (optional)
   - Returns: JSON object with SSR detection results

## API Response Format

```json
{
  "results": {
    "needsSSR": true|false,
    "evidence": ["list", "of", "evidence", "items"],
    "frameworkDetected": "Detected Framework Name",
    "confidence": 75
  }
}
```

## How It Works

Repo Nature uses several strategies to detect if a repository requires SSR:

1. **Package Analysis**: Checks `package.json` for SSR frameworks and libraries
2. **Configuration Files**: Looks for framework-specific configuration files
3. **Directory Structure**: Identifies SSR-related directory patterns
4. **Code Analysis**: Searches for SSR-specific code patterns like `getServerSideProps` or `renderToString`

Based on these findings, it calculates a confidence score and determines if the repository requires SSR.

## Environment Variables

- `PORT`: Server port (default: 9002)
- `GITHUB_TOKEN`: GitHub API token for accessing private repositories

## Dependencies

- Express: Web server framework
- @octokit/rest: GitHub API client
- nodemon (dev): For hot-reloading during development

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.