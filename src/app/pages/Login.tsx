import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Eye, EyeOff, Leaf, Mail, Lock, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });

  const roleHome = (role: string | null | undefined) => {
    if (role === 'driver') return '/driver/post-ride';
    if (role === 'admin') return '/admin/dashboard';
    return '/passenger/find-ride';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) {
        throw new Error('Login succeeded but user is missing.');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;

      navigate(roleHome(profile?.role));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      window.alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Brand & Visuals */}
      <div className="relative lg:w-1/2 min-h-[300px] lg:min-h-screen bg-gradient-to-br from-[#00C853] via-emerald-600 to-emerald-700 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 border-4 border-white rounded-full" />
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 border-4 border-white/50 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 border-4 border-white/30 rounded-full" />
        </div>

        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <path d="M 0 200 Q 200 100 400 200 T 800 200" stroke="white" strokeWidth="2" fill="none" />
            <path d="M 0 400 Q 200 300 400 400 T 800 400" stroke="white" strokeWidth="2" fill="none" />
            <path d="M 0 600 Q 200 500 400 600 T 800 600" stroke="white" strokeWidth="2" fill="none" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col justify-between h-full p-8 lg:p-12 text-white">
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity w-fit">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Leaf className="w-7 h-7 md:w-9 md:h-9 text-white" />
              </div>
              <span className="text-4xl md:text-5xl font-bold">RYDR</span>
            </Link>
            
            <div className="space-y-4 max-w-md">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
                Share your journey,<br />
                <span className="text-emerald-100">earn points.</span>
              </h1>
              <p className="text-lg md:text-xl text-emerald-100">
                Join thousands of commuters making their daily rides more sustainable and rewarding.
              </p>
            </div>
          </div>

          <div className="hidden lg:grid grid-cols-3 gap-6 my-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-3xl font-bold">3.8K+</p>
              <p className="text-emerald-100 text-sm">Active Users</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-3xl font-bold">1.2K+</p>
              <p className="text-emerald-100 text-sm">Daily Rides</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-3xl font-bold">45K kg</p>
              <p className="text-emerald-100 text-sm">CO₂ Saved</p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 max-w-md">
            <div className="flex gap-1 mb-3">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-5 h-5 fill-yellow-300 text-yellow-300" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <p className="text-white text-base md:text-lg mb-3">
              "Saved 450 points on my commute today! The platform is so easy to use."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-semibold">
                SJ
              </div>
              <div>
                <p className="font-semibold">Sarah Johnson</p>
                <p className="text-sm text-emerald-100">Daily Commuter</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white dark:bg-gray-900">
        <div className="w-full max-w-md space-y-8">
          <>
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                Welcome Back
              </h2>
              <p className="text-base md:text-lg text-gray-600 dark:text-gray-400">
                Log in to your account
              </p>
            </div>

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
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="pl-10 h-12 text-base border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:border-[#00C853] focus:ring-[#00C853] dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-base text-gray-700 dark:text-gray-300">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    className="pl-10 pr-12 h-12 text-base border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:border-[#00C853] focus:ring-[#00C853] dark:text-white"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember"
                      checked={formData.rememberMe}
                      onCheckedChange={(checked) => handleChange('rememberMe', checked as boolean)}
                      className="data-[state=checked]:bg-[#00C853] data-[state=checked]:border-[#00C853]"
                    />
                    <Label htmlFor="remember" className="text-sm md:text-base text-gray-700 dark:text-gray-300 cursor-pointer">
                      Remember me
                    </Label>
                  </div>
                  <Link
                    to="/forgot-password"
                    className="text-sm md:text-base text-[#00C853] hover:text-emerald-600 font-medium transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 md:h-14 text-base md:text-lg text-white shadow-lg transition-all bg-gradient-to-r from-[#00C853] to-emerald-600 hover:from-emerald-600 hover:to-[#00C853] shadow-emerald-200 dark:shadow-emerald-900/30 disabled:opacity-60"
                >
                  {isSubmitting ? 'Logging in...' : 'Log In'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
            </form>

            <p className="text-center text-base text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <Link
                to="/signup"
                className="text-[#00C853] hover:text-emerald-600 font-semibold transition-colors"
              >
                Sign up
              </Link>
            </p>
          </>
        </div>
      </div>
    </div>
  );
}
