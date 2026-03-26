import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Users, FileCheck, AlertTriangle, BarChart3, CheckCircle2, Clock, XCircle, Search, ArrowLeft, User, FileText, CreditCard, MessageCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { supabase } from '../../lib/supabase';
import { openSignedUrl } from '../../lib/storage';
import DriverAvatar from '../components/DriverAvatar';

interface DisputeRow {
  id: string;
  ride_id: string;
  status: 'open' | 'resolved';
  created_at: string;
  description?: string;
  reporter: {
    full_name: string | null;
    phone: string | null;
    role: string | null;
  } | null;
  ride: {
    from_location: string;
    to_location: string;
    departure_time: string;
  } | null;
}

interface VerificationRequest {
  id: string;
  userName: string;
  documentType: string;
  uploadDate: string;
  status: 'pending' | 'approved' | 'rejected';
}

type VerificationRow = {
  id: string
  role: 'passenger' | 'driver' | 'admin'
  full_name: string | null
  email: string | null
  phone: string | null
  aadhaar_number: string | null
  aadhaar_document_path: string | null
  license_number: string | null
  license_issue_date: string | null
  license_expiry_date: string | null
  license_front_document_path: string | null
  license_back_document_path: string | null
  verification_status: 'pending' | 'verified' | 'rejected'
  created_at: string
  updated_at: string
  rejection_reason?: string | null
}

type UserRow = {
  id: string
  role: 'passenger' | 'driver' | 'admin'
  full_name: string | null
  email: string | null
  phone: string | null
  gender: string | null
  aadhaar_number: string | null
  aadhaar_document_path: string | null
  license_number: string | null
  license_issue_date: string | null
  license_expiry_date: string | null
  license_front_document_path: string | null
  license_back_document_path: string | null
  verification_status: 'pending' | 'verified' | 'rejected'
  created_at: string
  avatar_path: string | null
}

type AdminTab = 'overview' | 'users' | 'verification' | 'disputes' | 'settings'

