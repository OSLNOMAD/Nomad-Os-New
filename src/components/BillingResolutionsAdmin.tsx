import { useState, useEffect } from "react";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Server returned an unexpected response");
  }
}

interface BillingResolution {
  id: number;
  customerEmail: string;
  chargebeeCustomerId: string | null;
  issueType: string;
  issueDetails: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  subscriptionPrice: number | null;
  creditOffered: number | null;
  creditType: string | null;
  outcome: string;
  creditApplied: boolean;
  zendeskTicketId: string | null;
  contactMethod: string | null;
  trackingNumber: string | null;
  proofFileName: string | null;
  createdAt: string;
}

interface CreditConfig {
  id: number;
  issueType: string;
  label: string;
  creditType: string;
  creditAmountCents: number;
  creditPercentage: number;
  maxCreditCents: number | null;
  enabled: boolean;
  description: string | null;
}

interface Props {
  token: string;
}

const issueLabels: Record<string, string> = {
  service_not_working: "Service Not Working",
  incorrect_charge: "Incorrect Charge",
  cancelled_still_charged: "Cancelled Still Charged",
  equipment_return: "Equipment Return",
  unhappy_with_service: "Unhappy With Service",
  other_billing: "Other Billing",
};

const outcomeColors: Record<string, string> = {
  credit_accepted: "bg-green-100 text-green-700",
  credit_declined: "bg-orange-100 text-orange-700",
  credit_offered: "bg-blue-100 text-blue-700",
  credit_failed: "bg-red-100 text-red-700",
  escalated: "bg-purple-100 text-purple-700",
  escalation_pending: "bg-yellow-100 text-yellow-700",
  pending: "bg-gray-100 text-gray-700",
};

