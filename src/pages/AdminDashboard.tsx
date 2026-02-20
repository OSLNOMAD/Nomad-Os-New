import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BillingResolutionsAdmin } from '../components/BillingResolutionsAdmin'
import { ServiceIssuesAdmin } from '../components/ServiceIssuesAdmin'

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

interface ApiLog {
  id: number
  service: string
  endpoint: string
  method: string
  statusCode: number | null
  durationMs: number | null
  success: boolean
  errorMessage: string | null
  customerEmail: string | null
  triggeredBy: string | null
  createdAt: string
}

interface EarlyPaymentLog {
  id: number
  customerId: number
  customerEmail: string
  subscriptionId: string
  chargebeeCustomerId: string | null
  planId: string | null
  planName: string | null
  termsCharged: number
  invoiceId: string | null
  totalAmount: number | null
  status: string | null
  errorMessage: string | null
  createdAt: string
}

interface PaymentAnalysisResult {
  customer_id: string
  customer_name: string
  email: string
  previous_success_amount: string
  current_success_amount: string
  delta: string
  reason: string
  subscription_status: string
  billing_date: string
  last_payment_date: string
}

interface CsvCustomer {
  customer_id: string
  customer_name: string
  email: string
  company: string
  previous_success_amount: string
  current_success_amount: string
  delta: string
  previous_attempts: string
  current_attempts: string
  current_failed_count: string
  top_error_code: string
  top_error_text: string
  category: string
}

