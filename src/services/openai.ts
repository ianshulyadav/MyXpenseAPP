// AI Service with Gemini (Primary) and OpenAI (Fallback)
// ⚠️ SECURITY WARNING: This implementation exposes API keys in client-side code.
// For production use, implement a secure backend proxy (Firebase Cloud Functions/API Gateway)
// that handles API key management server-side. Never commit API keys to version control.

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | any[];
}

interface OpenAIResponse {
  message: string;
  tokensUsed: number;
  functionCall?: {
    name: string;
    arguments: any;
  };
}

// Cache for AI insights to reduce API calls and improve performance
const insightsCache = new Map<string, { data: string; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
const MAX_CACHE_SIZE = 100; // Limit cache size to prevent memory issues

// Track which provider was last used successfully (exported for status display)
export let lastSuccessfulProvider: 'gemini' | 'openai' | null = null;

// Helper function to call Gemini API (Primary)
async function callGemini(payload: any): Promise<any> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    // Convert OpenAI format to Gemini format
    const messages = payload.messages || [];
    const contents = messages
      .filter((m: ChatMessage) => m.role !== 'system')
      .map((m: ChatMessage) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: Array.isArray(m.content)
          ? m.content.map((c: any) => {
            if (c.type === 'text') return { text: c.text };
            if (c.type === 'image_url') {
              const base64Data = c.image_url.url.replace(/^data:image\/\w+;base64,/, '');
              return { inline_data: { mime_type: 'image/jpeg', data: base64Data } };
            }
            return { text: String(c) };
          })
          : [{ text: m.content }]
      }));

    // Add system instruction if present
    const systemMessage = messages.find((m: ChatMessage) => m.role === 'system');

    // Use gemini-2.0-flash for both text and vision (multimodal, supports generateContent)
    const hasImage = messages.some((m: ChatMessage) =>
      Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url')
    );
    const model = hasImage ? 'gemini-2.0-flash' : 'gemini-2.0-flash';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
          generationConfig: {
            temperature: payload.temperature || 0.7,
            maxOutputTokens: payload.max_tokens || 500,
          }
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Gemini] API error:', errorData);
      throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Convert to OpenAI-compatible format
    return {
      choices: [{
        message: {
          content: text,
          role: 'assistant'
        }
      }],
      usage: {
        total_tokens: data.usageMetadata?.totalTokenCount || 0
      }
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Gemini request timed out');
    }
    throw error;
  }
}

// Helper function to call OpenAI API (Fallback)
async function callOpenAIAPI(payload: any): Promise<any> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;
      console.error('[OpenAI] API error:', errorMessage);
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('OpenAI request timed out');
    }
    throw error;
  }
}

// Unified AI call function - Tries Gemini first, falls back to OpenAI
async function callAI(payload: any): Promise<any> {
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!geminiKey && !openaiKey) {
    console.warn('[AI] No API keys configured. AI features will be disabled.');
    throw new Error('AI features are currently unavailable. Please configure your API key.');
  }

  let lastError: any = null;

  // Try OpenAI first (User Request)
  if (openaiKey) {
    try {
      console.log('[AI] Using OpenAI (primary)');
      const result = await callOpenAIAPI(payload);
      lastSuccessfulProvider = 'openai';
      return result;
    } catch (error: any) {
      console.error('[AI] OpenAI failed:', error.message);
      throw error; // Strict mode: Don't fallback to Gemini if OpenAI key is present (User Request)
    }
  }

  // Fallback to Gemini
  if (geminiKey) {
    try {
      console.log('[AI] Using Gemini (fallback)');
      const result = await callGemini(payload);
      lastSuccessfulProvider = 'gemini';
      return result;
    } catch (error: any) {
      console.error('[AI] Gemini also failed:', error.message);
      lastError = error;
      // Fall through to error
    }
  }

  throw new Error(lastError ? lastError.message : 'All AI providers failed. Check your API keys.');
}

