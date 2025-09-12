// Catch-all for /api/* on Vercel to use the same Express app
const server = require('../server');

module.exports = (req, res) => server(req, res);


