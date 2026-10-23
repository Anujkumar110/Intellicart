const Product = require('../models/Product');

// Stop words to remove from search terms
const STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'you', 'your', 'he', 'she', 'it',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but',
  'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for',
  'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before',
  'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on',
  'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should',
  'now', 'please', 'tell', 'show', 'give', 'find', 'recommend', 'suggest',
  'looking', 'want', 'need', 'like', 'good', 'best'
]);

// Extract meaningful keywords from text
function extractKeywords(query) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

// Detect category
function detectCategory(query) {
  const lower = query.toLowerCase();
  const categoryMap = {
    laptop: ['laptop', 'laptops', 'notebook', 'macbook', 'thinkpad', 'xps', 'ultrabook', 'pc'],
    phone: ['phone', 'phones', 'mobile', 'smartphone', 'iphone', 'galaxy', 'pixel', 'oneplus', 'android'],
    tablet: ['tablet', 'tablets', 'ipad', 'tab'],
    headphone: ['headphone', 'headphones', 'earbud', 'earbuds', 'earphone', 'earphones', 'airpods', 'headset', 'audio', 'bose', 'sony'],
    smartwatch: ['watch', 'watches', 'smartwatch', 'smartwatches', 'wearable', 'fitbit'],
    accessory: ['accessory', 'accessories', 'charger', 'cable', 'case', 'adapter'],
  };

  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(lower))) {
      return category;
    }
  }
  return null;
}

// Detect brand
function detectBrand(query) {
  const brands = ['Apple', 'Dell', 'Lenovo', 'Samsung', 'Google', 'Sony', 'Bose', 'ASUS', 'OnePlus'];
  const lower = query.toLowerCase();
  for (const brand of brands) {
    if (new RegExp(`\\b${brand.toLowerCase()}\\b`, 'i').test(lower)) {
      return brand;
    }
  }
  return null;
}

// Detect price constraints & sorting intents
function detectPriceIntent(query) {
  const lower = query.toLowerCase();
  let minPrice = null;
  let maxPrice = null;
  let sortType = null; // 'cheapest', 'premium', 'rating'

  // Explicit price matches
  const underMatch = lower.match(/(?:under|below|less than|max|up to)\s*\$?(\d+)/i);
  if (underMatch) {
    maxPrice = parseInt(underMatch[1], 10);
  }

  const overMatch = lower.match(/(?:over|above|more than|min|at least)\s*\$?(\d+)/i);
  if (overMatch) {
    minPrice = parseInt(overMatch[1], 10);
  }

  const betweenMatch = lower.match(/between\s*\$?(\d+)\s*(?:and|to|-)\s*\$?(\d+)/i);
  if (betweenMatch) {
    minPrice = parseInt(betweenMatch[1], 10);
    maxPrice = parseInt(betweenMatch[2], 10);
  }

  // Budget / cheapest keywords
  if (/\b(cheap|cheapest|budget|affordable|low cost|inexpensive|lowest price)\b/i.test(lower)) {
    sortType = 'cheapest';
  } else if (/\b(expensive|premium|luxury|high end|high-end|top tier)\b/i.test(lower)) {
    sortType = 'premium';
  } else if (/\b(best|top rated|popular|highest rating)\b/i.test(lower)) {
    sortType = 'rating';
  }

  return { minPrice, maxPrice, sortType };
}