// Legacy function name for backward compatibility
async function callOpenAI(payload: any): Promise<any> {
  return callAI(payload);
}

// Manage cache size to prevent memory leaks
function manageCacheSize() {
  if (insightsCache.size > MAX_CACHE_SIZE) {
    const entriesToDelete = insightsCache.size - MAX_CACHE_SIZE;
    const keys = Array.from(insightsCache.keys());
    for (let i = 0; i < entriesToDelete; i++) {
      insightsCache.delete(keys[i]);
    }
  }
}

export const generateAIResponse = async (
  userMessage: string,
  conversationHistory: ChatMessage[],
  context: {
    transactions?: any[];
    budgets?: any[];
    goals?: any[];
    userName?: string;
  }
): Promise<OpenAIResponse> => {
  try {
    // Check cache first for common queries
    const cacheKey = `${userMessage}_${JSON.stringify(context).substring(0, 100)}`;
    const cached = insightsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return {
        message: cached.data,
        tokensUsed: 0 // Cached, no tokens used
      };
    }

    // Prepare context summary to reduce token usage
    const contextSummary = prepareContextSummary(context);

    // Build optimized message history (keep only last 10 messages to save tokens)
    const recentHistory = conversationHistory.slice(-10);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a helpful financial assistant for MyXpense app. Help users manage their expenses, budgets, and savings goals. 
User: ${context.userName || 'User'}
${contextSummary}

Keep responses concise, actionable, and friendly. Use markdown formatting. Don't hallucinate data - only use the provided context.`
      },
      ...recentHistory,
      {
        role: 'user',
        content: userMessage
      }
    ];

    const data = await callOpenAI({
      model: 'gpt-4o-mini', // Using mini model for cost efficiency
      messages: messages,
      max_tokens: 500, // Limit response length to save costs
      temperature: 0.7,
      presence_penalty: 0.6,
      frequency_penalty: 0.3,
      functions: [
        {
          name: 'add_transaction',
          description: 'Add a new income or expense transaction to the user\'s account',
          parameters: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['income', 'expense'],
                description: 'Type of transaction'
              },
              amount: {
                type: 'number',
                description: 'Amount of the transaction in rupees'
              },
              category: {
                type: 'string',
                description: 'Category (for expense: food/transport/shopping/entertainment/bills/health/education/other, for income: Salary/Freelance/Investment/Gift/Other)'
              },
              description: {
                type: 'string',
                description: 'Brief description of the transaction'
              },
              paymentMethod: {
                type: 'string',
                enum: ['Cash', 'UPI', 'Bank Acc'],
                description: 'Payment method used'
              }
            },
            required: ['type', 'amount', 'category', 'description']
          }
        },
        {
          name: 'remove_transaction',
          description: 'Remove a transaction from the user\'s account',
          parameters: {
            type: 'object',
            properties: {
              transactionId: {
                type: 'string',
                description: 'ID of the transaction to remove'
              }
            },
            required: ['transactionId']
          }
        },
        {
          name: 'add_goal',
          description: 'Add a new savings goal for the user',
          parameters: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of the goal (e.g., "New Laptop", "Vacation")'
              },
              targetAmount: {
                type: 'number',
                description: 'Target amount to save in rupees'
              },
              currentAmount: {
                type: 'number',
                description: 'Current amount saved (default 0)'
              },
              deadline: {
                type: 'string',
                description: 'Deadline date in YYYY-MM-DD format (optional)'
              }
            },
            required: ['name', 'targetAmount']
          }
        },
        {
          name: 'update_goal',
          description: 'Update an existing savings goal',
          parameters: {
            type: 'object',
            properties: {
              goalId: {
                type: 'string',
                description: 'ID of the goal to update'
              },
              currentAmount: {
                type: 'number',
                description: 'New current amount saved'
              }
            },
            required: ['goalId', 'currentAmount']
          }
        },
        {
          name: 'remove_goal',
          description: 'Remove a savings goal',
          parameters: {
            type: 'object',
            properties: {
              goalId: {
                type: 'string',
                description: 'ID of the goal to remove'
              }
            },
            required: ['goalId']
          }
        },
        {
          name: 'add_budget',
          description: 'Add or update a category budget to help user manage spending in specific categories',
          parameters: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                enum: ['food', 'transport', 'shopping', 'entertainment', 'bills', 'health', 'education', 'other'],
                description: 'Category for the budget'
              },
              amount: {
                type: 'number',
                description: 'Budget amount in rupees for this category'
              },
              period: {
                type: 'string',
                enum: ['monthly', 'weekly'],
                description: 'Budget period (default: monthly)'
              }
            },
            required: ['category', 'amount']
          }
        },
        {
          name: 'set_monthly_budget',
          description: 'Set the overall monthly budget limit for the user',
          parameters: {
            type: 'object',
            properties: {
              amount: {
                type: 'number',
                description: 'Total monthly budget amount in rupees'
              }
            },
            required: ['amount']
          }
        }
      ],
      function_call: 'auto'
    });

    const choice = data.choices[0];
    const aiMessage = choice?.message?.content || 'Sorry, I could not generate a response.';
    const tokensUsed = data.usage?.total_tokens || 0;
    const functionCall = choice?.message?.function_call;

    // If there's a function call, parse it
    let parsedFunctionCall = undefined;
    if (functionCall) {
      parsedFunctionCall = {
        name: functionCall.name,
        arguments: JSON.parse(functionCall.arguments)
      };
    }

    // Only cache non-function call responses
    if (!parsedFunctionCall) {
      insightsCache.set(cacheKey, {
        data: aiMessage,
        timestamp: Date.now()
      });
      manageCacheSize(); // Prevent memory leaks
    }

    return {
      message: aiMessage,
      tokensUsed,
      functionCall: parsedFunctionCall
    };
  } catch (error: any) {
    console.error('[OpenAI] Error generating AI response:', error.message || error);
    // Return user-friendly error message
    throw new Error(error.message || 'Unable to process your request. Please try again later.');
  }
};

