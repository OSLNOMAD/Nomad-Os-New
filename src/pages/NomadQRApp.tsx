import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createWorker } from 'tesseract.js'

interface DeviceRecord {
  id: number
  imei: string
  ssid: string
  password: string
  stickerPhotoUrl: string | null
  printCount: number
  lastPrintedAt: string | null
  createdBy: string
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

type AppView = 'home' | 'scan' | 'photo' | 'ocr_processing' | 'confirm' | 'saved' | 'search' | 'device_detail' | 'print_preview'

export default function NomadQRApp() {
  const navigate = useNavigate()
  const [view, setView] = useState<AppView>('home')
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [error, setError] = useState('')

  const [imei, setImei] = useState('')
  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [stickerPhoto, setStickerPhoto] = useState<string | null>(null)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [saving, setSaving] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [devices, setDevices] = useState<DeviceRecord[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<DeviceRecord | null>(null)
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const getToken = () => localStorage.getItem('admin_token')
  const authHeaders = () => ({ 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' })

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    const token = getToken()
    if (!token) {
      navigate('/admin')
      return
    }
    try {
      const res = await fetch('/api/ops/qr/check-access', { headers: authHeaders() })
      if (res.status === 401) {
        navigate('/admin')
        return
      }
      if (res.status === 403) {
        setHasAccess(false)
        setLoading(false)
        return
      }
      if (res.ok) {
        const data = await res.json()
        setHasAccess(true)
        setUserEmail(data.email)
      }
    } catch {
      setError('Failed to verify access')
    } finally {
      setLoading(false)
    }
  }

  const resetScanFlow = () => {
    setImei('')
    setSsid('')
    setPassword('')
    setStickerPhoto(null)
    setOcrProgress(0)
    setError('')
    setView('home')
  }

  const handleImeiSubmit = () => {
    const cleaned = imei.replace(/\D/g, '')
    if (cleaned.length < 14 || cleaned.length > 16) {
      setError('IMEI must be 14-16 digits')
      return
    }
    setImei(cleaned)
    setError('')
    setView('photo')
  }

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      setStickerPhoto(dataUrl)
      setView('ocr_processing')
      await performOCR(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const performOCR = async (imageData: string) => {
    try {
      setOcrProgress(0)
      const worker = await createWorker('eng', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100))
          }
        }
      })
      const { data: { text } } = await worker.recognize(imageData)
      await worker.terminate()

      const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0)

      let detectedSsid = ''
      let detectedPassword = ''

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lowerLine = line.toLowerCase()

        if (lowerLine.includes('ssid') || lowerLine.includes('network') || lowerLine.includes('wifi name') || lowerLine.includes('wi-fi name')) {
          const colonIdx = line.indexOf(':')
          if (colonIdx !== -1) {
            detectedSsid = line.substring(colonIdx + 1).trim()
          } else if (i + 1 < lines.length) {
            detectedSsid = lines[i + 1]
          }
        }

