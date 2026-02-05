import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Plan {
  id: string
  name: string
  price: number
  description: string
  features: string[]
  category: 'residential' | 'travel'
  speedMbps: number
}

const availablePlans: Plan[] = [
  {
    id: 'Nomad-Unlimited-Residential-Plan',
    name: 'Nomad Unlimited Residential',
    price: 99.95,
    description: 'Best for full-time home or fixed-location use',
    features: [
      'Designed for one primary location',
      'Stable performance for everyday home internet use',
      'Ideal for households and remote work',
      '100 Mbps network speed'
    ],
    category: 'residential',
    speedMbps: 100
  },
  {
    id: 'Nomad-Unlimited-Travel-Plan',
    name: 'Nomad Unlimited Travel',
    price: 129.95,
    description: 'Best for RV, travel, or changing locations',
    features: [
      'Works at home and while traveling',
      'Designed for movement and flexible locations',
      'Pause and resume service when not in use',
      '200 Mbps network speed'
    ],
    category: 'travel',
    speedMbps: 200
  }
]

interface PlanChangeModalProps {
  isOpen: boolean
  onClose: () => void
  subscription: {
    id: string
    planId: string
    planName?: string
    planAmount: number
    chargebeeCustomerId?: string
    mdn?: string | null
    iccid?: string | null
  }
  customerEmail: string
  customerName: string
  token: string
}

