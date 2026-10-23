// ─── State ──────────────────────────────────────────

const API = '';
let token = localStorage.getItem('token') || null;
let userName = localStorage.getItem('userName') || null;
let cartState = { items: [] };
let currentCategory = null;
let currentSort = '';
let currentSearch = '';

// category emoji map
const categoryEmoji = {
  laptop: '💻',
  phone: '📱',
  tablet: '📟',
  headphone: '🎧',
  smartwatch: '⌚',
  accessory: '🔌',
};

// ─── Init ───────────────────────────────────────────

window.addEventListener('DOMContentLoaded', async () => {
  updateAuthUI();
  await updateCartCount();
  loadProducts();
});

// ─── Navigation ─────────────────────────────────────

function navigateTo(page) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');

  document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));
  const link = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (link) link.classList.add('active');

  if (page === 'cart') loadCart();
  if (page === 'orders') loadOrders();
}

// ─── API Helper ─────────────────────────────────────

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}

// ─── Toast ──────────────────────────────────────────

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ─── Products ───────────────────────────────────────

async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading products...</p></div>';

  try {
    let params = new URLSearchParams();
    if (currentCategory) params.set('category', currentCategory);
    if (currentSort) params.set('sort', currentSort);
    if (currentSearch) params.set('search', currentSearch);

    const minPrice = document.getElementById('minPrice').value;
    const maxPrice = document.getElementById('maxPrice').value;
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);

    const queryString = params.toString();
    const products = await api(`/api/products${queryString ? '?' + queryString : ''}`);

    document.getElementById('productCount').textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;
    renderProducts(products);
  } catch (err) {
    grid.innerHTML = `<p class="loading">Failed to load products</p>`;
  }
}

function getCartItemQuantity(productId) {
  if (!cartState || !cartState.items) return 0;
  const item = cartState.items.find((i) => {
    const pId = i.product && (i.product._id || i.product);
    return pId && pId.toString() === productId.toString();
  });
  return item ? item.quantity : 0;
}

function renderProductAction(productId, stock) {
  if (stock <= 0) {
    return `<button class="btn btn-secondary" disabled style="width:100%;margin-top:12px;cursor:not-allowed;">Out of Stock</button>`;
  }

  const qty = getCartItemQuantity(productId);
  if (qty > 0) {
    return `
      <div class="product-qty-control" onclick="event.stopPropagation()">
        <button class="qty-btn" onclick="updateCartQty('${productId}', ${qty - 1})" title="Decrease">−</button>
        <span class="qty-badge">${qty} in Cart</span>
        <button class="qty-btn" onclick="updateCartQty('${productId}', ${qty + 1})" title="Increase" ${qty >= stock ? 'disabled' : ''}>+</button>
      </div>
    `;
  }

  return `
    <button class="btn btn-primary" onclick="event.stopPropagation(); addToCart('${productId}')">
      Add to Cart
    </button>
  `;
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');

  if (products.length === 0) {
    grid.innerHTML = '<div class="loading"><p>No products found</p></div>';
    return;
  }

  grid.innerHTML = products.map((p) => `
    <div class="product-card" onclick="openProductModal('${p._id}')">
      <div class="product-image">${categoryEmoji[p.category] || '📦'}</div>
      <div class="product-info">
        <div class="product-brand">${p.brand}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-bottom">
          <span class="product-price">$${p.price.toLocaleString()}</span>
          <span class="product-rating">⭐ ${p.rating}</span>
        </div>
        <div class="product-stock ${p.stock <= 0 ? 'out' : ''}">
          ${p.stock > 0 ? `✓ In Stock (${p.stock})` : '✕ Out of Stock'}
        </div>
        ${renderProductAction(p._id, p.stock)}
      </div>
    </div>
  `).join('');
}

function filterCategory(category, el) {
  currentCategory = category;
  document.querySelectorAll('.category-item').forEach((c) => c.classList.remove('active'));
  if (el) el.classList.add('active');

  const title = category
    ? `${categoryEmoji[category] || ''} ${category.charAt(0).toUpperCase() + category.slice(1)}s`
    : 'All Products';
  document.getElementById('productsTitle').textContent = title;

  loadProducts();
}

