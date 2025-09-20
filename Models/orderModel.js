import mongoose from 'mongoose';

// Order Item Subschema
const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
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
  image: String
}, {
  timestamps: true
});

// Main Order Schema
const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],

  status: {
    type: String,
    enum: [
      'pending', 'confirmed', 'processing',
      'shipped', 'delivered', 'cancelled', 'refunded'
    ],
    default: 'pending'
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: [
      'credit_card', 'debit_card',
      'paypal', 'stripe', 'bank_transfer', 'cash_on_delivery'
    ]
  },
  paymentDetails: {
    transactionId: String,
    paymentIntentId: String,
    paymentDate: Date,
    gateway: String,
    currency: {
      type: String,
      default: 'USD'
    }
  },

  subtotal: {
    type: Number,
    required: true,
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
    method: {
      type: String,
      required: true
    },
    trackingNumber: String,
    carrier: String,
    estimatedDelivery: Date
  },
  discount: {
    code: String,
    amount: {
      type: Number,
      default: 0,
      min: [0, 'Discount must be positive']
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'fixed'
    }
  },
  total: {
    type: Number,
    required: true,
    min: [0, 'Total must be positive']
  },

  billingAddress: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true }
  },
  shippingAddress: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true }
  },

  notes: {
    customer: String,
    internal: String
  },
  statusHistory: [{
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  refund: {
    amount: { type: Number, min: [0, 'Refund must be positive'] },
    reason: String,
    processedAt: Date,
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  emailSent: {
    confirmation: { type: Boolean, default: false },
    shipping: { type: Boolean, default: false },
    delivery: { type: Boolean, default: false }
  },
  source: {
    type: String,
    enum: ['web', 'mobile', 'admin'],
    default: 'web'
  },
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/* -------------------- VIRTUALS -------------------- */
orderSchema.virtual('totalItems').get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

orderSchema.virtual('isPaid').get(function () {
  return this.paymentStatus === 'paid';
});

orderSchema.virtual('canBeCancelled').get(function () {
  return ['pending', 'confirmed', 'processing'].includes(this.status);
});

orderSchema.virtual('canBeRefunded').get(function () {
  return this.paymentStatus === 'paid' && this.status === 'delivered';
});

/* -------------------- INDEXES -------------------- */
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'paymentDetails.transactionId': 1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });

/* -------------------- HOOKS -------------------- */
// Generate unique order number
orderSchema.pre('save', async function (next) {
  if (this.isNew) {
    const date = new Date();
    const y = date.getFullYear().toString().slice(-2);
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');

    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const count = await this.constructor.countDocuments({ createdAt: { $gte: today } });

    this.orderNumber = `ORD${y}${m}${d}${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

// Track status history
orderSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      updatedBy: this.user
    });
  }
  next();
});

/* -------------------- STATICS -------------------- */
orderSchema.statics.getByUser = function (userId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ user: userId })
    .populate('items.product', 'name images')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

orderSchema.statics.getByStatus = function (status, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ status })
    .populate('user', 'name email')
    .populate('items.product', 'name images')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

orderSchema.statics.getStats = function () {
  return this.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' } } }
  ]);
};

/* -------------------- METHODS -------------------- */
orderSchema.methods.calculateTotals = function () {
  this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
  this.total = this.subtotal + this.tax + this.shipping.cost - this.discount.amount;
  return this;
};

orderSchema.methods.addItem = function (product, quantity, price, variant = null) {
  const total = quantity * price;
  this.items.push({
    product: product._id,
    name: product.name,
    sku: product.sku,
    quantity,
    price,
    total,
    variant,
    image: product.primaryImage
  });
  return this.calculateTotals();
};

orderSchema.methods.updateStatus = function (newStatus, note = '', updatedBy = null) {
  this.status = newStatus;
  this.statusHistory.push({ status: newStatus, timestamp: new Date(), note, updatedBy });
  return this;
};

orderSchema.methods.processRefund = function (amount, reason, processedBy) {
  this.refund = { amount, reason, processedAt: new Date(), processedBy };
  this.paymentStatus = amount >= this.total ? 'refunded' : 'partially_refunded';
  this.status = 'refunded';
  return this;
};

const Order = mongoose.model('Order', orderSchema);

export default Order;