// Conversational Intent Detection
function detectConversationalIntent(query) {
  const lower = query.trim().toLowerCase();

  // Greetings
  if (/^(hi|hello|hey|greetings|good morning|good afternoon|good evening|yo|sup)\b/i.test(lower)) {
    return {
      type: 'greeting',
      message: "👋 **Hello! Welcome to Intellicart!**\n\nI'm your AI shopping assistant. I can help you discover products, compare specs, check prices, and find the perfect electronics for your needs.\n\n💡 **Try asking me:**\n• *\"Show me laptops for coding under $2000\"*\n• *\"What are the cheapest headphones?\"*\n• *\"Recommend a flagship phone with a great camera\"*\n• *\"What brands do you have?\"*",
      products: [],
    };
  }

  // Help / Capabilities
  if (/^(help|what can you do|how does this work|features|who are you)\b/i.test(lower) || lower === 'help') {
    return {
      type: 'help',
      message: "🤖 **Here is what I can do for you:**\n\n• **Product Search:** Find laptops, phones, tablets, headphones, and smartwatches.\n• **Budget Filtering:** Ask for products *under $1000*, *budget laptops*, or *cheapest headphones*.\n• **Spec-Aware Advice:** Search for *\"gaming\"*, *\"noise cancelling\"*, *\"OLED\"*, *\"M3 chip\"*, etc.\n• **Brand Filtering:** Browse products by Apple, Dell, Lenovo, Samsung, Sony, Bose, ASUS, OnePlus, Google.\n• **Ordering & Cart:** You can add any recommended item straight to your cart!",
      products: [],
    };
  }

  // Categories query
  if (/what (categories|products|items) do you (have|sell)|what do you sell/i.test(lower)) {
    return {
      type: 'categories',
      message: "🛒 **We offer 5 main electronics categories:**\n\n1. 💻 **Laptops:** High-performance MacBooks, Dell XPS, ThinkPads, and ASUS ROG gaming rigs.\n2. 📱 **Smartphones:** Apple iPhone 15 Pro, Samsung Galaxy S24 Ultra, Google Pixel 8 Pro, OnePlus 12.\n3. 📟 **Tablets:** Apple iPad Pro M2, Samsung Galaxy Tab S9 Ultra.\n4. 🎧 **Headphones:** Sony WH-1000XM5, Bose QuietComfort Ultra, Apple AirPods Pro 2.\n5. ⌚ **Smartwatches:** Apple Watch Ultra 2, Samsung Galaxy Watch 6 Classic.\n\nWhich category would you like to explore?",
      products: [],
    };
  }

  // Cart / Order assistance
  if (/^(how to order|my cart|my order|where is my order|how do i buy|checkout)/i.test(lower)) {
    return {
      type: 'order_help',
      message: "📦 **Ordering & Account Help:**\n\n1. **Add to Cart:** Click the *Add to Cart* button on any product card.\n2. **View Cart:** Click the **🛒 Cart** tab at the top right of the navigation bar.\n3. **Checkout:** In your Cart, click *Proceed to Checkout* to enter your shipping address and complete your order.\n4. **Order History:** Click the **Orders** tab at the top to track your past orders!\n\n*(Make sure to log in or register first using the Login button in the top right)*",
      products: [],
    };
  }

  return null;
}