function sortProducts(value) {
  currentSort = value;
  loadProducts();
}

function handleSearch(event) {
  if (event.key === 'Enter') searchProducts();
}

function searchProducts() {
  currentSearch = document.getElementById('searchInput').value.trim();
  loadProducts();
}

function applyPriceFilter() {
  loadProducts();
}

// ─── Product Detail Modal ───────────────────────────

async function openProductModal(id) {
  const modal = document.getElementById('productModal');
  const detail = document.getElementById('productDetail');
  modal.classList.add('open');
  detail.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const p = await api(`/api/products/${id}`);

    let specsHtml = '';
    if (p.specs) {
      const entries = p.specs instanceof Map ? Array.from(p.specs.entries()) : Object.entries(p.specs);
      specsHtml = `
        <table class="specs-table">
          ${entries.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
        </table>
      `;
    }

    detail.innerHTML = `
      <div class="product-detail-image">${categoryEmoji[p.category] || '📦'}</div>
      <div class="product-detail-info">
        <div class="detail-brand">${p.brand}</div>
        <h1>${p.name}</h1>
        <div class="detail-price">$${p.price.toLocaleString()}</div>
        <div class="product-rating" style="margin-bottom:12px">⭐ ${p.rating}/5 · ${p.stock > 0 ? `${p.stock} in stock` : 'Out of Stock'}</div>
        <p class="detail-desc">${p.description}</p>
        ${specsHtml}
        <div class="detail-actions">
          <input type="number" id="detailQty" value="1" min="1" max="${p.stock}">
          <button class="btn btn-primary" onclick="addToCart('${p._id}', parseInt(document.getElementById('detailQty').value))">
            Add to Cart
          </button>
        </div>
      </div>
    `;
  } catch (err) {
    detail.innerHTML = `<p class="loading">Failed to load product</p>`;
  }
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('open');
}

// ─── Cart ───────────────────────────────────────────

