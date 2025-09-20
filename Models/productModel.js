import mongoose from 'mongoose';
import slugify from 'slugify';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a product name'],
    trim: true,
    maxlength: [100, 'Product name cannot be more than 100 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [200, 'Short description cannot be more than 200 characters']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Please select a category']
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  brand: {
    type: String,
    required: [true, 'Please add a brand']
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  price: {
    type: Number,
    required: [true, 'Please add a price'],
    min: [0, 'Price must be positive']
  },
  compareAtPrice: {
    type: Number,
    min: [0, 'Compare at price must be positive']
  },
  costPrice: {
    type: Number,
    min: [0, 'Cost price must be positive']
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'INR']
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  variants: [{
    name: {
      type: String,
      required: true
    },
    options: [{
      name: String,
      price: Number,
      sku: String,
      barcode: String,
      weight: Number,
      dimensions: {
        length: Number,
        width: Number,
        height: Number
      }
    }]
  }],
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true
  },
  inventory: {
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative'],
      default: 0
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: [0, 'Low stock threshold cannot be negative']
    },
    trackQuantity: {
      type: Boolean,
      default: true
    },
    allowBackorder: {
      type: Boolean,
      default: false
    },
    maxOrderQuantity: {
      type: Number,
      default: 100
    }
  },
  shipping: {
    weight: {
      type: Number,
      min: [0, 'Weight cannot be negative']
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    requiresShipping: {
      type: Boolean,
      default: true
    },
    freeShipping: {
      type: Boolean,
      default: false
    }
  },
  seo: {
    title: {
      type: String,
      maxlength: [60, 'SEO title cannot be more than 60 characters']
    },
    description: {
      type: String,
      maxlength: [160, 'SEO description cannot be more than 160 characters']
    },
    keywords: [String]
  },
  tags: [String],
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'archived'],
    default: 'draft'
  },
  featured: {
    type: Boolean,
    default: false
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  sales: {
    total: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  viewCount: {
    type: Number,
    default: 0
  },
  specifications: [{
    name: String,
    value: String
  }],
  warranty: {
    type: String,
    default: 'No warranty'
  },
  returnPolicy: {
    type: String,
    default: 'Standard return policy'
  },
  isDigital: {
    type: Boolean,
    default: false
  },
  digitalFile: {
    url: String,
    size: Number,
    type: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});


// ----------------- VIRTUALS -----------------

productSchema.virtual('discountPercentage').get(function () {
  if (this.compareAtPrice && this.compareAtPrice > this.price) {
    return Math.round(((this.compareAtPrice - this.price) / this.compareAtPrice) * 100);
  }
  return 0;
});

productSchema.virtual('primaryImage').get(function () {
  const primary = this.images.find(img => img.isPrimary);
  return primary ? primary.url : (this.images[0] ? this.images[0].url : null);
});

productSchema.virtual('inStock').get(function () {
  if (!this.inventory.trackQuantity) return true;
  return this.inventory.quantity > 0 || this.inventory.allowBackorder;
});

productSchema.virtual('lowStock').get(function () {
  return this.inventory.quantity <= this.inventory.lowStockThreshold && this.inventory.quantity > 0;
});


// ----------------- INDEXES -----------------

productSchema.index({ slug: 1 });
productSchema.index({ category: 1 });
productSchema.index({ vendor: 1 });
productSchema.index({ status: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ price: 1 });
productSchema.index({ 'rating.average': -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Compound indexes
productSchema.index({ category: 1, status: 1 });
productSchema.index({ vendor: 1, status: 1 });
productSchema.index({ price: 1, status: 1 });


// ----------------- MIDDLEWARE -----------------

// Generate slug before saving
productSchema.pre('save', function (next) {
  if (!this.isModified('name')) return next();

  this.slug = slugify(this.name, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });

  next();
});


// ----------------- STATIC METHODS -----------------

// Get featured products
productSchema.statics.getFeatured = function () {
  return this.find({
    status: 'active',
    featured: true
  }).populate('category', 'name');
};

// Get products by category
productSchema.statics.getByCategory = function (categoryId) {
  return this.find({
    category: categoryId,
    status: 'active'
  }).populate('category', 'name');
};

// Search products
productSchema.statics.search = function (query) {
  return this.find({
    $text: { $search: query },
    status: 'active'
  }, {
    score: { $meta: 'textScore' }
  }).sort({ score: { $meta: 'textScore' } });
};


// ----------------- INSTANCE METHODS -----------------

// Increment product views
productSchema.methods.incrementViewCount = function () {
  this.viewCount += 1;
  return this.save();
};

// Update product rating from reviews
productSchema.methods.updateRating = function () {
  return this.model('Review').aggregate([
    { $match: { product: this._id, status: 'approved' } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        count: { $sum: 1 }
      }
    }
  ]).then(result => {
    if (result.length > 0) {
      this.rating.average = Math.round(result[0].averageRating * 10) / 10;
      this.rating.count = result[0].count;
    } else {
      this.rating.average = 0;
      this.rating.count = 0;
    }
    return this.save();
  });
};


const Product = mongoose.model('Product', productSchema);

export default Product;
