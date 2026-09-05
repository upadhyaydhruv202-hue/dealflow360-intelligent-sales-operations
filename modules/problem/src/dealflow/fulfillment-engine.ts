import { conflict, invalid } from './errors';
import type { Backorder, FulfillmentPlan, FulfillmentSplit, Product, QuoteLine, StockLevel, Warehouse } from './types';

function available(stock: StockLevel | undefined): number {
  if (!stock) {
    return 0;
  }
  return Math.max(0, stock.quantityOnHand - stock.reserved);
}

export function planFulfillment(input: {
  quoteId: string;
  lines: QuoteLine[];
  products: Product[];
  warehouses: Warehouse[];
  stock: StockLevel[];
  overrides?: Array<{ quoteLineId: string; warehouseId: string; quantity: number }>;
}): FulfillmentPlan {
  const allocations: FulfillmentSplit[] = [];
  const remainingByProduct = new Map<string, number>();
  const remainingByLine = new Map<string, number>();

  const stockLeft = input.stock.map((row) => ({ ...row }));

  const consume = (warehouseId: string, productId: string, quantity: number) => {
    const row = stockLeft.find((item) => item.warehouseId === warehouseId && item.productId === productId);
    if (!row || available(row) < quantity) {
      throw conflict('Insufficient available stock for the requested warehouse allocation', {
        warehouseId,
        productId,
        requested: quantity,
        available: available(row),
      });
    }
    row.reserved += quantity;
  };

  for (const override of input.overrides ?? []) {
    const line = input.lines.find((item) => item.id === override.quoteLineId);
    if (!line) {
      throw invalid('Override references an unknown quote line', { quoteLineId: override.quoteLineId });
    }
    if (override.quantity <= 0) {
      throw invalid('Override quantity must be positive');
    }
    const warehouse = input.warehouses.find((item) => item.id === override.warehouseId);
    if (!warehouse) {
      throw invalid('Override references an unknown warehouse', { warehouseId: override.warehouseId });
    }
    const already = remainingByLine.get(line.id) ?? line.quantity;
    if (override.quantity > already) {
      throw invalid('Override quantity exceeds remaining line quantity', {
        quoteLineId: line.id,
        remaining: already,
      });
    }
    consume(warehouse.id, line.productId, override.quantity);
    allocations.push({
      id: crypto.randomUUID(),
      quoteId: input.quoteId,
      quoteLineId: line.id,
      warehouseId: warehouse.id,
      quantity: override.quantity,
      unitFulfillmentCost: warehouse.fulfillmentCostPerUnit,
      isBackorder: false,
      isManualOverride: true,
    });
    remainingByLine.set(line.id, already - override.quantity);
  }

  const rankedWarehouses = [...input.warehouses].sort((left, right) => {
    if (left.fulfillmentCostPerUnit !== right.fulfillmentCostPerUnit) {
      return left.fulfillmentCostPerUnit - right.fulfillmentCostPerUnit;
    }
    return left.name.localeCompare(right.name);
  });

  for (const line of input.lines) {
    let remaining = remainingByLine.get(line.id) ?? line.quantity;
    const byAvailability = [...rankedWarehouses].sort((left, right) => {
      const leftAvail = available(
        stockLeft.find((row) => row.warehouseId === left.id && row.productId === line.productId),
      );
      const rightAvail = available(
        stockLeft.find((row) => row.warehouseId === right.id && row.productId === line.productId),
      );
      if (leftAvail !== rightAvail) {
        return rightAvail - leftAvail;
      }
      return left.fulfillmentCostPerUnit - right.fulfillmentCostPerUnit;
    });

    for (const warehouse of byAvailability) {
      if (remaining <= 0) {
        break;
      }
      const row = stockLeft.find((item) => item.warehouseId === warehouse.id && item.productId === line.productId);
      const take = Math.min(remaining, available(row));
      if (take <= 0) {
        continue;
      }
      row!.reserved += take;
      allocations.push({
        id: crypto.randomUUID(),
        quoteId: input.quoteId,
        quoteLineId: line.id,
        warehouseId: warehouse.id,
        quantity: take,
        unitFulfillmentCost: warehouse.fulfillmentCostPerUnit,
        isBackorder: false,
        isManualOverride: false,
      });
      remaining -= take;
    }

    remainingByLine.set(line.id, remaining);
    remainingByProduct.set(line.productId, (remainingByProduct.get(line.productId) ?? 0) + remaining);
  }

  const backorders: Backorder[] = [...remainingByProduct.entries()]
    .filter(([, quantity]) => quantity > 0)
    .map(([productId, quantity]) => ({
      id: crypto.randomUUID(),
      quoteId: input.quoteId,
      productId,
      quantity,
    }));

  const shipped = allocations.filter((item) => !item.isBackorder);
  const warehouseIds = new Set(shipped.map((item) => item.warehouseId));

  return {
    allocations,
    backorders,
    shipmentCount: warehouseIds.size,
    fulfillmentCost: shipped.reduce((sum, item) => sum + item.quantity * item.unitFulfillmentCost, 0),
    backorderQuantity: backorders.reduce((sum, item) => sum + item.quantity, 0),
  };
}

export function reserveStock(input: {
  stock: StockLevel[];
  productByLineId: Record<string, string>;
  previous: FulfillmentSplit[];
  next: FulfillmentSplit[];
}): StockLevel[] {
  const copy = input.stock.map((row) => ({ ...row }));
  const mutate = (split: FulfillmentSplit, deltaReserved: number) => {
    if (split.isBackorder) {
      return;
    }
    const productId = input.productByLineId[split.quoteLineId];
    const row = copy.find((item) => item.warehouseId === split.warehouseId && item.productId === productId);
    if (!row) {
      throw conflict('Stock row missing for reservation', {
        warehouseId: split.warehouseId,
        productId,
      });
    }
    row.reserved = Math.max(0, row.reserved + deltaReserved);
  };

  for (const split of input.previous) {
    mutate(split, -split.quantity);
  }
  for (const split of input.next) {
    mutate(split, split.quantity);
    const productId = input.productByLineId[split.quoteLineId];
    const row = copy.find((item) => item.warehouseId === split.warehouseId && item.productId === productId);
    if (row && row.reserved > row.quantityOnHand + 1e-9) {
      throw conflict('Reservation exceeds on-hand quantity', {
        warehouseId: split.warehouseId,
        productId,
        reserved: row.reserved,
        onHand: row.quantityOnHand,
      });
    }
  }
  return copy;
}

export function consumeStockOnConfirm(input: {
  stock: StockLevel[];
  productByLineId: Record<string, string>;
  allocations: FulfillmentSplit[];
}): StockLevel[] {
  const copy = input.stock.map((row) => ({ ...row }));
  for (const split of input.allocations) {
    if (split.isBackorder) {
      continue;
    }
    const productId = input.productByLineId[split.quoteLineId];
    const row = copy.find((item) => item.warehouseId === split.warehouseId && item.productId === productId);
    if (!row) {
      throw conflict('Stock row missing at confirmation', { warehouseId: split.warehouseId, productId });
    }
    row.quantityOnHand = Math.max(0, row.quantityOnHand - split.quantity);
    row.reserved = Math.max(0, row.reserved - split.quantity);
  }
  return copy;
}
