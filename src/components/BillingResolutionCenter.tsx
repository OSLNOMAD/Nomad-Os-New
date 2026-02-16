import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CreditOffer {
  amountCents: number;
  amountDisplay: string;
  type: string;
  description: string;
}

interface ResolutionStartResponse {
  resolutionId: number;
  isEscalation: boolean;
  issueType: string;
  creditOffer: CreditOffer | null;
  subscriptionStatus: string | null;
  subscriptionPrice: string | null;
}

interface Props {
  authToken: string;
}

type Step = "select_issue" | "describe_issue" | "credit_offer" | "escalation_form" | "success";

const issueOptions = [
  { type: "service_not_working", label: "My service wasn't working", icon: "📡", desc: "Outages, slow speeds, or connection drops" },
  { type: "incorrect_charge", label: "I was charged incorrectly", icon: "💳", desc: "Double charge, overcharge, or billing error" },
  { type: "cancelled_still_charged", label: "I cancelled but was still charged", icon: "🚫", desc: "Charged after cancellation request" },
  { type: "equipment_return", label: "I returned equipment and want a refund", icon: "📦", desc: "Returned device but haven't received refund" },
  { type: "unhappy_with_service", label: "I'm unhappy with my service", icon: "😞", desc: "General dissatisfaction with service quality" },
  { type: "other_billing", label: "Other billing question", icon: "❓", desc: "Something else about my bill" },
];

