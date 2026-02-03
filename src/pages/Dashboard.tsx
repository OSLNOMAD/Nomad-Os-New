import { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ChatWidget } from '../components/ChatWidget'

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

interface ChargebeeSubscription {
  id: string
  planId: string
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
  paymentSources: any[]
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
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'orders' | 'invoices' | 'internet'>('overview')
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionDetail | null>(null)
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [troubleshootingSubscription, setTroubleshootingSubscription] = useState<string | null>(null)
  const [troubleshootingStatus, setTroubleshootingStatus] = useState<{
    step: 'checking' | 'resuming' | 'waiting' | 'reboot_prompt' | 'extended_wait' | 'success' | 'error' | 'already_active'
    message: string
    deviceStatus?: ThingspaceDevice
    timeRemaining?: number
    iccid?: string
  } | null>(null)
  const [troubleshootingTimer, setTroubleshootingTimer] = useState<ReturnType<typeof setInterval> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const fetchFullData = async () => {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      try {
        const response = await fetch('/api/customer/full-data', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          setFullData(data)
        }
      } catch (error) {
        console.error('Failed to fetch full data:', error)
      } finally {
        setIsLoadingData(false)
      }
    }

    if (customer) {
      fetchFullData()
    }
  }, [customer])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
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

  const handleTroubleshooting = async (subscriptionId: string, iccid: string | null, imei: string | null, mdn: string | null, lineStatus: string | null) => {
    if (troubleshootingSubscription === subscriptionId) {
      if (troubleshootingTimer) {
        clearInterval(troubleshootingTimer)
        setTroubleshootingTimer(null)
      }
      setTroubleshootingSubscription(null)
      setTroubleshootingStatus(null)
      return
    }

    setTroubleshootingSubscription(subscriptionId)
    
    const identifier = iccid || imei || mdn
    const identifierType = iccid ? 'iccid' : imei ? 'imei' : 'mdn'

    if (!identifier) {
      setTroubleshootingStatus({ step: 'error', message: 'No device identifier found for this subscription.' })
      return
    }

    const normalizedState = (lineStatus || 'unknown').toLowerCase().replace(/[-_]/g, '')
    
    if (normalizedState === 'active') {
      setTroubleshootingStatus({ 
        step: 'already_active', 
        message: 'Your line is already active and connected.'
      })
      return
    }

    const suspendedStates = ['suspend', 'suspended', 'pendingsuspend', 'pending_suspend', 'deactive', 'deactivate']
    const isSuspended = suspendedStates.some(s => normalizedState.includes(s.replace(/[-_]/g, '')))

    if (isSuspended) {
      setTroubleshootingStatus({ 
        step: 'resuming', 
        message: `Line is suspended. Resuming ICCID: ${iccid || identifier}...`,
        iccid: iccid || identifier
      })

      try {
        const token = localStorage.getItem('auth_token')
        const resumeResponse = await fetch('/api/device/resume', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ identifier, identifierType })
        })

        if (resumeResponse.ok) {
          await resumeResponse.json()
          startWaitingTimer(identifier, identifierType, iccid || identifier)
        } else {
          const errorData = await resumeResponse.json()
          setTroubleshootingStatus({ 
            step: 'error', 
            message: errorData.error || 'Failed to resume line. Please contact support.'
          })
        }
      } catch (error) {
        console.error('Troubleshooting error:', error)
        setTroubleshootingStatus({ step: 'error', message: 'An error occurred. Please try again.' })
      }
    } else {
      setTroubleshootingStatus({ 
        step: 'error', 
        message: `Line status: ${lineStatus || 'unknown'}. Please contact support for assistance.`
      })
    }
  }

  const startWaitingTimer = (_identifier: string, _identifierType: string, iccidDisplay: string) => {
    let timeRemaining = 300
    
    setTroubleshootingStatus({
      step: 'waiting',
      message: 'Resume request submitted. Waiting for line to activate...',
      timeRemaining,
      iccid: iccidDisplay
    })

    const timer = setInterval(() => {
      timeRemaining -= 1
      
      if (timeRemaining <= 0) {
        clearInterval(timer)
        setTroubleshootingTimer(null)
        setTroubleshootingStatus({
          step: 'reboot_prompt',
          message: 'Please reboot your router now to complete the activation.',
          iccid: iccidDisplay
        })
      } else {
        setTroubleshootingStatus(prev => prev ? { ...prev, timeRemaining } : null)
      }
    }, 1000)

    setTroubleshootingTimer(timer)
  }

  const handleRebootConfirmed = async (identifier: string, identifierType: string, iccidDisplay: string) => {
    const token = localStorage.getItem('auth_token')
    
    try {
      const statusResponse = await fetch('/api/device/status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ identifier, identifierType })
      })

      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        const device = statusData.device
        const currentState = (device?.state || device?.carrier?.state || '').toLowerCase().replace(/[-_]/g, '')
        
        if (currentState === 'active') {
          setTroubleshootingStatus({
            step: 'success',
            message: 'Your line is now active and connected!',
            iccid: iccidDisplay
          })
          return
        }
        
        const pendingStates = ['pendingresume', 'pending resume', 'pendingactivation', 'pending activation']
        const isPending = pendingStates.some(s => currentState.includes(s.replace(/[-_ ]/g, '')))
        
        if (isPending) {
          startExtendedWaitTimer(iccidDisplay)
        } else {
          setTroubleshootingStatus({
            step: 'success',
            message: 'Resume request completed. Please allow a few minutes for full activation.',
            iccid: iccidDisplay
          })
        }
      } else {
        startExtendedWaitTimer(iccidDisplay)
      }
    } catch (error) {
      startExtendedWaitTimer(iccidDisplay)
    }
  }

  const startExtendedWaitTimer = (iccidDisplay: string) => {
    let timeRemaining = 240
    
    setTroubleshootingStatus({
      step: 'extended_wait',
      message: 'It is taking a little longer than usual. Please wait...',
      timeRemaining,
      iccid: iccidDisplay
    })

    const timer = setInterval(() => {
      timeRemaining -= 1
      
      if (timeRemaining <= 0) {
        clearInterval(timer)
        setTroubleshootingTimer(null)
        setTroubleshootingStatus({
          step: 'success',
          message: 'Resume request completed. Your line should be active now. If not, please contact support.',
          iccid: iccidDisplay
        })
      } else {
        setTroubleshootingStatus(prev => prev ? { ...prev, timeRemaining } : null)
      }
    }, 1000)

    setTroubleshootingTimer(timer)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
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

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {['overview', 'subscriptions', 'orders', 'invoices', 'internet'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted hover:text-text hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
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
              </div>
            )}

            {activeTab === 'subscriptions' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-text">Your Subscriptions</h2>
                  {(fullData?.chargebee.customers.length || 0) > 1 && (
                    <span className="text-sm text-muted">
                      {fullData?.chargebee.customers.length} customer accounts
                    </span>
                  )}
                </div>
                
                {fullData?.chargebee.customers.map((cbCustomer) => (
                  <div key={cbCustomer.id} className="space-y-4">
                    {(fullData?.chargebee.customers.length || 0) > 1 && (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
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
                      <div key={sub.id} className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-text">{sub.planId}</h3>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(sub.status)}`}>
                                {sub.status}
                              </span>
                            </div>
                            <p className="text-2xl font-bold text-primary mb-4">
                              {formatCurrency(sub.planAmount)}/{sub.billingPeriodUnit}
                            </p>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-muted">Next Billing</p>
                                <p className="font-medium">{formatDate(sub.nextBillingAt)}</p>
                              </div>
                              <div>
                                <p className="text-muted">Current Period Ends</p>
                                <p className="font-medium">{formatDate(sub.currentTermEnd)}</p>
                              </div>
                              <div>
                                <p className="text-muted">Due Invoices</p>
                                <p className={`font-medium ${sub.dueInvoicesCount > 0 ? 'text-red-600' : ''}`}>
                                  {sub.dueInvoicesCount}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted">Amount Due</p>
                                <p className={`font-medium ${sub.totalDues > 0 ? 'text-red-600' : ''}`}>
                                  {formatCurrency(sub.totalDues)}
                                </p>
                              </div>
                            </div>

                            {(sub.iccid || sub.imei) && (
                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-sm text-muted mb-2">Device Information</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                  {sub.iccid && (
                                    <div>
                                      <p className="text-muted">ICCID</p>
                                      <p className="font-mono text-xs">{sub.iccid}</p>
                                    </div>
                                  )}
                                  {sub.imei && (
                                    <div>
                                      <p className="text-muted">IMEI</p>
                                      <p className="font-mono text-xs">{sub.imei}</p>
                                    </div>
                                  )}
                                  {sub.mdn && (
                                    <div>
                                      <p className="text-muted">MDN</p>
                                      <p className="font-mono text-xs">{sub.mdn}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3">
                              <button
                                onClick={() => openSubscriptionDetail(sub, cbCustomer)}
                                className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
                              >
                                View Invoices & Transactions
                              </button>
                              {sub.totalDues > 0 && (
                                <button
                                  onClick={() => handlePayNow(cbCustomer.id)}
                                  disabled={paymentLoading === 'pay'}
                                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                                >
                                  {paymentLoading === 'pay' ? 'Loading...' : `Pay ${formatCurrency(sub.totalDues)}`}
                                </button>
                              )}
                              <button
                                onClick={() => handleUpdatePaymentMethod(cbCustomer.id)}
                                disabled={paymentLoading === 'update'}
                                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                              >
                                {paymentLoading === 'update' ? 'Loading...' : 'Update Payment Method'}
                              </button>
                            </div>
                            
                                                      </div>
                        </div>
                      </div>
                    ))}
                    
                    {cbCustomer.subscriptions.length === 0 && (
                      <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                        <p className="text-sm text-muted">No subscriptions for this customer account</p>
                      </div>
                    )}
                  </div>
                ))}
                
                {(fullData?.chargebee.customers.length === 0) && (
                  <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                    <p className="text-muted">No subscriptions found</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-text">Your Orders</h2>
                {fullData?.orders.map((order) => (
                  <div key={order.orderNumber} className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold text-text">{order.orderNumber}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(order.fulfillmentStatus)}`}>
                            {order.fulfillmentStatus}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(order.paymentStatus)}`}>
                            {order.paymentStatus}
                          </span>
                        </div>
                        <p className="text-sm text-muted">
                          {formatDate(order.orderDate)} | Source: {order.source}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-text">{formatCurrency(order.total)}</p>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-sm font-medium text-text mb-2">Items</p>
                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
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
                      <div className="border-t border-gray-100 pt-4 mt-4">
                        <p className="text-sm font-medium text-text mb-2">Shipping Address</p>
                        <p className="text-sm text-muted">
                          {order.shipping.name}<br />
                          {order.shipping.address1}<br />
                          {order.shipping.city}, {order.shipping.state} {order.shipping.zip}
                        </p>
                      </div>
                    )}

                    {order.tracking.length > 0 && (
                      <div className="border-t border-gray-100 pt-4 mt-4">
                        <p className="text-sm font-medium text-text mb-2">Tracking</p>
                        <div className="space-y-2">
                          {order.tracking.map((t, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <div>
                                <span className="font-medium">{t.carrier}</span>
                                <span className="text-muted ml-2">#{t.trackingNumber}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(t.status)}`}>
                                  {t.status}
                                </span>
                                {t.trackingUrl && (
                                  <a 
                                    href={t.trackingUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
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
                      <div className="border-t border-gray-100 pt-4 mt-4">
                        <p className="text-sm font-medium text-text mb-2">Device Information</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {order.imei && (
                            <div>
                              <span className="text-muted">IMEI:</span>
                              <span className="ml-2 font-mono text-text">{order.imei}</span>
                            </div>
                          )}
                          {order.iccid && (
                            <div>
                              <span className="text-muted">ICCID:</span>
                              <span className="ml-2 font-mono text-text">{order.iccid}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                                      </div>
                ))}
                {(!fullData?.orders.length) && (
                  <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                    <p className="text-muted">No orders found</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'invoices' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-text">Invoices & Transactions</h2>
                
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Invoice</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase">Total</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase">Paid</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase">Due</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase">Action</th>
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
                          <td className="px-4 py-4 text-right">
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                
                <h3 className="text-lg font-semibold text-text mt-8">Transaction History</h3>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                <h2 className="text-xl font-semibold text-text">Your Internet Services</h2>
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
                    <div key={subscription.id || idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                          <div>
                            <h3 className="text-lg font-bold text-text">{subscription.planId}</h3>
                            <p className="text-sm text-muted">Subscription #{subscription.id}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusDisplay.color}`}>
                              {statusDisplay.label}
                            </span>
                            {isActive && (
                              <span className={`px-3 py-1 text-xs font-medium rounded-full ${
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
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-xs text-muted uppercase tracking-wide mb-1">IMEI</p>
                            <p className="font-mono text-sm text-text">{subscription.imei || 'N/A'}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-xs text-muted uppercase tracking-wide mb-1">ICCID</p>
                            <p className="font-mono text-sm text-text break-all">{subscription.iccid || 'N/A'}</p>
                          </div>
                        </div>
                        
                        <div className={`rounded-lg p-4 border-2 ${
                          lineStatus.color === 'green' ? 'bg-green-50 border-green-200' :
                          lineStatus.color === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
                          'bg-red-50 border-red-200'
                        }`}>
                          <div className="flex items-center gap-3">
                            {lineStatus.color === 'green' && (
                              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                </svg>
                              </div>
                            )}
                            {lineStatus.color === 'yellow' && (
                              <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            )}
                            {lineStatus.color === 'red' && (
                              <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
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
                                Internet {lineStatus.label}
                              </p>
                              {lineState && (
                                <p className={`text-sm ${
                                  lineStatus.color === 'green' ? 'text-green-600' :
                                  lineStatus.color === 'yellow' ? 'text-yellow-600' :
                                  'text-red-600'
                                }`}>
                                  Line Status: {lineState}
                                </p>
                              )}
                            </div>
                            {device?.ipAddress && lineStatus.color === 'green' && (
                              <div className="text-right">
                                <p className="text-xs text-green-600">IP Address</p>
                                <p className="font-mono text-sm text-green-800">{device.ipAddress}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {isActive && !isPaid && gracePeriod.inGracePeriod && (
                          <div className="mt-4">
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
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
                            <div className="flex gap-3">
                              <button
                                onClick={() => handlePayNow(cbCustomer.id)}
                                disabled={paymentLoading === 'pay'}
                                className="flex-1 px-4 py-3 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {paymentLoading === 'pay' ? 'Loading...' : `Pay Now ${formatCurrency(subscription.totalDues)}`}
                              </button>
                              <button
                                onClick={() => handleTroubleshooting(subscription.id, subscription.iccid, subscription.imei, subscription.mdn, lineState)}
                                className={`px-4 py-3 text-sm font-medium border-2 rounded-lg transition-colors flex items-center gap-2 ${
                                  troubleshootingSubscription === subscription.id 
                                    ? 'bg-primary text-white border-primary' 
                                    : 'text-primary border-primary hover:bg-primary hover:text-white'
                                }`}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {troubleshootingSubscription === subscription.id ? 'Close' : 'Troubleshooting'}
                              </button>
                            </div>
                            
                            {troubleshootingSubscription === subscription.id && troubleshootingStatus && (
                              <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <div className="flex flex-col gap-3">
                                  <div className="flex items-start gap-3">
                                    {troubleshootingStatus.step === 'resuming' && (
                                      <>
                                        <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0 animate-pulse">
                                          <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                        </div>
                                        <div>
                                          <p className="font-semibold text-yellow-800">Resuming Line</p>
                                          <p className="text-sm text-yellow-700">{troubleshootingStatus.message}</p>
                                        </div>
                                      </>
                                    )}
                                    {troubleshootingStatus.step === 'waiting' && (
                                      <>
                                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                          <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                        </div>
                                        <div className="flex-1">
                                          <p className="font-semibold text-blue-800">Activating Line</p>
                                          <p className="text-sm text-blue-700">{troubleshootingStatus.message}</p>
                                          <div className="mt-2 flex items-center gap-2">
                                            <div className="text-2xl font-bold text-blue-600">{formatTime(troubleshootingStatus.timeRemaining || 0)}</div>
                                            <span className="text-xs text-blue-600">remaining</span>
                                          </div>
                                          <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                                            <div 
                                              className="bg-blue-600 h-2 rounded-full transition-all duration-1000" 
                                              style={{ width: `${((300 - (troubleshootingStatus.timeRemaining || 0)) / 300) * 100}%` }}
                                            ></div>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                    {troubleshootingStatus.step === 'reboot_prompt' && (
                                      <>
                                        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                          </svg>
                                        </div>
                                        <div className="flex-1">
                                          <p className="font-semibold text-orange-800">Reboot Your Router</p>
                                          <p className="text-sm text-orange-700">{troubleshootingStatus.message}</p>
                                        </div>
                                      </>
                                    )}
                                    {troubleshootingStatus.step === 'extended_wait' && (
                                      <>
                                        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                                          <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                        </div>
                                        <div className="flex-1">
                                          <p className="font-semibold text-purple-800">Taking Longer Than Usual</p>
                                          <p className="text-sm text-purple-700">{troubleshootingStatus.message}</p>
                                          <div className="mt-2 flex items-center gap-2">
                                            <div className="text-2xl font-bold text-purple-600">{formatTime(troubleshootingStatus.timeRemaining || 0)}</div>
                                            <span className="text-xs text-purple-600">remaining</span>
                                          </div>
                                          <div className="mt-2 w-full bg-purple-200 rounded-full h-2">
                                            <div 
                                              className="bg-purple-600 h-2 rounded-full transition-all duration-1000" 
                                              style={{ width: `${((240 - (troubleshootingStatus.timeRemaining || 0)) / 240) * 100}%` }}
                                            ></div>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                    {troubleshootingStatus.step === 'success' && (
                                      <>
                                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                        </div>
                                        <div>
                                          <p className="font-semibold text-green-800">Success</p>
                                          <p className="text-sm text-green-700">{troubleshootingStatus.message}</p>
                                        </div>
                                      </>
                                    )}
                                    {troubleshootingStatus.step === 'already_active' && (
                                      <>
                                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                          </svg>
                                        </div>
                                        <div>
                                          <p className="font-semibold text-green-800">Line Active</p>
                                          <p className="text-sm text-green-700">{troubleshootingStatus.message}</p>
                                        </div>
                                      </>
                                    )}
                                    {troubleshootingStatus.step === 'error' && (
                                      <>
                                        <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </div>
                                        <div>
                                          <p className="font-semibold text-red-800">Issue Detected</p>
                                          <p className="text-sm text-red-700">{troubleshootingStatus.message}</p>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  {troubleshootingStatus.step === 'reboot_prompt' && (
                                    <button
                                      onClick={() => handleRebootConfirmed(subscription.iccid || subscription.imei || subscription.mdn || '', subscription.iccid ? 'iccid' : subscription.imei ? 'imei' : 'mdn', troubleshootingStatus.iccid || '')}
                                      className="w-full mt-2 px-4 py-3 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                      I've Rebooted My Router
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {isActive && isPaid && (
                          <div className="mt-4">
                            <button
                              onClick={() => handleTroubleshooting(subscription.id, subscription.iccid, subscription.imei, subscription.mdn, lineState)}
                              className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                                troubleshootingSubscription === subscription.id 
                                  ? 'bg-accent text-white' 
                                  : 'bg-primary text-white hover:bg-accent'
                              }`}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {troubleshootingSubscription === subscription.id ? 'Close Troubleshooting' : 'Troubleshooting'}
                            </button>
                            
                            {troubleshootingSubscription === subscription.id && troubleshootingStatus && (
                              <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <div className="flex flex-col gap-3">
                                  <div className="flex items-start gap-3">
                                    {troubleshootingStatus.step === 'resuming' && (
                                      <>
                                        <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0 animate-pulse">
                                          <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                        </div>
                                        <div>
                                          <p className="font-semibold text-yellow-800">Resuming Line</p>
                                          <p className="text-sm text-yellow-700">{troubleshootingStatus.message}</p>
                                        </div>
                                      </>
                                    )}
                                    {troubleshootingStatus.step === 'waiting' && (
                                      <>
                                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                          <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                        </div>
                                        <div className="flex-1">
                                          <p className="font-semibold text-blue-800">Activating Line</p>
                                          <p className="text-sm text-blue-700">{troubleshootingStatus.message}</p>
                                          <div className="mt-2 flex items-center gap-2">
                                            <div className="text-2xl font-bold text-blue-600">{formatTime(troubleshootingStatus.timeRemaining || 0)}</div>
                                            <span className="text-xs text-blue-600">remaining</span>
                                          </div>
                                          <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                                            <div 
                                              className="bg-blue-600 h-2 rounded-full transition-all duration-1000" 
                                              style={{ width: `${((300 - (troubleshootingStatus.timeRemaining || 0)) / 300) * 100}%` }}
                                            ></div>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                    {troubleshootingStatus.step === 'reboot_prompt' && (
                                      <>
                                        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                          </svg>
                                        </div>
                                        <div className="flex-1">
                                          <p className="font-semibold text-orange-800">Reboot Your Router</p>
                                          <p className="text-sm text-orange-700">{troubleshootingStatus.message}</p>
                                        </div>
                                      </>
                                    )}
                                    {troubleshootingStatus.step === 'extended_wait' && (
                                      <>
                                        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                                          <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                        </div>
                                        <div className="flex-1">
                                          <p className="font-semibold text-purple-800">Taking Longer Than Usual</p>
                                          <p className="text-sm text-purple-700">{troubleshootingStatus.message}</p>
                                          <div className="mt-2 flex items-center gap-2">
                                            <div className="text-2xl font-bold text-purple-600">{formatTime(troubleshootingStatus.timeRemaining || 0)}</div>
                                            <span className="text-xs text-purple-600">remaining</span>
                                          </div>
                                          <div className="mt-2 w-full bg-purple-200 rounded-full h-2">
                                            <div 
                                              className="bg-purple-600 h-2 rounded-full transition-all duration-1000" 
                                              style={{ width: `${((240 - (troubleshootingStatus.timeRemaining || 0)) / 240) * 100}%` }}
                                            ></div>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                    {troubleshootingStatus.step === 'success' && (
                                      <>
                                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                        </div>
                                        <div>
                                          <p className="font-semibold text-green-800">Success</p>
                                          <p className="text-sm text-green-700">{troubleshootingStatus.message}</p>
                                        </div>
                                      </>
                                    )}
                                    {troubleshootingStatus.step === 'already_active' && (
                                      <>
                                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                          </svg>
                                        </div>
                                        <div>
                                          <p className="font-semibold text-green-800">Line Active</p>
                                          <p className="text-sm text-green-700">{troubleshootingStatus.message}</p>
                                        </div>
                                      </>
                                    )}
                                    {troubleshootingStatus.step === 'error' && (
                                      <>
                                        <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </div>
                                        <div>
                                          <p className="font-semibold text-red-800">Issue Detected</p>
                                          <p className="text-sm text-red-700">{troubleshootingStatus.message}</p>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  {troubleshootingStatus.step === 'reboot_prompt' && (
                                    <button
                                      onClick={() => handleRebootConfirmed(subscription.iccid || subscription.imei || subscription.mdn || '', subscription.iccid ? 'iccid' : subscription.imei ? 'imei' : 'mdn', troubleshootingStatus.iccid || '')}
                                      className="w-full mt-2 px-4 py-3 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                      I've Rebooted My Router
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {isActive && !isPaid && !gracePeriod.inGracePeriod && (
                          <div className="mt-4">
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
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
                            <div className="flex gap-3">
                              <button
                                onClick={() => handlePayNow(cbCustomer.id)}
                                disabled={paymentLoading === 'pay'}
                                className="flex-1 px-4 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {paymentLoading === 'pay' ? 'Loading...' : `Pay Now ${formatCurrency(subscription.totalDues)}`}
                              </button>
                              <button
                                disabled
                                className="px-4 py-3 text-sm font-medium text-gray-400 border-2 border-gray-300 rounded-lg cursor-not-allowed flex items-center gap-2 opacity-50"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Troubleshooting
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }))}
                {allSubscriptions.length === 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                    <p className="text-muted">No subscriptions found</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
      
      {authToken && <ChatWidget token={authToken} dataLoaded={!isLoadingData} />}

      {selectedSubscription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-text">Subscription Details</h2>
                <p className="text-sm text-muted">{selectedSubscription.subscription.planId}</p>
              </div>
              <button
                onClick={() => setSelectedSubscription(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted">Status</p>
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${getStatusColor(selectedSubscription.subscription.status)}`}>
                      {selectedSubscription.subscription.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-muted">Amount</p>
                    <p className="font-bold text-primary">{formatCurrency(selectedSubscription.subscription.planAmount)}/{selectedSubscription.subscription.billingPeriodUnit}</p>
                  </div>
                  <div>
                    <p className="text-muted">Next Billing</p>
                    <p className="font-medium">{formatDate(selectedSubscription.subscription.nextBillingAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted">Amount Due</p>
                    <p className={`font-bold ${selectedSubscription.subscription.totalDues > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(selectedSubscription.subscription.totalDues)}
                    </p>
                  </div>
                </div>

                {selectedSubscription.subscription.totalDues > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 flex gap-3">
                    <button
                      onClick={() => handlePayNow(selectedSubscription.customerId)}
                      disabled={paymentLoading === 'pay'}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {paymentLoading === 'pay' ? 'Loading...' : `Pay Now ${formatCurrency(selectedSubscription.subscription.totalDues)}`}
                    </button>
                    <button
                      onClick={() => handleUpdatePaymentMethod(selectedSubscription.customerId)}
                      disabled={paymentLoading === 'update'}
                      className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {paymentLoading === 'update' ? 'Loading...' : 'Update Payment Method'}
                    </button>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-text mb-4">Invoices for this Subscription</h3>
                {selectedSubscription.invoices.length > 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                ) : (
                  <p className="text-muted text-sm">No invoices found for this subscription</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-text mb-4">Transactions for this Subscription</h3>
                {selectedSubscription.transactions.length > 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
