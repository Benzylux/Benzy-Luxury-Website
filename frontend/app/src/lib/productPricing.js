export function getProductRegularPrice(product) {
  return Number(product?.priceNgn ?? product?.price ?? 0);
}

export function getProductSalePrice(product) {
  const regularPrice = getProductRegularPrice(product);
  const metadata = product?.metadata && typeof product.metadata === 'object' ? product.metadata : {};
  const salePrice = Number(
    product?.discountPrice
    ?? product?.discountPriceNgn
    ?? product?.salePrice
    ?? product?.discountedPrice
    ?? metadata.discountPrice
    ?? 0
  );

  return Number.isFinite(salePrice) && salePrice > 0 && salePrice < regularPrice ? salePrice : 0;
}

export function getProductDisplayPrice(product) {
  return getProductSalePrice(product) || getProductRegularPrice(product);
}
