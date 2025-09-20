import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  rating: {
    type: Number,
    required: [true, 'Please provide a rating'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  title: {
    type: String,
    required: [true, 'Please provide a review title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  comment: {
    type: String,
    required: [true, 'Please provide a review comment'],
    trim: true,
    maxlength: [1000, 'Comment cannot be more than 1000 characters']
  },
  images: [{
    url: String,
    alt: String
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  helpful: {
    count: { type: Number, default: 0 },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  verified: { type: Boolean, default: false },
  verifiedPurchase: { type: Boolean, default: false },
  adminResponse: {
    comment: String,
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    respondedAt: Date
  },
  reported: {
    count: { type: Number, default: 0 },
    reasons: [{
      reason: {
        type: String,
        enum: ['inappropriate', 'spam', 'fake', 'offensive', 'other']
      },
      reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reportedAt: { type: Date, default: Date.now }
    }]
  },
  tags: [String],
  language: { type: String, default: 'en' },
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

//
// 🔹 Virtuals
//
reviewSchema.virtual('isHelpful').get(function () {
  return this.helpful.count > 0;
});

reviewSchema.virtual('helpfulPercentage').get(function () {
  return this.helpful.users.length > 0
    ? Math.round((this.helpful.count / this.helpful.users.length) * 100)
    : 0;
});

//
// 🔹 Indexes
//
reviewSchema.index({ product: 1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ status: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ verified: 1 });
reviewSchema.index({ product: 1, status: 1 });
reviewSchema.index({ product: 1, rating: 1 });
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

//
// 🔹 Middleware
//
reviewSchema.pre('save', async function (next) {
  if (this.isModified('rating') || this.isModified('status')) {
    const Product = mongoose.model('Product');
    const product = await Product.findById(this.product);
    if (product && typeof product.updateRating === 'function') {
      await product.updateRating();
    }
  }
  next();
});

//
// 🔹 Static Methods
//
reviewSchema.statics.getByProduct = function (productId, page = 1, limit = 10, sort = 'newest') {
  const skip = (page - 1) * limit;
  let sortOption = { createdAt: -1 };

  switch (sort) {
    case 'oldest': sortOption = { createdAt: 1 }; break;
    case 'rating': sortOption = { rating: -1, createdAt: -1 }; break;
    case 'helpful': sortOption = { 'helpful.count': -1, createdAt: -1 }; break;
    case 'verified': sortOption = { verified: -1, createdAt: -1 }; break;
  }

  return this.find({ product: productId, status: 'approved' })
    .populate('user', 'name avatar')
    .sort(sortOption)
    .skip(skip)
    .limit(limit);
};

reviewSchema.statics.getByUser = function (userId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ user: userId })
    .populate('product', 'title images price')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

reviewSchema.statics.getPending = function (page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ status: 'pending' })
    .populate('user', 'name email')
    .populate('product', 'title')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

reviewSchema.statics.getStats = function (productId) {
  return this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId), status: 'approved' } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
    { $sort: { _id: -1 } }
  ]);
};

reviewSchema.statics.getAverageRating = function (productId) {
  return this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId), status: 'approved' } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
};

//
// 🔹 Instance Methods
//
reviewSchema.methods.markHelpful = function (userId) {
  if (!this.helpful.users.includes(userId)) {
    this.helpful.users.push(userId);
    this.helpful.count += 1;
  }
  return this.save();
};

reviewSchema.methods.unmarkHelpful = function (userId) {
  const index = this.helpful.users.indexOf(userId);
  if (index > -1) {
    this.helpful.users.splice(index, 1);
    this.helpful.count = Math.max(0, this.helpful.count - 1);
  }
  return this.save();
};

reviewSchema.methods.report = function (userId, reason) {
  this.reported.count += 1;
  this.reported.reasons.push({ reason, reportedBy: userId });
  return this.save();
};

reviewSchema.methods.approve = function () {
  this.status = 'approved';
  return this.save();
};

reviewSchema.methods.reject = function () {
  this.status = 'rejected';
  return this.save();
};

reviewSchema.methods.addAdminResponse = function (comment, adminId) {
  this.adminResponse = { comment, respondedBy: adminId, respondedAt: new Date() };
  return this.save();
};

const Review = mongoose.model('Review', reviewSchema);

export default Review;
