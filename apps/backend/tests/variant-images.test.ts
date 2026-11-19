import { describe, expect, it } from 'vitest';
import { variantImage, type ShopifyProductNode } from '@/lib/shopify';
import { requestedColors, variantColorFilter } from '@/lib/variant-colors';
const beige = {id:'gid://shopify/ProductVariant/1',title:'Beige / 150 x 250',price:'90',availableForSale:true,media:{nodes:[{image:{url:'https://cdn.shopify.com/beige.jpg'}}]}};
const green = {...beige,id:'gid://shopify/ProductVariant/2',title:'Deep Green / 150 x 250',media:{nodes:[{image:{url:'https://cdn.shopify.com/green.jpg'}}]}};
const product: ShopifyProductNode={id:'gid://shopify/Product/3',handle:'curtain',title:'Curtain',description:'Available in beige and deep green',vendor:'Store',productType:'Curtains',tags:[],featuredImage:{url:'https://cdn.shopify.com/green-hero.jpg'},variants:{nodes:[beige,green]}};
describe('variant identity and image fidelity',()=>{
 it('uses the beige variant image even when the product hero is deep green',()=>{expect(variantImage(product,beige)).toBe('https://cdn.shopify.com/beige.jpg');expect(variantImage(product,green)).toBe('https://cdn.shopify.com/green.jpg');});
 it('does not pretend a product hero is an unpictured named variant',()=>{expect(variantImage(product,{...beige,media:{nodes:[]}})).toBeNull();});
 it('can use the hero for a single-variant product',()=>{expect(variantImage({...product,variants:{nodes:[beige]}},{...beige,media:{nodes:[]}})).toBe(product.featuredImage!.url);});
 it('constrains color by the actual variant, not colors mentioned in the shared description',()=>{expect(variantColorFilter('beige curtain')).toBe('variant_title.ilike.%beige%,and(variant_title.eq.Default Title,title.ilike.%beige%)');expect(requestedColors('beige curtain -green')).toEqual(['beige']);});
});
