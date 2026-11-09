# E1 — Inventory Oversell: Architecture

## Problem

During a flash sale, 1000 users click "Buy Now" for the last item simultaneously.
Without proper synchronization, all 1000 orders succeed, shipping 1000 items from
a stock of 1. This is called **oversell**.

## Why Naive Solutions Fail

### ❌ Read-then-Write (Race Condition)
```
User A: SELECT stock WHERE id='X' → 1 (available!)
User B: SELECT stock WHERE id='X' → 1 (available!)
User A: UPDATE stock SET stock=0    ← writes 0
User B: UPDATE stock SET stock=0    ← writes 0 (doesn't know A wrote first)
Result: 2 orders, 0 actual stock. OVERSELL.
```

### ❌ Database Lock (Lock Convoy Problem)
Under 50,000 concurrent users, all waiting on the same row lock causes a **lock convoy**:
- Every request blocks on `SELECT ... FOR UPDATE`
- Database thread pool exhausts
- Checkout service crashes for EVERYONE

## ✅ Our Solution: Redis Lease + Pipeline

```
Request → [Reserve: Redis SETNX] → [Validate: Read stock] → [Confirm: Decrement] → [Notify: WebSocket]
              ↓ FAIL (key exists)
         Immediate rejection (no DB hit)
```

### Stage 1: Reserve (Redis SETNX Lease)
`SET inventory:lease:PRODUCT_ID order-123 NX PX 10000`
- `NX` = only set if NOT exists (atomic)
- `PX 10000` = expire in 10 seconds (safety net)
- If `OK` → we have the lease, proceed
- If `nil` → another order is processing, reject immediately

### Stage 2: Validate (Stock Check)
Now we're the ONLY writer. Read stock safely:
- If stock ≥ quantity → proceed
- If stock < quantity → throw, trigger rollback (release lease)

### Stage 3: Confirm (Atomic Decrement)
Decrement stock, release lease. Done.

### Stage 4: Notify (WebSocket Broadcast)
Send confirmed/rejected outcome to the buyer's browser.

## Rollback Flow (Saga Compensation)
If any stage fails:
1. Stage 3 fails → Stage 2 had no side effects → Stage 1 rollback releases lease
2. Stage 2 fails → Stage 1 rollback releases lease
3. Next request can now acquire the lease

## Load Characteristics
| Metric | Naive DB Lock | Redis Lease |
|--------|--------------|-------------|
| DB queries per 1000 requests | 1000 | 1 |
| Lock wait time | O(n) | 0 |
| Crash threshold | ~5000 rps | >100,000 rps |
| Oversell possible | Yes | No |