export default function AdminDashboard({ initialTab = 'disputes' }: { initialTab?: AdminTab }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [verificationRows, setVerificationRows] = useState<VerificationRow[]>([])
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [disputesError, setDisputesError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)

  const handleMessageUser = async () => {
    if (!selectedUser) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.alert('Session expired. Please log in again.');
        return;
      }

      // Check for existing open chat
      const { data: existingChats } = await supabase
        .from('support_chats')
        .select('id')
        .eq('user_id', selectedUser.id)
        .eq('status', 'open')
        .maybeSingle();

      if (existingChats) {
        navigate(`/support-chat/${existingChats.id}`);
        return;
      }

      // Create new chat
      const { data: newChat, error } = await supabase
        .from('support_chats')
        .insert({
          user_id: selectedUser.id,
          admin_id: user.id,
          status: 'open'
        })
        .select()
        .single();

      if (error) throw error;
      if (newChat) navigate(`/support-chat/${newChat.id}`);
    } catch (err) {
      console.error('Error starting chat:', err);
      window.alert('Failed to start chat');
    }
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let cancelled = false
    async function loadVerificationQueue() {
      if (activeTab !== 'verification') return
      setVerificationLoading(true)
      setVerificationError(null)
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(
            'id, role, full_name, email, phone, aadhaar_number, aadhaar_document_path, license_number, license_issue_date, license_expiry_date, license_front_document_path, license_back_document_path, verification_status, created_at, updated_at, rejection_reason',
          )
          .in('role', ['passenger', 'driver'])
          .order('created_at', { ascending: false })

        if (error) throw error
        if (cancelled) return
        setVerificationRows((data ?? []) as VerificationRow[])
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load verification requests'
        if (!cancelled) setVerificationError(message)
      } finally {
        if (!cancelled) setVerificationLoading(false)
      }
    }
    void loadVerificationQueue()
    return () => {
      cancelled = true
    }
  }, [activeTab])

  useEffect(() => {
    let cancelled = false;
    async function loadDisputes() {
      if (activeTab !== 'disputes') return;
      setDisputesLoading(true);
      setDisputesError(null);
      try {
        const { data, error } = await supabase
          .from('disputes')
          .select(`
            id,
            ride_id,
            status,
            created_at,
            description,
            reporter:profiles!raised_by (
              full_name,
              phone,
              role
            ),
            ride:rides (
              from_location,
              to_location,
              departure_time
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!cancelled) setDisputes((data ?? []) as unknown as DisputeRow[]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load disputes';
        if (!cancelled) setDisputesError(message);
      } finally {
        if (!cancelled) setDisputesLoading(false);
      }
    }
    void loadDisputes();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false
    async function loadUsers() {
      if (activeTab !== 'users') return
      setUsersLoading(true)
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .in('role', ['passenger', 'driver'])
          .order('created_at', { ascending: false })

        if (error) throw error
        if (cancelled) return
        setUsers((data ?? []) as UserRow[])
      } catch (err) {
        console.error('Failed to load users', err)
      } finally {
        if (!cancelled) setUsersLoading(false)
      }
    }
    void loadUsers()
    return () => { cancelled = true }
  }, [activeTab])

  const pendingVerificationsCount = useMemo(
    () => verificationRows.filter((v) => v.verification_status === 'pending').length,
    [verificationRows],
  )

  const stats = {
    activeDisputes: disputes.filter(d => d.status === 'open').length,
    pendingVerifications: pendingVerificationsCount,
    totalRides: 1247,
    activeUsers: 3856,
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users
    const lower = searchQuery.toLowerCase()
    return users.filter((u) =>
      u.full_name?.toLowerCase().includes(lower) ||
      u.phone?.includes(lower) ||
      u.id.toLowerCase().includes(lower)
    )
  }, [users, searchQuery])

  const updateVerification = async (rowId: string, status: 'verified' | 'rejected') => {
    const reason =
      status === 'rejected'
        ? window.prompt('Optional: rejection reason (leave blank to skip)') ?? null
        : null

    const { data, error } = await supabase
      .from('profiles')
      .update({
        verification_status: status,
        rejection_reason: reason && reason.trim() ? reason.trim() : null,
      })
      .eq('id', rowId)
      .select()

    if (error) {
      console.error('Error updating verification status:', error);
      window.alert(`Failed to update status: ${error.message}`);
      return
    }

    if (!data || data.length === 0) {
      window.alert('Update failed: User not found or permission denied.')
      return
    }

    setVerificationRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              verification_status: status,
              rejection_reason: reason && reason.trim() ? reason.trim() : null,
            }
          : r,
      ),
    )

    setUsers((prev) =>
      prev.map((u) =>
        u.id === rowId
          ? {
              ...u,
              verification_status: status,
            }
          : u,
      ),
    )

    if (selectedUser?.id === rowId) {
      setSelectedUser((prev) => (prev ? { ...prev, verification_status: status } : null))
    }
  }

  return (
    <div className="min-h-screen dark:bg-gray-900">
      {/* Main Content */}
      <main className="p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6 md:mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">Admin Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg">Monitor and manage the RYDR platform</p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="w-8 h-8 md:w-10 md:h-10" />
                  <Badge className="bg-white/20 text-white border-0">Urgent</Badge>
                </div>
                <p className="text-3xl md:text-4xl font-bold mb-1">{stats.activeDisputes}</p>
                <p className="text-red-100 text-sm md:text-base">Active Disputes</p>
              </div>

              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <FileCheck className="w-8 h-8 md:w-10 md:h-10" />
                  <Badge className="bg-white/20 text-white border-0">Pending</Badge>
                </div>
                <p className="text-3xl md:text-4xl font-bold mb-1">{stats.pendingVerifications}</p>
                <p className="text-amber-100 text-sm md:text-base">Pending Verifications</p>
              </div>

              <div className="bg-gradient-to-br from-[#00C853] to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <BarChart3 className="w-8 h-8 md:w-10 md:h-10" />
                </div>
                <p className="text-3xl md:text-4xl font-bold mb-1">{stats.totalRides.toLocaleString()}</p>
                <p className="text-emerald-100 text-sm md:text-base">Total Rides</p>
              </div>

              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-8 h-8 md:w-10 md:h-10" />
                </div>
                <p className="text-3xl md:text-4xl font-bold mb-1">{stats.activeUsers.toLocaleString()}</p>
                <p className="text-blue-100 text-sm md:text-base">Active Users</p>
              </div>
            </div>

            {/* Mobile Tab Selector */}
            <div className="lg:hidden mb-6">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as AdminTab)}
                className="w-full h-12 px-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-base"
              >
                <option value="disputes">Disputes ({stats.activeDisputes})</option>
                <option value="verification">Verifications ({stats.pendingVerifications})</option>
                <option value="users">Users</option>
              </select>
            </div>

            {/* Content Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdminTab)}>
              <TabsList className="mb-6 hidden lg:flex h-12">
                <TabsTrigger value="disputes" className="text-base px-6">Disputes ({stats.activeDisputes})</TabsTrigger>
                <TabsTrigger value="verification" className="text-base px-6">Verifications ({stats.pendingVerifications})</TabsTrigger>
                <TabsTrigger value="users" className="text-base px-6">Users</TabsTrigger>
              </TabsList>

              {/* Overview */}
              <TabsContent value="overview" className="space-y-6">
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg p-6">
                  <h3 className="text-xl md:text-2xl font-semibold mb-4 dark:text-white">Recent Activity</h3>
                  <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                      <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white text-base md:text-lg">New high-priority dispute</p>
                        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">Sarah Johnson vs Michael Chen - Route Deviation</p>
                      </div>
                      <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white h-10 md:h-11 text-base w-full md:w-auto">
                        Review
                      </Button>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                      <Clock className="w-5 h-5 md:w-6 md:h-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white text-base md:text-lg">3 verification requests pending</p>
                        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">Driver licenses and vehicle documents awaiting review</p>
                      </div>
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white h-10 md:h-11 text-base w-full md:w-auto">
                        Review
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Disputes */}
              <TabsContent value="disputes">
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl md:text-2xl font-semibold dark:text-white">Dispute Resolution</h3>
                  </div>
                  <div className="overflow-x-auto">
                    {disputesError && (
                      <div className="p-6 text-red-700 dark:text-red-300">{disputesError}</div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow className="dark:border-gray-700">
                          <TableHead className="dark:text-gray-300">Dispute ID</TableHead>
                          <TableHead className="dark:text-gray-300">Parties</TableHead>
                          <TableHead className="dark:text-gray-300">Route</TableHead>
                          <TableHead className="dark:text-gray-300">Date</TableHead>
                          <TableHead className="dark:text-gray-300">Status</TableHead>
                          <TableHead className="dark:text-gray-300">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(disputesLoading ? [] : disputes).map((dispute) => (
                          <TableRow key={dispute.id} className="dark:border-gray-700">
                            <TableCell className="font-medium dark:text-white">#{dispute.id.slice(0, 8)}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p className="font-medium dark:text-white">{dispute.reporter?.full_name || 'Unknown'}</p>
                                <p className="text-gray-500 dark:text-gray-400 capitalize">{dispute.reporter?.role || 'User'}</p>
                              </div>
                            </TableCell>
                            <TableCell className="dark:text-gray-300">
                              {dispute.ride ? (
                                <div className="flex flex-col text-sm">
                                  <span>{dispute.ride.from_location} →</span>
                                  <span>{dispute.ride.to_location}</span>
                                </div>
                              ) : 'Ride details unavailable'}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                              {new Date(dispute.created_at).toLocaleDateString('en-GB')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${dispute.status === 'resolved' ? 'border-green-300 text-green-700 dark:border-green-800 dark:text-green-400' : 'border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400'}`}>
                                <Clock className="w-3 h-3 mr-1" />
                                {dispute.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button 
                                size="sm" 
                                className="bg-[#00C853] hover:bg-emerald-600 text-white h-9 md:h-10 text-sm md:text-base"
                                onClick={() => navigate(`/dispute/${dispute.id}`)}
                              >
                                View Chat
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {disputesLoading && (
                          <TableRow className="dark:border-gray-700">
                            <TableCell colSpan={6} className="p-6 text-gray-600 dark:text-gray-400 text-center">
                              Loading disputes...
                            </TableCell>
                          </TableRow>
                        )}
                        {!disputesLoading && disputes.length === 0 && (
                          <TableRow className="dark:border-gray-700">
                            <TableCell colSpan={6} className="p-6 text-gray-600 dark:text-gray-400 text-center">
                              No disputes found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

              {/* Verification */}
              <TabsContent value="verification">
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl md:text-2xl font-semibold dark:text-white">Verification Queue</h3>
                  </div>
                  <div className="overflow-x-auto">
                    {verificationError && (
                      <div className="p-6 text-red-700 dark:text-red-300">{verificationError}</div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow className="dark:border-gray-700">
                          <TableHead className="dark:text-gray-300">User</TableHead>
                          <TableHead className="dark:text-gray-300">Role</TableHead>
                          <TableHead className="dark:text-gray-300">Details</TableHead>
                          <TableHead className="dark:text-gray-300">Documents</TableHead>
                          <TableHead className="dark:text-gray-300">Submitted</TableHead>
                          <TableHead className="dark:text-gray-300">Status</TableHead>
                          <TableHead className="dark:text-gray-300">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(verificationLoading ? [] : verificationRows).map((row) => (
                          <TableRow key={row.id} className="dark:border-gray-700">
                            <TableCell>
                              <div className="text-sm">
                                <p className="font-medium dark:text-white">{row.full_name ?? 'Unnamed'}</p>
                                <p className="text-gray-500 dark:text-gray-400">{row.email ?? ''}</p>
                                <p className="text-gray-500 dark:text-gray-400">{row.phone ?? ''}</p>
                              </div>
                            </TableCell>
                            <TableCell className="dark:text-gray-300">{row.role}</TableCell>
                            <TableCell className="dark:text-gray-300">
                              {row.role === 'passenger' ? (
                                <div className="text-sm">
                                  <p>
                                    Aadhaar: <span className="font-medium">{row.aadhaar_number ?? '—'}</span>
                                  </p>
                                </div>
                              ) : (
                                <div className="text-sm">
                                  <p>
                                    License: <span className="font-medium">{row.license_number ?? '—'}</span>
                                  </p>
                                  <p className="text-gray-500 dark:text-gray-400">
                                    {row.license_issue_date ? new Date(row.license_issue_date).toLocaleDateString('en-GB') : '—'} → {row.license_expiry_date ? new Date(row.license_expiry_date).toLocaleDateString('en-GB') : '—'}
                                  </p>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="dark:text-gray-300">
                              <div className="flex gap-2 flex-wrap">
                                {row.aadhaar_document_path && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9"
                                    onClick={() =>
                                      openSignedUrl({ bucket: 'user-documents', path: row.aadhaar_document_path! })
                                    }
                                  >
                                    View Aadhaar
                                  </Button>
                                )}
                                {row.license_front_document_path && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9"
                                    onClick={() =>
                                      openSignedUrl({
                                        bucket: 'user-documents',
                                        path: row.license_front_document_path!,
                                      })
                                    }
                                  >
                                    Front
                                  </Button>
                                )}
                                {row.license_back_document_path && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9"
                                    onClick={() =>
                                      openSignedUrl({
                                        bucket: 'user-documents',
                                        path: row.license_back_document_path!,
                                      })
                                    }
                                  >
                                    Back
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                              {new Date(row.created_at).toLocaleDateString('en-GB')}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  row.verification_status === 'pending'
                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-0'
                                    : row.verification_status === 'verified'
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-0'
                                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-0'
                                }
                              >
                                {row.verification_status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                                {row.verification_status === 'verified' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                {row.verification_status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                                {row.verification_status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {row.verification_status === 'pending' && (
                                <div className="flex gap-2 flex-wrap">
                                  <Button
                                    size="sm"
                                    className="bg-[#00C853] hover:bg-emerald-600 text-white h-9 md:h-10 text-sm md:text-base"
                                    onClick={() => updateVerification(row.id, 'verified')}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-500 dark:border-gray-600 h-9 md:h-10 text-sm md:text-base"
                                    onClick={() => updateVerification(row.id, 'rejected')}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              )}
                              {row.verification_status === 'rejected' && row.rejection_reason && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 max-w-[240px]">
                                  Reason: {row.rejection_reason}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {verificationLoading && (
                          <TableRow className="dark:border-gray-700">
                            <TableCell colSpan={7} className="p-6 text-gray-600 dark:text-gray-400">
                              Loading…
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

              {/* Users */}
              <TabsContent value="users">
                {selectedUser ? (
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg p-6">
                    <Button
                      variant="ghost"
                      onClick={() => setSelectedUser(null)}
                      className="mb-6 pl-0 hover:bg-transparent hover:text-[#00C853] dark:hover:text-emerald-400"
                    >
                      <ArrowLeft className="w-5 h-5 mr-2" />
                      Back to Users
                    </Button>

                    <div className="flex items-start justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <DriverAvatar 
                          path={selectedUser.avatar_path} 
                          name={selectedUser.full_name ?? 'User'} 
                          className="w-16 h-16 text-xl"
                        />
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{selectedUser.full_name}</h2>
                          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {selectedUser.role}
                            </span>
                            <span>•</span>
                            <span>ID: {selectedUser.id}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge
                          className={
                            selectedUser.verification_status === 'verified'
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-0'
                              : selectedUser.verification_status === 'rejected'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-0'
                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-0'
                          }
                        >
                          {selectedUser.verification_status}
                        </Badge>
                        <Button 
                          size="sm" 
                          onClick={handleMessageUser}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Message User
                        </Button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                          Personal Details
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Phone</p>
                            <p className="font-medium text-gray-900 dark:text-white">{selectedUser.phone || '—'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Email</p>
                            <p className="font-medium text-gray-900 dark:text-white">{selectedUser.email || '—'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Gender</p>
                            <p className="font-medium text-gray-900 dark:text-white capitalize">{selectedUser.gender || '—'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Joined</p>
                            <p className="font-medium text-gray-900 dark:text-white">{new Date(selectedUser.created_at).toLocaleDateString('en-GB')}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                          Documents
                        </h3>
                        
                        {selectedUser.role === 'passenger' && (
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Aadhaar Number</p>
                              <p className="font-medium text-gray-900 dark:text-white">{selectedUser.aadhaar_number || '—'}</p>
                            </div>
                            {selectedUser.aadhaar_document_path && (
                              <Button
                                variant="outline"
                                className="w-full justify-start dark:border-gray-700"
                                onClick={() => openSignedUrl({ bucket: 'user-documents', path: selectedUser.aadhaar_document_path! })}
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                View Aadhaar Document
                              </Button>
                            )}
                          </div>
                        )}

                        {selectedUser.role === 'driver' && (
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">License Number</p>
                              <p className="font-medium text-gray-900 dark:text-white">{selectedUser.license_number || '—'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              {selectedUser.license_front_document_path && (
                                <Button
                                  variant="outline"
                                  className="w-full justify-start dark:border-gray-700"
                                  onClick={() => openSignedUrl({ bucket: 'user-documents', path: selectedUser.license_front_document_path! })}
                                >
                                  <CreditCard className="w-4 h-4 mr-2" />
                                  License Front
                                </Button>
                              )}
                              {selectedUser.license_back_document_path && (
                                <Button
                                  variant="outline"
                                  className="w-full justify-start dark:border-gray-700"
                                  onClick={() => openSignedUrl({ bucket: 'user-documents', path: selectedUser.license_back_document_path! })}
                                >
                                  <CreditCard className="w-4 h-4 mr-2" />
                                  License Back
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <h3 className="text-xl md:text-2xl font-semibold dark:text-white">User Management</h3>
                      <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 bg-white dark:bg-gray-900/50"
                        />
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="dark:border-gray-700">
                            <TableHead className="dark:text-gray-300">User ID</TableHead>
                            <TableHead className="dark:text-gray-300">Name</TableHead>
                            <TableHead className="dark:text-gray-300">Phone</TableHead>
                            <TableHead className="dark:text-gray-300">Gender</TableHead>
                            <TableHead className="dark:text-gray-300">Role</TableHead>
                            <TableHead className="dark:text-gray-300">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usersLoading ? (
                            <TableRow className="dark:border-gray-700">
                              <TableCell colSpan={6} className="p-6 text-center text-gray-600 dark:text-gray-400">
                                Loading users...
                              </TableCell>
                            </TableRow>
                          ) : filteredUsers.length === 0 ? (
                            <TableRow className="dark:border-gray-700">
                              <TableCell colSpan={6} className="p-6 text-center text-gray-600 dark:text-gray-400">
                                No users found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredUsers.map((user) => (
                              <TableRow 
                                key={user.id} 
                                className="dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                onClick={() => setSelectedUser(user)}
                              >
                                <TableCell className="font-medium dark:text-white font-mono text-xs">
                                  {user.id.slice(0, 8)}...
                                </TableCell>
                                <TableCell className="dark:text-white">{user.full_name || '—'}</TableCell>
                                <TableCell className="dark:text-gray-300">{user.phone || '—'}</TableCell>
                                <TableCell className="dark:text-gray-300 capitalize">{user.gender || '—'}</TableCell>
                                <TableCell className="dark:text-gray-300 capitalize">{user.role}</TableCell>
                                <TableCell>
                                  <Badge
                                    className={
                                      user.verification_status === 'verified'
                                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-0'
                                        : user.verification_status === 'rejected'
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-0'
                                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-0'
                                    }
                                  >
                                    {user.verification_status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
      </main>
    </div>
  );
}