export default function AdminDashboard() {
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)
  const [responseText, setResponseText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'responded'>('all')
  const [activeTab, setActiveTab] = useState<'feedback' | 'cancellations' | 'pause_logs' | 'plan_changes' | 'addon_logs' | 'api_logs' | 'payment_analysis' | 'billing_resolutions' | 'service_issues' | 'early_payments' | 'qr_access' | 'settings'>('feedback')
  const [openNavGroup, setOpenNavGroup] = useState<string | null>('customer')
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
  const [earlyPaymentLogs, setEarlyPaymentLogs] = useState<EarlyPaymentLog[]>([])
  const [earlyPaymentLogsLoading, setEarlyPaymentLogsLoading] = useState(false)
  const [earlyPaymentFilter, setEarlyPaymentFilter] = useState<'all' | 'completed' | 'failed'>('all')
  const [exportingEarlyPayments, setExportingEarlyPayments] = useState(false)
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([])
  const [apiLogsLoading, setApiLogsLoading] = useState(false)
  const [apiLogFilter, setApiLogFilter] = useState<'all' | 'chargebee' | 'shopify' | 'shipstation' | 'thingspace' | 'failed'>('all')
  const [exportingApiLogs, setExportingApiLogs] = useState(false)
  const [zendeskGroups, setZendeskGroups] = useState<{id: string, name: string, description: string}[]>([])
  const [zendeskUsers, setZendeskUsers] = useState<{id: string, name: string, email: string}[]>([])
  const [zendeskGroupsLoading, setZendeskGroupsLoading] = useState(false)
  const [zendeskUsersLoading, setZendeskUsersLoading] = useState(false)
  const [paymentAnalysisResults, setPaymentAnalysisResults] = useState<PaymentAnalysisResult[]>([])
  const [paymentAnalysisLoading, setPaymentAnalysisLoading] = useState(false)
  const [paymentAnalysisProgress, setPaymentAnalysisProgress] = useState({ current: 0, total: 0 })
  const [_paymentCsvFile, setPaymentCsvFile] = useState<File | null>(null)
  const [paymentCsvData, setPaymentCsvData] = useState<CsvCustomer[]>([])
  const [exportingPaymentAnalysis, setExportingPaymentAnalysis] = useState(false)
  const [troubleshootingGroupId, setTroubleshootingGroupId] = useState('')
  const [troubleshootingAssigneeId, setTroubleshootingAssigneeId] = useState('')
  const [cancellationGroupId, setCancellationGroupId] = useState('')
  const [cancellationAssigneeId, setCancellationAssigneeId] = useState('')
  const [savingZendesk, setSavingZendesk] = useState(false)
  const [qrAccessGrants, setQrAccessGrants] = useState<any[]>([])
  const [qrAccessLoading, setQrAccessLoading] = useState(false)
  const [qrAuditLogs, setQrAuditLogs] = useState<any[]>([])
  const [qrNewEmail, setQrNewEmail] = useState('')
  const [qrGranting, setQrGranting] = useState(false)
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
      fetchZendeskGroups()
      fetchZendeskUsers()
    } else if (activeTab === 'cancellations') {
      fetchCancellations()
    } else if (activeTab === 'pause_logs') {
      fetchPauseLogs()
    } else if (activeTab === 'plan_changes') {
      fetchPlanChanges()
    } else if (activeTab === 'addon_logs') {
      fetchAddonLogs()
    } else if (activeTab === 'api_logs') {
      fetchApiLogs()
    } else if (activeTab === 'early_payments') {
      fetchEarlyPaymentLogs()
    } else if (activeTab === 'qr_access') {
      fetchQrAccessGrants()
      fetchQrAuditLogs()
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
        if (slackSetting) setSlackChannelId(slackSetting.value)
        const tsGroup = data.settings?.find((s: PortalSetting) => s.key === 'zendesk_troubleshooting_group_id')
        if (tsGroup) setTroubleshootingGroupId(tsGroup.value)
        const tsAssignee = data.settings?.find((s: PortalSetting) => s.key === 'zendesk_troubleshooting_assignee_id')
        if (tsAssignee) setTroubleshootingAssigneeId(tsAssignee.value)
        const cancelGroup = data.settings?.find((s: PortalSetting) => s.key === 'zendesk_cancellation_group_id')
        if (cancelGroup) setCancellationGroupId(cancelGroup.value)
        const cancelAssignee = data.settings?.find((s: PortalSetting) => s.key === 'zendesk_cancellation_assignee_id')
        if (cancelAssignee) setCancellationAssigneeId(cancelAssignee.value)
      }
    } catch (err) {
      setError('Failed to load settings')
    } finally {
      setSettingsLoading(false)
    }
  }

  const fetchZendeskGroups = async () => {
    setZendeskGroupsLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/zendesk/groups', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setZendeskGroups(data.groups || [])
      }
    } catch (err) {
      console.error('Failed to fetch Zendesk groups:', err)
    } finally {
      setZendeskGroupsLoading(false)
    }
  }

  const fetchZendeskUsers = async (groupId?: string) => {
    setZendeskUsersLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const url = groupId ? `/api/admin/zendesk/users?group_id=${groupId}` : '/api/admin/zendesk/users'
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setZendeskUsers(data.users || [])
      }
    } catch (err) {
      console.error('Failed to fetch Zendesk users:', err)
    } finally {
      setZendeskUsersLoading(false)
    }
  }

  const saveZendeskRouting = async (settingKey: string, value: string) => {
    setSavingZendesk(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ key: settingKey, value })
      })
      if (response.ok) {
        setSettingsSuccess('Zendesk routing updated successfully!')
        await fetchSettings()
      }
    } catch (err) {
      setError('Failed to save Zendesk routing')
    } finally {
      setSavingZendesk(false)
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

  const fetchApiLogs = async () => {
    setApiLogsLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/api-logs?limit=500', {
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
        setApiLogs(data.apiLogs || [])
      }
    } catch (err) {
      setError('Failed to load API logs')
    } finally {
      setApiLogsLoading(false)
    }
  }

  const fetchEarlyPaymentLogs = async () => {
    setEarlyPaymentLogsLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/early-payment-logs', {
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
        setEarlyPaymentLogs(data.earlyPaymentLogs || [])
      }
    } catch (err) {
      setError('Failed to load early payment logs')
    } finally {
      setEarlyPaymentLogsLoading(false)
    }
  }

  const fetchQrAccessGrants = async () => {
    setQrAccessLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/qr-access', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setQrAccessGrants(data.grants || [])
      }
    } catch (err) {
      setError('Failed to load QR access grants')
    } finally {
      setQrAccessLoading(false)
    }
  }

  const fetchQrAuditLogs = async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/qr-audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setQrAuditLogs(data.logs || [])
      }
    } catch (err) {
      console.error('Failed to load QR audit logs')
    }
  }

  const handleGrantQrAccess = async () => {
    if (!qrNewEmail.trim()) return
    setQrGranting(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/qr-access/grant', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminEmail: qrNewEmail.trim() })
      })
      if (response.ok) {
        setQrNewEmail('')
        fetchQrAccessGrants()
        fetchQrAuditLogs()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to grant access')
      }
    } catch (err) {
      setError('Failed to grant access')
    } finally {
      setQrGranting(false)
    }
  }

  const handleRevokeQrAccess = async (adminEmail: string) => {
    if (!confirm(`Revoke QR App access for ${adminEmail}?`)) return
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/qr-access/revoke', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminEmail })
      })
      if (response.ok) {
        fetchQrAccessGrants()
        fetchQrAuditLogs()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to revoke access')
      }
    } catch (err) {
      setError('Failed to revoke access')
    }
  }

  const handleExportEarlyPayments = async () => {
    setExportingEarlyPayments(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/early-payment-logs/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `early-payment-logs-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
      }
    } catch (err) {
      setError('Failed to export early payment logs')
    } finally {
      setExportingEarlyPayments(false)
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

  const handleExportApiLogs = async () => {
    setExportingApiLogs(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/api/admin/api-logs/export', {
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
        a.download = `api-logs-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
      } else {
        setError('Failed to export API logs')
      }
    } catch (err) {
      setError('Failed to export API logs')
    } finally {
      setExportingApiLogs(false)
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

  const filteredApiLogs = apiLogs.filter(log => {
    if (apiLogFilter === 'all') return true
    if (apiLogFilter === 'failed') return !log.success
    return log.service === apiLogFilter
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

  const handlePaymentCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPaymentCsvFile(file)
    setPaymentAnalysisResults([])

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) return

      const headerLine = lines[0]
      const headers = headerLine.split(',').map(h => h.replace(/"/g, '').trim())

      const customers: CsvCustomer[] = []
      for (let i = 1; i < lines.length; i++) {
        const values: string[] = []
        let current = ''
        let inQuotes = false
        for (const ch of lines[i]) {
          if (ch === '"') { inQuotes = !inQuotes; continue }
          if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue }
          current += ch
        }
        values.push(current.trim())

        const row: any = {}
        headers.forEach((h, idx) => { row[h] = values[idx] || '' })
        customers.push(row as CsvCustomer)
      }
      setPaymentCsvData(customers)
    }
    reader.readAsText(file)
  }

  const runPaymentAnalysis = async () => {
    if (paymentCsvData.length === 0) return
    setPaymentAnalysisLoading(true)
    setPaymentAnalysisResults([])
    setPaymentAnalysisProgress({ current: 0, total: paymentCsvData.length })

    try {
      const token = localStorage.getItem('admin_token')
      const batchSize = 10
      const allResults: PaymentAnalysisResult[] = []

      for (let i = 0; i < paymentCsvData.length; i += batchSize) {
        const batch = paymentCsvData.slice(i, i + batchSize)
        const response = await fetch('/api/admin/payment-analysis', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ customers: batch })
        })

        if (response.ok) {
          const data = await response.json()
          allResults.push(...data.results)
          setPaymentAnalysisResults([...allResults])
          setPaymentAnalysisProgress({ current: Math.min(i + batchSize, paymentCsvData.length), total: paymentCsvData.length })
        } else {
          const data = await response.json()
          setError(data.error || 'Failed to analyze batch')
        }
      }
    } catch (err) {
      setError('Failed to run payment analysis')
    } finally {
      setPaymentAnalysisLoading(false)
    }
  }

  const exportPaymentAnalysis = () => {
    if (paymentAnalysisResults.length === 0) return
    setExportingPaymentAnalysis(true)
    const headers = ['Customer ID', 'Customer Name', 'Email', 'Previous Amount', 'Current Amount', 'Delta', 'Subscription Status', 'Billing Date', 'Last Payment Date', 'Reason']
    const rows = paymentAnalysisResults.map(r => [
      r.customer_id,
      r.customer_name,
      r.email,
      r.previous_success_amount,
      r.current_success_amount,
      r.delta,
      r.subscription_status,
      r.billing_date,
      r.last_payment_date,
      `"${(r.reason || '').replace(/"/g, '""')}"`
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payment_analysis_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportingPaymentAnalysis(false)
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

      <div className="flex min-h-[calc(100vh-65px)]">
        <aside className="w-56 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto">
          <nav className="py-4">
            {[
              {
                group: 'customer',
                label: 'Customer',
                items: [
                  { key: 'feedback' as const, label: 'Feedback' },
                  { key: 'cancellations' as const, label: 'Cancellations' },
                ],
              },
              {
                group: 'subscriptions',
                label: 'Subscriptions',
                items: [
                  { key: 'pause_logs' as const, label: 'Pause Logs' },
                  { key: 'plan_changes' as const, label: 'Plan Changes' },
                  { key: 'addon_logs' as const, label: 'Add-on Logs' },
                  { key: 'early_payments' as const, label: 'Early Payments' },
                ],
              },
              {
                group: 'billing',
                label: 'Billing & Support',
                items: [
                  { key: 'payment_analysis' as const, label: 'Payment Analysis' },
                  { key: 'billing_resolutions' as const, label: 'Billing Resolutions' },
                  { key: 'service_issues' as const, label: 'Service Issues' },
                ],
              },
              {
                group: 'system',
                label: 'System',
                items: [
                  { key: 'api_logs' as const, label: 'API Logs' },
                  { key: 'qr_access' as const, label: 'Nomad QR Access' },
                  { key: 'settings' as const, label: 'Settings' },
                ],
              },
            ].map((section) => {
              const isOpen = openNavGroup === section.group || section.items.some(i => i.key === activeTab)
              return (
                <div key={section.group} className="mb-1">
                  <button
                    onClick={() => setOpenNavGroup(isOpen && !section.items.some(i => i.key === activeTab) ? null : section.group)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {section.label}
                    <svg
                      className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="mt-0.5">
                      {section.items.map((item) => (
                        <button
                          key={item.key}
                          onClick={() => setActiveTab(item.key)}
                          className={`w-full text-left px-6 py-2 text-sm transition-colors ${
                            activeTab === item.key
                              ? 'font-medium border-r-2'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                          style={activeTab === item.key ? { color: '#10a37f', borderColor: '#10a37f', backgroundColor: 'rgba(16, 163, 127, 0.05)' } : {}}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </aside>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 overflow-y-auto">

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

        {activeTab === 'api_logs' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">External API Request Logs</h2>
                <p className="text-gray-600">Monitor all outgoing API requests to Chargebee, Shopify, Shipstation, ThingSpace</p>
              </div>
              <button
                onClick={handleExportApiLogs}
                disabled={exportingApiLogs || filteredApiLogs.length === 0}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#10a37f' }}
              >
                {exportingApiLogs ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
              {(['all', 'chargebee', 'shopify', 'shipstation', 'thingspace', 'failed'] as const).map(filter => (
                <button
                  key={filter}
                  onClick={() => setApiLogFilter(filter)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    apiLogFilter === filter
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={apiLogFilter === filter ? { backgroundColor: filter === 'failed' ? '#ef4444' : '#10a37f' } : {}}
                >
                  {filter === 'all' ? 'All' : filter === 'failed' ? 'Failed' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            {apiLogsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#10a37f' }}></div>
              </div>
            ) : filteredApiLogs.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No API logs found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Time</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Service</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Endpoint</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Method</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Duration</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Customer</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApiLogs.map((log) => (
                      <tr key={log.id} className={`border-b border-gray-100 hover:bg-gray-50 ${!log.success ? 'bg-red-50' : ''}`}>
                        <td className="py-3 px-4 text-gray-600 text-xs">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                            log.service === 'chargebee' ? 'bg-purple-100 text-purple-700' :
                            log.service === 'shopify' ? 'bg-green-100 text-green-700' :
                            log.service === 'shipstation' ? 'bg-blue-100 text-blue-700' :
                            log.service === 'thingspace' ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {log.service}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600 font-mono text-xs max-w-xs truncate" title={log.endpoint}>
                          {log.endpoint}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                            log.method === 'GET' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {log.method}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-sm">
                          <span className={log.statusCode && log.statusCode >= 400 ? 'text-red-600 font-bold' : 'text-gray-700'}>
                            {log.statusCode || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {log.durationMs ? `${log.durationMs}ms` : '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-xs">
                          {log.customerEmail || '-'}
                        </td>
                        <td className="py-3 px-4">
                          {log.success ? (
                            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">OK</span>
                          ) : (
                            <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700" title={log.errorMessage || ''}>
                              Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === 'payment_analysis' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Payment Analysis</h2>
                <p className="text-gray-600">Upload a CSV to analyze why customers didn't pay this billing cycle</p>
              </div>
              {paymentAnalysisResults.length > 0 && (
                <button
                  onClick={exportPaymentAnalysis}
                  disabled={exportingPaymentAnalysis}
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
                >
                  {exportingPaymentAnalysis ? 'Exporting...' : 'Export Results CSV'}
                </button>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <label className="flex-1">
                  <span className="block text-sm font-medium text-gray-700 mb-2">Upload CSV File</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handlePaymentCsvUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                  />
                </label>
                {paymentCsvData.length > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">{paymentCsvData.length} customers loaded</span>
                    <button
                      onClick={runPaymentAnalysis}
                      disabled={paymentAnalysisLoading}
                      className="px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
                    >
                      {paymentAnalysisLoading ? 'Analyzing...' : 'Run Analysis'}
                    </button>
                  </div>
                )}
              </div>

              {paymentAnalysisLoading && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>Processing customers...</span>
                    <span>{paymentAnalysisProgress.current} / {paymentAnalysisProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${paymentAnalysisProgress.total > 0 ? (paymentAnalysisProgress.current / paymentAnalysisProgress.total) * 100 : 0}%`,
                        background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {paymentAnalysisResults.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prev Amount</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Curr Amount</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Billing Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Payment</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paymentAnalysisResults.map((r, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{r.customer_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{r.email}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">${r.previous_success_amount}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">${r.current_success_amount}</td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                              r.subscription_status === 'active' ? 'bg-green-100 text-green-700' :
                              r.subscription_status === 'cancelled' ? 'bg-red-100 text-red-700' :
                              r.subscription_status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {r.subscription_status || 'unknown'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{r.billing_date || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{r.last_payment_date || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 max-w-md">
                            <span className={`${
                              r.reason.toLowerCase().includes('cancelled') ? 'text-red-600' :
                              r.reason.toLowerCase().includes('paused') ? 'text-yellow-600' :
                              r.reason.toLowerCase().includes('failing') || r.reason.toLowerCase().includes('unpaid') ? 'text-orange-600' :
                              r.reason.toLowerCase().includes('already paid') || r.reason.toLowerCase().includes('on time') ? 'text-green-600' :
                              'text-gray-700'
                            }`}>
                              {r.reason}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
                  {paymentAnalysisResults.length} results
                  {' | '}
                  {paymentAnalysisResults.filter(r => r.subscription_status === 'cancelled').length} cancelled
                  {' | '}
                  {paymentAnalysisResults.filter(r => r.subscription_status === 'paused').length} paused
                  {' | '}
                  {paymentAnalysisResults.filter(r => r.reason.toLowerCase().includes('failing') || r.reason.toLowerCase().includes('unpaid')).length} payment issues
                  {' | '}
                  {paymentAnalysisResults.filter(r => r.reason.toLowerCase().includes('already paid') || r.reason.toLowerCase().includes('late retry') || r.reason.toLowerCase().includes('billing date')).length} already paid / billing date shift
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'billing_resolutions' && (
          <BillingResolutionsAdmin token={localStorage.getItem('admin_token') || ''} />
        )}

        {activeTab === 'service_issues' && (
          <ServiceIssuesAdmin token={localStorage.getItem('admin_token') || ''} />
        )}

        {activeTab === 'early_payments' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Early Payment Logs</h2>
                <p className="text-gray-600">{earlyPaymentLogs.length} total entries</p>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex gap-1">
                  {(['all', 'completed', 'failed'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setEarlyPaymentFilter(f)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        earlyPaymentFilter === f
                          ? 'text-white border-0'
                          : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                      style={earlyPaymentFilter === f ? { background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' } : {}}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleExportEarlyPayments}
                  disabled={exportingEarlyPayments}
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
                >
                  {exportingEarlyPayments ? 'Exporting...' : 'Export CSV'}
                </button>
              </div>
            </div>

            {earlyPaymentLogsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: '#10a37f' }}></div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subscription</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Terms</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {earlyPaymentLogs
                        .filter(log => earlyPaymentFilter === 'all' || log.status === earlyPaymentFilter)
                        .length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No early payment logs found</td>
                        </tr>
                      ) : (
                        earlyPaymentLogs
                          .filter(log => earlyPaymentFilter === 'all' || log.status === earlyPaymentFilter)
                          .map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{log.customerEmail}</td>
                            <td className="px-4 py-3 text-sm font-mono text-gray-600">{log.subscriptionId}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{log.planName || log.planId || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">{log.termsCharged}</td>
                            <td className="px-4 py-3 text-sm font-mono text-gray-600">{log.invoiceId || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                              {log.totalAmount ? `$${(log.totalAmount / 100).toFixed(2)}` : '-'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                log.status === 'completed'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {log.status || 'unknown'}
                              </span>
                              {log.errorMessage && (
                                <p className="text-xs text-red-500 mt-1">{log.errorMessage}</p>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'qr_access' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Nomad QR App Access</h2>
              <p className="text-gray-600">Manage which admin users can access the internal QR device label tool</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Grant Access</h3>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
                  <input
                    type="email"
                    value={qrNewEmail}
                    onChange={(e) => setQrNewEmail(e.target.value)}
                    placeholder="admin@nomadinternet.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleGrantQrAccess()}
                  />
                </div>
                <button
                  onClick={handleGrantQrAccess}
                  disabled={qrGranting || !qrNewEmail.trim()}
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
                >
                  {qrGranting ? 'Granting...' : 'Grant Access'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">The user must already have an admin account. Access allows them to use the QR App at /ops/nomad-qr</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Active Access Grants</h3>
              </div>
              {qrAccessLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: '#10a37f' }}></div>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Granted By</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Granted At</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {qrAccessGrants.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No access grants yet</td></tr>
                    ) : (
                      qrAccessGrants.map((grant: any) => (
                        <tr key={grant.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{grant.adminEmail}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{grant.grantedBy}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{new Date(grant.grantedAt).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              grant.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {grant.isActive ? 'Active' : 'Revoked'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {grant.isActive && (
                              <button
                                onClick={() => handleRevokeQrAccess(grant.adminEmail)}
                                className="text-sm text-red-600 hover:text-red-800 font-medium"
                              >
                                Revoke
                              </button>
                            )}
                            {!grant.isActive && (
                              <span className="text-xs text-gray-400">Revoked by {grant.revokedBy} on {new Date(grant.revokedAt).toLocaleDateString()}</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {qrAuditLogs.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performed By</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {qrAuditLogs.slice(0, 50).map((log: any) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              log.action === 'grant_access' ? 'bg-green-100 text-green-800' :
                              log.action === 'revoke_access' ? 'bg-red-100 text-red-800' :
                              log.action === 'create_device' ? 'bg-blue-100 text-blue-800' :
                              log.action === 'print_label' ? 'bg-purple-100 text-purple-800' :
                              log.action === 'reveal_password' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {log.action.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">{log.performedBy}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Zendesk Ticket Routing</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Configure which Zendesk group and agent should receive tickets created from the portal.
                  </p>

                  {zendeskGroupsLoading ? (
                    <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2" style={{ borderColor: '#10a37f' }}></div>
                      Loading Zendesk groups...
                    </div>
                  ) : zendeskGroups.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-yellow-700">
                        Could not load Zendesk groups. Please verify your Zendesk credentials are configured correctly.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <div className="border border-gray-100 rounded-lg p-5 bg-gray-50/50">
                        <h4 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          Troubleshooting Tickets
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Group</label>
                            <select
                              value={troubleshootingGroupId}
                              onChange={async (e) => {
                                setTroubleshootingGroupId(e.target.value)
                                await saveZendeskRouting('zendesk_troubleshooting_group_id', e.target.value)
                                fetchZendeskUsers(e.target.value)
                              }}
                              disabled={savingZendesk}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                            >
                              <option value="">Select a group...</option>
                              {zendeskGroups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Agent (Optional)</label>
                            <select
                              value={troubleshootingAssigneeId}
                              onChange={async (e) => {
                                setTroubleshootingAssigneeId(e.target.value)
                                await saveZendeskRouting('zendesk_troubleshooting_assignee_id', e.target.value || 'none')
                              }}
                              disabled={savingZendesk || zendeskUsersLoading}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                            >
                              <option value="">Unassigned (group default)</option>
                              {zendeskUsers.map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="border border-gray-100 rounded-lg p-5 bg-gray-50/50">
                        <h4 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Cancellation Tickets
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Group</label>
                            <select
                              value={cancellationGroupId}
                              onChange={async (e) => {
                                setCancellationGroupId(e.target.value)
                                await saveZendeskRouting('zendesk_cancellation_group_id', e.target.value)
                              }}
                              disabled={savingZendesk}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                            >
                              <option value="">Select a group...</option>
                              {zendeskGroups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Agent (Optional)</label>
                            <select
                              value={cancellationAssigneeId}
                              onChange={async (e) => {
                                setCancellationAssigneeId(e.target.value)
                                await saveZendeskRouting('zendesk_cancellation_assignee_id', e.target.value || 'none')
                              }}
                              disabled={savingZendesk || zendeskUsersLoading}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                            >
                              <option value="">Unassigned (group default)</option>
                              {zendeskUsers.map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
      </div>

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
