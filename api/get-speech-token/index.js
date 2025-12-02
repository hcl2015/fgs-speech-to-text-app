const https = require('https');

module.exports = async function (context, req) {
  const subscriptionKey = process.env.AZURE_SUBSCRIPTION_KEY;
  const serviceRegion = process.env.AZURE_SERVICE_REGION;

  if (!subscriptionKey || !serviceRegion) {
    context.log.error('Missing Azure Speech subscription key or region in environment.');
    context.res = {
      status: 500,
      body: { error: 'Azure Speech configuration is missing on the server.' }
    };
    return;
  }

  const options = {
    hostname: `${serviceRegion}.api.cognitive.microsoft.com`,
    path: '/sts/v1.0/issueToken',
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Content-Length': 0
    }
  };

  try {
    const token = await new Promise((resolve, reject) => {
      const req = https.request(options, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(
              new Error(`Token request failed with status ${res.statusCode}: ${data}`)
            );
          }
        });
      });

      req.on('error', reject);
      req.end();
    });

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        token,
        region: serviceRegion
      }
    };
  } catch (err) {
    context.log.error('Error getting Azure Speech token:', err);
    context.res = {
      status: 500,
      body: { error: 'Failed to obtain Azure Speech token.' }
    };
  }
};


