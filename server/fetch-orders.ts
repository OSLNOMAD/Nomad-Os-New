const CUSTOMER_EMAIL = 'chey_bacca@icloud.com';
const SHOPIFY_STORE = 'nomadinternet';

async function fetchShopifyOrders() {
  console.log('\n=== SHOPIFY ORDERS ===\n');
  
  const apiKey = process.env.SHOPIFY_API_KEY;
  const secretKey = process.env.SHOPIFY_SECRET_KEY;
  
  if (!apiKey || !secretKey) {
    console.log('Missing Shopify credentials');
    return [];
  }

  try {
    const customersUrl = `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/customers/search.json?query=email:${encodeURIComponent(CUSTOMER_EMAIL)}`;
    
    console.log(`Searching for customer: ${CUSTOMER_EMAIL}`);
    console.log(`Using store: ${SHOPIFY_STORE}.myshopify.com`);
    
    const customerResponse = await fetch(customersUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': secretKey
      }
    });

    if (!customerResponse.ok) {
      const errorText = await customerResponse.text();
      console.log(`Shopify customer search failed (${customerResponse.status}): ${errorText}`);
      return [];
    }

    const customerData = await customerResponse.json() as any;
    console.log(`Found ${customerData.customers?.length || 0} customer(s)`);

    if (!customerData.customers || customerData.customers.length === 0) {
      console.log('No customer found with this email in Shopify');
      return [];
    }

    const customer = customerData.customers[0];
    console.log(`\nCustomer Details:`);
    console.log(`  ID: ${customer.id}`);
    console.log(`  Name: ${customer.first_name} ${customer.last_name}`);
    console.log(`  Email: ${customer.email}`);
    console.log(`  Phone: ${customer.phone || 'N/A'}`);
    console.log(`  Orders Count: ${customer.orders_count}`);
    console.log(`  Total Spent: ${customer.total_spent}`);

    const ordersUrl = `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/orders.json?customer_id=${customer.id}&status=any&limit=50`;
    
    const ordersResponse = await fetch(ordersUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': secretKey
      }
    });

    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      console.log(`Shopify orders fetch failed (${ordersResponse.status}): ${errorText}`);
      return [];
    }

    const ordersData = await ordersResponse.json() as any;
    const orders = ordersData.orders || [];
    
    console.log(`\n--- Found ${orders.length} Order(s) ---\n`);

    orders.forEach((order: any, index: number) => {
      console.log(`Order #${index + 1}:`);
      console.log(`  Order Number: ${order.name}`);
      console.log(`  Order ID: ${order.id}`);
      console.log(`  Created: ${order.created_at}`);
      console.log(`  Financial Status: ${order.financial_status}`);
      console.log(`  Fulfillment Status: ${order.fulfillment_status || 'unfulfilled'}`);
      console.log(`  Total: ${order.total_price} ${order.currency}`);
      
      if (order.line_items?.length > 0) {
        console.log(`  Items:`);
        order.line_items.forEach((item: any) => {
          console.log(`    - ${item.name} (x${item.quantity}) - ${item.price}`);
        });
      }
      
      if (order.shipping_address) {
        const addr = order.shipping_address;
        console.log(`  Shipping Address: ${addr.address1}, ${addr.city}, ${addr.province} ${addr.zip}`);
      }
      console.log('');
    });

    return orders;
  } catch (error) {
    console.log(`Shopify API error: ${error}`);
    return [];
  }
}

async function fetchShipstationOrders() {
  console.log('\n=== SHIPSTATION ORDERS ===\n');
  
  const apiKey = process.env.SHIPSTATION_API_KEY;
  const apiSecret = process.env.SHIPSTATION_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    console.log('Missing Shipstation credentials');
    return [];
  }

  try {
    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    
    console.log(`Searching for orders with email: ${CUSTOMER_EMAIL}`);
    console.log('Note: ShipStation API does not filter by email directly, fetching recent orders...\n');

    let allOrders: any[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore && page <= 5) {
      const url = `https://ssapi.shipstation.com/orders?pageSize=${pageSize}&page=${page}&sortBy=OrderDate&sortDir=DESC`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Shipstation API failed (${response.status}): ${errorText}`);
        break;
      }

      const data = await response.json() as any;
      const orders = data.orders || [];
      
      allOrders = allOrders.concat(orders);
      
      console.log(`Fetched page ${page}: ${orders.length} orders (total: ${allOrders.length})`);
      
      if (orders.length < pageSize) {
        hasMore = false;
      }
      page++;
    }

    const customerOrders = allOrders.filter(
      (order: any) => order.customerEmail?.toLowerCase() === CUSTOMER_EMAIL.toLowerCase()
    );

    console.log(`\n--- Found ${customerOrders.length} Order(s) for ${CUSTOMER_EMAIL} ---\n`);

    customerOrders.forEach((order: any, index: number) => {
      console.log(`Order #${index + 1}:`);
      console.log(`  Order Number: ${order.orderNumber}`);
      console.log(`  Order ID: ${order.orderId}`);
      console.log(`  Order Date: ${order.orderDate}`);
      console.log(`  Order Status: ${order.orderStatus}`);
      console.log(`  Order Total: $${order.orderTotal}`);
      console.log(`  Customer: ${order.customerName || 'N/A'}`);
      console.log(`  Email: ${order.customerEmail}`);
      
      if (order.items?.length > 0) {
        console.log(`  Items:`);
        order.items.forEach((item: any) => {
          console.log(`    - ${item.name} (x${item.quantity}) - SKU: ${item.sku || 'N/A'}`);
        });
      }
      
      if (order.shipTo) {
        const addr = order.shipTo;
        console.log(`  Ship To: ${addr.name}`);
        console.log(`  Address: ${addr.street1}, ${addr.city}, ${addr.state} ${addr.postalCode}`);
      }
      
      if (order.shipments?.length > 0) {
        console.log(`  Shipments:`);
        order.shipments.forEach((ship: any) => {
          console.log(`    - Carrier: ${ship.carrierCode}, Tracking: ${ship.trackingNumber || 'N/A'}`);
        });
      }
      console.log('');
    });

    return customerOrders;
  } catch (error) {
    console.log(`Shipstation API error: ${error}`);
    return [];
  }
}

async function main() {
  console.log('=========================================');
  console.log(`Fetching Orders for: ${CUSTOMER_EMAIL}`);
  console.log('=========================================');
  
  const [shopifyOrders, shipstationOrders] = await Promise.all([
    fetchShopifyOrders(),
    fetchShipstationOrders()
  ]);

  console.log('\n=========================================');
  console.log('SUMMARY');
  console.log('=========================================');
  console.log(`Shopify Orders: ${shopifyOrders.length}`);
  console.log(`Shipstation Orders: ${shipstationOrders.length}`);
}

main().catch(console.error);
