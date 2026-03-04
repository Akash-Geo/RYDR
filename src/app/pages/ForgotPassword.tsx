import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle password reset logic here
    console.log('Password reset requested for:', email);
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Decorative circles */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-[#00C853]/5 dark:bg-[#00C853]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-400/10 dark:bg-emerald-400/5 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Back Button */}
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-[#00C853] dark:hover:text-emerald-400 mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Login</span>
        </Link>

        {/* Card */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-8 lg:p-10 border border-gray-200/50 dark:border-gray-700/50 shadow-2xl">
          {!isSubmitted ? (
            <>
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-[#00C853] to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  Forgot Password?
                </h2>
                <p className="text-base md:text-lg text-gray-600 dark:text-gray-400">
                  No worries, we'll send you reset instructions
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-base text-gray-700 dark:text-gray-300">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 text-base border-gray-300 dark:border-gray-700 dark:bg-gray-900/50 focus:border-[#00C853] focus:ring-[#00C853] dark:text-white"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 md:h-14 text-base md:text-lg bg-gradient-to-r from-[#00C853] to-emerald-600 hover:from-emerald-600 hover:to-[#00C853] text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 transition-all"
                >
                  Reset Password
                </Button>
              </form>
            </>
          ) : (
            <>
              {/* Success State */}
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[#00C853] to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  Check Your Email
                </h2>
                <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 mb-6">
                  We sent a password reset link to
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mb-8">
                  {email}
                </p>
                <div className="space-y-4">
                  <Link to="/login" className="block">
                    <Button className="w-full h-12 text-base bg-gradient-to-r from-[#00C853] to-emerald-600 hover:from-emerald-600 hover:to-[#00C853] text-white">
                      Back to Login
                    </Button>
                  </Link>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Didn't receive the email?{' '}
                    <button
                      onClick={() => setIsSubmitted(false)}
                      className="text-[#00C853] hover:text-emerald-600 font-semibold transition-colors"
                    >
                      Click to resend
                    </button>
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center mt-6 text-sm text-gray-600 dark:text-gray-400">
          Remember your password?{' '}
          <Link
            to="/login"
            className="text-[#00C853] hover:text-emerald-600 font-semibold transition-colors"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
