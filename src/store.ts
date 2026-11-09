import { type Product } from './types.js';

/** In-memory product store — replace with real Postgres in production */
export class ProductStore {
  private products = new Map<string, Product>();

  seed(products: Product[]): void {
    for (const p of products) {
      this.products.set(p.id, { ...p });
    }
  }

  get(id: string): Product | undefined {
    return this.products.get(id);
  }

  /** Atomic stock decrement. Returns new stock or throws if insufficient. */
  decrementStock(id: string, qty: number): number {
    const product = this.products.get(id);
    if (!product) throw new Error(`Product ${id} not found`);
    if (product.stock < qty) {
      throw new Error(`Insufficient stock: ${product.stock} available, ${qty} requested`);
    }
    product.stock -= qty;
    return product.stock;
  }
}

export const productStore = new ProductStore();
