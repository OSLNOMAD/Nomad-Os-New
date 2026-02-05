const CHARGEBEE_API_KEY = process.env.CHARGEBEE_API_KEY;
const CHARGEBEE_SITE = process.env.CHARGEBEE_SITE;
const SHOPIFY_ADMIN_KEY = process.env.SHOPIFY_ADMIN_KEY;
const SHIPSTATION_API_KEY = process.env.SHIPSTATION_API_KEY;
const SHIPSTATION_API_SECRET = process.env.SHIPSTATION_API_SECRET;
const THINGSPACE_CLIENT_ID = process.env.THINGSPACE_CLIENT_ID;
const THINGSPACE_CLIENT_SECRET = process.env.THINGSPACE_CLIENT_SECRET;
const THINGSPACE_USERNAME = process.env.THINGSPACE_USERNAME;
const THINGSPACE_PASSWORD = process.env.THINGSPACE_PASSWORD;
const THINGSPACE_ACCOUNT_NAME = process.env.THINGSPACE_ACCOUNT_NAME;

export interface ChargebeeCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  createdAt: string;
  autoCollection: string;
  promotionalCredits: number;
  refundableCredits: number;
  excessPayments: number;
  unbilledCharges: number;
  billingAddress?: {
    firstName: string;
    lastName: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone: string;
  };
  paymentMethod?: {
    type: string;
    status: string;
    gateway: string;
  };
  customFields?: Record<string, string>;
}

