const serverless = require('serverless-http');
const app = require('../../server.js');

const handler = serverless(app);

module.exports.handler = async (event, context) => {
  // Normalize path if Netlify redirects /api/* or /healthz
  if (event.path) {
    if (event.path.startsWith('/.netlify/functions/api')) {
      event.path = event.path.replace('/.netlify/functions/api', '') || '/';
    }
  }
  return await handler(event, context);
};

