import { motion } from "framer-motion";

const AuthPage = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#356978]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_78%,#8eb6bf_0%,transparent_38%),radial-gradient(circle_at_88%_16%,#5d8e9d_0%,transparent_35%)]" />

      <div className="absolute -left-[28vw] -top-[6vh] h-[110vh] w-[88vw] rounded-[46%] bg-gradient-to-br from-[#6f0600] via-[#4f0501] to-[#270302] rotate-[28deg] shadow-[inset_0_0_90px_rgba(255,105,0,0.28)]" />
      <div className="absolute left-[22vw] top-[18vh] h-[70vh] w-[62vw] bg-gradient-to-br from-[#e06139] via-[#cc4c2a] to-[#9d2f19] [clip-path:polygon(10%_0%,100%_20%,66%_100%,0%_66%)] shadow-[0_35px_60px_-20px_rgba(50,0,0,0.55)]" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 min-h-screen w-full"
      >
        <div className="absolute left-0 right-0 top-10 text-center px-4">
          <p className="text-[#f3f705] text-[11px] sm:text-xs tracking-[0.3em] uppercase font-semibold">
            devloped by ram
          </p>
        </div>

        <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <h1 className="text-[#f3f705] uppercase font-extrabold text-center tracking-[-0.05em] leading-[0.88] text-[14vw] sm:text-[12vw] md:text-[10vw] lg:text-[8vw] drop-shadow-[0_8px_28px_rgba(80,40,0,0.35)]">
            Personal AI OS
          </h1>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
