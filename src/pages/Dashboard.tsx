import { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ChatWidget } from '../components/ChatWidget'
import { FeedbackButton } from '../components/FeedbackButton'
import { CancellationModal } from '../components/CancellationModal'
import { PauseSubscriptionModal } from '../components/PauseSubscriptionModal'
import { PlanChangeModal } from '../components/PlanChangeModal'
import { ManageAddonsModal } from '../components/ManageAddonsModal'
import { getPlanDisplayName } from '../utils/planNames'
import BillingResolutionCenter from '../components/BillingResolutionCenter'
import { isPlanChangeEligible, getPlanChangeOptions, PLAN_DESCRIPTIONS } from '../../shared/planChangeConfig'
import { AVAILABLE_ADDONS, isAddonInFamily } from '../../shared/addonConfig'

interface Customer {
  id: number
  email: string
  fullName?: string
  phone?: string
  isVerified: boolean
  lastLoginAt?: string
  loginCount?: number
  createdAt?: string
}

interface SubscriptionItem {
  itemPriceId: string
  itemType: string
  quantity: number
  amount: number
  unitPrice: number
}

interface ChargebeeSubscription {
  id: string
  planId: string
  planName?: string
  status: string
  planAmount: number
  billingPeriod: number
  billingPeriodUnit: string
  currentTermEnd: string
  nextBillingAt: string
  dueInvoicesCount: number
  dueSince: string | null
  totalDues: number
  iccid: string | null
  imei: string | null
  mdn: string | null
  chargebeeCustomerId?: string
  subscriptionItems?: SubscriptionItem[]
  hasScheduledChanges?: boolean
  scheduledChanges?: {
    planId: string
    planAmount: number
    items: Array<{
      itemPriceId: string
      itemType: string
      quantity: number
      amount: number
    }>
  }
  hasAdvanceInvoice?: boolean
  advanceInvoiceId?: string
  advanceInvoiceTotal?: number
}

interface ChargebeeInvoice {
  id: string
  subscriptionId: string | null
  customerId: string
  status: string
  date: string
  total: number
  amountPaid: number
  amountDue: number
  dunningStatus: string | null
}

interface ChargebeeTransaction {
  id: string
  type: string
  status: string
  date: string
  amount: number
  errorCode: string | null
  errorText: string | null
  linkedInvoices?: Array<{
    invoiceId: string
    appliedAmount: number
    appliedAt: string
  }>
}

interface ChargebeeCreditNote {
  id: string
  customerId: string
  subscriptionId: string | null
  referenceInvoiceId: string | null
  type: string
  reasonCode: string | null
  createReasonCode: string | null
  status: string
  date: string
  total: number
  subTotal: number
  amountAllocated: number
  amountRefunded: number
  amountAvailable: number
  currencyCode: string
  lineItems: Array<{
    description: string
    amount: number
    quantity: number
    entityType: string
  }>
}

interface ChargebeeCustomer {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string
  createdAt: string
  paymentMethod?: {
    type: string
    status: string
    gateway: string
  }
  subscriptions: ChargebeeSubscription[]
  invoices: ChargebeeInvoice[]
  transactions: ChargebeeTransaction[]
  creditNotes: ChargebeeCreditNote[]
  paymentSources: any[]
}

interface CustomerFeedback {
  id: number
  feedbackType: string
  message: string
  rating: number | null
  adminResponse: string | null
  respondedAt: string | null
  status: string | null
  createdAt: string
}

interface CombinedOrder {
  source: string
  orderNumber: string
  orderDate: string
  status: string
  fulfillmentStatus: string
  total: number
  currency: string
  paymentStatus: string
  items: Array<{
    name: string
    sku: string | null
    quantity: number
    price: number
  }>
  shipping: {
    name: string
    address1: string
    city: string
    state: string
    zip: string
  } | null
  tracking: Array<{
    carrier: string
    trackingNumber: string
    trackingUrl: string | null
    shipDate: string | null
    status: string
  }>
  imei: string | null
  iccid: string | null
}

interface ThingspaceDevice {
  state: string
  connected: boolean
  ipAddress: string | null
  lastConnectionDate: string | null
  identifiers: {
    mdn: string | null
    imei: string | null
    iccid: string | null
  }
  carrier: {
    name: string
    servicePlan: string
    state: string
  } | null
}

interface FullData {
  chargebee: {
    customers: ChargebeeCustomer[]
    totalSubscriptions: number
    totalInvoices: number
    totalDue: number
  }
  orders: CombinedOrder[]
  devices: ThingspaceDevice[]
}

interface SubscriptionDetail {
  subscription: ChargebeeSubscription
  customerId: string
  customerName: string
  invoices: ChargebeeInvoice[]
  transactions: ChargebeeTransaction[]
}

