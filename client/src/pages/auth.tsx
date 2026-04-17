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
import { Eye, EyeOff, ArrowLeft, Loader2, ShieldCheck, KeyRound } from "lucide-react";
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
    rememberMe: boolean;
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
          password: data.password,
          rememberMe
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
          tempSessionToken: check2FAResult.tempSessionToken,
          rememberMe,
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
          rememberMe: twoFactorData.rememberMe,
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

  // Strength bar color map — Tailwind JIT needs literal classes.
  const strengthFillClass =
    passwordStrength >= 4
      ? 'bg-emerald-500'
      : passwordStrength === 3
      ? 'bg-lime-500'
      : passwordStrength === 2
      ? 'bg-amber-500'
      : 'bg-red-500';

  const strengthTextClass =
    passwordStrength >= 4
      ? 'text-emerald-600 dark:text-emerald-400'
      : passwordStrength === 3
      ? 'text-lime-600 dark:text-lime-400'
      : passwordStrength === 2
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';

  const renderPasswordStrength = () => (
    <div className="mt-2">
      <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${strengthFillClass}`}
          style={{ width: `${(passwordStrength / 4) * 100}%` }}
        />
      </div>
      <p className={`text-xs mt-1 font-medium transition-colors duration-300 ${strengthTextClass}`}>
        {getPasswordStrengthText(passwordStrength)}
      </p>
    </div>
  );

  // Consistent sizing for all form inputs on this page.
  const inputCx = 'h-11';

  // Segmented tab buttons for Sign In / Create Account — uses the same
  // pill-over-soft-bg language as the newsletter tab bar.
  const segClass = (active: boolean) =>
    `flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
      active
        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Decorative background orbs — blue/indigo/purple palette to match
          the rest of the project's accent language. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 w-[28rem] h-[28rem] rounded-full bg-gradient-to-br from-blue-400/25 to-indigo-400/20 dark:from-blue-500/15 dark:to-indigo-500/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/15 dark:from-purple-500/12 dark:to-pink-500/8 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-[440px]">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 shadow-lg shadow-blue-500/25 dark:shadow-blue-500/15 mb-4">
            <ShieldCheck className="w-7 h-7 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            Authentik
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Secure platform for modern teams
          </p>
        </div>

        {/* Card */}
        <div className="relative bg-white dark:bg-gray-900 border border-gray-200/60 dark:border-gray-700/40 rounded-2xl shadow-xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

          {/* Segmented Sign In / Create Account switch */}
          {currentView !== "forgot" && currentView !== "twoFactor" && (
            <div className="px-6 sm:px-8 pt-6">
              <div className="inline-flex w-full p-1 bg-gray-100 dark:bg-gray-800/60 rounded-lg border border-gray-200/60 dark:border-gray-700/40">
                <button
                  type="button"
                  onClick={() => setCurrentView("login")}
                  className={segClass(currentView === "login")}
                  data-testid="tab-login"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView("register")}
                  className={segClass(currentView === "register")}
                  data-testid="tab-register"
                >
                  Create Account
                </button>
              </div>
            </div>
          )}

          <div className="p-6 sm:p-8">
            {/* ══════════════ LOGIN ══════════════ */}
            {currentView === "login" && (
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Welcome back</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sign in to continue to your dashboard</p>
                </div>

                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="email" className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      className={`mt-1.5 ${inputCx}`}
                      {...loginForm.register("email")}
                    />
                    {loginForm.formState.errors.email && (
                      <p className="text-red-500 dark:text-red-400 text-xs mt-1.5">
                        {loginForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="password" className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Password
                    </Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        className={`${inputCx} pr-11`}
                        {...loginForm.register("password")}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-red-500 dark:text-red-400 text-xs mt-1.5">
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked === true)}
                      />
                      <Label htmlFor="remember" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                        Remember me
                      </Label>
                    </div>
                    <button
                      type="button"
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      onClick={() => setCurrentView("forgot")}
                    >
                      Forgot password?
                    </button>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 dark:shadow-blue-500/15 transition-all duration-300"
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
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Get started</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create your account in seconds</p>
                </div>

                <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="firstName" className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        First name
                      </Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        className={`mt-1.5 ${inputCx}`}
                        {...registerForm.register("firstName")}
                      />
                      {registerForm.formState.errors.firstName && (
                        <p className="text-red-500 dark:text-red-400 text-xs mt-1">
                          {registerForm.formState.errors.firstName.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="lastName" className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        Last name
                      </Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        className={`mt-1.5 ${inputCx}`}
                        {...registerForm.register("lastName")}
                      />
                      {registerForm.formState.errors.lastName && (
                        <p className="text-red-500 dark:text-red-400 text-xs mt-1">
                          {registerForm.formState.errors.lastName.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="companyName" className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Company
                    </Label>
                    <Input
                      id="companyName"
                      placeholder="Acme Inc."
                      className={`mt-1.5 ${inputCx}`}
                      {...registerForm.register("companyName")}
                    />
                    {registerForm.formState.errors.companyName && (
                      <p className="text-red-500 dark:text-red-400 text-xs mt-1">
                        {registerForm.formState.errors.companyName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="registerEmail" className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Email
                    </Label>
                    <Input
                      id="registerEmail"
                      type="email"
                      placeholder="john@company.com"
                      className={`mt-1.5 ${inputCx}`}
                      {...registerForm.register("email")}
                    />
                    {registerForm.formState.errors.email && (
                      <p className="text-red-500 dark:text-red-400 text-xs mt-1">
                        {registerForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="registerPassword" className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Password
                    </Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="registerPassword"
                        type={showRegisterPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        className={`${inputCx} pr-11`}
                        {...registerForm.register("password")}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                        aria-label={showRegisterPassword ? "Hide password" : "Show password"}
                      >
                        {showRegisterPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                      </button>
                    </div>
                    {registerForm.formState.errors.password && (
                      <p className="text-red-500 dark:text-red-400 text-xs mt-1">
                        {registerForm.formState.errors.password.message}
                      </p>
                    )}
                    {watchPassword && renderPasswordStrength()}
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword" className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Confirm password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm your password"
                      className={`mt-1.5 ${inputCx}`}
                      {...registerForm.register("confirmPassword")}
                    />
                    {registerForm.formState.errors.confirmPassword && (
                      <p className="text-red-500 dark:text-red-400 text-xs mt-1">
                        {registerForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-start gap-3 pt-1">
                    <Checkbox
                      id="terms"
                      required
                      className="mt-0.5"
                    />
                    <Label htmlFor="terms" className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed cursor-pointer">
                      I agree to the{" "}
                      <a href="#" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors">
                        Terms of Service
                      </a>{" "}
                      and{" "}
                      <a href="#" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors">
                        Privacy Policy
                      </a>
                    </Label>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 dark:shadow-blue-500/15 transition-all duration-300"
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
              <div>
                <div className="mb-6">
                  <button
                    className="inline-flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-4 text-sm font-medium"
                    onClick={() => setCurrentView("login")}
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
                    Back to sign in
                  </button>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Reset password</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">We'll send you a link to reset your password</p>
                </div>

                <form onSubmit={forgotForm.handleSubmit(onForgotPassword)} className="space-y-4">
                  <div>
                    <Label htmlFor="resetEmail" className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Email address
                    </Label>
                    <Input
                      id="resetEmail"
                      type="email"
                      placeholder="you@company.com"
                      className={`mt-1.5 ${inputCx}`}
                      {...forgotForm.register("email")}
                    />
                    {forgotForm.formState.errors.email && (
                      <p className="text-red-500 dark:text-red-400 text-xs mt-1.5">
                        {forgotForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 dark:shadow-blue-500/15 transition-all duration-300"
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
              <div>
                <div className="mb-6">
                  <button
                    onClick={() => {
                      setCurrentView("login");
                      setTwoFactorData(null);
                    }}
                    className="inline-flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-4 text-sm font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
                    Back to login
                  </button>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center">
                      <KeyRound className="h-5 w-5 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Two-factor authentication</h2>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Enter the 6-digit code from your authenticator app</p>
                </div>

                <form onSubmit={twoFactorForm.handleSubmit(onTwoFactorSubmit)} className="space-y-5">
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
                            className="w-11 h-12 text-lg font-semibold rounded-lg border-gray-200 dark:border-gray-700"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {twoFactorForm.formState.errors.token && (
                    <p className="text-red-500 dark:text-red-400 text-xs text-center">
                      {twoFactorForm.formState.errors.token.message}
                    </p>
                  )}

                  <Alert className="bg-blue-50/80 dark:bg-blue-950/30 border-blue-200/60 dark:border-blue-800/40">
                    <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
                    <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                      Open your authenticator app and enter the 6-digit code for Authentik.
                    </AlertDescription>
                  </Alert>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 dark:shadow-blue-500/15 transition-all duration-300"
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
        <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-6">
          Protected by enterprise-grade encryption
        </p>
      </div>
    </div>
  );
}
