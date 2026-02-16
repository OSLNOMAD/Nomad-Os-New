import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Server returned an unexpected response. Please try again.");
  }
}

interface CreditOption {
  percent: number;
  amount: number;
  label: string;
}

interface StartResponse {
  reportId: number;
  issueCategory: string;
  outageStatus: string | null;
  chargebeeCustomerId: string | null;
  invoiceTotal: number | null;
  termDays: number | null;
  outageDurationHours: number | null;
  proratedAmount: number | null;
  recommendedCredit: number | null;
  creditCapPercent: number;
  cooldownBlocked: boolean;
  cooldownReason: string | null;
  priorCreditDate: string | null;
  priorCreditAmount: number | null;
  goodwillAmount: number | null;
  creditOptions: {
    options: CreditOption[];
    maxPercent: number;
    invoiceTotal: number;
  } | null;
}

interface SubscriptionInfo {
  id: string;
  planId: string;
  planName?: string;
  status: string;
  iccid: string | null;
  imei: string | null;
  mdn: string | null;
}

interface Props {
  authToken: string;
}

type Step =
  | "select_subscription"
  | "select_category"
  | "no_connection_status"
  | "active_outage_when"
  | "active_outage_location"
  | "active_outage_action"
  | "submit_ticket_form"
  | "resolved_outage_dates"
  | "resolved_outage_impact"
  | "resolved_outage_support"
  | "resolved_outage_proof"
  | "credit_calculation"
  | "credit_offer"
  | "slow_speeds_details"
  | "slow_speeds_policy"
  | "goodwill_offer"
  | "escalation_form"
  | "success";

const fadeIn = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.2 } };

