import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Leaf, Mail, Lock, User, ArrowRight, Phone, Upload, Shield, Car, Users, Camera, FileText, Calendar, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { supabase } from '../../lib/supabase';
import { uploadUserFile } from '../../lib/storage';

type UserRole = 'passenger' | 'driver' | 'admin' | null;

export default function SignUp() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    aadhaarNumber: '',
    aadhaarDocument: null as File | null,
    licenseNumber: '',
    licenseIssueDate: '',
    licenseExpiryDate: '',
    licenseFrontDocument: null as File | null,
    licenseBackDocument: null as File | null,
    agreeToTerms: false,
  });

  const roleHome = (role: Exclude<UserRole, null>) => {
    if (role === 'passenger') return '/passenger/find-ride';
    if (role === 'driver') return '/driver/post-ride';
    // admin or any future roles should go to the admin dashboard
    return '/admin/dashboard';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    setIsSubmitting(true);
    try {
      const { error, data } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: selectedRole,
            full_name: formData.fullName,
            phone: formData.phone,
            aadhaar_number: selectedRole === 'passenger' ? formData.aadhaarNumber : null,
            license_number: selectedRole === 'driver' ? formData.licenseNumber : null,
            license_issue_date: selectedRole === 'driver' ? formData.licenseIssueDate : null,
            license_expiry_date: selectedRole === 'driver' ? formData.licenseExpiryDate : null,
          },
        },
      });

      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) {
        throw new Error('Sign up succeeded but user is missing.');
      }

      // If email confirmations are enabled, session may be null until user confirms.
      if (!data.session) {
        window.alert(
          'Account created. Please check your email to confirm your account, then log in. (Document upload will happen after login.)',
        );
        navigate('/login');
        return;
      }

      // Upload verification documents (requires active session)
      const profileUpdate: Record<string, string> = {};
      if (selectedRole === 'passenger') {
        if (!formData.aadhaarDocument) throw new Error('Aadhaar document is required.');
        const path = await uploadUserFile({
          bucket: 'user-documents',
          userId,
          file: formData.aadhaarDocument,
          filename: `aadhaar_${formData.aadhaarNumber}.${formData.aadhaarDocument.name.split('.').pop() ?? 'bin'}`,
        });
        profileUpdate.aadhaar_document_path = path;
      }

      if (selectedRole === 'driver') {
        if (!formData.licenseFrontDocument || !formData.licenseBackDocument) {
          throw new Error('License documents are required.');
        }
        const frontPath = await uploadUserFile({
          bucket: 'user-documents',
          userId,
          file: formData.licenseFrontDocument,
          filename: `license_front.${formData.licenseFrontDocument.name.split('.').pop() ?? 'bin'}`,
        });
        const backPath = await uploadUserFile({
          bucket: 'user-documents',
          userId,
          file: formData.licenseBackDocument,
          filename: `license_back.${formData.licenseBackDocument.name.split('.').pop() ?? 'bin'}`,
        });
        profileUpdate.license_front_document_path = frontPath;
        profileUpdate.license_back_document_path = backPath;
      }

      if (Object.keys(profileUpdate).length > 0) {
        const { error: updateError } = await supabase.from('profiles').update(profileUpdate).eq('id', userId);
        if (updateError) throw updateError;
      }

      navigate(roleHome(selectedRole));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      window.alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string | boolean | File | null) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent, field: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleChange(field, e.dataTransfer.files[0]);
    }
  };

  const isFormValid = () => {
    if (!formData.fullName || !formData.email || !formData.phone || !formData.password || !formData.agreeToTerms) {
      return false;
    }
    if (selectedRole === 'passenger') {
      return formData.aadhaarNumber.length === 12 && formData.aadhaarDocument !== null;
    }
    if (selectedRole === 'driver') {
      return formData.licenseNumber && formData.licenseIssueDate && formData.licenseExpiryDate && 
             formData.licenseFrontDocument !== null && formData.licenseBackDocument !== null;
    }
    return true;
  };

  const roles = [
    {
      type: 'passenger' as UserRole,
      icon: Users,
      title: 'Passenger',
      description: 'Find and book rides',
      color: 'from-blue-500 to-blue-600',
    },
    {
      type: 'driver' as UserRole,
      icon: Car,
      title: 'Driver',
      description: 'Offer rides and earn',
      color: 'from-[#00C853] to-emerald-600',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Brand & Role Info */}
      <div className="relative lg:w-1/2 min-h-[300px] lg:min-h-screen bg-gradient-to-br from-emerald-600 via-[#00C853] to-emerald-700 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/3 right-1/4 w-72 h-72 border-4 border-white rounded-full" />
          <div className="absolute bottom-1/3 left-1/4 w-56 h-56 border-4 border-white/50 rounded-full" />
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
                {!selectedRole && "Choose your role"}
                {selectedRole === 'passenger' && "Start your journey"}
                {selectedRole === 'driver' && "Become a driver"}
                {selectedRole === 'admin' && "Admin access"}
              </h1>
              <p className="text-lg md:text-xl text-emerald-100">
                {!selectedRole && "Select how you'd like to use RYDR"}
                {selectedRole === 'passenger' && "Secure verification ensures safe, trusted rides for everyone"}
                {selectedRole === 'driver' && "Complete verification to start earning and helping the environment"}
                {selectedRole === 'admin' && "Manage users, resolve disputes, and maintain platform quality"}
              </p>
            </div>
          </div>

          <div className="text-sm text-emerald-100">
            © 2026 RYDR. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right Panel - Role Selection or Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white dark:bg-gray-900 overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          {!selectedRole ? (
            <>
              {/* Role Selection */}
              <div className="text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  Create Account
                </h2>
                <p className="text-base md:text-lg text-gray-600 dark:text-gray-400">
                  Choose your role to get started
                </p>
              </div>

              <div className="space-y-4">
                {roles.map((role) => (
                  <button
                    key={role.type}
                    onClick={() => setSelectedRole(role.type)}
                    className="w-full p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-[#00C853] dark:hover:border-emerald-500 transition-all group bg-white dark:bg-gray-800 hover:shadow-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center flex-shrink-0`}>
                        <role.icon className="w-7 h-7 text-white" />
                      </div>
                      <div className="text-left flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-[#00C853] dark:group-hover:text-emerald-400 transition-colors">
                          {role.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{role.description}</p>
                      </div>
                      <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-[#00C853] dark:group-hover:text-emerald-400 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>

              <p className="text-center text-base text-gray-600 dark:text-gray-400">
                Already have an account?{' '}
                <Link to="/login" className="text-[#00C853] hover:text-emerald-600 font-semibold transition-colors">
                  Log in
                </Link>
              </p>
            </>
          ) : (
            <>
              {/* Back to Role Selection */}
              <button
                onClick={() => setSelectedRole(null)}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-[#00C853] dark:hover:text-emerald-400 transition-colors"
              >
                <ArrowRight className="w-5 h-5 rotate-180" />
                Change role
              </button>

              {/* Dynamic Form Based on Role */}
              <div className="text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  Complete Your Profile
                </h2>
                <p className="text-base md:text-lg text-gray-600 dark:text-gray-400">
                  Secure verification required
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <>
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-base text-gray-700 dark:text-gray-300">
                        Full Name
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          id="fullName"
                          type="text"
                          placeholder="Enter your full name"
                          value={formData.fullName}
                          onChange={(e) => handleChange('fullName', e.target.value)}
                          className="pl-10 h-12 text-base border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:border-[#00C853] focus:ring-[#00C853] dark:text-white"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-base text-gray-700 dark:text-gray-300">
                        Phone Number
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={formData.phone}
                          onChange={(e) => handleChange('phone', e.target.value)}
                          className="pl-10 h-12 text-base border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:border-[#00C853] focus:ring-[#00C853] dark:text-white"
                          required
                        />
                      </div>
                    </div>

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
                          placeholder="Create a strong password"
                          value={formData.password}
                          onChange={(e) => handleChange('password', e.target.value)}
                          className="pl-10 pr-12 h-12 text-base border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:border-[#00C853] focus:ring-[#00C853] dark:text-white"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Aadhaar Verification for Passenger */}
                    {selectedRole === 'passenger' && (
                      <div className="space-y-4 p-5 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border-2 border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          <h3 className="font-semibold text-gray-900 dark:text-white">Aadhaar Verification (Required)</h3>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="aadhaarNumber" className="text-sm text-gray-700 dark:text-gray-300">
                            12-Digit Aadhaar Number
                          </Label>
                          <Input
                            id="aadhaarNumber"
                            type="text"
                            maxLength={12}
                            placeholder="XXXX XXXX XXXX"
                            value={formData.aadhaarNumber}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              handleChange('aadhaarNumber', value);
                            }}
                            className="h-12 text-base dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                            required
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formData.aadhaarNumber.length}/12 digits
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm text-gray-700 dark:text-gray-300">
                            Upload Aadhaar Document
                          </Label>
                          <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={(e) => handleDrop(e, 'aadhaarDocument')}
                            className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${
                              dragActive
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600'
                            }`}
                          >
                            <input
                              id="aadhaar"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => handleChange('aadhaarDocument', e.target.files?.[0] || null)}
                              className="hidden"
                              required
                            />
                            <label htmlFor="aadhaar" className="cursor-pointer">
                              {formData.aadhaarDocument ? (
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                    <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900 dark:text-white">{formData.aadhaarDocument.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      {(formData.aadhaarDocument.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleChange('aadhaarDocument', null);
                                    }}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                  >
                                    <X className="w-5 h-5 text-gray-500" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-2">
                                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                    <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                  </div>
                                  <div className="text-center">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      Drop your document here or <span className="text-blue-600">browse</span>
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      PDF, JPG, or PNG (Max 5MB)
                                    </p>
                                  </div>
                                </div>
                              )}
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Driving License Verification for Driver */}
                    {selectedRole === 'driver' && (
                      <div className="space-y-4 p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Car className="w-5 h-5 text-[#00C853] dark:text-emerald-400" />
                          <h3 className="font-semibold text-gray-900 dark:text-white">Driving License Verification (Required)</h3>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="licenseNumber" className="text-sm text-gray-700 dark:text-gray-300">
                            DL Number
                          </Label>
                          <Input
                            id="licenseNumber"
                            type="text"
                            placeholder="DL-1234567890123"
                            value={formData.licenseNumber}
                            onChange={(e) => handleChange('licenseNumber', e.target.value)}
                            className="h-12 text-base dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="licenseIssueDate" className="text-sm text-gray-700 dark:text-gray-300">
                              Issue Date
                            </Label>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <Input
                                id="licenseIssueDate"
                                type="date"
                                value={formData.licenseIssueDate}
                                onChange={(e) => handleChange('licenseIssueDate', e.target.value)}
                                className="pl-10 h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="licenseExpiryDate" className="text-sm text-gray-700 dark:text-gray-300">
                              Expiry Date
                            </Label>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <Input
                                id="licenseExpiryDate"
                                type="date"
                                value={formData.licenseExpiryDate}
                                onChange={(e) => handleChange('licenseExpiryDate', e.target.value)}
                                className="pl-10 h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                                required
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-sm text-gray-700 dark:text-gray-300">
                            Upload Front & Back of License
                          </Label>
                          
                          {/* Front */}
                          <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={(e) => handleDrop(e, 'licenseFrontDocument')}
                            className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${
                              dragActive
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                                : 'border-gray-300 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600'
                            }`}
                          >
                            <input
                              id="licenseFront"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => handleChange('licenseFrontDocument', e.target.files?.[0] || null)}
                              className="hidden"
                              required
                            />
                            <label htmlFor="licenseFront" className="cursor-pointer">
                              {formData.licenseFrontDocument ? (
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-[#00C853] dark:text-emerald-400" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                      {formData.licenseFrontDocument.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Front side</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleChange('licenseFrontDocument', null);
                                    }}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                  >
                                    <X className="w-4 h-4 text-gray-500" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <Camera className="w-5 h-5 text-gray-400" />
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Upload <span className="font-medium">Front side</span>
                                  </p>
                                </div>
                              )}
                            </label>
                          </div>

                          {/* Back */}
                          <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={(e) => handleDrop(e, 'licenseBackDocument')}
                            className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${
                              dragActive
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                                : 'border-gray-300 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600'
                            }`}
                          >
                            <input
                              id="licenseBack"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => handleChange('licenseBackDocument', e.target.files?.[0] || null)}
                              className="hidden"
                              required
                            />
                            <label htmlFor="licenseBack" className="cursor-pointer">
                              {formData.licenseBackDocument ? (
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-[#00C853] dark:text-emerald-400" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                      {formData.licenseBackDocument.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Back side</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleChange('licenseBackDocument', null);
                                    }}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                  >
                                    <X className="w-4 h-4 text-gray-500" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <Camera className="w-5 h-5 text-gray-400" />
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Upload <span className="font-medium">Back side</span>
                                  </p>
                                </div>
                              )}
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="terms"
                        checked={formData.agreeToTerms}
                        onCheckedChange={(checked) => handleChange('agreeToTerms', checked as boolean)}
                        className="mt-1 border-gray-400 data-[state=checked]:bg-[#00C853] data-[state=checked]:border-[#00C853]"
                        required
                      />
                      <Label htmlFor="terms" className="text-sm md:text-base text-gray-700 dark:text-gray-300 cursor-pointer leading-relaxed">
                        I agree to the Terms of Service and Privacy Policy
                      </Label>
                    </div>
                </>

                <Button
                  type="submit"
                  disabled={!isFormValid() || isSubmitting}
                  className="w-full h-12 md:h-14 text-base md:text-lg text-white shadow-lg transition-all bg-gradient-to-r from-[#00C853] to-emerald-600 hover:from-emerald-600 hover:to-[#00C853] shadow-emerald-200 dark:shadow-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!isFormValid() ? 'Complete Verification to Continue' : isSubmitting ? 'Creating Account...' : 'Create Account'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </form>

              <p className="text-center text-base text-gray-600 dark:text-gray-400">
                Already have an account?{' '}
                <Link to="/login" className="text-[#00C853] hover:text-emerald-600 font-semibold transition-colors">
                  Log in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
