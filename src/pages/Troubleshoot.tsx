import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

type TroubleshootStep = 
  | 'checking'
  | 'active'
  | 'resuming'
  | 'waiting_first'
  | 'rechecking_first'
  | 'waiting_extended'
  | 'rechecking_extended'
  | 'success'
  | 'escalated'
  | 'error';

export default function Troubleshoot() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const subscriptionId = searchParams.get('subscription');
  const iccid = searchParams.get('iccid');
  const imei = searchParams.get('imei');
  const mdn = searchParams.get('mdn');
  
  const identifier = iccid || imei || mdn;
  const identifierType: 'iccid' | 'imei' | 'mdn' = iccid ? 'iccid' : imei ? 'imei' : 'mdn';
  
  const [step, setStep] = useState<TroubleshootStep>('checking');
  const [lineStatus, setLineStatus] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasInitialized = useRef(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getToken = () => localStorage.getItem('auth_token');

  const normalizeStatus = (status: string | null): string => {
    if (!status) return 'unknown';
    return status.toLowerCase().replace(/[-_\s]/g, '');
  };

  const checkLineStatus = useCallback(async (): Promise<string | null> => {
    const token = getToken();
    if (!token || !identifier) return null;

    try {
      const response = await fetch('/api/device/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          identifier,
          identifierType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get device status');
      }

      const data = await response.json();
      const status = (data.device?.carrier?.state || data.device?.state || '').toLowerCase() || null;
      setLineStatus(status);
      return status;
    } catch (err: any) {
      console.error('Status check error:', err);
      return null;
    }
  }, [identifier, identifierType]);

  const resumeLine = async (): Promise<boolean> => {
    const token = getToken();
    if (!token || !identifier) return false;

    try {
      const response = await fetch('/api/device/resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          identifier,
          identifierType
        })
      });

      return response.ok;
    } catch (err) {
      console.error('Resume error:', err);
      return false;
    }
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleExtendedRecheck = useCallback(async () => {
    clearTimer();
    setStep('rechecking_extended');
    const status = await checkLineStatus();
    const normalized = normalizeStatus(status);

    if (normalized === 'active') {
      setStep('success');
    } else {
      setStep('escalated');
    }
  }, [checkLineStatus]);

  const startExtendedTimer = useCallback(() => {
    setStep('waiting_extended');
    setTimeRemaining(60);
    
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleExtendedRecheck();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [handleExtendedRecheck]);

  const handleFirstRecheck = useCallback(async () => {
    clearTimer();
    setStep('rechecking_first');
    const status = await checkLineStatus();
    const normalized = normalizeStatus(status);

    if (normalized === 'active') {
      setStep('success');
    } else if (normalized === 'pendingresume' || normalized === 'pending') {
      startExtendedTimer();
    } else {
      setStep('escalated');
    }
  }, [checkLineStatus, startExtendedTimer]);

  const startFirstTimer = useCallback(() => {
    setStep('waiting_first');
    setTimeRemaining(120);
    
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleFirstRecheck();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [handleFirstRecheck]);

  useEffect(() => {
    return () => clearTimer();
  }, []);

  useEffect(() => {
    if (!identifier) {
      setError('Missing device information');
      setStep('error');
      return;
    }

    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const init = async () => {
      const status = await checkLineStatus();
      const normalized = normalizeStatus(status);

      if (normalized === 'active') {
        setStep('active');
      } else if (normalized === 'suspended' || normalized === 'suspend' || normalized === 'deactive' || normalized === 'deactivate') {
        setStep('resuming');
        const resumed = await resumeLine();
        if (resumed) {
          startFirstTimer();
        } else {
          setError('Failed to initiate line restoration');
          setStep('error');
        }
      } else if (normalized === 'pendingresume' || normalized === 'pending' || normalized === 'pendingsuspend') {
        startExtendedTimer();
      } else if (!status) {
        setStep('resuming');
        const resumed = await resumeLine();
        if (resumed) {
          startFirstTimer();
        } else {
          setError('Failed to initiate line restoration');
          setStep('error');
        }
      } else {
        setStep('escalated');
      }
    };

    init();
  }, [identifier, checkLineStatus, startFirstTimer, startExtendedTimer]);

  const progressPercentage = step === 'waiting_first' 
    ? ((120 - timeRemaining) / 120) * 100
    : step === 'waiting_extended'
    ? ((60 - timeRemaining) / 60) * 100
    : 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#f7faf9' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8"
      >
        <div className="flex items-center justify-center mb-6">
          <img src="/nomad-logo.png" alt="Nomad Internet" className="h-10" />
        </div>

        <h1 className="text-2xl font-bold text-center mb-2" style={{ color: '#0f172a' }}>
          Internet Troubleshooting
        </h1>
        <p className="text-center text-gray-500 mb-8">
          {subscriptionId && `Subscription: ${subscriptionId.substring(0, 12)}...`}
        </p>

        <AnimatePresence mode="wait">
          {step === 'checking' && (
            <motion.div
              key="checking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10a37f20' }}>
                <svg className="w-8 h-8 animate-spin" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Checking your line status...</p>
              <p className="text-gray-500 mt-2">This will only take a moment</p>
            </motion.div>
          )}

          {step === 'active' && (
            <motion.div
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10a37f20' }}>
                <svg className="w-8 h-8" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Your line is already active!</p>
              <p className="text-gray-500 mt-2 mb-6">
                If you're still experiencing issues, try rebooting your modem. Unplug it from power, wait 30 seconds, then plug it back in.
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 rounded-lg text-white font-medium transition-all hover:shadow-lg"
                style={{ backgroundColor: '#10a37f' }}
              >
                Back to Dashboard
              </button>
            </motion.div>
          )}

          {step === 'resuming' && (
            <motion.div
              key="resuming"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#fef3c720' }}>
                <svg className="w-8 h-8 animate-spin" style={{ color: '#f59e0b' }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Line Suspended Detected</p>
              <p className="text-gray-500 mt-2">Initiating line restoration...</p>
            </motion.div>
          )}

          {(step === 'waiting_first' || step === 'waiting_extended') && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8"
            >
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#3b82f620' }}>
                  <span className="text-3xl font-bold" style={{ color: '#3b82f6' }}>{formatTime(timeRemaining)}</span>
                </div>
                
                {step === 'waiting_first' ? (
                  <>
                    <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Restoring Your Line</p>
                    <p className="text-gray-500 mt-2">
                      We found that your internet line is currently suspended. We're restoring it now.<br/>
                      This usually takes about 2 minutes.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Still Restoring...</p>
                    <p className="text-gray-500 mt-2">
                      Your line is in the process of being restored, but it's taking a bit longer than usual.<br/>
                      We're still working on it and will check again shortly.
                    </p>
                  </>
                )}
              </div>

              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <motion.div
                  className="h-3 rounded-full"
                  style={{ backgroundColor: '#3b82f6' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-blue-700">
                    Please stay on this page. We'll automatically check the status when the timer completes.
                    Do not reboot your device yet.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {(step === 'rechecking_first' || step === 'rechecking_extended') && (
            <motion.div
              key="rechecking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#3b82f620' }}>
                <svg className="w-8 h-8 animate-spin" style={{ color: '#3b82f6' }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Checking line status...</p>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10a37f20' }}>
                <svg className="w-10 h-10" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-xl font-bold mb-2" style={{ color: '#10a37f' }}>Your Line is Now Active!</p>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4 mb-6 text-left">
                <p className="font-medium text-green-800 mb-2">Please reboot your modem now:</p>
                <ol className="text-sm text-green-700 space-y-1 ml-4 list-decimal">
                  <li>Unplug the modem from power</li>
                  <li>Wait 30 seconds</li>
                  <li>Plug it back in</li>
                </ol>
                <p className="text-sm text-green-700 mt-3">
                  Your internet should come back online shortly after the modem restarts.
                </p>
              </div>

              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 rounded-lg text-white font-medium transition-all hover:shadow-lg"
                style={{ backgroundColor: '#10a37f' }}
              >
                Back to Dashboard
              </button>
            </motion.div>
          )}

          {step === 'escalated' && (
            <motion.div
              key="escalated"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#fef3c720' }}>
                <svg className="w-8 h-8" style={{ color: '#f59e0b' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Support Needed</p>
              <p className="text-gray-500 mt-2 mb-6">
                We're still working on restoring your line, but it's taking longer than expected.<br/>
                Our support team has been notified and will assist you further.
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-700">
                  Current line status: <span className="font-medium">{lineStatus || 'Unknown'}</span>
                </p>
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-6 py-3 rounded-lg font-medium transition-all border border-gray-300 hover:bg-gray-50"
                  style={{ color: '#0f172a' }}
                >
                  Back to Dashboard
                </button>
                <a
                  href="tel:+18447677770"
                  className="px-6 py-3 rounded-lg text-white font-medium transition-all hover:shadow-lg flex items-center gap-2"
                  style={{ backgroundColor: '#10a37f' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call Support
                </a>
              </div>
            </motion.div>
          )}

          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#fee2e220' }}>
                <svg className="w-8 h-8" style={{ color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Something Went Wrong</p>
              <p className="text-gray-500 mt-2 mb-6">{error || 'An unexpected error occurred'}</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 rounded-lg text-white font-medium transition-all hover:shadow-lg"
                style={{ backgroundColor: '#10a37f' }}
              >
                Back to Dashboard
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