        if (lowerLine.includes('password') || lowerLine.includes('pass') || lowerLine.includes('key') || lowerLine.includes('pwd')) {
          const colonIdx = line.indexOf(':')
          if (colonIdx !== -1) {
            detectedPassword = line.substring(colonIdx + 1).trim()
          } else if (i + 1 < lines.length) {
            detectedPassword = lines[i + 1]
          }
        }
      }

      if (!detectedSsid && !detectedPassword) {
        const alphaLines = lines.filter((l: string) => /[a-zA-Z0-9]/.test(l) && l.length >= 3)
        if (alphaLines.length >= 2) {
          detectedSsid = alphaLines[0]
          detectedPassword = alphaLines[1]
        } else if (alphaLines.length === 1) {
          detectedSsid = alphaLines[0]
        }
      }

      setSsid(detectedSsid)
      setPassword(detectedPassword)
      setView('confirm')
    } catch (err) {
      console.error('OCR failed:', err)
      setError('OCR processing failed. Please enter credentials manually.')
      setView('confirm')
    }
  }

  const handleSave = async () => {
    if (!imei || !ssid || !password) {
      setError('IMEI, SSID, and Password are all required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/ops/qr/device', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ imei, ssid, password, stickerPhotoUrl: stickerPhoto })
      })
      if (res.ok) {
        setView('saved')
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save device')
      }
    } catch {
      setError('Failed to save device')
    } finally {
      setSaving(false)
    }
  }

  const handleSearch = useCallback(async (query?: string) => {
    setSearchLoading(true)
    try {
      const q = query !== undefined ? query : searchQuery
      const url = q.trim() ? `/api/ops/qr/devices?search=${encodeURIComponent(q.trim())}` : '/api/ops/qr/devices'
      const res = await fetch(url, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setDevices(data.devices || [])
      }
    } catch {
      setError('Failed to search devices')
    } finally {
      setSearchLoading(false)
    }
  }, [searchQuery])

  const handleDeviceSelect = (device: DeviceRecord) => {
    setSelectedDevice(device)
    setRevealedPassword(null)
    setView('device_detail')
  }

  const handleRevealPassword = async () => {
    if (!selectedDevice) return
    setRevealing(true)
    try {
      const res = await fetch(`/api/ops/qr/device/${selectedDevice.imei}/reveal`, {
        method: 'POST',
        headers: authHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        setRevealedPassword(data.password)
      }
    } catch {
      setError('Failed to reveal password')
    } finally {
      setRevealing(false)
    }
  }

  const handlePrint = async () => {
    if (!selectedDevice) return
    try {
      await fetch(`/api/ops/qr/device/${selectedDevice.imei}/print`, {
        method: 'POST',
        headers: authHeaders()
      })
    } catch {}
    window.open(`/ops/nomad-qr/print/${selectedDevice.imei}`, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2" style={{ borderColor: '#10a37f' }} />
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-600 mb-6">You don't have permission to use the Nomad QR App. Please contact your administrator to request access.</p>
          <button onClick={() => navigate('/admin/dashboard')} className="px-6 py-2 text-white rounded-lg font-medium" style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}>
            Back to Admin Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Nomad QR App</h1>
              <p className="text-xs text-gray-500">{userEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view !== 'home' && (
              <button onClick={resetScanFlow} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50">
                Home
              </button>
            )}
            <button onClick={() => navigate('/admin/dashboard')} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50">
              Admin
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 ml-2">&times;</button>
          </div>
        )}

        {view === 'home' && (
          <div className="grid gap-4 sm:grid-cols-2 max-w-lg mx-auto mt-8">
            <button
              onClick={() => setView('scan')}
              className="bg-white rounded-xl border border-gray-200 p-6 text-center hover:shadow-md transition-shadow group"
            >
              <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Scan Device</h3>
              <p className="text-sm text-gray-500">Enter IMEI &amp; capture sticker photo</p>
            </button>

            <button
              onClick={() => { setView('search'); handleSearch('') }}
              className="bg-white rounded-xl border border-gray-200 p-6 text-center hover:shadow-md transition-shadow group"
            >
              <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center bg-blue-500">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Search &amp; Print</h3>
              <p className="text-sm text-gray-500">Find devices &amp; print labels</p>
            </button>
          </div>
        )}

        {view === 'scan' && (
          <div className="max-w-md mx-auto mt-8">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Enter Device IMEI</h2>
              <p className="text-sm text-gray-500 mb-6">Type or scan the IMEI barcode from the device</p>
              <input
                type="text"
                value={imei}
                onChange={(e) => setImei(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Enter 15-digit IMEI"
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono tracking-wider"
                maxLength={16}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleImeiSubmit()}
              />
              <p className="text-xs text-gray-400 mt-2">{imei.length}/15 digits</p>
              <button
                onClick={handleImeiSubmit}
                disabled={imei.replace(/\D/g, '').length < 14}
                className="w-full mt-4 py-3 text-white font-medium rounded-lg disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
              >
                Next: Capture Sticker Photo
              </button>
              <button onClick={resetScanFlow} className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          </div>
        )}

        {view === 'photo' && (
          <div className="max-w-md mx-auto mt-8">
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Capture Sticker Photo</h2>
              <p className="text-sm text-gray-500 mb-2">IMEI: <span className="font-mono font-medium">{imei}</span></p>
              <p className="text-sm text-gray-500 mb-6">Take a photo of the WiFi credentials sticker on the device</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoCapture}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-emerald-400 transition-colors flex flex-col items-center gap-2"
              >
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-600">Tap to take photo or choose file</span>
              </button>
              <div className="mt-4 flex gap-2">
                <button onClick={() => setView('scan')} className="flex-1 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">Back</button>
                <button
                  onClick={() => { setView('confirm') }}
                  className="flex-1 py-2 text-sm text-gray-700 font-medium border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Skip — Enter Manually
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'ocr_processing' && (
          <div className="max-w-md mx-auto mt-8">
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mx-auto mb-4" style={{ borderColor: '#10a37f' }} />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Reading Sticker...</h2>
              <p className="text-sm text-gray-500 mb-4">Extracting WiFi credentials from the photo</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${ocrProgress}%`, background: '#10a37f' }} />
              </div>
              <p className="text-xs text-gray-400 mt-2">{ocrProgress}%</p>
            </div>
          </div>
        )}

        {view === 'confirm' && (
          <div className="max-w-md mx-auto mt-8">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Confirm Device Details</h2>
              <p className="text-sm text-gray-500 mb-4">Review and correct the extracted information</p>

              {stickerPhoto && (
                <div className="mb-4 rounded-lg overflow-hidden border border-gray-200">
                  <img src={stickerPhoto} alt="Sticker" className="w-full max-h-40 object-contain bg-gray-100" />
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IMEI</label>
                  <input
                    type="text"
                    value={imei}
                    disabled
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Network Name (SSID)</label>
                  <input
                    type="text"
                    value={ssid}
                    onChange={(e) => setSsid(e.target.value)}
                    placeholder="Enter WiFi network name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter WiFi password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !ssid.trim() || !password.trim()}
                className="w-full mt-6 py-3 text-white font-medium rounded-lg disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
              >
                {saving ? 'Saving...' : 'Save Device Record'}
              </button>
              <button onClick={() => setView('photo')} className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-gray-700">
                Retake Photo
              </button>
            </div>
          </div>
        )}

        {view === 'saved' && (
          <div className="max-w-md mx-auto mt-8">
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(16, 163, 127, 0.1)' }}>
                <svg className="w-8 h-8" style={{ color: '#10a37f' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Device Saved!</h2>
              <p className="text-sm text-gray-500 mb-1">IMEI: <span className="font-mono">{imei}</span></p>
              <p className="text-sm text-gray-500 mb-6">SSID: <span className="font-medium">{ssid}</span></p>
              <div className="flex gap-3">
                <button
                  onClick={resetScanFlow}
                  className="flex-1 py-2.5 text-white font-medium rounded-lg"
                  style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
                >
                  Scan Another
                </button>
                <button
                  onClick={() => {
                    setSelectedDevice({ id: 0, imei, ssid, password, stickerPhotoUrl: stickerPhoto, printCount: 0, lastPrintedAt: null, createdBy: userEmail, updatedBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
                    setView('device_detail')
                  }}
                  className="flex-1 py-2.5 font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  View / Print
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'search' && (
          <div className="mt-4">
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by IMEI or SSID..."
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                autoFocus
              />
              <button
                onClick={() => handleSearch()}
                className="px-5 py-2.5 text-white font-medium rounded-lg"
                style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
              >
                Search
              </button>
            </div>

            {searchLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: '#10a37f' }} />
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IMEI</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SSID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Prints</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {devices.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">{searchQuery ? 'No devices found' : 'No devices recorded yet'}</td></tr>
                    ) : (
                      devices.map((device) => (
                        <tr key={device.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleDeviceSelect(device)}>
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">{device.imei}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{device.ssid}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{new Date(device.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{device.printCount}</td>
                          <td className="px-4 py-3">
                            <button className="text-sm font-medium" style={{ color: '#10a37f' }}>View</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === 'device_detail' && selectedDevice && (
          <div className="max-w-lg mx-auto mt-4">
            <button onClick={() => { setView('search'); setRevealedPassword(null) }} className="mb-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back to search
            </button>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Device Details</h2>
                <span className="text-xs text-gray-400">Prints: {selectedDevice.printCount}</span>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-start py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-500">IMEI</span>
                  <span className="text-sm font-mono text-gray-900">{selectedDevice.imei}</span>
                </div>
                <div className="flex justify-between items-start py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-500">SSID</span>
                  <span className="text-sm text-gray-900 font-medium">{selectedDevice.ssid}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-500">Password</span>
                  {revealedPassword ? (
                    <span className="text-sm font-mono text-gray-900">{revealedPassword}</span>
                  ) : (
                    <button
                      onClick={handleRevealPassword}
                      disabled={revealing}
                      className="text-sm font-medium px-3 py-1 rounded border border-gray-200 hover:bg-gray-50"
                      style={{ color: '#10a37f' }}
                    >
                      {revealing ? 'Revealing...' : 'Reveal'}
                    </button>
                  )}
                </div>
                <div className="flex justify-between items-start py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-500">Created By</span>
                  <span className="text-sm text-gray-600">{selectedDevice.createdBy}</span>
                </div>
                <div className="flex justify-between items-start py-2">
                  <span className="text-sm font-medium text-gray-500">Created At</span>
                  <span className="text-sm text-gray-600">{new Date(selectedDevice.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handlePrint}
                  className="flex-1 py-2.5 text-white font-medium rounded-lg flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print 4x6 Label
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

    </div>
  )
}
