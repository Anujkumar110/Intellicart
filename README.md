# 🛒 Intellicart

An AI-powered electronics store built with Node.js, Express, and MongoDB. It features a clean web storefront, an intelligent shopping assistant that searches products using RAG, and an MCP server for AI agent integrations.

---

## ✨ Features

- **Storefront & Catalog**: Browse, search, and filter electronics by category, brand, and price.
- **Cart & Orders**: Shopping cart management and checkout with user authentication (JWT + bcrypt).
- **AI Shopping Assistant (RAG)**: Recommends products based on user queries using database retrieval (works locally out of the box, with optional OpenAI enhancement).
- **MCP Protocol**: Built-in Model Context Protocol server allowing AI agents to interact with the store.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Mongoose)
- **Frontend**: HTML5, CSS3, JavaScript
- **Auth**: JWT & bcryptjs

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Anujkumar110/intellicart.git
cd intellicart
npm install
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Add your configuration inside `.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/intellicart
JWT_SECRET=your_secret_key_here

# Optional (leave blank to use the free built-in local assistant)
OPENAI_API_KEY=
```

### 3. Seed Products & Run

```bash
# Seed sample electronics data
npm run seed

# Start development server
npm run dev
```

Open **http://localhost:5000** in your browser.
