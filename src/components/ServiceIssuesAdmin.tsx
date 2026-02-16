import { useState, useEffect } from "react";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Server returned an unexpected response");
  }
}

interface ServiceIssue {
  id: number;
  customerEmail: string;
  chargebeeCustomerId: string | null;
  subscriptionId: string | null;
  issueCategory: string;
  outageStatus: string | null;
  outageStart: string | null;
  outageEnd: string | null;
  outageDurationHours: number | null;
  impactType: string | null;
  impactDetails: string | null;
  contactedSupportDuring: boolean;
  supportContactMethod: string | null;
  supportContactDetails: string | null;
  invoiceId: string | null;
  invoiceTotal: number | null;
  termDays: number | null;
  proratedAmount: number | null;
  recommendedCredit: number | null;
  creditAmountApplied: number | null;
  creditType: string | null;
  creditApplied: boolean;
  status: string;
  outcome: string;
  cooldownBlocked: boolean;
  cooldownReason: string | null;
  zendeskTicketId: string | null;
  contactMethod: string | null;
  additionalNotes: string | null;
  adminNotes: string | null;
  reviewedBy: string | null;
  createdAt: string;
}

interface Props {
  token: string;
}

const categoryLabels: Record<string, string> = {
  no_connection: "No Connection",
  slow_speeds: "Slow Speeds",
  other: "Other",
};

const outcomeColors: Record<string, string> = {
  credit_applied: "bg-green-100 text-green-700",
  credit_failed: "bg-red-100 text-red-700",
  escalated: "bg-purple-100 text-purple-700",
  ticket_submitted: "bg-blue-100 text-blue-700",
  pending: "bg-gray-100 text-gray-700",
  denied: "bg-red-100 text-red-700",
};