export interface ChargebeeSubscription {
  id: string;
  planId: string;
  status: string;
  planAmount: number;
  billingPeriod: number;
  billingPeriodUnit: string;
  createdAt: string;
  startedAt: string;
  activatedAt: string;
  currentTermStart: string;
  currentTermEnd: string;
  nextBillingAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  dueInvoicesCount: number;
  dueSince: string | null;
  totalDues: number;
  mrr: number;
  iccid: string | null;
  imei: string | null;
  mdn: string | null;
  subscriptionItems: Array<{
    itemPriceId: string;
    itemType: string;
    quantity: number;
    amount: number;
    unitPrice: number;
  }>;
  shippingAddress?: {
    line1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export interface ChargebeeInvoice {
  id: string;
  subscriptionId: string | null;
  customerId: string;
  status: string;
  date: string;
  dueDate: string | null;
  paidAt: string | null;
  subTotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  amountAdjusted: number;
  creditsApplied: number;
  amountDue: number;
  writeOffAmount: number;
  dunningStatus: string | null;
  firstInvoice: boolean;
  recurring: boolean;
  currencyCode: string;
  lineItems: Array<{
    description: string;
    amount: number;
    quantity: number;
    entityType: string;
    entityId: string;
  }>;
  linkedPayments: Array<{
    txnId: string;
    txnAmount: number;
    txnDate: string;
    txnStatus: string;
  }>;
  dunningAttempts: Array<{
    attempt: number;
    createdAt: string;
    transactionId: string | null;
  }>;
}

export interface ChargebeeTransaction {
  id: string;
  type: string;
  status: string;
  date: string;
  amount: number;
  currencyCode: string;
  gateway: string;
  paymentMethod: string;
  referenceNumber: string | null;
  idAtGateway: string | null;
  errorCode: string | null;
  errorText: string | null;
  amountUnused: number;
  linkedInvoices: Array<{
    invoiceId: string;
    appliedAmount: number;
    appliedAt: string;
  }>;
}

export interface ChargebeeCustomerWithData extends ChargebeeCustomer {
  subscriptions: ChargebeeSubscription[];
  invoices: ChargebeeInvoice[];
  transactions: ChargebeeTransaction[];
  paymentSources: any[];
}

export interface ChargebeeData {
  customers: ChargebeeCustomerWithData[];
  totalSubscriptions: number;
  totalInvoices: number;
  totalDue: number;
}

export interface ShopifyOrder {
  orderNumber: string;
  orderId: string;
  createdAt: string;
  updatedAt: string;
  email: string;
  phone: string | null;
  financialStatus: string;
  fulfillmentStatus: string;
  total: string;
  subtotal: string;
  totalTax: string;
  totalDiscounts: string;
  totalShipping: string;
  currency: string;
  orderStatusUrl: string;
  tags: string;
  note: string | null;
  source: string;
  gateway: string;
  processingMethod: string;
  noteAttributes: Array<{ name: string; value: string }>;
  lineItems: Array<{
    name: string;
    sku: string;
    quantity: number;
    price: string;
    variantId: string;
    productId: string;
    fulfillmentStatus: string;
    properties: Array<{ name: string; value: string }>;
  }>;
  fulfillments: Array<{
    id: string;
    status: string;
    createdAt: string;
    trackingCompany: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    trackingNumbers: string[];
    trackingUrls: string[];
  }>;
  shippingAddress: {
    firstName: string;
    lastName: string;
    company: string | null;
    address1: string;
    address2: string | null;
    city: string;
    province: string;
    provinceCode: string;
    zip: string;
    country: string;
    countryCode: string;
    phone: string | null;
  } | null;
  billingAddress: {
    firstName: string;
    lastName: string;
    address1: string;
    city: string;
    province: string;
    zip: string;
    country: string;
  } | null;
  shippingLines: Array<{
    title: string;
    price: string;
  }>;
  discountCodes: Array<{
    code: string;
    amount: string;
    type: string;
  }>;
  refunds: any[];
}

export interface ShipstationOrder {
  orderNumber: string;
  orderId: number;
  orderKey: string;
  orderDate: string;
  createDate: string;
  modifyDate: string;
  paymentDate: string | null;
  shipByDate: string | null;
  orderStatus: string;
  orderTotal: number;
  amountPaid: number;
  taxAmount: number;
  shippingAmount: number;
  customerId: number | null;
  customerUsername: string | null;
  customerEmail: string;
  customerNotes: string | null;
  internalNotes: string | null;
  gift: boolean;
  giftMessage: string | null;
  paymentMethod: string | null;
  requestedShippingService: string | null;
  carrierCode: string | null;
  serviceCode: string | null;
  packageCode: string | null;
  confirmation: string | null;
  shipDate: string | null;
  holdUntilDate: string | null;
  customField1: string | null;
  customField2: string | null;
  customField3: string | null;
  imei: string | null;
  iccid: string | null;
  weight: { value: number; units: string } | null;
  dimensions: { length: number; width: number; height: number; units: string } | null;
  insuranceOptions: {
    provider: string | null;
    insureShipment: boolean;
    insuredValue: number;
  } | null;
  advancedOptions: {
    warehouseId: number | null;
    nonMachinable: boolean;
    saturdayDelivery: boolean;
    containsAlcohol: boolean;
    storeId: number | null;
    customField1: string | null;
    customField2: string | null;
    customField3: string | null;
    source: string | null;
    mergedOrSplit: boolean;
    parentId: number | null;
  } | null;
  items: Array<{
    orderItemId: number;
    lineItemKey: string | null;
    sku: string | null;
    name: string;
    imageUrl: string | null;
    quantity: number;
    unitPrice: number;
    taxAmount: number;
    shippingAmount: number;
    warehouseLocation: string | null;
    productId: number | null;
    fulfillmentSku: string | null;
    upc: string | null;
    options: Array<{ name: string; value: string }>;
  }>;
  shipTo: {
    name: string;
    company: string | null;
    street1: string;
    street2: string | null;
    street3: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string | null;
    residential: boolean;
    addressVerified: string | null;
  } | null;
  billTo: {
    name: string;
    company: string | null;
    street1: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    phone: string | null;
  } | null;
  shipments: Array<{
    shipmentId: number;
    orderId: number;
    orderKey: string | null;
    orderNumber: string;
    createDate: string;
    shipDate: string;
    shipmentCost: number;
    insuranceCost: number;
    trackingNumber: string | null;
    carrierCode: string;
    serviceCode: string;
    packageCode: string;
    confirmation: string | null;
    warehouseId: number | null;
    voided: boolean;
    voidDate: string | null;
    marketplaceNotified: boolean;
    weight: { value: number; units: string } | null;
    dimensions: { length: number; width: number; height: number; units: string } | null;
    shipTo: {
      name: string;
      street1: string;
      city: string;
      state: string;
      postalCode: string;
    } | null;
  }>;
}

export interface CombinedOrder {
  source: 'shopify' | 'shipstation' | 'both';
  orderNumber: string;
  orderId: string;
  orderDate: string;
  status: string;
  fulfillmentStatus: string;
  total: number;
  currency: string;
  paymentStatus: string;
  items: Array<{
    name: string;
    sku: string | null;
    quantity: number;
    price: number;
    imageUrl: string | null;
    fulfillmentStatus: string | null;
  }>;
  shipping: {
    name: string;
    address1: string;
    address2: string | null;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone: string | null;
  } | null;
  tracking: Array<{
    carrier: string;
    trackingNumber: string;
    trackingUrl: string | null;
    shipDate: string | null;
    status: string;
  }>;
  imei: string | null;
  iccid: string | null;
  shopifyData?: ShopifyOrder;
  shipstationData?: ShipstationOrder;
}

export interface ThingspaceDevice {
  accountName: string;
  state: string;
  connected: boolean;
  ipAddress: string | null;
  lastConnectionDate: string | null;
  lastActivationDate: string | null;
  billingCycleEndDate: string | null;
  identifiers: {
    mdn: string | null;
    imsi: string | null;
    imei: string | null;
    iccid: string | null;
    msisdn: string | null;
    min: string | null;
  };
  carrier: {
    name: string;
    servicePlan: string;
    state: string;
  } | null;
  extendedAttributes: Record<string, string>;
}

export interface CustomerFullData {
  chargebee: ChargebeeData;
  orders: CombinedOrder[];
  devices: ThingspaceDevice[];
}

async function chargebeeApiGet(endpoint: string): Promise<any> {
  if (!CHARGEBEE_API_KEY || !CHARGEBEE_SITE) return null;
  
  const credentials = Buffer.from(`${CHARGEBEE_API_KEY}:`).toString('base64');
  const response = await fetch(`https://${CHARGEBEE_SITE}.chargebee.com/api/v2${endpoint}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    }
  });
  
  if (!response.ok) return null;
  return response.json();
}

export async function checkChargebeeCustomer(email: string): Promise<{ found: boolean; customer: any | null }> {
  try {
    const customerData = await chargebeeApiGet(`/customers?email[is]=${encodeURIComponent(email)}`);
    if (customerData?.list?.length) {
      return { found: true, customer: customerData.list[0].customer };
    }
    return { found: false, customer: null };
  } catch (error) {
    console.error('Chargebee customer lookup error:', error);
    return { found: false, customer: null };
  }
}

function parseChargebeeCustomer(c: any): ChargebeeCustomer {
  return {
    id: c.id,
    email: c.email,
    firstName: c.first_name || '',
    lastName: c.last_name || '',
    phone: c.phone || '',
    createdAt: c.created_at ? new Date(c.created_at * 1000).toISOString() : '',
    autoCollection: c.auto_collection,
    promotionalCredits: (c.promotional_credits || 0) / 100,
    refundableCredits: (c.refundable_credits || 0) / 100,
    excessPayments: (c.excess_payments || 0) / 100,
    unbilledCharges: (c.unbilled_charges || 0) / 100,
    billingAddress: c.billing_address ? {
      firstName: c.billing_address.first_name || '',
      lastName: c.billing_address.last_name || '',
      line1: c.billing_address.line1 || '',
      line2: c.billing_address.line2 || '',
      city: c.billing_address.city || '',
      state: c.billing_address.state || '',
      zip: c.billing_address.zip || '',
      country: c.billing_address.country || '',
      phone: c.billing_address.phone || ''
    } : undefined,
    paymentMethod: c.payment_method ? {
      type: c.payment_method.type,
      status: c.payment_method.status,
      gateway: c.payment_method.gateway
    } : undefined,
    customFields: Object.fromEntries(
      Object.entries(c).filter(([k]) => k.startsWith('cf_')).map(([k, v]) => [k, String(v)])
    )
  };
}

function parseChargebeeSubscription(s: any): ChargebeeSubscription {
  return {
    id: s.id,
    planId: s.subscription_items?.[0]?.item_price_id || s.plan_id || 'Unknown',
    status: s.status,
    planAmount: (s.subscription_items?.[0]?.amount || s.plan_amount || 0) / 100,
    billingPeriod: s.billing_period,
    billingPeriodUnit: s.billing_period_unit,
    createdAt: s.created_at ? new Date(s.created_at * 1000).toISOString() : '',
    startedAt: s.started_at ? new Date(s.started_at * 1000).toISOString() : '',
    activatedAt: s.activated_at ? new Date(s.activated_at * 1000).toISOString() : '',
    currentTermStart: s.current_term_start ? new Date(s.current_term_start * 1000).toISOString() : '',
    currentTermEnd: s.current_term_end ? new Date(s.current_term_end * 1000).toISOString() : '',
    nextBillingAt: s.next_billing_at ? new Date(s.next_billing_at * 1000).toISOString() : '',
    cancelledAt: s.cancelled_at ? new Date(s.cancelled_at * 1000).toISOString() : null,
    cancelReason: s.cancel_reason || null,
    dueInvoicesCount: s.due_invoices_count || 0,
    dueSince: s.due_since ? new Date(s.due_since * 1000).toISOString() : null,
    totalDues: (s.total_dues || 0) / 100,
    mrr: (s.mrr || 0) / 100,
    iccid: s.cf_SIM_ID_ICCID || null,
    imei: s.cf_Device_IMEI || null,
    mdn: s.cf_mdn || null,
    subscriptionItems: (s.subscription_items || []).map((si: any) => ({
      itemPriceId: si.item_price_id,
      itemType: si.item_type,
      quantity: si.quantity || 1,
      amount: (si.amount || 0) / 100,
      unitPrice: (si.unit_price || 0) / 100
    })),
    shippingAddress: s.shipping_address ? {
      line1: s.shipping_address.line1 || '',
      city: s.shipping_address.city || '',
      state: s.shipping_address.state || '',
      zip: s.shipping_address.zip || '',
      country: s.shipping_address.country || ''
    } : undefined
  };
}

function parseChargebeeInvoice(inv: any): ChargebeeInvoice {
  return {
    id: inv.id,
    subscriptionId: inv.subscription_id || null,
    customerId: inv.customer_id || '',
    status: inv.status,
    date: inv.date ? new Date(inv.date * 1000).toISOString() : '',
    dueDate: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
    paidAt: inv.paid_at ? new Date(inv.paid_at * 1000).toISOString() : null,
    subTotal: (inv.sub_total || 0) / 100,
    tax: (inv.tax || 0) / 100,
    total: (inv.total || 0) / 100,
    amountPaid: (inv.amount_paid || 0) / 100,
    amountAdjusted: (inv.amount_adjusted || 0) / 100,
    creditsApplied: (inv.credits_applied || 0) / 100,
    amountDue: (inv.amount_due || 0) / 100,
    writeOffAmount: (inv.write_off_amount || 0) / 100,
    dunningStatus: inv.dunning_status || null,
    firstInvoice: inv.first_invoice || false,
    recurring: inv.recurring || false,
    currencyCode: inv.currency_code || 'USD',
    lineItems: (inv.line_items || []).map((li: any) => ({
      description: li.description || '',
      amount: (li.amount || 0) / 100,
      quantity: li.quantity || 1,
      entityType: li.entity_type || '',
      entityId: li.entity_id || ''
    })),
    linkedPayments: (inv.linked_payments || []).map((lp: any) => ({
      txnId: lp.txn_id,
      txnAmount: (lp.txn_amount || 0) / 100,
      txnDate: lp.txn_date ? new Date(lp.txn_date * 1000).toISOString() : '',
      txnStatus: lp.txn_status
    })),
    dunningAttempts: (inv.dunning_attempts || []).map((da: any) => ({
      attempt: da.attempt,
      createdAt: da.created_at ? new Date(da.created_at * 1000).toISOString() : '',
      transactionId: da.transaction_id || null
    }))
  };
}

function parseChargebeeTransaction(txn: any): ChargebeeTransaction {
  return {
    id: txn.id,
    type: txn.type,
    status: txn.status,
    date: txn.date ? new Date(txn.date * 1000).toISOString() : '',
    amount: (txn.amount || 0) / 100,
    currencyCode: txn.currency_code || 'USD',
    gateway: txn.gateway || '',
    paymentMethod: txn.payment_method || '',
    referenceNumber: txn.reference_number || null,
    idAtGateway: txn.id_at_gateway || null,
    errorCode: txn.error_code || null,
    errorText: txn.error_text || null,
    amountUnused: (txn.amount_unused || 0) / 100,
    linkedInvoices: (txn.linked_invoices || []).map((li: any) => ({
      invoiceId: li.invoice_id,
      appliedAmount: (li.applied_amount || 0) / 100,
      appliedAt: li.applied_at ? new Date(li.applied_at * 1000).toISOString() : ''
    }))
  };
}

export async function fetchChargebeeData(email: string): Promise<ChargebeeData> {
  const result: ChargebeeData = {
    customers: [],
    totalSubscriptions: 0,
    totalInvoices: 0,
    totalDue: 0
  };
  
  try {
    const customerData = await chargebeeApiGet(`/customers?email[is]=${encodeURIComponent(email)}&limit=100`);
    if (!customerData?.list?.length) return result;
    
    const customersWithData: ChargebeeCustomerWithData[] = [];
    
    for (const item of customerData.list) {
      const c = item.customer;
      const customer = parseChargebeeCustomer(c);
      
      const [subsData, invoicesData, txnData, paymentSourcesData] = await Promise.all([
        chargebeeApiGet(`/subscriptions?customer_id[is]=${c.id}&limit=50`),
        chargebeeApiGet(`/invoices?customer_id[is]=${c.id}&limit=50&sort_by[desc]=date`),
        chargebeeApiGet(`/transactions?customer_id[is]=${c.id}&limit=50&sort_by[desc]=date`),
        chargebeeApiGet(`/payment_sources?customer_id[is]=${c.id}`)
      ]);
      
      const subscriptions = subsData?.list?.map((i: any) => parseChargebeeSubscription(i.subscription)) || [];
      const invoices = invoicesData?.list?.map((i: any) => parseChargebeeInvoice(i.invoice)) || [];
      const transactions = txnData?.list?.map((i: any) => parseChargebeeTransaction(i.transaction)) || [];
      const paymentSources = paymentSourcesData?.list || [];
      
      const customerWithData: ChargebeeCustomerWithData = {
        ...customer,
        subscriptions,
        invoices,
        transactions,
        paymentSources
      };
      
      customersWithData.push(customerWithData);
      
      result.totalSubscriptions += subscriptions.length;
      result.totalInvoices += invoices.length;
      result.totalDue += invoices.reduce((sum, inv) => sum + inv.amountDue, 0);
    }
    
    customersWithData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    result.customers = customersWithData;
    
  } catch (error) {
    console.error('Chargebee fetch error:', error);
  }
  
  return result;
}

export async function fetchShopifyOrders(email: string): Promise<ShopifyOrder[]> {
  if (!SHOPIFY_ADMIN_KEY) return [];
  
  try {
    const response = await fetch(
      `https://nomadinternet.myshopify.com/admin/api/2024-01/orders.json?status=any&email=${encodeURIComponent(email)}&limit=250`,
      {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_KEY,
          'Content-Type': 'application/json',
        }
      }
    );
    
    if (!response.ok) return [];
    
    const data = await response.json() as any;
    const orders = data.orders || [];
    
    return orders.map((o: any) => ({
      orderNumber: o.name,
      orderId: String(o.id),
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      email: o.email,
      phone: o.phone || null,
      financialStatus: o.financial_status,
      fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
      total: o.total_price,
      subtotal: o.subtotal_price,
      totalTax: o.total_tax,
      totalDiscounts: o.total_discounts,
      totalShipping: o.total_shipping_price_set?.shop_money?.amount || '0.00',
      currency: o.currency,
      orderStatusUrl: o.order_status_url || '',
      tags: o.tags || '',
      note: o.note || null,
      source: o.source_name || '',
      gateway: o.gateway || '',
      processingMethod: o.processing_method || '',
      noteAttributes: (o.note_attributes || []).map((a: any) => ({ name: a.name, value: a.value })),
      lineItems: (o.line_items || []).map((li: any) => ({
        name: li.name,
        sku: li.sku || '',
        quantity: li.quantity,
        price: li.price,
        variantId: String(li.variant_id || ''),
        productId: String(li.product_id || ''),
        fulfillmentStatus: li.fulfillment_status || 'unfulfilled',
        properties: (li.properties || []).map((p: any) => ({ name: p.name, value: p.value }))
      })),
      fulfillments: (o.fulfillments || []).map((f: any) => ({
        id: String(f.id),
        status: f.status,
        createdAt: f.created_at,
        trackingCompany: f.tracking_company || null,
        trackingNumber: f.tracking_number || null,
        trackingUrl: f.tracking_url || null,
        trackingNumbers: f.tracking_numbers || [],
        trackingUrls: f.tracking_urls || []
      })),
      shippingAddress: o.shipping_address ? {
        firstName: o.shipping_address.first_name || '',
        lastName: o.shipping_address.last_name || '',
        company: o.shipping_address.company || null,
        address1: o.shipping_address.address1 || '',
        address2: o.shipping_address.address2 || null,
        city: o.shipping_address.city || '',
        province: o.shipping_address.province || '',
        provinceCode: o.shipping_address.province_code || '',
        zip: o.shipping_address.zip || '',
        country: o.shipping_address.country || '',
        countryCode: o.shipping_address.country_code || '',
        phone: o.shipping_address.phone || null
      } : null,
      billingAddress: o.billing_address ? {
        firstName: o.billing_address.first_name || '',
        lastName: o.billing_address.last_name || '',
        address1: o.billing_address.address1 || '',
        city: o.billing_address.city || '',
        province: o.billing_address.province || '',
        zip: o.billing_address.zip || '',
        country: o.billing_address.country || ''
      } : null,
      shippingLines: (o.shipping_lines || []).map((sl: any) => ({
        title: sl.title,
        price: sl.price
      })),
      discountCodes: (o.discount_codes || []).map((dc: any) => ({
        code: dc.code,
        amount: dc.amount,
        type: dc.type
      })),
      refunds: o.refunds || []
    }));
  } catch (error) {
    console.error('Shopify fetch error:', error);
    return [];
  }
}

