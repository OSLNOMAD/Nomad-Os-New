import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface Feedback {
  id: number
  customerEmail: string
  feedbackType: string
  message: string
  rating: number | null
  adminResponse: string | null
  respondedAt: string | null
  respondedBy: string | null
  status: string | null
  createdAt: string
}

interface PortalSetting {
  id: number
  key: string
  value: string
  description: string | null
  updatedAt: string
  updatedBy: string | null
}

interface PauseLog {
  id: number
  customerEmail: string
  subscriptionId: string
  chargebeeCustomerId: string | null
  pauseDurationMonths: number
  pauseDate: string
  resumeDate: string
  travelAddonAdded: boolean | null
  travelAddonItemPriceId: string | null
  pauseReason: string | null
  pauseReasonDetails: string | null
  status: string | null
  createdAt: string
}

interface CancellationRequest {
  id: number
  customerEmail: string
  subscriptionId: string
  subscriptionStatus: string | null
  currentPrice: number | null
  cancellationReason: string | null
  reasonDetails: string | null
  retentionOfferShown: string | null
  retentionOfferAccepted: boolean | null
  discountEligible: boolean | null
  troubleshootingOffered: boolean | null
  troubleshootingAccepted: boolean | null
  preferredContactMethod: string | null
  preferredPhone: string | null
  preferredCallTime: string | null
  zendeskTicketId: string | null
  status: string | null
  createdAt: string
}

interface AddonLog {
  id: number
  customerEmail: string
  subscriptionId: string
  chargebeeCustomerId: string | null
  action: string
  addonFamily: string
  addonItemPriceId: string
  addonName: string | null
  addonPrice: number | null
  invoiceId: string | null
  status: string | null
  errorMessage: string | null
  createdAt: string
}

