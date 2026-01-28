import { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'

function RawDataPanel({ data, title }: { data: any; title: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-muted hover:text-primary transition-colors"
      >
        <svg 
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {isExpanded ? 'Hide' : 'Show'} Full {title} Data
      </button>
      {isExpanded && (
        <pre className="mt-3 p-4 bg-gray-900 text-green-400 rounded-lg text-xs overflow-x-auto max-h-96 overflow-y-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

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

export default function Dashboard() {
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [fullData, setFullData] = useState<FullData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'orders' | 'invoices' | 'internet'>('overview')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('auth_token')
      
      if (!token) {
        navigate('/signin')
        return
      }

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
  const allTransactions = fullData?.chargebee.customers.flatMap(c => c.transactions) || []

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
      <header className="bg-white border-b border-gray-200 px-6 py-4">
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
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
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

      <main className="max-w-7xl mx-auto px-6 py-8">
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
                            
                            <RawDataPanel data={sub} title="Subscription" />
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
                    
                    <RawDataPanel data={order} title="Order" />
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
                
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase">Invoice</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase">Date</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase">Status</th>
                        <th className="text-right px-6 py-3 text-xs font-medium text-muted uppercase">Total</th>
                        <th className="text-right px-6 py-3 text-xs font-medium text-muted uppercase">Paid</th>
                        <th className="text-right px-6 py-3 text-xs font-medium text-muted uppercase">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {allInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-text">{inv.id}</td>
                          <td className="px-6 py-4 text-sm text-muted">{formatDate(inv.date)}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(inv.status)}`}>
                              {inv.status}
                            </span>
                            {inv.dunningStatus && (
                              <span className="ml-2 text-xs text-orange-600">
                                (Dunning: {inv.dunningStatus})
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-medium">{formatCurrency(inv.total)}</td>
                          <td className="px-6 py-4 text-sm text-right text-green-600">{formatCurrency(inv.amountPaid)}</td>
                          <td className={`px-6 py-4 text-sm text-right font-medium ${inv.amountDue > 0 ? 'text-red-600' : ''}`}>
                            {formatCurrency(inv.amountDue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <RawDataPanel data={allInvoices} title="Invoices" />

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
                
                <RawDataPanel data={allTransactions} title="Transactions" />
              </div>
            )}

            {activeTab === 'internet' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-text">Your Internet</h2>
                {fullData?.devices.map((device, idx) => (
                  <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-3 h-3 rounded-full ${device.connected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <h3 className="text-lg font-semibold text-text">
                        {device.identifiers.mdn || device.identifiers.iccid || 'Device'}
                      </h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(device.carrier?.state || device.state)}`}>
                        {device.carrier?.state || device.state}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted">MDN</p>
                        <p className="font-mono">{device.identifiers.mdn || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted">ICCID</p>
                        <p className="font-mono text-xs">{device.identifiers.iccid || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted">IMEI</p>
                        <p className="font-mono text-xs">{device.identifiers.imei || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted">IP Address</p>
                        <p className="font-mono">{device.ipAddress || 'N/A'}</p>
                      </div>
                    </div>

                    {device.carrier && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted">Carrier</p>
                            <p className="font-medium">{device.carrier.name}</p>
                          </div>
                          <div>
                            <p className="text-muted">Service Plan</p>
                            <p className="font-mono text-xs">{device.carrier.servicePlan}</p>
                          </div>
                          <div>
                            <p className="text-muted">Last Connected</p>
                            <p className="font-medium">{formatDate(device.lastConnectionDate || '')}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <RawDataPanel data={device} title="Device" />
                  </div>
                ))}
                {(!fullData?.devices.length) && (
                  <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                    <p className="text-muted">No devices found</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
