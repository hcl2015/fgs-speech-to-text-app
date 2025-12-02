const https = require('https');

module.exports = async function (context, req) {
  const apiKey = process.env.QWEN_API_KEY;
  const apiUrl =
    process.env.QWEN_API_URL ||
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  const model = process.env.QWEN_MODEL || 'qwen-max';

  if (!apiKey) {
    context.log.error('Missing Qwen API key in environment.');
    context.res = {
      status: 500,
      body: { error: 'Text rewriting service is not configured on the server.' }
    };
    return;
  }

  const text = (req.body && req.body.text) || '';
  const relevantPhrases = (req.body && req.body.relevantPhrases) || '';

  if (!text.trim()) {
    context.res = {
      status: 200,
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
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ],
    temperature: 0.1,
    max_tokens: 1000
  });

  const url = new URL(apiUrl);

  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(payload),
      'X-DashScope-SSE': 'disable'
    }
  };

  try {
    const result = await new Promise((resolve, reject) => {
      const req = https.request(options, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(
              new Error(`Qwen API failed with status ${res.statusCode}: ${data}`)
            );
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    let parsed;
    try {
      parsed = JSON.parse(result);
    } catch (e) {
      context.log.error('Failed to parse Qwen response as JSON:', e);
      context.res = {
        status: 500,
        body: { error: 'Text rewriting service returned invalid data.' }
      };
      return;
    }

    let rewrittenText = text;
    if (
      parsed.choices &&
      parsed.choices.length > 0 &&
      parsed.choices[0].message &&
      parsed.choices[0].message.content
    ) {
      rewrittenText = parsed.choices[0].message.content;
    }

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { rewrittenText }
    };
  } catch (err) {
    context.log.error('Error calling Qwen API:', err);
    context.res = {
      status: 500,
      body: { error: 'Failed to rewrite text on the server.' }
    };
  }
};