export default function AdminDashboard() {
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)
  const [responseText, setResponseText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'responded'>('all')
  const [activeTab, setActiveTab] = useState<'feedback' | 'cancellations' | 'pause_logs' | 'plan_changes' | 'addon_logs' | 'settings'>('feedback')
  const [settings, setSettings] = useState<PortalSetting[]>([])
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [slackChannelId, setSlackChannelId] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSuccess, setSettingsSuccess] = useState('')
  const [cancellations, setCancellations] = useState<CancellationRequest[]>([])
  const [cancellationsLoading, setCancellationsLoading] = useState(false)
  const [cancellationFilter, setCancellationFilter] = useState<'all' | 'started' | 'submitted' | 'completed'>('all')
  const [exporting, setExporting] = useState(false)
  const [pauseLogs, setPauseLogs] = useState<PauseLog[]>([])
  const [pauseLogsLoading, setPauseLogsLoading] = useState(false)
  const [pauseLogFilter, setPauseLogFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all')
  const [exportingPauses, setExportingPauses] = useState(false)
  const [planChanges, setPlanChanges] = useState<any[]>([])
  const [planChangesLoading, setPlanChangesLoading] = useState(false)
  const [planChangeFilter, setPlanChangeFilter] = useState<'all' | 'completed' | 'processing' | 'pending'>('all')
  const [exportingPlanChanges, setExportingPlanChanges] = useState(false)
  const [addonLogs, setAddonLogs] = useState<AddonLog[]>([])
  const [addonLogsLoading, setAddonLogsLoading] = useState(false)
  const [addonLogFilter, setAddonLogFilter] = useState<'all' | 'add' | 'remove' | 'completed' | 'failed'>('all')
  const [exportingAddonLogs, setExportingAddonLogs] = useState(false)
  const navigate = useNavigate()

  const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}')

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      navigate('/admin')
      return
    }
    fetchFeedback()
  }, [navigate])

  useEffect(() => {
    if (activeTab === 'settings') {
      fetchSettings()
    } else if (activeTab === 'cancellations') {
      fetchCancellations()
    } else if (activeTab === 'pause_logs') {
      fetchPauseLogs()
    } else if (activeTab === 'plan_changes') {
      fetchPlanChanges()
    } else if (activeTab === 'addon_logs') {
      fetchAddonLogs()
    }
  }, [activeTab])

  const fetchFeedback = async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/feedback', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
        navigate('/admin')
        return
      }

      const data = await response.json()
      setFeedback(data.feedback || [])
    } catch (err) {
      setError('Failed to load feedback')
    } finally {
      setLoading(false)
    }
  }

  const handleRespond = async () => {
    if (!selectedFeedback || !responseText.trim()) return
    
    setSubmitting(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch(`/api/admin/feedback/${selectedFeedback.id}/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ response: responseText })
      })

      if (response.ok) {
        await fetchFeedback()
        setSelectedFeedback(null)
        setResponseText('')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to submit response')
      }
    } catch (err) {
      setError('Failed to submit response')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    navigate('/admin')
  }

  const fetchSettings = async () => {
    setSettingsLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings || [])
        const slackSetting = data.settings?.find((s: PortalSetting) => s.key === 'slack_channel_id')
        if (slackSetting) {
          setSlackChannelId(slackSetting.value)
        }
      }
    } catch (err) {
      setError('Failed to load settings')
    } finally {
      setSettingsLoading(false)
    }
  }

  const fetchCancellations = async () => {
    setCancellationsLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/cancellations', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
        navigate('/admin')
        return
      }

      if (response.ok) {
        const data = await response.json()
        setCancellations(data.cancellations || [])
      }
    } catch (err) {
      setError('Failed to load cancellations')
    } finally {
      setCancellationsLoading(false)
    }
  }

  const handleExportCancellations = async () => {
    setExporting(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/cancellations/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
        navigate('/admin')
        return
      }

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `cancellation-requests-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
      } else {
        setError('Failed to export cancellations')
      }
    } catch (err) {
      setError('Failed to export cancellations')
    } finally {
      setExporting(false)
    }
  }

  const fetchPauseLogs = async () => {
    setPauseLogsLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/pause-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
        navigate('/admin')
        return
      }

      if (response.ok) {
        const data = await response.json()
        setPauseLogs(data.pauses || [])
      }
    } catch (err) {
      setError('Failed to load pause logs')
    } finally {
      setPauseLogsLoading(false)
    }
  }

  const handleExportPauseLogs = async () => {
    setExportingPauses(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/pause-logs/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
        navigate('/admin')
        return
      }

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `pause-logs-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
      } else {
        setError('Failed to export pause logs')
      }
    } catch (err) {
      setError('Failed to export pause logs')
    } finally {
      setExportingPauses(false)
    }
  }

  const filteredPauseLogs = pauseLogs.filter(p => {
    if (pauseLogFilter === 'all') return true
    return (p.status || 'active') === pauseLogFilter
  })

  const fetchPlanChanges = async () => {
    setPlanChangesLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/plan-changes', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
        navigate('/admin')
        return
      }

      if (response.ok) {
        const data = await response.json()
        setPlanChanges(data.planChanges || [])
      }
    } catch (err) {
      setError('Failed to load plan change logs')
    } finally {
      setPlanChangesLoading(false)
    }
  }

  const fetchAddonLogs = async () => {
    setAddonLogsLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/addon-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
        navigate('/admin')
        return
      }
      if (response.ok) {
        const data = await response.json()
        setAddonLogs(data.addonLogs || [])
      }
    } catch (err) {
      setError('Failed to load add-on logs')
    } finally {
      setAddonLogsLoading(false)
    }
  }

  const handleExportPlanChanges = async () => {
    setExportingPlanChanges(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/plan-changes/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
        navigate('/admin')
        return
      }

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `plan-changes-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
      } else {
        setError('Failed to export plan changes')
      }
    } catch (err) {
      setError('Failed to export plan changes')
    } finally {
      setExportingPlanChanges(false)
    }
  }

  const handleExportAddonLogs = async () => {
    setExportingAddonLogs(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/addon-logs/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
        navigate('/admin')
        return
      }
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `addon-logs-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
      } else {
        setError('Failed to export add-on logs')
      }
    } catch (err) {
      setError('Failed to export add-on logs')
    } finally {
      setExportingAddonLogs(false)
    }
  }

  const filteredPlanChanges = planChanges.filter(pc => {
    if (planChangeFilter === 'all') return true
    return (pc.status || 'pending') === planChangeFilter
  })

  const filteredAddonLogs = addonLogs.filter(log => {
    if (addonLogFilter === 'all') return true
    if (addonLogFilter === 'add' || addonLogFilter === 'remove') return log.action === addonLogFilter
    return (log.status || 'completed') === addonLogFilter
  })

  const formatPauseReason = (reason: string | null) => {
    if (!reason) return '-'
    const labels: Record<string, string> = {
      traveling: 'Traveling',
      seasonal: 'Seasonal use only',
      financial: 'Financial reasons',
      temporary_relocation: 'Temporary relocation',
      not_using: 'Not currently using',
      trying_alternative: 'Trying alternative',
      other: 'Other',
    }
    return labels[reason] || reason
  }

  const handleSaveSlackChannel = async () => {
    if (!slackChannelId.trim()) {
      setError('Slack Channel ID is required')
      return
    }
    setSavingSettings(true)
    setError('')
    setSettingsSuccess('')
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: 'slack_channel_id',
          value: slackChannelId.trim()
        })
      })
      if (response.ok) {
        setSettingsSuccess('Slack Channel ID updated successfully!')
        await fetchSettings()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update setting')
      }
    } catch (err) {
      setError('Failed to update setting')
    } finally {
      setSavingSettings(false)
    }
  }

  const filteredFeedback = feedback.filter(f => {
    if (filter === 'pending') return f.status === 'pending' || !f.status
    if (filter === 'responded') return f.status === 'responded'
    return true
  })

  const getFeedbackTypeColor = (type: string) => {
    switch (type) {
      case 'feature_request': return 'bg-blue-100 text-blue-700'
      case 'bug_report': return 'bg-red-100 text-red-700'
      case 'compliment': return 'bg-green-100 text-green-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: '#10a37f' }}></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/logo.svg" alt="Nomad Internet" className="h-8" />
            <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Welcome, {adminUser.name || adminUser.email}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('feedback')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'feedback'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
            style={activeTab === 'feedback' ? { borderColor: '#10a37f', color: '#10a37f' } : {}}
          >
            Customer Feedback
          </button>
          <button
            onClick={() => setActiveTab('cancellations')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'cancellations'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
            style={activeTab === 'cancellations' ? { borderColor: '#10a37f', color: '#10a37f' } : {}}
          >
            Cancellation Requests
          </button>
          <button
            onClick={() => setActiveTab('pause_logs')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pause_logs'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
            style={activeTab === 'pause_logs' ? { borderColor: '#10a37f', color: '#10a37f' } : {}}
          >
            Pause Logs
          </button>
          <button
            onClick={() => setActiveTab('plan_changes')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'plan_changes'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
            style={activeTab === 'plan_changes' ? { borderColor: '#10a37f', color: '#10a37f' } : {}}
          >
            Plan Changes
          </button>
          <button
            onClick={() => setActiveTab('addon_logs')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'addon_logs'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
            style={activeTab === 'addon_logs' ? { borderColor: '#10a37f', color: '#10a37f' } : {}}
          >
            Add-on Logs
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
            style={activeTab === 'settings' ? { borderColor: '#10a37f', color: '#10a37f' } : {}}
          >
            Settings
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
            <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {settingsSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
            {settingsSuccess}
            <button onClick={() => setSettingsSuccess('')} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {activeTab === 'feedback' && (
          <>
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Customer Feedback</h2>
            <p className="text-gray-600">{feedback.length} total submissions</p>
          </div>
          
          <div className="flex gap-2">
            {(['all', 'pending', 'responded'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  filter === f
                    ? 'text-white border-0'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
                style={filter === f ? { background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' } : {}}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'pending' && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-orange-500 text-white rounded-full">
                    {feedback.filter(fb => fb.status === 'pending' || !fb.status).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          {filteredFeedback.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-500">No feedback found</p>
            </div>
          ) : (
            filteredFeedback.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getFeedbackTypeColor(item.feedbackType)}`}>
                        {item.feedbackType.replace('_', ' ')}
                      </span>
                      {item.status === 'responded' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                          Responded
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                          Pending
                        </span>
                      )}
                      {item.rating && (
                        <span className="text-yellow-500">
                          {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-500 mb-2">
                      From: <span className="font-medium text-gray-700">{item.customerEmail}</span>
                      <span className="mx-2">•</span>
                      {formatDate(item.createdAt)}
                    </p>
                    
                    <p className="text-gray-800 whitespace-pre-wrap">{item.message}</p>
                    
                    {item.adminResponse && (
                      <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-xs text-green-600 mb-1">
                          Response by {item.respondedBy} on {formatDate(item.respondedAt!)}
                        </p>
                        <p className="text-green-800">{item.adminResponse}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => {
                        setSelectedFeedback(item)
                        setResponseText(item.adminResponse || '')
                      }}
                      className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                      style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
                    >
                      {item.adminResponse ? 'Edit Response' : 'Respond'}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
          </>
        )}

        {activeTab === 'cancellations' && (
          <>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Cancellation Requests</h2>
                <p className="text-gray-600">{cancellations.length} total requests</p>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                {(['all', 'started', 'submitted', 'completed'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setCancellationFilter(f)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      cancellationFilter === f
                        ? 'text-white border-0'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                    style={cancellationFilter === f ? { background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' } : {}}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
                <button
                  onClick={handleExportCancellations}
                  disabled={exporting}
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
                >
                  {exporting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export CSV
                    </>
                  )}
                </button>
              </div>
            </div>

            {cancellationsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: '#10a37f' }}></div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Customer</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Subscription</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">MRR</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Reason</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Discount</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Zendesk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cancellations
                        .filter(c => {
                          if (cancellationFilter === 'all') return true
                          const status = c.status || 'started'
                          return status === cancellationFilter
                        })
                        .map((c) => (
                          <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 text-gray-600">
                              {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                            </td>
                            <td className="py-3 px-4 font-medium text-gray-900">{c.customerEmail}</td>
                            <td className="py-3 px-4 font-mono text-xs text-gray-600">{c.subscriptionId}</td>
                            <td className="py-3 px-4 text-gray-900 font-medium">
                              {c.currentPrice ? `$${(c.currentPrice / 100).toFixed(2)}` : '-'}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                                {c.cancellationReason?.replace(/_/g, ' ') || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {c.retentionOfferAccepted ? (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Accepted</span>
                              ) : c.retentionOfferShown ? (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Declined</span>
                              ) : c.discountEligible === false ? (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500">Not Eligible</span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500">N/A</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                c.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                c.status === 'submitted' ? 'bg-green-100 text-green-700' :
                                'bg-orange-100 text-orange-700'
                              }`}>
                                {c.status || 'started'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {c.zendeskTicketId ? (
                                <a
                                  href={`https://nomadinternet.zendesk.com/agent/tickets/${c.zendeskTicketId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 font-mono text-xs"
                                >
                                  #{c.zendeskTicketId}
                                </a>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {cancellations.filter(c => {
                    if (cancellationFilter === 'all') return true
                    const status = c.status || 'started'
                    return status === cancellationFilter
                  }).length === 0 && (
                    <div className="py-8 text-center text-gray-500">
                      No cancellation requests found
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'pause_logs' && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Pause Logs</h2>
                <p className="text-gray-600">View all subscription pause requests and reasons</p>
              </div>
              <button
                onClick={handleExportPauseLogs}
                disabled={exportingPauses}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 self-start"
                style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
              >
                {exportingPauses ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              {(['all', 'active', 'completed', 'cancelled'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setPauseLogFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    pauseLogFilter === f
                      ? 'text-white'
                      : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                  }`}
                  style={pauseLogFilter === f ? { background: '#10a37f' } : {}}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? pauseLogs.length : pauseLogs.filter(p => (p.status || 'active') === f).length})
                </button>
              ))}
            </div>

            {pauseLogsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: '#10a37f' }}></div>
              </div>
            ) : filteredPauseLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No pause logs found.
              </div>
            ) : (
              <>
                <div className="sm:hidden space-y-4">
                  {filteredPauseLogs.map((p) => (
                    <div key={p.id} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{p.customerEmail}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          (p.status || 'active') === 'active' ? 'bg-green-100 text-green-800' :
                          p.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {(p.status || 'active').charAt(0).toUpperCase() + (p.status || 'active').slice(1)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleString()}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Subscription:</span>
                          <p className="font-mono text-xs">{p.subscriptionId}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Duration:</span>
                          <p>{p.pauseDurationMonths} month{p.pauseDurationMonths !== 1 ? 's' : ''}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Pause Date:</span>
                          <p>{p.pauseDate ? new Date(p.pauseDate).toLocaleDateString() : '-'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Resume Date:</span>
                          <p>{p.resumeDate ? new Date(p.resumeDate).toLocaleDateString() : '-'}</p>
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Reason:</span>
                        <p className="text-sm font-medium text-gray-800">{formatPauseReason(p.pauseReason)}</p>
                      </div>
                      {p.pauseReasonDetails && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <span className="text-xs text-gray-500">Details:</span>
                          <p className="text-sm text-gray-700 mt-1">{p.pauseReasonDetails}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-3 font-medium text-gray-700">Date</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-700">Customer</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-700">Subscription</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-700">Duration</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-700">Pause</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-700">Resume</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-700">Reason</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-700">Details</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPauseLogs.map((p) => (
                        <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-3 text-gray-600 whitespace-nowrap">
                            {new Date(p.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-3 text-gray-900">{p.customerEmail}</td>
                          <td className="py-3 px-3 font-mono text-xs text-gray-600">{p.subscriptionId}</td>
                          <td className="py-3 px-3 text-gray-700">
                            {p.pauseDurationMonths} mo
                          </td>
                          <td className="py-3 px-3 text-gray-600 whitespace-nowrap">
                            {p.pauseDate ? new Date(p.pauseDate).toLocaleDateString() : '-'}
                          </td>
                          <td className="py-3 px-3 text-gray-600 whitespace-nowrap">
                            {p.resumeDate ? new Date(p.resumeDate).toLocaleDateString() : '-'}
                          </td>
                          <td className="py-3 px-3 text-gray-700">{formatPauseReason(p.pauseReason)}</td>
                          <td className="py-3 px-3 text-gray-600 max-w-xs truncate" title={p.pauseReasonDetails || ''}>
                            {p.pauseReasonDetails || '-'}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              (p.status || 'active') === 'active' ? 'bg-green-100 text-green-800' :
                              p.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {(p.status || 'active').charAt(0).toUpperCase() + (p.status || 'active').slice(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'plan_changes' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Plan Change Logs</h2>
                <p className="text-gray-600">Track all subscription plan changes</p>
              </div>
              <button
                onClick={handleExportPlanChanges}
                disabled={exportingPlanChanges || filteredPlanChanges.length === 0}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#10a37f' }}
              >
                {exportingPlanChanges ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              {(['all', 'completed', 'processing', 'pending'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setPlanChangeFilter(status)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    planChangeFilter === status
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={planChangeFilter === status ? { backgroundColor: '#10a37f' } : {}}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>

            {planChangesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#10a37f' }}></div>
              </div>
            ) : filteredPlanChanges.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No plan change logs found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Customer</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Subscription</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">From Plan</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">From Price</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">To Plan</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">To Price</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlanChanges.map((pc: any) => (
                      <tr key={pc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-600">
                          {pc.createdAt ? new Date(pc.createdAt).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900">{pc.customerEmail}</td>
                        <td className="py-3 px-4 text-gray-600 font-mono text-xs">{pc.subscriptionId}</td>
                        <td className="py-3 px-4 text-gray-600">{pc.currentPlanId}</td>
                        <td className="py-3 px-4 text-gray-600">{pc.currentPrice ? `$${(pc.currentPrice / 100).toFixed(2)}` : '-'}</td>
                        <td className="py-3 px-4 text-gray-900 font-medium">{pc.requestedPlanId}</td>
                        <td className="py-3 px-4 font-medium" style={{ color: '#10a37f' }}>{pc.requestedPrice ? `$${(pc.requestedPrice / 100).toFixed(2)}` : '-'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            pc.status === 'completed' ? 'bg-green-100 text-green-700' :
                            pc.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {pc.status || 'pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === 'addon_logs' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Add-on Management Logs</h2>
                <p className="text-gray-600">Track all add-on additions and removals</p>
              </div>
              <button
                onClick={handleExportAddonLogs}
                disabled={exportingAddonLogs || filteredAddonLogs.length === 0}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#10a37f' }}
              >
                {exportingAddonLogs ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              {(['all', 'add', 'remove', 'completed', 'failed'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setAddonLogFilter(status)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    addonLogFilter === status
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={addonLogFilter === status ? { backgroundColor: '#10a37f' } : {}}
                >
                  {status === 'add' ? 'Added' : status === 'remove' ? 'Removed' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>

            {addonLogsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#10a37f' }}></div>
              </div>
            ) : filteredAddonLogs.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No add-on logs found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Customer</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Subscription</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Action</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Add-on</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Price</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAddonLogs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-600">
                          {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900">{log.customerEmail}</td>
                        <td className="py-3 px-4 text-gray-600 font-mono text-xs">{log.subscriptionId}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            log.action === 'add' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {log.action === 'add' ? 'Added' : 'Removed'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-900">{log.addonName || log.addonFamily}</td>
                        <td className="py-3 px-4 font-medium" style={{ color: '#10a37f' }}>
                          {log.addonPrice ? `$${(log.addonPrice / 100).toFixed(2)}/mo` : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            log.status === 'completed' ? 'bg-green-100 text-green-700' :
                            log.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {log.status || 'completed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Portal Settings</h2>
              <p className="text-gray-600">Configure portal integrations and preferences</p>
            </div>

            {settingsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: '#10a37f' }}></div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Slack Integration</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Configure the Slack channel where cancellation notifications will be sent.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Slack Channel ID
                      </label>
                      <input
                        type="text"
                        value={slackChannelId}
                        onChange={(e) => setSlackChannelId(e.target.value)}
                        placeholder="e.g., C01234567AB or D09CQ87C6UU"
                        className="w-full max-w-md px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        You can find the channel ID by right-clicking on a channel in Slack and selecting "Copy link"
                      </p>
                    </div>
                    
                    <button
                      onClick={handleSaveSlackChannel}
                      disabled={savingSettings}
                      className="px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
                    >
                      {savingSettings ? 'Saving...' : 'Save Channel ID'}
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">All Settings</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Key</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Value</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Description</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700">Last Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settings.map((setting) => (
                          <tr key={setting.id} className="border-b border-gray-100">
                            <td className="py-2 px-3 font-mono text-xs">{setting.key}</td>
                            <td className="py-2 px-3 font-mono text-xs">{setting.value}</td>
                            <td className="py-2 px-3 text-gray-600">{setting.description || '-'}</td>
                            <td className="py-2 px-3 text-gray-500">
                              {new Date(setting.updatedAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <AnimatePresence>
        {selectedFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedFeedback(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-lg"
            >
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Respond to Feedback</h3>
                <p className="text-sm text-gray-500">From: {selectedFeedback.customerEmail}</p>
              </div>
              
              <div className="p-6">
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-600 mb-1">Original Message:</p>
                  <p className="text-gray-800">{selectedFeedback.message}</p>
                </div>
                
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Response</label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  rows={4}
                  placeholder="Type your response here..."
                />
              </div>
              
              <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                <button
                  onClick={() => setSelectedFeedback(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRespond}
                  disabled={!responseText.trim() || submitting}
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
                >
                  {submitting ? 'Submitting...' : 'Submit Response'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
