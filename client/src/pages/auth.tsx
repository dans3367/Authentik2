import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useLogin, useRegister } from "@/hooks/useAuth";
import { loginSchema, registerSchema, forgotPasswordSchema } from "@shared/schema";
import type { LoginCredentials, RegisterData, ForgotPasswordData } from "@shared/schema";
import { calculatePasswordStrength, getPasswordStrengthText } from "@/lib/authUtils";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logoUrl from "@assets/logo.png";

type AuthView = "login" | "register" | "forgot" | "twoFactor";

export default function AuthPage() {
  const getInitialView = (): AuthView => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "register" || hash === "login" || hash === "forgot") return hash;
    return "login";
  };
  const [currentView, setCurrentView] = useState<AuthView>(getInitialView);

  useEffect(() => {
    if (currentView === "twoFactor") return;
    const newHash = currentView === "login" ? "" : `#${currentView}`;
    if (window.location.hash !== (newHash || "#")) {
      window.history.replaceState(null, "", newHash || window.location.pathname + window.location.search);
    }
  }, [currentView]);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "register" || hash === "login" || hash === "forgot") {
        setCurrentView(hash);
      } else {
        setCurrentView("login");
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const REGISTER_STORAGE_KEY = "auth_register_form";

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

  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const { toast } = useToast();

  const isLoginLoading = loginMutation.isPending || false;
  const isRegisterLoading = false;

  const onLoginSubmit = async (data: LoginCredentials) => {
    try {
      setIs2FAStatusChecking(true);

      const check2FAResponse = await fetch("/api/auth/check-2fa-requirement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          rememberMe,
        }),
      });

      if (!check2FAResponse.ok) {
        let errorMessage = "Login failed";
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
          window.location.href = "/dashboard";
        }, 300);
      }
    } catch (error: any) {
      console.error("Login error:", error);
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
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    isPending: false,
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
      console.error("Registration failed:", error);
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

  const onForgotPassword = async (data: ForgotPasswordData) => {
    await forgotPasswordMutation.mutateAsync(data);
  };

  const onTwoFactorSubmit = async (data: { token: string }) => {
    if (!twoFactorData || is2FAVerifying) return;

    setIs2FAVerifying(true);
    twoFactorForm.clearErrors();

    try {
      const response = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          token: data.token,
          tempSessionToken: twoFactorData.tempSessionToken,
          rememberMe: twoFactorData.rememberMe,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Invalid 2FA code";
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
        throw new Error("Invalid response format from server");
      }
      if (result.success && result.verified) {
        toast({
          title: "2FA Verified",
          description: "Two-factor authentication successful! Redirecting to dashboard...",
        });

        setTwoFactorData(null);
        twoFactorForm.reset();

        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 500);
      } else {
        throw new Error("Invalid 2FA code");
      }
    } catch (error: any) {
      console.error("2FA verification error:", error);
      twoFactorForm.setError("token", {
        type: "manual",
        message: error.message || "Invalid verification code",
      });
    } finally {
      setIs2FAVerifying(false);
    }
  };

  const strengthFillClass =
    passwordStrength >= 4
      ? "bg-emerald-500"
      : passwordStrength === 3
      ? "bg-lime-500"
      : passwordStrength === 2
      ? "bg-amber-500"
      : "bg-red-500";

  const strengthTextClass =
    passwordStrength >= 4
      ? "text-emerald-600 dark:text-emerald-400"
      : passwordStrength === 3
      ? "text-lime-600 dark:text-lime-400"
      : passwordStrength === 2
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  const renderPasswordStrength = () => (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-300 ${strengthFillClass}`}
          style={{ width: `${(passwordStrength / 4) * 100}%` }}
        />
      </div>
      <p className={`mt-1 text-xs font-medium transition-colors duration-300 ${strengthTextClass}`}>
        {getPasswordStrengthText(passwordStrength)}
      </p>
    </div>
  );

  const inputCx = "h-11 bg-card border-border/80 focus-visible:ring-primary/70";
  const primaryButtonCx = "h-11 w-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90";

  const segClass = (active: boolean) =>
    `flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-card text-foreground shadow-sm ring-1 ring-border/70"
        : "text-muted-foreground hover:text-foreground"
    }`;

  const pageEyebrow =
    currentView === "register"
      ? "Create workspace"
      : currentView === "forgot"
      ? "Account recovery"
      : currentView === "twoFactor"
      ? "Security check"
      : "Welcome back";

  const pageTitle =
    currentView === "register"
      ? "Start your account"
      : currentView === "forgot"
      ? "Reset your password"
      : currentView === "twoFactor"
      ? "Verify your sign in"
      : "Sign in to Authentik";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="grid min-h-screen lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.65fr)]">
        <section className="hidden border-r border-border bg-muted/55 px-10 py-8 lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary">
              <img
                src={logoUrl}
                alt="Authentik"
                className="h-7 w-7 object-contain brightness-0 invert"
              />
            </div>
            <div>
              <p className="text-lg font-semibold leading-none">Authentik</p>
              <p className="mt-1 text-sm text-muted-foreground">Management Suite</p>
            </div>
          </div>

          <div className="flex flex-1 items-center">
            <div className="max-w-xl">
              <p className="mono mb-4 text-xs font-semibold uppercase text-muted-foreground">
                Workspace access
              </p>
              <h1 className="max-w-lg text-5xl font-semibold leading-[0.98] text-foreground">
                Customer operations, ready when you are.
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
                Sign in to manage campaigns, appointments, contacts, forms, and team activity from one calm workspace.
              </p>

              <div className="mt-10 grid max-w-lg grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <div className="mb-6 h-2 w-20 rounded-full bg-primary/80" />
                  <p className="text-sm font-semibold text-foreground">Live activity</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Recent campaign and contact events</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <div className="mb-6 h-2 w-16 rounded-full bg-[var(--accent-olive)]/80" />
                  <p className="text-sm font-semibold text-foreground">Today</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Appointments and scheduled sends</p>
                </div>
                <div className="col-span-2 rounded-lg border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Newsletter review</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Draft status, approvals, and publishing checks</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--accent-warm)]/20 text-foreground">
                      <ShieldCheck className="h-5 w-5" strokeWidth={1.7} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Protected by secure session controls and two-factor authentication.
          </p>
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-[440px]">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary">
                <img
                  src={logoUrl}
                  alt="Authentik"
                  className="h-7 w-7 object-contain brightness-0 invert"
                />
              </div>
              <div>
                <p className="text-lg font-semibold leading-none">Authentik</p>
                <p className="mt-1 text-sm text-muted-foreground">Management Suite</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="mono mb-2 text-xs font-semibold uppercase text-muted-foreground">
                {pageEyebrow}
              </p>
              <h2 className="text-3xl font-semibold text-foreground">
                {pageTitle}
              </h2>
            </div>

            <div className="rounded-lg border border-border bg-card shadow-sm">
              <div className="h-1 rounded-t-lg bg-primary" />

              {currentView !== "forgot" && currentView !== "twoFactor" && (
                <div className="px-5 pt-5 sm:px-6">
                  <div className="inline-flex w-full rounded-lg border border-border bg-muted p-1">
                    <button
                      type="button"
                      onClick={() => setCurrentView("login")}
                      className={segClass(currentView === "login")}
                      data-testid="tab-login"
                    >
                      Sign in
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentView("register")}
                      className={segClass(currentView === "register")}
                      data-testid="tab-register"
                    >
                      Create account
                    </button>
                  </div>
                </div>
              )}

              <div className="p-5 sm:p-6">
                {currentView === "login" && (
                  <div>
                    <div className="mb-6">
                      <h3 className="text-xl font-semibold text-foreground">Welcome back</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Use your team email and password to continue.</p>
                    </div>

                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                      <div>
                        <Label htmlFor="email" className="text-sm font-medium text-foreground">
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
                          <p className="mt-1.5 text-xs text-destructive">
                            {loginForm.formState.errors.email.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="password" className="text-sm font-medium text-foreground">
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
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                          </button>
                        </div>
                        {loginForm.formState.errors.password && (
                          <p className="mt-1.5 text-xs text-destructive">
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
                          <Label htmlFor="remember" className="cursor-pointer text-sm text-muted-foreground">
                            Remember me
                          </Label>
                        </div>
                        <button
                          type="button"
                          className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
                          onClick={() => setCurrentView("forgot")}
                        >
                          Forgot password?
                        </button>
                      </div>

                      <Button
                        type="submit"
                        className={primaryButtonCx}
                        disabled={isLoginLoading || is2FAStatusChecking}
                      >
                        {isLoginLoading || is2FAStatusChecking ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {is2FAStatusChecking ? "Verifying..." : "Signing in..."}
                          </>
                        ) : (
                          "Sign in"
                        )}
                      </Button>
                    </form>
                  </div>
                )}

                {currentView === "register" && (
                  <div>
                    <div className="mb-6">
                      <h3 className="text-xl font-semibold text-foreground">Get started</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Create your account in seconds.</p>
                    </div>

                    <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="firstName" className="text-sm font-medium text-foreground">
                            First name
                          </Label>
                          <Input
                            id="firstName"
                            placeholder="John"
                            className={`mt-1.5 ${inputCx}`}
                            {...registerForm.register("firstName")}
                          />
                          {registerForm.formState.errors.firstName && (
                            <p className="mt-1 text-xs text-destructive">
                              {registerForm.formState.errors.firstName.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="lastName" className="text-sm font-medium text-foreground">
                            Last name
                          </Label>
                          <Input
                            id="lastName"
                            placeholder="Doe"
                            className={`mt-1.5 ${inputCx}`}
                            {...registerForm.register("lastName")}
                          />
                          {registerForm.formState.errors.lastName && (
                            <p className="mt-1 text-xs text-destructive">
                              {registerForm.formState.errors.lastName.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="companyName" className="text-sm font-medium text-foreground">
                          Company
                        </Label>
                        <Input
                          id="companyName"
                          placeholder="Acme Inc."
                          className={`mt-1.5 ${inputCx}`}
                          {...registerForm.register("companyName")}
                        />
                        {registerForm.formState.errors.companyName && (
                          <p className="mt-1 text-xs text-destructive">
                            {registerForm.formState.errors.companyName.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="registerEmail" className="text-sm font-medium text-foreground">
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
                          <p className="mt-1 text-xs text-destructive">
                            {registerForm.formState.errors.email.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="registerPassword" className="text-sm font-medium text-foreground">
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
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                            onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                            aria-label={showRegisterPassword ? "Hide password" : "Show password"}
                          >
                            {showRegisterPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                          </button>
                        </div>
                        {registerForm.formState.errors.password && (
                          <p className="mt-1 text-xs text-destructive">
                            {registerForm.formState.errors.password.message}
                          </p>
                        )}
                        {watchPassword && renderPasswordStrength()}
                      </div>

                      <div>
                        <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
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
                          <p className="mt-1 text-xs text-destructive">
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
                        <Label htmlFor="terms" className="cursor-pointer text-sm leading-relaxed text-muted-foreground">
                          I agree to the{" "}
                          <a href="/terms-of-service" className="font-medium text-primary transition-colors hover:text-primary/80">
                            Terms of Service
                          </a>{" "}
                          and{" "}
                          <a href="/privacy-security" className="font-medium text-primary transition-colors hover:text-primary/80">
                            Privacy Policy
                          </a>
                        </Label>
                      </div>

                      <Button
                        type="submit"
                        className={primaryButtonCx}
                        disabled={isRegisterLoading}
                      >
                        {isRegisterLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          "Create account"
                        )}
                      </Button>
                    </form>
                  </div>
                )}

                {currentView === "forgot" && (
                  <div>
                    <div className="mb-6">
                      <button
                        className="mb-4 inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => setCurrentView("login")}
                      >
                        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
                        Back to sign in
                      </button>
                      <h3 className="text-xl font-semibold text-foreground">Reset password</h3>
                      <p className="mt-1 text-sm text-muted-foreground">We'll send you a link to reset your password.</p>
                    </div>

                    <form onSubmit={forgotForm.handleSubmit(onForgotPassword)} className="space-y-4">
                      <div>
                        <Label htmlFor="resetEmail" className="text-sm font-medium text-foreground">
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
                          <p className="mt-1.5 text-xs text-destructive">
                            {forgotForm.formState.errors.email.message}
                          </p>
                        )}
                      </div>

                      <Button
                        type="submit"
                        className={primaryButtonCx}
                        disabled={forgotPasswordMutation.isPending}
                      >
                        {forgotPasswordMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          "Send reset link"
                        )}
                      </Button>
                    </form>
                  </div>
                )}

                {currentView === "twoFactor" && (
                  <div>
                    <div className="mb-6">
                      <button
                        onClick={() => {
                          setCurrentView("login");
                          setTwoFactorData(null);
                        }}
                        className="mb-4 inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
                        Back to login
                      </button>
                      <div className="mb-1.5 flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary">
                          <KeyRound className="h-5 w-5" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground">Two-factor authentication</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
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
                                className="h-12 w-11 rounded-lg border-border text-lg font-semibold"
                              />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>

                      {twoFactorForm.formState.errors.token && (
                        <p className="text-center text-xs text-destructive">
                          {twoFactorForm.formState.errors.token.message}
                        </p>
                      )}

                      <Alert className="border-border bg-muted/60">
                        <ShieldCheck className="h-4 w-4 text-primary" strokeWidth={1.5} />
                        <AlertDescription className="text-sm text-foreground">
                          Open your authenticator app and enter the 6-digit code for Authentik.
                        </AlertDescription>
                      </Alert>

                      <Button
                        type="submit"
                        className={primaryButtonCx}
                        disabled={is2FAVerifying}
                      >
                        {is2FAVerifying ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          "Verify and sign in"
                        )}
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Copyright notice of Zendwise LLC
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
