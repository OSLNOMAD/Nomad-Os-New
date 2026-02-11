import { useState, useEffect } from 'react'
import { getPlanDisplayName } from '../utils/planNames'
import { getPlanDescription } from '../../shared/planChangeConfig'

interface PlanChangeOption {
  planId: string
  price: number
  type: 'upgrade' | 'downgrade'
}

interface Subscription {
  id: string
  planId: string
  planName?: string
  status: string
  planAmount: number
  billingPeriodUnit: string
  currentTermEnd: string
  nextBillingAt: string
  chargebeeCustomerId?: string
}

interface PlanChangeModalProps {
  isOpen: boolean
  onClose: () => void
  subscription: Subscription
  token: string
  onPlanChangeComplete: () => void
}

export function PlanChangeModal({ isOpen, onClose, subscription, token, onPlanChangeComplete }: PlanChangeModalProps) {
  const [step, setStep] = useState<'options' | 'confirm' | 'processing' | 'success' | 'error'>('options')
  const [availableOptions, setAvailableOptions] = useState<PlanChangeOption[]>([])
  const [selectedPlan, setSelectedPlan] = useState<PlanChangeOption | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchPlanOptions()
      setStep('options')
      setSelectedPlan(null)
      setError('')
      setHoveredPlan(null)
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [isOpen, subscription.planId])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const fetchPlanOptions = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/plan-change/options?planId=${encodeURIComponent(subscription.planId)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.options) {
        const sorted = [...data.options].sort((a: PlanChangeOption, b: PlanChangeOption) => {
          if (a.type === 'upgrade' && b.type === 'downgrade') return -1
          if (a.type === 'downgrade' && b.type === 'upgrade') return 1
          return b.price - a.price
        })
        setAvailableOptions(sorted)
      } else {
        setAvailableOptions([])
      }
    } catch (err) {
      setError('Failed to load plan options')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!selectedPlan) return
    setStep('processing')
    setError('')

    try {
      const res = await fetch('/api/plan-change/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscriptionId: subscription.id,
          newPlanId: selectedPlan.planId,
          chargebeeCustomerId: subscription.chargebeeCustomerId
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setStep('success')
      } else {
        setError(data.error || 'Failed to change plan')
        setStep('error')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      setStep('error')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const priceDifference = selectedPlan ? selectedPlan.price - subscription.planAmount : 0
  const currentPlanDesc = getPlanDescription(subscription.planId)
  const hasUpgrades = availableOptions.some(o => o.type === 'upgrade')
  const hasDowngrades = availableOptions.some(o => o.type === 'downgrade')

  if (!isOpen) return null

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
          style={{ background: 'linear-gradient(135deg, #0d9668 0%, #10a37f 50%, #34d399 100%)' }}
        >
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Change Your Plan</h2>
              <p className="text-emerald-100 text-sm mt-0.5">{getPlanDisplayName(subscription.planId)}</p>
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

          {step === 'options' && (
            <>
              <div
                className="relative rounded-2xl p-[1px] overflow-hidden mb-5"
                style={{ background: 'linear-gradient(135deg, #10a37f, #34d399, #10a37f)' }}
              >
                <div className="rounded-2xl bg-white p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#10a37f' }} />
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Your Current Plan</p>
                  </div>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-bold text-gray-900">{getPlanDisplayName(subscription.planId)}</p>
                      {currentPlanDesc && (
                        <div className="mt-2 space-y-1.5">
                          {currentPlanDesc.bullets.map((bullet, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-xs text-gray-500">{bullet}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-2xl font-bold tabular-nums" style={{ color: '#10a37f' }}>{formatCurrency(subscription.planAmount)}</p>
                      <p className="text-[10px] text-gray-400 -mt-0.5">per {subscription.billingPeriodUnit}</p>
                    </div>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center py-14">
                  <div className="relative w-12 h-12 mb-5">
                    <div className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: 'rgba(16,163,127,0.2)' }} />
                    <div className="absolute inset-0 rounded-full border-[3px] animate-spin" style={{ borderColor: '#e5e7eb', borderTopColor: '#10a37f' }} />
                  </div>
                  <p className="text-gray-400 text-sm font-medium">Loading available plans...</p>
                </div>
              ) : availableOptions.length === 0 ? (
                <div className="text-center py-14">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 12H4" />
                    </svg>
                  </div>
                  <p className="text-gray-700 font-semibold">No plan changes available</p>
                  <p className="text-sm text-gray-400 mt-1">Your current plan has no eligible change options.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {hasUpgrades && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#10a37f' }} />
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Recommended Upgrades</p>
                      </div>
                      <div className="space-y-3">
                        {availableOptions.filter(o => o.type === 'upgrade').map((option) => {
                          const desc = getPlanDescription(option.planId)
                          const isSelected = selectedPlan?.planId === option.planId
                          const isHovered = hoveredPlan === option.planId
                          return (
                            <button
                              key={option.planId}
                              onClick={() => setSelectedPlan(option)}
                              onMouseEnter={() => setHoveredPlan(option.planId)}
                              onMouseLeave={() => setHoveredPlan(null)}
                              className="w-full text-left"
                            >
                              <div
                                className={`group relative rounded-2xl p-[1px] overflow-hidden transition-all duration-300 ${
                                  isSelected ? 'shadow-lg shadow-emerald-100' : isHovered ? 'shadow-md' : ''
                                }`}
                                style={
                                  isSelected
                                    ? { background: 'linear-gradient(135deg, #10a37f, #34d399, #10a37f)' }
                                    : { background: isHovered ? 'linear-gradient(135deg, rgba(16,163,127,0.4), rgba(52,211,153,0.4))' : '#e5e7eb' }
                                }
                              >
                                <div className="rounded-2xl bg-white p-4">
                                  <div className="flex items-start gap-3.5">
                                    <div
                                      className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                                        isSelected ? '' : 'bg-gray-50 group-hover:bg-emerald-50'
                                      }`}
                                      style={isSelected ? { background: 'linear-gradient(135deg, rgba(16,163,127,0.1), rgba(52,211,153,0.15))' } : {}}
                                    >
                                      <svg className={`w-5 h-5 transition-colors duration-300 ${isSelected ? 'text-emerald-600' : 'text-gray-400 group-hover:text-emerald-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                      </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <p className="font-semibold text-gray-900 text-[15px]">{getPlanDisplayName(option.planId)}</p>
                                            <span
                                              className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full"
                                              style={{ backgroundColor: 'rgba(16,163,127,0.1)', color: '#0d8c6d' }}
                                            >Upgrade</span>
                                          </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                          <p className="text-lg font-bold tabular-nums" style={{ color: '#10a37f' }}>{formatCurrency(option.price)}</p>
                                          <p className="text-[10px] text-gray-400 -mt-0.5">per {subscription.billingPeriodUnit}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                          +{formatCurrency(option.price - subscription.planAmount)}/mo
                                        </span>
                                      </div>
                                      {desc && (
                                        <div className="mt-3 space-y-1.5">
                                          {desc.bullets.map((bullet, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                              <svg className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                              </svg>
                                              <span className="text-xs text-gray-500">{bullet}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {currentPlanDesc?.upgradeNudge && (
                                        <div
                                          className="mt-3 flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl"
                                          style={{ background: 'linear-gradient(135deg, rgba(16,163,127,0.06), rgba(52,211,153,0.08))' }}
                                        >
                                          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                          </svg>
                                          <p className="text-[11px] text-emerald-700 leading-relaxed font-medium">{currentPlanDesc.upgradeNudge}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {hasDowngrades && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Other Options</p>
                      </div>
                      <div className="space-y-3">
                        {availableOptions.filter(o => o.type === 'downgrade').map((option) => {
                          const desc = getPlanDescription(option.planId)
                          const isSelected = selectedPlan?.planId === option.planId
                          const isHovered = hoveredPlan === option.planId
                          return (
                            <button
                              key={option.planId}
                              onClick={() => setSelectedPlan(option)}
                              onMouseEnter={() => setHoveredPlan(option.planId)}
                              onMouseLeave={() => setHoveredPlan(null)}
                              className="w-full text-left"
                            >
                              <div
                                className={`group rounded-2xl border transition-all duration-300 overflow-hidden ${
                                  isSelected
                                    ? 'border-amber-300 shadow-md'
                                    : isHovered
                                      ? 'border-gray-200 shadow-sm'
                                      : 'border-gray-100'
                                }`}
                                style={{ boxShadow: !isSelected && !isHovered ? '0 1px 3px rgba(0,0,0,0.04)' : undefined, opacity: isSelected || isHovered ? 1 : 0.85 }}
                              >
                                <div className="p-4">
                                  <div className="flex items-start gap-3.5">
                                    <div
                                      className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                                        isSelected ? 'bg-amber-50' : 'bg-gray-50'
                                      }`}
                                    >
                                      <svg className={`w-5 h-5 transition-colors duration-300 ${isSelected ? 'text-amber-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                      </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <p className="font-semibold text-gray-700 text-[15px]">{getPlanDisplayName(option.planId)}</p>
                                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-full bg-gray-100 text-gray-500">
                                              Downgrade
                                            </span>
                                          </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                          <p className="text-lg font-bold text-gray-700 tabular-nums">{formatCurrency(option.price)}</p>
                                          <p className="text-[10px] text-gray-400 -mt-0.5">per {subscription.billingPeriodUnit}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                          {formatCurrency(subscription.planAmount - option.price)}/mo less
                                        </span>
                                      </div>
                                      {desc && (
                                        <div className="mt-3 space-y-1.5">
                                          {desc.bullets.map((bullet, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                              <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                              </svg>
                                              <span className="text-xs text-gray-500">{bullet}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {currentPlanDesc?.downgradeWarning && (
                                        <div className="mt-3 flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-50/70">
                                          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                          </svg>
                                          <p className="text-[11px] text-amber-700 leading-relaxed font-medium">{currentPlanDesc.downgradeWarning}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => selectedPlan && setStep('confirm')}
                    disabled={!selectedPlan}
                    className="w-full mt-2 px-6 py-3.5 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-100 active:scale-[0.98]"
                    style={{
                      background: selectedPlan
                        ? selectedPlan.type === 'upgrade'
                          ? 'linear-gradient(135deg, #10a37f, #0d8c6d)'
                          : '#6b7280'
                        : '#d1d5db'
                    }}
                  >
                    {selectedPlan
                      ? selectedPlan.type === 'upgrade'
                        ? 'Continue with Upgrade'
                        : 'Continue with Downgrade'
                      : 'Select a Plan to Continue'
                    }
                  </button>
                </div>
              )}
            </>
          )}

          {step === 'confirm' && selectedPlan && (
            <div>
              <div className="flex flex-col items-center mb-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{
                    background: selectedPlan.type === 'upgrade'
                      ? 'linear-gradient(135deg, rgba(16,163,127,0.1), rgba(52,211,153,0.15))'
                      : 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.15))'
                  }}
                >
                  {selectedPlan.type === 'upgrade' ? (
                    <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                </div>
                <h4 className="text-lg font-bold text-gray-900">
                  {selectedPlan.type === 'upgrade' ? 'Confirm Your Upgrade' : 'Confirm Plan Change'}
                </h4>
                <p className="text-sm text-gray-400 mt-1 text-center">
                  {selectedPlan.type === 'upgrade'
                    ? 'Great choice! Review the details below.'
                    : 'Please review the details below before confirming.'
                  }
                </p>
              </div>

              <div
                className="rounded-2xl p-4 mb-4"
                style={{
                  background: selectedPlan.type === 'upgrade'
                    ? 'linear-gradient(135deg, rgba(16,163,127,0.04), rgba(52,211,153,0.06))'
                    : 'linear-gradient(135deg, rgba(245,158,11,0.04), rgba(251,191,36,0.06))',
                  border: selectedPlan.type === 'upgrade'
                    ? '1px solid rgba(16,163,127,0.12)'
                    : '1px solid rgba(245,158,11,0.15)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Current Plan</p>
                    <p className="font-semibold text-gray-900 mt-1 text-[15px]">{getPlanDisplayName(subscription.planId)}</p>
                    <p className="text-sm font-bold text-gray-600 mt-0.5">{formatCurrency(subscription.planAmount)}/mo</p>
                  </div>
                  <div className="mx-4 flex-shrink-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center"
                      style={{
                        background: selectedPlan.type === 'upgrade'
                          ? 'linear-gradient(135deg, rgba(16,163,127,0.15), rgba(52,211,153,0.2))'
                          : 'rgba(245,158,11,0.1)'
                      }}
                    >
                      <svg className={`w-4 h-4 ${selectedPlan.type === 'upgrade' ? 'text-emerald-600' : 'text-amber-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-right flex-1">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">New Plan</p>
                    <p className="font-semibold text-gray-900 mt-1 text-[15px]">{getPlanDisplayName(selectedPlan.planId)}</p>
                    <p className="text-sm font-bold mt-0.5" style={{ color: selectedPlan.type === 'upgrade' ? '#10a37f' : '#d97706' }}>
                      {formatCurrency(selectedPlan.price)}/mo
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={`rounded-2xl px-4 py-3.5 mb-4 ${priceDifference > 0 ? '' : ''}`}
                style={{
                  background: priceDifference > 0
                    ? 'linear-gradient(135deg, rgba(16,163,127,0.06), rgba(52,211,153,0.08))'
                    : 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(251,191,36,0.08))',
                  border: priceDifference > 0
                    ? '1px solid rgba(16,163,127,0.12)'
                    : '1px solid rgba(245,158,11,0.15)'
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: priceDifference > 0
                        ? 'linear-gradient(135deg, rgba(16,163,127,0.15), rgba(52,211,153,0.2))'
                        : 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,191,36,0.2))'
                    }}
                  >
                    <svg className={`w-4 h-4 ${priceDifference > 0 ? 'text-emerald-600' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${priceDifference > 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {priceDifference > 0 ? 'Monthly Increase' : 'Monthly Savings'}
                    </p>
                    <p className={`text-lg font-bold ${priceDifference > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {priceDifference > 0 ? '+' : '-'}{formatCurrency(Math.abs(priceDifference))}/mo
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl px-4 py-3.5 mb-4 bg-blue-50/70 border border-blue-100">
                <div className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-blue-700">When does this take effect?</p>
                    <p className="text-xs text-blue-600 leading-relaxed mt-0.5">
                      Your plan change will take effect at the <strong>end of your current billing period</strong> on{' '}
                      <strong>{new Date(subscription.currentTermEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.
                      You will continue to have access to your current plan until then.
                    </p>
                  </div>
                </div>
              </div>

              {selectedPlan.type === 'downgrade' && (
                <div className="rounded-2xl px-4 py-3.5 mb-4 bg-amber-50/70 border border-amber-100">
                  <div className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-amber-700">Before you downgrade</p>
                      <p className="text-xs text-amber-600 leading-relaxed mt-0.5">
                        {getPlanDescription(subscription.planId)?.downgradeWarning || 'Downgrading may reduce your service capabilities. You can always upgrade again later.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('options')}
                  className="flex-1 px-4 py-3 text-gray-600 font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 text-sm"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-[1.5] px-4 py-3 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-emerald-100 active:scale-[0.98] text-sm"
                  style={{
                    background: selectedPlan.type === 'upgrade'
                      ? 'linear-gradient(135deg, #10a37f, #0d8c6d)'
                      : '#6b7280'
                  }}
                >
                  {selectedPlan.type === 'upgrade' ? 'Confirm Upgrade' : 'Confirm Downgrade'}
                </button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center py-16">
              <div className="relative w-14 h-14 mb-6">
                <div className="absolute inset-0 rounded-full" style={{ border: '3px solid #f3f4f6' }} />
                <div className="absolute inset-0 rounded-full animate-spin" style={{ border: '3px solid transparent', borderTopColor: '#10a37f' }} />
                <div className="absolute inset-2 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
              </div>
              <p className="text-gray-800 font-semibold mb-1">Processing Your Change...</p>
              <p className="text-gray-400 text-sm">This may take a moment.</p>
            </div>
          )}

          {step === 'success' && selectedPlan && (
            <div className="flex flex-col items-center py-12">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
                style={{ background: 'linear-gradient(135deg, rgba(16,163,127,0.1), rgba(52,211,153,0.15))' }}
              >
                <svg className="w-8 h-8" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-900 font-bold text-lg mb-2">
                {selectedPlan.type === 'upgrade' ? 'Upgrade Scheduled!' : 'Plan Change Scheduled'}
              </p>
              <p className="text-gray-400 text-sm text-center max-w-xs mb-2">
                Your plan will change to <strong className="text-gray-600">{getPlanDisplayName(selectedPlan.planId)}</strong> at{' '}
                <strong className="text-gray-600">{formatCurrency(selectedPlan.price)}/mo</strong> at the end of your current billing period.
              </p>
              <p className="text-xs text-gray-300 mb-8">You can cancel this change anytime before it takes effect.</p>
              <button
                onClick={() => {
                  onPlanChangeComplete()
                  handleClose()
                }}
                className="px-8 py-3 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-emerald-100 active:scale-[0.98] text-sm"
                style={{ background: 'linear-gradient(135deg, #10a37f, #0d8c6d)' }}
              >
                Done
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center py-12">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-5">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-gray-900 font-bold text-lg mb-2">Something Went Wrong</p>
              <p className="text-gray-400 text-sm text-center max-w-xs mb-8">{error}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('options')}
                  className="px-6 py-2.5 text-gray-600 font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 text-sm"
                >
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-lg text-sm"
                  style={{ background: 'linear-gradient(135deg, #10a37f, #0d8c6d)' }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