export default function ServiceIssueCenter({ authToken }: Props) {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<SubscriptionInfo[]>([]);
  const [selectedSub, setSelectedSub] = useState<SubscriptionInfo | null>(null);
  const [subsLoading, setSubsLoading] = useState(true);
  const [step, setStep] = useState<Step>("select_subscription");
  const [issueCategory, setIssueCategory] = useState<string | null>(null);
  const [outageStatus, setOutageStatus] = useState<string | null>(null);
  const [outageStart, setOutageStart] = useState("");
  const [outageEnd, setOutageEnd] = useState("");
  const [outageStartUnsure, setOutageStartUnsure] = useState(false);
  const [outageStartEstimate, setOutageStartEstimate] = useState<string | null>(null);
  const [locationScope, setLocationScope] = useState<string | null>(null);
  const [impactType, setImpactType] = useState<string | null>(null);
  const [impactDetails, setImpactDetails] = useState("");
  const [contactedSupport, setContactedSupport] = useState<boolean | null>(null);
  const [supportContactMethod, setSupportContactMethod] = useState("");
  const [supportContactDetails, setSupportContactDetails] = useState("");
  const [contactMethod, setContactMethod] = useState<"email" | "phone">("email");
  const [contactPhone, setContactPhone] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [proofFiles, setProofFiles] = useState<{ name: string; data: string }[]>([]);
  const [selectedCreditPercent, setSelectedCreditPercent] = useState(50);

  const [slowSpeedNow, setSlowSpeedNow] = useState<boolean | null>(null);
  const [slowSpeedTiming, setSlowSpeedTiming] = useState<string | null>(null);
  const [slowSpeedUseCase, setSlowSpeedUseCase] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<StartResponse | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);

  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` };

  useEffect(() => {
    const fetchSubscriptions = async () => {
      setSubsLoading(true);
      try {
        const res = await fetch("/api/customer/full-data", {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) throw new Error("Failed to load subscriptions");
        const data = await res.json();
        const subs: SubscriptionInfo[] = [];
        const customers = data.chargebee?.customers || [];
        for (const cust of customers) {
          for (const subEntry of cust.subscriptions || []) {
            const sub = subEntry.subscription;
            if (sub && (sub.status === "active" || sub.status === "in_trial" || sub.status === "non_renewing")) {
              subs.push({
                id: sub.id,
                planId: sub.plan_id || sub.planId || "",
                planName: sub.plan_name || sub.planName || sub.plan_id || sub.planId || "",
                status: sub.status,
                iccid: sub.cf_iccid || sub.iccid || null,
                imei: sub.cf_imei || sub.imei || null,
                mdn: sub.cf_mdn || sub.mdn || null,
              });
            }
          }
        }
        setSubscriptions(subs);
        if (subs.length === 1) {
          setSelectedSub(subs[0]);
          setStep("select_category");
        } else if (subs.length === 0) {
          setStep("select_category");
        }
      } catch (err) {
        console.error("Failed to fetch subscriptions:", err);
        setStep("select_category");
      } finally {
        setSubsLoading(false);
      }
    };
    fetchSubscriptions();
  }, [authToken]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) { setError("File must be under 5MB"); return; }
      const reader = new FileReader();
      reader.onload = () => {
        setProofFiles((prev) => [...prev, { name: file.name, data: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const submitReport = async (category: string, status?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      let startDate = outageStart;
      let endDate = outageEnd;

      if (outageStartUnsure && outageStartEstimate) {
        const now = new Date();
        if (outageStartEstimate === "today") {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0).toISOString();
        } else if (outageStartEstimate === "yesterday") {
          const y = new Date(now);
          y.setDate(y.getDate() - 1);
          startDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 8, 0).toISOString();
        } else if (outageStartEstimate === "last_week") {
          const w = new Date(now);
          w.setDate(w.getDate() - 7);
          startDate = w.toISOString();
        }
      }

      const res = await fetch("/api/service-issue/start", {
        method: "POST",
        headers,
        body: JSON.stringify({
          issueCategory: category,
          outageStatus: status || null,
          outageStart: startDate || null,
          outageEnd: endDate || null,
          outageTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          impactType: impactType || slowSpeedUseCase || null,
          impactDetails: impactDetails || null,
          contactedSupportDuring: contactedSupport || false,
          supportContactMethod: supportContactMethod || null,
          supportContactDetails: supportContactDetails || null,
          subscriptionId: selectedSub?.id || null,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to submit report");
      setReportData(data);

      if (proofFiles.length > 0 && data.reportId) {
        for (const proof of proofFiles) {
          await fetch("/api/service-issue/upload-proof", {
            method: "POST",
            headers,
            body: JSON.stringify({ reportId: data.reportId, proofFileData: proof.data, proofFileName: proof.name }),
          });
        }
      }

      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptCredit = async (creditType: string, percent?: number) => {
    if (!reportData) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/service-issue/accept-credit", {
        method: "POST",
        headers,
        body: JSON.stringify({ reportId: reportData.reportId, creditPercent: percent || selectedCreditPercent, creditType }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to apply credit");
      setSuccessMessage(data.message);
      setStep("success");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEscalate = async () => {
    if (!reportData) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/service-issue/escalate", {
        method: "POST",
        headers,
        body: JSON.stringify({ reportId: reportData.reportId, contactMethod, contactPhone: contactMethod === "phone" ? contactPhone : undefined, additionalNotes }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to escalate");
      setTicketId(data.ticketId);
      setSuccessMessage(data.message);
      setStep("success");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitTicket = async () => {
    if (!reportData) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/service-issue/submit-ticket", {
        method: "POST",
        headers,
        body: JSON.stringify({ reportId: reportData.reportId, contactMethod, contactPhone: contactMethod === "phone" ? contactPhone : undefined, additionalNotes }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to submit ticket");
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
      const res = await fetch("/api/service-issue/history", { headers: { Authorization: `Bearer ${authToken}` } });
      const data = await safeJson(res);
      setHistory(data.reports || []);
      setShowHistory(true);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const resetFlow = () => {
    setStep("select_category");
    setIssueCategory(null);
    setOutageStatus(null);
    setOutageStart("");
    setOutageEnd("");
    setOutageStartUnsure(false);
    setOutageStartEstimate(null);
    setLocationScope(null);
    setImpactType(null);
    setImpactDetails("");
    setContactedSupport(null);
    setSupportContactMethod("");
    setSupportContactDetails("");
    setContactMethod("email");
    setContactPhone("");
    setAdditionalNotes("");
    setProofFiles([]);
    setSelectedCreditPercent(50);
    setSlowSpeedNow(null);
    setSlowSpeedTiming(null);
    setSlowSpeedUseCase(null);
    setError(null);
    setReportData(null);
    setSuccessMessage("");
    setTicketId(null);
  };

  const stepTitle: Record<string, string> = {
    select_subscription: "Select a subscription",
    select_category: "What issue are you experiencing?",
    no_connection_status: "Is the issue still happening right now?",
    active_outage_when: "When did the issue start?",
    active_outage_location: "Where is this happening?",
    active_outage_action: "What would you like to do?",
    submit_ticket_form: "Submit a Support Ticket",
    resolved_outage_dates: "When was your service down?",
    resolved_outage_impact: "How did it impact you?",
    resolved_outage_support: "Did you contact support during the outage?",
    resolved_outage_proof: "Upload proof (optional but recommended)",
    credit_calculation: "Downtime Credit Calculation",
    credit_offer: "Select Your Credit Amount",
    slow_speeds_details: "Tell us about the slow speeds",
    slow_speeds_policy: "Speed Policy Notice",
    goodwill_offer: "Goodwill Credit",
    escalation_form: "Contact Support",
    success: "Request Submitted",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Service Issue Center</h3>
          <p className="text-sm text-gray-500">Report service issues and request downtime credits</p>
        </div>
        <div className="flex gap-2">
          {step !== "select_category" && step !== "success" && (
            <button onClick={resetFlow} className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Start Over</button>
          )}
          <button onClick={loadHistory} disabled={historyLoading} className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
            {historyLoading ? "Loading..." : "View History"}
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900">Your Service Issue History</h4>
            <button onClick={() => setShowHistory(false)} className="text-xs text-gray-500 hover:text-gray-700">Close</button>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">No previous service issues</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {history.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                  <div>
                    <span className="font-medium">{r.issueCategory === "no_connection" ? "No Connection" : r.issueCategory === "slow_speeds" ? "Slow Speeds" : "Other"}</span>
                    <span className="text-gray-400 ml-2">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.outcome === "credit_applied" ? "bg-green-100 text-green-700" : r.outcome === "escalated" ? "bg-purple-100 text-purple-700" : r.outcome === "ticket_submitted" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                    {r.outcome?.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {step !== "success" && step !== "select_category" && step !== "select_subscription" && (
        <div className="bg-gray-50 rounded-lg px-4 py-2">
          <p className="text-sm font-medium text-gray-700">{stepTitle[step]}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === "select_subscription" && (
          <motion.div key="select_subscription" {...fadeIn} className="space-y-4">
            {subsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                <span className="ml-3 text-sm text-gray-500">Loading your subscriptions...</span>
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
                No active subscriptions found. Please contact support for assistance.
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 font-medium">Which subscription do you need help with?</p>
                <div className="space-y-3">
                  {subscriptions.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => {
                        setSelectedSub(sub);
                        setStep("select_category");
                      }}
                      className="w-full text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-emerald-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{sub.planName || sub.planId}</p>
                          <p className="text-xs text-gray-500">ID: {sub.id}</p>
                          <div className="flex gap-3 mt-1 text-xs text-gray-400">
                            {sub.iccid && <span>ICCID: ...{sub.iccid.slice(-6)}</span>}
                            {sub.imei && <span>IMEI: ...{sub.imei.slice(-6)}</span>}
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}

        {step === "select_category" && (
          <motion.div key="select_category" {...fadeIn} className="space-y-3">
            {selectedSub && subscriptions.length > 1 && (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-1">
                <div className="text-xs text-emerald-700">
                  <span className="font-medium">{selectedSub.planName || selectedSub.planId}</span>
                  <span className="text-emerald-500 ml-2">({selectedSub.id})</span>
                </div>
                <button
                  onClick={() => { setSelectedSub(null); setStep("select_subscription"); }}
                  className="text-xs text-emerald-600 hover:text-emerald-800 underline"
                >
                  Switch
                </button>
              </div>
            )}
            <p className="text-sm text-gray-600 font-medium">{stepTitle.select_category}</p>
            {[
              { key: "no_connection", label: "Service not working at all", desc: "Complete outage - no internet connection", icon: "🔴" },
              { key: "slow_speeds", label: "Slow speeds / poor performance", desc: "Internet works but is slow or unreliable", icon: "🟡" },
              { key: "other", label: "Other issue", desc: "Something else with my service", icon: "🔵" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setIssueCategory(opt.key);
                  setError(null);
                  if (opt.key === "no_connection") setStep("no_connection_status");
                  else if (opt.key === "slow_speeds") setStep("slow_speeds_details");
                  else setStep("escalation_form");
                }}
                className="w-full text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-emerald-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{opt.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-900 group-hover:text-emerald-700">{opt.label}</p>
                    <p className="text-xs text-gray-500">{opt.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </motion.div>
        )}

        {step === "no_connection_status" && (
          <motion.div key="no_connection_status" {...fadeIn} className="space-y-3">
            {[
              { key: "active", label: "Yes, it's still happening now", desc: "I currently have no service", color: "border-red-200 hover:border-red-400" },
              { key: "resolved", label: "No, it's been resolved", desc: "Service is back but I want to report the outage", color: "border-green-200 hover:border-green-400" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setOutageStatus(opt.key);
                  if (opt.key === "active") setStep("active_outage_when");
                  else setStep("resolved_outage_dates");
                }}
                className={`w-full text-left p-4 bg-white border ${opt.color} rounded-xl transition-all`}
              >
                <p className="font-semibold text-gray-900">{opt.label}</p>
                <p className="text-xs text-gray-500">{opt.desc}</p>
              </button>
            ))}
          </motion.div>
        )}

        {step === "active_outage_when" && (
          <motion.div key="active_outage_when" {...fadeIn} className="space-y-4 bg-white rounded-xl border border-gray-100 p-5">
            {!outageStartUnsure ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">When did the issue start?</label>
                <input
                  type="datetime-local"
                  value={outageStart}
                  onChange={(e) => setOutageStart(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                />
                <button onClick={() => setOutageStartUnsure(true)} className="mt-2 text-xs text-emerald-600 hover:underline">I'm not sure of the exact time</button>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Best estimate of when it started:</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: "today", label: "Today" },
                    { key: "yesterday", label: "Yesterday" },
                    { key: "last_week", label: "Last week" },
                  ].map((est) => (
                    <button
                      key={est.key}
                      onClick={() => setOutageStartEstimate(est.key)}
                      className={`px-4 py-2 rounded-lg text-sm border transition-colors ${outageStartEstimate === est.key ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                    >
                      {est.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setOutageStartUnsure(false)} className="mt-2 text-xs text-emerald-600 hover:underline">I know the exact time</button>
              </div>
            )}
            <button
              onClick={() => setStep("active_outage_location")}
              disabled={!outageStart && !outageStartEstimate}
              className="w-full py-2.5 text-white font-medium rounded-lg disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}
            >
              Continue
            </button>
          </motion.div>
        )}

        {step === "active_outage_location" && (
          <motion.div key="active_outage_location" {...fadeIn} className="space-y-3">
            {[
              { key: "one_location", label: "One location only", desc: "Only at my current spot" },
              { key: "multiple", label: "Multiple locations", desc: "Happens everywhere I go" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setLocationScope(opt.key);
                  setStep("active_outage_action");
                }}
                className="w-full text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-emerald-300 transition-all"
              >
                <p className="font-semibold text-gray-900">{opt.label}</p>
                <p className="text-xs text-gray-500">{opt.desc}</p>
              </button>
            ))}
          </motion.div>
        )}

        {step === "active_outage_action" && (
          <motion.div key="active_outage_action" {...fadeIn} className="space-y-4">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Service needs to be restored first</p>
                  <p className="text-xs mt-1">We need to get your service working before we can process a downtime credit. Once resolved, you can come back to request credit with exact dates and times.</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  const params = new URLSearchParams();
                  if (selectedSub) {
                    params.set("subscription", selectedSub.id);
                    if (selectedSub.iccid) params.set("iccid", selectedSub.iccid);
                    if (selectedSub.imei) params.set("imei", selectedSub.imei);
                    if (selectedSub.mdn) params.set("mdn", selectedSub.mdn);
                  }
                  navigate(`/troubleshoot?${params.toString()}`);
                }}
                className="w-full p-4 bg-white border border-emerald-200 rounded-xl hover:border-emerald-400 transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔧</span>
                  <div>
                    <p className="font-semibold text-emerald-700">Start troubleshooting now</p>
                    <p className="text-xs text-gray-500">Run diagnostics and attempt to restore your service</p>
                  </div>
                </div>
              </button>
              <button
                onClick={async () => {
                  setIssueCategory("no_connection");
                  const data = await submitReport("no_connection", "active");
                  if (data) setStep("submit_ticket_form");
                }}
                disabled={isLoading}
                className="w-full p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📋</span>
                  <div>
                    <p className="font-semibold text-gray-900">{isLoading ? "Processing..." : "Submit a support ticket"}</p>
                    <p className="text-xs text-gray-500">Have our team investigate and reach out to you</p>
                  </div>
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {step === "submit_ticket_form" && (
          <motion.div key="submit_ticket_form" {...fadeIn} className="space-y-4 bg-white rounded-xl border border-gray-100 p-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">How should we reach you?</label>
              <div className="flex gap-2">
                <button onClick={() => setContactMethod("email")} className={`flex-1 py-2 rounded-lg text-sm border ${contactMethod === "email" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200"}`}>Email</button>
                <button onClick={() => setContactMethod("phone")} className={`flex-1 py-2 rounded-lg text-sm border ${contactMethod === "phone" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200"}`}>Phone</button>
              </div>
            </div>
            {contactMethod === "phone" && (
              <input type="tel" placeholder="Your phone number" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional details (optional)</label>
              <textarea value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} rows={3} placeholder="Any additional information about the issue..." className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none" />
            </div>
            <button onClick={handleSubmitTicket} disabled={isLoading || (contactMethod === "phone" && !contactPhone)} className="w-full py-2.5 text-white font-medium rounded-lg disabled:opacity-50" style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}>
              {isLoading ? "Submitting..." : "Submit Ticket"}
            </button>
          </motion.div>
        )}

        {step === "resolved_outage_dates" && (
          <motion.div key="resolved_outage_dates" {...fadeIn} className="space-y-4 bg-white rounded-xl border border-gray-100 p-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">When did the outage start?</label>
              <input type="datetime-local" value={outageStart} onChange={(e) => setOutageStart(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">When was service restored?</label>
              <input type="datetime-local" value={outageEnd} onChange={(e) => setOutageEnd(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
            <p className="text-xs text-gray-400">Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
            <button
              onClick={() => setStep("resolved_outage_impact")}
              disabled={!outageStart || !outageEnd}
              className="w-full py-2.5 text-white font-medium rounded-lg disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}
            >
              Continue
            </button>
          </motion.div>
        )}

        {step === "resolved_outage_impact" && (
          <motion.div key="resolved_outage_impact" {...fadeIn} className="space-y-3">
            <p className="text-sm text-gray-600">How did the outage impact you?</p>
            {[
              { key: "work", label: "Work interruption", desc: "Remote work, meetings, business operations" },
              { key: "streaming", label: "Streaming / gaming", desc: "Entertainment and media" },
              { key: "education", label: "Education", desc: "Online classes, homework, research" },
              { key: "other", label: "Other", desc: "Something else" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setImpactType(opt.key);
                  setStep("resolved_outage_support");
                }}
                className={`w-full text-left p-3 bg-white border rounded-xl transition-all ${impactType === opt.key ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-emerald-300"}`}
              >
                <p className="font-medium text-gray-900 text-sm">{opt.label}</p>
                <p className="text-xs text-gray-500">{opt.desc}</p>
              </button>
            ))}
            {impactType === "other" && (
              <textarea value={impactDetails} onChange={(e) => setImpactDetails(e.target.value)} rows={2} placeholder="Please describe..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" />
            )}
          </motion.div>
        )}

        {step === "resolved_outage_support" && (
          <motion.div key="resolved_outage_support" {...fadeIn} className="space-y-4 bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-sm text-gray-600 font-medium">Did you contact support during the outage?</p>
            <div className="flex gap-2">
              <button onClick={() => setContactedSupport(true)} className={`flex-1 py-2.5 rounded-lg text-sm border ${contactedSupport === true ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-medium" : "border-gray-200"}`}>Yes</button>
              <button onClick={() => { setContactedSupport(false); setStep("resolved_outage_proof"); }} className={`flex-1 py-2.5 rounded-lg text-sm border ${contactedSupport === false ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-medium" : "border-gray-200"}`}>No</button>
            </div>
            {contactedSupport === true && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">How did you contact support?</label>
                  <select value={supportContactMethod} onChange={(e) => setSupportContactMethod(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="">Select...</option>
                    <option value="phone">Phone</option>
                    <option value="email">Email</option>
                    <option value="chat">Chat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ticket/reference number (if you have one)</label>
                  <input value={supportContactDetails} onChange={(e) => setSupportContactDetails(e.target.value)} placeholder="e.g. #12345" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <button onClick={() => setStep("resolved_outage_proof")} className="w-full py-2.5 text-white font-medium rounded-lg" style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}>Continue</button>
              </>
            )}
          </motion.div>
        )}

        {step === "resolved_outage_proof" && (
          <motion.div key="resolved_outage_proof" {...fadeIn} className="space-y-4 bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-start gap-2 mb-2">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm text-blue-700">Uploading proof (screenshots, speed tests, etc.) strengthens your case and helps us process your request faster.</p>
            </div>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-300 transition-colors"
            >
              <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <p className="text-sm text-gray-500">Click to upload screenshots or proof</p>
              <p className="text-xs text-gray-400 mt-1">Max 5MB per file</p>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleFileUpload} className="hidden" />
            {proofFiles.length > 0 && (
              <div className="space-y-1">
                {proofFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-gray-700 truncate">{f.name}</span>
                    <button onClick={() => setProofFiles(proofFiles.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 text-xs ml-2">Remove</button>
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Additional details about the outage (optional)</label>
              <textarea value={impactDetails} onChange={(e) => setImpactDetails(e.target.value)} rows={2} placeholder="Describe what happened..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" />
            </div>
            <button
              onClick={async () => {
                const data = await submitReport("no_connection", "resolved");
                if (data) {
                  if (data.cooldownBlocked) {
                    setStep("escalation_form");
                  } else if (data.creditOptions) {
                    setStep("credit_offer");
                  } else {
                    setStep("escalation_form");
                  }
                }
              }}
              disabled={isLoading}
              className="w-full py-2.5 text-white font-medium rounded-lg disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}
            >
              {isLoading ? "Calculating credit..." : "Calculate Downtime Credit"}
            </button>
            <button onClick={() => setStep("escalation_form")} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">Skip and contact support instead</button>
          </motion.div>
        )}

        {step === "credit_offer" && reportData && (
          <motion.div key="credit_offer" {...fadeIn} className="space-y-4">
            {reportData.cooldownBlocked ? (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-sm font-medium text-amber-800">{reportData.cooldownReason}</p>
                {reportData.priorCreditDate && (
                  <p className="text-xs text-amber-600 mt-1">
                    Last credit: ${reportData.priorCreditAmount?.toFixed(2)} on {new Date(reportData.priorCreditDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h4 className="font-semibold text-gray-900 mb-3">Downtime Credit Summary</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Outage Duration</p>
                      <p className="font-bold text-gray-900">{reportData.outageDurationHours} hours</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Last Invoice</p>
                      <p className="font-bold text-gray-900">${reportData.invoiceTotal?.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Prorated Amount</p>
                      <p className="font-bold text-gray-900">${reportData.proratedAmount?.toFixed(2)}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3">
                      <p className="text-xs text-emerald-600">Recommended Credit</p>
                      <p className="font-bold text-emerald-700">${reportData.recommendedCredit?.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {reportData.creditOptions && (
                  <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <h4 className="font-semibold text-gray-900 mb-3">Select credit amount</h4>
                    <div className="space-y-2">
                      {reportData.creditOptions.options.map((opt) => (
                        <button
                          key={opt.percent}
                          onClick={() => setSelectedCreditPercent(opt.percent)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${selectedCreditPercent === opt.percent ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:border-gray-300"}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                            <span className="font-bold text-emerald-700">${opt.amount.toFixed(2)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Maximum auto-credit: {reportData.creditCapPercent}% of invoice total</p>
                  </div>
                )}

                <button
                  onClick={() => handleAcceptCredit("downtime", selectedCreditPercent)}
                  disabled={isLoading}
                  className="w-full py-3 text-white font-semibold rounded-xl disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}
                >
                  {isLoading ? "Applying credit..." : `Apply $${((reportData.creditOptions?.options.find(o => o.percent === selectedCreditPercent)?.amount) || reportData.recommendedCredit || 0).toFixed(2)} Credit`}
                </button>
              </>
            )}
            <button onClick={() => { setStep("escalation_form"); }} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
              {reportData.cooldownBlocked ? "Contact support about this" : "Request a larger amount (requires review)"}
            </button>
          </motion.div>
        )}

        {step === "slow_speeds_details" && (
          <motion.div key="slow_speeds_details" {...fadeIn} className="space-y-4 bg-white rounded-xl border border-gray-100 p-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Is the slow speed happening right now?</label>
              <div className="flex gap-2">
                <button onClick={() => setSlowSpeedNow(true)} className={`flex-1 py-2 rounded-lg text-sm border ${slowSpeedNow === true ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200"}`}>Yes</button>
                <button onClick={() => setSlowSpeedNow(false)} className={`flex-1 py-2 rounded-lg text-sm border ${slowSpeedNow === false ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200"}`}>No</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">When does it happen?</label>
              <div className="flex gap-2 flex-wrap">
                {["all_day", "specific_times", "intermittent"].map((t) => (
                  <button key={t} onClick={() => setSlowSpeedTiming(t)} className={`px-3 py-2 rounded-lg text-sm border ${slowSpeedTiming === t ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200"}`}>
                    {t === "all_day" ? "All day" : t === "specific_times" ? "Specific times" : "Intermittent"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">What's most impacted?</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: "work", label: "Work / Zoom" },
                  { key: "streaming", label: "Streaming" },
                  { key: "gaming", label: "Gaming" },
                  { key: "general", label: "General browsing" },
                ].map((u) => (
                  <button key={u.key} onClick={() => setSlowSpeedUseCase(u.key)} className={`px-3 py-2 rounded-lg text-sm border ${slowSpeedUseCase === u.key ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200"}`}>
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Upload speed test or screenshot (optional)</label>
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-emerald-300 transition-colors">
                <p className="text-sm text-gray-500">Click to upload</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleFileUpload} className="hidden" />
              {proofFiles.length > 0 && proofFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1 mt-1 text-xs">
                  <span className="truncate">{f.name}</span>
                  <button onClick={() => setProofFiles(proofFiles.filter((_, idx) => idx !== i))} className="text-red-400 ml-2">Remove</button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep("slow_speeds_policy")}
              disabled={slowSpeedNow === null}
              className="w-full py-2.5 text-white font-medium rounded-lg disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}
            >
              Continue
            </button>
          </motion.div>
        )}

        {step === "slow_speeds_policy" && (
          <motion.div key="slow_speeds_policy" {...fadeIn} className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div>
                  <h4 className="font-semibold text-blue-900">About Internet Speeds</h4>
                  <p className="text-sm text-blue-700 mt-2">Nomad Internet does not guarantee minimum speeds. Speeds can vary based on:</p>
                  <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                    <li>Network coverage and tower availability</li>
                    <li>Network congestion during peak hours</li>
                    <li>Weather and environmental conditions</li>
                    <li>Tower maintenance and upgrades</li>
                  </ul>
                  <p className="text-sm text-blue-700 mt-3 font-medium">Because of this, downtime credits are not available for speed-related issues.</p>
                </div>
              </div>
            </div>
            <button
              onClick={async () => {
                const data = await submitReport("slow_speeds");
                if (data) {
                  if (data.cooldownBlocked) {
                    setStep("goodwill_offer");
                  } else if (data.goodwillAmount) {
                    setStep("goodwill_offer");
                  } else {
                    setStep("escalation_form");
                  }
                }
              }}
              disabled={isLoading}
              className="w-full py-2.5 text-white font-medium rounded-lg disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}
            >
              {isLoading ? "Processing..." : "I understand, continue"}
            </button>
          </motion.div>
        )}

        {step === "goodwill_offer" && reportData && (
          <motion.div key="goodwill_offer" {...fadeIn} className="space-y-4">
            {reportData.cooldownBlocked ? (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="text-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h4 className="font-semibold text-gray-900">Goodwill Credit Not Available</h4>
                  <p className="text-sm text-gray-600 mt-2">{reportData.cooldownReason}</p>
                  {reportData.priorCreditDate && (
                    <p className="text-xs text-gray-400 mt-2">Last credit: ${reportData.priorCreditAmount?.toFixed(2)} on {new Date(reportData.priorCreditDate).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="text-center">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h4 className="font-semibold text-gray-900">Goodwill Credit Available</h4>
                  <p className="text-sm text-gray-600 mt-2">We'd like to offer a <span className="font-bold text-emerald-700">${reportData.goodwillAmount?.toFixed(2)}</span> goodwill credit for the inconvenience.</p>
                  <p className="text-xs text-gray-400 mt-2">This credit will be applied to your next invoice.</p>
                </div>
              </div>
            )}
            {!reportData.cooldownBlocked && (
              <button
                onClick={() => handleAcceptCredit("goodwill")}
                disabled={isLoading}
                className="w-full py-3 text-white font-semibold rounded-xl disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}
              >
                {isLoading ? "Applying credit..." : `Accept $${reportData.goodwillAmount?.toFixed(2)} Credit`}
              </button>
            )}
            <button onClick={() => setStep("escalation_form")} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
              {reportData.cooldownBlocked ? "Contact support" : "No thanks, I'd like to speak with support"}
            </button>
          </motion.div>
        )}

        {step === "escalation_form" && (
          <motion.div key="escalation_form" {...fadeIn} className="space-y-4 bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-sm text-gray-600">Your request will be reviewed by our billing team.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">How should we reach you?</label>
              <div className="flex gap-2">
                <button onClick={() => setContactMethod("email")} className={`flex-1 py-2 rounded-lg text-sm border ${contactMethod === "email" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200"}`}>Email</button>
                <button onClick={() => setContactMethod("phone")} className={`flex-1 py-2 rounded-lg text-sm border ${contactMethod === "phone" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200"}`}>Phone</button>
              </div>
            </div>
            {contactMethod === "phone" && (
              <input type="tel" placeholder="Your phone number" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional notes</label>
              <textarea value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} rows={3} placeholder="Tell us more about your situation..." className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none" />
            </div>
            <button
              onClick={handleEscalate}
              disabled={isLoading || (contactMethod === "phone" && !contactPhone)}
              className="w-full py-2.5 text-white font-medium rounded-lg disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}
            >
              {isLoading ? "Submitting..." : "Submit to Support Team"}
            </button>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div key="success" {...fadeIn} className="bg-white rounded-xl border border-gray-100 p-6 text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h4 className="text-lg font-bold text-gray-900 mb-2">Request Submitted</h4>
            <p className="text-sm text-gray-600 mb-4">{successMessage}</p>
            {ticketId && <p className="text-sm text-emerald-700 font-mono bg-emerald-50 inline-block px-3 py-1 rounded-lg mb-4">Ticket #{ticketId}</p>}
            <button onClick={resetFlow} className="w-full py-2.5 text-white font-medium rounded-lg mt-2" style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}>
              Report Another Issue
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
