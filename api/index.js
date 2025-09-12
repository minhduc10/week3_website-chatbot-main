const server = require('../server');

// Vercel serverless function entrypoint
// Wrap the Express app in a handler to ensure compatibility with Vercel
module.exports = (req, res) => server(req, res);


