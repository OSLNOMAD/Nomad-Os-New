import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export default function NomadQRPrint() {
  const { imei } = useParams<{ imei: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [device, setDevice] = useState<{ imei: string; ssid: string; password: string } | null>(null)

  const getToken = () => localStorage.getItem('admin_token')
  const authHeaders = () => ({ 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' })

  useEffect(() => {
    if (!imei) return
    loadDevice()
  }, [imei])

  const loadDevice = async () => {
    const token = getToken()
    if (!token) {
      navigate('/admin')
      return
    }
    try {
      const accessRes = await fetch('/api/ops/qr/check-access', { headers: authHeaders() })
      if (!accessRes.ok) {
        setError('Access denied')
        setLoading(false)
        return
      }

      const revealRes = await fetch(`/api/ops/qr/device/${imei}/reveal`, {
        method: 'POST',
        headers: authHeaders()
      })
      if (!revealRes.ok) {
        setError('Device not found')
        setLoading(false)
        return
      }
      const revealData = await revealRes.json()

      const deviceRes = await fetch(`/api/ops/qr/device/${imei}`, { headers: authHeaders() })
      if (!deviceRes.ok) {
        setError('Device not found')
        setLoading(false)
        return
      }
      const deviceData = await deviceRes.json()

      setDevice({
        imei: deviceData.device.imei,
        ssid: deviceData.device.ssid,
        password: revealData.password,
      })
    } catch {
      setError('Failed to load device')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (device) {
      setTimeout(() => window.print(), 600)
    }
  }, [device])

  if (loading) {
    return (
      <div style={{ width: '4in', height: '6in', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
        Loading...
      </div>
    )
  }

  if (error || !device) {
    return (
      <div style={{ width: '4in', height: '6in', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif', flexDirection: 'column', gap: '12px' }}>
        <p style={{ color: '#dc2626' }}>{error || 'Device not found'}</p>
        <button onClick={() => navigate('/ops/nomad-qr')} style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}>
          Back to QR App
        </button>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @page { size: 4in 6in; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; }
        }
      `}</style>

      <div className="no-print" style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #eee', fontFamily: 'Arial, sans-serif' }}>
        <button
          onClick={() => window.print()}
          style={{ padding: '8px 24px', background: '#10a37f', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, marginRight: '8px' }}
        >
          Print Label
        </button>
        <button
          onClick={() => navigate('/ops/nomad-qr')}
          style={{ padding: '8px 24px', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}
        >
          Back
        </button>
      </div>

      <div style={{
        width: '4in',
        height: '6in',
        margin: '0 auto',
        fontFamily: 'Arial, Helvetica, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.3in',
        boxSizing: 'border-box',
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          border: '2px solid #000',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.25in',
          boxSizing: 'border-box',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '0.15in' }}>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#10a37f', letterSpacing: '1px' }}>NOMAD INTERNET</div>
            <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>WiFi Device Credentials</div>
          </div>

          <div style={{ width: '80%', borderTop: '1px dashed #ccc', margin: '0.08in 0' }} />

          <div style={{ width: '100%', textAlign: 'center', margin: '0.1in 0' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Network Name (SSID)</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#000', wordBreak: 'break-all', padding: '4px 0' }}>{device.ssid}</div>
          </div>

          <div style={{ width: '80%', borderTop: '1px dashed #ccc', margin: '0.08in 0' }} />

          <div style={{ width: '100%', textAlign: 'center', margin: '0.1in 0' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Password</div>
            <div style={{ fontSize: device.password.length > 16 ? '14px' : '20px', fontWeight: 'bold', color: '#000', wordBreak: 'break-all', padding: '4px 0' }}>{device.password}</div>
          </div>

          <div style={{ width: '80%', borderTop: '1px dashed #ccc', margin: '0.08in 0' }} />

          <div style={{ fontSize: '9px', color: '#999', marginTop: '0.1in' }}>IMEI: {device.imei}</div>
        </div>
      </div>
    </>
  )
}
