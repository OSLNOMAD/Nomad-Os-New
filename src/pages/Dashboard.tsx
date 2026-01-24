import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

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

export default function Dashboard() {
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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

  if (isLoading) {
    return (
      <div className="dashboard-layout flex items-center justify-center">
        <div className="text-center">
          <div className="spinner" style={{ width: 48, height: 48, borderWidth: 4, margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--muted)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="dashboard-layout">
      <header className="dashboard-header">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <img src="/logo.svg" alt="Nomad Internet" className="h-10" />
          <button onClick={handleLogout} className="sign-out-btn">
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="dashboard-title mb-2">Welcome back{customer?.fullName ? `, ${customer.fullName.split(' ')[0]}` : ''}!</h1>
        <p className="dashboard-subtitle mb-10">Manage your Nomad Internet account</p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="dashboard-card">
            <h2 className="card-title">Account Information</h2>
            <div className="space-y-5">
              <div>
                <p className="card-label">Name</p>
                <p className="card-value">{customer?.fullName || 'Not set'}</p>
              </div>
              <div>
                <p className="card-label">Email</p>
                <p className="card-value">{customer?.email}</p>
              </div>
              <div>
                <p className="card-label">Phone</p>
                <p className="card-value">{customer?.phone || 'Not set'}</p>
              </div>
              <div>
                <p className="card-label">Account Status</p>
                <p className="mt-1">
                  <span className={`status-badge ${customer?.isVerified ? 'status-verified' : 'status-pending'}`}>
                    {customer?.isVerified ? 'Verified' : 'Pending Verification'}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <h2 className="card-title">Activity</h2>
            <div className="space-y-5">
              <div>
                <p className="card-label">Last Login</p>
                <p className="card-value">{formatDate(customer?.lastLoginAt)}</p>
              </div>
              <div>
                <p className="card-label">Total Logins</p>
                <p className="card-value">{customer?.loginCount || 0}</p>
              </div>
              <div>
                <p className="card-label">Member Since</p>
                <p className="card-value">{formatDate(customer?.createdAt)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="cta-card mt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="cta-title">Need Help?</h3>
              <p className="cta-text">Our support team is available 24/7 to assist you.</p>
            </div>
            <button className="cta-button">Contact Support</button>
          </div>
        </div>
      </main>
    </div>
  )
}
