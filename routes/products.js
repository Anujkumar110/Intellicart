const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  seedMissingProducts,
} = require('../controllers/productController');

router.get('/', getAllProducts);
router.post('/seed', seedMissingProducts);
router.get('/:id', getProductById);
router.post('/', auth, createProduct);
router.put('/:id', auth, updateProduct);
router.delete('/:id', auth, deleteProduct);

module.exports = router;
