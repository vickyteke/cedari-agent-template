import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogProducts, listingProducts, majorAmount, productId, productIdentity, type CedariListing } from '../src/lib/cedari.ts';
import { emptyState, groupBag, merchantName, mergeState, parseState } from '../src/lib/model.ts';

const listing = (): CedariListing => ({
  id: 'lst_curtain', title: 'Linen curtains', description: 'A pair of panels.', category: 'Curtains',
  merchant: { id: 'mrc_new_shop', name: 'New independent shop' },
  image_url: 'https://shop.example/black.jpg', product_url: 'https://shop.example/products/curtains', variant_count: 12,
  variants: [
    { id: 'var_black', name: 'Black', options: { Color: 'Black' }, image_url: 'https://shop.example/black.jpg', price: { amount_minor: 4516, currency: 'USD' }, available: true, inventory: { status: 'in_stock', quantity: 10 } },
    { id: 'var_beige', name: 'Beige', options: { Color: 'Beige' }, image_url: null, price: { amount_minor: 5016, currency: 'USD' }, available: false, inventory: { status: 'out_of_stock', quantity: 0 } },
  ],
});

test('search previews map exact variants, minor prices and dynamic merchants', () => {
  const products = catalogProducts({ listings: [listing()] });
  assert.equal(products.length, 2);
  assert.equal(products[0].price, 45.16);
  assert.equal(products[0].listing_id, 'lst_curtain');
  assert.equal(products[0].variant_id, 'var_black');
  assert.equal(products[0].variant_count, 12);
  assert.deepEqual(products[0].variant_options, { Color: 'Black' });
  assert.equal(merchantName(products[0]), 'New independent shop');
  assert.equal(products[0].store_key, 'mrc_new_shop');
  assert.notEqual(products[0].id, products[1].id);
});

test('detail wrappers and legacy mobile responses both remain readable', () => {
  const products = listingProducts(listing());
  assert.deepEqual(catalogProducts({ listing: listing() }), products);
  assert.strictEqual(catalogProducts({ products }), products);
  assert.throws(() => catalogProducts({}), /unexpected response/);
});

test('detail and comparison select exact requested variants from full listings', () => {
  const selectedId = productId('lst_curtain', 'var_beige');
  const products = catalogProducts({ listing: listing() }, [selectedId]);
  assert.equal(products.length, 1);
  assert.equal(products[0].variant_id, 'var_beige');
  assert.deepEqual(catalogProducts({ listing: listing() }, ['missing']), []);
});

test('a missing variant image never falls back to a different color', () => {
  const data = listing();
  assert.equal(listingProducts(data)[1].image_url, null);
  delete data.variants[1].image_url;
  assert.equal(listingProducts(data)[1].image_url, null);
  data.variants[0].image_url = 'javascript:alert(1)';
  data.variants[0].product_url = 'https://user:password@shop.example/curtains';
  assert.equal(listingProducts(data)[0].image_url, null);
  assert.equal(listingProducts(data)[0].product_url, data.product_url);
});

test('a missing variant link never inherits a different variant selection', () => {
  const data = listing();
  data.product_url = 'https://shop.example/products/curtains?variant=black';
  assert.equal(listingProducts(data)[1].product_url, null);
  data.variants[1].product_url = 'https://shop.example/products/curtains?variant=beige';
  assert.equal(listingProducts(data)[1].product_url, data.variants[1].product_url);
});

test('availability respects explicit unavailability, inventory and zero quantities', () => {
  const data = listing();
  assert.deepEqual(listingProducts(data).map(product => product.available), [true, false]);
  data.variants[0].inventory.quantity = 0;
  assert.equal(listingProducts(data)[0].available, false);
  data.variants[0].inventory = { status: 'low_stock', quantity: null, precision: 'availability' };
  assert.equal(listingProducts(data)[0].available, true);
  data.variants[0].available = false;
  assert.equal(listingProducts(data)[0].available, false);
});

test('money uses each currency exponent and rejects invalid amounts', () => {
  assert.equal(majorAmount({ amount_minor: 1234, currency: 'JPY' }), 1234);
  assert.equal(majorAmount({ amount_minor: 1234, currency: 'KWD' }), 1.234);
  assert.equal(majorAmount({ amount_minor: 0, currency: 'USD' }), 0);
  for (const amount_minor of [-1, 12.3, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => majorAmount({ amount_minor, currency: 'USD' }), /Invalid product price/);
  }
});

test('product IDs preserve the listing/variant pair without delimiter collisions', () => {
  const id = productId('listing:a/b', 'variant:c,d%');
  assert.deepEqual(productIdentity(id), { listing_id: 'listing:a/b', variant_id: 'variant:c,d%' });
  assert.notEqual(productId('a:b', 'c'), productId('a', 'b:c'));
  for (const invalid of ['legacy-shopify-id', 'cedari::variant', 'cedari:listing:variant:extra', 'cedari:%:variant']) {
    assert.throws(() => productIdentity(invalid));
  }
});

test('saved Cedari selections survive state sync and group by actual merchant ID', () => {
  const state = emptyState();
  for (const product of listingProducts(listing())) state.bag[product.id] = { product, quantity: 1, updatedAt: 1 };
  const restored = mergeState(emptyState(), parseState(JSON.parse(JSON.stringify(state))));
  const groups = groupBag(restored);
  assert.equal(Object.keys(groups).length, 1);
  assert.equal(groups.mrc_new_shop.length, 2);
  assert.equal(groups.mrc_new_shop[1].product.variant_id, 'var_beige');
});