export function BillingResolutionsAdmin({ token }: Props) {
  const [view, setView] = useState<"logs" | "config">("logs");
  const [resolutions, setResolutions] = useState<BillingResolution[]>([]);
  const [configs, setConfigs] = useState<CreditConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(false);
  const [editingConfig, setEditingConfig] = useState<CreditConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [issueFilter, setIssueFilter] = useState<string>("all");

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    loadResolutions();
    loadConfigs();
  }, []);

  const loadResolutions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/billing-resolutions", { headers });
      const data = await safeJson(res);
      setResolutions(data.resolutions || []);
    } catch (err) {
      console.error("Failed to load resolutions:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadConfigs = async () => {
    setConfigLoading(true);
    try {
      const res = await fetch("/api/admin/billing-credit-config", { headers });
      const data = await safeJson(res);
      setConfigs(data.configs || []);
    } catch (err) {
      console.error("Failed to load configs:", err);
    } finally {
      setConfigLoading(false);
    }
  };

  const saveConfig = async (config: CreditConfig) => {
    setSavingConfig(true);
    try {
      await fetch("/api/admin/billing-credit-config", {
        method: "POST",
        headers,
        body: JSON.stringify(config),
      });
      await loadConfigs();
      setEditingConfig(null);
    } catch (err) {
      console.error("Failed to save config:", err);
    } finally {
      setSavingConfig(false);
    }
  };

  const exportCSV = async () => {
    try {
      const res = await fetch("/api/admin/billing-resolutions/export", { headers });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `billing_resolutions_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const filteredResolutions = resolutions.filter((r) => {
    if (outcomeFilter !== "all" && r.outcome !== outcomeFilter) return false;
    if (issueFilter !== "all" && r.issueType !== issueFilter) return false;
    return true;
  });

  const totalCreditsApplied = resolutions.filter((r) => r.creditApplied).reduce((sum, r) => sum + (r.creditOffered || 0), 0);
  const totalEscalated = resolutions.filter((r) => r.outcome === "escalated").length;
  const totalCreditAccepted = resolutions.filter((r) => r.outcome === "credit_accepted").length;
  const totalCreditDeclined = resolutions.filter((r) => r.outcome === "credit_declined").length;
  const acceptRate = totalCreditAccepted + totalCreditDeclined > 0 ? Math.round((totalCreditAccepted / (totalCreditAccepted + totalCreditDeclined)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Billing Resolutions</h2>
          <p className="text-gray-600">Track customer billing resolution outcomes and configure credit offers</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView("logs")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${view === "logs" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Resolution Logs
          </button>
          <button
            onClick={() => setView("config")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${view === "config" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Credit Configuration
          </button>
        </div>
      </div>

      {view === "logs" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 font-medium">Total Resolutions</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{resolutions.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 font-medium">Credits Accepted</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{totalCreditAccepted}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 font-medium">Escalated to Support</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{totalEscalated}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 font-medium">Credit Accept Rate</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{acceptRate}%</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 font-medium">Total Credits Given</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">${(totalCreditsApplied / 100).toFixed(2)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="all">All Outcomes</option>
              <option value="credit_accepted">Credit Accepted</option>
              <option value="credit_declined">Credit Declined</option>
              <option value="escalated">Escalated</option>
              <option value="credit_offered">Credit Offered</option>
              <option value="credit_failed">Credit Failed</option>
            </select>
            <select
              value={issueFilter}
              onChange={(e) => setIssueFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="all">All Issue Types</option>
              {Object.entries(issueLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <button
              onClick={exportCSV}
              className="ml-auto px-4 py-2 text-sm font-medium text-white rounded-lg"
              style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}
            >
              Export CSV
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredResolutions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <p className="text-gray-500">No billing resolutions found</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Customer</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Issue Type</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Credit Offered</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Outcome</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Zendesk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResolutions.map((r) => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-xs">{r.customerEmail}</p>
                          {r.chargebeeCustomerId && <p className="text-xs text-gray-400">{r.chargebeeCustomerId}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-700">{issueLabels[r.issueType] || r.issueType}</span>
                        </td>
                        <td className="px-4 py-3">
                          {r.creditOffered ? `$${(r.creditOffered / 100).toFixed(2)}` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${outcomeColors[r.outcome] || "bg-gray-100 text-gray-700"}`}>
                            {r.outcome.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {r.zendeskTicketId ? (
                            <span className="text-xs text-blue-600 font-mono">#{r.zendeskTicketId}</span>
                          ) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {view === "config" && (
        <>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div className="text-sm text-blue-700">
                <p className="font-medium">How credit configuration works</p>
                <p className="text-xs mt-1">Configure the credit amount offered to customers for each issue type. "Fixed" credits offer a set dollar amount. "Percentage" credits calculate based on the customer's subscription price. Escalation types (Cancelled Still Charged, Equipment Return) skip the credit offer and go directly to support ticket creation.</p>
              </div>
            </div>
          </div>

          {configLoading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <div className="space-y-3">
              {configs.map((config) => (
                <div key={config.id} className="bg-white rounded-xl border border-gray-100 p-5">
                  {editingConfig?.id === config.id ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">{config.label}</h3>
                        <span className="text-xs text-gray-400 font-mono">{config.issueType}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Credit Type</label>
                          <select
                            value={editingConfig.creditType}
                            onChange={(e) => setEditingConfig({ ...editingConfig, creditType: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                          >
                            <option value="fixed">Fixed Amount</option>
                            <option value="percentage">Percentage of Plan</option>
                          </select>
                        </div>
                        {editingConfig.creditType === "fixed" ? (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Credit Amount ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={(editingConfig.creditAmountCents / 100).toFixed(2)}
                              onChange={(e) => setEditingConfig({ ...editingConfig, creditAmountCents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Percentage (%)</label>
                              <input
                                type="number"
                                value={editingConfig.creditPercentage}
                                onChange={(e) => setEditingConfig({ ...editingConfig, creditPercentage: parseInt(e.target.value || "0") })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                              />
                            </div>
                          </>
                        )}
                      </div>
                      {editingConfig.creditType === "percentage" && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Max Credit Cap ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editingConfig.maxCreditCents ? (editingConfig.maxCreditCents / 100).toFixed(2) : ""}
                            onChange={(e) => setEditingConfig({ ...editingConfig, maxCreditCents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })}
                            placeholder="No cap"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editingConfig.enabled}
                          onChange={(e) => setEditingConfig({ ...editingConfig, enabled: e.target.checked })}
                          className="rounded"
                        />
                        <label className="text-sm text-gray-700">Enabled</label>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingConfig(null)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                        <button
                          onClick={() => saveConfig(editingConfig)}
                          disabled={savingConfig}
                          className="px-4 py-2 text-sm text-white rounded-lg"
                          style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}
                        >
                          {savingConfig ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${config.enabled ? "bg-green-400" : "bg-gray-300"}`} />
                        <div>
                          <h3 className="font-semibold text-gray-900">{config.label}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          {config.creditType === "fixed" ? (
                            <p className="font-semibold text-gray-900">${(config.creditAmountCents / 100).toFixed(2)}</p>
                          ) : (
                            <p className="font-semibold text-gray-900">{config.creditPercentage}% of plan{config.maxCreditCents ? ` (max $${(config.maxCreditCents / 100).toFixed(2)})` : ""}</p>
                          )}
                          <p className="text-xs text-gray-400">{config.creditType === "fixed" ? "Fixed credit" : "Percentage credit"}</p>
                        </div>
                        <button
                          onClick={() => setEditingConfig({ ...config })}
                          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
