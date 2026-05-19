function createProduct(seed) {
  const id = String(seed.id);
  const name = String(seed.name || '').trim();
  const categoryId = String(seed.category || 'all').trim().toLowerCase();
  const categoryName = categoryId.charAt(0).toUpperCase() + categoryId.slice(1);
  const stockQuantity = Number(seed.stockQuantity || 12);
  const images = Array.isArray(seed.images) ? seed.images.filter(Boolean) : [];
  const image = images[0] || '';
  const variantColor = String(seed.color || '').trim();

  return {
    productId: id,
    normalizedName: name.toLowerCase().replace(/\s+/g, ' ').trim(),
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    categoryId,
    categoryName,
    price: Number(seed.price || 0),
    currency: 'NGN',
    image,
    images,
    stockQuantity,
    isActive: true,
    variants: [
      {
        variantId: `${id}-default`,
        sku: `BLX-${id.padStart(3, '0')}`,
        color: variantColor,
        size: '',
        stockQuantity,
        price: Number(seed.price || 0),
        image,
        isDefault: true
      }
    ],
    metadata: {
      source: 'seed'
    }
  };
}

module.exports = [
  createProduct({ id: 0, name: 'BENZYLUX WHITE JERSEY', price: 35000, category: 'men', color: 'White', stockQuantity: 18, images: ['OFF BACK/BENZYLUX_WHITE_JERSEY_FRONT.png', 'OFF BACK/BENZYLUX_WHITE_JERSEY_BACK.png'] }),
  createProduct({ id: 1, name: 'BENZYLUX BLACK JERSEY', price: 35000, category: 'men', color: 'Black', stockQuantity: 18, images: ['OFF BACK/BENZY LUXURY BLACK FRONT.png', 'OFF BACK/BENZY LUXURY BLACK BACK.png'] }),
  createProduct({ id: 2, name: 'BENZYLUX RED JERSEY', price: 25000, category: 'men', color: 'Red', stockQuantity: 16, images: ['OFF BACK/Benzy_Luxury_Jersey_Red_FRONT_with_bgc.png', 'OFF BACK/Benzy_Luxury_Jersey_Red_BACK_with_bgc.png'] }),
  createProduct({ id: 3, name: 'BENZYLUX IN-RED JERSEY', price: 25000, category: 'men', color: 'Red Inverted', stockQuantity: 16, images: ['OFF BACK/Benzy_Luxury_Jersey_Red_Inverted_BACK_with_bgc.png', 'OFF BACK/Benzy_Luxury_Jersey_Red_Inverted_FRONT_with_bgc.png'] }),
  createProduct({ id: 4, name: 'BENZYLUX BLUE JERSEY', price: 25000, category: 'men', color: 'Blue', stockQuantity: 16, images: ['OFF BACK/Benzy_Luxury_Jersey_Blue_FRONT_with_bgc.png', 'OFF BACK/Benzy_Luxury_Jersey_Blue_BACK_with_bgc.png'] }),
  createProduct({ id: 5, name: 'BENZYLUX BROWN JERSEY', price: 25000, category: 'men', color: 'Brown', stockQuantity: 14, images: ['OFF BACK/Benzy_Luxury_Jersey_Brown_Front_with_bgc (2).png', 'OFF BACK/Benzy_Luxury_Jersey_Brown_BACK_with_bgc.png'] }),
  createProduct({ id: 6, name: 'BENZYLUX LILAC JERSEY', price: 25000, category: 'women', color: 'Lilac', stockQuantity: 14, images: ['OFF BACK/Benzy_Luxury_Jersey_Lilac_FRONT_with_bgc.png', 'OFF BACK/Benzy_Luxury_Jersey_Lilac_BACK_with_bgc (2).png'] }),
  createProduct({ id: 7, name: 'BENZYLUX PINK JERSEY', price: 25000, category: 'women', color: 'Pink', stockQuantity: 14, images: ['OFF BACK/Benzy_Luxury_Jersey_Pink_BACK_with_bgc.png', 'OFF BACK/Benzy_Luxury_Jersey_Pink_FRONT_with_bgc.png'] }),
  createProduct({ id: 8, name: 'BENZYLUX IN-PINK JERSEY', price: 25000, category: 'women', color: 'Pink Inverted', stockQuantity: 12, images: ['OFF BACK/Benzy_Luxury_Jersey_Pink_Inverted_FRONT_with_bgc.png', 'OFF BACK/Benzy_Luxury_Jersey_Pink_Inverted_BACK_with_bgc.png'] }),
  createProduct({ id: 9, name: 'BENZYLUX GREEN JERSEY', price: 25000, category: 'men', color: 'Green', stockQuantity: 16, images: ['OFF BACK/Benzy Luxury Jersey Green front.png', 'OFF BACK/Benzy Luxury Jersey Green Back.png'] }),
  createProduct({ id: 10, name: 'BENZYLUX IN-GREEN JERSEY', price: 25000, category: 'men', color: 'Green Inverted', stockQuantity: 12, images: ['OFF BACK/Benzy Luxury Jersey Inv Green front.png', 'OFF BACK/Benzy Luxury Jersey Inv Green Back.png'] }),
  createProduct({ id: 11, name: 'BENZYLUX(BLX) WHITE BASIC TOP', price: 10000, category: 'women', color: 'White', stockQuantity: 20, images: ['OFF BACK/Benzy Luxury Basic Top main.png'] }),
  createProduct({ id: 12, name: 'BENZYLUX(BLX) BLACK BASIC TOP', price: 10000, category: 'women', color: 'Black', stockQuantity: 20, images: ['OFF BACK/Benzy Luxury Basic Top Black.png'] }),
  createProduct({ id: 13, name: 'BENZYLUX(BLX) BASIC TOPS', price: 10000, category: 'women', color: 'Mixed', stockQuantity: 18, images: ['OFF BACK/Benzy Luxury Basic Tops.png'] }),
  createProduct({ id: 14, name: 'BENZYLUX METROPOLITAN SOCKS', price: 4000, category: 'accessories', color: 'Multi', stockQuantity: 24, images: ['OFF BACK/WhatsApp Image 2025-11-11 at 08.50.33_976d3882.png'] }),
  createProduct({ id: 15, name: 'BENZYLUX(BLX) TRACK', price: 60000, category: 'men', color: 'Black', stockQuantity: 10, images: ['OFF BACK/WhatsApp Image 2025-11-11 at 08.42.31_83a04cd4.png', 'OFF BACK/WhatsApp Image 2025-11-11 at 08.42.28_f079be7b.png'] }),
  createProduct({ id: 16, name: 'BENZYLUX CAMO TRUNKERS', price: 10000, category: 'accessories', color: 'Camo', stockQuantity: 18, images: ['OFF BACK/WhatsApp Image 2025-11-11 at 08.53.09_a611d1ed.png'] }),
  createProduct({ id: 17, name: 'BENZYLUX BEANIE', price: 15000, category: 'accessories', color: 'Black', stockQuantity: 18, images: ['OFF BACK/WhatsApp Image 2025-11-11 at 08.53.08_11fe630f.png', 'OFF BACK/WhatsApp Image 2025-11-11 at 08.53.08_4333b0d7.png'] }),
  createProduct({ id: 18, name: 'BENZYLUX JACKET', price: 20000, category: 'men', color: 'Black', stockQuantity: 12, images: ['OFF BACK/WhatsApp Image 2025-11-11 at 08.53.09_1aedccce.png'] })
];