export async function fetchShipstationOrdersByNumbers(orderNumbers: string[]): Promise<ShipstationOrder[]> {
  if (!SHIPSTATION_API_KEY || !SHIPSTATION_API_SECRET || orderNumbers.length === 0) return [];
  
  try {
    const credentials = Buffer.from(`${SHIPSTATION_API_KEY}:${SHIPSTATION_API_SECRET}`).toString('base64');
    let allOrders: any[] = [];
    
    const limitedOrderNumbers = orderNumbers.slice(0, 20);
    
    const fetchOrder = async (orderNumber: string) => {
      const cleanOrderNumber = orderNumber.replace('#', '');
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(
          `https://ssapi.shipstation.com/orders?orderNumber=${encodeURIComponent(cleanOrderNumber)}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${credentials}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal
          }
        );
        clearTimeout(timeoutId);
        if (!response.ok) return [];
        const data = await response.json() as any;
        return data.orders || [];
      } catch {
        return [];
      }
    };
    
    const results = await Promise.all(limitedOrderNumbers.map(fetchOrder));
    allOrders = results.flat();
    
    const customerOrders = allOrders;
    
    return customerOrders.map((o: any) => ({
      orderNumber: o.orderNumber,
      orderId: o.orderId,
      orderKey: o.orderKey,
      orderDate: o.orderDate,
      createDate: o.createDate,
      modifyDate: o.modifyDate,
      paymentDate: o.paymentDate || null,
      shipByDate: o.shipByDate || null,
      orderStatus: o.orderStatus,
      orderTotal: o.orderTotal,
      amountPaid: o.amountPaid || 0,
      taxAmount: o.taxAmount || 0,
      shippingAmount: o.shippingAmount || 0,
      customerId: o.customerId || null,
      customerUsername: o.customerUsername || null,
      customerEmail: o.customerEmail,
      customerNotes: o.customerNotes || null,
      internalNotes: o.internalNotes || null,
      gift: o.gift || false,
      giftMessage: o.giftMessage || null,
      paymentMethod: o.paymentMethod || null,
      requestedShippingService: o.requestedShippingService || null,
      carrierCode: o.carrierCode || null,
      serviceCode: o.serviceCode || null,
      packageCode: o.packageCode || null,
      confirmation: o.confirmation || null,
      shipDate: o.shipDate || null,
      holdUntilDate: o.holdUntilDate || null,
      customField1: o.advancedOptions?.customField1 || null,
      customField2: o.advancedOptions?.customField2 || null,
      customField3: o.advancedOptions?.customField3 || null,
      imei: o.advancedOptions?.customField1 || null,
      iccid: o.advancedOptions?.customField2 || null,
      weight: o.weight || null,
      dimensions: o.dimensions || null,
      insuranceOptions: o.insuranceOptions || null,
      advancedOptions: o.advancedOptions || null,
      items: (o.items || []).map((i: any) => ({
        orderItemId: i.orderItemId,
        lineItemKey: i.lineItemKey || null,
        sku: i.sku || null,
        name: i.name,
        imageUrl: i.imageUrl || null,
        quantity: i.quantity,
        unitPrice: i.unitPrice || 0,
        taxAmount: i.taxAmount || 0,
        shippingAmount: i.shippingAmount || 0,
        warehouseLocation: i.warehouseLocation || null,
        productId: i.productId || null,
        fulfillmentSku: i.fulfillmentSku || null,
        upc: i.upc || null,
        options: (i.options || []).map((opt: any) => ({ name: opt.name, value: opt.value }))
      })),
      shipTo: o.shipTo ? {
        name: o.shipTo.name,
        company: o.shipTo.company || null,
        street1: o.shipTo.street1,
        street2: o.shipTo.street2 || null,
        street3: o.shipTo.street3 || null,
        city: o.shipTo.city,
        state: o.shipTo.state,
        postalCode: o.shipTo.postalCode,
        country: o.shipTo.country,
        phone: o.shipTo.phone || null,
        residential: o.shipTo.residential || false,
        addressVerified: o.shipTo.addressVerified || null
      } : null,
      billTo: o.billTo ? {
        name: o.billTo.name,
        company: o.billTo.company || null,
        street1: o.billTo.street1 || null,
        city: o.billTo.city || null,
        state: o.billTo.state || null,
        postalCode: o.billTo.postalCode || null,
        country: o.billTo.country || null,
        phone: o.billTo.phone || null
      } : null,
      shipments: (o.shipments || []).map((s: any) => ({
        shipmentId: s.shipmentId,
        orderId: s.orderId,
        orderKey: s.orderKey || null,
        orderNumber: s.orderNumber,
        createDate: s.createDate,
        shipDate: s.shipDate,
        shipmentCost: s.shipmentCost || 0,
        insuranceCost: s.insuranceCost || 0,
        trackingNumber: s.trackingNumber || null,
        carrierCode: s.carrierCode,
        serviceCode: s.serviceCode,
        packageCode: s.packageCode,
        confirmation: s.confirmation || null,
        warehouseId: s.warehouseId || null,
        voided: s.voided || false,
        voidDate: s.voidDate || null,
        marketplaceNotified: s.marketplaceNotified || false,
        weight: s.weight || null,
        dimensions: s.dimensions || null,
        shipTo: s.shipTo ? {
          name: s.shipTo.name,
          street1: s.shipTo.street1,
          city: s.shipTo.city,
          state: s.shipTo.state,
          postalCode: s.shipTo.postalCode
        } : null
      }))
    }));
  } catch (error) {
    console.error('Shipstation fetch error:', error);
    return [];
  }
}

export function combineOrders(shopifyOrders: ShopifyOrder[], shipstationOrders: ShipstationOrder[]): CombinedOrder[] {
  const combined: CombinedOrder[] = [];
  const processedShipstation = new Set<string>();
  
  for (const so of shopifyOrders) {
    const orderNum = so.orderNumber.replace('#', '');
    const matchingSS = shipstationOrders.find(ss => ss.orderNumber === orderNum || ss.orderNumber === so.orderNumber);
    
    if (matchingSS) {
      processedShipstation.add(String(matchingSS.orderId));
    }
    
    const tracking: CombinedOrder['tracking'] = [];
    
    for (const f of so.fulfillments) {
      if (f.trackingNumber) {
        tracking.push({
          carrier: f.trackingCompany || 'Unknown',
          trackingNumber: f.trackingNumber,
          trackingUrl: f.trackingUrl || null,
          shipDate: f.createdAt,
          status: f.status
        });
      }
    }
    
    if (matchingSS?.shipments) {
      for (const s of matchingSS.shipments) {
        if (s.trackingNumber && !tracking.find(t => t.trackingNumber === s.trackingNumber)) {
          tracking.push({
            carrier: s.carrierCode,
            trackingNumber: s.trackingNumber,
            trackingUrl: null,
            shipDate: s.shipDate,
            status: s.voided ? 'voided' : 'shipped'
          });
        }
      }
    }
    
    combined.push({
      source: matchingSS ? 'both' : 'shopify',
      orderNumber: so.orderNumber,
      orderId: so.orderId,
      orderDate: so.createdAt,
      status: matchingSS?.orderStatus || so.fulfillmentStatus,
      fulfillmentStatus: so.fulfillmentStatus,
      total: parseFloat(so.total),
      currency: so.currency,
      paymentStatus: so.financialStatus,
      items: so.lineItems.map(li => ({
        name: li.name,
        sku: li.sku || null,
        quantity: li.quantity,
        price: parseFloat(li.price),
        imageUrl: null,
        fulfillmentStatus: li.fulfillmentStatus
      })),
      shipping: so.shippingAddress ? {
        name: `${so.shippingAddress.firstName} ${so.shippingAddress.lastName}`,
        address1: so.shippingAddress.address1,
        address2: so.shippingAddress.address2,
        city: so.shippingAddress.city,
        state: so.shippingAddress.province,
        zip: so.shippingAddress.zip,
        country: so.shippingAddress.country,
        phone: so.shippingAddress.phone
      } : null,
      tracking,
      imei: matchingSS?.imei || null,
      iccid: matchingSS?.iccid || null,
      shopifyData: so,
      shipstationData: matchingSS
    });
  }
  
  combined.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  
  return combined;
}

async function getThingspaceTokens(): Promise<{ oauth: string; session: string } | null> {
  if (!THINGSPACE_CLIENT_ID || !THINGSPACE_CLIENT_SECRET || !THINGSPACE_USERNAME || !THINGSPACE_PASSWORD) {
    return null;
  }
  
  try {
    const credentials = Buffer.from(`${THINGSPACE_CLIENT_ID}:${THINGSPACE_CLIENT_SECRET}`).toString('base64');
    
    const oauthResponse = await fetch('https://thingspace.verizon.com/api/ts/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    });
    
    if (!oauthResponse.ok) return null;
    
    const oauthData = await oauthResponse.json() as any;
    const oauthToken = oauthData.access_token;
    
    const sessionResponse = await fetch('https://thingspace.verizon.com/api/m2m/v1/session/login', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${oauthToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: THINGSPACE_USERNAME,
        password: THINGSPACE_PASSWORD
      })
    });
    
    if (!sessionResponse.ok) return null;
    
    const sessionData = await sessionResponse.json() as any;
    
    return { oauth: oauthToken, session: sessionData.sessionToken };
  } catch (error) {
    console.error('ThingSpace auth error:', error);
    return null;
  }
}

export async function fetchThingspaceDevice(iccid: string): Promise<ThingspaceDevice | null> {
  if (!THINGSPACE_ACCOUNT_NAME) return null;
  
  const tokens = await getThingspaceTokens();
  if (!tokens) return null;
  
  try {
    const response = await fetch('https://thingspace.verizon.com/api/m2m/v1/devices/actions/list', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.oauth}`,
        'VZ-M2M-Token': tokens.session,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountName: THINGSPACE_ACCOUNT_NAME,
        filter: {
          deviceIdentifierFilters: [
            { kind: 'iccid', contains: iccid }
          ]
        }
      })
    });
    
    if (!response.ok) {
      console.error('ThingSpace API error:', response.status);
      return null;
    }
    
    const data = await response.json() as any;
    const devices = data.devices || [];
    
    if (!devices.length) return null;
    
    const device = devices[0];
    
    const getDeviceId = (kind: string) => {
      const found = device.deviceIds?.find((id: any) => 
        id.kind.toLowerCase() === kind.toLowerCase()
      );
      return found?.id || null;
    };
    
    const extendedAttrs: Record<string, string> = {};
    for (const attr of device.extendedAttributes || []) {
      extendedAttrs[attr.key] = attr.value;
    }
    
    return {
      accountName: device.accountName,
      state: device.state || 'unknown',
      connected: device.connected || false,
      ipAddress: device.ipAddress || null,
      lastConnectionDate: device.lastConnectionDate || null,
      lastActivationDate: device.lastActivationDate || null,
      billingCycleEndDate: device.billingCycleEndDate || null,
      identifiers: {
        mdn: getDeviceId('mdn'),
        imsi: getDeviceId('imsi'),
        imei: getDeviceId('imei'),
        iccid: getDeviceId('iccid'),
        msisdn: getDeviceId('msisdn'),
        min: getDeviceId('min')
      },
      carrier: device.carrierInformations?.[0] ? {
        name: device.carrierInformations[0].carrierName,
        servicePlan: device.carrierInformations[0].servicePlan,
        state: device.carrierInformations[0].state
      } : null,
      extendedAttributes: extendedAttrs
    };
  } catch (error) {
    console.error('ThingSpace fetch error:', error);
    return null;
  }
}

