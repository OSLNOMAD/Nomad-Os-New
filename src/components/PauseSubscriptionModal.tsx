import { useState, useEffect } from 'react'

interface PauseSubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  subscription: {
    id: string
    planId: string
    status: string
    planAmount: number
    totalDues: number
    dueInvoicesCount: number
    nextBillingAt?: string
    subscriptionItems?: Array<{
      itemPriceId: string
      itemType: string
      quantity: number
      amount: number
      unitPrice: number
    }>
  }
  token: string
  onPauseComplete: () => void
}

type FlowStep =
  | 'checking'
  | 'unpaid'
  | 'no_travel_addon'
  | 'adding_addon'
  | 'addon_added_checking'
  | 'select_duration'
  | 'confirming'
  | 'success'
  | 'error'
  | 'limit_reached'

const PAUSE_REASONS = [
  { value: 'traveling', label: 'Traveling' },
  { value: 'seasonal', label: 'Seasonal use only' },
  { value: 'financial', label: 'Financial reasons' },
  { value: 'temporary_relocation', label: 'Temporary relocation' },
  { value: 'not_using', label: 'Not currently using the service' },
  { value: 'trying_alternative', label: 'Trying an alternative service' },
  { value: 'other', label: 'Other' },
]

export function PauseSubscriptionModal({ isOpen, onClose, subscription, token, onPauseComplete }: PauseSubscriptionModalProps) {
  const [step, setStep] = useState<FlowStep>('checking')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [durationMonths, setDurationMonths] = useState(1)
  const [maxDuration, setMaxDuration] = useState(3)
  const [pauseMonthsUsed, setPauseMonthsUsed] = useState(0)
  const [remainingMonths, setRemainingMonths] = useState(6)
  const [pauseResult, setPauseResult] = useState<{ pauseDate: string; resumeDate: string } | null>(null)
  const [totalDues, setTotalDues] = useState(0)
  const [addingAddonStatus, setAddingAddonStatus] = useState('')
  const [pollCount, setPollCount] = useState(0)
  const [hasTravelAddon, setHasTravelAddon] = useState(false)
  const [pauseReason, setPauseReason] = useState('')
  const [pauseReasonDetails, setPauseReasonDetails] = useState('')
  const [visible, setVisible] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getResumeDate = () => {
    const now = new Date()
    const pauseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const nextBilling = subscription.nextBillingAt ? new Date(subscription.nextBillingAt) : null
    const billingDay = nextBilling ? nextBilling.getUTCDate() : pauseDate.getDate()
    const resumeDate = new Date(pauseDate)
    resumeDate.setMonth(resumeDate.getMonth() + durationMonths)
    resumeDate.setDate(billingDay)
    return resumeDate
  }

  useEffect(() => {
    if (isOpen) {
      setStep('checking')
      setError('')
      setDurationMonths(1)
      setPauseResult(null)
      setPollCount(0)
      setAddingAddonStatus('')
      setHasTravelAddon(false)
      setPauseReason('')
      setPauseReasonDetails('')
      checkEligibility()
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [isOpen])

  const handleClose = () => {
    if (step === 'success') {
      onPauseComplete()
    }
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const checkEligibility = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/subscription/pause/check-eligibility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subscriptionId: subscription.id })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to check eligibility')
        setStep('error')
        return
      }

      if (!data.eligible) {
        if (data.reason === 'unpaid') {
          setTotalDues(data.totalDues)
          setStep('unpaid')
        } else if (data.reason === 'limit_reached') {
          setPauseMonthsUsed(data.pauseMonthsUsed)
          setStep('limit_reached')
        } else {
          setError(data.message || 'Subscription is not eligible for pause')
          setStep('error')
        }
        return
      }

      setPauseMonthsUsed(data.pauseMonthsUsed)
      setRemainingMonths(data.remainingMonths)
      setMaxDuration(data.maxDuration)
      setHasTravelAddon(!!data.hasTravelAddon)

      if (!data.hasTravelAddon) {
        setStep('no_travel_addon')
      } else {
        setStep('select_duration')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to check eligibility')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const handleAddTravelAddon = async () => {
    setLoading(true)
    setError('')
    setAddingAddonStatus('Adding travel add-on to your subscription...')
    setStep('adding_addon')

    try {
      const response = await fetch('/api/subscription/pause/add-travel-addon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subscriptionId: subscription.id })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to add travel add-on')
        setStep('error')
        return
      }

      setAddingAddonStatus('Travel add-on added! Checking payment status...')
      setStep('addon_added_checking')
      setPollCount(0)
      pollPaymentStatus()
    } catch (err: any) {
      setError(err.message || 'Failed to add travel add-on')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const pollPaymentStatus = async () => {
    let attempts = 0
    const maxAttempts = 10

    const poll = async () => {
      attempts++
      setPollCount(attempts)

      try {
        const response = await fetch('/api/subscription/pause/check-addon-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ subscriptionId: subscription.id })
        })

        const data = await response.json()

        if (data.isPaid && data.hasTravelAddon) {
          setAddingAddonStatus('Payment confirmed!')
          setHasTravelAddon(true)
          setStep('select_duration')
          return
        }

        if (attempts >= maxAttempts) {
          setAddingAddonStatus('Payment is still processing. Please try again in a few minutes.')
          setError('Payment for the travel add-on is still processing. Please wait a few minutes and try pausing again.')
          setStep('error')
          return
        }

        setTimeout(poll, 3000)
      } catch {
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000)
        } else {
          setError('Could not verify payment status. Please try again.')
          setStep('error')
        }
      }
    }

    poll()
  }

  const handleExecutePause = async () => {
    if (!pauseReason) {
      setError('Please select a reason for pausing.')
      return
    }
    if (!pauseReasonDetails.trim()) {
      setError('Please provide additional details about why you are pausing.')
      return
    }

    setLoading(true)
    setError('')
    setStep('confirming')

    try {
      const response = await fetch('/api/subscription/pause/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscriptionId: subscription.id,
          durationMonths,
          pauseReason,
          pauseReasonDetails: pauseReasonDetails.trim()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to pause subscription')
        setStep('select_duration')
        return
      }

      setPauseResult({
        pauseDate: data.pauseDate,
        resumeDate: data.resumeDate
      })
      setStep('success')
    } catch (err: any) {
      setError(err.message || 'Failed to pause subscription')
      setStep('select_duration')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const canSubmitPause = pauseReason && pauseReasonDetails.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: visible ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
        backdropFilter: visible ? 'blur(8px)' : 'blur(0px)',
        transition: 'background-color 0.3s ease, backdrop-filter 0.3s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(10px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
        }}
      >
        <div
          className="relative px-6 pt-6 pb-5"
          style={{ background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%)' }}
        >
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Pause Subscription</h2>
              <p className="text-amber-100 text-sm mt-0.5">Temporarily pause your service</p>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarWidth: 'thin' }}>

          {step === 'checking' && (
            <div className="flex flex-col items-center py-14">
              <div className="relative w-12 h-12 mb-5">
                <div className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: 'rgba(245,158,11,0.2)' }} />
                <div className="absolute inset-0 rounded-full border-[3px] animate-spin" style={{ borderColor: '#e5e7eb', borderTopColor: '#f59e0b' }} />
              </div>
              <p className="text-gray-400 text-sm font-medium">Checking eligibility...</p>
            </div>
          )}

          {step === 'unpaid' && (
            <div>
              <div className="flex flex-col items-center mb-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(248,113,113,0.15))' }}
                >
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-gray-900">Outstanding Balance</h4>
                <p className="text-sm text-gray-400 mt-1 text-center">Please settle your balance before pausing.</p>
              </div>

              <div
                className="rounded-2xl p-4 mb-6"
                style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.04), rgba(248,113,113,0.06))', border: '1px solid rgba(239,68,68,0.12)' }}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-800">Amount Due</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(totalDues)}</p>
                </div>
                <p className="text-xs text-gray-500 mt-2">Please settle your outstanding balance of {formatCurrency(totalDues)} before pausing your subscription.</p>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-3 text-white font-semibold rounded-xl text-sm transition-all duration-300 hover:shadow-lg hover:shadow-amber-100 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' }}
              >
                Got it
              </button>
            </div>
          )}

          {step === 'limit_reached' && (
            <div>
              <div className="flex flex-col items-center mb-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.15))' }}
                >
                  <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-gray-900">Pause Limit Reached</h4>
                <p className="text-sm text-gray-400 mt-1 text-center">You've used all available pause time.</p>
              </div>

              <div
                className="rounded-2xl p-4 mb-6"
                style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.04), rgba(251,191,36,0.06))', border: '1px solid rgba(245,158,11,0.12)' }}
              >
                <p className="text-sm text-gray-600">
                  You've used all <strong className="text-gray-900">6 months</strong> of pause time in the past 365 days. Please wait until some of your pause time expires.
                </p>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-3 text-white font-semibold rounded-xl text-sm transition-all duration-300 hover:shadow-lg hover:shadow-amber-100 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' }}
              >
                Got it
              </button>
            </div>
          )}

          {step === 'no_travel_addon' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Travel Upgrade Required</p>
              </div>

              <div
                className="rounded-2xl border overflow-hidden"
                style={{ borderColor: 'rgba(245,158,11,0.2)' }}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3.5">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.15))' }}
                    >
                      <svg className="w-5.5 h-5.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900 text-[15px]">Nomad Travel Upgrade</p>
                          <p className="text-xs text-gray-400 mt-0.5">Required to pause your subscription</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold" style={{ color: '#d97706' }}>$19.95</p>
                          <p className="text-[10px] text-gray-400 -mt-0.5">per month</p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-xs text-gray-500">This charge is required before the pause can begin</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-xs text-gray-500">You can remove the add-on once your pause period ends</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="rounded-2xl p-4"
                style={{ border: '1px solid rgba(229,231,235,0.8)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pause Availability</p>
                </div>
                <p className="text-sm text-gray-600">
                  You've used <strong className="text-gray-900">{pauseMonthsUsed}</strong> of <strong className="text-gray-900">6</strong> pause months in the past 12 months.
                  {' '}<strong className="text-gray-900">{remainingMonths}</strong> month{remainingMonths !== 1 ? 's' : ''} remaining.
                </p>
              </div>

              <div
                className="rounded-2xl p-4"
                style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.04), rgba(251,191,36,0.06))', border: '1px solid rgba(245,158,11,0.1)' }}
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">What happens next</p>
                </div>
                <div className="space-y-2">
                  {['Your subscription will be paused', 'Billing for service will stop during the pause', 'Your pause period will begin immediately'].map((text, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}>
                        <svg className="w-3 h-3" style={{ color: '#d97706' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-600">{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-400 text-center">You'll see a confirmation before anything is finalized.</p>

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 text-gray-600 font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTravelAddon}
                  disabled={loading}
                  className="flex-[1.5] px-4 py-3 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-amber-100 active:scale-[0.98] text-sm disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)' }}
                >
                  {loading ? 'Adding...' : 'Add Travel Upgrade & Pause ($19.95/mo)'}
                </button>
              </div>
            </div>
          )}

          {step === 'adding_addon' && (
            <div className="flex flex-col items-center py-14">
              <div className="relative w-12 h-12 mb-5">
                <div className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: 'rgba(245,158,11,0.2)' }} />
                <div className="absolute inset-0 rounded-full border-[3px] animate-spin" style={{ borderColor: '#e5e7eb', borderTopColor: '#f59e0b' }} />
              </div>
              <p className="text-gray-400 text-sm font-medium">{addingAddonStatus}</p>
            </div>
          )}

          {step === 'addon_added_checking' && (
            <div className="flex flex-col items-center py-14">
              <div className="relative w-12 h-12 mb-5">
                <div className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: 'rgba(245,158,11,0.2)' }} />
                <div className="absolute inset-0 rounded-full border-[3px] animate-spin" style={{ borderColor: '#e5e7eb', borderTopColor: '#f59e0b' }} />
              </div>
              <p className="text-gray-400 text-sm font-medium">{addingAddonStatus}</p>
              <p className="text-gray-300 text-xs mt-2">Verifying payment ({pollCount}/10)...</p>
            </div>
          )}

          {step === 'select_duration' && (
            <div className="space-y-5">
              {hasTravelAddon && (
                <div
                  className="flex items-center gap-2.5 text-sm rounded-2xl px-4 py-3"
                  style={{ background: 'linear-gradient(135deg, rgba(16,163,127,0.06), rgba(52,211,153,0.08))', border: '1px solid rgba(16,163,127,0.12)' }}
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(16,163,127,0.15)' }}>
                    <svg className="w-3 h-3" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-emerald-700 font-medium text-sm">Travel Upgrade is active on your account</span>
                </div>
              )}

              <div
                className="rounded-2xl p-4"
                style={{ border: '1px solid rgba(229,231,235,0.8)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pause Availability</p>
                </div>
                <p className="text-sm text-gray-600">
                  You've used <strong className="text-gray-900">{pauseMonthsUsed}</strong> of <strong className="text-gray-900">6</strong> pause months in the past 12 months.
                  {' '}<strong className="text-gray-900">{remainingMonths}</strong> month{remainingMonths !== 1 ? 's' : ''} remaining.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pause Duration</p>
                </div>
                <div className="flex gap-3">
                  {Array.from({ length: maxDuration }, (_, i) => i + 1).map((months) => (
                    <button
                      key={months}
                      onClick={() => setDurationMonths(months)}
                      className={`flex-1 py-3.5 px-4 rounded-xl text-center transition-all duration-300 font-medium ${
                        durationMonths === months
                          ? 'text-white shadow-lg'
                          : 'border border-gray-200 text-gray-700 hover:border-amber-200 hover:bg-amber-50/30 bg-white'
                      }`}
                      style={durationMonths === months ? { background: 'linear-gradient(135deg, #d97706, #f59e0b)', boxShadow: '0 4px 14px rgba(245,158,11,0.3)' } : {}}
                    >
                      <div className="text-lg font-bold">{months}</div>
                      <div className="text-xs opacity-80">month{months !== 1 ? 's' : ''}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="rounded-2xl p-4 space-y-2.5"
                style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.04), rgba(251,191,36,0.06))', border: '1px solid rgba(245,158,11,0.1)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pause Summary</p>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pause starts:</span>
                  <span className="font-semibold text-gray-800">Immediately</span>
                </div>
                <div className="flex justify-between text-sm" style={{ borderTop: '1px solid rgba(245,158,11,0.1)', paddingTop: '0.625rem' }}>
                  <span className="text-gray-500">Resumes on:</span>
                  <span className="font-semibold text-gray-800">
                    {formatDate(getResumeDate().toISOString())}
                  </span>
                </div>
                <div className="flex justify-between text-sm" style={{ borderTop: '1px solid rgba(245,158,11,0.1)', paddingTop: '0.625rem' }}>
                  <span className="text-gray-500">Duration:</span>
                  <span className="font-semibold text-gray-800">{durationMonths} month{durationMonths !== 1 ? 's' : ''}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Reason for Pausing</p>
                </div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Why are you pausing? <span className="text-red-500">*</span>
                </label>
                <select
                  value={pauseReason}
                  onChange={(e) => { setPauseReason(e.target.value); setError('') }}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                >
                  <option value="">Select a reason...</option>
                  {PAUSE_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tell us more <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={pauseReasonDetails}
                  onChange={(e) => { setPauseReasonDetails(e.target.value); setError('') }}
                  placeholder="Please share a few details about why you're pausing your service..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 resize-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                />
              </div>

              {error && (
                <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-100">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div
                className="rounded-2xl p-4"
                style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.04), rgba(251,191,36,0.06))', border: '1px solid rgba(245,158,11,0.1)' }}
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">What happens next</p>
                </div>
                <div className="space-y-2">
                  {['Your subscription will be paused immediately', 'Billing for service will stop during the pause', 'Your service will automatically resume on the date shown above'].map((text, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}>
                        <svg className="w-3 h-3" style={{ color: '#d97706' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-600">{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 text-gray-600 font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecutePause}
                  disabled={loading || !canSubmitPause}
                  className="flex-[1.5] px-4 py-3 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-amber-100 active:scale-[0.98] text-sm disabled:opacity-50"
                  style={{ background: canSubmitPause ? 'linear-gradient(135deg, #d97706, #f59e0b)' : '#9ca3af' }}
                >
                  {loading ? 'Pausing...' : `Pause for ${durationMonths} Month${durationMonths !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          )}

          {step === 'confirming' && (
            <div className="flex flex-col items-center py-14">
              <div className="relative w-12 h-12 mb-5">
                <div className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: 'rgba(245,158,11,0.2)' }} />
                <div className="absolute inset-0 rounded-full border-[3px] animate-spin" style={{ borderColor: '#e5e7eb', borderTopColor: '#f59e0b' }} />
              </div>
              <p className="text-gray-400 text-sm font-medium">Pausing your subscription...</p>
            </div>
          )}

          {step === 'success' && pauseResult && (
            <div>
              <div className="flex flex-col items-center mb-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'linear-gradient(135deg, rgba(16,163,127,0.1), rgba(52,211,153,0.15))' }}
                >
                  <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-gray-900">Subscription Paused</h4>
                <p className="text-sm text-gray-400 mt-1 text-center">Your subscription has been paused successfully.</p>
              </div>

              <div
                className="rounded-2xl p-4 mb-4 space-y-3"
                style={{ background: 'linear-gradient(135deg, rgba(16,163,127,0.04), rgba(52,211,153,0.06))', border: '1px solid rgba(16,163,127,0.12)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#10a37f' }} />
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pause Details</p>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Paused on:</span>
                  <span className="font-semibold text-gray-800">{formatDate(pauseResult.pauseDate)}</span>
                </div>
                <div className="flex justify-between text-sm" style={{ borderTop: '1px solid rgba(16,163,127,0.1)', paddingTop: '0.75rem' }}>
                  <span className="text-gray-500">Resumes on:</span>
                  <span className="font-semibold text-gray-800">{formatDate(pauseResult.resumeDate)}</span>
                </div>
              </div>

              <div className="rounded-2xl px-4 py-3.5 mb-6 bg-blue-50/70 border border-blue-100">
                <div className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-blue-600 leading-relaxed font-medium">
                    Your subscription will automatically resume on the date shown above. You will not be billed during the pause period.
                  </p>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-3 text-white font-semibold rounded-xl text-sm transition-all duration-300 hover:shadow-lg hover:shadow-emerald-100 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #10a37f, #0d8c6d)' }}
              >
                Done
              </button>
            </div>
          )}

          {step === 'error' && (
            <div>
              <div className="flex flex-col items-center mb-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(248,113,113,0.15))' }}
                >
                  <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-gray-900">Something went wrong</h4>
                <p className="text-sm text-gray-400 mt-1 text-center">{error || 'Please try again.'}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 text-gray-600 font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 text-sm"
                >
                  Close
                </button>
                <button
                  onClick={() => { setStep('checking'); checkEligibility() }}
                  className="flex-[1.5] px-4 py-3 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-amber-100 active:scale-[0.98] text-sm"
                  style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)' }}
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
