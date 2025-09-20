import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  sku: String,
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price must be positive']
  },
  total: {
    type: Number,
    required: true,
    min: [0, 'Total must be positive']
  },
  variant: {
    name: String,
    option: String
  },
  image: String,
  available: {
    type: Boolean,
    default: true
  },
  maxQuantity: {
    type: Number,
    default: 100
  }
}, {
  timestamps: true
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    unique: true,
    sparse: true
  },
  items: [cartItemSchema],
  subtotal: {
    type: Number,
    default: 0,
    min: [0, 'Subtotal must be positive']
  },
  tax: {
    type: Number,
    default: 0,
    min: [0, 'Tax must be positive']
  },
  shipping: {
    cost: {
      type: Number,
      default: 0,
      min: [0, 'Shipping cost must be positive']
    },
    method: String,
    address: {
      name: String,
      email: String,
      phone: String,
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    }
  },
  discount: {
    code: String,
    amount: {
      type: Number,
      default: 0,
      min: [0, 'Discount amount must be positive']
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'fixed'
    },
    valid: {
      type: Boolean,
      default: false
    }
  },
  total: {
    type: Number,
    default: 0,
    min: [0, 'Total must be positive']
  },
  currency: {
    type: String,
    default: 'USD'
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total items count
cartSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for unique items count
cartSchema.virtual('uniqueItems').get(function() {
  return this.items.length;
});

// Virtual for has items
cartSchema.virtual('hasItems').get(function() {
  return this.items.length > 0;
});

// Virtual for is expired
cartSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

// Indexes for better query performance
cartSchema.index({ user: 1 });
cartSchema.index({ sessionId: 1 });
cartSchema.index({ expiresAt: 1 });
cartSchema.index({ isActive: 1 });
cartSchema.index({ lastActivity: -1 });

// Compound indexes
cartSchema.index({ user: 1, isActive: 1 });
cartSchema.index({ sessionId: 1, isActive: 1 });

// Pre-save middleware to update last activity
cartSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  next();
});

// Pre-save middleware to calculate totals
cartSchema.pre('save', function(next) {
  this.calculateTotals();
  next();
});

// Static method to get cart by user
cartSchema.statics.getByUser = function(userId) {
  return this.findOne({ 
    user: userId, 
    isActive: true 
  }).populate('items.product', 'name price images inventory status');
};

// Static method to get cart by session
cartSchema.statics.getBySession = function(sessionId) {
  return this.findOne({ 
    sessionId, 
    isActive: true 
  }).populate('items.product', 'name price images inventory status');
};

// Static method to merge session cart with user cart
cartSchema.statics.mergeCarts = async function(sessionId, userId) {
  const sessionCart = await this.getBySession(sessionId);
  const userCart = await this.getByUser(userId);

  if (!sessionCart) return userCart;
  if (!userCart) {
    sessionCart.user = userId;
    sessionCart.sessionId = null;
    return sessionCart.save();
  }

  // Merge items from session cart to user cart
  for (const sessionItem of sessionCart.items) {
    const existingItem = userCart.items.find(item => 
      item.product.toString() === sessionItem.product.toString() &&
      JSON.stringify(item.variant) === JSON.stringify(sessionItem.variant)
    );

    if (existingItem) {
      existingItem.quantity += sessionItem.quantity;
      existingItem.total = existingItem.quantity * existingItem.price;
    } else {
      userCart.items.push(sessionItem);
    }
  }

  // Deactivate session cart
  sessionCart.isActive = false;
  await sessionCart.save();

  return userCart.save();
};

// Static method to clean expired carts
cartSchema.statics.cleanExpired = function() {
  return this.updateMany(
    { 
      expiresAt: { $lt: new Date() },
      isActive: true 
    },
    { isActive: false }
  );
};

// Instance method to calculate totals
cartSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((total, item) => total + item.total, 0);
  this.total = this.subtotal + this.tax + this.shipping.cost - this.discount.amount;
  return this;
};

// Instance method to add item
cartSchema.methods.addItem = function(product, quantity = 1, variant = null) {
  const existingItem = this.items.find(item => 
    item.product.toString() === product._id.toString() &&
    JSON.stringify(item.variant) === JSON.stringify(variant)
  );

  if (existingItem) {
    existingItem.quantity += quantity;
    existingItem.total = existingItem.quantity * existingItem.price;
  } else {
    const total = quantity * product.price;
    this.items.push({
      product: product._id,
      name: product.name,
      sku: product.sku,
      quantity,
      price: product.price,
      total,
      variant,
      image: product.primaryImage,
      maxQuantity: product.inventory.maxOrderQuantity || 100
    });
  }

  this.calculateTotals();
  return this;
};

// Instance method to update item quantity
cartSchema.methods.updateItemQuantity = function(itemId, quantity) {
  const item = this.items.id(itemId);
  if (!item) {
    throw new Error('Item not found in cart');
  }

  if (quantity <= 0) {
    this.items.pull(itemId);
  } else {
    item.quantity = Math.min(quantity, item.maxQuantity);
    item.total = item.quantity * item.price;
  }

  this.calculateTotals();
  return this;
};

// Instance method to remove item
cartSchema.methods.removeItem = function(itemId) {
  this.items.pull(itemId);
  this.calculateTotals();
  return this;
};

// Instance method to clear cart
cartSchema.methods.clear = function() {
  this.items = [];
  this.calculateTotals();
  return this;
};

// Instance method to apply discount
cartSchema.methods.applyDiscount = function(code, amount, type = 'fixed') {
  this.discount = {
    code,
    amount,
    type,
    valid: true
  };
  this.calculateTotals();
  return this;
};

// Instance method to remove discount
cartSchema.methods.removeDiscount = function() {
  this.discount = {
    code: null,
    amount: 0,
    type: 'fixed',
    valid: false
  };
  this.calculateTotals();
  return this;
};

// Instance method to set shipping address
cartSchema.methods.setShippingAddress = function(address) {
  this.shipping.address = address;
  return this;
};

// Instance method to validate items
cartSchema.methods.validateItems = async function() {
  const Product = mongoose.model('Product');
  
  for (const item of this.items) {
    const product = await Product.findById(item.product);
    if (!product || product.status !== 'active') {
      item.available = false;
    } else if (product.inventory.trackQuantity && item.quantity > product.inventory.quantity) {
      item.available = false;
    } else {
      item.available = true;
      item.maxQuantity = product.inventory.maxOrderQuantity || 100;
    }
  }

  return this;
};

const Cart = mongoose.model('Cart', cartSchema);

export default Cart; 