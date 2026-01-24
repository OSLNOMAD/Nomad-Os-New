import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import Input from '../components/Input'
import Button from '../components/Button'

type Step = 'email' | 'confirm-email' | 'phone' | 'verify-phone' | 'verify-email' | 'password'

export default function SignUp() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [customerId, setCustomerId] = useState<number | null>(null)

  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '')
    if (digits.length === 0) return ''
    if (digits.length <= 1) return `+${digits}`
    if (digits.length <= 4) return `+${digits.slice(0, 1)} (${digits.slice(1)}`
    if (digits.length <= 7) return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4)}`
    return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`
  }

  const getCleanPhoneNumber = (formatted: string): string => {
    const digits = formatted.replace(/\D/g, '')
    return `+${digits}`
  }

  const validatePhoneNumber = (phoneNumber: string): boolean => {
    const digits = phoneNumber.replace(/\D/g, '')
    return digits.length === 11 && digits.startsWith('1')
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setPhone(formatted)
  }

  const checkCustomerEmail = async () => {
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to check email')
      }
      
      setCustomerId(data.customerId)
      
      if (!data.customerFound) {
        setStep('confirm-email')
      } else {
        setStep('phone')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify email. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmEmail = () => {
    setStep('phone')
  }

  const sendPhoneOtp = async () => {
    setIsLoading(true)
    setError('')
    
    const cleanPhone = getCleanPhoneNumber(phone)
    
    if (!validatePhoneNumber(cleanPhone)) {
      setError('Please enter a valid US phone number (+1 XXX XXX XXXX)')
      setIsLoading(false)
      return
    }
    
    try {
      const response = await fetch('/api/auth/send-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: cleanPhone, 
          customerId 
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP')
      }
      
      setStep('verify-phone')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send verification code. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const verifyPhoneOtp = async () => {
    if (phoneOtp.length !== 6) {
      setError('Please enter the 6-digit code sent to your phone')
      return
    }
    
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/auth/verify-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: getCleanPhoneNumber(phone), 
          code: phoneOtp,
          customerId 
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Verification failed')
      }
      
      await sendEmailOtp()
      setStep('verify-email')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const sendEmailOtp = async () => {
    try {
      const response = await fetch('/api/auth/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, customerId })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send email OTP')
      }
    } catch (err) {
      console.error('Send email OTP error:', err)
    }
  }

  const verifyEmailOtp = async () => {
    if (emailOtp.length !== 6) {
      setError('Please enter the 6-digit code sent to your email')
      return
    }
    
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/auth/verify-email-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          code: emailOtp,
          customerId
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Verification failed')
      }
      
      setStep('password')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const completeSignUp = async () => {
    if (!fullName.trim()) {
      setError('Please enter your full name')
      return
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customerId,
          password,
          fullName: fullName.trim()
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Sign up failed')
      }
      
      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('customer', JSON.stringify(data.customer))
      
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    switch (step) {
      case 'email':
        await checkCustomerEmail()
        break
      case 'confirm-email':
        handleConfirmEmail()
        break
      case 'phone':
        await sendPhoneOtp()
        break
      case 'verify-phone':
        await verifyPhoneOtp()
        break
      case 'verify-email':
        await verifyEmailOtp()
        break
      case 'password':
        await completeSignUp()
        break
    }
  }

  const stepConfig = {
    'email': {
      title: 'Create Your Account',
      subtitle: 'Enter the email you used to sign up for Nomad Internet services'
    },
    'confirm-email': {
      title: 'Email Not Found',
      subtitle: 'We couldn\'t find an account with this email. Please verify this is the email you used to sign up for our services.'
    },
    'phone': {
      title: 'Verify Your Phone',
      subtitle: 'Enter your US phone number to receive a verification code'
    },
    'verify-phone': {
      title: 'Enter Phone Code',
      subtitle: 'We sent a verification code to your phone'
    },
    'verify-email': {
      title: 'Enter Email Code',
      subtitle: 'We sent a verification code to your email'
    },
    'password': {
      title: 'Create Password',
      subtitle: 'Set a password for your account'
    }
  }

  const getProgressWidth = () => {
    switch (step) {
      case 'email': return '15%'
      case 'confirm-email': return '15%'
      case 'phone': return '35%'
      case 'verify-phone': return '55%'
      case 'verify-email': return '75%'
      case 'password': return '100%'
    }
  }

  return (
    <AuthLayout>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: getProgressWidth() }} />
      </div>

      <h1 className="auth-title">{stepConfig[step].title}</h1>
      <p className="auth-subtitle">{stepConfig[step].subtitle}</p>

      <form onSubmit={handleSubmit} className="auth-form">
        {step === 'email' && (
          <Input
            label="Email Address"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            tooltip="Use the email you used when signing up for Nomad Internet"
          />
        )}

        {step === 'confirm-email' && (
          <>
            <div className="warning-message">
              The email <strong>{email}</strong> was not found in our system. 
              If this is correct, we'll proceed with phone verification.
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep('email')}
                className="flex-1"
              >
                Use Different Email
              </Button>
              <Button type="submit" className="flex-1">
                Continue Anyway
              </Button>
            </div>
          </>
        )}

        {step === 'phone' && (
          <Input
            label="Phone Number"
            type="tel"
            placeholder="+1 (512) 299-9278"
            value={phone}
            onChange={handlePhoneChange}
            required
            tooltip="US phone numbers only (+1 format)"
          />
        )}

        {step === 'verify-phone' && (
          <>
            <Input
              label="Verification Code"
              type="text"
              placeholder="Enter 6-digit code"
              value={phoneOtp}
              onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              tooltip="Check your phone for the SMS code"
              maxLength={6}
            />
            <p className="auth-footer" style={{ marginTop: 0 }}>
              Didn't receive the code?{' '}
              <button type="button" onClick={() => sendPhoneOtp()} className="link">
                Resend
              </button>
            </p>
          </>
        )}

        {step === 'verify-email' && (
          <>
            <Input
              label="Email Verification Code"
              type="text"
              placeholder="Enter 6-digit code"
              value={emailOtp}
              onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              tooltip="Check your email for the verification code"
              maxLength={6}
            />
            <p className="auth-footer" style={{ marginTop: 0 }}>
              Didn't receive the code?{' '}
              <button type="button" onClick={() => sendEmailOtp()} className="link">
                Resend
              </button>
            </p>
          </>
        )}

        {step === 'password' && (
          <>
            <Input
              label="Full Name"
              type="text"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              tooltip="Your first and last name"
            />
            <Input
              label="Password"
              type="password"
              placeholder="Create a password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              tooltip="Must be at least 8 characters"
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              tooltip="Re-enter your password"
            />
          </>
        )}

        {error && (
          <div className="error-message">{error}</div>
        )}

        {step !== 'confirm-email' && (
          <Button type="submit" isLoading={isLoading}>
            {step === 'email' && 'Continue'}
            {step === 'phone' && 'Send Verification Code'}
            {step === 'verify-phone' && 'Verify Phone'}
            {step === 'verify-email' && 'Continue'}
            {step === 'password' && 'Complete Sign Up'}
          </Button>
        )}

        {step === 'email' && (
          <p className="auth-footer" style={{ marginTop: 0 }}>
            Already have an account?{' '}
            <Link to="/signin">Sign in</Link>
          </p>
        )}
      </form>
    </AuthLayout>
  )
}
