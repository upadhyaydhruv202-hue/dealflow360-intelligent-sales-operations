import {
  DEFAULT_CHAINS,
  DEFAULT_CUSTOMERS,
  DEFAULT_POLICIES,
  DEFAULT_PRODUCTS,
  DEFAULT_QUANTITY_BREAKS,
  DEFAULT_RELATIONS,
  DEFAULT_ROLE_AUTHORITIES,
  DEFAULT_STOCK,
  DEFAULT_WAREHOUSES,
} from './defaults';
import type {
  ApprovalChain,
  Customer,
  DiscountDecision,
  DiscountPolicy,
  Product,
  ProductRelation,
  QuantityBreak,
  QuoteStatus,
  RoleAuthority,
  Warehouse,
} from './types';

/** Stable portal token for the Northwind golden-path quotation. */
export const PRESENTATION_PORTAL_TOKEN = 'df-demo-portal-token-northwind-0001';
export const PRESENTATION_QUOTE_ID = 'ffffffff-ffff-4fff-8fff-fffffffffff1';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(kind: number, n: number): string {
  const head = `${kind.toString(16).padStart(2, '0')}${n.toString(16).padStart(6, '0')}`;
  const tail = n.toString(16).padStart(12, '0');
  return `${head}-0000-4000-8000-${tail}`;
}

const EXTRA_CUSTOMERS: Array<Omit<Customer, 'id'>> = [
  { name: 'Reliance Retail', email: 'procurement@relianceretail.in', tier: 'platinum' },
  { name: 'Tata Steel', email: 'buying@tatasteel.com', tier: 'gold' },
  { name: 'Mahindra Logistics', email: 'sourcing@mahindralogistics.com', tier: 'gold' },
  { name: 'Infosys Limited', email: 'facilities.buy@infosys.com', tier: 'platinum' },
  { name: 'HDFC Bank', email: 'branch.ops@hdfcbank.com', tier: 'strategic' },
  { name: 'Asian Paints', email: 'plant.procurement@asianpaints.com', tier: 'gold' },
  { name: 'Adani Ports', email: 'terminal.buy@adaniports.com', tier: 'strategic' },
  { name: 'Flipkart Internet', email: 'fc.equipment@flipkart.com', tier: 'gold' },
  { name: 'Zomato Hyperpure', email: 'darkstore.ops@zomato.com', tier: 'standard' },
  { name: 'Larsen & Toubro', email: 'projects.buy@larsentoubro.com', tier: 'platinum' },
  { name: 'Godrej Properties', email: 'site.materials@godrejproperties.com', tier: 'standard' },
  { name: 'Titan Company', email: 'retail.tech@titan.co.in', tier: 'gold' },
  { name: 'Maruti Suzuki', email: 'vendor.portal@marutisuzuki.com', tier: 'platinum' },
  { name: 'Bharti Airtel', email: 'network.capex@airtel.com', tier: 'strategic' },
  { name: 'Dr. Reddy\'s Laboratories', email: 'plant.automation@drreddys.com', tier: 'gold' },
  { name: 'Wipro Limited', email: 'workplace.services@wipro.com', tier: 'gold' },
  { name: 'ITC Limited', email: 'factories.buy@itc.in', tier: 'platinum' },
  { name: 'JSW Steel', email: 'mills.procurement@jsw.in', tier: 'gold' },
  { name: 'Paytm Payments', email: 'merchant.ops@paytm.com', tier: 'standard' },
  { name: 'Swiggy Instamart', email: 'darkstores@swiggy.in', tier: 'standard' },
  { name: 'Siemens India', email: 'digital.industries@siemens.com', tier: 'platinum' },
  { name: 'Bosch Limited', email: 'bidadi.buy@bosch.com', tier: 'gold' },
  { name: 'Schneider Electric', email: 'ecostruxture.sales@se.com', tier: 'platinum' },
  { name: 'Unilever India', email: 'factory.systems@unilever.com', tier: 'gold' },
  { name: 'Nestlé India', email: 'moga.plant@in.nestle.com', tier: 'gold' },
  { name: 'Maersk Line', email: 'terminal.iot@maersk.com', tier: 'strategic' },
  { name: 'DP World Mundra', email: 'yard.systems@dpworld.com', tier: 'gold' },
  { name: 'Emirates NBD', email: 'branch.infrastructure@emiratesnbd.com', tier: 'platinum' },
  { name: 'Standard Chartered', email: 'workplace.tech@sc.com', tier: 'gold' },
  { name: 'SATS Singapore', email: 'airside.ops@sats.com.sg', tier: 'standard' },
  { name: 'Changi Airport Group', email: 'airside.systems@changiairport.com', tier: 'strategic' },
  { name: 'Petronas Dagangan', email: 'retail.sites@petronas.com.my', tier: 'gold' },
  { name: 'Siam Cement Group', email: 'plants.automation@scg.com', tier: 'gold' },
  { name: 'Grab Holdings', email: 'fleet.devices@grab.com', tier: 'standard' },
  { name: 'SeaMoney', email: 'ops.hardware@sea.com', tier: 'standard' },
  { name: 'Mercado Livre', email: 'fc.automation@mercadolivre.com', tier: 'gold' },
  { name: 'Nubank', email: 'branchless.ops@nubank.com.br', tier: 'standard' },
  { name: 'Shoprite Holdings', email: 'dc.equipment@shoprite.co.za', tier: 'standard' },
  { name: 'Safaricom PLC', email: 'msites.buy@safaricom.co.ke', tier: 'gold' },
  { name: 'Orange Business', email: 'campus.networks@orange.com', tier: 'gold' },
  { name: 'Carrefour Group', email: 'hypermarket.iot@carrefour.com', tier: 'gold' },
  { name: 'IKEA Industry', email: 'factory.controls@ikea.com', tier: 'platinum' },
  { name: 'Bajaj Auto', email: 'plant.buy@bajajauto.com', tier: 'gold' },
  { name: 'Cipla Limited', email: 'api.automation@cipla.com', tier: 'gold' },
  { name: 'Sun Pharmaceutical', email: 'formulations.buy@sunpharma.com', tier: 'gold' },
  { name: 'Vedanta Limited', email: 'smelter.systems@vedanta.co.in', tier: 'strategic' },
  { name: 'Axis Bank', email: 'branch.infrastructure@axisbank.com', tier: 'gold' },
];