const isInvoiceCollectible = (status: string): boolean => {
  return ['payment_due', 'not_paid'].includes(status)
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [fullData, setFullData] = useState<FullData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'orders' | 'invoices' | 'internet' | 'billing_help'>('overview')
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionDetail | null>(null)
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [deviceHelpOpen, setDeviceHelpOpen] = useState<string | null>(null)
  const [showComingSoon, setShowComingSoon] = useState(false)
  const [customerFeedback, setCustomerFeedback] = useState<CustomerFeedback[]>([])
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false)
  const [subscriptionToCancel, setSubscriptionToCancel] = useState<ChargebeeSubscription | null>(null)
  const [pauseModalOpen, setPauseModalOpen] = useState(false)
  const [subscriptionToPause, setSubscriptionToPause] = useState<ChargebeeSubscription | null>(null)
  const [planChangeModalOpen, setPlanChangeModalOpen] = useState(false)
  const [subscriptionToChangePlan, setSubscriptionToChangePlan] = useState<ChargebeeSubscription | null>(null)
  const [addonsModalOpen, setAddonsModalOpen] = useState(false)
  const [subscriptionForAddons, setSubscriptionForAddons] = useState<ChargebeeSubscription | null>(null)
  const [cancellingScheduledChange, setCancellingScheduledChange] = useState<string | null>(null)
  const [manageDropdownOpen, setManageDropdownOpen] = useState<string | null>(null)
  const manageDropdownRef = useRef<HTMLDivElement>(null)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [subscriptionForHistory, setSubscriptionForHistory] = useState<string | null>(null)
  const [cancellationHistory, setCancellationHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [payEarlyModalOpen, setPayEarlyModalOpen] = useState(false)
  const [payEarlySubscription, setPayEarlySubscription] = useState<ChargebeeSubscription | null>(null)
  const [payEarlyTerms, setPayEarlyTerms] = useState(1)
  const [payEarlyLoading, setPayEarlyLoading] = useState(false)
  const [payEarlyResult, setPayEarlyResult] = useState<{ success: boolean; message: string; total?: number } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const deviceHelpRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('auth_token')
      
      if (!token) {
        navigate('/signin')
        return
      }

      setAuthToken(token)

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!response.ok) {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('customer')
          navigate('/signin')
          return
        }

        const data = await response.json()
        setCustomer(data.customer)
      } catch (error) {
        console.error('Failed to fetch profile:', error)
        navigate('/signin')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [navigate])

  const fetchFullData = async () => {
    const token = localStorage.getItem('auth_token')
    if (!token) return

    setIsLoadingData(true)
    try {
      const [dataResponse, feedbackResponse] = await Promise.all([
        fetch('/api/customer/full-data', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/feedback', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      if (dataResponse.ok) {
        const data = await dataResponse.json()
        setFullData(data)
      }
      
      if (feedbackResponse.ok) {
        const feedbackData = await feedbackResponse.json()
        setCustomerFeedback(feedbackData.feedback || [])
      }
    } catch (error) {
      console.error('Failed to fetch full data:', error)
    } finally {
      setIsLoadingData(false)
    }
  }

  useEffect(() => {
    if (customer) {
      fetchFullData()
    }
  }, [customer])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
      if (deviceHelpRef.current && !deviceHelpRef.current.contains(event.target as Node)) {
        setDeviceHelpOpen(null)
      }
      if (manageDropdownRef.current && !manageDropdownRef.current.contains(event.target as Node)) {
        setManageDropdownOpen(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    const token = localStorage.getItem('auth_token')
    
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
    } catch (error) {
      console.error('Logout error:', error)
    }

    localStorage.removeItem('auth_token')
    localStorage.removeItem('customer')
    navigate('/signin')
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase()
    if (s === 'active' || s === 'paid' || s === 'success' || s === 'shipped' || s === 'fulfilled') return 'bg-green-100 text-green-800'
    if (s === 'paused' || s === 'pending' || s === 'in_progress' || s === 'partial') return 'bg-yellow-100 text-yellow-800'
    if (s === 'cancelled' || s === 'failed' || s === 'payment_due' || s === 'unpaid' || s === 'suspended' || s === 'suspend') return 'bg-red-100 text-red-800'
    return 'bg-gray-100 text-gray-800'
  }

  const allSubscriptions = fullData?.chargebee.customers.flatMap(c => c.subscriptions) || []
  const allInvoices = fullData?.chargebee.customers.flatMap(c => c.invoices) || []
  const collectibleInvoices = allInvoices.filter(inv => inv.amountDue > 0 && isInvoiceCollectible(inv.status))
  // hasCollectibleInvoices could be used for UI logic if needed
void collectibleInvoices.length
  const allCreditNotes = fullData?.chargebee.customers.flatMap(c => c.creditNotes || []) || []
  const allTransactions = fullData?.chargebee.customers.flatMap(c => c.transactions) || []

  const openSubscriptionDetail = (subscription: ChargebeeSubscription, cbCustomer: ChargebeeCustomer) => {
    const linkedInvoices = cbCustomer.invoices.filter(inv => inv.subscriptionId === subscription.id)
    const invoiceIds = new Set(linkedInvoices.map(inv => inv.id))
    const linkedTransactions = cbCustomer.transactions.filter(txn => 
      txn.linkedInvoices?.some(li => invoiceIds.has(li.invoiceId))
    )
    
    setSelectedSubscription({
      subscription,
      customerId: cbCustomer.id,
      customerName: `${cbCustomer.firstName} ${cbCustomer.lastName}`,
      invoices: linkedInvoices,
      transactions: linkedTransactions
    })
  }

  const handleCancelScheduledChange = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled plan change? Your plan will remain as it is.')) return
    setCancellingScheduledChange(subscriptionId)
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/plan-change/cancel-scheduled', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subscriptionId })
      })
      const data = await response.json()
      if (data.success) {
        await fetchFullData()
      } else {
        alert(data.error || 'Failed to cancel scheduled change')
      }
    } catch (error) {
      alert('Failed to cancel scheduled change. Please try again.')
    } finally {
      setCancellingScheduledChange(null)
    }
  }

  const handlePayNow = async (chargebeeCustomerId: string) => {
    setPaymentLoading('pay')
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/billing/collect-now-url', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          chargebeeCustomerId,
          redirectUrl: `${window.location.origin}/dashboard?payment=success`
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.url) {
          window.open(data.url, '_blank')
        }
      } else {
        alert('Failed to open payment page. Please try again.')
      }
    } catch (error) {
      console.error('Payment error:', error)
      alert('Failed to open payment page. Please try again.')
    } finally {
      setPaymentLoading(null)
    }
  }

  const handleViewCancellationHistory = async (subscriptionId: string) => {
    setSubscriptionForHistory(subscriptionId)
    setHistoryLoading(true)
    setHistoryModalOpen(true)
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/cancellation/history/${subscriptionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (response.ok) {
        setCancellationHistory(data.requests || [])
      }
    } catch (err) {
      console.error('Failed to fetch cancellation history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleUpdatePaymentMethod = async (chargebeeCustomerId: string) => {
    setPaymentLoading('update')
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/billing/update-payment-method-url', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          chargebeeCustomerId,
          redirectUrl: `${window.location.origin}/dashboard?payment_updated=success`
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.url) {
          window.open(data.url, '_blank')
        }
      } else {
        alert('Failed to open payment method page. Please try again.')
      }
    } catch (error) {
      console.error('Update payment method error:', error)
      alert('Failed to open payment method page. Please try again.')
    } finally {
      setPaymentLoading(null)
    }
  }

  const handleCollectPayment = async (invoiceId: string) => {
    if (!confirm('This will attempt to charge your payment method on file. Continue?')) {
      return
    }
    
    setPaymentLoading(invoiceId)
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/billing/collect-payment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invoiceId })
      })
      
      if (response.ok) {
        alert('Payment collected successfully! Refreshing data...')
        window.location.reload()
      } else {
        const data = await response.json()
        alert(data.error || 'Payment collection failed. Please try again or update your payment method.')
      }
    } catch (error) {
      console.error('Collect payment error:', error)
      alert('Payment collection failed. Please try again.')
    } finally {
      setPaymentLoading(null)
    }
  }

  const handlePayEarly = async () => {
    if (!payEarlySubscription) return
    setPayEarlyLoading(true)
    setPayEarlyResult(null)
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/billing/pay-early', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscriptionId: payEarlySubscription.id,
          termsToCharge: payEarlyTerms,
          planId: payEarlySubscription.planId,
          planName: getPlanDisplayName(payEarlySubscription.planId)
        })
      })
      const data = await response.json()
      if (response.ok) {
        setPayEarlyResult({
          success: true,
          message: data.message || `Successfully billed for ${payEarlyTerms} future renewal(s)!`,
          total: data.total
        })
      } else {
        setPayEarlyResult({
          success: false,
          message: data.error || 'Failed to process early payment. Please try again.'
        })
      }
    } catch (error) {
      console.error('Pay early error:', error)
      setPayEarlyResult({
        success: false,
        message: 'Failed to process early payment. Please try again.'
      })
    } finally {
      setPayEarlyLoading(false)
    }
  }

  const handleTroubleshooting = (subscriptionId: string, iccid: string | null, imei: string | null, mdn: string | null, _lineStatus: string | null) => {
    const params = new URLSearchParams()
    params.set('subscription', subscriptionId)
    if (iccid) params.set('iccid', iccid)
    if (imei) params.set('imei', imei)
    if (mdn) params.set('mdn', mdn)
    navigate(`/troubleshoot?${params.toString()}`)
  }


  if (isLoading) {
    return (
      <div className="dashboard-layout flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-layout">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="/logo.svg" 
              alt="Nomad Internet" 
              className="h-10"
            />
            <h1 className="text-xl font-semibold text-text">Customer Portal</h1>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-3 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-primary flex items-center justify-center text-white font-semibold">
                {customer?.fullName ? customer.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-text">{customer?.fullName || 'User'}</p>
                <p className="text-xs text-muted">{customer?.email}</p>
              </div>
              <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2" style={{ zIndex: 9999 }}>
                <Link
                  to="/account"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-text hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Account Settings
                </Link>
                <Link
                  to="/activity"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-text hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Activity Log
                </Link>
                <hr className="my-2" />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide py-2">
            {[
              { key: 'overview', label: 'Overview', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
              { key: 'subscriptions', label: 'Subscriptions', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
              { key: 'orders', label: 'Orders', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg> },
              { key: 'invoices', label: 'Invoices', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
              { key: 'internet', label: 'Internet', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg> },
              { key: 'billing_help', label: 'Billing Help', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.key 
                    ? 'text-white shadow-md' 
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
                style={activeTab === tab.key ? { background: 'linear-gradient(135deg, #0d9668, #10a37f, #34d399)' } : {}}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoadingData ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted">Loading your account data...</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium text-blue-800">Missing a Subscription?</span>
                      </div>
                      <p className="text-sm text-blue-700">
                        If you don't see a subscription associated with your device, you can activate it through our activation portal.
                      </p>
                    </div>
                    <button
                      onClick={() => window.open('https://activatenomad.com', '_blank')}
                      className="flex-shrink-0 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                      style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
                    >
                      Activate Device
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <p className="text-sm text-muted mb-1">Active Subscriptions</p>
                    <p className="text-3xl font-bold text-text">
                      {allSubscriptions.filter(s => s.status === 'active').length}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <p className="text-sm text-muted mb-1">Total Orders</p>
                    <p className="text-3xl font-bold text-text">{fullData?.orders.length || 0}</p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <p className="text-sm text-muted mb-1">Internet Lines</p>
                    <p className="text-3xl font-bold text-text">{fullData?.devices.length || 0}</p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <p className="text-sm text-muted mb-1">Outstanding Balance</p>
                    <p className="text-3xl font-bold text-text">
                      {formatCurrency(fullData?.chargebee.totalDue || 0)}
                    </p>
                  </div>
                </div>

                {allSubscriptions.some(s => s.dueInvoicesCount > 0) && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="font-medium text-red-800">Payment Required</span>
                    </div>
                    <p className="text-sm text-red-700 mt-1">
                      You have unpaid invoices. Please update your payment method to avoid service interruption.
                    </p>
                  </div>
                )}

                {(() => {
                  const activeSubscriptions = allSubscriptions.filter(s => s.status === 'active');
                  const allSubItems = activeSubscriptions.flatMap(s => s.subscriptionItems || []);
                  const missingAddons = AVAILABLE_ADDONS.filter(addon =>
                    !allSubItems.some(item => item.itemType === 'addon' && isAddonInFamily(item.itemPriceId, addon.family))
                  );
                  const upgradeEligible = activeSubscriptions.filter(s => {
                    if (!isPlanChangeEligible(s.planId)) return false;
                    const options = getPlanChangeOptions(s.planId);
                    return options && options.some(o => o.type === 'upgrade');
                  });
                  const bestUpgrade = upgradeEligible.length > 0 ? upgradeEligible[0] : null;
                  const bestUpgradeOption = bestUpgrade ? (getPlanChangeOptions(bestUpgrade.planId) || []).find(o => o.type === 'upgrade') : null;
                  const bestUpgradeDesc = bestUpgradeOption ? PLAN_DESCRIPTIONS[bestUpgradeOption.planId] : null;
                  const currentPlanDesc = bestUpgrade ? PLAN_DESCRIPTIONS[bestUpgrade.planId] : null;

                  if (activeSubscriptions.length === 0) return null;
                  if (missingAddons.length === 0 && !bestUpgrade) return null;

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'linear-gradient(135deg, #0d9668, #10a37f)' }}></div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Recommended For You</span>
                      </div>

                      {bestUpgrade && bestUpgradeOption && (
                        <div className="relative overflow-hidden rounded-2xl border border-gray-100" style={{ background: 'linear-gradient(135deg, rgba(16,163,127,0.04) 0%, rgba(52,211,153,0.06) 50%, rgba(16,163,127,0.03) 100%)' }}>
                          <div className="absolute top-0 right-0 w-48 h-48 opacity-[0.04]" style={{ background: 'radial-gradient(circle, #10a37f, transparent 70%)' }}></div>
                          <div className="p-5 sm:p-6">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10a37f, #0d8a6a)' }}>
                                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                  </div>
                                  <div>
                                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full text-white" style={{ background: 'linear-gradient(135deg, #10a37f, #0d8a6a)' }}>Upgrade Available</span>
                                  </div>
                                </div>
                                <h3 className="text-lg font-bold text-text mb-1">
                                  Upgrade to {getPlanDisplayName(bestUpgradeOption.planId)}
                                </h3>
                                <p className="text-sm text-muted mb-3">
                                  {currentPlanDesc?.upgradeNudge || 'Unlock better performance, faster speeds, and more flexibility with an upgraded plan.'}
                                </p>
                                {bestUpgradeDesc && (
                                  <div className="space-y-1.5 mb-4">
                                    {bestUpgradeDesc.bullets.map((bullet, i) => (
                                      <div key={i} className="flex items-start gap-2">
                                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="text-sm text-gray-600">{bullet}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="flex items-baseline gap-2">
                                  <span className="text-sm text-muted line-through">{formatCurrency(bestUpgrade.planAmount)}/mo</span>
                                  <span className="text-xl font-bold" style={{ color: '#10a37f' }}>{formatCurrency(bestUpgradeOption.price)}</span>
                                  <span className="text-sm text-muted">/month</span>
                                </div>
                              </div>
                              <div className="flex-shrink-0 sm:mt-2">
                                <button
                                  onClick={() => {
                                    setSubscriptionToChangePlan(bestUpgrade)
                                    setPlanChangeModalOpen(true)
                                  }}
                                  className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                                  style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
                                >
                                  View Upgrade Options
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {missingAddons.length > 0 && (
                        <div className={`grid grid-cols-1 ${missingAddons.length > 1 ? 'lg:grid-cols-2' : ''} gap-4`}>
                          {missingAddons.map((addon) => {
                            const targetSub = activeSubscriptions.find(s => s.subscriptionItems && s.subscriptionItems.length > 0) || activeSubscriptions[0];
                            if (!targetSub) return null;
                            return (
                              <div key={addon.id} className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white">
                                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: addon.icon === 'travel' ? 'linear-gradient(90deg, #3b82f6, #06b6d4, #10b981)' : 'linear-gradient(90deg, #8b5cf6, #6366f1, #3b82f6)' }}></div>
                                <div className="p-5">
                                  <div className="flex items-start gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                                      background: addon.icon === 'travel'
                                        ? 'linear-gradient(135deg, #3b82f6, #06b6d4)'
                                        : 'linear-gradient(135deg, #8b5cf6, #6366f1)'
                                    }}>
                                      {addon.icon === 'travel' ? (
                                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-bold text-text">{addon.displayName}</h4>
                                        {addon.id === 'travel-addon' && (
                                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-100 text-amber-700">Most Popular</span>
                                        )}
                                      </div>
                                      <p className="text-sm text-muted mt-0.5">{addon.headline}</p>
                                    </div>
                                  </div>
                                  <div className="space-y-1.5 mb-4">
                                    {addon.bullets.slice(0, 3).map((bullet, i) => (
                                      <div key={i} className="flex items-start gap-2">
                                        <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: addon.icon === 'travel' ? '#3b82f6' : '#8b5cf6' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="text-xs text-gray-600">{bullet}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                    <div>
                                      <span className="text-lg font-bold text-text">{formatCurrency(addon.price)}</span>
                                      <span className="text-xs text-muted ml-1">/{addon.billingPeriod}</span>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setSubscriptionForAddons(targetSub)
                                        setAddonsModalOpen(true)
                                      }}
                                      className="px-4 py-2 text-xs font-semibold rounded-xl transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                                      style={{
                                        background: addon.icon === 'travel'
                                          ? 'linear-gradient(135deg, #3b82f6, #06b6d4)'
                                          : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                                        color: 'white'
                                      }}
                                    >
                                      Add to Subscription
                                    </button>
                                  </div>
                                  <p className="text-[11px] text-muted mt-3 italic">{addon.upsellMessage}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-text mb-4">Recent Orders</h3>
                    {fullData?.orders.slice(0, 3).map((order) => (
                      <div key={order.orderNumber} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="font-medium text-text">{order.orderNumber}</p>
                          <p className="text-sm text-muted">{formatDate(order.orderDate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-text">{formatCurrency(order.total)}</p>
                          <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${getStatusColor(order.fulfillmentStatus)}`}>
                            {order.fulfillmentStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                    {(!fullData?.orders.length) && (
                      <p className="text-muted text-sm">No orders found</p>
                    )}
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-text mb-4">Recent Transactions</h3>
                    {allTransactions.slice(0, 5).map((txn) => (
                      <div key={txn.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="font-medium text-text">{formatCurrency(txn.amount)}</p>
                          <p className="text-sm text-muted">{formatDate(txn.date)}</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${getStatusColor(txn.status)}`}>
                            {txn.status}
                          </span>
                          {txn.errorCode && (
                            <p className="text-xs text-red-600 mt-1">{txn.errorCode}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {allTransactions.length === 0 && (
                      <p className="text-muted text-sm">No transactions found</p>
                    )}
                  </div>
                </div>

                {customerFeedback.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-text mb-4">Your Feedback</h3>
                    <div className="space-y-4">
                      {customerFeedback.map((feedback) => (
                        <div key={feedback.id} className="border border-gray-100 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              feedback.feedbackType === 'feature_request' ? 'bg-blue-100 text-blue-700' :
                              feedback.feedbackType === 'bug_report' ? 'bg-red-100 text-red-700' :
                              feedback.feedbackType === 'compliment' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {feedback.feedbackType.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-muted">
                              {new Date(feedback.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-sm text-text mb-3">{feedback.message}</p>
                          
                          {feedback.adminResponse ? (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <p className="text-xs text-green-600 mb-1 font-medium">Response from Nomad Internet:</p>
                              <p className="text-sm text-green-800">{feedback.adminResponse}</p>
                              {feedback.respondedAt && (
                                <p className="text-xs text-green-600 mt-2">
                                  Responded on {new Date(feedback.respondedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted italic">Awaiting response...</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'subscriptions' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'linear-gradient(135deg, #0d9668, #10a37f)' }}></div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Your Subscriptions</span>
                    </div>
                  </div>
                  {(fullData?.chargebee.customers.length || 0) > 1 && (
                    <span className="text-sm text-muted">
                      {fullData?.chargebee.customers.length} customer accounts
                    </span>
                  )}
                </div>
                
                {fullData?.chargebee.customers.map((cbCustomer) => (
                  <div key={cbCustomer.id} className="space-y-4">
                    {(fullData?.chargebee.customers.length || 0) > 1 && (
                      <div className="rounded-2xl p-4 border border-gray-100" style={{ background: 'linear-gradient(135deg, rgba(16,163,127,0.03), rgba(52,211,153,0.03))' }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-text">
                              {cbCustomer.firstName} {cbCustomer.lastName}
                            </p>
                            <p className="text-sm text-muted">Customer ID: {cbCustomer.id}</p>
                          </div>
                          <div className="text-right text-sm">
                            <p className="text-muted">Created: {formatDate(cbCustomer.createdAt)}</p>
                            {cbCustomer.paymentMethod && (
                              <p className="text-muted">
                                {cbCustomer.paymentMethod.type} ({cbCustomer.paymentMethod.status})
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {cbCustomer.subscriptions.map((sub) => (
                      <div key={sub.id} className="bg-white rounded-2xl border border-gray-100">
                        <div className="h-1 rounded-t-2xl" style={{ background: 'linear-gradient(90deg, #0d9668, #10a37f, #34d399)' }}></div>
                        <div className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-text">{getPlanDisplayName(sub.planId)}</h3>
                              <span className={`px-2.5 py-1 text-xs rounded-lg ${getStatusColor(sub.status)}`}>
                                {sub.status}
                              </span>
                            </div>
                            <p className="text-2xl font-bold text-primary mb-4">
                              <span className="inline-block px-3 py-1 rounded-xl" style={{ backgroundColor: 'rgba(16,163,127,0.08)' }}>{formatCurrency(sub.planAmount)}/{sub.billingPeriodUnit}</span>
                            </p>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Next Billing</p>
                                <p className="text-sm font-semibold text-gray-800">{formatDate(sub.nextBillingAt)}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Current Period Ends</p>
                                <p className="text-sm font-semibold text-gray-800">{formatDate(sub.currentTermEnd)}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Due Invoices</p>
                                <p className={`text-sm font-semibold text-gray-800 ${sub.dueInvoicesCount > 0 ? 'text-red-600' : ''}`}>
                                  {sub.dueInvoicesCount}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Amount Due</p>
                                <p className={`text-sm font-semibold text-gray-800 ${sub.totalDues > 0 ? 'text-red-600' : ''}`}>
                                  {formatCurrency(sub.totalDues)}
                                </p>
                              </div>
                            </div>

                            {(sub.iccid || sub.imei) && (
                              <div className="mt-4 pt-4 border-t border-gray-50">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'linear-gradient(135deg, #0d9668, #10a37f)' }}></div>
                                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Device Information</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                  {sub.iccid && (
                                    <div className="bg-gray-50/80 rounded-xl px-3 py-2">
                                      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">ICCID</p>
                                      <p className="font-mono text-xs">{sub.iccid}</p>
                                    </div>
                                  )}
                                  {sub.imei && (
                                    <div className="bg-gray-50/80 rounded-xl px-3 py-2">
                                      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">IMEI</p>
                                      <p className="font-mono text-xs">{sub.imei}</p>
                                    </div>
                                  )}
                                  {sub.mdn && (
                                    <div className="bg-gray-50/80 rounded-xl px-3 py-2">
                                      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">MDN</p>
                                      <p className="font-mono text-xs">{sub.mdn}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {sub.subscriptionItems && sub.subscriptionItems.filter(item => item.itemType === 'addon').length > 0 && (
                              <div className="mt-4 pt-4 border-t border-gray-50">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'linear-gradient(135deg, #0d9668, #10a37f)' }}></div>
                                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Add-ons</span>
                                </div>
                                <div className="space-y-2">
                                  {sub.subscriptionItems.filter(item => item.itemType === 'addon').map((addon, idx) => (
                                    <div key={idx} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ borderLeft: '3px solid #10a37f', background: 'rgba(16,163,127,0.04)' }}>
                                      <span className="text-sm font-medium text-text">{getPlanDisplayName(addon.itemPriceId)}</span>
                                      <span className="text-sm font-semibold text-primary">{formatCurrency(addon.amount)}/{sub.billingPeriodUnit}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {sub.hasScheduledChanges && sub.scheduledChanges && (
                              <div className="mt-4 pt-4 border-t border-gray-50">
                                <div className="bg-blue-50 border border-blue-200 rounded-2xl shadow-sm p-4">
                                  <div className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="flex-1">
                                      <p className="text-sm font-semibold text-blue-800">Scheduled Plan Change</p>
                                      <p className="text-sm text-blue-700 mt-1">
                                        Your plan will change to <span className="font-semibold">{getPlanDisplayName(sub.scheduledChanges.planId)}</span> at{' '}
                                        <span className="font-semibold">{formatCurrency(sub.scheduledChanges.planAmount)}/{sub.billingPeriodUnit}</span> on your next billing date ({formatDate(sub.nextBillingAt)}).
                                      </p>
                                      <button
                                        onClick={() => handleCancelScheduledChange(sub.id)}
                                        disabled={cancellingScheduledChange === sub.id}
                                        className="mt-2 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                                      >
                                        {cancellingScheduledChange === sub.id ? 'Cancelling...' : 'Cancel Scheduled Change'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {sub.hasAdvanceInvoice && (
                              <div className="mt-4 pt-4 border-t border-gray-50">
                                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm p-4">
                                  <div className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="flex-1">
                                      <p className="text-sm font-semibold text-emerald-800">Advance Payment Made</p>
                                      <p className="text-sm text-emerald-700 mt-1">
                                        You have already paid in advance for future renewal(s).
                                        {sub.advanceInvoiceTotal !== undefined && (
                                          <> Amount: <span className="font-semibold">{formatCurrency(sub.advanceInvoiceTotal)}</span></>
                                        )}
                                        {sub.advanceInvoiceId && (
                                          <> (Invoice #{sub.advanceInvoiceId})</>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap gap-3">
                              <button
                                onClick={() => openSubscriptionDetail(sub, cbCustomer)}
                                className="group inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 hover:shadow-md active:scale-[0.97]"
                                style={{ color: '#10a37f', backgroundColor: 'rgba(16,163,127,0.06)', border: '1px solid rgba(16,163,127,0.15)' }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16,163,127,0.12)'; e.currentTarget.style.borderColor = 'rgba(16,163,127,0.3)' }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16,163,127,0.06)'; e.currentTarget.style.borderColor = 'rgba(16,163,127,0.15)' }}
                              >
                                View Invoices & Transactions
                              </button>
                              {sub.totalDues > 0 && (
                                <button
                                  onClick={() => handlePayNow(cbCustomer.id)}
                                  disabled={paymentLoading === 'pay'}
                                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all duration-200 active:scale-[0.97] disabled:opacity-50"
                                >
                                  {paymentLoading === 'pay' ? 'Loading...' : `Pay ${formatCurrency(sub.totalDues)}`}
                                </button>
                              )}
                              <button
                                onClick={() => handleUpdatePaymentMethod(cbCustomer.id)}
                                disabled={paymentLoading === 'update'}
                                className="group inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 hover:shadow-md active:scale-[0.97] disabled:opacity-50"
                                style={{ color: '#374151', backgroundColor: 'rgba(107,114,128,0.06)', border: '1px solid rgba(107,114,128,0.15)' }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(107,114,128,0.12)'; e.currentTarget.style.borderColor = 'rgba(107,114,128,0.3)' }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(107,114,128,0.06)'; e.currentTarget.style.borderColor = 'rgba(107,114,128,0.15)' }}
                              >
                                {paymentLoading === 'update' ? 'Loading...' : 'Update Payment Method'}
                              </button>
                              {(sub.status === 'active' || sub.status === 'paused' || sub.status === 'in_trial') && (
                                <div className="relative" ref={manageDropdownOpen === sub.id ? manageDropdownRef : undefined}>
                                  <button
                                    onClick={() => setManageDropdownOpen(manageDropdownOpen === sub.id ? null : sub.id)}
                                    className="group inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 hover:shadow-md active:scale-[0.97]"
                                    style={{ color: '#10a37f', backgroundColor: 'rgba(16,163,127,0.06)', border: '1px solid rgba(16,163,127,0.15)' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16,163,127,0.12)'; e.currentTarget.style.borderColor = 'rgba(16,163,127,0.3)' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16,163,127,0.06)'; e.currentTarget.style.borderColor = 'rgba(16,163,127,0.15)' }}
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    Manage Subscription
                                    <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${manageDropdownOpen === sub.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                  </button>
                                  {manageDropdownOpen === sub.id && (
                                    <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-xl border border-gray-200 shadow-lg z-50 py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                                      {sub.status === 'active' && isPlanChangeEligible(sub.planId) && !sub.hasScheduledChanges && (
                                        <button
                                          onClick={() => {
                                            setManageDropdownOpen(null)
                                            setSubscriptionToChangePlan(sub)
                                            setPlanChangeModalOpen(true)
                                          }}
                                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                          Change Plan
                                        </button>
                                      )}
                                      {sub.status === 'active' && (
                                        <button
                                          onClick={() => {
                                            setManageDropdownOpen(null)
                                            setSubscriptionForAddons(sub)
                                            setAddonsModalOpen(true)
                                          }}
                                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" /></svg>
                                          Manage Add-ons
                                        </button>
                                      )}
                                      {sub.status === 'active' && !sub.hasAdvanceInvoice && (
                                        <button
                                          onClick={() => {
                                            setManageDropdownOpen(null)
                                            setPayEarlySubscription(sub)
                                            setPayEarlyTerms(1)
                                            setPayEarlyResult(null)
                                            setPayEarlyModalOpen(true)
                                          }}
                                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                          Pay Early
                                        </button>
                                      )}
                                      {sub.status === 'active' && sub.hasAdvanceInvoice && (
                                        <div className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-400 cursor-not-allowed">
                                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                          Already Paid Early
                                        </div>
                                      )}
                                      {sub.status === 'active' && (
                                        <>
                                          <div className="my-1.5 mx-3 border-t border-gray-100"></div>
                                          <button
                                            onClick={() => {
                                              setManageDropdownOpen(null)
                                              setSubscriptionToPause(sub)
                                              setPauseModalOpen(true)
                                            }}
                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-50 transition-colors"
                                          >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Pause Subscription
                                          </button>
                                        </>
                                      )}
                                      <div className="my-1.5 mx-3 border-t border-gray-100"></div>
                                      <button
                                        onClick={() => {
                                          setManageDropdownOpen(null)
                                          setSubscriptionToCancel(sub)
                                          setCancellationModalOpen(true)
                                        }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        Cancel Subscription
                                      </button>
                                      <button
                                        onClick={() => {
                                          setManageDropdownOpen(null)
                                          handleViewCancellationHistory(sub.id)
                                        }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        View History
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            
                                                      </div>
                        </div>
                      </div>
                      </div>
                    ))}
                    
                    {cbCustomer.subscriptions.length === 0 && (
                      <div className="bg-white/60 rounded-2xl border border-gray-100 p-12 text-center">
                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <p className="text-sm text-muted">No subscriptions found for this customer account</p>
                      </div>
                    )}
                  </div>
                ))}
                
                {(fullData?.chargebee.customers.length === 0) && (
                  <div className="bg-white/60 rounded-2xl border border-gray-100 p-12 text-center">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p className="text-muted">No subscriptions found</p>
                    <p className="text-sm text-gray-400 mt-1">Your subscription details will appear here once available</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full" style={{ background: 'linear-gradient(135deg, #0d9668, #10a37f)' }}></div><span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Your Orders</span></div>
                {fullData?.orders.map((order) => (
                  <div key={order.orderNumber} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="h-1" style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)' }}></div>
                    <div className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold text-text">{order.orderNumber}</h3>
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${getStatusColor(order.fulfillmentStatus)}`}>
                            {order.fulfillmentStatus}
                          </span>
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${getStatusColor(order.paymentStatus)}`}>
                            {order.paymentStatus}
                          </span>
                        </div>
                        <p className="text-sm text-muted">
                          {formatDate(order.orderDate)} | Source: {order.source}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-gray-800"><span className="inline-block px-3 py-1 rounded-xl" style={{ backgroundColor: 'rgba(99,102,241,0.08)' }}>{formatCurrency(order.total)}</span></p>
                      </div>
                    </div>

                    <div className="border-t border-gray-50 pt-4">
                      <div className="flex items-center gap-2 mb-3"><div className="w-1 h-1 rounded-full bg-indigo-400"></div><span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Items</span></div>
                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm py-1.5">
                            <span>
                              {item.name} 
                              {item.sku && <span className="text-muted ml-2">({item.sku})</span>}
                              <span className="text-muted"> x{item.quantity}</span>
                            </span>
                            <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {order.shipping && (
                      <div className="border-t border-gray-50 pt-4 mt-4">
                        <div className="flex items-center gap-2 mb-3"><div className="w-1 h-1 rounded-full bg-indigo-400"></div><span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Shipping Address</span></div>
                        <p className="text-sm text-muted">
                          {order.shipping.name}<br />
                          {order.shipping.address1}<br />
                          {order.shipping.city}, {order.shipping.state} {order.shipping.zip}
                        </p>
                      </div>
                    )}

                    {order.tracking.length > 0 && (
                      <div className="border-t border-gray-50 pt-4 mt-4">
                        <div className="flex items-center gap-2 mb-3"><div className="w-1 h-1 rounded-full bg-indigo-400"></div><span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Tracking</span></div>
                        <div className="space-y-2">
                          {order.tracking.map((t, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <div>
                                <span className="font-medium">{t.carrier}</span>
                                <span className="text-muted ml-2">#{t.trackingNumber}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${getStatusColor(t.status)}`}>
                                  {t.status}
                                </span>
                                {t.trackingUrl && (
                                  <a 
                                    href={t.trackingUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm font-medium rounded-lg px-2.5 py-1 transition-all duration-200 hover:shadow-sm active:scale-[0.97]"
                                    style={{ color: '#10a37f', backgroundColor: 'rgba(16,163,127,0.06)' }}
                                  >
                                    Track
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(order.imei || order.iccid) && (
                      <div className="border-t border-gray-50 pt-4 mt-4">
                        <div className="flex items-center gap-2 mb-3"><div className="w-1 h-1 rounded-full bg-indigo-400"></div><span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Device Information</span></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {order.imei && (
                            <div className="bg-gray-50/80 rounded-xl px-3 py-2">
                              <span className="text-muted">IMEI:</span>
                              <span className="ml-2 font-mono text-text">{order.imei}</span>
                            </div>
                          )}
                          {order.iccid && (
                            <div className="bg-gray-50/80 rounded-xl px-3 py-2">
                              <span className="text-muted">ICCID:</span>
                              <span className="ml-2 font-mono text-text">{order.iccid}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    </div>
                                      </div>
                ))}
                {(!fullData?.orders.length) && (
                  <div className="bg-white/60 rounded-2xl border border-gray-100 p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))' }}>
                      <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    </div>
                    <p className="text-gray-400 font-medium">No orders found</p>
                    <p className="text-xs text-gray-300 mt-1">Your order history will appear here</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'invoices' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-text">Invoices & Transactions</h2>
                
                {/* Mobile Card View */}
                <div className="mobile-card-list space-y-3">
                  {allInvoices.map((inv) => (
                    <div key={inv.id} className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-medium text-text text-sm">{inv.id}</p>
                          <p className="text-xs text-muted">{formatDate(inv.date)}</p>
                        </div>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(inv.status)}`}>
                          {inv.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center border-t border-gray-100 pt-3 mb-3">
                        <div>
                          <p className="text-xs text-muted">Total</p>
                          <p className="font-medium text-sm">{formatCurrency(inv.total)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted">Paid</p>
                          <p className="font-medium text-sm text-green-600">{formatCurrency(inv.amountPaid)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted">Due</p>
                          <p className={`font-medium text-sm ${inv.amountDue > 0 ? 'text-red-600' : ''}`}>{formatCurrency(inv.amountDue)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const token = localStorage.getItem('auth_token')
                              const response = await fetch(`/api/billing/invoice/${inv.id}/pdf`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                              })
                              if (response.ok) {
                                const data = await response.json()
                                window.open(data.downloadUrl, '_blank')
                              }
                            } catch (err) {
                              console.error('Failed to download invoice:', err)
                            }
                          }}
                          className="flex-1 px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          PDF
                        </button>
                        {inv.amountDue > 0 && isInvoiceCollectible(inv.status) ? (
                          <button
                            onClick={() => handleCollectPayment(inv.id)}
                            disabled={paymentLoading === inv.id}
                            className="flex-1 px-3 py-2 text-xs font-medium text-white bg-primary rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                          >
                            {paymentLoading === inv.id ? '...' : 'Pay Now'}
                          </button>
                        ) : inv.amountDue > 0 ? (
                          <span className="flex-1 px-3 py-2 text-xs text-center text-yellow-600 bg-yellow-50 rounded-lg">Pending</span>
                        ) : (
                          <span className="flex-1 px-3 py-2 text-xs text-center text-green-600 bg-green-50 rounded-lg">Paid</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Desktop Table View */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto mobile-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Invoice</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase">Total</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase">Paid</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase">Due</th>
                        <th className="text-center px-4 py-3 text-xs font-medium text-muted uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {allInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 text-sm font-medium text-text">{inv.id}</td>
                          <td className="px-4 py-4 text-sm text-muted">{formatDate(inv.date)}</td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(inv.status)}`}>
                              {inv.status}
                            </span>
                            {inv.dunningStatus && (
                              <span className="ml-2 text-xs text-orange-600">
                                (Dunning: {inv.dunningStatus})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-right font-medium">{formatCurrency(inv.total)}</td>
                          <td className="px-4 py-4 text-sm text-right text-green-600">{formatCurrency(inv.amountPaid)}</td>
                          <td className={`px-4 py-4 text-sm text-right font-medium ${inv.amountDue > 0 ? 'text-red-600' : ''}`}>
                            {formatCurrency(inv.amountDue)}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={async () => {
                                  try {
                                    const token = localStorage.getItem('auth_token')
                                    const response = await fetch(`/api/billing/invoice/${inv.id}/pdf`, {
                                      headers: { 'Authorization': `Bearer ${token}` }
                                    })
                                    if (response.ok) {
                                      const data = await response.json()
                                      window.open(data.downloadUrl, '_blank')
                                    }
                                  } catch (err) {
                                    console.error('Failed to download invoice:', err)
                                  }
                                }}
                                className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded transition-colors"
                                title="Download PDF"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </button>
                              {inv.amountDue > 0 && isInvoiceCollectible(inv.status) ? (
                                <button
                                  onClick={() => handleCollectPayment(inv.id)}
                                  disabled={paymentLoading === inv.id}
                                  className="px-3 py-1 text-xs font-medium text-white bg-primary rounded hover:bg-accent transition-colors disabled:opacity-50"
                                >
                                  {paymentLoading === inv.id ? '...' : 'Pay Now'}
                                </button>
                              ) : inv.amountDue > 0 ? (
                                <span className="text-xs text-yellow-600">Pending</span>
                              ) : (
                                <span className="text-xs text-green-600">Paid</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                
                {allCreditNotes.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-text mt-8">Credit Notes & Refunds</h3>
                    
                    {/* Mobile Card View for Credit Notes */}
                    <div className="mobile-card-list space-y-3">
                      {allCreditNotes.map((cn) => (
                        <div key={cn.id} className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-medium text-text text-sm">{cn.id}</p>
                              <p className="text-xs text-muted">{formatDate(cn.date)}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                cn.status === 'refunded' ? 'bg-green-100 text-green-800' :
                                cn.status === 'refund_due' ? 'bg-yellow-100 text-yellow-800' :
                                cn.status === 'adjusted' ? 'bg-blue-100 text-blue-800' :
                                cn.status === 'voided' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {cn.status === 'refund_due' ? 'Refund Due' : cn.status}
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                cn.type === 'refundable' ? 'bg-purple-100 text-purple-800' :
                                cn.type === 'adjustment' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {cn.type}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center border-t border-gray-100 pt-3 mb-3">
                            <div>
                              <p className="text-xs text-muted">Total</p>
                              <p className="font-medium text-sm">{formatCurrency(cn.total)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted">Refunded</p>
                              <p className="font-medium text-sm text-green-600">{formatCurrency(cn.amountRefunded)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted">Available</p>
                              <p className={`font-medium text-sm ${cn.amountAvailable > 0 ? 'text-blue-600' : ''}`}>{formatCurrency(cn.amountAvailable)}</p>
                            </div>
                          </div>
                          {cn.createReasonCode && (
                            <p className="text-xs text-muted mb-2">Reason: {cn.createReasonCode}</p>
                          )}
                          {cn.referenceInvoiceId && (
                            <p className="text-xs text-muted mb-2">Invoice: {cn.referenceInvoiceId}</p>
                          )}
                          {cn.lineItems.length > 0 && (
                            <div className="border-t border-gray-100 pt-2 mt-2">
                              {cn.lineItems.map((li, idx) => (
                                <p key={idx} className="text-xs text-muted">{li.description} - {formatCurrency(li.amount)}</p>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={async () => {
                                try {
                                  const token = localStorage.getItem('auth_token')
                                  const response = await fetch(`/api/billing/credit-note/${cn.id}/pdf`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                  })
                                  if (response.ok) {
                                    const data = await response.json()
                                    window.open(data.downloadUrl, '_blank')
                                  }
                                } catch (err) {
                                  console.error('Failed to download credit note:', err)
                                }
                              }}
                              className="flex-1 px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              PDF
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Desktop Table View for Credit Notes */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto mobile-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Credit Note</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Date</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Type</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Status</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Reason</th>
                            <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase">Total</th>
                            <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase">Refunded</th>
                            <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase">Available</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Invoice</th>
                            <th className="text-center px-4 py-3 text-xs font-medium text-muted uppercase">PDF</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {allCreditNotes.map((cn) => (
                            <tr key={cn.id} className="hover:bg-gray-50">
                              <td className="px-4 py-4 text-sm font-medium text-text">{cn.id}</td>
                              <td className="px-4 py-4 text-sm text-muted">{formatDate(cn.date)}</td>
                              <td className="px-4 py-4">
                                <span className={`px-2 py-0.5 text-xs rounded-full ${
                                  cn.type === 'refundable' ? 'bg-purple-100 text-purple-800' :
                                  cn.type === 'adjustment' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {cn.type}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span className={`px-2 py-0.5 text-xs rounded-full ${
                                  cn.status === 'refunded' ? 'bg-green-100 text-green-800' :
                                  cn.status === 'refund_due' ? 'bg-yellow-100 text-yellow-800' :
                                  cn.status === 'adjusted' ? 'bg-blue-100 text-blue-800' :
                                  cn.status === 'voided' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {cn.status === 'refund_due' ? 'Refund Due' : cn.status}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-sm text-muted">{cn.createReasonCode || cn.reasonCode || '-'}</td>
                              <td className="px-4 py-4 text-sm text-right font-medium">{formatCurrency(cn.total)}</td>
                              <td className="px-4 py-4 text-sm text-right text-green-600">{formatCurrency(cn.amountRefunded)}</td>
                              <td className={`px-4 py-4 text-sm text-right font-medium ${cn.amountAvailable > 0 ? 'text-blue-600' : ''}`}>
                                {formatCurrency(cn.amountAvailable)}
                              </td>
                              <td className="px-4 py-4 text-sm text-muted">{cn.referenceInvoiceId || '-'}</td>
                              <td className="px-4 py-4">
                                <div className="flex items-center justify-center">
                                  <button
                                    onClick={async () => {
                                      try {
                                        const token = localStorage.getItem('auth_token')
                                        const response = await fetch(`/api/billing/credit-note/${cn.id}/pdf`, {
                                          headers: { 'Authorization': `Bearer ${token}` }
                                        })
                                        if (response.ok) {
                                          const data = await response.json()
                                          window.open(data.downloadUrl, '_blank')
                                        }
                                      } catch (err) {
                                        console.error('Failed to download credit note:', err)
                                      }
                                    }}
                                    className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded transition-colors"
                                    title="Download PDF"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                
                <h3 className="text-lg font-semibold text-text mt-8">Transaction History</h3>
                
                {/* Mobile Card View for Transactions */}
                <div className="mobile-card-list space-y-3">
                  {allTransactions.map((txn) => (
                    <div key={txn.id} className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-mono text-xs text-text break-all">{txn.id}</p>
                          <p className="text-xs text-muted mt-1">{formatDate(txn.date)}</p>
                        </div>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(txn.status)}`}>
                          {txn.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted">Type:</span>
                          <span className="text-sm capitalize">{txn.type}</span>
                        </div>
                        <p className="font-bold text-primary">{formatCurrency(txn.amount)}</p>
                      </div>
                      {txn.errorCode && (
                        <p className="text-xs text-red-600 mt-2">Error: {txn.errorCode}</p>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Desktop Table View for Transactions */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mobile-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase">Transaction</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase">Date</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase">Type</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase">Status</th>
                        <th className="text-right px-6 py-3 text-xs font-medium text-muted uppercase">Amount</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {allTransactions.map((txn) => (
                        <tr key={txn.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-mono text-xs text-text">{txn.id}</td>
                          <td className="px-6 py-4 text-sm text-muted">{formatDate(txn.date)}</td>
                          <td className="px-6 py-4 text-sm text-text capitalize">{txn.type}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(txn.status)}`}>
                              {txn.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-medium">{formatCurrency(txn.amount)}</td>
                          <td className="px-6 py-4 text-sm text-red-600">
                            {txn.errorCode && `${txn.errorCode}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                              </div>
            )}

            {activeTab === 'internet' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full" style={{ background: 'linear-gradient(135deg, #0d9668, #10a37f)' }}></div><span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Your Internet Services</span></div>
                  <button
                    onClick={() => fetchFullData()}
                    disabled={isLoadingData}
                    title="Refresh data from all systems"
                    className="group inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 hover:shadow-md active:scale-[0.97] disabled:opacity-50"
                    style={{ color: '#10a37f', backgroundColor: 'rgba(16,163,127,0.06)', border: '1px solid rgba(16,163,127,0.15)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16,163,127,0.12)'; e.currentTarget.style.borderColor = 'rgba(16,163,127,0.3)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16,163,127,0.06)'; e.currentTarget.style.borderColor = 'rgba(16,163,127,0.15)' }}
                  >
                    <svg className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {isLoadingData ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                {fullData?.chargebee.customers.flatMap(cbCustomer => 
                  cbCustomer.subscriptions.map((subscription, idx) => {
                  const device = fullData?.devices.find(d => 
                    (subscription.iccid && d.identifiers.iccid === subscription.iccid) || 
                    (subscription.imei && d.identifiers.imei === subscription.imei) ||
                    (subscription.mdn && d.identifiers.mdn === subscription.mdn)
                  )
                  const lineState = device?.carrier?.state || device?.state || null
                  const normalizedState = lineState?.toLowerCase().replace(/[_-]/g, ' ').trim() || ''
                  
                  const getLineStatusInfo = () => {
                    const redStates = ['deactive', 'deactivate', 'deactivated', 'suspend', 'suspended', 'pending suspend', 'pending suspended']
                    const yellowStates = ['pending resume', 'pending account update', 'pending activation', 'pending']
                    const greenStates = ['active', 'activated']
                    
                    if (!lineState || redStates.some(s => normalizedState.includes(s) || normalizedState === s)) {
                      return { color: 'red', icon: 'disconnected', label: 'Disconnected' }
                    } else if (yellowStates.some(s => normalizedState.includes(s) || normalizedState === s)) {
                      return { color: 'yellow', icon: 'pending', label: 'Pending' }
                    } else if (greenStates.some(s => normalizedState.includes(s) || normalizedState === s)) {
                      return { color: 'green', icon: 'connected', label: 'Connected' }
                    }
                    return { color: 'red', icon: 'disconnected', label: 'Unknown' }
                  }
                  
                  const lineStatus = getLineStatusInfo()
                  const activeStatuses = ['active', 'future', 'in_trial']
                  const isActive = activeStatuses.includes(subscription.status)
                  const isPaid = subscription.dueInvoicesCount === 0 && subscription.totalDues === 0
                  
                  const getGracePeriodInfo = () => {
                    if (isPaid || !subscription.dueSince) {
                      return { inGracePeriod: false, daysRemaining: 0, daysOverdue: 0 }
                    }
                    const dueSinceDate = new Date(subscription.dueSince)
                    const now = new Date()
                    const daysSinceDue = Math.floor((now.getTime() - dueSinceDate.getTime()) / (1000 * 60 * 60 * 24))
                    const gracePeriodDays = 3
                    
                    if (daysSinceDue <= gracePeriodDays) {
                      const daysRemaining = gracePeriodDays - daysSinceDue
                      return { inGracePeriod: true, daysRemaining: daysRemaining + 1, daysOverdue: 0 }
                    } else {
                      const daysOverdue = daysSinceDue - gracePeriodDays
                      return { inGracePeriod: false, daysRemaining: 0, daysOverdue }
                    }
                  }
                  const gracePeriod = getGracePeriodInfo()
                  
                  const getStatusDisplay = () => {
                    if (activeStatuses.includes(subscription.status)) {
                      return { label: 'Active', color: 'bg-green-100 text-green-800' }
                    }
                    if (subscription.status === 'cancelled' || subscription.status === 'canceled') {
                      return { label: 'Canceled', color: 'bg-gray-100 text-gray-800' }
                    }
                    if (subscription.status === 'paused') {
                      return { label: 'Paused', color: 'bg-yellow-100 text-yellow-800' }
                    }
                    return { label: subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1), color: 'bg-gray-100 text-gray-800' }
                  }
                  const statusDisplay = getStatusDisplay()
                  
                  return (
                    <div key={subscription.id || idx} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                      <div className="h-1" style={{ background: 'linear-gradient(90deg, #0d9668, #10a37f, #34d399)' }}></div>
                      <div className="p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                          <div>
                            <h3 className="text-lg font-bold text-text">{getPlanDisplayName(subscription.planId)}</h3>
                            <p className="text-sm text-muted">Subscription #{subscription.id}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 text-xs font-medium rounded-lg ${statusDisplay.color}`}>
                              {statusDisplay.label}
                            </span>
                            {isActive && (
                              <span className={`px-3 py-1 text-xs font-medium rounded-lg ${
                                isPaid ? 'bg-green-100 text-green-800' : 
                                gracePeriod.inGracePeriod ? 'bg-orange-100 text-orange-800' : 
                                'bg-red-100 text-red-800'
                              }`}>
                                {isPaid ? 'Paid' : gracePeriod.inGracePeriod ? 'Grace Period' : 'Unpaid'}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                          <div className="rounded-xl p-4" style={{ background: 'rgba(16,163,127,0.03)', border: '1px solid rgba(16,163,127,0.08)' }}>
                            <p className="text-xs text-muted uppercase tracking-wide mb-1">IMEI</p>
                            <p className="font-mono text-sm text-text">{subscription.imei || 'N/A'}</p>
                          </div>
                          <div className="rounded-xl p-4" style={{ background: 'rgba(16,163,127,0.03)', border: '1px solid rgba(16,163,127,0.08)' }}>
                            <p className="text-xs text-muted uppercase tracking-wide mb-1">ICCID</p>
                            <p className="font-mono text-sm text-text break-all">{subscription.iccid || 'N/A'}</p>
                          </div>
                        </div>
                        
                        <div className={`rounded-2xl p-4 border ${
                          lineStatus.color === 'green' ? 'bg-green-50 border-green-200' :
                          lineStatus.color === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
                          'bg-red-50 border-red-200'
                        }`}>
                          <div className="flex items-center gap-3">
                            {lineStatus.color === 'green' && (
                              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0d9668, #34d399)' }}>
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                </svg>
                              </div>
                            )}
                            {lineStatus.color === 'yellow' && (
                              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #d97706, #fbbf24)' }}>
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            )}
                            {lineStatus.color === 'red' && (
                              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #dc2626, #f87171)' }}>
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a5 5 0 01-7.072-7.072m7.072 7.072L6.343 17.657M6.343 6.343L3 3m3.343 3.343a5 5 0 017.072 0" />
                                </svg>
                              </div>
                            )}
                            <div className="flex-1">
                              <p className={`font-semibold ${
                                lineStatus.color === 'green' ? 'text-green-800' :
                                lineStatus.color === 'yellow' ? 'text-yellow-800' :
                                'text-red-800'
                              }`}>
                                {lineStatus.color === 'red' ? 'Your service needs attention' : `Internet ${lineStatus.label}`}
                              </p>
                              <p className={`text-sm ${
                                lineStatus.color === 'green' ? 'text-green-600' :
                                lineStatus.color === 'yellow' ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {lineStatus.color === 'red' ? 'Click below to fix it.' : lineState ? `Line Status: ${lineState}` : ''}
                              </p>
                            </div>
                            {device?.ipAddress && lineStatus.color === 'green' && (
                              <div className="text-right">
                                <p className="text-xs text-green-600">IP Address</p>
                                <p className="font-mono text-sm text-green-800">{device.ipAddress}</p>
                              </div>
                            )}
                          </div>
                          {lineStatus.color === 'yellow' && normalizedState.includes('pending resume') && (
                            <div className="mt-3 bg-yellow-50/80 border border-yellow-100 rounded-xl p-3">
                              <div className="flex items-start gap-2">
                                <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm text-yellow-800">
                                  We are working on restoring your line. Please reboot your device in 2 minutes if the internet is not working.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {isActive && (isPaid || gracePeriod.inGracePeriod) && (
                          <div className="mt-4 flex gap-3">
                            <button
                              onClick={() => handleTroubleshooting(subscription.id, subscription.iccid, subscription.imei, subscription.mdn, lineState)}
                              className="flex-1 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-white shadow-md hover:shadow-lg hover:shadow-emerald-100 active:scale-[0.97]"
                              style={{ background: 'linear-gradient(135deg, #0d9668, #10a37f, #34d399)' }}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              Troubleshoot Internet
                            </button>
                            
                            {isPaid && (
                              <div className="relative" ref={deviceHelpOpen === subscription.id ? deviceHelpRef : null}>
                                <button
                                  onClick={() => setDeviceHelpOpen(deviceHelpOpen === subscription.id ? null : subscription.id)}
                                  className="px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 hover:shadow-sm active:scale-[0.97]"
                                  style={{ color: '#0f172a' }}
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Device Help
                                  <svg className={`w-4 h-4 transition-transform ${deviceHelpOpen === subscription.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                
                                {deviceHelpOpen === subscription.id && (
                                  <div className="absolute right-0 bottom-full mb-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 backdrop-blur-sm z-50 py-2 px-1">
                                    <button
                                      onClick={() => { setDeviceHelpOpen(null); setShowComingSoon(true); }}
                                      className="w-full px-3 py-2.5 text-left text-sm rounded-xl hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                    >
                                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                      </svg>
                                      <span style={{ color: '#0f172a' }}>Device not powering on</span>
                                    </button>
                                    <button
                                      onClick={() => { setDeviceHelpOpen(null); setShowComingSoon(true); }}
                                      className="w-full px-3 py-2.5 text-left text-sm rounded-xl hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                    >
                                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                      </svg>
                                      <span style={{ color: '#0f172a' }}>WiFi name not on list</span>
                                    </button>
                                    <button
                                      onClick={() => { setDeviceHelpOpen(null); setShowComingSoon(true); }}
                                      className="w-full px-3 py-2.5 text-left text-sm rounded-xl hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                    >
                                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                      </svg>
                                      <span style={{ color: '#0f172a' }}>Unable to connect my TV</span>
                                    </button>
                                    <button
                                      onClick={() => { setDeviceHelpOpen(null); setShowComingSoon(true); }}
                                      className="w-full px-3 py-2.5 text-left text-sm rounded-xl hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                    >
                                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                      </svg>
                                      <span style={{ color: '#0f172a' }}>Need replacement power cord</span>
                                    </button>
                                    <button
                                      onClick={() => { setDeviceHelpOpen(null); setShowComingSoon(true); }}
                                      className="w-full px-3 py-2.5 text-left text-sm rounded-xl hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                    >
                                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                      </svg>
                                      <span style={{ color: '#0f172a' }}>Change WiFi password</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {isActive && !isPaid && gracePeriod.inGracePeriod && (
                          <div className="mt-4">
                            <div className="bg-orange-50/80 border border-orange-100 rounded-2xl p-4 mb-4">
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="font-semibold text-orange-800">Grace Period Active</p>
                                  <p className="text-sm text-orange-700">
                                    You have {gracePeriod.daysRemaining} day{gracePeriod.daysRemaining !== 1 ? 's' : ''} remaining to pay your outstanding balance of {formatCurrency(subscription.totalDues)}. 
                                    Please pay to avoid service interruption.
                                  </p>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handlePayNow(cbCustomer.id)}
                              disabled={paymentLoading === 'pay'}
                              className="w-full px-4 py-3 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all duration-200 disabled:opacity-50 active:scale-[0.97] shadow-md hover:shadow-lg"
                            >
                              {paymentLoading === 'pay' ? 'Loading...' : `Pay Now ${formatCurrency(subscription.totalDues)}`}
                            </button>
                          </div>
                        )}
                        
                        {isActive && !isPaid && !gracePeriod.inGracePeriod && (
                          <div className="mt-4">
                            <div className="bg-red-50/80 border border-red-100 rounded-2xl p-4 mb-4">
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="font-semibold text-red-800">Payment Overdue</p>
                                  <p className="text-sm text-red-700">
                                    You are outside your 3-day grace period. Please pay your outstanding balance of {formatCurrency(subscription.totalDues)} to restore your services.
                                  </p>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handlePayNow(cbCustomer.id)}
                              disabled={paymentLoading === 'pay'}
                              className="w-full px-4 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all duration-200 disabled:opacity-50 active:scale-[0.97] shadow-md hover:shadow-lg"
                            >
                              {paymentLoading === 'pay' ? 'Loading...' : `Pay Now ${formatCurrency(subscription.totalDues)}`}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }))}
                {allSubscriptions.length === 0 && (
                  <div className="bg-white/60 rounded-2xl border border-gray-100 p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(16,163,127,0.1), rgba(52,211,153,0.1))' }}>
                      <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>
                    </div>
                    <p className="text-gray-400 font-medium">No internet services found</p>
                    <p className="text-xs text-gray-300 mt-1">Your internet service details will appear here</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'billing_help' && authToken && (
              <BillingResolutionCenter authToken={authToken} />
            )}
          </>
        )}
      </main>
      
      {authToken && <ChatWidget token={authToken} dataLoaded={!isLoadingData} />}
      {authToken && <FeedbackButton token={authToken} />}
      
      {authToken && subscriptionToCancel && (
        <CancellationModal
          isOpen={cancellationModalOpen}
          onClose={() => {
            setCancellationModalOpen(false)
            setSubscriptionToCancel(null)
          }}
          subscription={subscriptionToCancel}
          token={authToken}
        />
      )}

      {authToken && subscriptionToPause && (
        <PauseSubscriptionModal
          isOpen={pauseModalOpen}
          onClose={() => {
            setPauseModalOpen(false)
            setSubscriptionToPause(null)
          }}
          subscription={subscriptionToPause}
          token={authToken}
          onPauseComplete={() => {
            window.location.reload()
          }}
        />
      )}

      {authToken && subscriptionToChangePlan && (
        <PlanChangeModal
          isOpen={planChangeModalOpen}
          onClose={() => {
            setPlanChangeModalOpen(false)
            setSubscriptionToChangePlan(null)
          }}
          subscription={subscriptionToChangePlan}
          token={authToken}
          onPlanChangeComplete={() => {
            window.location.reload()
          }}
        />
      )}

      {authToken && subscriptionForAddons && (
        <ManageAddonsModal
          isOpen={addonsModalOpen}
          onClose={() => {
            setAddonsModalOpen(false)
            setSubscriptionForAddons(null)
          }}
          subscription={subscriptionForAddons}
          token={authToken}
          onAddonChangeComplete={() => {
            window.location.reload()
          }}
        />
      )}

      {historyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-text">Cancellation Request History</h3>
                <button
                  onClick={() => {
                    setHistoryModalOpen(false)
                    setCancellationHistory([])
                    setSubscriptionForHistory(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-muted mt-1">Subscription: {subscriptionForHistory}</p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#10a37f' }}></div>
                </div>
              ) : cancellationHistory.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-gray-100">
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-muted">No cancellation requests found for this subscription.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cancellationHistory.map((request, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          request.zendeskStatus === 'solved' || request.zendeskStatus === 'closed' 
                            ? 'bg-green-100 text-green-800' 
                            : request.zendeskStatus === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {request.zendeskStatus || 'Submitted'}
                        </span>
                        <span className="text-xs text-muted">
                          {new Date(request.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-muted font-medium w-32">Reason:</span>
                          <span className="text-text capitalize">{request.reason?.replace(/_/g, ' ')}</span>
                        </div>
                        
                        {request.discountAccepted !== null && (
                          <div className="flex items-start gap-2">
                            <span className="text-muted font-medium w-32">Discount Offer:</span>
                            <span className={request.discountAccepted ? 'text-green-600' : 'text-red-600'}>
                              {request.discountAccepted ? 'Accepted' : 'Declined'}
                            </span>
                          </div>
                        )}
                        
                        {request.contactMethod && (
                          <div className="flex items-start gap-2">
                            <span className="text-muted font-medium w-32">Contact Method:</span>
                            <span className="text-text capitalize">{request.contactMethod}</span>
                          </div>
                        )}
                        
                        {request.zendeskTicketId && (
                          <div className="flex items-start gap-2">
                            <span className="text-muted font-medium w-32">Ticket ID:</span>
                            <span className="text-text font-mono">{request.zendeskTicketId}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setHistoryModalOpen(false)
                  setCancellationHistory([])
                  setSubscriptionForHistory(null)
                }}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {payEarlyModalOpen && payEarlySubscription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-text">Pay Early</h3>
                <button
                  onClick={() => {
                    setPayEarlyModalOpen(false)
                    setPayEarlySubscription(null)
                    setPayEarlyResult(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-muted mt-1">
                {getPlanDisplayName(payEarlySubscription.planId)}
              </p>
            </div>

            <div className="p-6 space-y-5">
              {payEarlyResult ? (
                <div className={`rounded-xl p-4 ${payEarlyResult.success ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                  <div className="flex items-start gap-3">
                    {payEarlyResult.success ? (
                      <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                    <div>
                      <p className={`text-sm font-medium ${payEarlyResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                        {payEarlyResult.success ? 'Payment Successful!' : 'Payment Failed'}
                      </p>
                      <p className={`text-xs mt-1 ${payEarlyResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
                        {payEarlyResult.message}
                      </p>
                      {payEarlyResult.total !== undefined && payEarlyResult.total !== null && (
                        <p className="text-sm font-semibold text-emerald-800 mt-2">
                          Amount charged: {formatCurrency(payEarlyResult.total)}
                        </p>
                      )}
                    </div>
                  </div>
                  {payEarlyResult.success && (
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-4 w-full px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                      style={{ backgroundColor: '#10a37f' }}
                    >
                      Refresh Page
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <div className="text-sm text-blue-800">
                        <p className="font-medium">Bill and Invoice for Future Renewals</p>
                        <p className="text-xs mt-1">Pay ahead for upcoming billing cycles. Your payment method on file will be charged immediately.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      How many renewal periods would you like to pay in advance?
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 6].map(n => (
                        <button
                          key={n}
                          onClick={() => setPayEarlyTerms(n)}
                          className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${
                            payEarlyTerms === n
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {n} {payEarlySubscription.billingPeriodUnit === 'month' ? (n === 1 ? 'Month' : 'Months') : (n === 1 ? 'Period' : 'Periods')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    {(() => {
                      const addonItems = (payEarlySubscription.subscriptionItems || []).filter(item => item.itemType === 'addon')
                      const addonTotal = addonItems.reduce((sum, item) => sum + (item.amount || 0), 0)
                      const periodTotal = payEarlySubscription.planAmount + addonTotal
                      return (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Plan</span>
                            <span className="font-medium text-gray-900">{formatCurrency(payEarlySubscription.planAmount)}</span>
                          </div>
                          {addonItems.map((addon, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-500">{getPlanDisplayName(addon.itemPriceId)}</span>
                              <span className="font-medium text-gray-900">{formatCurrency(addon.amount)}</span>
                            </div>
                          ))}
                          {addonItems.length > 0 && (
                            <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
                              <span className="text-gray-500">Total per period</span>
                              <span className="font-medium text-gray-900">{formatCurrency(periodTotal)}</span>
                            </div>
                          )}
                          <div className={`${addonItems.length === 0 ? 'border-t border-gray-200 pt-2' : ''} flex justify-between text-sm`}>
                            <span className="text-gray-500">Number of periods</span>
                            <span className="font-medium text-gray-900">x {payEarlyTerms}</span>
                          </div>
                          <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
                            <span className="font-medium text-gray-700">Estimated total</span>
                            <span className="font-bold text-gray-900">{formatCurrency(periodTotal * payEarlyTerms)}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Final amount may vary if discounts apply.</p>
                        </>
                      )
                    })()}
                  </div>

                  <button
                    onClick={handlePayEarly}
                    disabled={payEarlyLoading}
                    className="w-full px-4 py-3 text-sm font-medium text-white rounded-xl transition-all duration-200 disabled:opacity-50 active:scale-[0.97] shadow-md hover:shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #0d9668, #10a37f, #34d399)' }}
                  >
                    {payEarlyLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </span>
                    ) : (
                      `Pay ${formatCurrency((payEarlySubscription.planAmount + (payEarlySubscription.subscriptionItems || []).filter(i => i.itemType === 'addon').reduce((s, i) => s + (i.amount || 0), 0)) * payEarlyTerms)} Now`
                    )}
                  </button>
                </>
              )}
            </div>

            {!payEarlyResult && (
              <div className="px-6 pb-6">
                <button
                  onClick={() => {
                    setPayEarlyModalOpen(false)
                    setPayEarlySubscription(null)
                  }}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showComingSoon && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10a37f20' }}>
                <svg className="w-8 h-8" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-text mb-2">Coming Soon!</h3>
              <p className="text-muted mb-6">
                This feature is currently under development and will be available soon. Thank you for your patience!
              </p>
              <button
                onClick={() => setShowComingSoon(false)}
                className="px-6 py-3 rounded-lg text-white font-medium transition-all hover:shadow-lg"
                style={{ backgroundColor: '#10a37f' }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedSubscription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-text truncate">Subscription Details</h2>
                <p className="text-xs sm:text-sm text-muted truncate">{getPlanDisplayName(selectedSubscription.subscription.planId)}</p>
              </div>
              <button
                onClick={() => setSelectedSubscription(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0 ml-2"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(95vh-80px)] sm:max-h-[calc(90vh-120px)]">
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted">Status</p>
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${getStatusColor(selectedSubscription.subscription.status)}`}>
                      {selectedSubscription.subscription.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Amount</p>
                    <p className="font-bold text-primary text-sm">{formatCurrency(selectedSubscription.subscription.planAmount)}/{selectedSubscription.subscription.billingPeriodUnit}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Next Billing</p>
                    <p className="font-medium text-sm">{formatDate(selectedSubscription.subscription.nextBillingAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Amount Due</p>
                    <p className={`font-bold text-sm ${selectedSubscription.subscription.totalDues > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(selectedSubscription.subscription.totalDues)}
                    </p>
                  </div>
                </div>

                {selectedSubscription.subscription.totalDues > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button
                      onClick={() => handlePayNow(selectedSubscription.customerId)}
                      disabled={paymentLoading === 'pay'}
                      className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {paymentLoading === 'pay' ? 'Loading...' : `Pay Now ${formatCurrency(selectedSubscription.subscription.totalDues)}`}
                    </button>
                    <button
                      onClick={() => handleUpdatePaymentMethod(selectedSubscription.customerId)}
                      disabled={paymentLoading === 'update'}
                      className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {paymentLoading === 'update' ? 'Loading...' : 'Update Payment'}
                    </button>
                  </div>
                )}
              </div>

              <div className="mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-text mb-3 sm:mb-4">Invoices for this Subscription</h3>
                {selectedSubscription.invoices.length > 0 ? (
                  <>
                    {/* Mobile Card View */}
                    <div className="space-y-2 sm:hidden">
                      {selectedSubscription.invoices.map((inv) => (
                        <div key={inv.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-xs text-text">{inv.id}</p>
                              <p className="text-xs text-muted">{formatDate(inv.date)}</p>
                            </div>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(inv.status)}`}>
                              {inv.status}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex gap-4 text-xs">
                              <span>Total: <strong>{formatCurrency(inv.total)}</strong></span>
                              <span className={inv.amountDue > 0 ? 'text-red-600' : ''}>Due: <strong>{formatCurrency(inv.amountDue)}</strong></span>
                            </div>
                            {inv.amountDue > 0 && isInvoiceCollectible(inv.status) && (
                              <button
                                onClick={() => handleCollectPayment(inv.id)}
                                disabled={paymentLoading === inv.id}
                                className="px-2 py-1 text-xs font-medium text-white bg-primary rounded hover:bg-accent transition-colors disabled:opacity-50"
                              >
                                {paymentLoading === inv.id ? '...' : 'Pay'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Desktop Table View */}
                    <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-4 py-2 text-xs font-medium text-muted uppercase">Invoice</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-muted uppercase">Date</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-muted uppercase">Status</th>
                            <th className="text-right px-4 py-2 text-xs font-medium text-muted uppercase">Total</th>
                            <th className="text-right px-4 py-2 text-xs font-medium text-muted uppercase">Due</th>
                            <th className="text-right px-4 py-2 text-xs font-medium text-muted uppercase">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {selectedSubscription.invoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-medium text-text">{inv.id}</td>
                              <td className="px-4 py-3 text-sm text-muted">{formatDate(inv.date)}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(inv.status)}`}>
                                  {inv.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(inv.total)}</td>
                              <td className={`px-4 py-3 text-sm text-right font-medium ${inv.amountDue > 0 ? 'text-red-600' : ''}`}>
                                {formatCurrency(inv.amountDue)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {inv.amountDue > 0 && isInvoiceCollectible(inv.status) ? (
                                  <button
                                    onClick={() => handleCollectPayment(inv.id)}
                                    disabled={paymentLoading === inv.id}
                                    className="px-3 py-1 text-xs font-medium text-white bg-primary rounded hover:bg-accent transition-colors disabled:opacity-50"
                                  >
                                    {paymentLoading === inv.id ? '...' : 'Pay'}
                                  </button>
                                ) : inv.amountDue > 0 ? (
                                  <span className="text-xs text-yellow-600">Pending</span>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-muted text-sm">No invoices found for this subscription</p>
                )}
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-semibold text-text mb-3 sm:mb-4">Transactions for this Subscription</h3>
                {selectedSubscription.transactions.length > 0 ? (
                  <>
                    {/* Mobile Card View */}
                    <div className="space-y-2 sm:hidden">
                      {selectedSubscription.transactions.map((txn) => (
                        <div key={txn.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-xs text-muted">{formatDate(txn.date)}</p>
                              <p className="text-sm font-medium text-text capitalize">{txn.type}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-primary">{formatCurrency(txn.amount)}</p>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(txn.status)}`}>
                                {txn.status}
                              </span>
                            </div>
                          </div>
                          {txn.errorCode && (
                            <p className="text-xs text-red-600 mt-1">Error: {txn.errorCode}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Desktop Table View */}
                    <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-4 py-2 text-xs font-medium text-muted uppercase">Date</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-muted uppercase">Type</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-muted uppercase">Status</th>
                            <th className="text-right px-4 py-2 text-xs font-medium text-muted uppercase">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {selectedSubscription.transactions.map((txn) => (
                            <tr key={txn.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-muted">{formatDate(txn.date)}</td>
                              <td className="px-4 py-3 text-sm font-medium text-text">{txn.type}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(txn.status)}`}>
                                  {txn.status}
                                </span>
                                {txn.errorCode && (
                                  <span className="ml-2 text-xs text-red-600">({txn.errorCode})</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(txn.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-muted text-sm">No transactions found for this subscription</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
