import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

type TroubleshootStep = 
  | 'checking'
  | 'active'
  | 'issue_not_working'
  | 'issue_speed'
  | 'speed_q1_when'
  | 'speed_q2_moved'
  | 'speed_refresh_suspend'
  | 'speed_refresh_resume'
  | 'speed_refresh_power_cycle'
  | 'speed_refresh_syncing'
  | 'speed_device_testing'
  | 'speed_outdoor_test'
  | 'speed_outdoor_result'
  | 'speed_escalate'
  | 'speed_completed'
  | 'resuming'
  | 'waiting_first'
  | 'rechecking_first'
  | 'waiting_extended'
  | 'rechecking_extended'
  | 'success'
  | 'escalated'
  | 'escalation_pending'
  | 'escalation_submitted'
  | 'support_contact_form'
  | 'support_ticket_submitted'
  | 'no_line'
  | 'no_line_submitted'
  | 'error';

interface EscalationInfo {
  hasRecentEscalation: boolean;
  ticketId?: string;
  hoursRemaining?: number;
  canEscalateAgain?: boolean;
}

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
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [alternateEmail, setAlternateEmail] = useState<string>('');
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [escalationInfo, setEscalationInfo] = useState<EscalationInfo | null>(null);
  const [escalationTicketId, setEscalationTicketId] = useState<string>('');
  const [contactMethod, setContactMethod] = useState<'email' | 'phone' | null>(null);
  const [contactPhone, setContactPhone] = useState('');
  const [preferredCallTime, setPreferredCallTime] = useState('');
  const [ticketNotes, setTicketNotes] = useState('');
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketError, setTicketError] = useState('');
  const [supportTicketId, setSupportTicketId] = useState('');
  const [troubleshootBranch, setTroubleshootBranch] = useState<'no_internet' | 'slow_speed' | null>(null);
  
  const [slowSpeedSessionId, setSlowSpeedSessionId] = useState<number | null>(null);
  const [slowSpeedEligibility, setSlowSpeedEligibility] = useState<{
    canRefresh: boolean;
    daysUntilNextRefresh: number;
    isSyncing: boolean;
    syncMinutesRemaining: number;
  } | null>(null);
  const [issueOnset, setIssueOnset] = useState<'just_started' | 'ongoing' | null>(null);
  const [modemMoved, setModemMoved] = useState<boolean | null>(null);
  const [outdoorTestResult, setOutdoorTestResult] = useState<'improved' | 'same' | null>(null);
  
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

  const checkLineStatus = useCallback(async (): Promise<{ status: string | null; notFound: boolean }> => {
    const token = getToken();
    if (!token || !identifier) return { status: null, notFound: false };

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

      if (response.status === 404) {
        return { status: null, notFound: true };
      }

      if (!response.ok) {
        throw new Error('Failed to get device status');
      }

      const data = await response.json();
      const status = (data.device?.carrier?.state || data.device?.state || '').toLowerCase() || null;
      setLineStatus(status);
      return { status, notFound: false };
    } catch (err: any) {
      console.error('Status check error:', err);
      return { status: null, notFound: false };
    }
  }, [identifier, identifierType]);

  const fetchCustomerData = async () => {
    const token = getToken();
    if (!token) return null;

    try {
      const response = await fetch('/api/customer/full-data', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) return null;

      const data = await response.json();
      setCustomerEmail(data.chargebee?.customers?.[0]?.customer?.email || '');
      return data;
    } catch (err) {
      console.error('Failed to fetch customer data:', err);
      return null;
    }
  };

  const submitActivateLine = async (notificationEmail?: string) => {
    const token = getToken();
    if (!token) return false;

    setIsSubmitting(true);

    try {
      const customerData = subscriptionData || await fetchCustomerData();
      const customer = customerData?.chargebee?.customers?.[0]?.customer;
      const subscription = customerData?.chargebee?.customers?.[0]?.subscriptions?.find(
        (sub: any) => sub.subscription?.id === subscriptionId
      )?.subscription;

      const response = await fetch('/api/device/activate-line', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          imei: imei || '',
          iccid: iccid || '',
          subscriptionId: subscriptionId || '',
          subscriptionStatus: subscription?.status || 'unknown',
          chargebeeCustomerId: customer?.id || '',
          customerFirstName: customer?.first_name || '',
          customerLastName: customer?.last_name || '',
          inGracePeriod: false,
          dueInvoicesCount: 0,
          totalDues: 0,
          notificationEmail: notificationEmail || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit activation request');
      }

      const result = await response.json();
      setCustomerEmail(result.notificationEmail || customerEmail);
      setStep('no_line_submitted');
      return true;
    } catch (err) {
      console.error('Activate line error:', err);
      setError('Failed to submit your request. Please try again.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkEscalationStatus = async () => {
    const token = getToken();
    if (!token) return null;

    try {
      const response = await fetch('/api/escalation/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscriptionId: subscriptionId || '',
          iccid: iccid || ''
        })
      });

      if (!response.ok) return null;

      const data = await response.json();
      setEscalationInfo(data);
      return data as EscalationInfo;
    } catch (err) {
      console.error('Check escalation error:', err);
      return null;
    }
  };

  const createEscalation = async () => {
    const token = getToken();
    if (!token) return false;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/escalation/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscriptionId: subscriptionId || '',
          iccid: iccid || '',
          imei: imei || '',
          issueType: 'line_restoration',
          notificationEmail: alternateEmail || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.ticketId) {
          setEscalationTicketId(errorData.ticketId);
          setEscalationInfo({
            hasRecentEscalation: true,
            ticketId: errorData.ticketId,
            hoursRemaining: errorData.hoursRemaining,
            canEscalateAgain: false
          });
          setStep('escalation_pending');
        } else {
          setError(errorData.error || 'Failed to create escalation ticket');
        }
        return false;
      }

      const result = await response.json();
      setEscalationTicketId(result.ticketId);
      setStep('escalation_submitted');
      return true;
    } catch (err) {
      console.error('Create escalation error:', err);
      setError('Failed to submit escalation. Please try again.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitTroubleshootingTicket = async () => {
    const token = getToken();
    if (!token) return;

    setTicketSubmitting(true);
    setTicketError('');

    try {
      const issueType = troubleshootBranch === 'no_internet' ? 'no_internet' : 'slow_speed';

      const stepsCompleted = issueType === 'slow_speed'
        ? [
            issueOnset ? `Issue onset: ${issueOnset === 'just_started' ? 'Just started' : 'Ongoing issue'}` : null,
            modemMoved !== null ? `Modem moved recently: ${modemMoved ? 'Yes' : 'No'}` : null,
            'Completed speed refresh/suspend-resume cycle',
            'Performed device power cycle',
            outdoorTestResult ? `Outdoor speed test: ${outdoorTestResult === 'improved' ? 'Speeds improved outdoors' : 'Speeds same indoors and outdoors'}` : null,
          ].filter(Boolean).join('\n- ')
        : [
            'Customer reported internet not working',
            'Modem reboot instructions provided',
            'Issue persisted after reboot - customer requested support'
          ].join('\n- ');

      let servicePlan = '';
      try {
        const customerData = subscriptionData || await fetchCustomerData();
        const subscription = customerData?.chargebee?.customers?.[0]?.subscriptions?.find(
          (sub: any) => sub.subscription?.id === subscriptionId
        )?.subscription;
        servicePlan = subscription?.plan_id || subscription?.plan_name || '';
      } catch {}

      const response = await fetch('/api/troubleshooting/submit-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscriptionId: subscriptionId || '',
          iccid: iccid || '',
          imei: imei || '',
          mdn: mdn || '',
          issueType,
          contactMethod,
          phone: contactPhone || undefined,
          callTime: preferredCallTime || undefined,
          additionalNotes: ticketNotes,
          lineStatus: lineStatus || 'Unknown',
          servicePlan: servicePlan || undefined,
          troubleshootingSteps: `- ${stepsCompleted}`
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        setTicketError(errorData.error || 'Failed to create support ticket');
        return;
      }

      const result = await response.json();
      setSupportTicketId(result.ticketId);
      setStep('support_ticket_submitted');
    } catch (err) {
      console.error('Submit troubleshooting ticket error:', err);
      setTicketError('Failed to submit support ticket. Please try again.');
    } finally {
      setTicketSubmitting(false);
    }
  };

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

  const suspendLine = async (): Promise<boolean> => {
    const token = getToken();
    if (!token || !identifier) return false;

    try {
      const response = await fetch('/api/device/suspend', {
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
      console.error('Suspend error:', err);
      return false;
    }
  };

  const checkSlowSpeedEligibility = async () => {
    const token = getToken();
    if (!token || !subscriptionId) return null;

    try {
      const response = await fetch('/api/slow-speed/check-eligibility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subscriptionId })
      });

      if (!response.ok) return null;

      const data = await response.json();
      setSlowSpeedEligibility(data);
      return data;
    } catch (err) {
      console.error('Check slow speed eligibility error:', err);
      return null;
    }
  };

  const startSlowSpeedSession = async (onset: string, moved: boolean | null) => {
    const token = getToken();
    if (!token || !subscriptionId) return null;

    try {
      const response = await fetch('/api/slow-speed/start-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscriptionId,
          iccid: iccid || null,
          imei: imei || null,
          mdn: mdn || null,
          issueOnset: onset,
          modemMoved: moved
        })
      });

      if (!response.ok) return null;

      const data = await response.json();
      setSlowSpeedSessionId(data.sessionId);
      return data.sessionId;
    } catch (err) {
      console.error('Start slow speed session error:', err);
      return null;
    }
  };

  const startSlowSpeedRefresh = async (sessionId: number) => {
    const token = getToken();
    if (!token) return false;

    try {
      const response = await fetch('/api/slow-speed/start-refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          subscriptionId,
          mdn: mdn || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.daysUntilNextRefresh) {
          setSlowSpeedEligibility({
            canRefresh: false,
            daysUntilNextRefresh: errorData.daysUntilNextRefresh,
            isSyncing: false,
            syncMinutesRemaining: 0
          });
        }
        return false;
      }

      return true;
    } catch (err) {
      console.error('Start slow speed refresh error:', err);
      return false;
    }
  };

  const updateSlowSpeedSession = async (sessionId: number, data: Record<string, any>) => {
    const token = getToken();
    if (!token) return false;

    try {
      const response = await fetch('/api/slow-speed/update-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          ...data
        })
      });

      return response.ok;
    } catch (err) {
      console.error('Update slow speed session error:', err);
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
    const { status, notFound } = await checkLineStatus();
    
    if (notFound) {
      const customerData = await fetchCustomerData();
      setSubscriptionData(customerData);
      setStep('no_line');
      return;
    }
    
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
    const { status, notFound } = await checkLineStatus();
    
    if (notFound) {
      const customerData = await fetchCustomerData();
      setSubscriptionData(customerData);
      setStep('no_line');
      return;
    }
    
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

  const handleSlowSpeedResumeComplete = useCallback(async () => {
    clearTimer();
    setStep('speed_refresh_power_cycle');
  }, []);

  const startSlowSpeedResumeTimer = useCallback(async () => {
    clearTimer();
    await resumeLine();
    setStep('speed_refresh_resume');
    setTimeRemaining(120);
    
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleSlowSpeedResumeComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [handleSlowSpeedResumeComplete]);

  const handleSlowSpeedSuspendComplete = useCallback(async () => {
    clearTimer();
    await startSlowSpeedResumeTimer();
  }, [startSlowSpeedResumeTimer]);

  const startSlowSpeedSuspendTimer = useCallback(() => {
    clearTimer();
    setStep('speed_refresh_suspend');
    setTimeRemaining(120);
    
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleSlowSpeedSuspendComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [handleSlowSpeedSuspendComplete]);

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
      const { status, notFound } = await checkLineStatus();
      
      if (notFound) {
        const customerData = await fetchCustomerData();
        setSubscriptionData(customerData);
        setStep('no_line');
        return;
      }
      
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
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-4" style={{ backgroundColor: '#f7faf9' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-xl sm:rounded-2xl shadow-xl p-5 sm:p-8"
      >
        <div className="flex items-center justify-center mb-4 sm:mb-6">
          <img src="/logo.svg" alt="Nomad Internet" className="h-8 sm:h-10" />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-center mb-2" style={{ color: '#0f172a' }}>
          Internet Troubleshooting
        </h1>
        <p className="text-center text-gray-500 mb-6 sm:mb-8 text-sm sm:text-base">
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
              className="py-8"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10a37f20' }}>
                  <svg className="w-8 h-8" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Your service looks good on our end</p>
                <p className="text-gray-500 mt-2">What issue are you experiencing?</p>
              </div>
              
              <div className="space-y-3 mb-6">
                <button
                  onClick={() => setStep('issue_not_working')}
                  className="w-full p-4 rounded-lg border border-gray-200 hover:border-primary hover:bg-gray-50 transition-all text-left flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#ef444420' }}>
                    <svg className="w-6 h-6" style={{ color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a5 5 0 01-7.072-7.072m7.072 7.072L6.343 17.657M6.343 6.343L3 3m3.343 3.343a5 5 0 017.072 0" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: '#0f172a' }}>Internet is not working at all</p>
                    <p className="text-sm text-gray-500">No connection, can't browse or use apps</p>
                  </div>
                </button>
                
                <button
                  onClick={async () => {
                    await checkSlowSpeedEligibility();
                    setStep('speed_q1_when');
                  }}
                  className="w-full p-4 rounded-lg border border-gray-200 hover:border-primary hover:bg-gray-50 transition-all text-left flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f59e0b20' }}>
                    <svg className="w-6 h-6" style={{ color: '#f59e0b' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: '#0f172a' }}>Speed issues</p>
                    <p className="text-sm text-gray-500">Internet is slow, buffering, or lagging</p>
                  </div>
                </button>
              </div>
              
              <div className="text-center">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="text-sm font-medium transition-all hover:underline"
                  style={{ color: '#10a37f' }}
                >
                  Back to Dashboard
                </button>
              </div>
            </motion.div>
          )}

          {step === 'issue_not_working' && (
            <motion.div
              key="issue_not_working"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#ef444420' }}>
                  <svg className="w-8 h-8" style={{ color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a5 5 0 01-7.072-7.072m7.072 7.072L6.343 17.657M6.343 6.343L3 3m3.343 3.343a5 5 0 017.072 0" />
                  </svg>
                </div>
                <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Internet Not Working</p>
                <p className="text-gray-500 mt-2">Let's try rebooting your device</p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
                <h4 className="font-semibold text-blue-800 mb-3">Please follow these steps:</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-blue-700">
                  <li>Unplug your modem from the power outlet</li>
                  <li>Wait 30 seconds</li>
                  <li>Plug the modem back in</li>
                  <li>Wait 2-3 minutes for it to fully restart</li>
                  <li>Check if your internet is working</li>
                </ol>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600">
                  <strong>Still not working?</strong> If rebooting didn't help, you can create a support ticket and our team will follow up with you.
                </p>
              </div>
              
              <button
                onClick={() => {
                  setTroubleshootBranch('no_internet');
                  setContactMethod(null);
                  setContactPhone('');
                  setPreferredCallTime('');
                  setTicketNotes('');
                  setTicketError('');
                  setStep('support_contact_form');
                }}
                className="w-full px-4 py-3 rounded-lg text-white font-medium transition-all hover:shadow-lg mb-3"
                style={{ backgroundColor: '#6366f1' }}
              >
                Contact Support
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('active')}
                  className="flex-1 px-4 py-3 rounded-lg font-medium transition-all border border-gray-300 hover:bg-gray-50"
                  style={{ color: '#0f172a' }}
                >
                  Back
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 px-4 py-3 rounded-lg text-white font-medium transition-all hover:shadow-lg"
                  style={{ backgroundColor: '#10a37f' }}
                >
                  Back to Dashboard
                </button>
              </div>
            </motion.div>
          )}

          {step === 'issue_speed' && (
            <motion.div
              key="issue_speed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f59e0b20' }}>
                  <svg className="w-8 h-8" style={{ color: '#f59e0b' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Speed Issues</p>
                <p className="text-gray-500 mt-2">Redirecting to troubleshooting...</p>
              </div>
            </motion.div>
          )}

          {step === 'speed_q1_when' && (
            <motion.div
              key="speed_q1_when"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 sm:py-8"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f59e0b20' }}>
                  <svg className="w-8 h-8" style={{ color: '#f59e0b' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Speed Troubleshooting</p>
                <p className="text-gray-500 mt-2">Let's diagnose your slow speed issue</p>
              </div>

              {slowSpeedEligibility?.isSyncing && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-amber-700">
                    <strong>Connection syncing in progress.</strong> Your connection is still syncing from a recent refresh. Please wait {slowSpeedEligibility.syncMinutesRemaining} minutes before testing again.
                  </p>
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <p className="font-medium mb-1" style={{ color: '#0f172a' }}>Question 1 of 2</p>
                <p className="text-sm text-gray-600">Have you recently started experiencing slow speeds, or has this been happening for some time?</p>
              </div>

              <div className="space-y-3 mb-6">
                <button
                  onClick={() => {
                    setIssueOnset('just_started');
                    setStep('speed_q2_moved');
                  }}
                  className="w-full p-4 rounded-lg border border-gray-200 hover:border-primary hover:bg-gray-50 transition-all text-left"
                >
                  <p className="font-medium" style={{ color: '#0f172a' }}>This just started</p>
                  <p className="text-sm text-gray-500">I was getting good speeds before</p>
                </button>
                
                <button
                  onClick={async () => {
                    setIssueOnset('ongoing');
                    const sessionId = await startSlowSpeedSession('ongoing', null);
                    if (sessionId) {
                      setStep('speed_device_testing');
                    }
                  }}
                  className="w-full p-4 rounded-lg border border-gray-200 hover:border-primary hover:bg-gray-50 transition-all text-left"
                >
                  <p className="font-medium" style={{ color: '#0f172a' }}>It's been happening for a while</p>
                  <p className="text-sm text-gray-500">Speeds have been consistently slow</p>
                </button>
              </div>

              <button
                onClick={() => setStep('active')}
                className="w-full px-4 py-3 rounded-lg font-medium transition-all border border-gray-300 hover:bg-gray-50"
                style={{ color: '#0f172a' }}
              >
                Back
              </button>
            </motion.div>
          )}

          {step === 'speed_q2_moved' && (
            <motion.div
              key="speed_q2_moved"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 sm:py-8"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f59e0b20' }}>
                  <svg className="w-8 h-8" style={{ color: '#f59e0b' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Device Location</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <p className="font-medium mb-1" style={{ color: '#0f172a' }}>Question 2 of 2</p>
                <p className="text-sm text-gray-600">Has the modem been moved to a new location recently?</p>
              </div>

              <div className="space-y-3 mb-6">
                <button
                  onClick={async () => {
                    setModemMoved(true);
                    const sessionId = await startSlowSpeedSession('just_started', true);
                    if (sessionId) {
                      setStep('speed_device_testing');
                    }
                  }}
                  className="w-full p-4 rounded-lg border border-gray-200 hover:border-primary hover:bg-gray-50 transition-all text-left"
                >
                  <p className="font-medium" style={{ color: '#0f172a' }}>Yes, it was moved</p>
                  <p className="text-sm text-gray-500">The modem is in a new location</p>
                </button>
                
                <button
                  onClick={async () => {
                    setModemMoved(false);
                    setIsSubmitting(true);
                    try {
                      const sessionId = await startSlowSpeedSession('just_started', false);
                      if (sessionId) {
                        if (slowSpeedEligibility?.canRefresh) {
                          const refreshSuccess = await startSlowSpeedRefresh(sessionId);
                          if (refreshSuccess) {
                            await suspendLine();
                            startSlowSpeedSuspendTimer();
                          } else {
                            setStep('speed_device_testing');
                          }
                        } else {
                          setStep('speed_device_testing');
                        }
                      }
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting}
                  className="w-full p-4 rounded-lg border border-gray-200 hover:border-primary hover:bg-gray-50 transition-all text-left disabled:opacity-50"
                >
                  <p className="font-medium" style={{ color: '#0f172a' }}>No, it's in the same spot</p>
                  <p className="text-sm text-gray-500">The modem hasn't been moved</p>
                  {isSubmitting && <span className="text-xs text-gray-400">Processing...</span>}
                </button>
              </div>

              {slowSpeedEligibility && !slowSpeedEligibility.canRefresh && slowSpeedEligibility.daysUntilNextRefresh > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-amber-700">
                    <strong>Note:</strong> A network refresh was performed recently. Another refresh will be available in {slowSpeedEligibility.daysUntilNextRefresh} days.
                  </p>
                </div>
              )}

              <button
                onClick={() => setStep('speed_q1_when')}
                className="w-full px-4 py-3 rounded-lg font-medium transition-all border border-gray-300 hover:bg-gray-50"
                style={{ color: '#0f172a' }}
              >
                Back
              </button>
            </motion.div>
          )}

          {step === 'speed_refresh_suspend' && (
            <motion.div
              key="speed_refresh_suspend"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 sm:py-8"
            >
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#3b82f620' }}>
                  <span className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{formatTime(timeRemaining)}</span>
                </div>
                <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Refreshing Network Connection</p>
                <p className="text-gray-500 mt-2">We're refreshing your network connection. This takes about 2 minutes.</p>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                <div 
                  className="h-2 rounded-full transition-all duration-1000" 
                  style={{ 
                    backgroundColor: '#3b82f6',
                    width: `${((120 - timeRemaining) / 120) * 100}%` 
                  }}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700">
                  <strong>Please wait.</strong> Do not unplug or restart your modem during this process.
                </p>
              </div>
            </motion.div>
          )}

          {step === 'speed_refresh_resume' && (
            <motion.div
              key="speed_refresh_resume"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 sm:py-8"
            >
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10a37f20' }}>
                  <span className="text-2xl font-bold" style={{ color: '#10a37f' }}>{formatTime(timeRemaining)}</span>
                </div>
                <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Restoring Connection</p>
                <p className="text-gray-500 mt-2">Your connection is being restored. Please wait while this completes.</p>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                <div 
                  className="h-2 rounded-full transition-all duration-1000" 
                  style={{ 
                    backgroundColor: '#10a37f',
                    width: `${((120 - timeRemaining) / 120) * 100}%` 
                  }}
                />
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-700">
                  <strong>Almost done!</strong> Your connection will be ready for the final step shortly.
                </p>
              </div>
            </motion.div>
          )}

          {step === 'speed_refresh_power_cycle' && (
            <motion.div
              key="speed_refresh_power_cycle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 sm:py-8"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10a37f20' }}>
                  <svg className="w-8 h-8" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Power Cycle Required</p>
                <p className="text-gray-500 mt-2">Please unplug your modem now</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 mb-6">
                <h4 className="font-semibold text-amber-800 mb-3">Follow these steps:</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-amber-700">
                  <li><strong>Unplug your modem</strong> from power now</li>
                  <li>Wait <strong>30 seconds</strong></li>
                  <li><strong>Plug the modem back in</strong></li>
                  <li>Wait 2-3 minutes for it to fully restart</li>
                </ol>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-700">
                  <strong>Important:</strong> Changes can take up to 2 hours to fully sync. If speeds don't improve immediately, please wait and try again later.
                </p>
              </div>

              <button
                onClick={() => {
                  if (slowSpeedSessionId) {
                    updateSlowSpeedSession(slowSpeedSessionId, { sessionState: 'syncing' });
                  }
                  setStep('speed_device_testing');
                }}
                className="w-full px-6 py-3 rounded-lg text-white font-medium transition-all hover:shadow-lg"
                style={{ backgroundColor: '#10a37f' }}
              >
                I've Completed the Power Cycle
              </button>
            </motion.div>
          )}

          {step === 'speed_device_testing' && (
            <motion.div
              key="speed_device_testing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 sm:py-8"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#3b82f620' }}>
                  <svg className="w-8 h-8" style={{ color: '#3b82f6' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Speed Optimization Steps</p>
                <p className="text-gray-500 mt-2">Try these steps to improve your speed</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
                <h4 className="font-semibold text-blue-800 mb-3">Complete these steps in order:</h4>
                <ol className="list-decimal list-inside space-y-3 text-sm text-blue-700">
                  <li>
                    <strong>Reboot the modem</strong>
                    <ul className="ml-5 mt-1 list-disc text-blue-600">
                      <li>Unplug power, wait 30 seconds, plug back in</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Reduce connected devices</strong>
                    <ul className="ml-5 mt-1 list-disc text-blue-600">
                      <li>Disconnect unused phones, TVs, cameras, or smart devices</li>
                      <li>Test speeds with only one device connected</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Move closer to the modem</strong>
                    <ul className="ml-5 mt-1 list-disc text-blue-600">
                      <li>Walls, floors, and distance reduce WiFi performance</li>
                      <li>Test speeds within 5-10 feet of the modem</li>
                    </ul>
                  </li>
                </ol>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setStep('speed_outdoor_test')}
                  className="flex-1 px-6 py-3 rounded-lg text-white font-medium transition-all hover:shadow-lg"
                  style={{ backgroundColor: '#10a37f' }}
                >
                  Continue to Signal Test
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 px-4 py-3 rounded-lg font-medium transition-all border border-gray-300 hover:bg-gray-50"
                  style={{ color: '#0f172a' }}
                >
                  Back to Dashboard
                </button>
              </div>
            </motion.div>
          )}

          {step === 'speed_outdoor_test' && (
            <motion.div
              key="speed_outdoor_test"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 sm:py-8"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10a37f20' }}>
                  <svg className="w-8 h-8" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Outdoor Signal Test</p>
                <p className="text-gray-500 mt-2">This is a critical step for wireless devices</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 mb-6">
                <h4 className="font-semibold text-amber-800 mb-3">Please do the following:</h4>
                <p className="text-sm text-amber-700 mb-3">
                  If possible, take the modem <strong>outside</strong> or place it <strong>near a window</strong> and test speeds again.
                </p>
                <p className="text-sm text-amber-600">
                  This helps us determine whether the issue is <strong>signal strength</strong> or <strong>network capacity</strong>.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <p className="font-medium mb-2" style={{ color: '#0f172a' }}>Did speeds improve when testing outside/near window?</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={async () => {
                    setOutdoorTestResult('improved');
                    if (slowSpeedSessionId) {
                      await updateSlowSpeedSession(slowSpeedSessionId, { 
                        outdoorTestResult: 'improved',
                        sessionState: 'completed'
                      });
                    }
                    setStep('speed_outdoor_result');
                  }}
                  className="w-full p-4 rounded-lg border-2 border-green-200 hover:border-green-400 hover:bg-green-50 transition-all text-left"
                >
                  <p className="font-medium text-green-700">Yes, speeds improved outside</p>
                </button>
                
                <button
                  onClick={async () => {
                    setOutdoorTestResult('same');
                    if (slowSpeedSessionId) {
                      await updateSlowSpeedSession(slowSpeedSessionId, { 
                        outdoorTestResult: 'same',
                        sessionState: 'completed'
                      });
                    }
                    setStep('speed_outdoor_result');
                  }}
                  className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all text-left"
                >
                  <p className="font-medium" style={{ color: '#0f172a' }}>No, speeds stayed the same</p>
                </button>

                <button
                  onClick={() => setStep('speed_device_testing')}
                  className="w-full px-4 py-3 rounded-lg font-medium transition-all border border-gray-300 hover:bg-gray-50"
                  style={{ color: '#0f172a' }}
                >
                  Back
                </button>
              </div>
            </motion.div>
          )}

          {step === 'speed_outdoor_result' && (
            <motion.div
              key="speed_outdoor_result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 sm:py-8"
            >
              {outdoorTestResult === 'improved' ? (
                <>
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10a37f20' }}>
                      <svg className="w-8 h-8" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Environmental Issue Identified</p>
                    <p className="text-gray-500 mt-2">The issue is related to placement or environment</p>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-5 mb-6">
                    <h4 className="font-semibold text-green-800 mb-3">Recommendations:</h4>
                    <ul className="space-y-2 text-sm text-green-700">
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span>Relocate the modem <strong>closer to a window</strong> or in a <strong>higher location</strong></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span>Avoid placing the modem in basements, closets, or behind thick walls</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span>Keep the modem away from other electronics that may cause interference</span>
                      </li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#6b728020' }}>
                      <svg className="w-8 h-8" style={{ color: '#6b7280' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Network Capacity Assessment</p>
                    <p className="text-gray-500 mt-2">This is likely the best available performance in your area</p>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-6">
                    <p className="text-sm text-gray-600">
                      When speeds are similar both indoors and outdoors, it typically indicates this is the maximum speed available from the network in your location. Speed can vary based on network congestion, time of day, and tower capacity.
                    </p>
                  </div>

                  <button
                    onClick={() => setStep('speed_escalate')}
                    className="w-full px-6 py-3 rounded-lg font-medium transition-all border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50 mb-3"
                    style={{ color: '#d97706' }}
                  >
                    Still Having Issues? Contact Support
                  </button>
                </>
              )}

              <button
                onClick={() => navigate('/dashboard')}
                className="w-full px-6 py-3 rounded-lg text-white font-medium transition-all hover:shadow-lg"
                style={{ backgroundColor: '#10a37f' }}
              >
                Back to Dashboard
              </button>
            </motion.div>
          )}

          {step === 'speed_escalate' && (
            <motion.div
              key="speed_escalate"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 sm:py-8"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#6366f120' }}>
                  <svg className="w-8 h-8" style={{ color: '#6366f1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Escalate to Support</p>
                <p className="text-gray-500 mt-2">We've completed all automated checks</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
                <p className="text-sm text-blue-700">
                  Our support team will review coverage and network conditions in your area. They will contact you with findings and any available solutions.
                </p>
              </div>

              <button
                onClick={async () => {
                  if (slowSpeedSessionId) {
                    await updateSlowSpeedSession(slowSpeedSessionId, { 
                      escalated: true,
                      sessionState: 'escalated'
                    });
                  }
                  setTroubleshootBranch('slow_speed');
                  setContactMethod(null);
                  setContactPhone('');
                  setPreferredCallTime('');
                  setTicketNotes('');
                  setTicketError('');
                  setStep('support_contact_form');
                }}
                className="w-full px-6 py-3 rounded-lg text-white font-medium transition-all hover:shadow-lg disabled:opacity-50 mb-3"
                style={{ backgroundColor: '#6366f1' }}
              >
                Contact Support
              </button>

              <button
                onClick={() => setStep('speed_outdoor_result')}
                className="w-full px-4 py-3 rounded-lg font-medium transition-all border border-gray-300 hover:bg-gray-50"
                style={{ color: '#0f172a' }}
              >
                Back
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
                      We found something that may be affecting your connection. We're correcting it now.<br/>
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
              <p className="text-xl font-bold mb-2" style={{ color: '#10a37f' }}>Your service looks good on our end</p>
              
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
                Would you like to contact our support team for help?
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-700">
                  Current line status: <span className="font-medium">{lineStatus || 'Unknown'}</span>
                </p>
              </div>

              {error && (
                <p className="text-red-500 text-sm mb-4">{error}</p>
              )}

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-6 py-3 rounded-lg font-medium transition-all border border-gray-300 hover:bg-gray-50"
                  style={{ color: '#0f172a' }}
                >
                  Back to Dashboard
                </button>
                <button
                  onClick={() => {
                    setTroubleshootBranch('no_internet');
                    setContactMethod(null);
                    setContactPhone('');
                    setPreferredCallTime('');
                    setTicketNotes('');
                    setTicketError('');
                    setStep('support_contact_form');
                  }}
                  className="px-6 py-3 rounded-lg text-white font-medium transition-all hover:shadow-lg"
                  style={{ backgroundColor: '#10a37f' }}
                >
                  Contact Support
                </button>
              </div>
            </motion.div>
          )}

          {step === 'escalation_pending' && (
            <motion.div
              key="escalation_pending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10a37f20' }}>
                <svg className="w-8 h-8" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Issue Already Escalated</p>
              <p className="text-gray-500 mt-2 mb-6">
                Your issue is being worked on. We apologize for the delay, but this will be sorted out within the next 24 hours.<br/>
                We will notify you via email once resolved.
              </p>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-green-700">
                  Ticket ID: <span className="font-medium font-mono">{escalationTicketId || escalationInfo?.ticketId}</span>
                </p>
                {escalationInfo?.hoursRemaining && escalationInfo.hoursRemaining > 0 && (
                  <p className="text-sm text-green-600 mt-1">
                    You can escalate again in {escalationInfo.hoursRemaining} hour{escalationInfo.hoursRemaining !== 1 ? 's' : ''} if needed.
                  </p>
                )}
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-6 py-3 rounded-lg text-white font-medium transition-all hover:shadow-lg"
                  style={{ backgroundColor: '#10a37f' }}
                >
                  Back to Dashboard
                </button>
                <a
                  href="tel:+18447677770"
                  className="px-6 py-3 rounded-lg font-medium transition-all border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
                  style={{ color: '#0f172a' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call Support
                </a>
              </div>
            </motion.div>
          )}

          {step === 'escalation_submitted' && (
            <motion.div
              key="escalation_submitted"
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
              <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Escalation Submitted</p>
              <p className="text-gray-500 mt-2 mb-6">
                Your issue has been escalated to our support team. We apologize for the inconvenience.<br/>
                This will be sorted out within the next 24 hours and we will notify you via email.
              </p>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-green-700">
                  Ticket ID: <span className="font-medium font-mono">{escalationTicketId}</span>
                </p>
                <p className="text-sm text-green-600 mt-1">
                  Please save this ticket ID for your reference.
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

          {step === 'support_contact_form' && (
            <motion.div
              key="support_contact_form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 sm:py-8"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#6366f120' }}>
                  <svg className="w-8 h-8" style={{ color: '#6366f1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Contact Support</p>
                <p className="text-gray-500 mt-2">Tell us how you'd like to be reached and describe your issue</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">How would you like to be contacted?</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setContactMethod('email')}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all font-medium text-sm ${
                        contactMethod === 'email'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email
                    </button>
                    <button
                      onClick={() => setContactMethod('phone')}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all font-medium text-sm ${
                        contactMethod === 'phone'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Phone Call
                    </button>
                  </div>
                </div>

                {contactMethod === 'phone' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                      <input
                        type="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Preferred Time to Call</label>
                      <select
                        value={preferredCallTime}
                        onChange={(e) => setPreferredCallTime(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
                      >
                        <option value="">Select a time window...</option>
                        <option value="Morning (8AM - 12PM CST)">Morning (8AM - 12PM CST)</option>
                        <option value="Afternoon (12PM - 4PM CST)">Afternoon (12PM - 4PM CST)</option>
                        <option value="Evening (4PM - 7PM CST)">Evening (4PM - 7PM CST)</option>
                        <option value="Anytime during business hours">Anytime during business hours</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Describe Your Issue</label>
                  <textarea
                    value={ticketNotes}
                    onChange={(e) => setTicketNotes(e.target.value)}
                    placeholder="Please describe the issue you're experiencing in detail. Include any error messages, when the issue started, and what you've already tried..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">{ticketNotes.length < 10 ? `At least ${10 - ticketNotes.length} more characters needed` : 'Looks good!'}</p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-gray-500">
                      A support ticket will be created and assigned to our Tier 1 Support team. We'll reach out to you using your preferred contact method within 24 hours.
                    </p>
                  </div>
                </div>

                {ticketError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm text-red-700">{ticketError}</p>
                  </div>
                )}

                <button
                  onClick={() => submitTroubleshootingTicket()}
                  disabled={ticketSubmitting || !contactMethod || ticketNotes.trim().length < 10 || (contactMethod === 'phone' && !contactPhone)}
                  className="w-full px-6 py-3 rounded-xl text-white font-medium transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#6366f1' }}
                >
                  {ticketSubmitting ? 'Submitting...' : 'Submit Support Ticket'}
                </button>

                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full px-4 py-3 rounded-xl font-medium transition-all border border-gray-300 hover:bg-gray-50 text-sm"
                  style={{ color: '#0f172a' }}
                >
                  Back to Dashboard
                </button>
              </div>
            </motion.div>
          )}

          {step === 'support_ticket_submitted' && (
            <motion.div
              key="support_ticket_submitted"
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
              <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Support Ticket Created</p>
              <p className="text-gray-500 mt-2 mb-6">
                Your support request has been submitted to our Tier 1 Support team.<br/>
                We'll contact you via {contactMethod === 'phone' ? 'phone' : 'email'}{preferredCallTime ? ` during ${preferredCallTime}` : ''} within 24 hours.
              </p>

              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-green-700">
                  Ticket ID: <span className="font-medium font-mono">{supportTicketId}</span>
                </p>
                <p className="text-sm text-green-600 mt-1">
                  Please save this ticket ID for your reference.
                </p>
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-6 py-3 rounded-xl text-white font-medium transition-all hover:shadow-lg"
                  style={{ backgroundColor: '#10a37f' }}
                >
                  Back to Dashboard
                </button>
                <a
                  href="tel:+18447677770"
                  className="px-6 py-3 rounded-xl font-medium transition-all border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
                  style={{ color: '#0f172a' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call Support
                </a>
              </div>
            </motion.div>
          )}

          {step === 'no_line' && (
            <motion.div
              key="no_line"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#10a37f20' }}>
                <svg className="w-8 h-8" style={{ color: '#10a37f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Activating Your Line</p>
              <p className="text-gray-500 mt-2 mb-6">
                Your internet line needs to be activated. This process typically takes 20-30 minutes.<br/>
                We'll send you an email once your issue is sorted out.
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 text-left">
                <p className="text-sm text-gray-600 mb-2">We will send notification to:</p>
                <p className="font-medium" style={{ color: '#0f172a' }}>{customerEmail || 'Loading...'}</p>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-2">If you'd like us to notify you on a different email:</p>
                <input
                  type="email"
                  value={alternateEmail}
                  onChange={(e) => setAlternateEmail(e.target.value)}
                  placeholder="Enter different email (optional)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={() => submitActivateLine(alternateEmail || undefined)}
                disabled={isSubmitting}
                className="w-full px-6 py-3 rounded-lg text-white font-medium transition-all hover:shadow-lg disabled:opacity-50"
                style={{ backgroundColor: '#10a37f' }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>

              {error && (
                <p className="text-red-500 text-sm mt-4">{error}</p>
              )}
            </motion.div>
          )}

          {step === 'no_line_submitted' && (
            <motion.div
              key="no_line_submitted"
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
              <p className="text-lg font-medium" style={{ color: '#0f172a' }}>Request Submitted</p>
              <p className="text-gray-500 mt-2 mb-6">
                Your line activation request has been submitted. This process typically takes 20-30 minutes.<br/>
                We'll send you an email at <span className="font-medium">{customerEmail}</span> once your issue is sorted out.
              </p>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-green-700">
                  You don't need to stay on this page. We'll notify you by email when your internet is ready.
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
