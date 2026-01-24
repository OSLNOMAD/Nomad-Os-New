import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import AuthLayout from '../components/AuthLayout'
import Input from '../components/Input'
import Button from '../components/Button'

type Step = 'email' | 'confirm-email' | 'phone' | 'verify-phone' | 'verify-email'

export default function SignUp() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [, setCustomerNotFound] = useState(false)

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
      const response = await fetch('https://app.lrlos.com/webhook/Chargebee/getcustomersusingemail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, keyword: 'signup' })
      })
      
      const data = await response.json()
      
      if (Array.isArray(data) && data.length === 0) {
        setCustomerNotFound(true)
        setStep('confirm-email')
      } else {
        setStep('phone')
      }
    } catch {
      setError('Unable to verify email. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmEmail = () => {
    setCustomerNotFound(false)
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
      await fetch('https://app.lrlos.com/webhook/twilio/sendotp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: cleanPhone, 
          indicator: 'phone verification sign up' 
        })
      })
      
      setStep('verify-phone')
    } catch {
      setError('Unable to send verification code. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const sendEmailOtp = async () => {
    setIsLoading(true)
    setError('')
    
    try {
      await fetch('https://app.lrlos.com/webhook/twilio/sendotp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          indicator: 'email verification Sign up' 
        })
      })
    } catch {
      setError('Unable to send email verification code. Please try again.')
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
      await sendEmailOtp()
      setStep('verify-email')
    } catch {
      setError('Verification failed. Please try again.')
    } finally {
      setIsLoading(false)
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
      await new Promise(resolve => setTimeout(resolve, 1000))
      alert('Sign up complete! You can now access your account.')
    } catch {
      setError('Verification failed. Please try again.')
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
    }
  }

  const getProgressWidth = () => {
    switch (step) {
      case 'email': return '20%'
      case 'confirm-email': return '20%'
      case 'phone': return '40%'
      case 'verify-phone': return '70%'
      case 'verify-email': return '100%'
    }
  }

  return (
    <AuthLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="mb-8">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-nomad-primary to-nomad-accent rounded-full"
              initial={{ width: 0 }}
              animate={{ width: getProgressWidth() }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-center mb-10">
              <h1 className="text-3xl font-semibold text-gray-800 mb-3">
                {stepConfig[step].title}
              </h1>
              <p className="text-gray-500 text-base leading-relaxed">
                {stepConfig[step].subtitle}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
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
                <div className="space-y-6">
                  <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-amber-800 text-sm leading-relaxed">
                      The email <strong>{email}</strong> was not found in our system. 
                      If this is correct, we'll proceed with phone verification.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setStep('email')}
                      className="flex-1 py-3.5 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                      Use Different Email
                    </button>
                    <Button type="submit" className="flex-1">
                      Continue Anyway
                    </Button>
                  </div>
                </div>
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
                <div className="space-y-5">
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
                  <p className="text-sm text-gray-500 text-center pt-2">
                    Didn't receive the code?{' '}
                    <button 
                      type="button"
                      onClick={() => sendPhoneOtp()}
                      className="text-nomad-accent hover:text-nomad-primary font-medium transition-colors"
                    >
                      Resend
                    </button>
                  </p>
                </div>
              )}

              {step === 'verify-email' && (
                <div className="space-y-5">
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
                  <p className="text-sm text-gray-500 text-center pt-2">
                    Didn't receive the code?{' '}
                    <button 
                      type="button"
                      onClick={() => sendEmailOtp()}
                      className="text-nomad-accent hover:text-nomad-primary font-medium transition-colors"
                    >
                      Resend
                    </button>
                  </p>
                </div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm"
                >
                  {error}
                </motion.div>
              )}

              {step !== 'confirm-email' && (
                <div className="pt-2">
                  <Button type="submit" isLoading={isLoading}>
                    {step === 'email' && 'Continue'}
                    {step === 'phone' && 'Send Verification Code'}
                    {step === 'verify-phone' && 'Verify Phone'}
                    {step === 'verify-email' && 'Complete Sign Up'}
                  </Button>
                </div>
              )}

              {step === 'email' && (
                <p className="text-center text-gray-500 text-sm pt-4">
                  Already have an account?{' '}
                  <Link 
                    to="/signin" 
                    className="text-nomad-accent hover:text-nomad-primary transition-colors font-medium"
                  >
                    Sign in
                  </Link>
                </p>
              )}
            </form>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </AuthLayout>
  )
}
