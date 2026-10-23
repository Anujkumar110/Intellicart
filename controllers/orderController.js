const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// POST /api/orders
exports.createOrder = async (req, res) => {
  try {
    const { shippingAddress } = req.body;

    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty' });
    }

    // Filter out invalid or deleted products from cart
    const validItems = cart.items.filter((item) => item && item.product && typeof item.product === 'object');
    if (validItems.length === 0) {
      cart.items = [];
      await cart.save();
      return res.status(400).json({ message: 'Cart items are no longer available' });
    }

    // Verify stock availability
    for (const item of validItems) {
      const product = await Product.findById(item.product._id);
      if (!product) {
        return res.status(400).json({ message: 'One or more items in your cart are no longer available' });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Not enough stock for ${product.name} (only ${product.stock} left)`,
        });
      }
    }

    // Deduct stock and build clean order items
    let totalAmount = 0;
    const orderItems = [];

    for (const item of validItems) {
      const product = await Product.findById(item.product._id);
      product.stock -= item.quantity;
      await product.save();

      const itemPrice = Number(product.price) || 0;
      totalAmount += itemPrice * item.quantity;

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: itemPrice,
      });
    }

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      totalAmount,
      shippingAddress,
    });

    // Clear user cart upon successful order
    cart.items = [];
    await cart.save();

    const populatedOrder = await Order.findById(order._id).populate('items.product');
    return res.status(201).json(populatedOrder);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// GET /api/orders
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/orders/:id
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/orders/:id/status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('items.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
