/**
 * Simulation: 50 users try to buy the last 1 unit simultaneously.
 * Expected: exactly 1 success, 49 rejections.
 */
import { InMemoryLeaseStore } from './lease.js';
import { productStore } from './store.js';
import { createInventoryPipeline } from './pipeline.js';
import type { OrderRequest, OrderOutcome } from './types.js';

async function runSimulation(): Promise<void> {
  const CONCURRENT_USERS = 50;
  const PRODUCT_ID = 'tshirt-black-m';
  const INITIAL_STOCK = 1;

  // Setup
  productStore.seed([
    { id: PRODUCT_ID, name: 'Black T-Shirt (M)', stock: INITIAL_STOCK, price: 999 },
  ]);

  const leaseStore = new InMemoryLeaseStore();
  const outcomes: OrderOutcome[] = [];

  const pipeline = createInventoryPipeline(leaseStore, productStore, (outcome) => {
    outcomes.push(outcome);
  });

  console.log(`\n🚀 Simulation: ${CONCURRENT_USERS} users racing for 1 item\n`);

  // Fire all requests simultaneously
  const requests: OrderRequest[] = Array.from({ length: CONCURRENT_USERS }, (_, i) => ({
    orderId: `order-${i + 1}`,
    productId: PRODUCT_ID,
    userId: `user-${i + 1}`,
    quantity: 1,
  }));

  const results = await Promise.allSettled(requests.map((req) => pipeline.run(req)));

  const successful = results.filter((r) => r.status === 'fulfilled' && r.value.status === 'success');
  const failed = results.filter((r) => r.status === 'fulfilled' && r.value.status === 'failed');

  console.log('📊 Results:');
  console.log(`  ✅ Confirmed orders: ${successful.length} (expected: 1)`);
  console.log(`  ❌ Rejected orders:  ${failed.length} (expected: ${CONCURRENT_USERS - 1})`);

  if (successful.length === 1 && failed.length === CONCURRENT_USERS - 1) {
    console.log('\n✅ PASS: Exactly one order confirmed. Zero oversell.\n');
  } else {
    console.log('\n❌ FAIL: Oversell detected!\n');
    process.exit(1);
  }
}

runSimulation().catch(console.error);
