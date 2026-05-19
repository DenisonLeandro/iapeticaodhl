import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { User, Lock, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import "./AuthPanel.css";

/* ── Schemas ── */
const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

const registerSchema = z
  .object({
    fullName: z.string().min(3, "Mínimo 3 caracteres"),
    organizationName: z.string().min(2, "Nome do escritório obrigatório"),
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "Mínimo 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export default function AuthPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register, user, profile, loading: authLoading } = useAuth();

  const [isActive, setIsActive] = useState(location.pathname === "/register");
  const [isLoading, setIsLoading] = useState(false);
  const registeredRef = useRef(false);

  /* ── Login form ── */
  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  /* ── Register form ── */
  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      organizationName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Sync URL ↔ panel state
  useEffect(() => {
    setIsActive(location.pathname === "/register");
  }, [location.pathname]);

  // After registration, wait for profile then redirect
  useEffect(() => {
    if (registeredRef.current && profile) {
      navigate("/dashboard", { replace: true });
    }
  }, [profile, navigate]);

  /* ── Guards ── */
  if (authLoading) {
    return (
      <div className="auth-wrapper">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (user && !registeredRef.current) {
    return <Navigate to="/dashboard" replace />;
  }

  /* ── Handlers ── */
  async function onLogin(values: LoginValues) {
    setIsLoading(true);
    try {
      await login(values.email, values.password);
      toast.success("Login realizado com sucesso!");
      // Redirect happens reactively via the `if (user) <Navigate />` guard once
      // AuthContext processes the SIGNED_IN event. Avoids race with profile fetch.
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao fazer login";
      toast.error(msg === "Invalid login credentials" ? "Email ou senha incorretos" : msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function onRegister(values: RegisterValues) {
    setIsLoading(true);
    try {
      await register(values.email, values.password, values.fullName, values.organizationName);
      toast.success("Conta criada com sucesso!");
      registeredRef.current = true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao criar conta";
      toast.error(msg === "User already registered" ? "Este email já está cadastrado" : msg);
    } finally {
      setIsLoading(false);
    }
  }

  function switchToRegister() {
    setIsActive(true);
    navigate("/register", { replace: true });
  }

  function switchToLogin() {
    setIsActive(false);
    navigate("/login", { replace: true });
  }

  return (
    <div className="auth-wrapper">
      <div className={`auth-container${isActive ? " active" : ""}`}>
        {/* ── Login Form ── */}
        <div className="auth-form-box">
          <form onSubmit={loginForm.handleSubmit(onLogin)}>
            <div className="auth-brand">Peticionamento com IA</div>
            <h1>Login</h1>

            <div className="auth-input-box">
              <input
                type="email"
                placeholder="seu@email.com"
                {...loginForm.register("email")}
              />
              <Mail className="auth-input-icon" size={20} />
              {loginForm.formState.errors.email && (
                <span className="auth-error-msg">{loginForm.formState.errors.email.message}</span>
              )}
            </div>

            <div className="auth-input-box">
              <input
                type="password"
                placeholder="Sua senha"
                {...loginForm.register("password")}
              />
              <Lock className="auth-input-icon" size={20} />
              {loginForm.formState.errors.password && (
                <span className="auth-error-msg">{loginForm.formState.errors.password.message}</span>
              )}
            </div>

            <button type="submit" className="auth-btn" disabled={isLoading}>
              {isLoading && !isActive ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        {/* ── Register Form ── */}
        <div className="auth-form-box register">
          <form onSubmit={registerForm.handleSubmit(onRegister)}>
            <div className="auth-brand">Peticionamento com IA</div>
            <h1>Criar conta</h1>

            <div className="auth-input-box">
              <input
                placeholder="Nome completo"
                {...registerForm.register("fullName")}
              />
              <User className="auth-input-icon" size={20} />
              {registerForm.formState.errors.fullName && (
                <span className="auth-error-msg">{registerForm.formState.errors.fullName.message}</span>
              )}
            </div>

            <div className="auth-input-box">
              <input
                placeholder="Nome do escritório"
                {...registerForm.register("organizationName")}
              />
              <User className="auth-input-icon" size={20} />
              {registerForm.formState.errors.organizationName && (
                <span className="auth-error-msg">{registerForm.formState.errors.organizationName.message}</span>
              )}
            </div>

            <div className="auth-input-box">
              <input
                type="email"
                placeholder="seu@email.com"
                {...registerForm.register("email")}
              />
              <Mail className="auth-input-icon" size={20} />
              {registerForm.formState.errors.email && (
                <span className="auth-error-msg">{registerForm.formState.errors.email.message}</span>
              )}
            </div>

            <div className="auth-input-box">
              <input
                type="password"
                placeholder="Senha (mín. 6 caracteres)"
                {...registerForm.register("password")}
              />
              <Lock className="auth-input-icon" size={20} />
              {registerForm.formState.errors.password && (
                <span className="auth-error-msg">{registerForm.formState.errors.password.message}</span>
              )}
            </div>

            <div className="auth-input-box">
              <input
                type="password"
                placeholder="Confirmar senha"
                {...registerForm.register("confirmPassword")}
              />
              <Lock className="auth-input-icon" size={20} />
              {registerForm.formState.errors.confirmPassword && (
                <span className="auth-error-msg">{registerForm.formState.errors.confirmPassword.message}</span>
              )}
            </div>

            <button type="submit" className="auth-btn" disabled={isLoading}>
              {isLoading && isActive ? "Criando conta..." : "Criar conta"}
            </button>
          </form>
        </div>

        {/* ── Toggle panels ── */}
        <div className="auth-toggle-box">
          <div className="auth-toggle-panel toggle-left">
            <div className="auth-brand">Peticionamento com IA</div>
            <h1>Olá, Bem-vindo!</h1>
            <p>Não tem uma conta?</p>
            <button className="auth-toggle-btn" onClick={switchToRegister}>
              Criar conta
            </button>
          </div>

          <div className="auth-toggle-panel toggle-right">
            <div className="auth-brand">Peticionamento com IA</div>
            <h1>Bem-vindo de volta!</h1>
            <p>Já tem uma conta?</p>
            <button className="auth-toggle-btn" onClick={switchToLogin}>
              Entrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
