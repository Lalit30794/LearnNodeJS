# 🛒 E-commerce API Documentation

## Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Endpoints](#endpoints)

## Overview

The E-commerce API is a RESTful service built with Node.js, Express, and MongoDB. It provides comprehensive functionality for managing an online store.

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Base URL

```
Development: http://localhost:5000/api
Production: https://your-domain.com/api
```

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Optional message"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2023-01-01T00:00:00.000Z",
  "path": "/api/endpoint",
  "method": "GET"
}
```

## Error Handling

The API uses standard HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Too Many Requests
- `500` - Internal Server Error

## Rate Limiting

- **Limit**: 100 requests per 15 minutes per IP
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Exempt**: Health check endpoints

---

## Endpoints

### Authentication Endpoints

#### Register User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "phone": "+1234567890"
}
```

#### Login User
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

#### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>
```

#### Update Profile
```http
PUT /auth/update-profile
Authorization: Bearer <token>
```

#### Change Password
```http
PUT /auth/change-password
Authorization: Bearer <token>
```

### Product Endpoints

#### Get All Products
```http
GET /products?page=1&limit=12&sort=newest&category=category-id&minPrice=10&maxPrice=100&brand=Apple&rating=4&inStock=true
```

#### Get Product by ID
```http
GET /products/:id
```

#### Create Product (Vendor/Admin)
```http
POST /products
Authorization: Bearer <token>
```

#### Update Product
```http
PUT /products/:id
Authorization: Bearer <token>
```

#### Delete Product
```http
DELETE /products/:id
Authorization: Bearer <token>
```

### Category Endpoints

#### Get All Categories
```http
GET /categories?includeSubcategories=true&status=active
```

#### Get Category by ID
```http
GET /categories/:id
```

#### Create Category (Admin)
```http
POST /categories
Authorization: Bearer <token>
```

### Order Endpoints

#### Get User Orders
```http
GET /orders?page=1&limit=10&status=pending
Authorization: Bearer <token>
```

#### Get Order by ID
```http
GET /orders/:id
Authorization: Bearer <token>
```

#### Create Order from Cart
```http
POST /orders/from-cart
Authorization: Bearer <token>
```

### Cart Endpoints

#### Get User Cart
```http
GET /cart
Authorization: Bearer <token>
```

#### Add Item to Cart
```http
POST /cart/items
Authorization: Bearer <token>
```

#### Update Cart Item
```http
PUT /cart/items/:itemId
Authorization: Bearer <token>
```

#### Remove Cart Item
```http
DELETE /cart/items/:itemId
Authorization: Bearer <token>
```

### Review Endpoints

#### Get Product Reviews
```http
GET /products/:productId/reviews?page=1&limit=10&rating=4
```

#### Create Review
```http
POST /products/:productId/reviews
Authorization: Bearer <token>
```

### Payment Endpoints

#### Create Payment Intent
```http
POST /payments/create-intent
Authorization: Bearer <token>
```

#### Confirm Payment
```http
POST /payments/confirm
Authorization: Bearer <token>
```

#### Process Refund (Admin)
```http
POST /payments/refund
Authorization: Bearer <token>
```

### Search Endpoints

#### Search Products
```http
GET /search?q=iphone&category=electronics&minPrice=500&maxPrice=1000&rating=4&inStock=true&sort=relevance
```

#### Get Search Suggestions
```http
GET /search/suggestions?q=iph
```

#### Get Search Filters
```http
GET /search/filters
```

#### Get Trending Products
```http
GET /search/trending?limit=10
```

---

## SDK Examples

### JavaScript/Node.js
```javascript
const API_BASE = 'http://localhost:5000/api';

// Register user
const registerUser = async (userData) => {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });
  return response.json();
};

// Login user
const loginUser = async (credentials) => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });
  return response.json();
};

// Get products with authentication
const getProducts = async (token, params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE}/products?${queryString}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
};
```

### cURL Examples

#### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "phone": "+1234567890"
  }'
```

#### Login User
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

#### Get Products (with token)
```bash
curl -X GET http://localhost:5000/api/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Best Practices

### Error Handling
- Always check the `success` field in responses
- Handle rate limiting with exponential backoff
- Implement proper error logging

### Authentication
- Store tokens securely
- Implement token refresh logic
- Handle token expiration gracefully

### Performance
- Use pagination for large datasets
- Implement caching where appropriate
- Use compression for large responses

### Security
- Never expose sensitive data in logs
- Validate all input data
- Use HTTPS in production
- Implement proper CORS policies

---

**Version**: 1.0.0  
**Last Updated**: January 2024 