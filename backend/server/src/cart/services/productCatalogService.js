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
  if (existing > 0) return;
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

    const { availableStock, ...rest } = item;
    return rest;
  });

  return merged;
}

module.exports = {
  buildLineKey,
  findProductOrThrow,
  hydrateAndMergeCartItems,
  seedProductCatalog
};