export function ServiceIssuesAdmin({ token }: Props) {
  const [issues, setIssues] = useState<ServiceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<ServiceIssue | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditType, setCreditType] = useState("downtime");
  const [adminNotes, setAdminNotes] = useState("");
  const [applying, setApplying] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => { loadIssues(); }, []);

  const loadIssues = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/service-issues", { headers });
      const data = await safeJson(res);
      setIssues(data.reports || []);
    } catch (err) {
      console.error("Failed to load service issues:", err);
    } finally {
      setLoading(false);
    }
  };

  const applyCredit = async (issueId: number) => {
    setApplying(true);
    try {
      const res = await fetch(`/api/admin/service-issues/${issueId}/apply-credit`, {
        method: "POST",
        headers,
        body: JSON.stringify({ creditAmount: parseFloat(creditAmount), creditType, adminNotes }),
      });
      const data = await safeJson(res);
      if (data.success) {
        await loadIssues();
        setSelectedIssue(null);
        setCreditAmount("");
        setAdminNotes("");
      }
    } catch (err) {
      console.error("Failed to apply credit:", err);
    } finally {
      setApplying(false);
    }
  };

  const exportCSV = async () => {
    try {
      const res = await fetch("/api/admin/service-issues/export", { headers });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `service_issues_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const filtered = issues.filter((i) => {
    if (categoryFilter !== "all" && i.issueCategory !== categoryFilter) return false;
    if (outcomeFilter !== "all" && i.outcome !== outcomeFilter) return false;
    return true;
  });

  const totalCredits = issues.filter(i => i.creditApplied).reduce((sum, i) => sum + (i.creditAmountApplied || 0), 0);
  const totalNoConnection = issues.filter(i => i.issueCategory === "no_connection").length;
  const totalSlowSpeeds = issues.filter(i => i.issueCategory === "slow_speeds").length;
  const totalEscalated = issues.filter(i => i.outcome === "escalated").length;
  const totalCreditApplied = issues.filter(i => i.outcome === "credit_applied").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Service Issues</h2>
          <p className="text-gray-600">Review service issue reports, apply downtime credits, and manage escalations</p>
        </div>
        <button onClick={exportCSV} className="px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}>Export CSV</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-medium">Total Reports</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{issues.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-medium">No Connection</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{totalNoConnection}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-medium">Slow Speeds</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{totalSlowSpeeds}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-medium">Credits Applied</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{totalCreditApplied}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-medium">Total Credits Given</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">${(totalCredits / 100).toFixed(2)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
          <option value="all">All Categories</option>
          <option value="no_connection">No Connection</option>
          <option value="slow_speeds">Slow Speeds</option>
          <option value="other">Other</option>
        </select>
        <select value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
          <option value="all">All Outcomes</option>
          <option value="pending">Pending</option>
          <option value="credit_applied">Credit Applied</option>
          <option value="escalated">Escalated</option>
          <option value="ticket_submitted">Ticket Submitted</option>
          <option value="denied">Denied</option>
        </select>
        <span className="ml-auto text-sm text-gray-500">{filtered.length} results</span>
      </div>

      {selectedIssue && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Service Issue #{selectedIssue.id}</h3>
              <button onClick={() => setSelectedIssue(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Customer</p>
                  <p className="font-medium text-gray-900">{selectedIssue.customerEmail}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Category</p>
                  <p className="font-medium text-gray-900">{categoryLabels[selectedIssue.issueCategory] || selectedIssue.issueCategory}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Outage Status</p>
                  <p className="font-medium text-gray-900">{selectedIssue.outageStatus || "N/A"}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="font-medium text-gray-900">{selectedIssue.outageDurationHours ? `${selectedIssue.outageDurationHours} hours` : "N/A"}</p>
                </div>
              </div>

              {selectedIssue.outageStart && (
                <div className="bg-blue-50 rounded-lg p-3 text-sm">
                  <p className="text-xs text-blue-600 font-medium mb-1">Outage Timeline</p>
                  <p className="text-blue-800">Start: {new Date(selectedIssue.outageStart).toLocaleString()}</p>
                  {selectedIssue.outageEnd && <p className="text-blue-800">End: {new Date(selectedIssue.outageEnd).toLocaleString()}</p>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Invoice Total</p>
                  <p className="font-medium text-gray-900">{selectedIssue.invoiceTotal ? `$${(selectedIssue.invoiceTotal / 100).toFixed(2)}` : "N/A"}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Term Days</p>
                  <p className="font-medium text-gray-900">{selectedIssue.termDays || "N/A"}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Prorated Amount</p>
                  <p className="font-medium text-gray-900">{selectedIssue.proratedAmount ? `$${(selectedIssue.proratedAmount / 100).toFixed(2)}` : "N/A"}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3">
                  <p className="text-xs text-emerald-600">Recommended Credit</p>
                  <p className="font-bold text-emerald-700">{selectedIssue.recommendedCredit ? `$${(selectedIssue.recommendedCredit / 100).toFixed(2)}` : "N/A"}</p>
                </div>
              </div>

              {selectedIssue.impactDetails && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="text-xs text-gray-500 mb-1">Impact Details</p>
                  <p className="text-gray-700">{selectedIssue.impactDetails}</p>
                </div>
              )}

              {selectedIssue.additionalNotes && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="text-xs text-gray-500 mb-1">Customer Notes</p>
                  <p className="text-gray-700">{selectedIssue.additionalNotes}</p>
                </div>
              )}

              {selectedIssue.cooldownBlocked && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm">
                  <p className="text-xs text-amber-600 font-medium">Cooldown Active</p>
                  <p className="text-amber-800">{selectedIssue.cooldownReason}</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${outcomeColors[selectedIssue.outcome] || "bg-gray-100 text-gray-700"}`}>
                  {selectedIssue.outcome.replace(/_/g, " ")}
                </span>
                {selectedIssue.zendeskTicketId && <span className="text-xs text-blue-600 font-mono">Zendesk #{selectedIssue.zendeskTicketId}</span>}
                {selectedIssue.creditApplied && selectedIssue.creditAmountApplied && (
                  <span className="text-xs text-green-600 font-medium">Credit: ${(selectedIssue.creditAmountApplied / 100).toFixed(2)}</span>
                )}
              </div>

              {!selectedIssue.creditApplied && selectedIssue.outcome !== "denied" && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <h4 className="font-semibold text-gray-900 text-sm">Apply Credit (Admin)</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Credit Amount ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={creditAmount}
                        onChange={(e) => setCreditAmount(e.target.value)}
                        placeholder={selectedIssue.recommendedCredit ? (selectedIssue.recommendedCredit / 100).toFixed(2) : "0.00"}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Credit Type</label>
                      <select value={creditType} onChange={(e) => setCreditType(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                        <option value="downtime">Downtime Credit</option>
                        <option value="goodwill">Goodwill Credit</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Admin Notes</label>
                    <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => applyCredit(selectedIssue.id)}
                      disabled={applying || !creditAmount}
                      className="flex-1 py-2 text-sm text-white font-medium rounded-lg disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #0d9668, #10a37f)" }}
                    >
                      {applying ? "Applying..." : "Apply Credit"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <p className="text-gray-500">No service issue reports found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Duration</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Rec. Credit</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Outcome</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((issue) => (
                  <tr key={issue.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">
                      {issue.createdAt ? new Date(issue.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 text-xs">{issue.customerEmail}</p>
                      {issue.chargebeeCustomerId && <p className="text-xs text-gray-400">{issue.chargebeeCustomerId}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${issue.issueCategory === "no_connection" ? "bg-red-100 text-red-700" : issue.issueCategory === "slow_speeds" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>
                        {categoryLabels[issue.issueCategory] || issue.issueCategory}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {issue.outageDurationHours ? `${issue.outageDurationHours}h` : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {issue.recommendedCredit ? `$${(issue.recommendedCredit / 100).toFixed(2)}` : issue.creditType === "goodwill" ? "$10.00" : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${outcomeColors[issue.outcome] || "bg-gray-100 text-gray-700"}`}>
                        {issue.outcome.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setSelectedIssue(issue); setCreditAmount(issue.recommendedCredit ? (issue.recommendedCredit / 100).toFixed(2) : ""); setCreditType(issue.creditType || "downtime"); }} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