export default function BillingResolutionCenter({ authToken }: Props) {
  const [step, setStep] = useState<Step>("select_issue");
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [issueDetails, setIssueDetails] = useState("");
  const [resolutionData, setResolutionData] = useState<ResolutionStartResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);

  const [contactMethod, setContactMethod] = useState<"email" | "phone">("email");
  const [contactPhone, setContactPhone] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofFileData, setProofFileData] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("File must be under 10MB");
      return;
    }
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = () => setProofFileData(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleIssueSelect = (issueType: string) => {
    setSelectedIssue(issueType);
    setError(null);
    setStep("describe_issue");
  };

  const handleSubmitDetails = async () => {
    if (!selectedIssue) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing-resolution/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ issueType: selectedIssue, issueDetails }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process your request");
      setResolutionData(data);
      if (data.isEscalation) {
        setStep("escalation_form");
      } else {
        setStep("credit_offer");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptCredit = async () => {
    if (!resolutionData) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing-resolution/accept-credit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ resolutionId: resolutionData.resolutionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply credit");
      setSuccessMessage(data.message);
      setStep("success");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeclineCredit = async () => {
    if (!resolutionData) return;
    setIsLoading(true);
    try {
      await fetch("/api/billing-resolution/decline-credit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ resolutionId: resolutionData.resolutionId }),
      });
      setStep("escalation_form");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEscalate = async () => {
    if (!resolutionData) return;
    if (selectedIssue === "equipment_return" && !trackingNumber && !proofFileData) {
      setError("Please provide a tracking number or upload proof of return");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing-resolution/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          resolutionId: resolutionData.resolutionId,
          contactMethod,
          contactPhone: contactMethod === "phone" ? contactPhone : undefined,
          additionalNotes,
          proofFileData: proofFileData || undefined,
          proofFileName: proofFile?.name || undefined,
          trackingNumber: trackingNumber || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");
      setTicketId(data.ticketId);
      setSuccessMessage(data.message);
      setStep("success");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/billing-resolution/history", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setHistory(data.resolutions || []);
      setShowHistory(true);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const resetFlow = () => {
    setStep("select_issue");
    setSelectedIssue(null);
    setIssueDetails("");
    setResolutionData(null);
    setError(null);
    setSuccessMessage("");
    setTicketId(null);
    setContactMethod("email");
    setContactPhone("");
    setAdditionalNotes("");
    setTrackingNumber("");
    setProofFile(null);
    setProofFileData(null);
  };

  const issueLabel = issueOptions.find((o) => o.type === selectedIssue)?.label || selectedIssue;

  const outcomeLabels: Record<string, { label: string; color: string }> = {
    credit_offered: { label: "Credit Offered", color: "text-blue-600 bg-blue-50" },
    credit_accepted: { label: "Credit Applied", color: "text-green-600 bg-green-50" },
    credit_declined: { label: "Credit Declined", color: "text-orange-600 bg-orange-50" },
    credit_failed: { label: "Credit Failed", color: "text-red-600 bg-red-50" },
    escalated: { label: "Escalated to Support", color: "text-purple-600 bg-purple-50" },
    escalation_pending: { label: "Pending Escalation", color: "text-yellow-600 bg-yellow-50" },
    pending: { label: "Pending", color: "text-gray-600 bg-gray-50" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Billing Resolution Center</h2>
          <p className="text-sm text-gray-500 mt-1">Get help with billing issues quickly</p>
        </div>
        <button
          onClick={showHistory ? () => setShowHistory(false) : loadHistory}
          disabled={historyLoading}
          className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          {historyLoading ? "Loading..." : showHistory ? "Back to Resolution" : "View History"}
        </button>
      </div>

      {showHistory ? (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <p className="text-gray-500">No previous billing resolutions found.</p>
            </div>
          ) : (
            history.map((r: any) => (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{issueOptions.find((o) => o.type === r.issueType)?.icon || "📋"}</span>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {issueOptions.find((o) => o.type === r.issueType)?.label || r.issueType}
                      </p>
                      <p className="text-xs text-gray-400">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${outcomeLabels[r.outcome]?.color || "text-gray-600 bg-gray-50"}`}>
                    {outcomeLabels[r.outcome]?.label || r.outcome}
                  </span>
                </div>
                {r.creditOffered && (
                  <p className="text-xs text-gray-500 ml-9">Credit offered: ${(r.creditOffered / 100).toFixed(2)}</p>
                )}
                {r.zendeskTicketId && (
                  <p className="text-xs text-gray-500 ml-9">Support ticket: #{r.zendeskTicketId}</p>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {step === "select_issue" && (
            <motion.div key="select" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="grid gap-3 sm:grid-cols-2">
                {issueOptions.map((option) => (
                  <button
                    key={option.type}
                    onClick={() => handleIssueSelect(option.type)}
                    className="bg-white rounded-2xl border border-gray-100 p-5 text-left hover:border-emerald-200 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-2xl group-hover:scale-110 transition-transform">{option.icon}</span>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{option.label}</p>
                        <p className="text-xs text-gray-500 mt-1">{option.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === "describe_issue" && (
            <motion.div key="describe" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={() => { setStep("select_issue"); setSelectedIssue(null); }} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div>
                    <h3 className="font-semibold text-gray-900">Tell us more about your issue</h3>
                    <p className="text-xs text-gray-500">{issueLabel}</p>
                  </div>
                </div>

                <textarea
                  value={issueDetails}
                  onChange={(e) => setIssueDetails(e.target.value)}
                  placeholder="Please describe what happened in detail. For example: when did the issue start, what charges are incorrect, etc."
                  className="w-full h-32 px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />

                {error && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">{error}</div>
                )}

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={() => { setStep("select_issue"); setSelectedIssue(null); }}
                    className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmitDetails}
                    disabled={isLoading || !issueDetails.trim()}
                    className="px-6 py-2.5 text-sm font-medium text-white rounded-xl shadow-md transition-all disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : "Continue"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === "credit_offer" && resolutionData?.creditOffer && (
            <motion.div key="credit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="p-6 text-center" style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}>
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h3 className="text-white text-lg font-bold">We'd like to make this right</h3>
                  <p className="text-white/80 text-sm mt-1">Here's what we can offer you</p>
                </div>

                <div className="p-6">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 text-center mb-5">
                    <p className="text-3xl font-bold text-emerald-700">{resolutionData.creditOffer.amountDisplay}</p>
                    <p className="text-sm text-emerald-600 mt-1">Account Credit</p>
                    <p className="text-xs text-gray-500 mt-2">{resolutionData.creditOffer.description}</p>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <div className="text-sm text-blue-700">
                        <p className="font-medium">How credits work</p>
                        <p className="text-xs mt-1">Credits are automatically applied to your next invoice. You'll see the discount on your upcoming bill.</p>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">{error}</div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={handleDeclineCredit}
                      disabled={isLoading}
                      className="flex-1 px-5 py-3 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      No thanks, I'd rather talk to support
                    </button>
                    <button
                      onClick={handleAcceptCredit}
                      disabled={isLoading}
                      className="flex-1 px-5 py-3 text-sm font-medium text-white rounded-xl shadow-md transition-all disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Applying...
                        </span>
                      ) : "Accept Credit"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === "escalation_form" && (
            <motion.div key="escalate" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Contact Support</h3>
                    <p className="text-xs text-gray-500">We'll create a support ticket and get back to you within 24 hours</p>
                  </div>
                </div>

                {selectedIssue === "equipment_return" && (
                  <div className="mb-5 space-y-4">
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                        <p className="text-sm text-amber-700">Please provide proof of your equipment return (tracking number and/or receipt photo) so our team can process your request faster.</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Return Tracking Number</label>
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="Enter shipping tracking number"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Upload Proof of Return</label>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-300 transition-colors"
                      >
                        {proofFile ? (
                          <div className="flex items-center justify-center gap-2">
                            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            <span className="text-sm text-gray-700">{proofFile.name}</span>
                            <button onClick={(e) => { e.stopPropagation(); setProofFile(null); setProofFileData(null); }} className="text-red-400 hover:text-red-600 ml-2">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ) : (
                          <>
                            <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                            <p className="text-sm text-gray-500">Click to upload receipt, shipping label, or screenshot</p>
                            <p className="text-xs text-gray-400 mt-1">PNG, JPG, or PDF up to 10MB</p>
                          </>
                        )}
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
                    </div>
                  </div>
                )}

                {selectedIssue === "cancelled_still_charged" && (
                  <div className="mb-5">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <div className="text-sm text-blue-700">
                          <p className="font-medium">Your current subscription status</p>
                          <p className="text-xs mt-1">
                            Status: <span className="font-semibold">{resolutionData?.subscriptionStatus || "Unknown"}</span>
                            {resolutionData?.subscriptionPrice && <> | Price: <span className="font-semibold">{resolutionData.subscriptionPrice}/mo</span></>}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">How should we contact you?</label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setContactMethod("email")}
                        className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all ${contactMethod === "email" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                      >
                        Email
                      </button>
                      <button
                        onClick={() => setContactMethod("phone")}
                        className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all ${contactMethod === "phone" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                      >
                        Phone Call
                      </button>
                    </div>
                  </div>

                  {contactMethod === "phone" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                      <input
                        type="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Additional Notes (optional)</label>
                    <textarea
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      placeholder="Any additional information that might help our team..."
                      className="w-full h-20 px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">{error}</div>
                )}

                <div className="flex justify-end gap-3 mt-5">
                  <button
                    onClick={resetFlow}
                    className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEscalate}
                    disabled={isLoading || (contactMethod === "phone" && !contactPhone)}
                    className="px-6 py-2.5 text-sm font-medium text-white rounded-xl shadow-md transition-all disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </span>
                    ) : "Submit to Support"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {ticketId ? "Support Ticket Created" : "Credit Applied Successfully"}
                </h3>
                <p className="text-sm text-gray-600 mb-2">{successMessage}</p>
                {ticketId && (
                  <p className="text-sm text-gray-500">Ticket Reference: <span className="font-mono font-semibold">#{ticketId}</span></p>
                )}
                <button
                  onClick={resetFlow}
                  className="mt-6 px-6 py-2.5 text-sm font-medium text-white rounded-xl shadow-md"
                  style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