export async function fetchCustomerFullData(email: string): Promise<CustomerFullData> {
  const [chargebee, shopifyOrders] = await Promise.all([
    fetchChargebeeData(email),
    fetchShopifyOrders(email)
  ]);
  
  const orderNumbers = shopifyOrders.map(o => o.orderNumber);
  const shipstationOrders = await fetchShipstationOrdersByNumbers(orderNumbers);
  
  const orders = combineOrders(shopifyOrders, shipstationOrders);
  
  const devices: ThingspaceDevice[] = [];
  const iccidsToCheck = new Set<string>();
  
  for (const customer of chargebee.customers) {
    for (const sub of customer.subscriptions) {
      if (sub.iccid && sub.iccid !== 'pending' && sub.iccid !== 'redemption_pending') {
        iccidsToCheck.add(sub.iccid);
      }
    }
  }
  
  const deviceResults = await Promise.all(
    [...iccidsToCheck].map(async (iccid) => {
      try {
        return await fetchThingspaceDevice(iccid);
      } catch {
        return null;
      }
    })
  );
  devices.push(...deviceResults.filter((d): d is ThingspaceDevice => d !== null));
  
  return {
    chargebee,
    orders,
    devices
  };
}

async function chargebeeApiPost(endpoint: string, data: Record<string, string>): Promise<any> {
  if (!CHARGEBEE_API_KEY || !CHARGEBEE_SITE) return null;
  
  const credentials = Buffer.from(`${CHARGEBEE_API_KEY}:`).toString('base64');
  const formData = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }
  
  const response = await fetch(`https://${CHARGEBEE_SITE}.chargebee.com/api/v2${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString()
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('Chargebee API error:', error);
    return null;
  }
  return response.json();
}

export async function createCollectNowHostedPage(customerId: string, redirectUrl: string): Promise<{ url: string } | null> {
  try {
    const result = await chargebeeApiPost('/hosted_pages/collect_now', {
      'customer[id]': customerId,
      'redirect_url': redirectUrl
    });
    
    if (result?.hosted_page?.url) {
      return { url: result.hosted_page.url };
    }
    return null;
  } catch (error) {
    console.error('Error creating collect_now hosted page:', error);
    return null;
  }
}

export async function createUpdatePaymentMethodHostedPage(customerId: string, redirectUrl: string): Promise<{ url: string } | null> {
  try {
    const result = await chargebeeApiPost('/hosted_pages/manage_payment_sources', {
      'customer[id]': customerId,
      'redirect_url': redirectUrl
    });
    
    if (result?.hosted_page?.url) {
      return { url: result.hosted_page.url };
    }
    return null;
  } catch (error) {
    console.error('Error creating update_payment_method hosted page:', error);
    return null;
  }
}

export async function collectPaymentForInvoice(invoiceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await chargebeeApiPost(`/invoices/${invoiceId}/collect_payment`, {});
    
    if (result?.invoice) {
      return { success: true };
    }
    return { success: false, error: 'Payment collection failed' };
  } catch (error: any) {
    console.error('Error collecting payment:', error);
    return { success: false, error: error.message || 'Payment collection failed' };
  }
}

export async function getInvoicePdfUrl(invoiceId: string): Promise<{ url: string; validTill: string } | null> {
  try {
    const result = await chargebeeApiPost(`/invoices/${invoiceId}/pdf`, {});
    
    if (result?.download?.download_url) {
      return { 
        url: result.download.download_url,
        validTill: result.download.valid_till ? new Date(result.download.valid_till * 1000).toISOString() : ''
      };
    }
    return null;
  } catch (error: any) {
    console.error('Error getting invoice PDF URL:', error);
    return null;
  }
}

export interface ResumeDeviceResult {
  success: boolean;
  requestId?: string;
  error?: string;
  deviceState?: string;
}

export async function suspendDevice(identifier: string, identifierType: 'iccid' | 'imei' | 'mdn' = 'iccid'): Promise<ResumeDeviceResult> {
  if (!THINGSPACE_ACCOUNT_NAME) {
    return { success: false, error: 'ThingSpace account not configured' };
  }
  
  const tokens = await getThingspaceTokens();
  if (!tokens) {
    return { success: false, error: 'Failed to authenticate with ThingSpace' };
  }
  
  try {
    const response = await fetch('https://thingspace.verizon.com/api/m2m/v1/devices/actions/suspend', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.oauth}`,
        'VZ-M2M-Token': tokens.session,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountName: THINGSPACE_ACCOUNT_NAME,
        devices: [
          {
            deviceIds: [
              {
                id: identifier,
                kind: identifierType
              }
            ]
          }
        ]
      })
    });
    
    const responseText = await response.text();
    console.log('ThingSpace suspend response:', response.status, responseText);
    
    if (!response.ok) {
      return { success: false, error: `ThingSpace API error: ${response.status}` };
    }
    
    const data = JSON.parse(responseText);
    return { 
      success: true, 
      requestId: data.requestId,
      deviceState: 'suspend_pending'
    };
  } catch (error: any) {
    console.error('Error suspending device:', error);
    return { success: false, error: error.message || 'Failed to suspend device' };
  }
}

