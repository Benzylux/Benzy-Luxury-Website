const Product = require('../models/Product');
const productSeed = require('../data/productSeed');
const AppError = require('../utils/appError');
const { roundCurrency } = require('../utils/money');

function normalizeLookupKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function capitalizeWords(value) {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isPlaceholderCategory(value) {
  const normalized = normalizeLookupKey(value);
  return !normalized || ['all', 'collection', 'collections', 'category', 'uncategorized'].includes(normalized);
}

function buildSeedLookup() {
  const lookup = new Map();
  for (const seed of productSeed) {
    const productId = normalizeString(seed?.productId);
    const normalizedName = normalizeLookupKey(seed?.normalizedName || seed?.name);
    if (productId) lookup.set(`id:${productId}`, seed);
    if (normalizedName) lookup.set(`name:${normalizedName}`, seed);
  }
  return lookup;
}

function resolveSeedForProduct(product, seedLookup) {
  const productId = normalizeString(product?.productId);
  const normalizedName = normalizeLookupKey(product?.normalizedName || product?.name);
  return seedLookup.get(`id:${productId}`) || seedLookup.get(`name:${normalizedName}`) || null;
}

function buildCatalogBackfill(product, seed) {
  const $set = {};
  const name = normalizeString(product?.name || seed?.name);
  const normalizedName = normalizeLookupKey(name);

  if (name && product?.name !== name) $set.name = name;
  if (normalizedName && product?.normalizedName !== normalizedName) $set.normalizedName = normalizedName;
  if (!normalizeString(product?.slug) && name) $set.slug = normalizeSlug(name);
  if (!normalizeString(product?.currency)) $set.currency = seed?.currency || 'NGN';
  if (product?.isActive === undefined || product?.isActive === null) $set.isActive = true;

  const seedCategoryId = normalizeString(seed?.categoryId);
  const seedCategoryName = normalizeString(seed?.categoryName);
  const currentCategoryId = normalizeString(product?.categoryId);
  const currentCategoryName = normalizeString(product?.categoryName);

  if (seed && (isPlaceholderCategory(currentCategoryId) || isPlaceholderCategory(currentCategoryName))) {
    if (seedCategoryId) $set.categoryId = seedCategoryId;
    if (seedCategoryName) $set.categoryName = seedCategoryName;
  } else {
    if (!currentCategoryId && currentCategoryName) $set.categoryId = normalizeSlug(currentCategoryName) || 'collection';
    if (!currentCategoryName && currentCategoryId) $set.categoryName = capitalizeWords(currentCategoryId) || 'Collection';
  }

  const currentImages = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
  const seedImages = Array.isArray(seed?.images) ? seed.images.filter(Boolean) : [];
  if (!normalizeString(product?.image) && normalizeString(seed?.image)) $set.image = seed.image;
  if (!currentImages.length && seedImages.length) $set.images = seedImages;

  const currentVariants = Array.isArray(product?.variants) ? product.variants : [];
  if (!currentVariants.length && Array.isArray(seed?.variants) && seed.variants.length) {
    $set.variants = seed.variants;
  }

  return $set;
}

async function backfillExistingProductCatalog() {
  const products = await Product.find({}).lean();
  if (!products.length) return;

  const seedLookup = buildSeedLookup();
  const existingProductIds = new Set(products.map((product) => normalizeString(product?.productId)).filter(Boolean));
  const existingNames = new Set(products.map((product) => normalizeLookupKey(product?.normalizedName || product?.name)).filter(Boolean));
  const writes = [];

  for (const product of products) {
    const seed = resolveSeedForProduct(product, seedLookup);
    const $set = buildCatalogBackfill(product, seed);
    if (!Object.keys($set).length) continue;

    writes.push({
      updateOne: {
        filter: { _id: product._id },
        update: { $set }
      }
    });
  }

  for (const seed of productSeed) {
    const productId = normalizeString(seed?.productId);
    const normalizedName = normalizeLookupKey(seed?.normalizedName || seed?.name);
    if ((productId && existingProductIds.has(productId)) || (normalizedName && existingNames.has(normalizedName))) {
      continue;
    }

    writes.push({
      insertOne: {
        document: seed
      }
    });
  }

  if (writes.length) {
    await Product.bulkWrite(writes, { ordered: false });
  }
}

function buildLineKey(item) {
  return [
    normalizeString(item?.productId).toLowerCase(),
    normalizeString(item?.variantId).toLowerCase(),
    normalizeString(item?.size).toLowerCase(),
    normalizeString(item?.color).toLowerCase()
  ].join('::');
}

async function seedProductCatalog() {
  const existing = await Product.estimatedDocumentCount();
  if (existing > 0) {
    await backfillExistingProductCatalog();
    return;
  }
  await Product.insertMany(productSeed, { ordered: true });
}

async function findProductOrThrow(item) {
  const productId = normalizeString(item?.productId || item?.id);
  const name = normalizeString(item?.name || item?.title);
  let product = null;

  if (productId) {
    product = await Product.findOne({ productId, isActive: true }).lean();
  }

  if (!product && name) {
    product = await Product.findOne({
      normalizedName: normalizeLookupKey(name),
      isActive: true
    }).lean();
  }

  if (!product) {
    throw new AppError(404, `Product "${productId || name || 'unknown'}" was not found.`);
  }

  return product;
}

function resolveVariant(product, item) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const requestedVariantId = normalizeString(item?.variantId);
  const requestedColor = normalizeLookupKey(item?.color);

  if (requestedVariantId) {
    const matchedById = variants.find((variant) => String(variant?.variantId || '').trim() === requestedVariantId);
    if (matchedById) return matchedById;
  }

  if (requestedColor) {
    const matchedByColor = variants.find((variant) => normalizeLookupKey(variant?.color) === requestedColor);
    if (matchedByColor) return matchedByColor;
  }

  return variants.find((variant) => Boolean(variant?.isDefault)) || variants[0] || null;
}

