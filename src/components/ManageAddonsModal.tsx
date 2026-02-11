import { useState, useEffect } from 'react'
import { getPlanDisplayName } from '../utils/planNames'
import type { AddonDefinition } from '../../shared/addonConfig'

interface Subscription {
  id: string
  planId: string
  status: string
  planAmount: number
  billingPeriodUnit: string
  subscriptionItems?: Array<{
    itemPriceId: string
    itemType: string
    quantity: number
    amount: number
    unitPrice: number
  }>
}

interface ManageAddonsModalProps {
  isOpen: boolean
  onClose: () => void
  subscription: Subscription
  token: string
  onAddonChangeComplete: () => void
}

type ModalStep =
  | 'browse'
  | 'confirm_add'
  | 'confirm_remove'
  | 'processing'
  | 'success'
  | 'error'

interface CurrentAddon {
  itemPriceId: string
  amount: number
  quantity: number
}

const AddonIcon = ({ type, className }: { type: string; className?: string }) => {
  switch (type) {
    case 'travel':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'shield':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    case 'speed':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      )
  }
}

export function ManageAddonsModal({ isOpen, onClose, subscription, token, onAddonChangeComplete }: ManageAddonsModalProps) {
  const [step, setStep] = useState<ModalStep>('browse')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [availableAddons, setAvailableAddons] = useState<AddonDefinition[]>([])
  const [activeAddons, setActiveAddons] = useState<AddonDefinition[]>([])
  const [currentAddons, setCurrentAddons] = useState<CurrentAddon[]>([])
  const [selectedAddon, setSelectedAddon] = useState<AddonDefinition | null>(null)
  const [actionType, setActionType] = useState<'add' | 'remove'>('add')
  const [successMessage, setSuccessMessage] = useState('')
  const [hoveredAddon, setHoveredAddon] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchAvailableAddons()
      setStep('browse')
      setSelectedAddon(null)
      setError('')
      setSuccessMessage('')
    }
  }, [isOpen, subscription.id])

  const fetchAvailableAddons = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/subscription/addons/available?subscriptionId=${encodeURIComponent(subscription.id)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setAvailableAddons(data.available || [])
        setActiveAddons(data.alreadyActive || [])
        setCurrentAddons(data.currentAddons || [])
      } else {
        setError(data.error || 'Failed to load add-ons')
      }
    } catch (err) {
      setError('Failed to load add-on options')
    } finally {
      setLoading(false)
    }
  }

  const handleAddAddon = (addon: AddonDefinition) => {
    setSelectedAddon(addon)
    setActionType('add')
    setStep('confirm_add')
    setError('')
  }

  const handleRemoveAddon = (addon: AddonDefinition) => {
    setSelectedAddon(addon)
    setActionType('remove')
    setStep('confirm_remove')
    setError('')
  }

  const executeAction = async () => {
    if (!selectedAddon) return
    setStep('processing')
    setError('')

    try {
      const endpoint = actionType === 'add'
        ? '/api/subscription/addons/add'
        : '/api/subscription/addons/remove'

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscriptionId: subscription.id,
          addonFamily: selectedAddon.family
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSuccessMessage(
          actionType === 'add'
            ? `${selectedAddon.displayName} has been added to your subscription!`
            : `${selectedAddon.displayName} has been removed from your subscription.`
        )
        setStep('success')
      } else {
        setError(data.error || `Failed to ${actionType} add-on`)
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

  const getActiveAddonPrice = (addon: AddonDefinition): number => {
    const match = currentAddons.find(ca => {
      const lower = ca.itemPriceId.toLowerCase()
      if (addon.family === 'travel') {
        return lower.includes('travel-upgrade') || lower.includes('travel-modem') || lower.includes('nomad-travel') || lower.includes('travel-pause')
      }
      if (addon.family === 'prime') {
        return lower.includes('nomad-prime') || lower.includes('prime-upgrade') || lower.includes('prime-founders')
      }
      return ca.itemPriceId === addon.itemPriceId
    })
    return match ? match.amount : addon.price
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10a37f, #0d8c6d)' }}>
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Manage Add-ons</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-6 ml-[52px]">Enhance your {getPlanDisplayName(subscription.planId)} with powerful add-ons.</p>

          {step === 'browse' && (
            <>
              {loading ? (
                <div className="flex flex-col items-center py-10">
                  <div className="w-10 h-10 border-4 rounded-full animate-spin mb-4" style={{ borderColor: '#e5e7eb', borderTopColor: '#10a37f' }}></div>
                  <p className="text-gray-500 text-sm">Loading available add-ons...</p>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="text-red-600 font-medium">{error}</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {activeAddons.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#10a37f' }}>Your Active Add-ons</p>
                      </div>
                      {activeAddons.map((addon) => {
                        const price = getActiveAddonPrice(addon)
                        return (
                          <div
                            key={addon.id}
                            className="rounded-xl border-2 p-4 mb-3"
                            style={{ borderColor: 'rgba(16,163,127,0.3)', backgroundColor: 'rgba(16,163,127,0.03)' }}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(16,163,127,0.1)' }}>
                                  <AddonIcon type={addon.icon} className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900">{addon.displayName}</p>
                                  <p className="text-sm text-gray-500">{addon.headline}</p>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 ml-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-2 py-0.5 text-xs font-bold rounded-full" style={{ backgroundColor: 'rgba(16,163,127,0.1)', color: '#10a37f' }}>ACTIVE</span>
                                </div>
                                <p className="text-sm font-bold mt-1" style={{ color: '#10a37f' }}>{formatCurrency(price)}/mo</p>
                              </div>
                            </div>
                            <ul className="space-y-1.5 mb-3">
                              {addon.bullets.map((bullet, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  {bullet}
                                </li>
                              ))}
                            </ul>
                            <button
                              onClick={() => handleRemoveAddon(addon)}
                              className="text-xs font-medium text-gray-400 hover:text-red-500 transition-colors underline"
                            >
                              Remove add-on
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {availableAddons.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <p className="text-sm font-bold text-emerald-700 uppercase tracking-wide">Available Add-ons</p>
                      </div>
                      {availableAddons.map((addon) => {
                        const isHovered = hoveredAddon === addon.id
                        return (
                          <div
                            key={addon.id}
                            className={`rounded-xl border-2 transition-all duration-200 mb-3 cursor-pointer ${
                              isHovered ? 'border-emerald-400 shadow-lg shadow-emerald-50' : 'border-gray-200 hover:border-emerald-300'
                            }`}
                            onMouseEnter={() => setHoveredAddon(addon.id)}
                            onMouseLeave={() => setHoveredAddon(null)}
                          >
                            <div className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isHovered ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                                    <AddonIcon type={addon.icon} className={`w-5 h-5 transition-colors ${isHovered ? 'text-emerald-600' : 'text-gray-500'}`} />
                                  </div>
                                  <div>
                                    <p className="font-bold text-gray-900">{addon.displayName}</p>
                                    <p className="text-sm text-gray-500">{addon.headline}</p>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0 ml-3">
                                  <p className="text-lg font-bold" style={{ color: '#10a37f' }}>{formatCurrency(addon.price)}</p>
                                  <p className="text-xs text-gray-400">per {addon.billingPeriod}</p>
                                </div>
                              </div>
                              <ul className="space-y-1.5 mb-3">
                                {addon.bullets.map((bullet, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    {bullet}
                                  </li>
                                ))}
                              </ul>
                              {addon.upsellMessage && (
                                <div className="flex items-start gap-2 p-2.5 bg-emerald-50 rounded-lg mb-3">
                                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                  </svg>
                                  <p className="text-xs text-emerald-700 font-medium">{addon.upsellMessage}</p>
                                </div>
                              )}
                              <button
                                onClick={() => handleAddAddon(addon)}
                                className="w-full py-2.5 text-white font-semibold rounded-xl transition-all duration-200 hover:shadow-lg text-sm"
                                style={{ background: 'linear-gradient(135deg, #10a37f, #0d8c6d)' }}
                              >
                                Add to My Subscription
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {availableAddons.length === 0 && activeAddons.length === 0 && (
                    <div className="text-center py-10">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </div>
                      <p className="text-gray-500 font-medium">No add-ons available</p>
                      <p className="text-sm text-gray-400 mt-1">There are no add-ons available for this subscription right now.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {step === 'confirm_add' && selectedAddon && (
            <div>
              <div className="flex items-center justify-center mb-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-100">
                  <AddonIcon type={selectedAddon.icon} className="w-7 h-7 text-emerald-600" />
                </div>
              </div>
              <h4 className="text-lg font-bold text-gray-900 text-center mb-1">Add {selectedAddon.displayName}?</h4>
              <p className="text-sm text-gray-500 text-center mb-6">This will be added to your subscription and billed immediately (prorated).</p>

              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-gray-900">{selectedAddon.displayName}</p>
                  <p className="text-lg font-bold" style={{ color: '#10a37f' }}>{formatCurrency(selectedAddon.price)}/mo</p>
                </div>
                <ul className="space-y-1.5">
                  {selectedAddon.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-emerald-800">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Billing Info</p>
                    <p className="text-sm text-blue-700 mt-1">
                      You will be charged a prorated amount for the remaining days in your current billing cycle.
                      Starting next cycle, <strong>{formatCurrency(selectedAddon.price)}</strong> will be added to your monthly bill.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('browse')}
                  className="flex-1 px-4 py-3 text-gray-700 font-medium border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={executeAction}
                  className="flex-1 px-4 py-3 text-white font-semibold rounded-xl transition-all duration-200 hover:shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #10a37f, #0d8c6d)' }}
                >
                  Add Now
                </button>
              </div>
            </div>
          )}

          {step === 'confirm_remove' && selectedAddon && (
            <div>
              <div className="flex items-center justify-center mb-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-amber-100">
                  <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <h4 className="text-lg font-bold text-gray-900 text-center mb-1">Remove {selectedAddon.displayName}?</h4>
              <p className="text-sm text-gray-500 text-center mb-6">{selectedAddon.retentionMessage}</p>

              <div className="p-4 rounded-xl border border-red-200 bg-red-50 mb-4">
                <p className="text-sm font-semibold text-red-800 mb-3">What you will lose:</p>
                <ul className="space-y-2">
                  {selectedAddon.retentionBullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 mb-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Keep your {selectedAddon.displayName}</p>
                    <p className="text-sm text-emerald-700 mt-1">
                      For just <strong>{formatCurrency(getActiveAddonPrice(selectedAddon))}/mo</strong>, you keep all the benefits listed above.
                      Most customers who remove this add-on end up re-purchasing it later at the current rate.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setStep('browse')}
                  className="w-full px-4 py-3 text-white font-semibold rounded-xl transition-all duration-200 hover:shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #10a37f, #0d8c6d)' }}
                >
                  Keep My Add-on
                </button>
                <button
                  onClick={executeAction}
                  className="w-full px-4 py-2.5 text-sm text-gray-500 font-medium border border-gray-300 rounded-xl hover:bg-gray-50 hover:text-red-500 hover:border-red-300 transition-all"
                >
                  I understand, remove it anyway
                </button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 rounded-full animate-spin mb-4" style={{ borderColor: '#e5e7eb', borderTopColor: '#10a37f' }}></div>
              <p className="text-lg font-semibold text-gray-900">
                {actionType === 'add' ? 'Adding Add-on...' : 'Removing Add-on...'}
              </p>
              <p className="text-sm text-gray-500 mt-1">Please wait while we update your subscription.</p>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, rgba(16,163,127,0.1), rgba(16,163,127,0.2))' }}>
                <svg className="w-8 h-8" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">
                {actionType === 'add' ? 'Add-on Activated!' : 'Add-on Removed'}
              </h4>
              <p className="text-sm text-gray-600 text-center mb-6 max-w-sm">{successMessage}</p>
              <button
                onClick={() => {
                  onClose()
                  onAddonChangeComplete()
                }}
                className="px-8 py-3 text-white font-semibold rounded-xl transition-all duration-200 hover:shadow-lg"
                style={{ background: 'linear-gradient(135deg, #10a37f, #0d8c6d)' }}
              >
                Done
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Something Went Wrong</h4>
              <p className="text-sm text-red-600 text-center mb-6 max-w-sm">{error}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep('browse')
                    setError('')
                    fetchAvailableAddons()
                  }}
                  className="px-5 py-2.5 text-gray-700 font-medium border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 text-white font-medium rounded-xl transition-colors"
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