export async function resumeDevice(identifier: string, identifierType: 'iccid' | 'imei' | 'mdn' = 'iccid'): Promise<ResumeDeviceResult> {
  if (!THINGSPACE_ACCOUNT_NAME) {
    return { success: false, error: 'ThingSpace account not configured' };
  }
  
  const tokens = await getThingspaceTokens();
  if (!tokens) {
    return { success: false, error: 'Failed to authenticate with ThingSpace' };
  }
  
  try {
    const response = await fetch('https://thingspace.verizon.com/api/m2m/v1/devices/actions/restore', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.oauth}`,
        'VZ-M2M-Token': tokens.session,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountName: THINGSPACE_ACCOUNT_NAME,
        devices: [
          {
            deviceIds: [
              {
                id: identifier,
                kind: identifierType
              }
            ]
          }
        ]
      })
    });
    
    const responseText = await response.text();
    console.log('ThingSpace restore response:', response.status, responseText);
    
    if (!response.ok) {
      return { success: false, error: `ThingSpace API error: ${response.status}` };
    }
    
    const data = JSON.parse(responseText);
    return { 
      success: true, 
      requestId: data.requestId,
      deviceState: 'restore_pending'
    };
  } catch (error: any) {
    console.error('Error resuming device:', error);
    return { success: false, error: error.message || 'Failed to resume device' };
  }
}

export async function getDeviceStatus(identifier: string, identifierType: 'iccid' | 'imei' | 'mdn' = 'iccid'): Promise<ThingspaceDevice | null> {
  if (!THINGSPACE_ACCOUNT_NAME) return null;
  
  const tokens = await getThingspaceTokens();
  if (!tokens) return null;
  
  try {
    const response = await fetch('https://thingspace.verizon.com/api/m2m/v1/devices/actions/list', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.oauth}`,
        'VZ-M2M-Token': tokens.session,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountName: THINGSPACE_ACCOUNT_NAME,
        filter: {
          deviceIdentifierFilters: [
            { kind: identifierType, contains: identifier }
          ]
        }
      })
    });
    
    if (!response.ok) return null;
    
    const data = await response.json() as any;
    const devices = data.devices || [];
    
    if (!devices.length) return null;
    
    const device = devices[0];
    
    const getDeviceId = (kind: string) => {
      const found = device.deviceIds?.find((id: any) => 
        id.kind.toLowerCase() === kind.toLowerCase()
      );
      return found?.id || null;
    };
    
    const extendedAttrs: Record<string, string> = {};
    for (const attr of device.extendedAttributes || []) {
      extendedAttrs[attr.key] = attr.value;
    }
    
    return {
      accountName: device.accountName,
      state: device.state || 'unknown',
      connected: device.connected || false,
      ipAddress: device.ipAddress || null,
      lastConnectionDate: device.lastConnectionDate || null,
      lastActivationDate: device.lastActivationDate || null,
      billingCycleEndDate: device.billingCycleEndDate || null,
      identifiers: {
        mdn: getDeviceId('mdn'),
        imsi: getDeviceId('imsi'),
        imei: getDeviceId('imei'),
        iccid: getDeviceId('iccid'),
        msisdn: getDeviceId('msisdn'),
        min: getDeviceId('min'),
      },
      carrier: device.carrierInformations?.[0] ? {
        name: device.carrierInformations[0].carrierName || '',
        servicePlan: device.carrierInformations[0].servicePlan || '',
        state: device.carrierInformations[0].state || '',
      } : null,
      extendedAttributes: extendedAttrs,
    };
  } catch (error) {
    console.error('Error getting device status:', error);
    return null;
  }
}

