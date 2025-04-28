const express = require('express');
const bodyParser = require('body-parser');
const { detectSSR } = require('./detectssr');

const app = express();
const PORT = process.env.PORT || 9002;

app.use(bodyParser.json());

app.get('/health', (req, res) => {
    return res.status(200).json({ status: 'Alive!' });
});

app.get('/check-repo', async (req, res) => {
    const { repoPath, githubToken } = req.query;

    if (!repoPath) {
        return res.status(400).json({ error: 'repoPath is required' });
    }

    try {
        const results = await detectSSR(repoPath, githubToken);
        return res.json({ results });
    } catch (error) {
        console.error('Error analyzing repository:', error);
        return res.status(500).json({ error: 'Failed to analyze repository', details: error.message });
    }
});


app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
