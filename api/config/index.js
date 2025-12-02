module.exports = async function (context, req) {
  const config = {
    azureSubscriptionKey: process.env.AZURE_SUBSCRIPTION_KEY || '',
    azureServiceRegion: process.env.AZURE_SERVICE_REGION || 'eastus',
    azureCustomEndpointId: process.env.AZURE_CUSTOM_ENDPOINT_ID || '',
    qwenApiKey: process.env.QWEN_API_KEY || '',
    qwenApiUrl:
      process.env.QWEN_API_URL ||
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  };

  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: config
  };
};


