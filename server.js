const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

const app = express();

// middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API info route
app.get('/api', (req, res) => {
  res.json({
    message: '🛒 Welcome to Intellicart API',
    endpoints: {
      auth: '/api/auth (register, login, profile)',
      products: '/api/products',
      cart: '/api/cart',
      orders: '/api/orders',
      chat: '/api/chat',
      health: '/api/health',
    },
  });
});

// routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));

// chatbot route
const { chat } = require('./rag/chatbot');
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }
    const response = await chat(message);
    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Intellicart server running on port ${PORT}`);
  });
});
