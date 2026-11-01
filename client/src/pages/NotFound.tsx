import { motion } from 'framer-motion';
import { Compass, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 160, damping: 12 }}
          className="relative font-display text-[6.5rem] font-black leading-none text-mauve [text-shadow:6px_6px_0_#8A857B] sm:text-[9rem] sm:[text-shadow:8px_8px_0_#8A857B]"
        >
          404
          <motion.span
            initial={{ opacity: 0, scale: 2.4, rotate: -30 }}
            animate={{ opacity: 0.92, scale: 1, rotate: -14 }}
            transition={{ delay: 0.6, type: 'spring', stiffness: 400, damping: 18 }}
            className="absolute right-2 top-1/2 [text-shadow:none] sm:-right-6"
          >
            <span className="stamp bg-ink-950/60 !text-base sm:!text-xl">Misprint</span>
          </motion.span>
        </motion.div>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} className="mx-auto mt-2 w-fit">
          <Compass className="h-10 w-10 text-wood-700" />
        </motion.div>
        <h1 className="mt-4 font-display text-4xl font-black text-white">Stop the presses!</h1>
        <p className="mt-2 text-lg italic text-slate-400">This story hasn't been written yet – the page you're looking for doesn't exist.</p>
        <Link to="/" className="btn-primary mt-6 inline-flex">
          <Home className="h-4 w-4" /> Back home
        </Link>
      </div>
    </div>
  );
}