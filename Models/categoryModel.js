import mongoose from 'mongoose';
import slugify from 'slugify';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a category name'],
    trim: true,
    maxlength: [50, 'Category name cannot exceed 50 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  ancestors: [{
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    name: String,
    slug: String
  }],
  level: { type: Number, default: 0 },
  image: { url: String, alt: String },
  icon: { type: String, default: 'folder' },
  color: { type: String, default: '#6c757d' },
  seo: {
    title: { type: String, maxlength: [60, 'SEO title cannot exceed 60 characters'] },
    description: { type: String, maxlength: [160, 'SEO description cannot exceed 160 characters'] },
    keywords: [String]
  },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  featured: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
  productCount: { type: Number, default: 0 },
  attributes: [{
    name: { type: String, required: true },
    type: { type: String, enum: ['text', 'number', 'boolean', 'select', 'multiselect'], default: 'text' },
    required: { type: Boolean, default: false },
    options: [String],
    unit: String,
    min: Number,
    max: Number
  }],
  filters: [{
    name: String,
    type: { type: String, enum: ['range', 'checkbox', 'radio', 'select'], default: 'checkbox' },
    options: [String],
    min: Number,
    max: Number
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/* -------------------- VIRTUALS -------------------- */
categorySchema.virtual('fullPath').get(function() {
  return [...this.ancestors.map(a => a.name), this.name].join(' > ');
});

categorySchema.virtual('fullSlugPath').get(function() {
  return [...this.ancestors.map(a => a.slug), this.slug].join('/');
});

categorySchema.virtual('childrenCount', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent',
  count: true
});

/* -------------------- INDEXES -------------------- */
categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ status: 1 });
categorySchema.index({ featured: 1 });
categorySchema.index({ sortOrder: 1 });
categorySchema.index({ level: 1 });
categorySchema.index({ 'ancestors._id': 1 });
categorySchema.index({ parent: 1, status: 1 });
categorySchema.index({ level: 1, status: 1 });

/* -------------------- HOOKS -------------------- */
categorySchema.pre('save', async function(next) {
  // Generate slug
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
  }

  // Update ancestors & level
  if (this.isModified('parent')) {
    if (this.parent) {
      const parent = await this.constructor.findById(this.parent);
      if (parent) {
        this.level = parent.level + 1;
        this.ancestors = [...parent.ancestors, { _id: parent._id, name: parent.name, slug: parent.slug }];
      }
    } else {
      this.level = 0;
      this.ancestors = [];
    }
  }

  // Update product count
  if (this.isModified('status') || this.isNew) {
    const Product = mongoose.model('Product');
    this.productCount = await Product.countDocuments({ category: this._id, status: 'active' });
  }

  next();
});

/* -------------------- STATICS -------------------- */
categorySchema.statics.getRootCategories = function() {
  return this.find({ parent: null, status: 'active' }).sort({ sortOrder: 1, name: 1 });
};

categorySchema.statics.getChildren = function(parentId) {
  return this.find({ parent: parentId, status: 'active' }).sort({ sortOrder: 1, name: 1 });
};

categorySchema.statics.getTree = function() {
  return this.aggregate([
    { $match: { status: 'active' } },
    {
      $graphLookup: {
        from: 'categories',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parent',
        as: 'children',
        restrictSearchWithMatch: { status: 'active' }
      }
    },
    { $sort: { sortOrder: 1, name: 1 } }
  ]);
};

categorySchema.statics.getBreadcrumb = function(categoryId) {
  return this.findById(categoryId).then(category => {
    if (!category) return [];
    return [...category.ancestors, { _id: category._id, name: category.name, slug: category.slug }];
  });
};

/* -------------------- METHODS -------------------- */
categorySchema.methods.getDescendants = function() {
  return this.constructor.find({ 'ancestors._id': this._id, status: 'active' });
};

categorySchema.methods.getAncestors = function() {
  return this.constructor.find({ _id: { $in: this.ancestors.map(a => a._id) } }).sort({ level: 1 });
};

categorySchema.methods.hasChildren = function() {
  return this.constructor.exists({ parent: this._id, status: 'active' });
};

categorySchema.methods.updateProductCount = async function() {
  const Product = mongoose.model('Product');
  this.productCount = await Product.countDocuments({ category: this._id, status: 'active' });
  return this.save();
};

const Category = mongoose.model('Category', categorySchema);

export default Category;