function getAvailableStock(product, variant) {
  const variantStock = Number(variant?.stockQuantity);
  if (Number.isFinite(variantStock)) return variantStock;
  return Number(product?.stockQuantity || 0);
}

async function hydrateRequestedCartItem(item) {
  const product = await findProductOrThrow(item);
  const variant = resolveVariant(product, item);
  const quantity = Math.max(1, parseInt(String(item?.quantity || item?.qty || 1), 10));
  const size = normalizeString(item?.size);
  const color = normalizeString(item?.color || variant?.color);
  const variantId = normalizeString(item?.variantId || variant?.variantId);
  const availableStock = getAvailableStock(product, variant);

  if (availableStock < quantity) {
    throw new AppError(409, `${product.name} only has ${availableStock} item(s) left in stock.`);
  }

  return {
    _id: item?._id || item?.id || null,
    lineKey: buildLineKey({
      productId: product.productId,
      variantId,
      size,
      color
    }),
    productId: String(product.productId || '').trim(),
    name: String(product.name || '').trim(),
    price: roundCurrency(variant?.price ?? product.price ?? 0),
    image: String(variant?.image || product.image || product.images?.[0] || '').trim(),
    quantity,
    size,
    color,
    variantId,
    categoryId: String(product.categoryId || 'all').trim(),
    availableStock
  };
}

async function hydrateAndMergeCartItems(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const hydrated = [];

  for (const item of safeItems) {
    hydrated.push(await hydrateRequestedCartItem(item));
  }

  const mergedByKey = new Map();
  for (const item of hydrated) {
    const current = mergedByKey.get(item.lineKey);
    if (current) {
      current.quantity += item.quantity;
      continue;
    }
    mergedByKey.set(item.lineKey, { ...item });
  }

  const merged = Array.from(mergedByKey.values()).map((item) => {
    if (item.quantity > item.availableStock) {
      throw new AppError(409, `${item.name} only has ${item.availableStock} item(s) left in stock.`);
    }

    return {
      ...item,
      stockQuantity: item.availableStock
    };
  });

  return merged;
}

module.exports = {
  buildLineKey,
  findProductOrThrow,
  hydrateAndMergeCartItems,
  seedProductCatalog
};
