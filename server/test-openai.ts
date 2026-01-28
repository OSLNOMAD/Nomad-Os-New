import OpenAI from 'openai';

async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    process.exit(1);
  }
  
  console.log('✓ OPENAI_API_KEY found');
  
  const openai = new OpenAI({ apiKey });
  
  try {
    console.log('Testing GPT-4o-mini connection...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant for Nomad Internet customers.' },
        { role: 'user', content: 'Hello! Can you confirm you are working? Reply briefly.' }
      ],
      max_tokens: 50
    });
    
    console.log('✓ OpenAI API connection successful!');
    console.log('Response:', response.choices[0].message.content);
    console.log('Tokens used:', response.usage);
    
  } catch (error: any) {
    console.error('❌ OpenAI API error:', error.message);
    process.exit(1);
  }
}

testOpenAI();
