import { useEffect, useState } from 'react';
import { Wallet as WalletIcon, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

type PaymentMethod = 'debit_card' | 'credit_card' | 'upi';

interface Transaction {
  id: string;
  type: 'earning' | 'payment';
  description: string;
  amount: number;
  date: string;
}

export default function PassengerWallet() {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amountInr, setAmountInr] = useState<string>('');
  const [method, setMethod] = useState<PaymentMethod>('debit_card');
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // For now, 1 INR = 1 point
  const convertInrToPoints = (inr: number) => Math.floor(inr);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        console.log('passenger.wallet.auth', authData, authError);
        if (authError) throw authError;
        const user = authData.user;
        if (!user) {
          throw new Error('User not logged in');
        }

        // ensure a wallet exists for this profile
        await supabase.from('wallets').upsert({ profile_id: user.id }, { onConflict: 'profile_id' });

        // Fetch wallet balance
        const { data: wallet, error: walletError } = await supabase
          .from('wallets')
          .select('profile_id, balance_points')
          .eq('profile_id', user.id)
          .limit(1)
          .maybeSingle();

        console.log('passenger.wallet.load', user.id, wallet, walletError);

        if (walletError) throw walletError;
        if (!cancelled) {
          setBalance(wallet?.balance_points ?? 0);
        }

        // Fetch recent wallet payments as transactions
        const { data: payments, error: paymentsError } = await supabase
          .from('wallet_payments')
          .select('id, amount_inr, points_credited, created_at, method')
          .eq('profile_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

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

      // Refresh wallet balance
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance_points')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (walletError) throw walletError;

      setBalance(wallet?.balance_points ?? 0);

      // Prepend to recent transactions
      setTransactions((prev) => [
        {
          id: payment.id,
          type: 'earning',
          description: `Wallet recharge via ${payment.method.replace('_', ' ')}`,
          amount: payment.points_credited,
          date: payment.created_at,
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
      console.error('Wallet payment error (passenger):', err);
      setError(msg);
    } finally {
      setIsPaying(false);
    }
  };

  const totalEarned = transactions
    .filter((t) => t.type === 'earning')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSpent = transactions
    .filter((t) => t.type === 'payment')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#00C853] to-emerald-600 px-4 pt-6 pb-20">
        <div className="max-w-screen-xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Wallet</h1>
          <p className="text-emerald-100">Manage your points</p>
        </div>
      </div>

      {/* Balance Card */}
      <div className="max-w-screen-xl mx-auto px-4 -mt-16">
        <div className="bg-gradient-to-br from-[#00C853] to-emerald-600 rounded-3xl p-8 text-white shadow-2xl mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-emerald-100 mb-1">Current Balance</p>
              <h2 className="text-5xl font-bold">
                {balance === null ? '—' : balance}
              </h2>
              <p className="text-emerald-100 mt-1">Points</p>
            </div>
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <WalletIcon className="w-8 h-8" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-emerald-100 text-sm mb-1">Earned</p>
              <p className="text-2xl font-bold">+{totalEarned}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-emerald-100 text-sm mb-1">Spent</p>
              <p className="text-2xl font-bold">-{totalSpent}</p>
            </div>
          </div>
        </div>

        {/* Recharge / Payment Interface */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg mb-6">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Recharge Wallet</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Add points to your wallet using Indian currency (INR). 1 ₹ = 1 point.
            </p>
          </div>
          <div className="p-6 space-y-4">
            {error && (
              <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                {successMessage}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amountInr" className="text-gray-700 dark:text-gray-300">
                  Amount (₹ INR)
                </Label>
                <Input
                  id="amountInr"
                  type="number"
                  min="1"
                  step="1"
                  value={amountInr}
                  onChange={(e) => setAmountInr(e.target.value)}
                  className="h-11 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  placeholder="Enter amount in INR"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-300">Payment method</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={method === 'debit_card' ? 'default' : 'outline'}
                    className={`h-11 text-xs md:text-sm ${
                      method === 'debit_card'
                        ? 'bg-[#00C853] hover:bg-emerald-600 text-white border-0'
                        : 'dark:border-gray-700 dark:text-gray-300'
                    }`}
                    onClick={() => setMethod('debit_card')}
                  >
                    Debit Card
                  </Button>
                  <Button
                    type="button"
                    variant={method === 'credit_card' ? 'default' : 'outline'}
                    className={`h-11 text-xs md:text-sm ${
                      method === 'credit_card'
                        ? 'bg-[#00C853] hover:bg-emerald-600 text-white border-0'
                        : 'dark:border-gray-700 dark:text-gray-300'
                    }`}
                    onClick={() => setMethod('credit_card')}
                  >
                    Credit Card
                  </Button>
                  <Button
                    type="button"
                    variant={method === 'upi' ? 'default' : 'outline'}
                    className={`h-11 text-xs md:text-sm ${
                      method === 'upi'
                        ? 'bg-[#00C853] hover:bg-emerald-600 text-white border-0'
                        : 'dark:border-gray-700 dark:text-gray-300'
                    }`}
                    onClick={() => setMethod('upi')}
                  >
                    UPI
                  </Button>
                </div>
              </div>
            </div>

            {/* Stubbed card/UPI details - purely UI, no real payment */}
            <div className="grid gap-4 md:grid-cols-2">
              {(method === 'debit_card' || method === 'credit_card') && (
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300">Card details (demo only)</Label>
                  <Input
                    placeholder="Card number"
                    className="h-11 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="MM/YY"
                      className="h-11 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                    />
                    <Input
                      placeholder="CVV"
                      className="h-11 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {method === 'upi' && (
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300">UPI ID (demo only)</Label>
                  <Input
                    placeholder="yourname@upi"
                    className="h-11 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  />
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={handlePay}
              disabled={isPaying}
              className="w-full h-11 bg-gradient-to-r from-[#00C853] to-emerald-600 hover:from-emerald-600 hover:to-[#00C853] text-white font-semibold"
            >
              {isPaying ? 'Processing…' : 'Pay & Add Points'}
            </Button>
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      transaction.type === 'earning'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-[#00C853] dark:text-emerald-400'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {transaction.type === 'earning' ? (
                      <ArrowDownRight className="w-6 h-6" />
                    ) : (
                      <ArrowUpRight className="w-6 h-6" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white">{transaction.description}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(transaction.date).toLocaleDateString('en-GB')}
                    </p>
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-xl font-bold ${
                        transaction.type === 'earning' ? 'text-[#00C853]' : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {transaction.type === 'earning' ? '+' : '-'}
                      {transaction.amount}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Points</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
