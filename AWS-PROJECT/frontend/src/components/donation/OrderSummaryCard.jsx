import { Lock, Loader2 } from 'lucide-react'
import { inr } from './AmountSelector'

export default function OrderSummaryCard({ amount, frequency, onPay, busy }) {
  const label = `₹${inr(amount)}`
  return (
    <aside className="lg:sticky lg:top-6 space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <span className="text-lg font-semibold text-slate-900">Total due</span>
          <span className="text-lg font-bold text-slate-900 tabular-nums">{label}</span>
        </div>
        <dl className="text-sm mt-3 space-y-1.5">
          <div className="flex justify-between text-slate-700">
            <dt>Donation{frequency === 'monthly' ? ' (monthly)' : ''}</dt>
            <dd className="tabular-nums font-medium text-slate-900">{label}</dd>
          </div>
          <div className="flex justify-between text-slate-700">
            <dt>Platform fee</dt>
            <dd className="text-emerald-700 font-medium">₹0</dd>
          </div>
        </dl>
        <button
          id="pay-cta"
          type="button"
          onClick={onPay}
          disabled={busy}
          className="mt-4 w-full h-12 rounded-xl bg-zinc-900 hover:bg-black text-white font-semibold border-0 cursor-pointer transition-all active:scale-[.99] disabled:opacity-70 flex items-center justify-center gap-2 shadow-sm"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : null}
          Pay {label}
        </button>
        <p className="text-xs text-slate-500 mt-2.5 flex items-center justify-center gap-1.5 font-medium">
          <Lock size={12} /> Secure payment powered by Razorpay
        </p>
      </div>
    </aside>
  )
}