const EXTRA_PRODUCTS: Array<Omit<Product, 'id'>> = [
  { sku: 'HW-CORE-2', name: 'Core Gateway Mk II', category: 'hardware', listPrice: 5200, cost: 2800, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18, description: 'Dual-radio industrial gateway for plant floors.' },
  { sku: 'HW-CORE-R', name: 'Core Gateway Rugged', category: 'hardware', listPrice: 6100, cost: 3400, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18, description: 'IP67 enclosure for ports and yards.' },
  { sku: 'HW-EDGE-3', name: 'Edge Sensor Array', category: 'hardware', listPrice: 2100, cost: 1100, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'HW-EDGE-T', name: 'Temperature Probe Kit', category: 'hardware', listPrice: 890, cost: 410, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'HW-EDGE-V', name: 'Vibration Monitor', category: 'hardware', listPrice: 1750, cost: 820, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'HW-CAM-1', name: 'Yard Camera Node', category: 'hardware', listPrice: 2400, cost: 1300, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'HW-PWR-1', name: 'PoE Injector Shelf', category: 'hardware', listPrice: 640, cost: 280, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'HW-RACK-1', name: 'Edge Rack 12U', category: 'hardware', listPrice: 1800, cost: 950, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'HW-SIM-1', name: 'Industrial SIM Cradle', category: 'hardware', listPrice: 220, cost: 70, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'HW-ANT-1', name: 'Omni Antenna Pair', category: 'hardware', listPrice: 310, cost: 120, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'HW-UPS-1', name: 'Site UPS 1.5kVA', category: 'hardware', listPrice: 980, cost: 520, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'HW-SW-8', name: 'Managed Switch 8-port', category: 'hardware', listPrice: 720, cost: 340, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SW-CTRL-2', name: 'Control Suite Enterprise', category: 'software', listPrice: 4200, cost: 700, billingType: 'recurring', billingFrequency: 'monthly', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SW-CTRL-Y', name: 'Control Suite Annual', category: 'software', listPrice: 22000, cost: 3600, billingType: 'recurring', billingFrequency: 'yearly', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SW-SCADA', name: 'Plant SCADA Connector', category: 'software', listPrice: 1600, cost: 280, billingType: 'recurring', billingFrequency: 'monthly', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SW-WMS', name: 'Warehouse Pulse', category: 'software', listPrice: 1900, cost: 320, billingType: 'recurring', billingFrequency: 'monthly', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SW-YMS', name: 'Yard Management Cloud', category: 'software', listPrice: 2100, cost: 380, billingType: 'recurring', billingFrequency: 'monthly', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SW-ALERT', name: 'Alert Fabric', category: 'software', listPrice: 750, cost: 110, billingType: 'recurring', billingFrequency: 'monthly', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SW-AI-VIS', name: 'Vision Inspection API', category: 'software', listPrice: 2800, cost: 540, billingType: 'recurring', billingFrequency: 'monthly', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SW-COMPLY', name: 'GST E-Invoice Bridge', category: 'software', listPrice: 1100, cost: 180, billingType: 'recurring', billingFrequency: 'monthly', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SW-MOBILE', name: 'Field Tech App', category: 'software', listPrice: 480, cost: 70, billingType: 'recurring', billingFrequency: 'monthly', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SVC-ONBOARD', name: 'Plant Onboarding', category: 'services', listPrice: 4500, cost: 1800, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SVC-TRAIN', name: 'Operator Training Week', category: 'services', listPrice: 2800, cost: 900, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SVC-CARE', name: 'Care Plan Standard', category: 'services', listPrice: 900, cost: 220, billingType: 'recurring', billingFrequency: 'yearly', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SVC-CARE-P', name: 'Care Plan Priority', category: 'services', listPrice: 1800, cost: 420, billingType: 'recurring', billingFrequency: 'yearly', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SVC-SLA-4', name: '4-hour Onsite SLA', category: 'services', listPrice: 2400, cost: 900, billingType: 'recurring', billingFrequency: 'yearly', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SVC-AUDIT', name: 'Quarterly Site Audit', category: 'services', listPrice: 1200, cost: 400, billingType: 'recurring', billingFrequency: 'quarterly', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SVC-MIGRATE', name: 'Legacy Cutover', category: 'services', listPrice: 7600, cost: 3100, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'LIC-SITE', name: 'Additional Site License', category: 'software', listPrice: 650, cost: 80, billingType: 'recurring', billingFrequency: 'monthly', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'LIC-USER', name: 'Named User Pack (25)', category: 'software', listPrice: 375, cost: 40, billingType: 'recurring', billingFrequency: 'monthly', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'HW-HMI-1', name: 'Shop-floor HMI 15"', category: 'hardware', listPrice: 1320, cost: 610, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'HW-PLC-G', name: 'Gateway PLC Bridge', category: 'hardware', listPrice: 2650, cost: 1400, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'HW-ENV-1', name: 'Clean-room Sensor', category: 'hardware', listPrice: 1980, cost: 990, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SW-TRACE', name: 'Batch Traceability', category: 'software', listPrice: 1450, cost: 260, billingType: 'recurring', billingFrequency: 'monthly', taxCategory: 'GST-18', taxRatePercent: 18 },
  { sku: 'SVC-REMOTE', name: 'Remote Expert Hours', category: 'services', listPrice: 160, cost: 45, billingType: 'one_time', taxCategory: 'GST-18', taxRatePercent: 18 },
];

const EXTRA_WAREHOUSES: Array<Omit<Warehouse, 'id'>> = [
  { name: 'Mumbai DC', fulfillmentCostPerUnit: 14 },
  { name: 'Bengaluru DC', fulfillmentCostPerUnit: 16 },
  { name: 'Jebel Ali DC', fulfillmentCostPerUnit: 22 },
  { name: 'Singapore DC', fulfillmentCostPerUnit: 20 },
];

const EXTRA_POLICIES: Array<Omit<DiscountPolicy, 'id'>> = [
  { name: 'Hardware volume', productCategory: 'hardware', warningPercent: 4, approvalPercent: 8, rejectPercent: 22, maxMarginImpactPercent: 35, priority: 40 },
  { name: 'Services retainer', productCategory: 'services', warningPercent: 6, approvalPercent: 10, rejectPercent: 28, maxMarginImpactPercent: 45, priority: 45 },
  { name: 'Strategic account', customerTier: 'strategic', warningPercent: 10, approvalPercent: 16, rejectPercent: 32, maxMarginImpactPercent: 60, priority: 15 },
  { name: 'Silver ceiling', customerTier: 'silver', warningPercent: 4, approvalPercent: 7, rejectPercent: 20, maxMarginImpactPercent: 38, priority: 55 },
  { name: 'Monsoon hardware', productCategory: 'hardware', warningPercent: 5, approvalPercent: 9, rejectPercent: 18, maxMarginImpactPercent: 30, priority: 35, description: 'Seasonal plant shutdown buying.' },
  { name: 'New logo', customerTier: 'standard', warningPercent: 2, approvalPercent: 4, rejectPercent: 15, maxMarginImpactPercent: 28, priority: 80 },
];

const EXTRA_CHAIN_DEFS: Array<{
  name: string;
  minRiskScore: number;
  minBlendedDiscountPercent: number;
  priority: number;
  steps: Array<{ roleKey: 'manager' | 'finance' | 'final'; label: string }>;
}> = [
  {
    name: 'Finance lock path',
    minRiskScore: 55,
    minBlendedDiscountPercent: 8,
    priority: 25,
    steps: [
      { roleKey: 'finance', label: 'Finance review' },
      { roleKey: 'final', label: 'Controller' },
    ],
  },
  {
    name: 'High-value plant deal',
    minRiskScore: 60,
    minBlendedDiscountPercent: 0,
    priority: 18,
    steps: [
      { roleKey: 'manager', label: 'Regional manager' },
      { roleKey: 'finance', label: 'Finance' },
      { roleKey: 'final', label: 'VP sales' },
    ],
  },
  {
    name: 'Director override',
    minRiskScore: 80,
    minBlendedDiscountPercent: 25,
    priority: 5,
    steps: [{ roleKey: 'final', label: 'Director' }],
  },
];

const EXTRA_ROLE_AUTHORITIES: RoleAuthority[] = [
  {
    roleKey: 'final',
    maxDiscountPercent: 20,
    minMarginPercent: 8,
    maxPriceOverridePercent: 8,
    canNegotiate: false,
    exceedAction: 'block',
  },
];

type LineSpec = { sku: string; quantity: number; discountPercent: number };
type QuoteSpec = {
  number: string;
  customerEmail: string;
  status: QuoteStatus;
  daysAgo: number;
  lines: LineSpec[];
  decision?: DiscountDecision;
  chainName?: string;
  customerDecision?: 'none' | 'accepted' | 'declined';
  locked?: boolean;
};

const QUOTE_SPECS: QuoteSpec[] = [
  { number: 'DF-00001', customerEmail: 'demo.user@example.com', status: 'draft', daysAgo: 4, lines: [{ sku: 'HW-CORE-1', quantity: 8, discountPercent: 0 }, { sku: 'SW-CTRL-1', quantity: 1, discountPercent: 0 }], decision: 'allowed' },
  { number: 'DF-00002', customerEmail: 'procurement@relianceretail.in', status: 'draft', daysAgo: 2, lines: [{ sku: 'HW-EDGE-2', quantity: 12, discountPercent: 3 }, { sku: 'SW-WMS', quantity: 2, discountPercent: 0 }], decision: 'allowed' },
  { number: 'DF-00003', customerEmail: 'buying@tatasteel.com', status: 'finalized', daysAgo: 9, lines: [{ sku: 'HW-CORE-R', quantity: 4, discountPercent: 2 }], decision: 'allowed', customerDecision: 'accepted' },
  { number: 'DF-00004', customerEmail: 'sourcing@mahindralogistics.com', status: 'approved', daysAgo: 6, lines: [{ sku: 'HW-CAM-1', quantity: 6, discountPercent: 0 }, { sku: 'SW-YMS', quantity: 1, discountPercent: 4 }], decision: 'warning', chainName: 'Sales Manager', customerDecision: 'accepted' },
  { number: 'DF-00005', customerEmail: 'facilities.buy@infosys.com', status: 'approval_required', daysAgo: 8, lines: [{ sku: 'HW-CORE-2', quantity: 10, discountPercent: 8 }, { sku: 'SW-CTRL-2', quantity: 3, discountPercent: 10 }], decision: 'approval_required', chainName: 'Sales Manager → Finance' },
  { number: 'DF-00006', customerEmail: 'branch.ops@hdfcbank.com', status: 'approval_required', daysAgo: 9, lines: [{ sku: 'HW-HMI-1', quantity: 20, discountPercent: 12 }], decision: 'approval_required', chainName: 'Sales Manager → Finance' },
  { number: 'DF-00007', customerEmail: 'plant.procurement@asianpaints.com', status: 'approval_required', daysAgo: 11, lines: [{ sku: 'HW-EDGE-V', quantity: 15, discountPercent: 6 }, { sku: 'SW-ALERT', quantity: 2, discountPercent: 8 }], decision: 'approval_required', chainName: 'Sales Manager' },
  { number: 'DF-00008', customerEmail: 'terminal.buy@adaniports.com', status: 'approval_required', daysAgo: 13, lines: [{ sku: 'HW-CORE-R', quantity: 18, discountPercent: 16 }, { sku: 'SVC-SLA-4', quantity: 1, discountPercent: 5 }], decision: 'approval_required', chainName: 'Sales Manager → Finance → Final' },
  { number: 'DF-00009', customerEmail: 'fc.equipment@flipkart.com', status: 'fulfillment', daysAgo: 38, lines: [{ sku: 'HW-RACK-1', quantity: 8, discountPercent: 4 }, { sku: 'SW-WMS', quantity: 4, discountPercent: 5 }], decision: 'allowed', chainName: 'Sales Manager', customerDecision: 'accepted', locked: true },
  { number: 'DF-00010', customerEmail: 'darkstore.ops@zomato.com', status: 'completed', daysAgo: 96, lines: [{ sku: 'HW-EDGE-3', quantity: 9, discountPercent: 3 }], decision: 'allowed', chainName: 'Sales Manager', customerDecision: 'accepted', locked: true },
  { number: 'DF-00011', customerEmail: 'projects.buy@larsentoubro.com', status: 'confirmed', daysAgo: 28, lines: [{ sku: 'HW-PLC-G', quantity: 6, discountPercent: 7 }, { sku: 'SW-SCADA', quantity: 2, discountPercent: 6 }], decision: 'warning', chainName: 'Sales Manager', customerDecision: 'accepted', locked: true },
  { number: 'DF-00012', customerEmail: 'retail.tech@titan.co.in', status: 'customer_negotiation', daysAgo: 7, lines: [{ sku: 'HW-CORE-1', quantity: 5, discountPercent: 4 }, { sku: 'SW-CTRL-1', quantity: 2, discountPercent: 8 }], decision: 'warning' },
  { number: 'DF-00013', customerEmail: 'vendor.portal@marutisuzuki.com', status: 'customer_negotiation', daysAgo: 5, lines: [{ sku: 'HW-ENV-1', quantity: 14, discountPercent: 9 }, { sku: 'SW-TRACE', quantity: 1, discountPercent: 5 }], decision: 'approval_required', chainName: 'Sales Manager' },
  { number: 'DF-00014', customerEmail: 'network.capex@airtel.com', status: 'customer_negotiation', daysAgo: 10, lines: [{ sku: 'HW-ANT-1', quantity: 40, discountPercent: 11 }, { sku: 'SW-MOBILE', quantity: 8, discountPercent: 2 }], decision: 'approval_required', chainName: 'Sales Manager → Finance' },
  { number: 'DF-00015', customerEmail: 'plant.automation@drreddys.com', status: 'manager_review', daysAgo: 6, lines: [{ sku: 'HW-CORE-2', quantity: 7, discountPercent: 9 }, { sku: 'SVC-ONBOARD', quantity: 1, discountPercent: 0 }], decision: 'approval_required', chainName: 'Sales Manager' },
  { number: 'DF-00016', customerEmail: 'workplace.services@wipro.com', status: 'manager_review', daysAgo: 3, lines: [{ sku: 'LIC-USER', quantity: 6, discountPercent: 5 }, { sku: 'SVC-TRAIN', quantity: 2, discountPercent: 4 }], decision: 'warning' },
  { number: 'DF-00017', customerEmail: 'factories.buy@itc.in', status: 'confirmed', daysAgo: 31, lines: [{ sku: 'HW-CORE-1', quantity: 6, discountPercent: 3 }, { sku: 'SW-CTRL-1', quantity: 1, discountPercent: 2 }], decision: 'allowed', customerDecision: 'accepted', locked: true },
  { number: 'DF-00018', customerEmail: 'mills.procurement@jsw.in', status: 'billing', daysAgo: 68, lines: [{ sku: 'HW-EDGE-T', quantity: 16, discountPercent: 4 }], decision: 'allowed', customerDecision: 'accepted', locked: true },
  { number: 'DF-00019', customerEmail: 'digital.industries@siemens.com', status: 'confirmed', daysAgo: 40, lines: [{ sku: 'HW-CORE-2', quantity: 12, discountPercent: 5 }, { sku: 'SW-CTRL-2', quantity: 2, discountPercent: 4 }], decision: 'allowed', chainName: 'Sales Manager', customerDecision: 'accepted', locked: true },
  { number: 'DF-00020', customerEmail: 'bidadi.buy@bosch.com', status: 'confirmed', daysAgo: 36, lines: [{ sku: 'HW-EDGE-V', quantity: 8, discountPercent: 3 }], decision: 'allowed', customerDecision: 'accepted', locked: true },
  { number: 'DF-00021', customerEmail: 'ecostruxture.sales@se.com', status: 'confirmed', daysAgo: 44, lines: [{ sku: 'HW-CORE-R', quantity: 5, discountPercent: 4 }, { sku: 'SVC-CARE-P', quantity: 1, discountPercent: 0 }], decision: 'allowed', customerDecision: 'accepted', locked: true },
  { number: 'DF-00022', customerEmail: 'factory.systems@unilever.com', status: 'confirmed', daysAgo: 33, lines: [{ sku: 'HW-HMI-1', quantity: 10, discountPercent: 3 }, { sku: 'SW-SCADA', quantity: 1, discountPercent: 0 }], decision: 'allowed', customerDecision: 'accepted', locked: true },
  { number: 'DF-00023', customerEmail: 'moga.plant@in.nestle.com', status: 'confirmed', daysAgo: 29, lines: [{ sku: 'HW-ENV-1', quantity: 8, discountPercent: 2 }, { sku: 'SW-TRACE', quantity: 1, discountPercent: 0 }], decision: 'allowed', customerDecision: 'accepted', locked: true },
  { number: 'DF-00024', customerEmail: 'terminal.iot@maersk.com', status: 'fulfillment', daysAgo: 52, lines: [{ sku: 'HW-CAM-1', quantity: 20, discountPercent: 6 }, { sku: 'SW-YMS', quantity: 2, discountPercent: 3 }], decision: 'warning', chainName: 'Sales Manager', customerDecision: 'accepted', locked: true },
  { number: 'DF-00025', customerEmail: 'yard.systems@dpworld.com', status: 'fulfillment', daysAgo: 48, lines: [{ sku: 'HW-CORE-R', quantity: 9, discountPercent: 5 }, { sku: 'HW-ANT-1', quantity: 18, discountPercent: 2 }], decision: 'allowed', customerDecision: 'accepted', locked: true },
  { number: 'DF-00026', customerEmail: 'branch.infrastructure@emiratesnbd.com', status: 'fulfillment', daysAgo: 55, lines: [{ sku: 'HW-SW-8', quantity: 14, discountPercent: 4 }, { sku: 'SW-CTRL-1', quantity: 3, discountPercent: 5 }], decision: 'allowed', customerDecision: 'accepted', locked: true },
  { number: 'DF-00027', customerEmail: 'workplace.tech@sc.com', status: 'fulfillment', daysAgo: 47, lines: [{ sku: 'LIC-SITE', quantity: 5, discountPercent: 0 }, { sku: 'HW-UPS-1', quantity: 4, discountPercent: 3 }], decision: 'allowed', customerDecision: 'accepted', locked: true },
  { number: 'DF-00028', customerEmail: 'airside.ops@sats.com.sg', status: 'fulfillment', daysAgo: 60, lines: [{ sku: 'HW-CORE-1', quantity: 3, discountPercent: 1 }, { sku: 'SVC-CARE', quantity: 1, discountPercent: 0 }], decision: 'allowed', customerDecision: 'accepted', locked: true },
  { number: 'DF-00029', customerEmail: 'airside.systems@changiairport.com', status: 'billing', daysAgo: 78, lines: [{ sku: 'HW-CORE-2', quantity: 8, discountPercent: 4 }, { sku: 'SW-CTRL-2', quantity: 2, discountPercent: 6 }], decision: 'warning', chainName: 'Sales Manager', customerDecision: 'accepted', locked: true },
  { number: 'DF-00030', customerEmail: 'retail.sites@petronas.com.my', status: 'billing', daysAgo: 82, lines: [{ sku: 'HW-EDGE-3', quantity: 11, discountPercent: 3 }, { sku: 'SW-ALERT', quantity: 3, discountPercent: 0 }], decision: 'allowed', customerDecision: 'accepted', locked: true },
  { number: 'DF-00031', customerEmail: 'plants.automation@scg.com', status: 'billing', daysAgo: 90, lines: [{ sku: 'HW-PLC-G', quantity: 4, discountPercent: 5 }, { sku: 'SVC-AUDIT', quantity: 4, discountPercent: 0 }], decision: 'allowed', customerDecision: 'accepted', locked: true },
  { number: 'DF-00032', customerEmail: 'fleet.devices@grab.com', status: 'billing', daysAgo: 70, lines: [{ sku: 'HW-SIM-1', quantity: 80, discountPercent: 8 }, { sku: 'SW-MOBILE', quantity: 10, discountPercent: 4 }], decision: 'warning', customerDecision: 'accepted', locked: true },
  { number: 'DF-00033', customerEmail: 'ops.hardware@sea.com', status: 'billing', daysAgo: 74, lines: [{ sku: 'HW-EDGE-2', quantity: 16, discountPercent: 5 }], decision: 'allowed', customerDecision: 'accepted', locked: true },
  { number: 'DF-00034', customerEmail: 'fc.automation@mercadolivre.com', status: 'completed', daysAgo: 120, lines: [{ sku: 'HW-RACK-1', quantity: 12, discountPercent: 4 }, { sku: 'SW-WMS', quantity: 3, discountPercent: 5 }], decision: 'allowed', customerDecision: 'accepted', locked: true },
  { number: 'DF-00035', customerEmail: 'branchless.ops@nubank.com.br', status: 'completed', daysAgo: 132, lines: [{ sku: 'LIC-USER', quantity: 8, discountPercent: 2 }, { sku: 'SVC-ONBOARD', quantity: 1, discountPercent: 0 }], decision: 'allowed', customerDecision: 'accepted', locked: true },
  { number: 'DF-00036', customerEmail: 'dc.equipment@shoprite.co.za', status: 'completed', daysAgo: 140, lines: [{ sku: 'HW-CORE-1', quantity: 6, discountPercent: 3 }, { sku: 'SW-CTRL-1', quantity: 1, discountPercent: 0 }], decision: 'allowed', customerDecision: 'accepted', locked: true },
  { number: 'DF-00037', customerEmail: 'msites.buy@safaricom.co.ke', status: 'completed', daysAgo: 110, lines: [{ sku: 'HW-ANT-1', quantity: 24, discountPercent: 6 }, { sku: 'SW-MOBILE', quantity: 4, discountPercent: 0 }], decision: 'warning', customerDecision: 'accepted', locked: true },
  { number: 'DF-00038', customerEmail: 'campus.networks@orange.com', status: 'completed', daysAgo: 150, lines: [{ sku: 'HW-SW-8', quantity: 18, discountPercent: 5 }, { sku: 'SW-CTRL-Y', quantity: 1, discountPercent: 4 }], decision: 'allowed', customerDecision: 'accepted', locked: true },
  { number: 'DF-00039', customerEmail: 'hypermarket.iot@carrefour.com', status: 'rejected', daysAgo: 28, lines: [{ sku: 'HW-CORE-2', quantity: 20, discountPercent: 22 }], decision: 'rejected', chainName: 'Sales Manager → Finance → Final', customerDecision: 'declined' },
  { number: 'DF-00040', customerEmail: 'factory.controls@ikea.com', status: 'rejected', daysAgo: 34, lines: [{ sku: 'SVC-MIGRATE', quantity: 2, discountPercent: 18 }, { sku: 'SW-CTRL-2', quantity: 4, discountPercent: 14 }], decision: 'rejected', chainName: 'High-value plant deal', customerDecision: 'declined' },
  { number: 'DF-00041', customerEmail: 'buying@globex.example', status: 'draft', daysAgo: 3, lines: [{ sku: 'HW-CORE-1', quantity: 4, discountPercent: 0 }, { sku: 'SW-ANALYTICS', quantity: 1, discountPercent: 0 }], decision: 'allowed' },
  { number: 'DF-00042', customerEmail: 'deals@initech.example', status: 'approved', daysAgo: 12, lines: [{ sku: 'HW-EDGE-2', quantity: 10, discountPercent: 5 }, { sku: 'SVC-PREMIUM', quantity: 1, discountPercent: 0 }], decision: 'warning', chainName: 'Sales Manager', customerDecision: 'accepted' },
];

export interface PresentationQuoteLine {
  id: string;
  productId: string;
  quantity: number;
  listPrice: number;
  discountPercent: number;
  unitCost: number;
}

export interface PresentationQuote {
  id: string;
  number: string;
  customerId: string;
  status: QuoteStatus;
  listTotal: number;
  discountTotal: number;
  netTotal: number;
  costTotal: number;
  marginPercent: number;
  blendedDiscountPercent: number;
  riskScore: number;
  assessmentDecision: DiscountDecision;
  requiredChainId?: string | null;
  portalToken: string;
  version: number;
  taxTotal: number;
  customerDecision: 'none' | 'accepted' | 'declined';
  commerciallyFrozenAt?: Date | null;
  financeLockedAt?: Date | null;
  createdAt: Date;
  lines: PresentationQuoteLine[];
  approvals: Array<{
    id: string;
    chainId: string;
    stepOrder: number;
    roleKey: string;
    label: string;
    status: 'pending' | 'approved' | 'rejected';
    reason?: string;
  }>;
  allocations: Array<{
    id: string;
    quoteLineId: string;
    warehouseId: string;
    quantity: number;
    unitFulfillmentCost: number;
    isBackorder: boolean;
  }>;
  backorders: Array<{ id: string; productId: string; quantity: number }>;
  schedules: Array<{
    id: string;
    quoteLineId: string;
    billingType: 'one_time' | 'recurring';
    frequency?: 'monthly' | 'quarterly' | 'yearly' | null;
    amount: number;
    status: 'scheduled' | 'invoiced' | 'cancelled';
    nextBillingAt?: Date | null;
  }>;
  negotiations: Array<{
    id: string;
    customerId: string;
    note: string;
    requestedDiscountPercent: number;
    status: 'open' | 'in_review' | 'sent_to_manager' | 'rejected';
  }>;
}

export interface PresentationBook {
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
  stock: Array<{ warehouseId: string; productId: string; quantityOnHand: number; reserved: number; incoming: number }>;
  policies: DiscountPolicy[];
  chains: ApprovalChain[];
  relations: ProductRelation[];
  quantityBreaks: QuantityBreak[];
  roleAuthorities: RoleAuthority[];
  quotes: PresentationQuote[];
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function isOrderStatus(status: QuoteStatus): boolean {
  return ['confirmed', 'fulfillment', 'billing', 'completed'].includes(status);
}

function isBilledStatus(status: QuoteStatus): boolean {
  return isOrderStatus(status) || status === 'finalized';
}

export function buildPresentationBook(): PresentationBook {
  const customers: Customer[] = [
    ...DEFAULT_CUSTOMERS,
    ...EXTRA_CUSTOMERS.map((item, index) => ({ ...item, id: uuid(0x10, index + 1) })),
  ];
  const products: Product[] = [
    ...DEFAULT_PRODUCTS.map((item) => ({
      ...item,
      taxCategory: item.taxCategory ?? 'GST-18',
      taxRatePercent: item.taxRatePercent ?? 18,
      taxable: true,
      active: item.active !== false,
    })),
    ...EXTRA_PRODUCTS.map((item, index) => ({ ...item, id: uuid(0x11, index + 1), taxable: true, active: true })),
  ];
  const warehouses: Warehouse[] = [
    ...DEFAULT_WAREHOUSES,
    ...EXTRA_WAREHOUSES.map((item, index) => ({ ...item, id: uuid(0x12, index + 1) })),
  ];
  const policies: DiscountPolicy[] = [
    ...DEFAULT_POLICIES,
    ...EXTRA_POLICIES.map((item, index) => ({ ...item, id: uuid(0x13, index + 1), active: true })),
  ];
  const chains: ApprovalChain[] = [
    ...DEFAULT_CHAINS,
    ...EXTRA_CHAIN_DEFS.map((item, index) => {
      const chainId = uuid(0x14, index + 1);
      return {
        id: chainId,
        name: item.name,
        minRiskScore: item.minRiskScore,
        minBlendedDiscountPercent: item.minBlendedDiscountPercent,
        priority: item.priority,
        active: true,
        steps: item.steps.map((step, stepIndex) => ({
          id: uuid(0x15, index * 10 + stepIndex + 1),
          chainId,
          stepOrder: stepIndex + 1,
          roleKey: step.roleKey,
          label: step.label,
        })),
      };
    }),
  ];
  const roleAuthorities = [...DEFAULT_ROLE_AUTHORITIES, ...EXTRA_ROLE_AUTHORITIES];

  const extraBreaks: QuantityBreak[] = [
    {
      id: uuid(0x17, 1),
      name: 'Core Mk II 8+ volume',
      productId: products.find((item) => item.sku === 'HW-CORE-2')!.id,
      minQuantity: 8,
      adjustmentKind: 'fixed',
      adjustmentValue: 4900,
      active: true,
    },
    {
      id: uuid(0x17, 2),
      name: 'Camera node 15+ yard',
      productId: products.find((item) => item.sku === 'HW-CAM-1')!.id,
      minQuantity: 15,
      adjustmentKind: 'percent',
      adjustmentValue: -6,
      active: true,
    },
    {
      id: uuid(0x17, 3),
      name: 'Control Enterprise 3+ sites',
      productId: products.find((item) => item.sku === 'SW-CTRL-2')!.id,
      minQuantity: 3,
      adjustmentKind: 'fixed',
      adjustmentValue: 3900,
      active: true,
    },
  ];
  const quantityBreaks = [...DEFAULT_QUANTITY_BREAKS, ...extraBreaks];

  const extraRelations: ProductRelation[] = [
    { id: uuid(0x16, 1), productId: products.find((item) => item.sku === 'HW-CORE-2')!.id, recommendedProductId: products.find((item) => item.sku === 'SW-CTRL-2')!.id, kind: 'cross_sell', reason: 'Enterprise control is sold with Mk II gateways.', minQuantity: 1 },
    { id: uuid(0x16, 2), productId: products.find((item) => item.sku === 'HW-CAM-1')!.id, recommendedProductId: products.find((item) => item.sku === 'SW-YMS')!.id, kind: 'cross_sell', reason: 'Yard cameras need the yard cloud.', minQuantity: 1 },
    { id: uuid(0x16, 3), productId: products.find((item) => item.sku === 'HW-PLC-G')!.id, recommendedProductId: products.find((item) => item.sku === 'SW-SCADA')!.id, kind: 'upsell', reason: 'PLC bridges almost always attach SCADA.', minQuantity: 1 },
    { id: uuid(0x16, 4), productId: products.find((item) => item.sku === 'SW-CTRL-1')!.id, recommendedProductId: products.find((item) => item.sku === 'SVC-CARE')!.id, kind: 'cross_sell', reason: 'Care plan is attached after first site go-live.', minQuantity: 1 },
    { id: uuid(0x16, 5), productId: products.find((item) => item.sku === 'HW-ENV-1')!.id, recommendedProductId: products.find((item) => item.sku === 'SW-TRACE')!.id, kind: 'cross_sell', reason: 'Clean-room sensors feed batch traceability.', minQuantity: 1 },
  ];
  const relations = [...DEFAULT_RELATIONS, ...extraRelations];

  const stock: PresentationBook['stock'] = [];
  const stockPlan: Array<{ sku: string; rows: Array<{ warehouse: string; onHand: number; reserved: number; incoming: number }> }> = [
    { sku: 'HW-CORE-1', rows: [{ warehouse: 'West DC', onHand: 4, reserved: 1, incoming: 6 }, { warehouse: 'East DC', onHand: 3, reserved: 0, incoming: 0 }, { warehouse: 'Mumbai DC', onHand: 11, reserved: 2, incoming: 8 }] },
    { sku: 'HW-CORE-2', rows: [{ warehouse: 'Mumbai DC', onHand: 7, reserved: 3, incoming: 5 }, { warehouse: 'Bengaluru DC', onHand: 2, reserved: 2, incoming: 10 }] },
    { sku: 'HW-CORE-R', rows: [{ warehouse: 'Jebel Ali DC', onHand: 5, reserved: 4, incoming: 6 }, { warehouse: 'Singapore DC', onHand: 1, reserved: 0, incoming: 4 }] },
    { sku: 'HW-EDGE-2', rows: [{ warehouse: 'West DC', onHand: 10, reserved: 0, incoming: 0 }, { warehouse: 'East DC', onHand: 2, reserved: 1, incoming: 0 }, { warehouse: 'Mumbai DC', onHand: 18, reserved: 4, incoming: 0 }] },
    { sku: 'HW-EDGE-3', rows: [{ warehouse: 'Bengaluru DC', onHand: 9, reserved: 1, incoming: 3 }] },
    { sku: 'HW-EDGE-T', rows: [{ warehouse: 'Mumbai DC', onHand: 22, reserved: 0, incoming: 0 }] },
    { sku: 'HW-EDGE-V', rows: [{ warehouse: 'Bengaluru DC', onHand: 0, reserved: 0, incoming: 12 }] },
    { sku: 'HW-CAM-1', rows: [{ warehouse: 'Jebel Ali DC', onHand: 6, reserved: 5, incoming: 8 }, { warehouse: 'Singapore DC', onHand: 3, reserved: 0, incoming: 0 }] },
    { sku: 'HW-RACK-1', rows: [{ warehouse: 'Mumbai DC', onHand: 8, reserved: 2, incoming: 0 }] },
    { sku: 'HW-SIM-1', rows: [{ warehouse: 'Singapore DC', onHand: 140, reserved: 20, incoming: 0 }] },
    { sku: 'HW-ANT-1', rows: [{ warehouse: 'Jebel Ali DC', onHand: 30, reserved: 8, incoming: 0 }, { warehouse: 'Mumbai DC', onHand: 16, reserved: 0, incoming: 24 }] },
    { sku: 'HW-UPS-1', rows: [{ warehouse: 'Bengaluru DC', onHand: 5, reserved: 1, incoming: 0 }] },
    { sku: 'HW-SW-8', rows: [{ warehouse: 'West DC', onHand: 7, reserved: 0, incoming: 0 }, { warehouse: 'Mumbai DC', onHand: 13, reserved: 3, incoming: 0 }] },
    { sku: 'HW-HMI-1', rows: [{ warehouse: 'Bengaluru DC', onHand: 4, reserved: 4, incoming: 6 }] },
    { sku: 'HW-PLC-G', rows: [{ warehouse: 'Mumbai DC', onHand: 3, reserved: 1, incoming: 2 }] },
    { sku: 'HW-ENV-1', rows: [{ warehouse: 'Bengaluru DC', onHand: 6, reserved: 0, incoming: 0 }] },
    { sku: 'SW-CTRL-1', rows: [{ warehouse: 'West DC', onHand: 50, reserved: 0, incoming: 0 }, { warehouse: 'East DC', onHand: 50, reserved: 0, incoming: 0 }] },
    { sku: 'SW-CTRL-2', rows: [{ warehouse: 'Mumbai DC', onHand: 40, reserved: 0, incoming: 0 }] },
    { sku: 'SW-WMS', rows: [{ warehouse: 'Mumbai DC', onHand: 40, reserved: 0, incoming: 0 }] },
    { sku: 'SW-YMS', rows: [{ warehouse: 'Jebel Ali DC', onHand: 25, reserved: 0, incoming: 0 }] },
    { sku: 'SW-SCADA', rows: [{ warehouse: 'Bengaluru DC', onHand: 30, reserved: 0, incoming: 0 }] },
    { sku: 'SW-ALERT', rows: [{ warehouse: 'Singapore DC', onHand: 60, reserved: 0, incoming: 0 }] },
    { sku: 'SW-TRACE', rows: [{ warehouse: 'Bengaluru DC', onHand: 20, reserved: 0, incoming: 0 }] },
    { sku: 'SW-MOBILE', rows: [{ warehouse: 'Singapore DC', onHand: 80, reserved: 0, incoming: 0 }] },
    { sku: 'SW-ANALYTICS', rows: [{ warehouse: 'West DC', onHand: 50, reserved: 0, incoming: 0 }, { warehouse: 'East DC', onHand: 50, reserved: 0, incoming: 0 }] },
    { sku: 'SVC-PREMIUM', rows: [{ warehouse: 'West DC', onHand: 20, reserved: 0, incoming: 0 }, { warehouse: 'East DC', onHand: 20, reserved: 0, incoming: 0 }] },
  ];
  for (const plan of stockPlan) {
    const product = products.find((item) => item.sku === plan.sku);
    if (!product) continue;
    for (const row of plan.rows) {
      const warehouse = warehouses.find((item) => item.name === row.warehouse);
      if (!warehouse) continue;
      stock.push({
        warehouseId: warehouse.id,
        productId: product.id,
        quantityOnHand: row.onHand,
        reserved: row.reserved,
        incoming: row.incoming,
      });
    }
  }
  for (const row of DEFAULT_STOCK) {
    if (!stock.some((item) => item.warehouseId === row.warehouseId && item.productId === row.productId)) {
      stock.push({
        warehouseId: row.warehouseId,
        productId: row.productId,
        quantityOnHand: row.quantityOnHand,
        reserved: row.reserved,
        incoming: row.incoming ?? 0,
      });
    }
  }

  const productBySku = new Map(products.map((item) => [item.sku, item]));
  const customerByEmail = new Map(customers.map((item) => [item.email, item]));
  const chainByName = new Map(chains.map((item) => [item.name, item]));
  const now = Date.parse('2026-09-06T09:00:00.000Z');

  const quotes = QUOTE_SPECS.map((spec, quoteIndex) => {
    const customer = customerByEmail.get(spec.customerEmail);
    if (!customer) {
      throw new Error(`Unknown customer ${spec.customerEmail}`);
    }
    const lines: PresentationQuoteLine[] = spec.lines.map((line, lineIndex) => {
      const product = productBySku.get(line.sku);
      if (!product) {
        throw new Error(`Unknown SKU ${line.sku}`);
      }
      return {
        id: uuid(0x19, quoteIndex * 10 + lineIndex + 1),
        productId: product.id,
        quantity: line.quantity,
        listPrice: product.listPrice,
        discountPercent: line.discountPercent,
        unitCost: product.cost,
      };
    });
    const listTotal = money(lines.reduce((sum, line) => sum + line.listPrice * line.quantity, 0));
    const netTotal = money(lines.reduce((sum, line) => sum + line.listPrice * line.quantity * (1 - line.discountPercent / 100), 0));
    const costTotal = money(lines.reduce((sum, line) => sum + line.unitCost * line.quantity, 0));
    const discountTotal = money(listTotal - netTotal);
    const blendedDiscountPercent = listTotal === 0 ? 0 : money((discountTotal / listTotal) * 100);
    const marginPercent = netTotal === 0 ? 0 : money(((netTotal - costTotal) / netTotal) * 100);
    const chain = spec.chainName ? chainByName.get(spec.chainName) : undefined;
    if (spec.chainName && !chain) {
      throw new Error(`Unknown approval chain ${spec.chainName}`);
    }
    const createdAt = new Date(now - spec.daysAgo * 86_400_000);
    const lockedAt = spec.locked ? new Date(createdAt.getTime() + 2 * 86_400_000) : null;
    const approvals =
      chain && (spec.status === 'approval_required' || spec.status === 'approved' || spec.status === 'rejected' || isOrderStatus(spec.status))
        ? chain.steps.map((step, stepIndex) => ({
            id: uuid(0x1a, quoteIndex * 10 + stepIndex + 1),
            chainId: chain.id,
            stepOrder: step.stepOrder,
            roleKey: step.roleKey,
            label: step.label,
            status:
              spec.status === 'approval_required'
                ? ('pending' as const)
                : spec.status === 'rejected'
                  ? stepIndex === 0
                    ? ('rejected' as const)
                    : ('pending' as const)
                  : ('approved' as const),
            reason:
              spec.status === 'rejected'
                ? 'Discount sits above the reject ceiling for this account.'
                : spec.status === 'approval_required'
                  ? undefined
                  : 'Within the agreed commercial band.',
          }))
        : [];

    const allocations: PresentationQuote['allocations'] = [];
    const backorders: PresentationQuote['backorders'] = [];
    if (['fulfillment', 'billing', 'completed'].includes(spec.status)) {
      let allocIndex = 0;
      for (const line of lines) {
        const product = products.find((item) => item.id === line.productId);
        if (product?.billingType !== 'one_time' || product.category !== 'hardware') continue;
        const stockRows = stock.filter((row) => row.productId === line.productId);
        const preferred =
          stockRows.sort((a, b) => b.quantityOnHand - a.quantityOnHand)[0] ??
          { warehouseId: warehouses[0].id, quantityOnHand: 0, reserved: 0, incoming: 0 };
        const warehouse = warehouses.find((item) => item.id === preferred.warehouseId) ?? warehouses[0];
        const shipped = Math.min(line.quantity, preferred.quantityOnHand > 0 ? preferred.quantityOnHand : line.quantity);
        const isBackorder = shipped < line.quantity;
        allocations.push({
          id: uuid(0x1b, quoteIndex * 10 + allocIndex + 1),
          quoteLineId: line.id,
          warehouseId: warehouse.id,
          quantity: shipped,
          unitFulfillmentCost: warehouse.fulfillmentCostPerUnit,
          isBackorder,
        });
        if (isBackorder) {
          backorders.push({
            id: uuid(0x1c, quoteIndex * 10 + allocIndex + 1),
            productId: line.productId,
            quantity: money(line.quantity - shipped),
          });
        }
        allocIndex += 1;
      }
    }

    const schedules = isBilledStatus(spec.status)
      ? lines.map((line, index) => {
          const product = products.find((item) => item.id === line.productId)!;
          const amount = money(line.listPrice * line.quantity * (1 - line.discountPercent / 100));
          return {
            id: uuid(0x1d, quoteIndex * 10 + index + 1),
            quoteLineId: line.id,
            billingType: product.billingType,
            frequency: product.billingFrequency ?? null,
            amount,
            status:
              spec.status === 'completed'
                ? ('invoiced' as const)
                : spec.status === 'rejected'
                  ? ('cancelled' as const)
                  : ('scheduled' as const),
            nextBillingAt:
              product.billingType === 'recurring'
                ? new Date(now + (product.billingFrequency === 'yearly' ? 30 : 14) * 86_400_000)
                : spec.status === 'completed'
                  ? null
                  : new Date(now + 7 * 86_400_000),
          };
        })
      : [];

    const negotiations =
      spec.status === 'customer_negotiation' || spec.status === 'manager_review'
        ? [
            {
              id: uuid(0x1e, quoteIndex + 1),
              customerId: customer.id,
              note:
                spec.status === 'manager_review'
                  ? 'Please review the counter on hardware. We can hold the software list.'
                  : 'Can you meet us at a lower blended number if we take the care plan?',
              requestedDiscountPercent: Math.min(14, Math.max(6, Math.round(blendedDiscountPercent + 3))),
              status: spec.status === 'manager_review' ? ('sent_to_manager' as const) : ('open' as const),
            },
          ]
        : [];

    return {
      id: spec.number === 'DF-00001' ? PRESENTATION_QUOTE_ID : uuid(0x18, quoteIndex + 1),
      number: spec.number,
      customerId: customer.id,
      status: spec.status,
      listTotal,
      discountTotal,
      netTotal,
      costTotal,
      marginPercent,
      blendedDiscountPercent,
      riskScore: money(
        Math.min(
          100,
          blendedDiscountPercent * 4 +
            (spec.decision === 'rejected' ? 40 : spec.decision === 'approval_required' ? 20 : 5),
        ),
      ),
      assessmentDecision: spec.decision ?? 'allowed',
      requiredChainId: chain?.id ?? null,
      portalToken:
        spec.number === 'DF-00001'
          ? PRESENTATION_PORTAL_TOKEN
          : `portal-${spec.number.toLowerCase()}-${customer.id.replace(/-/g, '').slice(0, 8)}`,
      version: spec.locked ? 4 : spec.status === 'draft' ? 1 : 2,
      taxTotal: money(netTotal * 0.18),
      customerDecision: spec.customerDecision ?? 'none',
      commerciallyFrozenAt: lockedAt,
      financeLockedAt: lockedAt,
      createdAt,
      lines,
      approvals,
      allocations,
      backorders,
      schedules,
      negotiations,
    };
  });

  return {
    customers,
    products,
    warehouses,
    stock,
    policies,
    chains,
    relations,
    quantityBreaks,
    roleAuthorities,
    quotes,
  };
}

export function countPresentationRecords(book: PresentationBook = buildPresentationBook()) {
  const invoices = book.quotes.reduce(
    (sum, quote) => sum + quote.schedules.filter((item) => item.billingType === 'one_time').length,
    0,
  );
  const subscriptions = book.quotes.reduce(
    (sum, quote) => sum + quote.schedules.filter((item) => item.billingType === 'recurring').length,
    0,
  );
  const orders = book.quotes.filter((quote) => isOrderStatus(quote.status)).length;
  const breakdown = {
    customers: book.customers.length,
    contacts: book.customers.length,
    products: book.products.length,
    warehouses: book.warehouses.length,
    stock: book.stock.length,
    policies: book.policies.length,
    chains: book.chains.length,
    chainSteps: book.chains.reduce((sum, chain) => sum + chain.steps.length, 0),
    relations: book.relations.length,
    quantityBreaks: book.quantityBreaks.length,
    roleAuthorities: book.roleAuthorities.length,
    quotes: book.quotes.length,
    quoteLines: book.quotes.reduce((sum, quote) => sum + quote.lines.length, 0),
    approvals: book.quotes.reduce((sum, quote) => sum + quote.approvals.length, 0),
    allocations: book.quotes.reduce((sum, quote) => sum + quote.allocations.length, 0),
    backorders: book.quotes.reduce((sum, quote) => sum + quote.backorders.length, 0),
    invoices,
    subscriptions,
    negotiations: book.quotes.reduce((sum, quote) => sum + quote.negotiations.length, 0),
    deals: book.quotes.length,
    quotations: book.quotes.length,
    orders,
  };
  const uniqueTotal =
    breakdown.customers +
    breakdown.products +
    breakdown.warehouses +
    breakdown.stock +
    breakdown.policies +
    breakdown.chains +
    breakdown.chainSteps +
    breakdown.relations +
    breakdown.quantityBreaks +
    breakdown.roleAuthorities +
    breakdown.quotes +
    breakdown.quoteLines +
    breakdown.approvals +
    breakdown.allocations +
    breakdown.backorders +
    breakdown.invoices +
    breakdown.subscriptions +
    breakdown.negotiations;
  return { total: uniqueTotal, breakdown };
}

export function assertPresentationIntegrity(book: PresentationBook = buildPresentationBook()): void {
  const customerIds = new Set(book.customers.map((item) => item.id));
  const productIds = new Set(book.products.map((item) => item.id));
  const warehouseIds = new Set(book.warehouses.map((item) => item.id));
  const chainIds = new Set(book.chains.map((item) => item.id));
  const ids = [
    ...book.customers.map((item) => item.id),
    ...book.products.map((item) => item.id),
    ...book.warehouses.map((item) => item.id),
    ...book.policies.map((item) => item.id),
    ...book.chains.map((item) => item.id),
    ...book.chains.flatMap((chain) => chain.steps.map((step) => step.id)),
    ...book.relations.map((item) => item.id),
    ...book.quantityBreaks.map((item) => item.id),
    ...book.quotes.map((item) => item.id),
    ...book.quotes.flatMap((quote) => [
      ...quote.lines.map((line) => line.id),
      ...quote.approvals.map((item) => item.id),
      ...quote.allocations.map((item) => item.id),
      ...quote.backorders.map((item) => item.id),
      ...quote.schedules.map((item) => item.id),
      ...quote.negotiations.map((item) => item.id),
    ]),
  ];
  if (new Set(ids).size !== ids.length) {
    throw new Error('Presentation book contains duplicate ids');
  }
  for (const id of ids) {
    if (!UUID_PATTERN.test(id)) {
      throw new Error(`Invalid UUID ${id}`);
    }
  }
  for (const row of book.stock) {
    if (!warehouseIds.has(row.warehouseId) || !productIds.has(row.productId)) {
      throw new Error('Stock row references a missing warehouse or product');
    }
  }
  for (const quote of book.quotes) {
    if (!customerIds.has(quote.customerId)) {
      throw new Error(`Quote ${quote.number} has an unknown customer`);
    }
    if (quote.requiredChainId && !chainIds.has(quote.requiredChainId)) {
      throw new Error(`Quote ${quote.number} has an unknown approval chain`);
    }
    if (quote.portalToken.length < 16) {
      throw new Error(`Quote ${quote.number} portal token is too short`);
    }
    const lineIds = new Set(quote.lines.map((line) => line.id));
    for (const line of quote.lines) {
      if (!productIds.has(line.productId)) {
        throw new Error(`Quote ${quote.number} line references a missing product`);
      }
    }
    for (const allocation of quote.allocations) {
      if (!lineIds.has(allocation.quoteLineId) || !warehouseIds.has(allocation.warehouseId)) {
        throw new Error(`Quote ${quote.number} allocation is orphaned`);
      }
    }
    for (const schedule of quote.schedules) {
      if (!lineIds.has(schedule.quoteLineId)) {
        throw new Error(`Quote ${quote.number} schedule is orphaned`);
      }
    }
    for (const backorder of quote.backorders) {
      if (!productIds.has(backorder.productId)) {
        throw new Error(`Quote ${quote.number} backorder is orphaned`);
      }
    }
    for (const negotiation of quote.negotiations) {
      if (!customerIds.has(negotiation.customerId)) {
        throw new Error(`Quote ${quote.number} negotiation is orphaned`);
      }
    }
  }
}
