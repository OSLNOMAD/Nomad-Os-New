import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface CancellationModalProps {
  isOpen: boolean
  onClose: () => void
  subscription: {
    id: string
    planId: string
    status: string
    planAmount: number
    dueInvoiceCount?: number
  }
  token: string
}

interface ExistingRequest {
  requestId: number
  ticketId: string | null
  message: string
}

type FlowStep = 
  | 'reason_selection'
  | 'price_negotiation'
  | 'troubleshooting_offer'
  | 'retention_offer'
  | 'contact_preference'
  | 'completed'

interface RetentionOffer {
  type: string
  description: string
  discountAmount: number
  newPrice: number
  duration: string
}

const CANCELLATION_REASONS = [
  { id: 'too_expensive', label: 'Too expensive', icon: '💰' },
  { id: 'slow_speeds', label: 'Slow speeds / performance issues', icon: '🐢' },
  { id: 'not_reliable', label: 'Internet not reliable', icon: '📶' },
  { id: 'no_longer_needed', label: 'No longer needed', icon: '✋' },
  { id: 'moving', label: 'Moving / changing provider', icon: '🏠' },
  { id: 'other', label: 'Other', icon: '📝' }
]

export function CancellationModal({ isOpen, onClose, subscription, token }: CancellationModalProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState<FlowStep>('reason_selection')
  const [requestId, setRequestId] = useState<number | null>(null)
  const [selectedReason, setSelectedReason] = useState('')
  const [reasonDetails, setReasonDetails] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [retentionOffer, setRetentionOffer] = useState<RetentionOffer | null>(null)
  const [contactMethod, setContactMethod] = useState<'email' | 'phone'>('email')
  const [phone, setPhone] = useState('')
  const [callTime, setCallTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [ticketId, setTicketId] = useState('')
  const [discountEligible, setDiscountEligible] = useState(true)
  const [isUnpaidSubscription, setIsUnpaidSubscription] = useState(false)
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [existingRequest, setExistingRequest] = useState<ExistingRequest | null>(null)
  const [visible, setVisible] = useState(false)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100)
  }

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const handleStartCancellation = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/cancellation/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          currentPrice: Math.round((subscription.planAmount || 0) * 100),
          dueInvoiceCount: subscription.dueInvoiceCount || 0
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      
      if (data.hasExistingRequest) {
        setExistingRequest({
          requestId: data.existingRequestId,
          ticketId: data.ticketId,
          message: data.message
        })
      } else {
        setRequestId(data.requestId)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start cancellation')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitReason = async () => {
    if (!selectedReason) {
      setError('Please select a reason')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/cancellation/submit-reason', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId,
          reason: selectedReason,
          reasonDetails: selectedReason === 'other' ? reasonDetails : undefined
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setDiscountEligible(data.discountEligible !== false)
      setIsUnpaidSubscription(data.isUnpaid === true)
      setStep(data.nextStep as FlowStep)
    } catch (err: any) {
      setError(err.message || 'Failed to submit reason')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitTargetPrice = async () => {
    setLoading(true)
    setError('')
    try {
      const priceInCents = Math.round(parseFloat(targetPrice) * 100) || 0
      const response = await fetch('/api/cancellation/submit-target-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId,
          targetPrice: priceInCents
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setRetentionOffer(data.retentionOffer)
      setStep('retention_offer')
    } catch (err: any) {
      setError(err.message || 'Failed to submit price')
    } finally {
      setLoading(false)
    }
  }

  const handleRespondToOffer = async (accepted: boolean) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/cancellation/respond-to-offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId,
          accepted
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      
      if (data.outcome === 'retained') {
        setSuccessMessage(data.message)
        setStep('completed')
      } else {
        setStep('contact_preference')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process response')
    } finally {
      setLoading(false)
    }
  }

  const handleTroubleshootingResponse = async (accepted: boolean) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/cancellation/troubleshooting-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId,
          accepted
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      
      if (data.redirect) {
        onClose()
        navigate(data.redirect)
      } else {
        setStep('retention_offer')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process response')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitContact = async () => {
    if (contactMethod === 'phone' && !phone) {
      setError('Please enter your phone number')
      return
    }
    if (additionalNotes.trim().length < 50) {
      setError('Please provide at least 50 characters explaining your concerns')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/cancellation/submit-contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId,
          contactMethod,
          phone: contactMethod === 'phone' ? phone : undefined,
          callTime: contactMethod === 'phone' ? callTime : undefined,
          additionalNotes: additionalNotes.trim()
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      
      setSuccessMessage(data.message)
      setTicketId(data.ticketId)
      setStep('completed')
    } catch (err: any) {
      setError(err.message || 'Failed to submit request')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && !requestId) {
      handleStartCancellation()
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
      setStep('reason_selection')
      setSelectedReason('')
      setReasonDetails('')
      setTargetPrice('')
      setRetentionOffer(null)
      setContactMethod('email')
      setPhone('')
      setCallTime('')
      setError('')
      setSuccessMessage('')
      setTicketId('')
      setRequestId(null)
      setAdditionalNotes('')
      setExistingRequest(null)
      setDiscountEligible(true)
      setIsUnpaidSubscription(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const isCompleted = step === 'completed'
  const headerGradient = isCompleted
    ? 'linear-gradient(135deg, #0d9668 0%, #10a37f 50%, #34d399 100%)'
    : 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: visible ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
        backdropFilter: visible ? 'blur(8px)' : 'blur(0px)',
        transition: 'background-color 0.3s ease, backdrop-filter 0.3s ease',
      }}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(10px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="relative px-6 pt-6 pb-5"
          style={{ background: headerGradient }}
        >
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {isCompleted ? (successMessage ? 'Request Submitted' : 'Thank You!') : 'Cancel Subscription'}
              </h2>
              <p className={`text-sm mt-0.5 ${isCompleted ? 'text-emerald-100' : 'text-red-100'}`}>
                {isCompleted ? 'We appreciate your feedback' : 'We\'re sorry to see you go'}
              </p>
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

          {error && (
            <div className="mb-4 rounded-2xl px-4 py-3.5 border" style={{ backgroundColor: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.15)' }}>
              <div className="flex items-start gap-2.5">
                <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-red-600 leading-relaxed font-medium">{error}</p>
              </div>
            </div>
          )}

          {existingRequest && (
            <div className="space-y-4">
              <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.15)' }}>
                <div className="flex items-start gap-3.5">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.15))' }}
                  >
                    <span className="text-xl">⏳</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-amber-800 text-[15px]">Active Request Pending</p>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">{existingRequest.message}</p>
                    {existingRequest.ticketId && (
                      <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}>
                        <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                        <span className="text-xs font-semibold text-amber-700">{existingRequest.ticketId}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-full py-3 text-white font-semibold rounded-xl text-sm transition-all duration-300 hover:shadow-lg hover:shadow-emerald-100 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8c6d 100%)' }}
              >
                Got it
              </button>
            </div>
          )}

          {step === 'reason_selection' && !existingRequest && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 leading-relaxed">
                Please help us understand why you're cancelling so we can improve.
              </p>
              
              <div className="space-y-2.5">
                {CANCELLATION_REASONS.map((reason) => (
                  <div
                    key={reason.id}
                    onClick={() => setSelectedReason(reason.id)}
                    className={`group relative rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden ${
                      selectedReason === reason.id
                        ? 'ring-2 ring-red-400'
                        : 'hover:border-gray-300'
                    }`}
                    style={{
                      border: selectedReason === reason.id ? 'none' : '1px solid #e5e7eb',
                      boxShadow: selectedReason === reason.id ? '0 4px 12px rgba(239,68,68,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={reason.id}
                      checked={selectedReason === reason.id}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="sr-only"
                    />
                    <div className={`flex items-center gap-3.5 p-4 transition-colors duration-300 ${
                      selectedReason === reason.id ? 'bg-red-50/60' : 'bg-white hover:bg-gray-50/50'
                    }`}>
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                          selectedReason === reason.id ? '' : 'bg-gray-50 group-hover:bg-gray-100'
                        }`}
                        style={selectedReason === reason.id ? { background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(248,113,113,0.15))' } : {}}
                      >
                        <span className="text-lg">{reason.icon}</span>
                      </div>
                      <span className={`font-medium text-[15px] flex-1 transition-colors duration-200 ${
                        selectedReason === reason.id ? 'text-gray-900' : 'text-gray-700'
                      }`}>{reason.label}</span>
                      {selectedReason === reason.id && (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {selectedReason === 'other' && (
                <textarea
                  value={reasonDetails}
                  onChange={(e) => setReasonDetails(e.target.value)}
                  placeholder="Please tell us more..."
                  className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-300 focus:border-transparent transition-all duration-200 text-sm resize-none"
                  rows={3}
                />
              )}

              <button
                onClick={handleSubmitReason}
                disabled={loading || !selectedReason}
                className="w-full py-3 text-white font-semibold rounded-xl text-sm transition-all duration-300 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Processing...
                  </span>
                ) : 'Continue'}
              </button>
            </div>
          )}

          {step === 'price_negotiation' && (
            <div className="space-y-4">
              <div
                className="rounded-2xl p-4 border"
                style={{ backgroundColor: 'rgba(59,130,246,0.04)', borderColor: 'rgba(59,130,246,0.12)' }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(96,165,250,0.15))' }}
                  >
                    <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-blue-800 text-[15px]">We may be able to help!</p>
                    <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
                      Your current plan is {formatCurrency(subscription.planAmount)}/month.
                      What price would work better for you?
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target monthly price
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                  <input
                    type="number"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-transparent transition-all duration-200 text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('retention_offer')}
                  className="flex-1 px-4 py-3 text-gray-600 font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 text-sm"
                >
                  Skip
                </button>
                <button
                  onClick={handleSubmitTargetPrice}
                  disabled={loading}
                  className="flex-[1.5] px-4 py-3 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-blue-100 active:scale-[0.98] text-sm disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Processing...
                    </span>
                  ) : 'See Offer'}
                </button>
              </div>
            </div>
          )}

          {step === 'troubleshooting_offer' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center mb-2">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.15))' }}
                >
                  <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-gray-900">Let us help fix the issue!</h4>
                <p className="text-sm text-gray-400 mt-1 text-center">Before you cancel, try our guided troubleshooting flow.</p>
              </div>

              <div
                className="rounded-2xl p-4 border"
                style={{ backgroundColor: 'rgba(245,158,11,0.04)', borderColor: 'rgba(245,158,11,0.12)' }}
              >
                <div className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                    Many issues can be resolved quickly with our troubleshooting tools. Give it a try before deciding.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleTroubleshootingResponse(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-3 text-gray-600 font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 text-sm disabled:opacity-50"
                >
                  No, Continue
                </button>
                <button
                  onClick={() => handleTroubleshootingResponse(true)}
                  disabled={loading}
                  className="flex-[1.5] px-4 py-3 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-amber-100 active:scale-[0.98] text-sm disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Processing...
                    </span>
                  ) : 'Yes, Troubleshoot'}
                </button>
              </div>
            </div>
          )}

          {step === 'retention_offer' && (
            <div className="space-y-4">
              {retentionOffer ? (
                <>
                  <div className="flex flex-col items-center mb-2">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                      style={{ background: 'linear-gradient(135deg, rgba(16,163,127,0.1), rgba(52,211,153,0.15))' }}
                    >
                      <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900">Special Offer For You!</h4>
                  </div>

                  <div
                    className="relative rounded-2xl p-[1px] overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, #10a37f, #34d399, #10a37f)' }}
                  >
                    <div className="rounded-2xl bg-white p-5 text-center">
                      <p className="text-xl font-bold text-emerald-700 mb-1">{retentionOffer.description}</p>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <span className="text-2xl font-bold" style={{ color: '#10a37f' }}>{formatCurrency(retentionOffer.newPrice)}</span>
                        <span className="text-gray-400 text-sm">/month</span>
                      </div>
                      <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(16,163,127,0.1)' }}>
                        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-semibold text-emerald-700">for {retentionOffer.duration}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleRespondToOffer(false)}
                      disabled={loading}
                      className="flex-1 px-4 py-3 text-gray-600 font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 text-sm disabled:opacity-50"
                    >
                      No Thanks
                    </button>
                    <button
                      onClick={() => handleRespondToOffer(true)}
                      disabled={loading}
                      className="flex-[1.5] px-4 py-3 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-emerald-100 active:scale-[0.98] text-sm disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #10a37f, #0d8c6d)' }}
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Processing...
                        </span>
                      ) : 'Accept Offer'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center mb-2">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                      style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(96,165,250,0.15))' }}
                    >
                      <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900">We'd love to keep you!</h4>
                    <p className="text-sm text-gray-400 mt-1 text-center">We may be able to offer you a discount.</p>
                  </div>

                  <div
                    className="rounded-2xl p-4 border"
                    style={{ backgroundColor: 'rgba(59,130,246,0.04)', borderColor: 'rgba(59,130,246,0.12)' }}
                  >
                    <div className="flex items-start gap-2.5">
                      <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs text-blue-600 leading-relaxed font-medium">
                        Would you like to speak with our retention team? They might have options for you.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('contact_preference')}
                      disabled={loading}
                      className="flex-1 px-4 py-3 text-gray-600 font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 text-sm disabled:opacity-50"
                    >
                      No, Continue
                    </button>
                    <button
                      onClick={() => setStep('contact_preference')}
                      disabled={loading}
                      className="flex-[1.5] px-4 py-3 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-blue-100 active:scale-[0.98] text-sm disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                    >
                      Speak with Team
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'contact_preference' && (
            <div className="space-y-4">
              {!discountEligible && (
                <div className="rounded-2xl px-4 py-3.5 border" style={{ backgroundColor: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.12)' }}>
                  <div className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-amber-700 leading-relaxed font-medium">
                      You received a discount within the last 2 months, so you are not currently eligible for another discount offer.
                    </p>
                  </div>
                </div>
              )}
              {isUnpaidSubscription && (selectedReason === 'slow_speeds' || selectedReason === 'not_reliable') && (
                <div className="rounded-2xl px-4 py-3.5 border" style={{ backgroundColor: 'rgba(59,130,246,0.04)', borderColor: 'rgba(59,130,246,0.12)' }}>
                  <div className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-blue-600 leading-relaxed font-medium">
                      Since your subscription is not currently active, we cannot perform remote troubleshooting. Our team will follow up with you.
                    </p>
                  </div>
                </div>
              )}
              <p className="text-sm text-gray-500 leading-relaxed">
                A member of our retention team will reach out to discuss your options.
                How would you prefer to be contacted?
              </p>

              <div className="space-y-2.5">
                <div
                  onClick={() => setContactMethod('email')}
                  className={`group relative rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden ${
                    contactMethod === 'email' ? 'ring-2 ring-red-400' : 'hover:border-gray-300'
                  }`}
                  style={{
                    border: contactMethod === 'email' ? 'none' : '1px solid #e5e7eb',
                    boxShadow: contactMethod === 'email' ? '0 4px 12px rgba(239,68,68,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <input
                    type="radio"
                    name="contact"
                    value="email"
                    checked={contactMethod === 'email'}
                    onChange={() => setContactMethod('email')}
                    className="sr-only"
                  />
                  <div className={`flex items-center gap-3.5 p-4 transition-colors duration-300 ${
                    contactMethod === 'email' ? 'bg-red-50/60' : 'bg-white hover:bg-gray-50/50'
                  }`}>
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                        contactMethod === 'email' ? '' : 'bg-gray-50 group-hover:bg-gray-100'
                      }`}
                      style={contactMethod === 'email' ? { background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(248,113,113,0.15))' } : {}}
                    >
                      <span className="text-lg">📧</span>
                    </div>
                    <span className={`font-medium text-[15px] flex-1 transition-colors duration-200 ${
                      contactMethod === 'email' ? 'text-gray-900' : 'text-gray-700'
                    }`}>Contact me via Email</span>
                    {contactMethod === 'email' && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  onClick={() => setContactMethod('phone')}
                  className={`group relative rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden ${
                    contactMethod === 'phone' ? 'ring-2 ring-red-400' : 'hover:border-gray-300'
                  }`}
                  style={{
                    border: contactMethod === 'phone' ? 'none' : '1px solid #e5e7eb',
                    boxShadow: contactMethod === 'phone' ? '0 4px 12px rgba(239,68,68,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <input
                    type="radio"
                    name="contact"
                    value="phone"
                    checked={contactMethod === 'phone'}
                    onChange={() => setContactMethod('phone')}
                    className="sr-only"
                  />
                  <div className={`flex items-center gap-3.5 p-4 transition-colors duration-300 ${
                    contactMethod === 'phone' ? 'bg-red-50/60' : 'bg-white hover:bg-gray-50/50'
                  }`}>
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                        contactMethod === 'phone' ? '' : 'bg-gray-50 group-hover:bg-gray-100'
                      }`}
                      style={contactMethod === 'phone' ? { background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(248,113,113,0.15))' } : {}}
                    >
                      <span className="text-lg">📞</span>
                    </div>
                    <span className={`font-medium text-[15px] flex-1 transition-colors duration-200 ${
                      contactMethod === 'phone' ? 'text-gray-900' : 'text-gray-700'
                    }`}>Call me</span>
                    {contactMethod === 'phone' && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {contactMethod === 'phone' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-300 focus:border-transparent transition-all duration-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Best time to call (optional)
                    </label>
                    <select
                      value={callTime}
                      onChange={(e) => setCallTime(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-300 focus:border-transparent transition-all duration-200 text-sm"
                    >
                      <option value="">Any time</option>
                      <option value="morning">Morning (9am - 12pm)</option>
                      <option value="afternoon">Afternoon (12pm - 5pm)</option>
                      <option value="evening">Evening (5pm - 8pm)</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Please explain why you're canceling <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  Share any concerns or feedback you'd like us to know before we reach out. (Minimum 50 characters)
                </p>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Please tell us more about your experience and why you're considering cancellation..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-300 focus:border-transparent resize-none transition-all duration-200 text-sm"
                />
                <p className={`text-xs mt-1.5 font-medium ${additionalNotes.length < 50 ? 'text-gray-400' : 'text-emerald-500'}`}>
                  {additionalNotes.length}/50 characters minimum
                </p>
              </div>

              <button
                onClick={handleSubmitContact}
                disabled={loading}
                className="w-full py-3 text-white font-semibold rounded-xl text-sm transition-all duration-300 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Submitting...
                  </span>
                ) : 'Submit Request'}
              </button>
            </div>
          )}

          {step === 'completed' && (
            <div className="text-center space-y-4">
              <div className="flex flex-col items-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'linear-gradient(135deg, rgba(16,163,127,0.1), rgba(52,211,153,0.15))' }}
                >
                  <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {successMessage || 'Your request has been processed successfully.'}
                </p>
              </div>

              {ticketId && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ backgroundColor: 'rgba(16,163,127,0.08)' }}>
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  <span className="text-xs font-semibold text-emerald-700">Reference: #{ticketId}</span>
                </div>
              )}

              <button
                onClick={handleClose}
                className="w-full py-3 text-white font-semibold rounded-xl text-sm transition-all duration-300 hover:shadow-lg hover:shadow-emerald-100 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8c6d 100%)' }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
