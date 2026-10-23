const mongoose = require('mongoose');
const dotenv = require('dotenv');
const readline = require('readline');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const User = require('../models/User');
const { retrieveProducts } = require('../rag/chatbot');

//tools

const TOOLS = [
  {
    name: 'search_products',
    description: 'Search for electronics products by keyword, category, brand, or price range',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query text' },
        category: { type: 'string', enum: ['laptop', 'phone', 'tablet', 'headphone', 'smartwatch', 'accessory'] },
        brand: { type: 'string', description: 'Filter by brand name' },
        minPrice: { type: 'number', description: 'Minimum price' },
        maxPrice: { type: 'number', description: 'Maximum price' },
      },
    },
  },
  {
    name: 'get_product_details',
    description: 'Get detailed information about a specific product by its ID',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'The product ID' },
      },
      required: ['productId'],
    },
  },
  {
    name: 'get_categories',
    description: 'List all available product categories with product count',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'add_to_cart',
    description: 'Add a product to a user\'s shopping cart',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        productId: { type: 'string', description: 'The product ID to add' },
        quantity: { type: 'number', description: 'Quantity to add', default: 1 },
      },
      required: ['userId', 'productId'],
    },
  },
  {
    name: 'get_cart',
    description: 'Get the contents of a user\'s shopping cart',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
      },
      required: ['userId'],
    },
  },
  {
    name: 'place_order',
    description: 'Place an order from the user\'s current cart',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        shippingAddress: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            zipCode: { type: 'string' },
          },
          required: ['street', 'city', 'state', 'zipCode'],
        },
      },
      required: ['userId', 'shippingAddress'],
    },
  },
  {
    name: 'get_recommendations',
    description: 'Get AI-powered product recommendations based on a natural language query',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language query for recommendations' },
      },
      required: ['query'],
    },
  },
];

//Tool Handlers

async function handleSearchProducts(args) {
  let filter = {};
  if (args.category) filter.category = args.category;
  if (args.brand) filter.brand = new RegExp(args.brand, 'i');
  if (args.minPrice || args.maxPrice) {
    filter.price = {};
    if (args.minPrice) filter.price.$gte = args.minPrice;
    if (args.maxPrice) filter.price.$lte = args.maxPrice;
  }

  let products;
  if (args.query) {
    try {
      products = await Product.find({ ...filter, $text: { $search: args.query } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(10);
    } catch {
      products = await Product.find(filter).sort({ rating: -1 }).limit(10);
    }
  } else {
    products = await Product.find(filter).sort({ rating: -1 }).limit(10);
  }

  return products.map((p) => ({
    id: p._id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    price: p.price,
    rating: p.rating,
    stock: p.stock,
    description: p.description,
  }));
}

async function handleGetProductDetails(args) {
  const product = await Product.findById(args.productId);
  if (!product) throw new Error('Product not found');
  return product.toObject();
}

async function handleGetCategories() {
  const categories = await Product.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 }, avgPrice: { $avg: '$price' } } },
    { $sort: { count: -1 } },
  ]);
  return categories.map((c) => ({
    category: c._id,
    productCount: c.count,
    averagePrice: Math.round(c.avgPrice),
  }));
}

async function handleAddToCart(args) {
  const { userId, productId, quantity = 1 } = args;

  const product = await Product.findById(productId);
  if (!product) throw new Error('Product not found');
  if (product.stock < quantity) throw new Error('Not enough stock');

  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
  }

  const existing = cart.items.find((item) => item.product.toString() === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({ product: productId, quantity });
  }

  await cart.save();
  cart = await Cart.findOne({ user: userId }).populate('items.product');

  return {
    message: `Added ${quantity}x ${product.name} to cart`,
    cart: cart.items.map((item) => ({
      product: item.product.name,
      quantity: item.quantity,
      price: item.product.price,
      subtotal: item.product.price * item.quantity,
    })),
  };
}

async function handleGetCart(args) {
  const cart = await Cart.findOne({ user: args.userId }).populate('items.product');
  if (!cart || cart.items.length === 0) {
    return { items: [], total: 0 };
  }

  let total = 0;
  const items = cart.items.map((item) => {
    const subtotal = item.product.price * item.quantity;
    total += subtotal;
    return {
      product: item.product.name,
      brand: item.product.brand,
      quantity: item.quantity,
      price: item.product.price,
      subtotal,
    };
  });

  return { items, total };
}

async function handlePlaceOrder(args) {
  const { userId, shippingAddress } = args;

  const cart = await Cart.findOne({ user: userId }).populate('items.product');
  if (!cart || cart.items.length === 0) throw new Error('Cart is empty');

  const validItems = cart.items.filter((item) => item && item.product && typeof item.product === 'object');
  if (validItems.length === 0) throw new Error('No valid items in cart');

  // Verify stock
  for (const item of validItems) {
    const product = await Product.findById(item.product._id);
    if (!product) throw new Error('Product not found');
    if (product.stock < item.quantity) {
      throw new Error(`Not enough stock for ${product.name}`);
    }
  }

  let totalAmount = 0;
  const orderItems = [];

  for (const item of validItems) {
    const product = await Product.findById(item.product._id);
    product.stock -= item.quantity;
    await product.save();

    const price = Number(product.price) || 0;
    totalAmount += price * item.quantity;
    orderItems.push({
      product: product._id,
      quantity: item.quantity,
      price,
    });
  }

  const order = await Order.create({
    user: userId,
    items: orderItems,
    totalAmount,
    shippingAddress,
  });

  cart.items = [];
  await cart.save();

  return {
    orderId: order._id,
    totalAmount,
    status: order.status,
    itemCount: orderItems.length,
    message: `Order placed successfully! Total: $${totalAmount.toLocaleString()}`,
  };
}

async function handleGetRecommendations(args) {
  const products = await retrieveProducts(args.query);
  return products.map((p) => ({
    id: p._id,
    name: p.name,
    brand: p.brand,
    price: p.price,
    rating: p.rating,
    description: p.description,
    category: p.category,
  }));
}

//MCP Protocol Handler

async function handleRequest(request) {
  const { method, params, id } = request;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'intellicart-mcp',
            version: '1.0.0',
          },
        },
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS },
      };

    case 'tools/call': {
      const { name, arguments: args } = params;
      try {
        let result;
        switch (name) {
          case 'search_products':
            result = await handleSearchProducts(args || {});
            break;
          case 'get_product_details':
            result = await handleGetProductDetails(args);
            break;
          case 'get_categories':
            result = await handleGetCategories();
            break;
          case 'add_to_cart':
            result = await handleAddToCart(args);
            break;
          case 'get_cart':
            result = await handleGetCart(args);
            break;
          case 'place_order':
            result = await handlePlaceOrder(args);
            break;
          case 'get_recommendations':
            result = await handleGetRecommendations(args);
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          },
        };
      } catch (error) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          },
        };
      }
    }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

//Main

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.error('Intellicart MCP Server connected to MongoDB');
  console.error('Waiting for MCP requests on stdin...');

  const rl = readline.createInterface({ input: process.stdin });
  let buffer = '';

  rl.on('line', async (line) => {
    buffer += line;
    try {
      const request = JSON.parse(buffer);
      buffer = '';
      const response = await handleRequest(request);
      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch (e) {
      // incomplete JSON, wait for more data
      if (e instanceof SyntaxError) return;
      buffer = '';
      const errorResponse = {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      };
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  });
}

main().catch((err) => {
  console.error('MCP Server Error:', err.message);
  process.exit(1);
});