// Prepare a concise context summary to minimize token usage
function prepareContextSummary(context: {
  transactions?: any[];
  budgets?: any[];
  goals?: any[];
}): string {
  const { transactions = [], budgets = [], goals = [] } = context;

  // Calculate key metrics
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthlyExpenses = transactions
    .filter(t => t.type === 'expense' && new Date(t.date) >= startOfMonth)
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyIncome = transactions
    .filter(t => t.type === 'income' && new Date(t.date) >= startOfMonth)
    .reduce((sum, t) => sum + t.amount, 0);

  // Top spending categories
  const categorySpending: Record<string, number> = {};
  transactions
    .filter(t => t.type === 'expense' && new Date(t.date) >= startOfMonth)
    .forEach(t => {
      categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
    });

  const topCategories = Object.entries(categorySpending)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, amt]) => `${cat}: ₹${amt}`)
    .join(', ');

  // Active budgets
  const activeBudgets = budgets.length;

  // Goals summary
  const activeGoals = goals.length;
  const goalsProgress = goals.map(g =>
    `${g.name}: ${Math.round((g.currentAmount / g.targetAmount) * 100)}%`
  ).join(', ');

  return `
Current Month:
- Income: ₹${monthlyIncome}
- Expenses: ₹${monthlyExpenses}
- Balance: ₹${monthlyIncome - monthlyExpenses}
- Top spending: ${topCategories || 'None'}
- Active budgets: ${activeBudgets}
- Goals (${activeGoals}): ${goalsProgress || 'None'}
`.trim();
}