// RAG Retrieval Step
async function retrieveProducts(query) {
  const category = detectCategory(query);
  const brand = detectBrand(query);
  const { minPrice, maxPrice, sortType } = detectPriceIntent(query);
  const keywords = extractKeywords(query);

  let filter = {};
  if (category) filter.category = category;
  if (brand) filter.brand = new RegExp(brand, 'i');

  if (minPrice !== null || maxPrice !== null) {
    filter.price = {};
    if (minPrice !== null) filter.price.$gte = minPrice;
    if (maxPrice !== null) filter.price.$lte = maxPrice;
  }

  // Determine sorting
  let sortOption = { rating: -1 };
  if (sortType === 'cheapest') {
    sortOption = { price: 1 };
  } else if (sortType === 'premium') {
    sortOption = { price: -1 };
  } else if (sortType === 'rating') {
    sortOption = { rating: -1 };
  }

  let products = [];

  // 1. Text index search if keywords exist
  if (keywords.length > 0) {
    try {
      products = await Product.find({
        ...filter,
        $text: { $search: keywords.join(' ') },
      })
        .sort({ score: { $meta: 'textScore' }, ...sortOption })
        .limit(5);
    } catch {
      // index fallback
    }
  }

  // 2. Regex search on name and description
  if (products.length === 0 && keywords.length > 0) {
    const safeKeywords = keywords.map((kw) => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const orClauses = safeKeywords.map((kw) => ({
      $or: [
        { name: { $regex: kw, $options: 'i' } },
        { description: { $regex: kw, $options: 'i' } },
        { brand: { $regex: kw, $options: 'i' } },
      ],
    }));

    products = await Product.find({
      ...filter,
      $and: orClauses,
    })
      .sort(sortOption)
      .limit(5);
  }

  // 3. Fallback with just category/brand/price filter
  if (products.length === 0) {
    products = await Product.find(filter)
      .sort(sortOption)
      .limit(5);
  }

  // 4. Fallback if strict price range eliminated all products: relax price and explain
  let relaxedPrice = false;
  if (products.length === 0 && (minPrice !== null || maxPrice !== null)) {
    const relaxedFilter = {};
    if (category) relaxedFilter.category = category;
    if (brand) relaxedFilter.brand = new RegExp(brand, 'i');

    products = await Product.find(relaxedFilter)
      .sort(sortType === 'cheapest' ? { price: 1 } : { price: 1, rating: -1 })
      .limit(3);
    relaxedPrice = true;
  }

  // 5. Ultimate fallback: Top rated items across the catalog
  if (products.length === 0) {
    products = await Product.find({})
      .sort({ rating: -1 })
      .limit(4);
  }

  return { products, category, brand, minPrice, maxPrice, sortType, relaxedPrice };
}

// RAG Generation Step
function generateResponse(query, retrievalData) {
  const { products, category, brand, minPrice, maxPrice, sortType, relaxedPrice } = retrievalData;

  if (products.length === 0) {
    return {
      message: "I couldn't find any electronics matching that description. Try browsing our categories: **Laptops, Phones, Tablets, Headphones, or Smartwatches**!",
      products: [],
    };
  }

  let intro = '';

  if (relaxedPrice && maxPrice) {
    intro = `⚠️ We don't currently have ${category ? `**${category}s**` : 'items'} under **$${maxPrice}**, but here are the most affordable ${category || 'product'} options available:\n\n`;
  } else {
    let parts = [];
    if (sortType === 'cheapest') parts.push('most affordable');
    else if (sortType === 'premium') parts.push('premium');
    else parts.push('recommended');

    const catLabel = category === 'smartwatch' ? 'smartwatches' : (category ? `${category}s` : 'electronics');
    if (brand) parts.push(`**${brand}**`);
    parts.push(`**${catLabel}**`);

    if (maxPrice && !relaxedPrice) parts.push(`under **$${maxPrice}**`);
    if (minPrice) parts.push(`above **$${minPrice}**`);

    intro = `Here are the best ${parts.join(' ')} I found for you:\n\n`;
  }

  const summaries = products.map((p, i) => {
    return `${i + 1}. **${p.name}** (${p.brand}) — **$${p.price.toLocaleString()}**\n   ${p.description}\n   ⭐ **${p.rating}/5** · ${p.stock > 0 ? `✅ In Stock (${p.stock})` : '❌ Out of Stock'}`;
  });

  const fullMessage = intro + summaries.join('\n\n') + '\n\n💡 *Click any item below to add it directly to your cart!*';

  return {
    message: fullMessage,
    products: products.map((p) => ({
      _id: p._id,
      name: p.name,
      brand: p.brand,
      price: p.price,
      rating: p.rating,
      category: p.category,
      stock: p.stock,
      description: p.description,
    })),
  };
}

// Optional OpenAI Generation Step (if OPENAI_API_KEY is configured in .env)
async function generateOpenAIResponse(query, retrievalData) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey.trim() === '') {
    return null;
  }

  const { products } = retrievalData;
  if (!products || products.length === 0) return null;

  const productContext = products.map((p, i) => {
    let specStr = '';
    if (p.specs) {
      const entries = p.specs instanceof Map ? Array.from(p.specs.entries()) : Object.entries(p.specs);
      specStr = entries.map(([k, v]) => `${k}: ${v}`).join(', ');
    }
    return `Product #${i + 1}:
- Name: ${p.name}
- Brand: ${p.brand}
- Category: ${p.category}
- Price: $${p.price}
- Rating: ${p.rating}/5
- In Stock: ${p.stock > 0 ? 'Yes' : 'No'} (${p.stock} units)
- Description: ${p.description}
- Specs: ${specStr || 'Standard'}`;
  }).join('\n\n');

  const systemPrompt = `You are Intellicart AI, a knowledgeable and friendly electronics sales advisor.
Recommend products to the shopper using ONLY the live store products provided below.
Rules:
1. Explain WHY each recommendation fits their requirements (highlighting specs like processor, RAM, camera, battery, etc.).
2. If the user's budget had no exact matches, politely note that the provided options are our closest available alternatives.
3. Keep the answer structured, concise, and easy to read with markdown bolding.
4. NEVER invent or hallucinate products not present in the list.`;

  const userPrompt = `Shopper Query: "${query}"

Live Store Products Retrieved from Database:
${productContext}

Please provide your best recommendation:`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.warn('OpenAI API warning:', errData.error?.message || res.statusText);
      return null; // fallback to local generator
    }

    const data = await res.json();
    const botText = data.choices?.[0]?.message?.content;
    if (!botText) return null;

    return {
      message: botText + '\n\n💡 *Click any item below to add it directly to your cart!*',
      products: products.map((p) => ({
        _id: p._id,
        name: p.name,
        brand: p.brand,
        price: p.price,
        rating: p.rating,
        category: p.category,
        stock: p.stock,
        description: p.description,
      })),
      source: 'openai',
    };
  } catch (err) {
    console.warn('OpenAI request failed, using local generator:', err.message);
    return null;
  }
}

// Main chat entry point
async function chat(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') {
    return { message: "Please enter a question or search term.", products: [] };
  }

  // 1. Check conversational intents (greetings, help, about)
  const conversational = detectConversationalIntent(userMessage);
  if (conversational) {
    return conversational;
  }

  // 2. RAG Retrieval step (from MongoDB)
  const retrievalData = await retrieveProducts(userMessage);

  // 3. OpenAI Generation (if API key provided)
  if (process.env.OPENAI_API_KEY) {
    const aiResponse = await generateOpenAIResponse(userMessage, retrievalData);
    if (aiResponse) return aiResponse;
  }

  // 4. Default Local Generation step
  const response = generateResponse(userMessage, retrievalData);
  return response;
}

module.exports = { chat, retrieveProducts, generateResponse, generateOpenAIResponse };