export function PlanChangeModal({ isOpen, onClose, subscription, customerEmail, customerName, token }: PlanChangeModalProps) {
  const [step, setStep] = useState<'select' | 'confirm' | 'processing' | 'verifying' | 'success' | 'partial_success'>('select')
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [verificationId, setVerificationId] = useState<number | null>(null)
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(300)
  const [verificationStatus, setVerificationStatus] = useState<string>('pending')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Look up current plan speed from availablePlans array
  const currentPlan = availablePlans.find(plan => plan.id === subscription.planId)
  const currentPlanSpeed = currentPlan?.speedMbps ?? null
  
  const filteredPlans = availablePlans.filter(plan => {
    // Don't show the current plan
    if (plan.id === subscription.planId) return false
    // Only show the opposite speed tier
    if (currentPlanSpeed === 100) return plan.speedMbps === 200
    if (currentPlanSpeed === 200) return plan.speedMbps === 100
    // If current plan not found in our list, show all other plans
    return true
  })

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  useEffect(() => {
    if (step === 'verifying' && verificationId) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      pollRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/plan-change-status/${verificationId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          const data = await response.json()
          
          if (data.verificationStatus === 'verified') {
            setVerificationStatus('verified')
            setStep('success')
            if (timerRef.current) clearInterval(timerRef.current)
            if (pollRef.current) clearInterval(pollRef.current)
          } else if (data.verificationStatus === 'failed' || data.verificationStatus === 'error') {
            setVerificationStatus('failed')
            if (timerRef.current) clearInterval(timerRef.current)
            if (pollRef.current) clearInterval(pollRef.current)
          }
        } catch (err) {
          console.error('Error polling verification status:', err)
        }
      }, 10000)

      return () => {
        if (timerRef.current) clearInterval(timerRef.current)
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }
  }, [step, verificationId, token])

  const handleSubmit = async () => {
    if (!selectedPlan) return
    
    setIsSubmitting(true)
    setError('')
    setStep('processing')
    
    try {
      const response = await fetch('/api/plan-change-request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscriptionId: subscription.id,
          currentPlanId: subscription.planId,
          currentPlanName: subscription.planName || subscription.planId,
          currentPrice: subscription.planAmount,
          requestedPlanId: selectedPlan.id,
          requestedPlanName: selectedPlan.name,
          requestedPrice: selectedPlan.price * 100,
          customerEmail,
          customerName,
          chargebeeCustomerId: subscription.chargebeeCustomerId,
          mdn: subscription.mdn || undefined,
          iccid: subscription.iccid || undefined
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit plan change request')
      }
      
      setStep('success')
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      setStep('confirm')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (pollRef.current) clearInterval(pollRef.current)
    setStep('select')
    setSelectedPlan(null)
    setError('')
    setVerificationId(null)
    setNextBillingDate(null)
    setTimeRemaining(300)
    setVerificationStatus('pending')
    onClose()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-6 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                {step === 'select' && 'Change Your Plan'}
                {step === 'confirm' && 'Confirm Plan Change'}
                {step === 'processing' && 'Processing...'}
                {step === 'verifying' && 'Verifying Plan Change'}
                {step === 'success' && 'Request Submitted'}
                {step === 'partial_success' && 'Plan Change Scheduled'}
              </h2>
              <p className="text-white/80 text-sm mt-1">
                {step === 'select' && 'Select a new plan for your subscription'}
                {step === 'confirm' && 'Review your plan change request'}
                {step === 'processing' && 'Updating your subscription...'}
                {step === 'verifying' && 'Confirming your new network speed'}
                {step === 'success' && 'Our team will process your request'}
                {step === 'partial_success' && 'Billing updated, network change in progress'}
              </p>
            </div>
            {step !== 'processing' && step !== 'verifying' && (
              <button
                onClick={handleClose}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            {step === 'select' && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredPlans.length === 0 ? (
                    <div className="col-span-2 text-center py-8 text-muted">
                      You are already on the only available plan.
                    </div>
                  ) : (
                    filteredPlans.map((plan) => (
                      <motion.label
                        key={plan.id}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className={`block rounded-2xl cursor-pointer transition-all overflow-hidden ${
                          selectedPlan?.id === plan.id
                            ? 'ring-2 ring-[#10a37f] shadow-lg'
                            : 'border border-gray-200 hover:shadow-md'
                        }`}
                      >
                        <div 
                          className="p-4 text-white"
                          style={{ 
                            background: 'linear-gradient(135deg, #1a3a32 0%, #2d5a4a 100%)'
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                            </svg>
                            <span className="text-lg font-bold">nomad</span>
                          </div>
                          <p className="text-sm text-white/80 uppercase tracking-wide">
                            unlimited {plan.category}
                          </p>
                          <p className="text-xs text-white/60 mt-1">
                            {plan.speedMbps} Mbps Network Speed
                          </p>
                        </div>
                        
                        <div className="p-4 bg-white">
                          <div className="flex items-center gap-2 mb-3 text-muted">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <span className="text-sm">{plan.description}</span>
                          </div>
                          
                          <ul className="space-y-2 mb-4">
                            {plan.features.map((feature, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm">
                                <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#10a37f' }}></span>
                                <span className="text-gray-700">{feature}</span>
                              </li>
                            ))}
                          </ul>
                          
                          <div className="flex items-baseline gap-1 mb-4">
                            <span className="text-3xl font-bold text-text">${plan.price.toFixed(2)}</span>
                            <span className="text-muted">/month</span>
                          </div>
                          
                          <div className={`w-full py-3 rounded-lg text-center font-medium transition-all ${
                            selectedPlan?.id === plan.id
                              ? 'text-white'
                              : 'border border-gray-300 text-gray-700 hover:border-gray-400'
                          }`}
                          style={selectedPlan?.id === plan.id ? { backgroundColor: '#10a37f' } : {}}
                          >
                            {selectedPlan?.id === plan.id ? 'Selected' : `Select ${plan.category.charAt(0).toUpperCase() + plan.category.slice(1)} Plan`}
                          </div>
                          
                          <input
                            type="radio"
                            name="plan"
                            value={plan.id}
                            checked={selectedPlan?.id === plan.id}
                            onChange={() => setSelectedPlan(plan)}
                            className="sr-only"
                          />
                        </div>
                      </motion.label>
                    ))
                  )}
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}
              </motion.div>
            )}

            {step === 'confirm' && selectedPlan && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                  <h3 className="font-semibold text-text mb-4">Plan Change Summary</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                      <div>
                        <p className="text-xs text-muted uppercase tracking-wide">Current Plan</p>
                        <p className="font-medium text-text">{subscription.planName || subscription.planId}</p>
                        <p className="text-sm" style={{ color: '#10a37f' }}>${subscription.planAmount.toFixed(2)}/mo</p>
                      </div>
                      <div className="text-gray-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted uppercase tracking-wide">New Plan</p>
                        <p className="font-medium text-text">{selectedPlan.name}</p>
                        <p className="text-sm" style={{ color: '#10a37f' }}>${selectedPlan.price.toFixed(2)}/mo</p>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-sm text-blue-800 font-medium">What happens next</p>
                          <ul className="text-sm text-blue-700 mt-1 space-y-1">
                            <li>• Our team will review and process your request</li>
                            <li>• You will receive confirmation within 24 hours</li>
                            <li>• Changes will take effect on your next billing cycle</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}
              </motion.div>
            )}

            {step === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10a37f20' }}>
                  <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#10a37f', borderTopColor: 'transparent' }} />
                </div>
                <h3 className="text-lg font-semibold text-text mb-2">Updating Your Plan</h3>
                <p className="text-muted">Please wait while we process your request...</p>
              </motion.div>
            )}

            {step === 'verifying' && (
              <motion.div
                key="verifying"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8"
              >
                <div className="w-32 h-32 mx-auto mb-6 relative">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="8"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke="#10a37f"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(timeRemaining / 300) * 352} 352`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-text">{formatTime(timeRemaining)}</span>
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-text mb-2">Verifying Plan Change</h3>
                <p className="text-muted mb-4">
                  We're confirming your new {selectedPlan?.speedMbps} Mbps network speed is active.
                </p>
                
                <div className="flex items-center justify-center gap-2 text-sm text-muted">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span>Network update in progress</span>
                </div>

                {verificationStatus === 'failed' && (
                  <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left">
                    <p className="text-sm text-amber-800">
                      The verification is taking longer than expected. Your billing has been updated and our team has been notified to complete the network change manually.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', duration: 0.5 }}
                  className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#10a37f20' }}
                >
                  <svg className="w-10 h-10" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <h3 className="text-xl font-bold text-text mb-2">Request Submitted!</h3>
                <p className="text-muted mb-6 max-w-md mx-auto">
                  Your plan change request has been submitted successfully. Our team will process your request within 24 hours.
                </p>
                {selectedPlan && (
                  <div className="inline-block bg-gray-50 rounded-lg px-6 py-3">
                    <p className="text-sm text-muted">Requested Plan</p>
                    <p className="font-semibold text-text">{selectedPlan.name}</p>
                    <p className="text-sm" style={{ color: '#10a37f' }}>${selectedPlan.price.toFixed(2)}/mo • {selectedPlan.speedMbps} Mbps</p>
                  </div>
                )}
              </motion.div>
            )}

            {step === 'partial_success' && (
              <motion.div
                key="partial_success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', duration: 0.5 }}
                  className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#f59e0b20' }}
                >
                  <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </motion.div>
                <h3 className="text-xl font-bold text-text mb-2">Plan Change Scheduled</h3>
                <p className="text-muted mb-6 max-w-md mx-auto">
                  Your billing has been updated successfully.
                  {nextBillingDate && (
                    <> Your new rate of ${selectedPlan?.price.toFixed(2)}/mo will take effect on {formatDate(nextBillingDate)}.</>
                  )}
                </p>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-left max-w-md mx-auto">
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> Our team has been notified to complete the network speed change manually. You should see the updated speed within 24 hours.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <div className="flex gap-3">
            {step === 'select' && (
              <>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  disabled={!selectedPlan}
                  className="flex-1 px-4 py-3 text-sm font-medium text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
                  style={{ backgroundColor: '#10a37f' }}
                >
                  Continue
                </button>
              </>
            )}

            {step === 'confirm' && (
              <>
                <button
                  onClick={() => setStep('select')}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 text-sm font-medium text-white rounded-xl transition-all hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#10a37f' }}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Confirm Plan Change'
                  )}
                </button>
              </>
            )}

            {(step === 'success' || step === 'partial_success') && (
              <button
                onClick={handleClose}
                className="w-full px-4 py-3 text-sm font-medium text-white rounded-xl transition-all hover:shadow-lg"
                style={{ backgroundColor: '#10a37f' }}
              >
                Done
              </button>
            )}

            {step === 'verifying' && timeRemaining === 0 && (
              <button
                onClick={handleClose}
                className="w-full px-4 py-3 text-sm font-medium text-white rounded-xl transition-all hover:shadow-lg"
                style={{ backgroundColor: '#10a37f' }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
