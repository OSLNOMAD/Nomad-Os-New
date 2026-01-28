import OpenAI from "openai";
import type { CustomerFullData } from "./services";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function formatUnixTimestamp(ts: number | string | undefined | null): string {
  if (!ts) return "N/A";
  const num = typeof ts === "string" ? parseInt(ts) : ts;
  if (isNaN(num) || num === 0) return "N/A";
  return new Date(num * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatISODate(isoString: string | undefined | null): string {
  if (!isoString) return "N/A";
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return isoString;
  }
}

function centsToDollars(cents: number | undefined | null): string {
  if (cents === undefined || cents === null) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

function toDollars(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return "$0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `$${num.toFixed(2)}`;
}

function formatAccountContext(data: CustomerFullData, email: string): string {
  const sections: string[] = [];

  sections.push(`=== CUSTOMER EMAIL: ${email} ===`);

  sections.push(`\n${"=".repeat(60)}`);
  sections.push(`SOURCE: CHARGEBEE (Billing & Subscriptions)`);
  sections.push(`${"=".repeat(60)}`);

  if (data.chargebee.customers.length === 0) {
    sections.push("No Chargebee customer records found for this email.");
  } else {
    sections.push(`Total Customers: ${data.chargebee.customers.length}`);
    sections.push(`Total Subscriptions: ${data.chargebee.totalSubscriptions}`);
    sections.push(`Total Invoices: ${data.chargebee.totalInvoices}`);
    sections.push(`Total Amount Due: ${centsToDollars(data.chargebee.totalDue)}`);

    data.chargebee.customers.forEach((customer, custIdx) => {
      sections.push(`\n--- CHARGEBEE CUSTOMER #${custIdx + 1} ---`);
      sections.push(`Customer ID: ${customer.id}`);
      sections.push(`Name: ${customer.firstName || ""} ${customer.lastName || ""}`);
      sections.push(`Email: ${customer.email || email}`);
      sections.push(`Phone: ${customer.phone || "N/A"}`);
      sections.push(`Created: ${formatUnixTimestamp(customer.createdAt)}`);
      sections.push(`Auto Collection: ${customer.autoCollection || "N/A"}`);
      sections.push(`Promotional Credits: ${centsToDollars(customer.promotionalCredits)}`);
      sections.push(`Refundable Credits: ${centsToDollars(customer.refundableCredits)}`);
      sections.push(`Excess Payments: ${centsToDollars(customer.excessPayments)}`);
      sections.push(`Unbilled Charges: ${centsToDollars(customer.unbilledCharges)}`);

      if (customer.billingAddress) {
        const ba = customer.billingAddress;
        sections.push(`Billing Address: ${ba.line1 || ""} ${ba.line2 || ""}, ${ba.city || ""}, ${ba.state || ""} ${ba.zip || ""} ${ba.country || ""}`);
      }

      sections.push(`\n  SUBSCRIPTIONS (${customer.subscriptions.length}):`);
      if (customer.subscriptions.length === 0) {
        sections.push("    No subscriptions found.");
      } else {
        customer.subscriptions.forEach((sub, subIdx) => {
          sections.push(`\n  [Subscription ${subIdx + 1}]`);
          sections.push(`    Subscription ID: ${sub.id}`);
          sections.push(`    Plan ID: ${sub.planId}`);
          sections.push(`    Status: ${sub.status}`);
          sections.push(`    Plan Amount: ${centsToDollars(sub.planAmount)} per ${sub.billingPeriodUnit || "month"}`);
          sections.push(`    Billing Period: ${sub.billingPeriod || 1} ${sub.billingPeriodUnit || "month"}(s)`);
          sections.push(`    Created: ${formatUnixTimestamp(sub.createdAt)}`);
          sections.push(`    Started: ${formatUnixTimestamp(sub.startedAt)}`);
          sections.push(`    Activated: ${formatUnixTimestamp(sub.activatedAt)}`);
          sections.push(`    Current Term Start: ${formatUnixTimestamp(sub.currentTermStart)}`);
          sections.push(`    Current Term End: ${formatUnixTimestamp(sub.currentTermEnd)}`);
          sections.push(`    Next Billing: ${formatUnixTimestamp(sub.nextBillingAt)}`);
          sections.push(`    Cancelled At: ${formatUnixTimestamp(sub.cancelledAt)}`);
          sections.push(`    Cancel Reason: ${sub.cancelReason || "N/A"}`);
          sections.push(`    Due Invoices Count: ${sub.dueInvoicesCount ?? 0}`);
          sections.push(`    Due Since: ${formatUnixTimestamp(sub.dueSince)}`);
          sections.push(`    Total Dues: ${centsToDollars(sub.totalDues)}`);
          sections.push(`    MRR (Monthly Recurring Revenue): ${centsToDollars(sub.mrr)}`);
          sections.push(`    ICCID (SIM ID): ${sub.iccid || "N/A"}`);
          sections.push(`    IMEI (Device ID): ${sub.imei || "N/A"}`);
          sections.push(`    MDN (Phone Number): ${sub.mdn || "N/A"}`);
        });
      }

      sections.push(`\n  INVOICES (${customer.invoices.length}):`);
      if (customer.invoices.length === 0) {
        sections.push("    No invoices found.");
      } else {
        customer.invoices.forEach((inv, invIdx) => {
          sections.push(`\n  [Invoice ${invIdx + 1}]`);
          sections.push(`    Invoice ID: ${inv.id}`);
          sections.push(`    Status: ${inv.status}`);
          sections.push(`    Date: ${formatUnixTimestamp(inv.date)}`);
          sections.push(`    Due Date: ${formatUnixTimestamp(inv.dueDate)}`);
          sections.push(`    Paid At: ${formatUnixTimestamp(inv.paidAt)}`);
          sections.push(`    Subtotal: ${centsToDollars(inv.subTotal)}`);
          sections.push(`    Tax: ${centsToDollars(inv.tax)}`);
          sections.push(`    Total: ${centsToDollars(inv.total)}`);
          sections.push(`    Amount Paid: ${centsToDollars(inv.amountPaid)}`);
          sections.push(`    Amount Adjusted: ${centsToDollars(inv.amountAdjusted)}`);
          sections.push(`    Credits Applied: ${centsToDollars(inv.creditsApplied)}`);
          sections.push(`    Amount Due: ${centsToDollars(inv.amountDue)}`);
          sections.push(`    Write Off Amount: ${centsToDollars(inv.writeOffAmount)}`);
          sections.push(`    Dunning Status: ${inv.dunningStatus || "N/A"}`);
          sections.push(`    Currency: ${inv.currencyCode || "USD"}`);
          sections.push(`    Recurring: ${inv.recurring ? "Yes" : "No"}`);
          sections.push(`    First Invoice: ${inv.firstInvoice ? "Yes" : "No"}`);
        });
      }

      sections.push(`\n  TRANSACTIONS (${customer.transactions.length}):`);
      if (customer.transactions.length === 0) {
        sections.push("    No transactions found.");
      } else {
        customer.transactions.forEach((txn, txnIdx) => {
          sections.push(`\n  [Transaction ${txnIdx + 1}]`);
          sections.push(`    Transaction ID: ${txn.id}`);
          sections.push(`    Type: ${txn.type}`);
          sections.push(`    Status: ${txn.status}`);
          sections.push(`    Date: ${formatUnixTimestamp(txn.date)}`);
          sections.push(`    Amount: ${centsToDollars(txn.amount)}`);
          sections.push(`    Currency: ${txn.currencyCode || "USD"}`);
          sections.push(`    Gateway: ${txn.gateway || "N/A"}`);
          sections.push(`    Payment Method: ${txn.paymentMethod || "N/A"}`);
          sections.push(`    Reference Number: ${txn.referenceNumber || "N/A"}`);
          sections.push(`    Error Code: ${txn.errorCode || "None"}`);
          sections.push(`    Error Text: ${txn.errorText || "None"}`);
        });
      }

      sections.push(`\n  PAYMENT SOURCES (${customer.paymentSources?.length || 0}):`);
      if (!customer.paymentSources || customer.paymentSources.length === 0) {
        sections.push("    No payment sources found.");
      } else {
        customer.paymentSources.forEach((ps, psIdx) => {
          sections.push(`\n  [Payment Source ${psIdx + 1}]`);
          sections.push(`    ID: ${ps.id}`);
          sections.push(`    Type: ${ps.type}`);
          sections.push(`    Status: ${ps.status}`);
          sections.push(`    Gateway: ${ps.gateway || "N/A"}`);
          if (ps.card) {
            sections.push(`    Card Brand: ${ps.card.brand || "N/A"}`);
            sections.push(`    Card Last 4: ${ps.card.last4 || "N/A"}`);
            sections.push(`    Card Expiry: ${ps.card.expiryMonth || "??"}/${ps.card.expiryYear || "????"}`);
            sections.push(`    Card Funding: ${ps.card.fundingType || "N/A"}`);
          }
        });
      }
    });
  }

  sections.push(`\n${"=".repeat(60)}`);
  sections.push(`SOURCE: SHOPIFY + SHIPSTATION (Orders & Shipping)`);
  sections.push(`${"=".repeat(60)}`);

  if (data.orders.length === 0) {
    sections.push("No orders found for this email.");
  } else {
    sections.push(`Total Orders: ${data.orders.length}`);

    data.orders.forEach((order, orderIdx) => {
      sections.push(`\n--- ORDER #${orderIdx + 1}: ${order.orderNumber} ---`);
      sections.push(`Data Source: ${order.source}`);
      sections.push(`Order ID: ${order.orderId}`);
      sections.push(`Order Number: ${order.orderNumber}`);
      sections.push(`Order Date: ${formatISODate(order.orderDate)}`);
      sections.push(`Order Status: ${order.status || "N/A"}`);
      sections.push(`Fulfillment Status: ${order.fulfillmentStatus || "Unfulfilled"}`);
      sections.push(`Payment Status: ${order.paymentStatus || "N/A"}`);
      sections.push(`Total: ${toDollars(order.total)}`);
      sections.push(`Currency: ${order.currency || "USD"}`);
      sections.push(`IMEI (Device ID from Shipstation): ${order.imei || "N/A"}`);
      sections.push(`ICCID (SIM ID from Shipstation): ${order.iccid || "N/A"}`);

      if (order.shipping) {
        const sa = order.shipping;
        sections.push(`Shipping Address: ${sa.name || ""}, ${sa.address1 || ""} ${sa.address2 || ""}, ${sa.city || ""}, ${sa.state || ""} ${sa.zip || ""} ${sa.country || ""}`);
        sections.push(`Shipping Phone: ${sa.phone || "N/A"}`);
      }

      sections.push(`\n  LINE ITEMS (${order.items?.length || 0}):`);
      if (order.items && order.items.length > 0) {
        order.items.forEach((item, itemIdx) => {
          sections.push(`    [Item ${itemIdx + 1}] ${item.name || item.sku || "Unknown"}`);
          sections.push(`      SKU: ${item.sku || "N/A"}`);
          sections.push(`      Quantity: ${item.quantity || 1}`);
          sections.push(`      Price: ${toDollars(item.price)}`);
          sections.push(`      Fulfillment Status: ${item.fulfillmentStatus || "N/A"}`);
        });
      }

      sections.push(`\n  TRACKING/SHIPMENTS (${order.tracking?.length || 0}):`);
      if (order.tracking && order.tracking.length > 0) {
        order.tracking.forEach((track, trackIdx) => {
          sections.push(`    [Shipment ${trackIdx + 1}]`);
          sections.push(`      Tracking Number: ${track.trackingNumber || "N/A"}`);
          sections.push(`      Carrier: ${track.carrier || "N/A"}`);
          sections.push(`      Tracking URL: ${track.trackingUrl || "N/A"}`);
          sections.push(`      Ship Date: ${formatISODate(track.shipDate)}`);
          sections.push(`      Status: ${track.status || "N/A"}`);
        });
      } else {
        sections.push("    No tracking/shipment info available yet.");
      }
    });
  }

  sections.push(`\n${"=".repeat(60)}`);
  sections.push(`SOURCE: THINGSPACE (Verizon Device/Line Status)`);
  sections.push(`${"=".repeat(60)}`);

  if (data.devices.length === 0) {
    sections.push("No ThingSpace device records found for this customer's ICCIDs.");
  } else {
    sections.push(`Total Devices: ${data.devices.length}`);

    data.devices.forEach((device, devIdx) => {
      sections.push(`\n--- DEVICE #${devIdx + 1} ---`);
      sections.push(`Account Name: ${device.accountName || "N/A"}`);
      sections.push(`Device State: ${device.state}`);
      sections.push(`Connected: ${device.connected ? "YES" : "NO"}`);
      sections.push(`IP Address: ${device.ipAddress || "N/A"}`);
      sections.push(`Last Connection: ${formatISODate(device.lastConnectionDate)}`);
      sections.push(`Last Activation: ${formatISODate(device.lastActivationDate)}`);
      sections.push(`Billing Cycle End: ${device.billingCycleEndDate || "N/A"}`);

      sections.push(`\n  DEVICE IDENTIFIERS:`);
      sections.push(`    MDN (Phone Number): ${device.identifiers.mdn || "N/A"}`);
      sections.push(`    IMSI: ${device.identifiers.imsi || "N/A"}`);
      sections.push(`    IMEI: ${device.identifiers.imei || "N/A"}`);
      sections.push(`    ICCID (SIM ID): ${device.identifiers.iccid || "N/A"}`);
      sections.push(`    MSISDN: ${device.identifiers.msisdn || "N/A"}`);
      sections.push(`    MIN: ${device.identifiers.min || "N/A"}`);

      if (device.carrier) {
        sections.push(`\n  CARRIER INFO:`);
        sections.push(`    Carrier Name: ${device.carrier.name || "N/A"}`);
        sections.push(`    Service Plan: ${device.carrier.servicePlan || "N/A"}`);
        sections.push(`    Carrier State: ${device.carrier.state || "N/A"}`);
      }

      if (device.extendedAttributes && Object.keys(device.extendedAttributes).length > 0) {
        sections.push(`\n  EXTENDED ATTRIBUTES:`);
        Object.entries(device.extendedAttributes).forEach(([key, value]) => {
          sections.push(`    ${key}: ${value}`);
        });
      }
    });
  }

  sections.push(`\n${"=".repeat(60)}`);
  sections.push(`END OF CUSTOMER DATA`);
  sections.push(`${"=".repeat(60)}`);

  return sections.join("\n");
}

const SYSTEM_PROMPT = `

**SYSTEM:**

You are **JADA**, the AI customer support assistant for **Nomad Internet** (wireless internet service in the United States). You help customers understand their **account, subscription, billing, orders, shipping, and device/line status** using the structured context provided to you.

You must be accurate, deterministic, and action-oriented. Do **not** guess. If a field is missing, say it is not available.

---

### 1) Inputs You Receive (Context Contract)

You will receive one or more JSON objects that may include data from:

* **Chargebee**: customers, subscriptions, invoices, transactions, payment_sources
* **Shopify**: orders
* **ShipStation**: orders, shipments, custom fields
* **ThingSpace**: device state, connectivity, last connection, identifiers (ICCID/IMEI/MDN)

Treat the context as the source of truth. Your job is to **normalize** and **summarize** it into a customer-friendly explanation and next steps.

---

### 2) Data Normalization Rules (Mandatory)

#### Currency

* **Chargebee amounts are in cents** → divide by 100 and format as **$99.99**.
* **Shopify money values are strings already in dollars** → parse as dollars, do **not** divide by 100.
* **ShipStation totals are floats in dollars** → do **not** divide by 100.

#### Dates

* Chargebee timestamps are **Unix seconds** → convert to a friendly date format like **January 28, 2026**.
* Shopify / ShipStation / ThingSpace timestamps are ISO strings → format to friendly dates.
* If timezone is unclear, do not invent exact time-of-day; date is enough.

#### Identifiers

* ICCID is 19–20 digits; IMEI is 15 digits; MDN is 10 digits.
* If an identifier is missing/“-”, omit it from the response.

---

### 3) Status Mapping and Priority (Conflict Resolution)

If multiple systems disagree, resolve in this order depending on the question:

**A) Service/Line connectivity questions (“internet not working”, “offline”, “no signal”)**

1. **ThingSpace device state + connected + lastConnectionDate** (most authoritative for line/device behavior)
2. Chargebee subscription status and dues (billing eligibility)
3. Shipping status (if device not delivered yet)

**B) Billing/Payment questions (“charged”, “invoice”, “paid”, “due”)**

1. Chargebee invoices + transactions
2. Chargebee subscription dues fields (due_invoices_count, total_dues, due_since)
3. Payment sources (saved cards) for troubleshooting payment failures

**C) Order/shipping questions (“where is my modem”, “tracking”)**

1. ShipStation shipments/tracking
2. Shopify fulfillments/tracking (fallback)
3. Shopify order status_url (customer link)

---

### 4) Core Decision Logic (What You Must Do)

When asked about why internet isn’t working, always classify the case:

#### Case 1: Billing blocks service

Trigger if Chargebee shows:

* due_invoices_count > 0 OR total_dues > 0 OR invoice status “payment_due/not_paid”
  **Response:** explain there is a billing issue and the customer needs to pay/update payment method. Provide next step.

#### Case 2: Subscription not active

Trigger if Chargebee subscription status is:

* cancelled / non_renewing / paused
  **Response:** explain subscription is not active and service won’t work until resumed/reactivated. Provide next step.

#### Case 3: Line/device suspended or deactive in ThingSpace

Trigger if ThingSpace device state is:

* suspended / deactive / inactive
  **Response:** explain the line appears suspended on the carrier side and needs support action or portal fix flow. Provide next step.

#### Case 4: Device active but not connected / stale lastConnectionDate

Trigger if:

* ThingSpace state is active but connected=false OR lastConnectionDate is old
  **Response:** explain service is active but device isn’t currently connecting. Give troubleshooting steps (power cycle, placement, signal, etc.) and escalate if still failing.

#### Case 5: No ThingSpace record found

Trigger if:

* ThingSpace returns no devices for ICCID
  **Response:** explain carrier record not found for that SIM, likely a provisioning/swap mismatch, and support must investigate. Do not invent a fix.

#### Case 6: Device not delivered yet

Trigger if:

* shipping shows not shipped / no tracking / awaiting shipment
  **Response:** explain delivery is pending; service may not be usable until device arrives. Provide shipping/tracking info.

---

### 5) Required Output Structure (Always Follow)

Your response must be short, clear, and formatted like this:

1. **Summary:** 1–2 lines explaining the current situation.
2. **What I See on Your Account:** bullet list grouped by system (Billing, Subscription, Device/Line, Order/Shipping).
3. **What You Should Do Next:** 2–4 bullets with concrete actions.
4. **If You Need Support:** one line telling them how to contact support, only if needed.

Do not dump raw JSON. Do not mention internal API names unless necessary.

---

### 6) Customer Tone Rules

* Be friendly and professional.
* Do not over-apologize.
* Do not promise actions you cannot perform.
* Never fabricate: if data is missing, say “I don’t see that in your account details.”

---

### 7) Safety and Escalation

Escalate to support when:

* line is suspended/deactive and billing is fine
* ThingSpace record missing
* repeated payment failures with valid card shown
* chargeback/dispute language appears
* customer requests cancellation/refund disputes beyond what context proves

---

### 8) Example Guidance You Should Apply (Common Scenarios)

**If customer says:** “My line is suspended but my subscription is paid and I don’t see due invoices”

* Confirm invoices are paid/dues are zero.
* Then rely on ThingSpace: if suspended, tell them it’s a carrier-side line state issue and must be fixed via support/portal flow.

**If customer says:** “I was charged but internet stopped”

* Check invoice date/paid_at + subscription status + ThingSpace state.
* If paid but suspended: treat as Case 3.

---

You will now answer customer questions using ONLY the provided context and the rules above.

`;

export async function handleChatMessage(
  customerData: CustomerFullData,
  customerEmail: string,
  userMessage: string,
  conversationHistory: ChatMessage[],
): Promise<{ response: string; updatedHistory: ChatMessage[] }> {
  const accountContext = formatAccountContext(customerData, customerEmail);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\n--- CUSTOMER ACCOUNT DATA ---\n${accountContext}`,
    },
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user", content: userMessage },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const assistantMessage =
      response.choices[0].message.content ||
      "I apologize, but I was unable to generate a response. Please try again.";

    const updatedHistory: ChatMessage[] = [
      ...conversationHistory,
      { role: "user", content: userMessage },
      { role: "assistant", content: assistantMessage },
    ];

    return { response: assistantMessage, updatedHistory };
  } catch (error: any) {
    console.error("OpenAI API error:", error.message);
    throw new Error("Failed to get response from AI assistant");
  }
}

export type { ChatMessage };
