import type {
  ApprovalChain,
  Customer,
  DiscountPolicy,
  Product,
  ProductRelation,
  StockLevel,
  Warehouse,
} from './types';

export const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Northwind Retail',
    email: 'procurement@northwind.example',
    tier: 'standard',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Globex Manufacturing',
    email: 'buying@globex.example',
    tier: 'gold',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Initech Strategic',
    email: 'deals@initech.example',
    tier: 'strategic',
  },
];

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    sku: 'HW-CORE-1',
    name: 'Core Gateway',
    category: 'hardware',
    listPrice: 4000,
    cost: 2200,
    billingType: 'one_time',
  },
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    sku: 'HW-EDGE-2',
    name: 'Edge Sensor Pack',
    category: 'hardware',
    listPrice: 1500,
    cost: 800,
    billingType: 'one_time',
  },
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    sku: 'SW-CTRL-1',
    name: 'Control Suite',
    category: 'software',
    listPrice: 2400,
    cost: 400,
    billingType: 'recurring',
    billingFrequency: 'monthly',
  },
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    sku: 'SW-ANALYTICS',
    name: 'Analytics Add-on',
    category: 'software',
    listPrice: 900,
    cost: 150,
    billingType: 'recurring',
    billingFrequency: 'monthly',
  },
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
    sku: 'SVC-PREMIUM',
    name: 'Premium Success Plan',
    category: 'services',
    listPrice: 600,
    cost: 120,
    billingType: 'recurring',
    billingFrequency: 'yearly',
  },
];

export const DEFAULT_WAREHOUSES: Warehouse[] = [
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    name: 'West DC',
    fulfillmentCostPerUnit: 18,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    name: 'East DC',
    fulfillmentCostPerUnit: 25,
  },
];

export const DEFAULT_STOCK: StockLevel[] = [
  { warehouseId: DEFAULT_WAREHOUSES[0].id, productId: DEFAULT_PRODUCTS[0].id, quantityOnHand: 4, reserved: 0 },
  { warehouseId: DEFAULT_WAREHOUSES[1].id, productId: DEFAULT_PRODUCTS[0].id, quantityOnHand: 3, reserved: 0 },
  { warehouseId: DEFAULT_WAREHOUSES[0].id, productId: DEFAULT_PRODUCTS[1].id, quantityOnHand: 10, reserved: 0 },
  { warehouseId: DEFAULT_WAREHOUSES[1].id, productId: DEFAULT_PRODUCTS[1].id, quantityOnHand: 2, reserved: 0 },
  { warehouseId: DEFAULT_WAREHOUSES[0].id, productId: DEFAULT_PRODUCTS[2].id, quantityOnHand: 50, reserved: 0 },
  { warehouseId: DEFAULT_WAREHOUSES[1].id, productId: DEFAULT_PRODUCTS[2].id, quantityOnHand: 50, reserved: 0 },
  { warehouseId: DEFAULT_WAREHOUSES[0].id, productId: DEFAULT_PRODUCTS[3].id, quantityOnHand: 50, reserved: 0 },
  { warehouseId: DEFAULT_WAREHOUSES[1].id, productId: DEFAULT_PRODUCTS[3].id, quantityOnHand: 50, reserved: 0 },
  { warehouseId: DEFAULT_WAREHOUSES[0].id, productId: DEFAULT_PRODUCTS[4].id, quantityOnHand: 20, reserved: 0 },
  { warehouseId: DEFAULT_WAREHOUSES[1].id, productId: DEFAULT_PRODUCTS[4].id, quantityOnHand: 20, reserved: 0 },
];

export const DEFAULT_POLICIES: DiscountPolicy[] = [
  {
    id: 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1',
    name: 'Strategic customer',
    customerTier: 'strategic',
    warningPercent: 12,
    approvalPercent: 20,
    rejectPercent: 40,
    maxMarginImpactPercent: 70,
    priority: 10,
  },
  {
    id: 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc2',
    name: 'Gold customer',
    customerTier: 'gold',
    warningPercent: 8,
    approvalPercent: 12,
    rejectPercent: 30,
    maxMarginImpactPercent: 55,
    priority: 20,
  },
  {
    id: 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc3',
    name: 'Software category',
    productCategory: 'software',
    warningPercent: 8,
    approvalPercent: 15,
    rejectPercent: 35,
    maxMarginImpactPercent: 80,
    priority: 30,
  },
  {
    id: 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc4',
    name: 'Default ceiling',
    warningPercent: 3,
    approvalPercent: 5,
    rejectPercent: 25,
    maxMarginImpactPercent: 40,
    priority: 100,
  },
];

export const DEFAULT_CHAINS: ApprovalChain[] = [
  {
    id: 'ddddddd1-dddd-4ddd-8ddd-ddddddddddd1',
    name: 'Sales Manager',
    minRiskScore: 0,
    minBlendedDiscountPercent: 5,
    priority: 30,
    steps: [{ id: 'ddddddd2-dddd-4ddd-8ddd-ddddddddddd1', chainId: 'ddddddd1-dddd-4ddd-8ddd-ddddddddddd1', stepOrder: 1, roleKey: 'manager', label: 'Sales Manager' }],
  },
  {
    id: 'ddddddd1-dddd-4ddd-8ddd-ddddddddddd2',
    name: 'Sales Manager → Finance',
    minRiskScore: 40,
    minBlendedDiscountPercent: 12,
    priority: 20,
    steps: [
      { id: 'ddddddd2-dddd-4ddd-8ddd-ddddddddddd2', chainId: 'ddddddd1-dddd-4ddd-8ddd-ddddddddddd2', stepOrder: 1, roleKey: 'manager', label: 'Sales Manager' },
      { id: 'ddddddd2-dddd-4ddd-8ddd-ddddddddddd3', chainId: 'ddddddd1-dddd-4ddd-8ddd-ddddddddddd2', stepOrder: 2, roleKey: 'finance', label: 'Finance' },
    ],
  },
  {
    id: 'ddddddd1-dddd-4ddd-8ddd-ddddddddddd3',
    name: 'Sales Manager → Finance → Final',
    minRiskScore: 70,
    minBlendedDiscountPercent: 20,
    priority: 10,
    steps: [
      { id: 'ddddddd2-dddd-4ddd-8ddd-ddddddddddd4', chainId: 'ddddddd1-dddd-4ddd-8ddd-ddddddddddd3', stepOrder: 1, roleKey: 'manager', label: 'Sales Manager' },
      { id: 'ddddddd2-dddd-4ddd-8ddd-ddddddddddd5', chainId: 'ddddddd1-dddd-4ddd-8ddd-ddddddddddd3', stepOrder: 2, roleKey: 'finance', label: 'Finance' },
      { id: 'ddddddd2-dddd-4ddd-8ddd-ddddddddddd6', chainId: 'ddddddd1-dddd-4ddd-8ddd-ddddddddddd3', stepOrder: 3, roleKey: 'final', label: 'Final approval' },
    ],
  },
];

export const DEFAULT_RELATIONS: ProductRelation[] = [
  {
    id: 'eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1',
    productId: DEFAULT_PRODUCTS[0].id,
    recommendedProductId: DEFAULT_PRODUCTS[1].id,
    kind: 'cross_sell',
    reason: 'Edge sensors complete gateway deployments',
    promotion: 'Bundle 5% after add',
    minQuantity: 1,
  },
  {
    id: 'eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee2',
    productId: DEFAULT_PRODUCTS[2].id,
    recommendedProductId: DEFAULT_PRODUCTS[3].id,
    kind: 'upsell',
    reason: 'Analytics increases recurring software attach',
    minQuantity: 1,
  },
];