export interface ServicePlan {
  name: string;
  code: string;
  sizeKb: number;
  carrierServicePlanCode: string;
}

export async function getAvailablePlans(): Promise<ServicePlan[] | null> {
  if (!THINGSPACE_ACCOUNT_NAME) return null;
  
  const tokens = await getThingspaceTokens();
  if (!tokens) return null;
  
  try {
    const response = await fetch(`https://thingspace.verizon.com/api/m2m/v1/plans/${THINGSPACE_ACCOUNT_NAME}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokens.oauth}`,
        'VZ-M2M-Token': tokens.session,
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.error('ThingSpace get plans error:', response.status);
      return null;
    }
    
    const data = await response.json() as any;
    return data || [];
  } catch (error) {
    console.error('Error getting available plans:', error);
    return null;
  }
}

export interface ChangePlanResult {
  success: boolean;
  error?: string;
  requestId?: string;
}

export interface ScheduleSubscriptionChangeResult {
  success: boolean;
  error?: string;
  nextBillingDate?: string;
  subscriptionId?: string;
}

export async function scheduleSubscriptionPlanChange(
  subscriptionId: string,
  newPlanId: string
): Promise<ScheduleSubscriptionChangeResult> {
  if (!CHARGEBEE_API_KEY || !CHARGEBEE_SITE) {
    return { success: false, error: 'Chargebee not configured' };
  }
  
  try {
    const credentials = Buffer.from(`${CHARGEBEE_API_KEY}:`).toString('base64');
    const formData = new URLSearchParams();
    
    // Product Catalog 2.0: Use subscription_items instead of plan_id
    // Replace the plan item with the new plan (item_price_id format)
    formData.append('subscription_items[item_price_id][0]', newPlanId);
    formData.append('subscription_items[quantity][0]', '1');
    formData.append('replace_items_list', 'true');
    formData.append('end_of_term', 'true');
    
    const response = await fetch(`https://${CHARGEBEE_SITE}.chargebee.com/api/v2/subscriptions/${subscriptionId}/update_subscription_for_items`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });
    
    const responseText = await response.text();
    console.log('Chargebee subscription update response:', response.status);
    
    if (!response.ok) {
      let errorMessage = `Chargebee API error: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {}
      return { success: false, error: errorMessage };
    }
    
    const data = JSON.parse(responseText);
    const nextBillingDate = data.subscription?.current_term_end 
      ? new Date(data.subscription.current_term_end * 1000).toISOString()
      : undefined;
    
    return { 
      success: true, 
      subscriptionId: data.subscription?.id,
      nextBillingDate
    };
  } catch (error: any) {
    console.error('Error scheduling subscription plan change:', error);
    return { success: false, error: error.message || 'Failed to schedule plan change' };
  }
}

export interface AddCommentResult {
  success: boolean;
  error?: string;
}

export async function addChargebeeCustomerComment(
  customerId: string,
  comment: string
): Promise<AddCommentResult> {
  if (!CHARGEBEE_API_KEY || !CHARGEBEE_SITE) {
    return { success: false, error: 'Chargebee not configured' };
  }
  
  try {
    const credentials = Buffer.from(`${CHARGEBEE_API_KEY}:`).toString('base64');
    const formData = new URLSearchParams();
    formData.append('entity_type', 'customer');
    formData.append('entity_id', customerId);
    formData.append('notes', comment);
    
    const response = await fetch(`https://${CHARGEBEE_SITE}.chargebee.com/api/v2/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Chargebee comment error:', errorText);
      return { success: false, error: `Failed to add comment: ${response.status}` };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Error adding Chargebee comment:', error);
    return { success: false, error: error.message || 'Failed to add comment' };
  }
}