async function addToCart(productId, quantity = 1) {
  if (!token) {
    showToast('Please login first');
    toggleAuthModal();
    return;
  }

  try {
    const updated = await api('/api/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    });
    cartState = updated || { items: [] };
    showToast('Added to cart ✓');
    updateCartCount();
    loadProducts();
  } catch (err) {
    showToast(err.message);
  }
}

async function loadCart() {
  if (!token) {
    document.getElementById('cartContent').innerHTML = `
      <div class="cart-empty">
        <p>🔒</p>
        <h3>Please login to view your cart</h3>
        <button class="btn btn-primary" style="margin-top:16px" onclick="toggleAuthModal()">Login</button>
      </div>
    `;
    return;
  }

  const container = document.getElementById('cartContent');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const cart = await api('/api/cart');
    cartState = cart || { items: [] };
    const rawItems = cartState.items || [];
    // Filter out null or missing products safely
    const items = rawItems.filter((item) => item && item.product && typeof item.product === 'object');

    if (items.length === 0) {
      container.innerHTML = `
        <div class="cart-empty">
          <p>🛒</p>
          <h3>Your cart is empty</h3>
          <button class="btn btn-primary" style="margin-top:16px" onclick="navigateTo('products')">Browse Products</button>
        </div>
      `;
      return;
    }

    let total = 0;
    const itemsHtml = items.map((item) => {
      const p = item.product;
      const price = Number(p.price) || 0;
      const subtotal = price * item.quantity;
      total += subtotal;
      return `
        <div class="cart-item">
          <div class="cart-item-icon">${categoryEmoji[p.category] || '📦'}</div>
          <div class="cart-item-info">
            <h3>${escapeHtml(p.name || 'Product')}</h3>
            <span class="cart-item-price">$${price.toLocaleString()} × ${item.quantity} = $${subtotal.toLocaleString()}</span>
          </div>
          <div class="cart-item-qty">
            <button onclick="updateCartQty('${p._id}', ${item.quantity - 1})">−</button>
            <span>${item.quantity}</span>
            <button onclick="updateCartQty('${p._id}', ${item.quantity + 1})">+</button>
          </div>
          <button class="cart-item-remove" onclick="removeCartItem('${p._id}')">🗑</button>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      ${itemsHtml}
      <div class="cart-summary">
        <div class="cart-total">
          <span>Total</span>
          <span>$${total.toLocaleString()}</span>
        </div>
        <button class="btn btn-primary btn-full" onclick="openOrderModal()">Proceed to Checkout</button>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="loading">Failed to load cart: ${escapeHtml(err.message)}</p>`;
  }
}

async function updateCartQty(productId, newQty) {
  if (newQty < 1) {
    removeCartItem(productId);
    return;
  }

  try {
    const updated = await api(`/api/cart/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity: newQty }),
    });
    cartState = updated || { items: [] };
    const currentPage = document.querySelector('.page.active');
    if (currentPage && currentPage.id === 'page-cart') {
      loadCart();
    }
    updateCartCount();
    loadProducts();
  } catch (err) {
    showToast(err.message);
  }
}

async function removeCartItem(productId) {
  try {
    const updated = await api(`/api/cart/${productId}`, { method: 'DELETE' });
    cartState = updated || { items: [] };
    showToast('Item removed');
    const currentPage = document.querySelector('.page.active');
    if (currentPage && currentPage.id === 'page-cart') {
      loadCart();
    }
    updateCartCount();
    loadProducts();
  } catch (err) {
    showToast(err.message);
  }
}

async function updateCartCount() {
  if (!token) {
    cartState = { items: [] };
    document.getElementById('cartCount').textContent = '0';
    return;
  }
  try {
    const cart = await api('/api/cart');
    cartState = cart || { items: [] };
    const count = (cartState.items || [])
      .filter((i) => i && i.product)
      .reduce((sum, item) => sum + (item.quantity || 0), 0);
    document.getElementById('cartCount').textContent = count;
  } catch {
    document.getElementById('cartCount').textContent = '0';
  }
}

// ─── Orders ─────────────────────────────────────────

function openOrderModal() {
  document.getElementById('orderModal').classList.add('open');
}

function closeOrderModal() {
  document.getElementById('orderModal').classList.remove('open');
}

async function handlePlaceOrder(e) {
  e.preventDefault();

  const shippingAddress = {
    street: document.getElementById('orderStreet').value,
    city: document.getElementById('orderCity').value,
    state: document.getElementById('orderState').value,
    zipCode: document.getElementById('orderZip').value,
  };

  try {
    await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ shippingAddress }),
    });
    closeOrderModal();
    showToast('Order placed successfully! 🎉');
    updateCartCount();
    navigateTo('orders');
  } catch (err) {
    showToast(err.message);
  }
}

async function loadOrders() {
  if (!token) {
    document.getElementById('ordersContent').innerHTML = `
      <div class="cart-empty">
        <p>🔒</p>
        <h3>Please login to view your orders</h3>
        <button class="btn btn-primary" style="margin-top:16px" onclick="toggleAuthModal()">Login</button>
      </div>
    `;
    return;
  }

  const container = document.getElementById('ordersContent');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const orders = await api('/api/orders');

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="cart-empty">
          <p>📦</p>
          <h3>No orders yet</h3>
          <button class="btn btn-primary" style="margin-top:16px" onclick="navigateTo('products')">Start Shopping</button>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map((order) => `
      <div class="order-card">
        <div class="order-header">
          <span class="order-id">Order #${order._id.slice(-8).toUpperCase()}</span>
          <span class="order-status status-${order.status}">${order.status}</span>
        </div>
        <div class="order-items">
          ${order.items.map((item) => {
            const prodName = item.product ? item.product.name : 'Electronics Item';
            const itemPrice = Number(item.price) || 0;
            const subtotal = itemPrice * (item.quantity || 1);
            return `
              <div class="order-item">
                <span>${escapeHtml(prodName)} × ${item.quantity}</span>
                <span>$${subtotal.toLocaleString()}</span>
              </div>
            `;
          }).join('')}
        </div>
        <div class="order-total">Total: $${(Number(order.totalAmount) || 0).toLocaleString()}</div>
        <div class="order-date">${new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p class="loading">Failed to load orders</p>`;
  }
}

// ─── Auth ───────────────────────────────────────────

function toggleAuthModal() {
  const modal = document.getElementById('authModal');
  if (token) {
    // logout
    token = null;
    userName = null;
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    updateAuthUI();
    updateCartCount();
    loadProducts();
    showToast('Logged out');
    navigateTo('products');
    return;
  }
  modal.classList.toggle('open');
}

function switchAuthTab(tab, el) {
  document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
  el.classList.add('active');

  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    token = data.token;
    userName = data.name;
    localStorage.setItem('token', token);
    localStorage.setItem('userName', userName);
    document.getElementById('authModal').classList.remove('open');
    updateAuthUI();
    await updateCartCount();
    loadProducts();
    const currentPage = document.querySelector('.page.active');
    if (currentPage && currentPage.id === 'page-cart') {
      loadCart();
    }
    showToast(`Welcome back, ${userName}!`);
  } catch (err) {
    document.getElementById('loginError').textContent = err.message;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;

  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    token = data.token;
    userName = data.name;
    localStorage.setItem('token', token);
    localStorage.setItem('userName', userName);
    document.getElementById('authModal').classList.remove('open');
    updateAuthUI();
    await updateCartCount();
    loadProducts();
    const currentPage = document.querySelector('.page.active');
    if (currentPage && currentPage.id === 'page-cart') {
      loadCart();
    }
    showToast(`Welcome, ${userName}! 🎉`);
  } catch (err) {
    document.getElementById('registerError').textContent = err.message;
  }
}

function updateAuthUI() {
  const btn = document.getElementById('authBtn');
  if (token && userName) {
    btn.textContent = `${userName} (Logout)`;
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
  } else {
    btn.textContent = 'Login';
    btn.classList.add('btn-primary');
    btn.classList.remove('btn-secondary');
  }
}

// ─── Chat ───────────────────────────────────────────

function toggleChat() {
  document.getElementById('chatWidget').classList.toggle('open');
  document.getElementById('chatInput').focus();
}

async function handleChat(e) {
  e.preventDefault();

  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;

  const messages = document.getElementById('chatMessages');

  // add user message
  messages.innerHTML += `<div class="chat-msg user"><p>${escapeHtml(message)}</p></div>`;
  input.value = '';
  messages.scrollTop = messages.scrollHeight;

  // add typing indicator
  messages.innerHTML += `<div class="chat-msg bot" id="typing"><p>Thinking...</p></div>`;
  messages.scrollTop = messages.scrollHeight;

  try {
    const data = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });

    // remove typing
    const typing = document.getElementById('typing');
    if (typing) typing.remove();

    // format bot response
    let html = data.message
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');

    let productsHtml = '';
    if (data.products && data.products.length > 0) {
      productsHtml = `
        <div class="chat-product-list">
          ${data.products.map((p) => `
            <div class="chat-product-item">
              <div class="chat-product-thumb">${categoryEmoji[p.category] || '📦'}</div>
              <div class="chat-product-meta">
                <div class="chat-product-title">${escapeHtml(p.name)}</div>
                <div class="chat-product-pricing">
                  <strong>$${Number(p.price).toLocaleString()}</strong>
                  <span>⭐ ${p.rating}</span>
                </div>
              </div>
              <div class="chat-product-actions">
                <button class="chat-btn-cart" onclick="addToCart('${p._id}')" title="Add to Cart">🛒 Add</button>
                <button class="chat-btn-view" onclick="openProductModal('${p._id}')" title="View Details">👁️</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    messages.innerHTML += `<div class="chat-msg bot"><p>${html}</p>${productsHtml}</div>`;
    messages.scrollTop = messages.scrollHeight;
  } catch (err) {
    const typing = document.getElementById('typing');
    if (typing) typing.remove();
    messages.innerHTML += `<div class="chat-msg bot"><p>Sorry, something went wrong. Try again!</p></div>`;
    messages.scrollTop = messages.scrollHeight;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// close modals on backdrop click
document.querySelectorAll('.modal').forEach((modal) => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });
});