// Generate monthly insights
export const generateMonthlyInsights = async (
  transactions: any[],
  budgets: any[],
  goals: any[]
): Promise<string> => {
  try {
    const cacheKey = `monthly_insights_${new Date().getMonth()}`;
    const cached = insightsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    const context = prepareContextSummary({ transactions, budgets, goals });

    const data = await callOpenAI({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a financial advisor. Provide ONE concise actionable tip based on the user\'s spending data. Keep it under 20 words.'
        },
        {
          role: 'user',
          content: `Based on this data, give me one money-saving tip:\n${context}`
        }
      ],
      max_tokens: 100,
      temperature: 0.8
    });

    const insight = data.choices[0]?.message?.content || 'Track your expenses daily to stay on budget!';

    // Cache the insight
    insightsCache.set(cacheKey, {
      data: insight,
      timestamp: Date.now()
    });
    manageCacheSize(); // Prevent memory leaks

    return insight;
  } catch (error: any) {
    console.error('[OpenAI] Error generating monthly insights:', error.message || error);
    // Return fallback insight
    return 'Review your spending categories and look for areas to cut back!';
  }
};

// Generate trip icon based on trip name using AI
export const generateTripIcon = async (tripName: string): Promise<string> => {
  try {
    const data = await callOpenAI({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that suggests appropriate emojis for trip names. Return ONLY a single emoji, nothing else.'
        },
        {
          role: 'user',
          content: `Suggest the most appropriate single emoji for a trip named: "${tripName}"`
        }
      ],
      max_tokens: 10,
      temperature: 0.5
    });

    const icon = data.choices[0]?.message?.content?.trim() || '🏖️';
    return icon;
  } catch (error: any) {
    console.error('[OpenAI] Error generating trip icon:', error.message || error);
    return '🏖️'; // Default fallback icon
  }
};

// Categorize receipt using AI (OCR + categorization)
export const categorizeReceipt = async (receiptText: string): Promise<{
  category: string;
  amount: number;
  merchant: string;
}> => {
  try {
    const data = await callOpenAI({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Extract category (food/transport/shopping/bills/entertainment/health/education/other), amount, and merchant from receipt text. Respond in JSON format: {"category": "food", "amount": 250, "merchant": "Restaurant Name"}'
        },
        {
          role: 'user',
          content: receiptText
        }
      ],
      max_tokens: 100,
      temperature: 0.3
    });

    const result = JSON.parse(data.choices[0]?.message?.content || '{}');

    return {
      category: result.category || 'other',
      amount: result.amount || 0,
      merchant: result.merchant || 'Unknown'
    };
  } catch (error: any) {
    console.error('[OpenAI] Error categorizing receipt:', error.message || error);
    return {
      category: 'other',
      amount: 0,
      merchant: 'Unknown'
    };
  }
};

// Clear cache (call on logout)
export const clearAICache = () => {
  insightsCache.clear();
};

// Sanitize text to remove sensitive information before sending to AI
export const sanitizeForAI = (text: string): string => {
  let sanitized = text;

  // Remove account numbers (A/c XXXX, XX1234, etc.)
  sanitized = sanitized.replace(/A\/c\s*[A-Z0-9]+/gi, 'A/c XXXX');
  sanitized = sanitized.replace(/XX\d+/g, 'XXXX');
  sanitized = sanitized.replace(/\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, 'XXXX-XXXX-XXXX-XXXX'); // Card numbers

  // Remove transaction IDs and reference numbers
  sanitized = sanitized.replace(/(?:Ref|TxnId|UTR|IMPS|NEFT)[:\s]*[A-Z0-9]+/gi, 'Ref: XXXXXX');

  // Remove phone numbers
  sanitized = sanitized.replace(/\b\d{10}\b/g, 'XXXXXXXXXX');
  sanitized = sanitized.replace(/\+91\d{10}/g, '+91XXXXXXXXXX');

  // Remove balance information (Avl Bal, Available Balance, etc.)
  sanitized = sanitized.replace(/(?:Avl|Available)\s*Bal(?:ance)?[:\s]*(?:Rs\.?|INR|₹)?\s*[\d,.]+/gi, '');

  // Remove OTP/PIN mentions
  sanitized = sanitized.replace(/(?:OTP|PIN)[:\s]*\d+/gi, '');

  return sanitized.trim();
};

