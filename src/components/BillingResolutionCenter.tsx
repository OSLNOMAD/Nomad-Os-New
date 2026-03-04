import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Props {
  authToken: string;
}

interface SubscriptionOption {
  id: string;
  planName: string;
  planAmount: number;
  status: string;
}

const requestReasons = [
  { value: "service_not_working", label: "Service wasn't working / Outage" },
  { value: "incorrect_charge", label: "Incorrect charge on my account" },
  { value: "double_charge", label: "Double charge / Duplicate payment" },
  { value: "cancelled_still_charged", label: "Charged after cancellation" },
  { value: "equipment_return", label: "Returned equipment — awaiting refund" },
  { value: "downgrade_overcharge", label: "Overcharged after plan change" },
  { value: "promo_not_applied", label: "Promotional discount not applied" },
  { value: "service_quality", label: "Poor service quality" },
  { value: "other", label: "Other" },
];

const refundMethods = [
  { value: "original_payment", label: "Refund to original payment method" },
  { value: "account_credit", label: "Account credit for future billing" },
];

export default function BillingResolutionCenter({ authToken }: Props) {
  const [subscriptions, setSubscriptions] = useState<SubscriptionOption[]>([]);
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [loadingSubs, setLoadingSubs] = useState(true);

  const [selectedSubscription, setSelectedSubscription] = useState("");
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [description, setDescription] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState("original_payment");
  const [outageStartDate, setOutageStartDate] = useState("");
  const [outageEndDate, setOutageEndDate] = useState("");
  const [preferredContact, setPreferredContact] = useState<"email" | "phone">("email");
  const [contactPhone, setContactPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCustomerData();
  }, []);

  const loadCustomerData = async () => {
    try {
      const profileRes = await fetch("/api/customer/profile", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setCustomerEmail(profileData.customer?.email || "");
        setCustomerName(profileData.customer?.fullName || "");
        setCustomerPhone(profileData.customer?.phone || "");
        setContactPhone(profileData.customer?.phone || "");
      }

      const dataRes = await fetch("/api/customer/full-data", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (dataRes.ok) {
        const data = await dataRes.json();
        const subs: SubscriptionOption[] = [];
        for (const cbCust of data.chargebee?.customers || []) {
          for (const sub of cbCust.subscriptions || []) {
            subs.push({
              id: sub.id,
              planName: sub.planName || sub.planId || sub.id,
              planAmount: sub.planAmount || 0,
              status: sub.status,
            });
          }
        }
        setSubscriptions(subs);
        if (subs.length === 1) setSelectedSubscription(subs[0].id);
      }
    } catch {
      setError("Failed to load account data. Please refresh the page.");
    } finally {
      setLoadingSubs(false);
    }
  };

  const showOutageDates = reason === "service_not_working";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedSubscription) {
      setError("Please select a subscription");
      return;
    }
    if (!reason) {
      setError("Please select a reason for your request");
      return;
    }
    if (reason === "other" && !otherReason.trim()) {
      setError("Please specify the reason for your request");
      return;
    }
    if (!description.trim()) {
      setError("Please provide details about your request");
      return;
    }
    if (!requestedAmount || parseFloat(requestedAmount) <= 0) {
      setError("Please enter a valid refund/credit amount");
      return;
    }
    if (preferredContact === "phone" && !contactPhone.trim()) {
      setError("Please enter a phone number for phone contact");
      return;
    }
    if (showOutageDates && outageStartDate && outageEndDate && outageStartDate > outageEndDate) {
      setError("Outage end date must be after the start date");
      return;
    }

    const selectedSub = subscriptions.find((s) => s.id === selectedSubscription);

    const payload = {
      customerPhone: preferredContact === "phone" ? contactPhone : customerPhone,
      subscriptionId: selectedSubscription,
      planName: selectedSub?.planName || "",
      planAmount: selectedSub?.planAmount || 0,
      subscriptionStatus: selectedSub?.status || "",
      reason: reason === "other" ? otherReason : requestReasons.find((r) => r.value === reason)?.label || reason,
      reasonCode: reason,
      description: description.trim(),
      requestedAmount: Math.round(parseFloat(requestedAmount) * 100),
      requestedAmountDisplay: `$${parseFloat(requestedAmount).toFixed(2)}`,
      refundMethod,
      refundMethodLabel: refundMethods.find((m) => m.value === refundMethod)?.label || refundMethod,
      outageStartDate: showOutageDates ? outageStartDate : null,
      outageEndDate: showOutageDates ? outageEndDate : null,
      preferredContact,
      contactPhone: preferredContact === "phone" ? contactPhone : null,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/billing-resolution/submit-refund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(data?.error || "Failed to submit your request. Please try again or contact support.");
      }
    } catch {
      setError("Unable to submit your request. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedSubscription(subscriptions.length === 1 ? subscriptions[0].id : "");
    setReason("");
    setOtherReason("");
    setDescription("");
    setRequestedAmount("");
    setRefundMethod("original_payment");
    setOutageStartDate("");
    setOutageEndDate("");
    setPreferredContact("email");
    setError(null);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(16, 163, 127, 0.1)" }}>
            <svg className="w-8 h-8" style={{ color: "#10a37f" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted</h2>
          <p className="text-gray-600 mb-1">Your refund/credit request has been submitted successfully.</p>
          <p className="text-gray-500 text-sm mb-6">Our team will review your request and get back to you within 1-3 business days.</p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-500">Amount Requested:</span>
              <span className="font-medium text-gray-900">${parseFloat(requestedAmount).toFixed(2)}</span>
              <span className="text-gray-500">Reason:</span>
              <span className="font-medium text-gray-900">{reason === "other" ? otherReason : requestReasons.find((r) => r.value === reason)?.label}</span>
              <span className="text-gray-500">Method:</span>
              <span className="font-medium text-gray-900">{refundMethods.find((m) => m.value === refundMethod)?.label}</span>
            </div>
          </div>
          <button onClick={resetForm} className="px-6 py-2.5 text-white rounded-lg font-medium" style={{ background: "linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)" }}>
            Submit Another Request
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Request a Refund or Credit</h2>
        <p className="text-gray-500 mt-1">Fill out the form below and our billing team will review your request.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-3">Account Information</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={customerName} readOnly className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="text" value={customerEmail} readOnly className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subscription</label>
            {loadingSubs ? (
              <div className="flex items-center gap-2 py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2" style={{ borderColor: "#10a37f" }} />
                <span className="text-sm text-gray-500">Loading subscriptions...</span>
              </div>
            ) : subscriptions.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">No subscriptions found</p>
            ) : (
              <select
                value={selectedSubscription}
                onChange={(e) => setSelectedSubscription(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="">Select a subscription...</option>
                {subscriptions.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.planName} — ${(sub.planAmount / 100).toFixed(2)}/mo ({sub.status})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-3">Request Details</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Request</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">Select a reason...</option>
              {requestReasons.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {reason === "other" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Please specify</label>
              <input
                type="text"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Describe the reason..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {showOutageDates && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Outage Start Date</label>
                <input
                  type="date"
                  value={outageStartDate}
                  onChange={(e) => setOutageStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Outage End Date</label>
                <input
                  type="date"
                  value={outageEndDate}
                  onChange={(e) => setOutageEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Describe your issue in detail</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please explain what happened, when it occurred, and any relevant details that will help us process your request..."
              rows={4}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Refund/Credit Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={requestedAmount}
                onChange={(e) => setRequestedAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Refund Method</label>
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                {refundMethods.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-3">Contact Preference</h3>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="contact"
                checked={preferredContact === "email"}
                onChange={() => setPreferredContact("email")}
                className="accent-emerald-600"
              />
              <span className="text-sm text-gray-700">Email ({customerEmail})</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="contact"
                checked={preferredContact === "phone"}
                onChange={() => setPreferredContact("phone")}
                className="accent-emerald-600"
              />
              <span className="text-sm text-gray-700">Phone</span>
            </label>
          </div>

          {preferredContact === "phone" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-700">&times;</button>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 text-white font-semibold rounded-xl disabled:opacity-60 transition-all"
          style={{ background: "linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)" }}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
              Submitting...
            </span>
          ) : (
            "Submit Refund/Credit Request"
          )}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Requests are typically reviewed within 1-3 business days. You'll be notified via your preferred contact method.
        </p>
      </form>
    </motion.div>
  );
}
