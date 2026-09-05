import type { Product, ProductRelation, QuoteLine, Recommendation } from './types';

export function recommendProducts(input: {
  lines: QuoteLine[];
  products: Product[];
  relations: ProductRelation[];
}): Recommendation[] {
  const quantityByProduct = new Map<string, number>();
  for (const line of input.lines) {
    quantityByProduct.set(line.productId, (quantityByProduct.get(line.productId) ?? 0) + line.quantity);
  }
  const present = new Set(quantityByProduct.keys());
  const results: Recommendation[] = [];

  for (const relation of input.relations) {
    const qty = quantityByProduct.get(relation.productId) ?? 0;
    if (qty < relation.minQuantity) {
      continue;
    }
    if (present.has(relation.recommendedProductId)) {
      continue;
    }
    const product = input.products.find((item) => item.id === relation.recommendedProductId);
    if (!product) {
      continue;
    }
    const priceImpact = product.listPrice;
    const marginImpact = product.listPrice - product.cost;
    results.push({
      relationId: relation.id,
      kind: relation.kind,
      product,
      reason: relation.reason,
      promotion: relation.promotion,
      priceImpact,
      marginImpact,
    });
  }

  return results;
}
