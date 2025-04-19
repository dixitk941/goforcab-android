import React, { useState, useEffect, useRef } from 'react';
import { 
  signInWithPhoneNumber,
  RecaptchaVerifier,
  onAuthStateChanged,
  updatePassword
} from 'firebase/auth';
import { auth } from '../firebase';

function LoginForm({ onLoginSuccess, onClose }) {
  // State management
  const [step, setStep] = useState('phone'); // Changed initial step to 'phone'
  const [phoneNumber, setPhoneNumber] = useState(''); 
  const [countryCode, setCountryCode] = useState('+91');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState(Array(6).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [user, setUser] = useState(null);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const recaptchaVerifier = useRef(null);
  const otpInputRefs = useRef([]);

  // Initialize reCAPTCHA and authentication state
  useEffect(() => {
    // Initialize reCAPTCHA verifier
    recaptchaVerifier.current = new RecaptchaVerifier(
      auth,
      'recaptcha-container',
      {
        size: 'invisible',
        callback: (response) => {
          console.log('reCAPTCHA verification successful');
        },
        'expired-callback': () => {
          setError('reCAPTCHA has expired. Please try again.');
        }
      }
    );

    // Authentication state observer
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        if (onLoginSuccess) onLoginSuccess(currentUser);
        // Check if it's a new user (first login)
        if (currentUser.metadata.creationTime === currentUser.metadata.lastSignInTime) {
          setStep('setPassword');
        }
      }
    });

    // Initialize countdown timer
    let interval = null;
    if (countdown > 0) {
      interval = setInterval(() => setCountdown(prev => prev - 1), 1000);
    }

    // Initialize OTP input refs
    otpInputRefs.current = Array(6).fill().map((_, i) => document.getElementById(`otp-${i}`));

    return () => {
      unsubscribe();
      clearInterval(interval);
      if (recaptchaVerifier.current) {
        recaptchaVerifier.current.clear();
        recaptchaVerifier.current = null;
      }
    };
  }, [countdown, onLoginSuccess]);

  // Handle auth errors
  const handleAuthError = (error) => {
    console.error("Authentication error:", error);
    setError(error.message || 'An error occurred during authentication');
  };

  // Send OTP to phone number
  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (phoneNumber.length !== 10) return setError('Please enter a valid 10-digit phone number');

    setLoading(true);
    try {
      const formattedPhone = `${countryCode}${phoneNumber}`; // Format phone number
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier.current);
      setConfirmationResult(confirmation);
      setStep('otp'); // Move to OTP verification step
      setCountdown(30); // Set 30-second countdown for OTP resend
    } catch (error) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP code
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!confirmationResult) return setError('Please send OTP first');
    if (otp.join('').length !== 6) return setError('Please enter a valid 6-digit OTP');

    setLoading(true);
    try {
      const code = otp.join('');
      await confirmationResult.confirm(code);
      // Authentication state observer will handle successful login
    } catch (error) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  // Set new password for first-time users
  const handlePasswordChange = async () => {
    if (password !== confirmPassword) return setError('Passwords do not match');
    if (password.length < 6) return setError('Password must be at least 6 characters long');

    setLoading(true);
    try {
      await updatePassword(user, password);
      alert('Password updated successfully!');
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (error) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input focus shifting
  const handleOtpInput = (index, value) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      otpInputRefs.current[index + 1].focus();
    }
  };

  // Handle OTP input backspace
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && index > 0 && !otp[index]) {
      otpInputRefs.current[index - 1].focus();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* reCAPTCHA container */}
      <div id="recaptcha-container"></div>

      {/* Phone number input screen */}
      {step === 'phone' && (
        <div className="bg-white rounded-2xl shadow-xl">
          <div className="bg-gradient-to-r from-[#100F0F] to-[#363434] p-6 text-white">
            <h2 className="text-2xl font-bold text-center">Welcome to GoYoCab</h2>
          </div>
          
          <form onSubmit={handleSendOTP} className="p-6 space-y-4">
            <div className="flex">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="p-3 border border-gray-300 rounded-l-lg bg-gray-50 w-20"
              >
                <option value="+91">+91</option>
                <option value="+1">+1</option>
                <option value="+44">+44</option>
              </select>
              <input
                type="tel"
                placeholder="Phone number (10 digits)"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                className="w-full p-3 border border-gray-300 rounded-r-lg"
                maxLength={10}
              />
            </div>

            {error && <div className="text-red-600 p-2 bg-red-50 rounded-lg text-sm">{error}</div>}

            <button
              type="submit"
              className="w-full p-3 bg-[#0BFE80] text-black rounded-lg hover:bg-[#04c666] font-medium"
              disabled={loading || phoneNumber.length !== 10}
            >
              {loading ? 'Sending OTP...' : 'Continue with Phone'}
            </button>
          </form>
        </div>
      )}

      {/* OTP verification screen */}
      {step === 'otp' && (
        <div className="bg-white rounded-2xl shadow-xl">
          <div className="bg-gradient-to-r from-[#100F0F] to-[#363434] p-6 text-white">
            <h2 className="text-2xl font-bold text-center">Verification Code</h2>
          </div>
          
          <div className="p-6">
            <p className="text-gray-600 mb-6 text-center">We've sent a code to {countryCode} {phoneNumber}</p>

            <form onSubmit={handleVerifyOTP} className="space-y-6">
              {/* OTP input fields with automatic focus shifting */}
              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={otp[index]}
                    onChange={(e) => handleOtpInput(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    ref={(el) => (otpInputRefs.current[index] = el)}
                    className="w-12 h-12 text-center border border-gray-300 rounded-lg text-lg focus:border-[#0BFE80] focus:ring-1 focus:ring-[#0BFE80] focus:outline-none"
                  />
                ))}
              </div>

              {error && <div className="text-red-600 p-2 bg-red-50 rounded-lg text-sm">{error}</div>}

              <button
                type="submit"
                className="w-full p-3 bg-[#0BFE80] text-black rounded-lg hover:bg-[#04c666] font-medium"
                disabled={loading || otp.join('').length !== 6}
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>

              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-gray-600">
                    Resend code in <span className="font-medium">{countdown}</span> seconds
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    className="text-[#0BFE80] hover:underline font-medium"
                  >
                    Resend Code
                  </button>
                )}
              </div>
              
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
                    setError('');
                  }}
                  className="text-gray-600 hover:text-gray-800"
                >
                  Change Phone Number
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set new password screen */}
      {step === 'setPassword' && (
        <div className="bg-white rounded-2xl shadow-xl">
          <div className="bg-gradient-to-r from-[#100F0F] to-[#363434] p-6 text-white">
            <h2 className="text-2xl font-bold text-center">Almost Done!</h2>
          </div>
          
          <div className="p-6">
            <p className="text-gray-600 mb-4">For added security, please set a password for your account.</p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              handlePasswordChange();
            }} className="space-y-4">
              <div>
                <input
                  type="password"
                  placeholder="Create password"
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              
              <div>
                <input
                  type="password"
                  placeholder="Confirm password"
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              
              {error && <div className="text-red-600 p-2 bg-red-50 rounded-lg text-sm">{error}</div>}
              
              <button
                type="submit"
                className="w-full p-3 bg-[#0BFE80] text-black rounded-lg hover:bg-[#04c666] font-medium"
                disabled={loading || !password || password !== confirmPassword}
              >
                {loading ? 'Setting Up...' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginForm;