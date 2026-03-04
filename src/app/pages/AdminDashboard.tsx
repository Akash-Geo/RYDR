import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Users, FileCheck, AlertTriangle, Settings, BarChart3, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { supabase } from '../../lib/supabase';
import { openSignedUrl } from '../../lib/storage';

interface Dispute {
  id: string;
  plaintiff: string;
  defendant: string;
  issueType: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'resolved';
  date: string;
}

interface VerificationRequest {
  id: string;
  userName: string;
  documentType: string;
  uploadDate: string;
  status: 'pending' | 'approved' | 'rejected';
}

const mockDisputes: Dispute[] = [
  {
    id: '1',
    plaintiff: 'Sarah Johnson',
    defendant: 'Michael Chen',
    issueType: 'Route Deviation',
    description: 'Driver took a different route than agreed',
    priority: 'high',
    status: 'pending',
    date: '2026-02-16',
  },
  {
    id: '2',
    plaintiff: 'Emily Martinez',
    defendant: 'David Kim',
    issueType: 'Late Arrival',
    description: 'Driver arrived 30 minutes late',
    priority: 'medium',
    status: 'pending',
    date: '2026-02-15',
  },
  {
    id: '3',
    plaintiff: 'Robert Taylor',
    defendant: 'Jessica Wong',
    issueType: 'Payment Dispute',
    description: 'Points not credited after ride completion',
    priority: 'high',
    status: 'pending',
    date: '2026-02-15',
  },
];

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

type AdminTab = 'overview' | 'users' | 'verification' | 'disputes' | 'settings'

export default function AdminDashboard({ initialTab = 'overview' }: { initialTab?: AdminTab }) {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [verificationRows, setVerificationRows] = useState<VerificationRow[]>([])
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)

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

  const pendingVerificationsCount = useMemo(
    () => verificationRows.filter((v) => v.verification_status === 'pending').length,
    [verificationRows],
  )

  const stats = {
    activeDisputes: mockDisputes.filter(d => d.status === 'pending').length,
    pendingVerifications: pendingVerificationsCount,
    totalRides: 1247,
    activeUsers: 3856,
  };

  const updateVerification = async (rowId: string, status: 'verified' | 'rejected') => {
    const reason =
      status === 'rejected'
        ? window.prompt('Optional: rejection reason (leave blank to skip)') ?? null
        : null

    const { error } = await supabase
      .from('profiles')
      .update({
        verification_status: status,
        verified_by: status === 'verified' ? (await supabase.auth.getUser()).data.user?.id ?? null : null,
        rejection_reason: reason && reason.trim() ? reason.trim() : null,
      })
      .eq('id', rowId)

    if (error) {
      window.alert(error.message)
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
  }

  return (
    <div className="min-h-screen dark:bg-gray-900">
      <div className="flex flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-screen sticky top-0">
          <nav className="p-4 space-y-1">
            <Button
              variant={activeTab === 'overview' ? 'default' : 'ghost'}
              className={`w-full justify-start text-base h-12 ${activeTab === 'overview' ? 'bg-[#00C853] hover:bg-emerald-600' : 'dark:text-gray-300'}`}
              onClick={() => setActiveTab('overview')}
            >
              <BarChart3 className="w-5 h-5 mr-2" />
              Dashboard
            </Button>
            <Button
              variant={activeTab === 'users' ? 'default' : 'ghost'}
              className={`w-full justify-start text-base h-12 ${activeTab === 'users' ? 'bg-[#00C853] hover:bg-emerald-600' : 'dark:text-gray-300'}`}
              onClick={() => setActiveTab('users')}
            >
              <Users className="w-5 h-5 mr-2" />
              User Management
            </Button>
            <Button
              variant={activeTab === 'verification' ? 'default' : 'ghost'}
              className={`w-full justify-start text-base h-12 ${activeTab === 'verification' ? 'bg-[#00C853] hover:bg-emerald-600' : 'dark:text-gray-300'}`}
              onClick={() => setActiveTab('verification')}
            >
              <FileCheck className="w-5 h-5 mr-2" />
              Verification Requests
            </Button>
            <Button
              variant={activeTab === 'disputes' ? 'default' : 'ghost'}
              className={`w-full justify-start text-base h-12 ${activeTab === 'disputes' ? 'bg-[#00C853] hover:bg-emerald-600' : 'dark:text-gray-300'}`}
              onClick={() => setActiveTab('disputes')}
            >
              <AlertTriangle className="w-5 h-5 mr-2" />
              Disputes
            </Button>
            <Button
              variant={activeTab === 'settings' ? 'default' : 'ghost'}
              className={`w-full justify-start text-base h-12 ${activeTab === 'settings' ? 'bg-[#00C853] hover:bg-emerald-600' : 'dark:text-gray-300'}`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings className="w-5 h-5 mr-2" />
              Settings
            </Button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
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
                onChange={(e) => setActiveTab(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-base"
              >
                <option value="overview">Dashboard</option>
                <option value="disputes">Disputes ({stats.activeDisputes})</option>
                <option value="verification">Verifications ({stats.pendingVerifications})</option>
                <option value="users">Users</option>
              </select>
            </div>

            {/* Content Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6 hidden lg:flex h-12">
                <TabsTrigger value="overview" className="text-base px-6">Overview</TabsTrigger>
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
                    <Table>
                      <TableHeader>
                        <TableRow className="dark:border-gray-700">
                          <TableHead className="dark:text-gray-300">Dispute ID</TableHead>
                          <TableHead className="dark:text-gray-300">Parties</TableHead>
                          <TableHead className="dark:text-gray-300">Issue Type</TableHead>
                          <TableHead className="dark:text-gray-300">Priority</TableHead>
                          <TableHead className="dark:text-gray-300">Date</TableHead>
                          <TableHead className="dark:text-gray-300">Status</TableHead>
                          <TableHead className="dark:text-gray-300">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockDisputes.map((dispute) => (
                          <TableRow key={dispute.id} className="dark:border-gray-700">
                            <TableCell className="font-medium dark:text-white">#{dispute.id}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p className="font-medium dark:text-white">{dispute.plaintiff}</p>
                                <p className="text-gray-500 dark:text-gray-400">vs {dispute.defendant}</p>
                              </div>
                            </TableCell>
                            <TableCell className="dark:text-gray-300">{dispute.issueType}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  dispute.priority === 'high'
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-0'
                                    : dispute.priority === 'medium'
                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-0'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-0'
                                }
                              >
                                {dispute.priority}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                              {new Date(dispute.date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400">
                                <Clock className="w-3 h-3 mr-1" />
                                {dispute.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" className="bg-[#00C853] hover:bg-emerald-600 text-white h-9 md:h-10 text-sm md:text-base">
                                Resolve
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
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
                                    {row.license_issue_date ?? '—'} → {row.license_expiry_date ?? '—'}
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
                              {new Date(row.created_at).toLocaleDateString()}
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
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg p-6">
                  <h3 className="text-xl md:text-2xl font-semibold mb-4 dark:text-white">User Management</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg">User management interface coming soon...</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}