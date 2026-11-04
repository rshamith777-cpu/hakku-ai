const serverless = require('serverless-http');
const app = require('../../server.js');

const handler = serverless(app);

module.exports.handler = async (event, context) => {
  if (event.path) {
    // Strip Netlify internal function path prefix if present
    let p = event.path.replace('/.netlify/functions/api', '');
    if (!p || p === '') p = '/';
    // If it's an API route without /api prefix, prepend /api
    if (!p.startsWith('/api') && p !== '/healthz' && p !== '/') {
      p = '/api' + (p.startsWith('/') ? '' : '/') + p;
    }
    event.path = p;
  }
  return await handler(event, context);
};

