import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { User, Mail, Phone, Edit2, Camera, LogOut, ShieldCheck, IdCard, BadgeCheck, BadgeX } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { supabase } from '../../../lib/supabase';
import { Switch } from '../../components/ui/switch';
import { getSignedUrl, uploadUserFile } from '../../../lib/storage';

export default function PassengerAccount() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const [profileData, setProfileData] = useState({
    fullName: '',
    phone: '',
    role: '' as '' | 'passenger' | 'driver' | 'admin',
    verificationStatus: '' as '' | 'pending' | 'verified' | 'rejected',
    avatarPath: '' as string,
    gender: '' as '' | 'male' | 'female' | 'other' | 'prefer_not_to_say',
    isSmoker: false,
    adminId: '',
    aadhaarNumber: '',
    licenseNumber: '',
    licenseIssueDate: '',
    licenseExpiryDate: '',
  });

  const theme = useMemo(() => {
    if (profileData.role === 'driver') {
      return { header: 'from-[#00C853] to-emerald-600', avatar: 'from-emerald-400 to-emerald-600' };
    }
    if (profileData.role === 'admin') {
      return { header: 'from-purple-500 to-purple-600', avatar: 'from-purple-400 to-purple-600' };
    }
    return { header: 'from-blue-500 to-blue-600', avatar: 'from-blue-400 to-blue-600' };
  }, [profileData.role]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = authData.user;
        if (!user) {
          navigate('/login');
          return;
        }

        if (!cancelled) setUserEmail(user.email ?? '');

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select(
            'role, full_name, phone, verification_status, admin_id, aadhaar_number, license_number, license_issue_date, license_expiry_date, avatar_path, gender, is_smoker',
          )
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile) throw new Error('Profile not found for this user.');

        if (cancelled) return;

        const nextProfile = {
          fullName: profile.full_name ?? '',
          phone: profile.phone ?? '',
          role: (profile.role ?? '') as any,
          verificationStatus: (profile.verification_status ?? '') as any,
          avatarPath: profile.avatar_path ?? '',
          gender: (profile.gender ?? '') as any,
          isSmoker: Boolean(profile.is_smoker),
          adminId: profile.admin_id ?? '',
          aadhaarNumber: profile.aadhaar_number ?? '',
          licenseNumber: profile.license_number ?? '',
          licenseIssueDate: profile.license_issue_date ?? '',
          licenseExpiryDate: profile.license_expiry_date ?? '',
        };

        // if the user somehow navigated to a route that doesn't match
        // their role, send them to the correct account path. this fixes
        // the "I am a passenger but the page turned green like a driver" issue.
        const basePath = location.pathname.split('/')[1];
        if (nextProfile.role && nextProfile.role !== basePath) {
          const dest =
            nextProfile.role === 'admin'
              ? '/admin/account'
              : `/${nextProfile.role}/account`;
          navigate(dest, { replace: true });
          return;
        }

        setProfileData(nextProfile);

        // Load wallet balance
        const { data: wallet, error: walletError } = await supabase
          .from('wallets')
          .select('balance_points')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (walletError) throw walletError;
        if (!cancelled) {
          setWalletBalance(wallet?.balance_points ?? 0);
        }

        if (nextProfile.avatarPath) {
          const url = await getSignedUrl({ bucket: 'avatars', path: nextProfile.avatarPath });
          if (!cancelled) setAvatarUrl(url);
        } else {
          if (!cancelled) setAvatarUrl(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load profile';
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleChange = (field: string, value: string | boolean) => {
    setProfileData({ ...profileData, [field]: value as any });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) {
        navigate('/login');
        return;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.fullName,
          phone: profileData.phone,
          gender: profileData.gender || null,
          is_smoker: profileData.isSmoker,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;
      setIsEditing(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save profile';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleAvatarSelected = async (file: File | null) => {
    if (!file) return;
    setIsUploadingAvatar(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) {
        navigate('/login');
        return;
      }

      const uploadedPath = await uploadUserFile({
        bucket: 'avatars',
        userId: user.id,
        file,
        filename: `avatar.${file.name.split('.').pop() ?? 'png'}`,
      });

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_path: uploadedPath })
        .eq('id', user.id);
      if (updateError) throw updateError;

      setProfileData((p) => ({ ...p, avatarPath: uploadedPath }));
      const url = await getSignedUrl({ bucket: 'avatars', path: uploadedPath });
      setAvatarUrl(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload photo';
      setError(message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className={`bg-gradient-to-r ${theme.header} px-4 pt-6 pb-20`}>
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-white">My Account</h1>
            {profileData.role && (
              <p className="text-sm text-white/80 uppercase">
                {profileData.role}
              </p>
            )}
            <Button
              variant="ghost"
              onClick={() => setIsEditing(!isEditing)}
              className="text-white hover:bg-white/20"
              disabled={isLoading}
            >
              <Edit2 className="w-5 h-5 mr-2" />
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
          </div>
        </div>
      </div>

      {/* Profile Card */}
      <div className="max-w-screen-xl mx-auto px-4 -mt-16">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
          {/* Profile Picture Section */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col items-center">
              <div className="relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 border-white/70 dark:border-gray-700 shadow"
                  />
                ) : (
                  <div
                    className={`w-24 h-24 rounded-full bg-gradient-to-br ${theme.avatar} flex items-center justify-center text-white font-bold text-3xl`}
                  >
                    {(profileData.fullName || userEmail || 'U').charAt(0).toUpperCase()}
                  </div>
                )}

                <input
                  id="avatarUpload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isLoading || isUploadingAvatar}
                  onChange={(e) => handleAvatarSelected(e.target.files?.[0] ?? null)}
                />
                <label
                  htmlFor="avatarUpload"
                  className={`absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center text-white shadow-lg ${
                    isUploadingAvatar || isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#00C853] cursor-pointer'
                  }`}
                  title="Upload profile photo"
                >
                  <Camera className="w-4 h-4" />
                </label>
              </div>
              <h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
                {isLoading ? 'Loading…' : profileData.fullName || 'Unnamed user'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{userEmail}</p>
              {!isLoading && profileData.role && (
                <div className="mt-2 px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                  {profileData.role.toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Profile Form */}
          <div className="p-6 space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Full Name
                </Label>
                <Input
                  id="name"
                  value={profileData.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  disabled={!isEditing || isLoading}
                  className="h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white disabled:opacity-70"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={userEmail}
                  disabled
                  className="h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white disabled:opacity-70"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  disabled={!isEditing || isLoading}
                  className="h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white disabled:opacity-70"
                />
              </div>

              {/* Gender */}
              <div className="space-y-2">
                <Label htmlFor="gender" className="text-gray-700 dark:text-gray-300">
                  Gender
                </Label>
                <select
                  id="gender"
                  value={profileData.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  disabled={!isEditing || isLoading}
                  className="w-full h-12 px-3 rounded-md border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:opacity-70 focus:border-[#00C853] focus:ring-[#00C853]"
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              {/* Smoker */}
              <div className="space-y-2">
                <Label htmlFor="smoker" className="text-gray-700 dark:text-gray-300">
                  Smoking Status
                </Label>
                <div className="flex items-center justify-between h-12 px-4 rounded-md border border-gray-300 dark:border-gray-700 dark:bg-gray-900">
                  <span className="text-gray-900 dark:text-white">
                    {profileData.isSmoker ? 'Smoker' : 'Non-smoker'}
                  </span>
                  <Switch
                    id="smoker"
                    checked={profileData.isSmoker}
                    onCheckedChange={(checked) => handleChange('isSmoker', checked)}
                    disabled={!isEditing || isLoading}
                    className="data-[state=checked]:bg-[#00C853]"
                  />
                </div>
              </div>

              {/* Role-specific info (read-only from Supabase) */}
              {profileData.role === 'passenger' && (
                <div className="space-y-2">
                  <Label htmlFor="aadhaarNumber" className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <IdCard className="w-4 h-4" />
                    Aadhaar Number
                  </Label>
                  <Input
                    id="aadhaarNumber"
                    value={profileData.aadhaarNumber}
                    disabled
                    className="h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white disabled:opacity-70"
                  />
                </div>
              )}

              {profileData.role === 'driver' && (
                <div className="space-y-2">
                  <Label htmlFor="licenseNumber" className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <IdCard className="w-4 h-4" />
                    License Number
                  </Label>
                  <Input
                    id="licenseNumber"
                    value={profileData.licenseNumber}
                    disabled
                    className="h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white disabled:opacity-70"
                  />
                </div>
              )}

              {profileData.role === 'admin' && (
                <div className="space-y-2">
                  <Label htmlFor="adminId" className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Admin ID
                  </Label>
                  <Input
                    id="adminId"
                    value={profileData.adminId}
                    disabled
                    className="h-12 dark:bg-gray-900 dark:border-gray-700 dark:text-white disabled:opacity-70"
                  />
                </div>
              )}

              {/* Wallet points summary */}
              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-300">Wallet Points</Label>
                <div className="h-12 px-4 flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-700 dark:bg-gray-900">
                  <span className="text-gray-900 dark:text-white font-semibold">
                    {walletBalance === null ? 'Loading…' : `${walletBalance} points`}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Manage in Wallet tab
                  </span>
                </div>
              </div>
            </div>

            {/* Save Button */}
            {isEditing && (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full h-12 bg-gradient-to-r from-[#00C853] to-emerald-600 hover:from-emerald-600 hover:to-[#00C853] text-white text-base disabled:opacity-60"
              >
                {isSaving ? 'Saving…' : 'Save Changes'}
              </Button>
            )}
          </div>
        </div>

        {/* Additional Sections */}
        <div className="mt-6 space-y-4">
          {/* Verification Status */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Verification Status</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {profileData.role === 'driver'
                    ? 'License Verification'
                    : profileData.role === 'admin'
                    ? 'Admin Status'
                    : 'Aadhaar Verification'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isLoading ? 'Loading…' : `Status: ${profileData.verificationStatus || 'pending'}`}
                </p>
              </div>
              {profileData.verificationStatus === 'verified' ? (
                <div className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg font-semibold inline-flex items-center gap-2">
                  <BadgeCheck className="w-5 h-5" />
                  Verified
                </div>
              ) : profileData.verificationStatus === 'rejected' ? (
                <div className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg font-semibold inline-flex items-center gap-2">
                  <BadgeX className="w-5 h-5" />
                  Rejected
                </div>
              ) : (
                <div className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg font-semibold">
                  Pending
                </div>
              )}
            </div>
          </div>

          {/* Logout */}
          <Button
            variant="outline"
            className="w-full h-12 text-red-600 dark:text-red-400 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-base"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
