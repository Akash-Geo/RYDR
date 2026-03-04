import { useEffect, useState } from 'react';
import { Wallet as WalletIcon, Plus, Send, Gift, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { supabase } from '../lib/supabase';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

interface Transaction {
  id: string;
  type: 'earning' | 'payment' | 'transfer';
  description: string;
  amount: number;
  date: string;
  status: 'completed' | 'pending';
}

type PaymentMethod = 'debit_card' | 'credit_card' | 'upi';

export default function Wallet() {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<'all' | 'earning' | 'payment'>('all');
  const [amountInr, setAmountInr] = useState<string>('');
  const [method, setMethod] = useState<PaymentMethod>('debit_card');
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const convertInrToPoints = (inr: number) => Math.floor(inr);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = authData.user;
        if (!user) {
          throw new Error('User not logged in');
        }

        // make sure a wallet row exists (trigger should cover this,
        // but just in case it didn’t run or the row was deleted)
        await supabase
          .from('wallets')
          .upsert({ profile_id: user.id }, { onConflict: 'profile_id' });

        const { data: wallet, error: walletError } = await supabase
          .from('wallets')
          .select('profile_id, balance_points')
          .eq('profile_id', user.id)
          .limit(1)
          .maybeSingle();

        console.log('wallet.load result', user.id, wallet, walletError);
        if (walletError) throw walletError;
        if (!cancelled) setBalance(wallet?.balance_points ?? 0);

        const { data: payments, error: paymentsError } = await supabase
          .from('wallet_payments')
          .select('id, amount_inr, points_credited, created_at, method')
          .eq('profile_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (paymentsError) throw paymentsError;

        if (!cancelled && payments) {
          const mapped: Transaction[] = payments.map((p) => ({
            id: p.id,
            type: p.points_credited >= 0 ? 'earning' : 'payment',
            description:
              p.points_credited >= 0
                ? `Wallet recharge via ${p.method.replace('_', ' ')}`
                : 'Ride payment / settlement',
            amount: Math.abs(p.points_credited),
            date: p.created_at,
            status: 'completed',
          }));
          setTransactions(mapped);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load wallet';
        if (!cancelled) setError(msg);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePay = async () => {
    setError(null);
    setSuccessMessage(null);

    const parsedAmount = Number(amountInr);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Enter a valid amount in INR.');
      return;
    }

    setIsPaying(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      console.log('wallet.auth.getUser', authData, authError);
      if (authError) throw authError;
      const user = authData.user;
      if (!user) {
        throw new Error('User not logged in');
      }

      const points = convertInrToPoints(parsedAmount);

      const { data: payment, error: paymentError } = await supabase
        .from('wallet_payments')
        .insert({
          profile_id: user.id,
          amount_inr: parsedAmount,
          points_credited: points,
          method,
        })
        .select('id, amount_inr, points_credited, created_at, method')
        .maybeSingle();

      if (paymentError) throw paymentError;
      if (!payment) throw new Error('Payment not created');

      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('profile_id, balance_points')
        .eq('profile_id', user.id)
        .limit(1)
        .maybeSingle();

      console.log('wallet.afterPay refresh', user.id, wallet, walletError);
      if (walletError) throw walletError;

      setBalance(wallet?.balance_points ?? 0);

      setTransactions((prev) => [
        {
          id: payment.id,
          type: 'earning',
          description: `Wallet recharge via ${payment.method.replace('_', ' ')}`,
          amount: payment.points_credited,
          date: payment.created_at,
          status: 'completed',
        },
        ...prev,
      ]);

      setAmountInr('');
      setSuccessMessage(`Added ${points} points to your wallet.`);
    } catch (err) {
      let msg = 'Failed to process payment';
      if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
        msg = (err as any).message as string;
      }
      console.error('Wallet payment error:', err);
      setError(msg);
    } finally {
      setIsPaying(false);
    }
  };

  const filteredTransactions = filter === 'all'
    ? transactions
    : transactions.filter((t) => t.type === filter);

  const totalEarnings = transactions
    .filter((t) => t.type === 'earning')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSpent = Math.abs(
    transactions
      .filter((t) => t.type === 'payment' || t.type === 'transfer')
      .reduce((sum, t) => sum + t.amount, 0),
  );

  return (
    <div className="min-h-screen py-6 md:py-8 dark:bg-gray-900">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">Wallet & Points Hub</h1>
            <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg">Manage your points, transactions, and rewards</p>
          </div>

          {/* Balance Card */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-[#00C853]/20 to-emerald-400/20 rounded-3xl blur-xl" />
            
            <div className="relative bg-gradient-to-br from-[#00C853] via-emerald-600 to-emerald-700 rounded-3xl p-8 text-white shadow-2xl overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <p className="text-emerald-100 text-sm md:text-base mb-2">Current Balance</p>
                    <h2 className="text-5xl md:text-6xl font-bold mb-1">
                      {balance === null ? '—' : balance.toLocaleString()}
                    </h2>
                    <p className="text-emerald-100 text-base md:text-lg">Points</p>
                  </div>
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <WalletIcon className="w-8 h-8 md:w-10 md:h-10" />
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <p className="text-emerald-100 text-sm md:text-base mb-1">Total Earned</p>
                    <p className="text-2xl md:text-3xl font-bold">+{totalEarnings.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <p className="text-emerald-100 text-sm md:text-base mb-1">Total Spent</p>
                    <p className="text-2xl md:text-3xl font-bold">-{totalSpent.toLocaleString()}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-3">
                  <Button className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border-0 text-white h-auto py-4 flex flex-col gap-2">
                    <Plus className="w-6 h-6 md:w-7 md:h-7" />
                    <span className="text-sm md:text-base">Add Points</span>
                  </Button>
                  <Button className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border-0 text-white h-auto py-4 flex flex-col gap-2">
                    <Send className="w-6 h-6 md:w-7 md:h-7" />
                    <span className="text-sm md:text-base">Transfer</span>
                  </Button>
                  <Button className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border-0 text-white h-auto py-4 flex flex-col gap-2">
                    <Gift className="w-6 h-6 md:w-7 md:h-7" />
                    <span className="text-sm md:text-base">Redeem</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Transactions Section */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <h3 className="text-xl md:text-2xl font-semibold dark:text-white">Transaction History</h3>
                {/* Placeholder for future export */}
              </div>
              
              {/* Filters */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={filter === 'all' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter('all')}
                  className={`${filter === 'all' ? "bg-[#00C853] hover:bg-emerald-600" : "dark:border-gray-700 dark:text-gray-300"} h-10 md:h-11 text-base px-4`}
                >
                  All
                </Button>
                <Button
                  variant={filter === 'earning' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter('earning')}
                  className={`${filter === 'earning' ? "bg-[#00C853] hover:bg-emerald-600" : "dark:border-gray-700 dark:text-gray-300"} h-10 md:h-11 text-base px-4`}
                >
                  <TrendingUp className="w-4 h-4 md:w-5 md:h-5 mr-1" />
                  Earnings
                </Button>
                <Button
                  variant={filter === 'payment' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter('payment')}
                  className={`${filter === 'payment' ? "bg-[#00C853] hover:bg-emerald-600" : "dark:border-gray-700 dark:text-gray-300"} h-10 md:h-11 text-base px-4`}
                >
                  <TrendingDown className="w-4 h-4 md:w-5 md:h-5 mr-1" />
                  Payments
                </Button>
              </div>
            </div>

            {/* Transactions List */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredTransactions.map((transaction) => (
                <div key={transaction.id} className="p-4 md:p-6 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                  <div className="flex items-center gap-3 md:gap-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      transaction.type === 'earning' 
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-[#00C853] dark:text-emerald-400' 
                        : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    }`}>
                      {transaction.type === 'earning' ? (
                        <ArrowDownRight className="w-6 h-6 md:w-7 md:h-7" />
                      ) : (
                        <ArrowUpRight className="w-6 h-6 md:w-7 md:h-7" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white mb-1 text-sm md:text-base truncate">{transaction.description}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(transaction.date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                        <Badge 
                          variant={transaction.status === 'completed' ? 'secondary' : 'outline'}
                          className={transaction.status === 'completed' 
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-0' 
                            : 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'
                          }
                        >
                          {transaction.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xl md:text-2xl font-bold ${
                        transaction.amount > 0 ? 'text-[#00C853]' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {transaction.amount > 0 ? '+' : ''}{transaction.amount} Pts
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 text-center">
              <Button variant="outline" className="dark:border-gray-700 dark:text-gray-300 h-11 md:h-12 text-base px-6">Load More Transactions</Button>
            </div>
          </div>

          {/* Rewards Section */}
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-purple-100 dark:bg-purple-900/40 rounded-xl flex items-center justify-center">
                  <Gift className="w-7 h-7 md:w-8 md:h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white text-base md:text-lg">Rewards Available</h4>
                  <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">Redeem your points</p>
                </div>
              </div>
              <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white h-11 md:h-12 text-base">
                View Rewards
              </Button>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-7 h-7 md:w-8 md:h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white text-base md:text-lg">Earn More Points</h4>
                  <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">Complete challenges</p>
                </div>
              </div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 md:h-12 text-base">
                View Challenges
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}