import { FormEvent, type MouseEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

type AuthMode = "login" | "signup";

const AuthPage = () => {
  const navigate = useNavigate();
  const { login, signup, logout, isAuthenticated, user } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 120, damping: 18, mass: 0.7 });
  const smoothY = useSpring(pointerY, { stiffness: 120, damping: 18, mass: 0.7 });

  const skyX = useTransform(smoothX, [-0.5, 0.5], [-14, 14]);
  const skyY = useTransform(smoothY, [-0.5, 0.5], [-10, 10]);
  const structureX = useTransform(smoothX, [-0.5, 0.5], [-30, 30]);
  const structureY = useTransform(smoothY, [-0.5, 0.5], [-18, 18]);
  const bandX = useTransform(smoothX, [-0.5, 0.5], [-20, 20]);
  const bandY = useTransform(smoothY, [-0.5, 0.5], [-14, 14]);
  const plateX = useTransform(smoothX, [-0.5, 0.5], [-26, 26]);
  const plateY = useTransform(smoothY, [-0.5, 0.5], [-16, 16]);
  const titleX = useTransform(smoothX, [-0.5, 0.5], [-18, 18]);
  const titleY = useTransform(smoothY, [-0.5, 0.5], [-10, 10]);
  const cardX = useTransform(smoothX, [-0.5, 0.5], [-14, 14]);
  const cardY = useTransform(smoothY, [-0.5, 0.5], [-10, 10]);
  const cardRotateX = useTransform(smoothY, [-0.5, 0.5], [6, -6]);
  const cardRotateY = useTransform(smoothX, [-0.5, 0.5], [-6, 6]);

  const handlePointerMove = (event: MouseEvent<HTMLDivElement>) => {
    const nextX = event.clientX / window.innerWidth - 0.5;
    const nextY = event.clientY / window.innerHeight - 0.5;
    pointerX.set(nextX);
    pointerY.set(nextY);
  };

  const resetPointer = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  const title = useMemo(() => (mode === "login" ? "Login" : "Sign up"), [mode]);

  const subtitle = useMemo(
    () =>
      mode === "login"
        ? "Access your connected knowledge system"
        : "Create your account to start indexing notes and files",
    [mode],
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (mode === "signup") {
      if (!fullName.trim()) {
        setError("Full name is required");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    try {
      setIsSubmitting(true);

      if (mode === "signup") {
        await signup({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
        });
      } else {
        await login({
          email: email.trim().toLowerCase(),
          password,
        });
      }

      navigate("/", { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to authenticate");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setError(null);
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Unable to logout");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#426f7d]"
      onMouseMove={handlePointerMove}
      onMouseLeave={resetPointer}
    >
      <motion.div
        style={{ x: skyX, y: skyY }}
        animate={{ scale: [1, 1.02, 1], opacity: [0.95, 1, 0.95] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_82%,#91c6d4_0%,transparent_42%),radial-gradient(circle_at_90%_14%,#5f8f9d_0%,transparent_36%),linear-gradient(180deg,#3d7180_0%,#79adbc_100%)]"
      />

      <motion.div
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        className="absolute inset-y-0 w-[45vw] bg-gradient-to-r from-transparent via-white/10 to-transparent blur-2xl"
      />

      <motion.div
        style={{ x: structureX, y: structureY }}
        animate={{ rotate: [26, 27, 26], scale: [1, 1.01, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-[30vw] -top-[8vh] h-[124vh] w-[94vw] rounded-[47%] bg-gradient-to-br from-[#6a0602] via-[#470401] to-[#240201] rotate-[26deg] shadow-[inset_0_0_120px_rgba(255,88,0,0.28)]"
      />
      <motion.div
        style={{ x: bandX, y: bandY }}
        animate={{ rotate: [31, 32, 31] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-[5vw] top-[16vh] h-[20vh] w-[84vw] rounded-[55%] bg-gradient-to-br from-[#cb2f0a] via-[#a41e09] to-[#5d0b04] rotate-[31deg] opacity-95"
      />
      <motion.div
        style={{ x: plateX, y: plateY }}
        animate={{ rotate: [0, 1.2, 0], scale: [1, 1.008, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-[28vw] top-[18vh] h-[76vh] w-[67vw] bg-gradient-to-br from-[#ef7249] via-[#d6552d] to-[#922d16] [clip-path:polygon(9%_0%,100%_19%,71%_100%,0%_68%)] shadow-[0_38px_60px_-18px_rgba(55,7,0,0.62)]"
      />

      <div className="absolute left-0 right-0 top-8 sm:top-10 text-center px-4 z-20">
        <p className="text-[#f3f705] text-[10px] sm:text-xs tracking-[0.3em] uppercase font-semibold">devloped by ram</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 min-h-screen w-full"
      >
        <motion.div
          style={{ x: titleX, y: titleY }}
          className="absolute inset-0 flex items-center justify-center sm:justify-start px-6 sm:pl-12 sm:pr-[25rem] lg:pl-16 lg:pr-[31rem] pointer-events-none"
        >
          <motion.h1
            animate={{ textShadow: ["0 8px 26px rgba(80,40,0,0.35)", "0 12px 32px rgba(80,40,0,0.45)", "0 8px 26px rgba(80,40,0,0.35)"] }}
            transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
            className="text-[#f3f705] uppercase font-extrabold text-center sm:text-left tracking-[-0.05em] leading-[0.9] text-[13vw] sm:text-[11vw] md:text-[9vw] lg:text-[7vw]"
          >
            Personal AI OS
          </motion.h1>
        </motion.div>

        <div className="relative min-h-screen z-30 flex items-end justify-center sm:justify-end p-4 sm:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.35 }}
            style={{ x: cardX, y: cardY, rotateX: cardRotateX, rotateY: cardRotateY, transformPerspective: 1000 }}
            whileHover={{ scale: 1.015 }}
            className="w-full max-w-md rounded-2xl border border-[#f3f705]/30 bg-[#10161bb3] backdrop-blur-md shadow-[0_30px_60px_-24px_rgba(0,0,0,0.7)] p-5 sm:p-6"
          >
            {isAuthenticated ? (
              <div className="space-y-4">
                <p className="text-[#f3f705] text-[11px] uppercase tracking-[0.2em] font-semibold">Session Active</p>
                <h2 className="text-xl font-semibold text-white">Welcome, {user?.fullName ?? "User"}</h2>
                <p className="text-sm text-white/75">You are logged in and connected. Continue to your dashboard or logout.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    onClick={() => navigate("/")}
                    className="w-full bg-[#f3f705] text-[#1f2106] hover:bg-[#f3f705]/90 font-semibold"
                  >
                    Continue
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      void handleLogout();
                    }}
                    disabled={isLoggingOut}
                    variant="outline"
                    className="w-full border-white/30 bg-transparent text-white hover:bg-white/10"
                  >
                    {isLoggingOut ? "Logging out..." : "Logout"}
                  </Button>
                </div>
                {error && <p className="text-sm text-red-300">{error}</p>}
              </div>
            ) : (
              <>
                <div>
                  <p className="text-[#f3f705] text-[11px] uppercase tracking-[0.2em] font-semibold">Connected Access</p>
                  <h2 className="text-2xl font-semibold text-white mt-2">{title}</h2>
                  <p className="text-sm text-white/75 mt-1">{subtitle}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/10 p-1 mt-5 mb-5">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                    }}
                    className={`rounded-lg text-sm py-2 transition-colors ${
                      mode === "login" ? "bg-[#f3f705] text-[#1f2106] font-semibold" : "text-white/80"
                    }`}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setError(null);
                    }}
                    className={`rounded-lg text-sm py-2 transition-colors ${
                      mode === "signup" ? "bg-[#f3f705] text-[#1f2106] font-semibold" : "text-white/80"
                    }`}
                  >
                    Sign up
                  </button>
                </div>

                <form onSubmit={onSubmit} className="space-y-3">
                  {mode === "signup" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName" className="text-white/85">Full name</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="Ada Lovelace"
                        autoComplete="name"
                        className="bg-white/8 border-white/25 text-white placeholder:text-white/45"
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-white/85">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="bg-white/8 border-white/25 text-white placeholder:text-white/45"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-white/85">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Minimum 8 characters"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      minLength={8}
                      className="bg-white/8 border-white/25 text-white placeholder:text-white/45"
                      required
                    />
                  </div>

                  {mode === "signup" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPassword" className="text-white/85">Confirm password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        minLength={8}
                        className="bg-white/8 border-white/25 text-white placeholder:text-white/45"
                        required
                      />
                    </div>
                  )}

                  {error && <p className="text-sm text-red-300">{error}</p>}

                  <Button
                    type="submit"
                    className="w-full mt-2 bg-[#f3f705] text-[#1f2106] hover:bg-[#f3f705]/90 font-semibold"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
                  </Button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
