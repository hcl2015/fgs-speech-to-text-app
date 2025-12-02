const https = require('https');

module.exports = async function (context, req) {
  const apiKey = process.env.QWEN_API_KEY;
  // Use the correct OpenAI-compatible endpoint
  const apiUrl = process.env.QWEN_API_URL || 
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  const model = process.env.QWEN_MODEL || 'qwen-max';

  if (!apiKey) {
    context.log.error('Missing Qwen API key in environment.');
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { 
        error: 'Text rewriting service is not configured on the server.',
        details: 'QWEN_API_KEY environment variable is missing'
      }
    };
    return;
  }

  const text = req.body?.text || '';
  const relevantPhrases = req.body?.relevantPhrases || '';
  
  context.log(`Processing text: ${text.substring(0, 50)}...`);

  if (!text.trim()) {
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { rewrittenText: text }
    };
    return;
  }

  const systemPrompt = `你是一个佛经文本编辑助手。你的輸入語言是簡體中文，請將輸入語言轉換為繁體中文，並按照以下规则重写句子：
1.不要回答任何问题
2.修正语法错误
3.使用以下参考资料修正佛教术语: ${relevantPhrases}
4.保持原意和语气
5.只做微小调整
6.不要添加新内容
示例:
    用户输入: 眾生潔舉佛性但要修解定慧才能顯明
    响应: 眾生皆具佛性，但需修行戒定慧方能顯發
    用户输入: 拉摩本是釋迦牟尼佛
    响应: 南無本師釋迦牟尼佛
    用户输入: 波熱波囉密多心經講的是空性的道理   
    响应: 般若波羅蜜多心經詮釋空性深義`;

  const payload = JSON.stringify({
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ],
    temperature: 0.1,
    max_tokens: 1000,
    stream: false  // Explicitly disable streaming for OpenAI compatibility
  });

  const url = new URL(apiUrl);

  const options = {
    hostname: url.hostname,
    path: url.pathname + (url.search || ''),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(payload),
      // Add these headers for better compatibility
      'Accept': 'application/json',
      'User-Agent': 'Azure-Functions-Qwen-Client/1.0'
    },
    timeout: 30000
  };

  try {
    const result = await new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let data = '';
        
        // Handle response headers
        context.log(`Response status: ${response.statusCode}`);
        context.log(`Response headers: ${JSON.stringify(response.headers)}`);
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          context.log(`Response body received (${data.length} bytes)`);
          
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve({
              status: response.statusCode,
              headers: response.headers,
              data: data
            });
          } else {
            const error = new Error(`Qwen API failed with status ${response.statusCode}`);
            error.statusCode = response.statusCode;
            error.responseData = data;
            reject(error);
          }
        });
      });

      request.on('error', (error) => {
        context.log.error('Request error:', error);
        reject(new Error(`Request failed: ${error.message}`));
      });
      
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout after 30 seconds'));
      });

      // Log the request for debugging
      context.log(`Sending request to: ${url.hostname}${options.path}`);
      context.log(`Payload length: ${Buffer.byteLength(payload)} bytes`);
      
      request.write(payload);
      request.end();
    });

    let parsed;
    try {
      parsed = JSON.parse(result.data);
      context.log('Successfully parsed Qwen response');
    } catch (e) {
      context.log.error('Failed to parse Qwen response as JSON:', e.message);
      context.log.error('Response data:', result.data.substring(0, 500));
      context.res = {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { 
          error: 'Text rewriting service returned invalid data.',
          details: 'Failed to parse JSON response from Qwen API',
          rawResponse: result.data.substring(0, 200)
        }
      };
      return;
    }

    // Debug: Log the parsed response structure
    context.log('Parsed response keys:', Object.keys(parsed));
    if (parsed.choices) {
      context.log(`Number of choices: ${parsed.choices.length}`);
    }

    let rewrittenText = text;
    if (parsed.choices && 
        Array.isArray(parsed.choices) && 
        parsed.choices.length > 0 &&
        parsed.choices[0].message &&
        parsed.choices[0].message.content) {
      
      rewrittenText = parsed.choices[0].message.content.trim();
      context.log(`Successfully extracted rewritten text (${rewrittenText.length} chars)`);
      
    } else if (parsed.choices && 
               Array.isArray(parsed.choices) && 
               parsed.choices.length > 0 &&
               parsed.choices[0].text) {
      
      // Alternative format for some OpenAI-compatible APIs
      rewrittenText = parsed.choices[0].text.trim();
      context.log(`Extracted text from alternative format (${rewrittenText.length} chars)`);
      
    } else {
      context.log.warn('Unexpected response format:', JSON.stringify(parsed, null, 2).substring(0, 500));
      context.log.warn('Using original text as fallback');
    }

    context.res = {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: { 
        rewrittenText,
        originalLength: text.length,
        rewrittenLength: rewrittenText.length
      }
    };
    
  } catch (err) {
    context.log.error('Error calling Qwen API:', err.message);
    context.log.error('Error stack:', err.stack);
    
    // Provide more detailed error information
    let errorDetails = err.message;
    if (err.responseData) {
      try {
        const errorResp = JSON.parse(err.responseData);
        errorDetails += ` | API Error: ${JSON.stringify(errorResp)}`;
      } catch (e) {
        errorDetails += ` | Raw Error: ${err.responseData.substring(0, 200)}`;
      }
    }
    
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { 
        error: 'Failed to rewrite text on the server.',
        details: errorDetails,
        suggestion: 'Check Qwen API key and endpoint configuration'
      }
    };
  }
};