// Detect category using AI based on entity/description
export const detectCategoryWithAI = async (
  entity: string,
  description: string,
  type: 'income' | 'expense'
): Promise<string> => {
  try {
    // Sanitize inputs
    const safeEntity = sanitizeForAI(entity);
    const safeDescription = sanitizeForAI(description);

    // Skip AI call if entity is unknown or too short
    if (!safeEntity || safeEntity === 'Unknown' || safeEntity.length < 2) {
      return type === 'income' ? 'Salary' : 'other';
    }

    const data = await callOpenAI({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a transaction categorizer. Based on the merchant/entity name and description, return ONLY the category name.
          
For EXPENSES, use one of: food, transport, shopping, entertainment, bills, health, education, other
For INCOME, use one of: Salary, Freelance, Investment, Gift, Pocket Money, Parents, Relatives, Other

Categorization hints:
- Zomato, Swiggy, restaurants, cafes → food
- Uber, Ola, Rapido, petrol, metro → transport
- Amazon, Flipkart, Myntra, stores → shopping
- Netflix, Spotify, movies, games → entertainment
- Electricity, water, phone, internet, rent → bills
- Pharmacy, hospital, doctor → health
- UPI from person names → Gift or Parents (for income)

Respond with ONLY the category name, nothing else.`
        },
        {
          role: 'user',
          content: `Type: ${type}\nEntity: ${safeEntity}\nDescription: ${safeDescription}`
        }
      ],
      max_tokens: 20,
      temperature: 0.3
    });

    const category = data.choices[0]?.message?.content?.trim().toLowerCase() || 'other';

    // Validate the category
    const expenseCategories = ['food', 'transport', 'shopping', 'entertainment', 'bills', 'health', 'education', 'other'];
    const incomeCategories = ['salary', 'freelance', 'investment', 'gift', 'pocket money', 'parents', 'relatives', 'other'];

    if (type === 'expense' && expenseCategories.includes(category)) {
      return category;
    } else if (type === 'income') {
      // Capitalize first letter for income categories
      const matched = incomeCategories.find(c => c.toLowerCase() === category);
      return matched ? matched.charAt(0).toUpperCase() + matched.slice(1) : 'Other';
    }

    // Fallback for expense with unrecognized category
    return 'other';
  } catch (error: any) {
    console.error('[OpenAI] Error detecting category:', error.message || error);
    // Fallback to basic keyword matching
    return type === 'income' ? 'Salary' : 'other';
  }
};

// Parse receipt image using Gemini Vision (Gemini-only for image processing)
export const parseReceiptImage = async (imageBase64: string): Promise<{
  transactions: Array<{
    type: 'income' | 'expense';
    amount: number;
    entity: string;
    description: string;
    category: string;
    date: string;
    paymentMethod: string;
  }>;
  error?: string;
}> => {
  try {
    // Use Gemini directly for image scanning (no OpenAI fallback for vision)
    const data = await callGemini({
      messages: [
        {
          role: 'system',
          content: `You are an OCR assistant that extracts transaction data from receipt images.
          
Extract ALL transactions visible in the image. For each transaction, provide:
- type: "expense" (purchases, payments) or "income" (receipts for money received)
- amount: numeric value in rupees (just the number, no symbols)
- entity: merchant/store name or person name
- description: brief description of what was purchased
- category: one of [food, transport, shopping, entertainment, bills, health, education, other]
- date: in YYYY-MM-DD format (use today's date if not visible)
- paymentMethod: one of [Cash, UPI, Card]

Respond in JSON format:
{
  "transactions": [
    { "type": "expense", "amount": 250, "entity": "Zomato", "description": "Food order", "category": "food", "date": "${new Date().toISOString().split('T')[0]}", "paymentMethod": "UPI" }
  ]
}

If no transactions can be extracted, return: { "transactions": [], "error": "Could not extract transaction data" }`
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
              }
            },
            {
              type: 'text',
              text: 'Extract all transaction details from this receipt/bill image.'
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    const content = data.choices[0]?.message?.content || '{"transactions": []}';

    // Try to parse JSON from the response
    let result;
    try {
      // Handle markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      result = JSON.parse(jsonStr.trim());
    } catch {
      console.error('[Gemini] Failed to parse receipt response:', content);
      return { transactions: [], error: 'Failed to parse receipt data' };
    }

    return {
      transactions: result.transactions || [],
      error: result.error
    };
  } catch (error: any) {
    console.error('[Gemini] Error parsing receipt image:', error.message || error);
    return { transactions: [], error: error.message || 'Failed to process receipt image. Make sure VITE_GEMINI_API_KEY is configured.' };
  }
};

// Parse transaction text using AI (Gemini primary, OpenAI fallback)
// This intelligently detects transaction type, amount, entity, and category from natural language
export interface AITransactionResult {
  type: 'income' | 'expense' | 'debt';
  amount: number;
  entity: string;
  description: string;
  category: string;
  date: string;
  paymentMethod: string;
  debtType?: 'lent' | 'borrowed';
  confidence: 'high' | 'medium' | 'low';
}

export const parseTransactionTextWithAI = async (
  text: string
): Promise<{ transactions: AITransactionResult[]; error?: string }> => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const data = await callAI({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a financial transaction parser. Parse the user's text and extract transaction details.

IMPORTANT RULES for detecting transaction TYPE:
- **INCOME**: "received", "got", "credited", "refund", "earned", "income from", "salary", "pocket money"
  - *CRITICAL*: If text says "got [amount] from [person]", it is ALWAYS INCOME.
- **EXPENSE**: "paid", "spent", "debited", "bought", "purchased", "sent to", "gave to"
- **DEBT (Lent)**: "lent to", "gave loan to" (money YOU gave to someone)
- **DEBT (Borrowed)**: "borrowed from", "took loan from" (money YOU took from someone)

For INCOME transactions:
- **Entity**: Extract from "from [name]" pattern.
  - Ex: "received 100 from aryan" → entity: "Aryan", type: income
  - Ex: "got 200 from mummy" → entity: "Mummy", type: income, category: "Pocket Money" or "Gift"
- **Categories**: Salary, Freelance, Investment, Gift, Pocket Money, Parents, Refund, Other

For EXPENSE transactions:
- **Entity**: Extract from "to [name]" or "at [place]" pattern.
  - Ex: "paid 200 to zomato" → entity: "Zomato", type: expense
- **Categories**: food, transport, shopping, entertainment, bills, health, education, other

Output MUST be valid JSON:
{
  "transactions": [
    {
      "type": "income|expense|debt",
      "amount": number,
      "entity": "string (person/merchant name)",
      "description": "brief description",
      "category": "string",
      "date": "${today}",
      "paymentMethod": "Cash|UPI|Card",
      "debtType": "lent|borrowed (only for debt type)",
      "confidence": "high|medium|low"
    }
  ]
}

Today's date is: ${today}
If you cannot parse, return: { "transactions": [], "error": "Could not parse transaction" }`
        },
        {
          role: 'user',
          content: `Parse this transaction text:\n"${text}"`
        }
      ],
      max_tokens: 500,
      temperature: 0.1 // Low temperature for consistent parsing
    });

    const content = data.choices[0]?.message?.content || '{"transactions": []}';

    // Parse JSON response
    let result;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      result = JSON.parse(jsonStr.trim());
    } catch {
      console.error('[AI] Failed to parse transaction text response:', content);
      return { transactions: [], error: 'Failed to parse response' };
    }

    return {
      transactions: result.transactions || [],
      error: result.error
    };
  } catch (error: any) {
    console.error('[AI] Error parsing transaction text:', error.message || error);
    return { transactions: [], error: error.message || 'AI parsing failed' };
  }
};
