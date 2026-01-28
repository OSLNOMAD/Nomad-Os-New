const EMAIL = "yatestania44@gmail.com";

const CHARGEBEE_API_KEY = process.env.CHARGEBEE_API_KEY;
const CHARGEBEE_SITE = process.env.CHARGEBEE_SITE;

const BASE_URL = `https://${CHARGEBEE_SITE}.chargebee.com/api/v2`;

async function main() {
  console.log("=========================================");
  console.log(`Detailed Check: ${EMAIL}`);
  console.log("=========================================\n");
  
  const credentials = Buffer.from(`${CHARGEBEE_API_KEY}:`).toString('base64');
  
  const customerUrl = `${BASE_URL}/customers?email[is]=${encodeURIComponent(EMAIL)}`;
  const customerResponse = await fetch(customerUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    }
  });
  
  const customerData = await customerResponse.json() as any;
  const customer = customerData.list?.[0]?.customer;
  
  if (!customer) {
    console.log("Customer not found");
    return;
  }
  
  console.log("=== CUSTOMER ===");
  console.log(JSON.stringify(customer, null, 2));
  
  const subUrl = `${BASE_URL}/subscriptions?customer_id[is]=${encodeURIComponent(customer.id)}`;
  const subResponse = await fetch(subUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    }
  });
  
  const subData = await subResponse.json() as any;
  
  console.log("\n=== SUBSCRIPTIONS (RAW) ===");
  console.log(JSON.stringify(subData.list, null, 2));
  
  for (const item of subData.list || []) {
    const sub = item.subscription;
    console.log("\n=== SUBSCRIPTION PAYMENT DETAILS ===");
    console.log(`ID: ${sub.id}`);
    console.log(`Status: ${sub.status}`);
    console.log(`Due Invoices Count: ${sub.due_invoices_count}`);
    console.log(`Due Since: ${sub.due_since ? new Date(sub.due_since * 1000).toISOString() : 'N/A'}`);
    console.log(`Total Dues: $${((sub.total_dues || 0) / 100).toFixed(2)}`);
    console.log(`Override Relationship: ${sub.override_relationship || 'N/A'}`);
  }
  
  const invoicesUrl = `${BASE_URL}/invoices?customer_id[is]=${encodeURIComponent(customer.id)}&status[in]=[not_paid,payment_due,posted]&limit=20`;
  const invoicesResponse = await fetch(invoicesUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    }
  });
  
  const invoicesData = await invoicesResponse.json() as any;
  
  console.log("\n=== UNPAID/DUE INVOICES ===");
  if (invoicesData.list?.length > 0) {
    for (const item of invoicesData.list) {
      const inv = item.invoice;
      console.log(`\nInvoice: ${inv.id}`);
      console.log(`  Status: ${inv.status}`);
      console.log(`  Date: ${new Date(inv.date * 1000).toISOString()}`);
      console.log(`  Due Date: ${inv.due_date ? new Date(inv.due_date * 1000).toISOString() : 'N/A'}`);
      console.log(`  Total: $${(inv.total / 100).toFixed(2)}`);
      console.log(`  Amount Paid: $${(inv.amount_paid / 100).toFixed(2)}`);
      console.log(`  Amount Due: $${(inv.amount_due / 100).toFixed(2)}`);
      console.log(`  Dunning Status: ${inv.dunning_status || 'N/A'}`);
      
      if (inv.dunning_attempts) {
        console.log(`  Dunning Attempts: ${inv.dunning_attempts.length}`);
      }
    }
  } else {
    console.log("No unpaid invoices found");
  }
  
  const allInvoicesUrl = `${BASE_URL}/invoices?customer_id[is]=${encodeURIComponent(customer.id)}&limit=5&sort_by[desc]=date`;
  const allInvoicesResponse = await fetch(allInvoicesUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    }
  });
  
  const allInvoicesData = await allInvoicesResponse.json() as any;
  
  console.log("\n=== RECENT INVOICES (ALL STATUSES) ===");
  for (const item of allInvoicesData.list || []) {
    const inv = item.invoice;
    console.log(`\nInvoice: ${inv.id}`);
    console.log(`  Status: ${inv.status}`);
    console.log(`  Date: ${new Date(inv.date * 1000).toISOString()}`);
    console.log(`  Total: $${(inv.total / 100).toFixed(2)}`);
    console.log(`  Amount Due: $${(inv.amount_due / 100).toFixed(2)}`);
  }
}

main();
