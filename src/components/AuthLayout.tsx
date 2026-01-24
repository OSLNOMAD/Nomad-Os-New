import { motion } from 'framer-motion'

interface AuthLayoutProps {
  children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-nomad-light/30 to-white flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-nomad-primary to-nomad-accent relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-40 right-20 w-96 h-96 rounded-full bg-white blur-3xl" />
        </div>
        
        <div className="relative z-10 flex flex-col justify-center items-center w-full px-16 py-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="text-center text-white max-w-lg"
          >
            <div className="mb-10">
              <h1 className="text-5xl font-bold tracking-tight mb-2">
                Nomad Internet
              </h1>
              <div className="w-20 h-1 bg-white/40 mx-auto rounded-full" />
            </div>
            
            <h2 className="text-3xl font-semibold mb-6">
              Stay Connected Anywhere
            </h2>
            <p className="text-white/80 text-lg leading-relaxed">
              Reliable internet service for the modern nomad. Access your account to manage your service, view usage, and more.
            </p>
            
            <div className="mt-16 grid grid-cols-3 gap-12 text-center">
              <div className="space-y-2">
                <div className="text-4xl font-bold">24/7</div>
                <div className="text-white/70 text-sm uppercase tracking-wider">Support</div>
              </div>
              <div className="space-y-2">
                <div className="text-4xl font-bold">99.9%</div>
                <div className="text-white/70 text-sm uppercase tracking-wider">Uptime</div>
              </div>
              <div className="space-y-2">
                <div className="text-4xl font-bold">50+</div>
                <div className="text-white/70 text-sm uppercase tracking-wider">States</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center px-8 py-12 lg:px-16">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md mb-10"
        >
          <img 
            src="/logo.svg" 
            alt="Nomad Internet" 
            className="h-12 mx-auto"
          />
        </motion.div>
        
        {children}
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-center text-gray-400 text-sm"
        >
          &copy; {new Date().getFullYear()} Nomad Internet. All rights reserved.
        </motion.p>
      </div>
    </div>
  )
}