export async function changeDevicePlan(
  identifier: string, 
  identifierType: 'iccid' | 'imei' | 'mdn',
  currentPlan: string,
  newPlan: string
): Promise<ChangePlanResult> {
  if (!THINGSPACE_ACCOUNT_NAME) {
    return { success: false, error: 'ThingSpace account not configured' };
  }
  
  const tokens = await getThingspaceTokens();
  if (!tokens) {
    return { success: false, error: 'Failed to authenticate with ThingSpace' };
  }
  
  try {
    // ThingSpace API requires either devices array OR filter criteria (like currentServicePlan), not both
    const response = await fetch('https://thingspace.verizon.com/api/m2m/v1/devices/actions/plan', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${tokens.oauth}`,
        'VZ-M2M-Token': tokens.session,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountName: THINGSPACE_ACCOUNT_NAME,
        devices: [
          {
            deviceIds: [
              {
                id: identifier,
                kind: identifierType
              }
            ]
          }
        ],
        servicePlan: newPlan
      })
    });
    
    const responseText = await response.text();
    console.log('ThingSpace change plan response:', response.status, responseText);
    
    if (!response.ok) {
      let errorMessage = `ThingSpace API error: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.errorMessage) {
          errorMessage = errorData.errorMessage;
        }
      } catch {}
      return { success: false, error: errorMessage };
    }
    
    const data = JSON.parse(responseText);
    return { 
      success: true, 
      requestId: data.requestId
    };
  } catch (error: any) {
    console.error('Error changing device plan:', error);
    return { success: false, error: error.message || 'Failed to change plan' };
  }
}
