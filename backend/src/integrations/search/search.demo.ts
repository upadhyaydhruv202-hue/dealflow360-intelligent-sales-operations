import { SEARCH } from '../../constants';
import type { SearchDocumentInput } from './search.types';

export const DEMO_SEARCH_DOCUMENTS: readonly SearchDocumentInput[] = [
  {
    index: SEARCH.DEMO_INDEX,
    documentId: 'refund-policy',
    title: 'Refund policy for late shipments',
    body: 'Customers may request a refund within 14 days of delivery when a shipment arrives late. Refunds go to the original payment method.',
    fields: { status: 'published', category: 'policy' },
  },
  {
    index: SEARCH.DEMO_INDEX,
    documentId: 'shipping-sla',
    title: 'Shipping SLA',
    body: 'Standard orders ship in three business days. Expedited orders ship the next business day when placed before 14:00.',
    fields: { status: 'published', category: 'ops' },
  },
  {
    index: SEARCH.DEMO_INDEX,
    documentId: 'staff-onboarding',
    title: 'Staff onboarding checklist',
    body: 'New staff complete security training, receive a laptop, and join the operations channel during week one.',
    fields: { status: 'draft', category: 'hr' },
  },
];
