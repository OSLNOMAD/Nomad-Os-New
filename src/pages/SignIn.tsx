import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import Input from '../components/Input'
import Button from '../components/Button'

type SignInMethod = 'password' | 'otp'
type Step = 'credentials' | 'otp-sent'

export default function SignIn() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showNewPortalMessage, setShowNewPortalMessage] = useState(false)
  const [method, setMethod] = useState<SignInMethod>('password')
  const [step, setStep] = useState<Step>('credentials')

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setShowNewPortalMessage(false)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error?.includes('No account found')) {
          setShowNewPortalMessage(true)
          return
        }
        throw new Error(data.error || 'Sign in failed')
      }

      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('customer', JSON.stringify(data.customer))
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setShowNewPortalMessage(false)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/signin-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error?.includes('No account found')) {
          setShowNewPortalMessage(true)
          return
        }
        throw new Error(data.error || 'Failed to send OTP')
      }

      setStep('otp-sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) {
      setError('Please enter the 6-digit code')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/verify-signin-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed')
      }

      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('customer', JSON.stringify(data.customer))
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = method === 'password' 
    ? handlePasswordSignIn 
    : (step === 'credentials' ? handleSendOtp : handleVerifyOtp)

  return (
    <AuthLayout>
      <h1 className="auth-title">
        {step === 'otp-sent' ? 'Enter Verification Code' : 'Welcome Back'}
      </h1>
      <p className="auth-subtitle">
        {step === 'otp-sent' 
          ? 'We sent a code to your email' 
          : 'Sign in to access your Nomad Internet account'}
      </p>

      <form onSubmit={handleSubmit} className="auth-form">
        {step === 'credentials' && (
          <>
            <Input
              label="Email Address"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              tooltip="Use the email you registered with"
            />

            {method === 'password' && (
              <Input
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                tooltip="Your account password"
              />
            )}
          </>
        )}

        {step === 'otp-sent' && (
          <Input
            label="Verification Code"
            type="text"
            placeholder="Enter 6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            tooltip="Check your email for the code"
            maxLength={6}
          />
        )}

        {showNewPortalMessage && (
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/30 rounded-xl p-5 text-center">
            <div className="text-2xl mb-2">🎉</div>
            <h3 className="text-lg font-semibold text-text mb-2">Welcome to Our New Portal!</h3>
            <p className="text-sm text-muted mb-4">
              We've launched an improved customer portal with enhanced features. 
              Please sign up to create your account and access your Nomad Internet services.
            </p>
            <Link 
              to="/signup" 
              className="inline-block w-full py-3 px-6 bg-gradient-to-r from-primary to-accent text-white font-semibold rounded-lg hover:shadow-lg transition-all"
            >
              Sign Up Now
            </Link>
          </div>
        )}

        {error && !showNewPortalMessage && (
          <div className="error-message">{error}</div>
        )}

        {step === 'credentials' && method === 'password' && (
          <>
            <div className="form-row">
              <label className="checkbox">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <button 
                type="button"
                onClick={() => setMethod('otp')}
                className="link"
              >
                Use OTP instead
              </button>
            </div>
            <div className="form-row" style={{ justifyContent: 'center', marginTop: '-8px' }}>
              <Link to="/forgot-password" className="link">
                Forgot password?
              </Link>
            </div>
          </>
        )}

        {step === 'credentials' && method === 'otp' && (
          <div className="form-row" style={{ justifyContent: 'flex-end' }}>
            <button 
              type="button"
              onClick={() => setMethod('password')}
              className="link"
            >
              Use password instead
            </button>
          </div>
        )}

        <Button type="submit" isLoading={isLoading}>
          {method === 'password' ? 'Sign In' : (step === 'credentials' ? 'Send Code' : 'Verify & Sign In')}
        </Button>

        {step === 'otp-sent' && (
          <p className="auth-footer" style={{ marginTop: 0 }}>
            Didn't receive the code?{' '}
            <button type="button" onClick={handleSendOtp} className="link">
              Resend
            </button>
          </p>
        )}

        <p className="auth-footer" style={{ marginTop: 0 }}>
          Don't have an account?{' '}
          <Link to="/signup">Sign up</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
