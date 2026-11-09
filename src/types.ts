export interface Product {
  id: string;
  name: string;
  stock: number;
  price: number;
}

export interface OrderRequest {
  orderId: string;         // idempotency key
  productId: string;
  userId: string;
  quantity: number;
}

export interface ReserveResult {
  orderId: string;
  productId: string;
  userId: string;
  quantity: number;
  leaseKey: string;
  leaseAcquiredAt: number;
}

export interface ValidateResult extends ReserveResult {
  product: Product;
}

export interface ConfirmResult {
  orderId: string;
  productId: string;
  userId: string;
  confirmedAt: number;
  newStock: number;
}

export type OrderOutcome =
  | { status: 'confirmed'; orderId: string; userId: string; newStock: number }
  | { status: 'rejected'; orderId: string; userId: string; reason: string };
