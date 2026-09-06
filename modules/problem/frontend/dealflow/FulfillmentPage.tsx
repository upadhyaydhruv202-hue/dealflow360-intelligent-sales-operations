import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { Breadcrumb, DataTable, ErrorState, LoadingState, PageContainer } from '@/ui';

import { DealflowGate, StatusBadge } from './components';
import { formatMoney } from './format';
import { useCatalog, useQuotes } from './hooks';
import { availableProductUnits } from './intelligence';
import type { Product, QuoteView } from './types';

const ACTIVE_FULFILLMENT: QuoteView['status'][] = ['approved', 'confirmed', 'fulfillment'];

interface StockOverviewRow {
  id: string;
  product: Product;
  onHand: number;
  reserved: number;
  incoming: number;
  available: number;
  pending: number;
}

export function FulfillmentPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const quotes = useQuotes(accessToken);
  const catalog = useCatalog(accessToken);
  const rows = useMemo(
    () =>
      (quotes.data ?? []).filter(
        (item) =>
          item.fulfillment.allocations.length > 0 ||
          item.fulfillment.backorderQuantity > 0 ||
          ACTIVE_FULFILLMENT.includes(item.status),
      ),
    [quotes.data],
  );
  const stockRows = useMemo<StockOverviewRow[]>(() => {
    const products = catalog.data?.products ?? [];
    const stock = catalog.data?.stock ?? [];
    return products
      .filter((product) => product.billingType === 'one_time' || stock.some((row) => row.productId === product.id))
      .map((product) => {
        const levels = stock.filter((row) => row.productId === product.id);
        const pending = (quotes.data ?? [])
          .filter((quote) => ACTIVE_FULFILLMENT.includes(quote.status))
          .flatMap((quote) => quote.lines)
          .filter((line) => line.productId === product.id)
          .reduce((sum, line) => sum + line.quantity, 0);
        return {
          id: product.id,
          product,
          onHand: levels.reduce((sum, row) => sum + row.quantityOnHand, 0),
          reserved: levels.reduce((sum, row) => sum + row.reserved, 0),
          incoming: levels.reduce((sum, row) => sum + (row.incoming ?? 0), 0),
          available: availableProductUnits(stock, product.id),
          pending,
        };
      });
  }, [catalog.data, quotes.data]);

  return (
    <DealflowGate permission="dealflow.quotes.read">
      <PageContainer
        width="wide"
        breadcrumb={<Breadcrumb items={[{ label: 'Dashboard', to: '/dealflow' }, { label: 'Fulfillment' }]} />}
        title="Fulfillment"
        description="Stock versus pending fulfillment from the live catalog, then warehouse splits from the planner."
      >
        {quotes.loading || catalog.loading ? <LoadingState label="Loading fulfillment…" /> : null}
        {quotes.error ? <ErrorState message={quotes.error} onRetry={() => void quotes.reload()} /> : null}
        {catalog.error ? <ErrorState message={catalog.error} onRetry={() => void catalog.reload()} /> : null}
        {!quotes.loading && !quotes.error && !catalog.loading && !catalog.error ? (
          <div className="space-y-8">
            <DataTable<StockOverviewRow>
              caption="Fulfillment overview"
              rowId={(row) => row.id}
              rows={stockRows}
              onRowClick={(row) => navigate(`/dealflow/catalog/products/${row.product.id}`)}
              emptyTitle="No stocked products"
              emptyDescription="Products with warehouse stock appear here with on-hand, reserved, and incoming quantities."
              columns={[
                { id: 'sku', header: 'SKU', accessor: (row) => row.product.sku },
                { id: 'name', header: 'Product', accessor: (row) => row.product.name },
                { id: 'onhand', header: 'On hand', accessor: (row) => String(row.onHand) },
                { id: 'reserved', header: 'Reserved', accessor: (row) => String(row.reserved) },
                { id: 'incoming', header: 'Incoming', accessor: (row) => String(row.incoming) },
                { id: 'available', header: 'Available', accessor: (row) => String(row.available) },
                { id: 'pending', header: 'Pending fulfill', accessor: (row) => String(row.pending) },
              ]}
            />
            <DataTable<QuoteView>
              caption="Fulfillment history"
              rowId={(row) => row.id}
              rows={rows}
              onRowClick={(row) => navigate(`/dealflow/fulfillment/${row.id}`)}
              emptyTitle="No fulfillment work"
              emptyDescription="Approve a quote, then accept the suggested warehouse split."
              columns={[
                { id: 'number', header: 'Quote', accessor: (row) => row.number },
                { id: 'customer', header: 'Customer', accessor: (row) => row.customer?.name ?? '—' },
                { id: 'status', header: 'Status', accessor: (row) => <StatusBadge status={row.status} /> },
                {
                  id: 'split',
                  header: 'Split',
                  accessor: (row) =>
                    row.fulfillment.allocations.length
                      ? `${row.fulfillment.allocations.filter((item) => !item.isBackorder).length} warehouse allocation(s)`
                      : 'Not planned',
                },
                { id: 'shipments', header: 'Shipments', accessor: (row) => String(row.fulfillment.shipmentCount) },
                { id: 'backorder', header: 'Backorder', accessor: (row) => String(row.fulfillment.backorderQuantity) },
                { id: 'cost', header: 'Fulfillment cost', accessor: (row) => formatMoney(row.fulfillment.fulfillmentCost, true) },
              ]}
            />
          </div>
        ) : null}
      </PageContainer>
    </DealflowGate>
  );
}
