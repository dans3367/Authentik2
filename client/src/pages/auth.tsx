import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth, useLogin, useRegister } from "@/hooks/useAuth";
import { loginSchema, registerSchema, forgotPasswordSchema } from "@shared/schema";
import type { LoginCredentials, RegisterData, ForgotPasswordData } from "@shared/schema";
import { calculatePasswordStrength, getPasswordStrengthText } from "@/lib/authUtils";
import { Eye, EyeOff, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AuthView = "login" | "register" | "forgot" | "twoFactor";

export default function AuthPage() {
  // Derive initial view from URL hash so the tab persists across browser tab switches
  const getInitialView = (): AuthView => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'register' || hash === 'login' || hash === 'forgot') return hash;
    return 'login';
  };
  const [currentView, setCurrentView] = useState<AuthView>(getInitialView);

  // Force dark theme on auth page for the obsidian aesthetic
  useEffect(() => {
    const root = document.documentElement;
    const originalTheme = localStorage.getItem('theme');
    root.classList.remove('light');
    root.classList.add('dark');

    return () => {
      if (originalTheme === 'light' || !originalTheme) {
        root.classList.remove('dark');
        root.classList.add('light');
      }
    };
  }, []);

  // Load brand typeface
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@1,6..96,400&display=swap';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  // Sync URL hash when view changes
  useEffect(() => {
    if (currentView === 'twoFactor') return;
    const newHash = currentView === 'login' ? '' : `#${currentView}`;
    if (window.location.hash !== (newHash || '#')) {
      window.history.replaceState(null, '', newHash || window.location.pathname + window.location.search);
    }
  }, [currentView]);

  // Listen for hash changes (e.g. browser back/forward)
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'register' || hash === 'login' || hash === 'forgot') {
        setCurrentView(hash);
      } else {
        setCurrentView('login');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Persist register form data in sessionStorage so it survives browser tab switches
  const REGISTER_STORAGE_KEY = 'auth_register_form';

  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [rememberMe, setRememberMe] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState<{
    tempSessionToken: string;
  } | null>(null);
  const [is2FAVerifying, setIs2FAVerifying] = useState(false);
  const [is2FAStatusChecking, setIs2FAStatusChecking] = useState(false);

  const { isAuthenticated } = useAuth();
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const { toast } = useToast();

  const isLoginLoading = loginMutation.isPending || false;
  const isRegisterLoading = false;

  // Handle login form submission
  const onLoginSubmit = async (data: LoginCredentials) => {
    try {
      setIs2FAStatusChecking(true);

      const check2FAResponse = await fetch('/api/auth/check-2fa-requirement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: data.email,
          password: data.password
        })
      });

      if (!check2FAResponse.ok) {
        let errorMessage = 'Login failed';
        try {
          const error = await check2FAResponse.json();
          errorMessage = error.message || errorMessage;
        } catch (parseError) {
          errorMessage = `Login failed with status ${check2FAResponse.status}`;
        }
        throw new Error(errorMessage);
      }

      const check2FAResult = await check2FAResponse.json();

      if (check2FAResult.requires2FA) {
        setTwoFactorData({
          tempSessionToken: check2FAResult.tempSessionToken
        });
        setCurrentView("twoFactor");
      } else {
        toast({
          title: "Login Successful",
          description: "Welcome back! Redirecting to dashboard...",
        });

        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 300);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Login Failed",
        description: error.message || "Login failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIs2FAStatusChecking(false);
    }
  };

  const forgotPasswordMutation = {
    mutateAsync: async (data: ForgotPasswordData) => {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    isPending: false
  };

  const loginForm = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const getSavedRegisterData = (): Partial<RegisterData> => {
    try {
      const saved = sessionStorage.getItem(REGISTER_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  };
  const savedRegister = getSavedRegisterData();

  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: savedRegister.email || "",
      password: savedRegister.password || "",
      firstName: savedRegister.firstName || "",
      lastName: savedRegister.lastName || "",
      confirmPassword: savedRegister.confirmPassword || "",
      companyName: savedRegister.companyName || "",
    },
  });

  const handleRegister = async (data: RegisterData) => {
    try {
      await registerMutation.mutateAsync(data);
      sessionStorage.removeItem(REGISTER_STORAGE_KEY);
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  const forgotForm = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const twoFactorForm = useForm<{ token: string }>({
    defaultValues: {
      token: "",
    },
  });

  const watchAllRegister = registerForm.watch();
  useEffect(() => {
    try {
      // Never persist password material to sessionStorage — any XSS or
      // extension with page access could read it. Only non-secret fields
      // need to survive a tab switch.
      const { password, confirmPassword, ...safeToPersist } = watchAllRegister;
      sessionStorage.setItem(REGISTER_STORAGE_KEY, JSON.stringify(safeToPersist));
    } catch {}
  }, [watchAllRegister]);

  const watchPassword = registerForm.watch("password");

  useEffect(() => {
    if (watchPassword) {
      setPasswordStrength(calculatePasswordStrength(watchPassword));
    }
  }, [watchPassword]);

  const onRegister = async (data: RegisterData) => {
    const result = await registerMutation.mutateAsync(data);
    if (result) {
      sessionStorage.removeItem(REGISTER_STORAGE_KEY);
      setCurrentView("login");
      loginForm.setValue("email", data.email);
    }
  };

  const onForgotPassword = async (data: ForgotPasswordData) => {
    await forgotPasswordMutation.mutateAsync(data);
  };

  const onTwoFactorSubmit = async (data: { token: string }) => {
    if (!twoFactorData || is2FAVerifying) return;

    setIs2FAVerifying(true);
    twoFactorForm.clearErrors();

    try {
      const response = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          token: data.token,
          tempSessionToken: twoFactorData.tempSessionToken,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Invalid 2FA code';
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch (parseError) {
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch (textError) {
            errorMessage = `2FA verification failed with status ${response.status}`;
          }
        }
        throw new Error(errorMessage);
      }

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        throw new Error('Invalid response format from server');
      }
      if (result.success && result.verified) {
        toast({
          title: "2FA Verified",
          description: "Two-factor authentication successful! Redirecting to dashboard...",
        });

        setTwoFactorData(null);
        twoFactorForm.reset();

        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 500);
      } else {
        throw new Error('Invalid 2FA code');
      }
    } catch (error: any) {
      console.error('2FA verification error:', error);
      twoFactorForm.setError('token', {
        type: 'manual',
        message: error.message || 'Invalid verification code'
      });
    } finally {
      setIs2FAVerifying(false);
    }
  };

  const strengthColors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
  const strengthColor = strengthColors[Math.max(0, passwordStrength - 1)] || '#ef4444';

  const renderPasswordStrength = () => (
    <div className="mt-3">
      <div className="auth-strength-bar">
        <div
          className="auth-strength-fill"
          style={{
            width: `${(passwordStrength / 4) * 100}%`,
            backgroundColor: strengthColor,
          }}
        />
      </div>
      <p className="text-xs mt-1.5 transition-colors duration-300" style={{ color: strengthColor }}>
        {getPasswordStrengthText(passwordStrength)}
      </p>
    </div>
  );

  // Shared input className for consistent dark styling
  const inputCx = "bg-white/[0.04] border-white/[0.08] text-white/90 placeholder:text-white/25 h-11";

  return (
    <div className="auth-page auth-grain min-h-screen flex items-center justify-center relative overflow-hidden"
         style={{ background: '#08080a' }}>

      {/* ── Ambient gradient orbs ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="auth-orb-1 absolute rounded-full"
          style={{
            width: 650, height: 650,
            top: '-12%', right: '-8%',
            background: 'radial-gradient(circle, rgba(201,149,107,0.18) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="auth-orb-2 absolute rounded-full"
          style={{
            width: 500, height: 500,
            bottom: '-18%', left: '-6%',
            background: 'radial-gradient(circle, rgba(168,120,90,0.12) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="auth-orb-3 absolute rounded-full"
          style={{
            width: 300, height: 300,
            top: '40%', left: '50%',
            background: 'radial-gradient(circle, rgba(201,149,107,0.06) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 w-full max-w-[440px] mx-auto px-6 py-12">

        {/* Brand */}
        <div className="auth-enter text-center mb-10" style={{ animationDelay: '0ms' }}>
          <h1
            className="text-[44px] text-white/90 tracking-tight leading-none select-none"
            style={{ fontFamily: "'Bodoni Moda', serif", fontStyle: 'italic' }}
          >
            Authentik
          </h1>
          <div className="flex items-center justify-center gap-4 mt-3">
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-[#c9956b]/30" />
            <p className="text-[10px] text-white/25 tracking-[0.3em] uppercase font-medium">
              Secure Platform
            </p>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-[#c9956b]/30" />
          </div>
        </div>

        {/* Card */}
        <div
          className="auth-enter auth-glass rounded-2xl"
          style={{ animationDelay: '80ms' }}
        >
          {/* ── Tab Navigation ── */}
          {currentView !== "forgot" && currentView !== "twoFactor" && (
            <div className="flex border-b border-white/[0.06] px-8 pt-2">
              <button
                className={`auth-tab flex-1 py-3.5 text-sm font-medium tracking-wide ${
                  currentView === "login"
                    ? "auth-tab-active text-white/90"
                    : "text-white/35 hover:text-white/55"
                }`}
                onClick={() => setCurrentView("login")}
              >
                Sign In
              </button>
              <button
                className={`auth-tab flex-1 py-3.5 text-sm font-medium tracking-wide ${
                  currentView === "register"
                    ? "auth-tab-active text-white/90"
                    : "text-white/35 hover:text-white/55"
                }`}
                onClick={() => setCurrentView("register")}
              >
                Create Account
              </button>
            </div>
          )}

          <div className="p-8">
            {/* ══════════════ LOGIN ══════════════ */}
            {currentView === "login" && (
              <div className="auth-enter" style={{ animationDelay: '150ms' }}>
                <div className="mb-7">
                  <h2 className="text-xl font-semibold text-white/90 mb-1.5">Welcome back</h2>
                  <p className="text-sm text-white/35">Sign in to continue to your dashboard</p>
                </div>

                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-5">
                  <div>
                    <Label htmlFor="email" className="text-white/50 text-xs font-medium tracking-wide uppercase">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      className={`mt-2 ${inputCx}`}
                      {...loginForm.register("email")}
                    />
                    {loginForm.formState.errors.email && (
                      <p className="text-red-400 text-xs mt-1.5">
                        {loginForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="password" className="text-white/50 text-xs font-medium tracking-wide uppercase">
                      Password
                    </Label>
                    <div className="relative mt-2">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        className={`pr-11 ${inputCx}`}
                        {...loginForm.register("password")}
                      />
                      <button
                        type="button"
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-red-400 text-xs mt-1.5">
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked === true)}
                        className="border-white/15 data-[state=checked]:bg-[#c9956b] data-[state=checked]:border-[#c9956b]"
                      />
                      <Label htmlFor="remember" className="text-sm text-white/35 cursor-pointer">
                        Remember me
                      </Label>
                    </div>
                    <button
                      type="button"
                      className="text-sm text-[#c9956b]/80 hover:text-[#c9956b] transition-colors font-medium"
                      onClick={() => setCurrentView("forgot")}
                    >
                      Forgot password?
                    </button>
                  </div>

                  <Button
                    type="submit"
                    className="auth-btn-primary w-full h-11 mt-2 text-sm"
                    disabled={isLoginLoading || is2FAStatusChecking}
                  >
                    {isLoginLoading || is2FAStatusChecking ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {is2FAStatusChecking ? "Verifying..." : "Signing in..."}
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </div>
            )}

            {/* ══════════════ REGISTER ══════════════ */}
            {currentView === "register" && (
              <div className="auth-enter" style={{ animationDelay: '150ms' }}>
                <div className="mb-7">
                  <h2 className="text-xl font-semibold text-white/90 mb-1.5">Get started</h2>
                  <p className="text-sm text-white/35">Create your account in seconds</p>
                </div>

                <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="firstName" className="text-white/50 text-xs font-medium tracking-wide uppercase">
                        First name
                      </Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        className={`mt-2 ${inputCx}`}
                        {...registerForm.register("firstName")}
                      />
                      {registerForm.formState.errors.firstName && (
                        <p className="text-red-400 text-xs mt-1">
                          {registerForm.formState.errors.firstName.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="lastName" className="text-white/50 text-xs font-medium tracking-wide uppercase">
                        Last name
                      </Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        className={`mt-2 ${inputCx}`}
                        {...registerForm.register("lastName")}
                      />
                      {registerForm.formState.errors.lastName && (
                        <p className="text-red-400 text-xs mt-1">
                          {registerForm.formState.errors.lastName.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="companyName" className="text-white/50 text-xs font-medium tracking-wide uppercase">
                      Company
                    </Label>
                    <Input
                      id="companyName"
                      placeholder="Acme Inc."
                      className={`mt-2 ${inputCx}`}
                      {...registerForm.register("companyName")}
                    />
                    {registerForm.formState.errors.companyName && (
                      <p className="text-red-400 text-xs mt-1">
                        {registerForm.formState.errors.companyName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="registerEmail" className="text-white/50 text-xs font-medium tracking-wide uppercase">
                      Email
                    </Label>
                    <Input
                      id="registerEmail"
                      type="email"
                      placeholder="john@company.com"
                      className={`mt-2 ${inputCx}`}
                      {...registerForm.register("email")}
                    />
                    {registerForm.formState.errors.email && (
                      <p className="text-red-400 text-xs mt-1">
                        {registerForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="registerPassword" className="text-white/50 text-xs font-medium tracking-wide uppercase">
                      Password
                    </Label>
                    <div className="relative mt-2">
                      <Input
                        id="registerPassword"
                        type={showRegisterPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        className={`pr-11 ${inputCx}`}
                        {...registerForm.register("password")}
                      />
                      <button
                        type="button"
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
                        onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      >
                        {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {registerForm.formState.errors.password && (
                      <p className="text-red-400 text-xs mt-1">
                        {registerForm.formState.errors.password.message}
                      </p>
                    )}
                    {watchPassword && renderPasswordStrength()}
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword" className="text-white/50 text-xs font-medium tracking-wide uppercase">
                      Confirm password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm your password"
                      className={`mt-2 ${inputCx}`}
                      {...registerForm.register("confirmPassword")}
                    />
                    {registerForm.formState.errors.confirmPassword && (
                      <p className="text-red-400 text-xs mt-1">
                        {registerForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-start space-x-3 pt-1">
                    <Checkbox
                      id="terms"
                      required
                      className="mt-0.5 border-white/15 data-[state=checked]:bg-[#c9956b] data-[state=checked]:border-[#c9956b]"
                    />
                    <Label htmlFor="terms" className="text-sm text-white/35 leading-relaxed cursor-pointer">
                      I agree to the{" "}
                      <a href="#" className="text-[#c9956b]/80 hover:text-[#c9956b] transition-colors">
                        Terms of Service
                      </a>{" "}
                      and{" "}
                      <a href="#" className="text-[#c9956b]/80 hover:text-[#c9956b] transition-colors">
                        Privacy Policy
                      </a>
                    </Label>
                  </div>

                  <Button
                    type="submit"
                    className="auth-btn-primary w-full h-11 mt-2 text-sm"
                    disabled={isRegisterLoading}
                  >
                    {isRegisterLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              </div>
            )}

            {/* ══════════════ FORGOT PASSWORD ══════════════ */}
            {currentView === "forgot" && (
              <div className="auth-enter" style={{ animationDelay: '150ms' }}>
                <div className="mb-7">
                  <button
                    className="flex items-center text-white/35 hover:text-white/60 transition-colors mb-5 text-sm"
                    onClick={() => setCurrentView("login")}
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                    Back to sign in
                  </button>
                  <h2 className="text-xl font-semibold text-white/90 mb-1.5">Reset password</h2>
                  <p className="text-sm text-white/35">We'll send you a link to reset your password</p>
                </div>

                <form onSubmit={forgotForm.handleSubmit(onForgotPassword)} className="space-y-5">
                  <div>
                    <Label htmlFor="resetEmail" className="text-white/50 text-xs font-medium tracking-wide uppercase">
                      Email address
                    </Label>
                    <Input
                      id="resetEmail"
                      type="email"
                      placeholder="you@company.com"
                      className={`mt-2 ${inputCx}`}
                      {...forgotForm.register("email")}
                    />
                    {forgotForm.formState.errors.email && (
                      <p className="text-red-400 text-xs mt-1.5">
                        {forgotForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="auth-btn-primary w-full h-11 text-sm"
                    disabled={forgotPasswordMutation.isPending}
                  >
                    {forgotPasswordMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </form>
              </div>
            )}

            {/* ══════════════ TWO-FACTOR ══════════════ */}
            {currentView === "twoFactor" && (
              <div className="auth-enter" style={{ animationDelay: '150ms' }}>
                <div className="mb-7">
                  <button
                    onClick={() => {
                      setCurrentView("login");
                      setTwoFactorData(null);
                    }}
                    className="flex items-center text-white/35 hover:text-white/60 transition-colors mb-5 text-sm"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                    Back to login
                  </button>
                  <h2 className="text-xl font-semibold text-white/90 mb-1.5">Two-factor authentication</h2>
                  <p className="text-sm text-white/35">Enter the 6-digit code from your authenticator app</p>
                </div>

                <form onSubmit={twoFactorForm.handleSubmit(onTwoFactorSubmit)} className="space-y-6">
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={twoFactorForm.watch("token")}
                      onChange={(value) => twoFactorForm.setValue("token", value)}
                      disabled={is2FAVerifying}
                    >
                      <InputOTPGroup className="gap-2">
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="auth-otp-slot"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {twoFactorForm.formState.errors.token && (
                    <p className="text-red-400 text-xs text-center">
                      {twoFactorForm.formState.errors.token.message}
                    </p>
                  )}

                  <Alert className="bg-white/[0.03] border-white/[0.06] text-white/50">
                    <ShieldCheck className="h-4 w-4 text-[#c9956b]/60" />
                    <AlertDescription className="text-white/40 text-sm">
                      Open your authenticator app and enter the 6-digit code for Authentik.
                    </AlertDescription>
                  </Alert>

                  <Button
                    type="submit"
                    className="auth-btn-primary w-full h-11 text-sm"
                    disabled={is2FAVerifying}
                  >
                    {is2FAVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify & Sign In"
                    )}
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="auth-enter text-center mt-8"
          style={{ animationDelay: '200ms' }}
        >
          <p className="text-[11px] text-white/15 tracking-wide">
            Protected by enterprise-grade encryption
          </p>
        </div>
      </div>
    </div>
  );
}
