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
  }
  token: string
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

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100)
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
          currentPrice: subscription.planAmount
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setRequestId(data.requestId)
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
          callTime: contactMethod === 'phone' ? callTime : undefined
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
    if (!isOpen) {
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
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {step === 'completed' ? (successMessage ? 'Request Submitted' : 'Thank You!') : 'Cancel Subscription'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {step === 'reason_selection' && (
            <div className="space-y-4">
              <p className="text-gray-600">
                We're sorry to see you go. Please help us understand why you're cancelling.
              </p>
              
              <div className="space-y-2">
                {CANCELLATION_REASONS.map((reason) => (
                  <label
                    key={reason.id}
                    className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedReason === reason.id
                        ? 'border-primary bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={reason.id}
                      checked={selectedReason === reason.id}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="sr-only"
                    />
                    <span className="text-xl">{reason.icon}</span>
                    <span className="font-medium text-gray-700">{reason.label}</span>
                    {selectedReason === reason.id && (
                      <svg className="w-5 h-5 text-primary ml-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </label>
                ))}
              </div>

              {selectedReason === 'other' && (
                <textarea
                  value={reasonDetails}
                  onChange={(e) => setReasonDetails(e.target.value)}
                  placeholder="Please tell us more..."
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  rows={3}
                />
              )}

              <button
                onClick={handleSubmitReason}
                disabled={loading || !selectedReason}
                className="w-full py-3 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
              >
                {loading ? 'Processing...' : 'Continue'}
              </button>
            </div>
          )}

          {step === 'price_negotiation' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="font-medium text-blue-800 mb-1">We may be able to help!</p>
                <p className="text-sm text-blue-700">
                  Your current plan is {formatCurrency(subscription.planAmount)}/month.
                  What price would work better for you?
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target monthly price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('retention_offer')}
                  className="flex-1 py-3 text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={handleSubmitTargetPrice}
                  disabled={loading}
                  className="flex-1 py-3 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
                >
                  {loading ? 'Processing...' : 'See Offer'}
                </button>
              </div>
            </div>
          )}

          {step === 'troubleshooting_offer' && (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="font-medium text-yellow-800 mb-1">Let us help fix the issue!</p>
                <p className="text-sm text-yellow-700">
                  Before you cancel, would you like to try our guided troubleshooting flow?
                  Many issues can be resolved quickly.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleTroubleshootingResponse(false)}
                  disabled={loading}
                  className="flex-1 py-3 text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  No, Continue
                </button>
                <button
                  onClick={() => handleTroubleshootingResponse(true)}
                  disabled={loading}
                  className="flex-1 py-3 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
                >
                  {loading ? 'Processing...' : 'Yes, Troubleshoot'}
                </button>
              </div>
            </div>
          )}

          {step === 'retention_offer' && (
            <div className="space-y-4">
              {retentionOffer ? (
                <>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <p className="font-medium text-green-800 text-lg mb-2">Special Offer For You!</p>
                    <p className="text-2xl font-bold text-green-700 mb-1">{retentionOffer.description}</p>
                    <p className="text-sm text-green-600">
                      New price: {formatCurrency(retentionOffer.newPrice)}/month for {retentionOffer.duration}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleRespondToOffer(false)}
                      disabled={loading}
                      className="flex-1 py-3 text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      No Thanks
                    </button>
                    <button
                      onClick={() => handleRespondToOffer(true)}
                      disabled={loading}
                      className="flex-1 py-3 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
                    >
                      {loading ? 'Processing...' : 'Accept Offer'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="font-medium text-blue-800 mb-1">We'd love to keep you!</p>
                    <p className="text-sm text-blue-700">
                      We may be able to offer you a discount. Would you like to speak with our retention team?
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('contact_preference')}
                      disabled={loading}
                      className="flex-1 py-3 text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      No, Continue
                    </button>
                    <button
                      onClick={() => setStep('contact_preference')}
                      disabled={loading}
                      className="flex-1 py-3 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
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
              <p className="text-gray-600">
                A member of our retention team will reach out to discuss your options.
                How would you prefer to be contacted?
              </p>

              <div className="space-y-2">
                <label
                  className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    contactMethod === 'email'
                      ? 'border-primary bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="contact"
                    value="email"
                    checked={contactMethod === 'email'}
                    onChange={() => setContactMethod('email')}
                    className="sr-only"
                  />
                  <span className="text-xl">📧</span>
                  <span className="font-medium text-gray-700">Contact me via Email</span>
                </label>

                <label
                  className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    contactMethod === 'phone'
                      ? 'border-primary bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="contact"
                    value="phone"
                    checked={contactMethod === 'phone'}
                    onChange={() => setContactMethod('phone')}
                    className="sr-only"
                  />
                  <span className="text-xl">📞</span>
                  <span className="font-medium text-gray-700">Call me</span>
                </label>
              </div>

              {contactMethod === 'phone' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Best time to call (optional)
                    </label>
                    <select
                      value={callTime}
                      onChange={(e) => setCallTime(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Any time</option>
                      <option value="morning">Morning (9am - 12pm)</option>
                      <option value="afternoon">Afternoon (12pm - 5pm)</option>
                      <option value="evening">Evening (5pm - 8pm)</option>
                    </select>
                  </div>
                </div>
              )}

              <button
                onClick={handleSubmitContact}
                disabled={loading}
                className="w-full py-3 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          )}

          {step === 'completed' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <p className="text-gray-600">
                {successMessage || 'Your request has been processed successfully.'}
              </p>

              {ticketId && (
                <p className="text-sm text-gray-500">
                  Reference: #{ticketId}
                </p>
              )}

              <button
                onClick={onClose}
                className="w-full py-3 text-white font-medium rounded-lg transition-colors"
                style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
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
