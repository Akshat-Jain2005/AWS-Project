import { useState } from 'react'
import {
  ChevronRight,
  CreditCard,
  Landmark,
  Wallet,
  Smartphone,
  Check,
  Search,
  Lock,
  Building2,
  ArrowRight,
} from 'lucide-react'
import { inr } from './AmountSelector'

export const UPI_APPS = [
  { id: 'gpay', name: 'GPay' },
  { id: 'phonepe', name: 'PhonePe' },
  { id: 'paytm', name: 'Paytm' },
]

const TOP_BANKS = [
  { id: 'sbi', name: 'State Bank of India', short: 'SBI' },
  { id: 'hdfc', name: 'HDFC Bank', short: 'HDFC' },
  { id: 'icici', name: 'ICICI Bank', short: 'ICICI' },
  { id: 'axis', name: 'Axis Bank', short: 'Axis' },
  { id: 'pnb', name: 'Punjab National Bank', short: 'PNB' },
]

const ALL_BANKS = [
  ...TOP_BANKS,
  { id: 'kotak', name: 'Kotak Mahindra Bank', short: 'Kotak' },
  { id: 'bob', name: 'Bank of Baroda', short: 'BOB' },
  { id: 'canara', name: 'Canara Bank', short: 'Canara' },
  { id: 'indusind', name: 'IndusInd Bank', short: 'IndusInd' },
  { id: 'yes', name: 'Yes Bank', short: 'Yes' },
  { id: 'idbi', name: 'IDBI Bank', short: 'IDBI' },
  { id: 'union', name: 'Union Bank of India', short: 'Union' },
  { id: 'federal', name: 'Federal Bank', short: 'Federal' },
  { id: 'rbl', name: 'RBL Bank', short: 'RBL' },
]

export const WALLETS = [
  { id: 'paytm', name: 'Paytm Wallet' },
  { id: 'amazonpay', name: 'Amazon Pay' },
  { id: 'phonepe', name: 'PhonePe Wallet' },
  { id: 'mobikwik', name: 'Mobikwik' },
]

export default function PaymentMethods({
  method,
  setMethod,
  amount,
  onInitiatePayment,
  busy,
}) {
  const [openRail, setOpenRail] = useState('card')
  const [selectedBank, setSelectedBank] = useState('sbi')
  const [bankSearch, setBankSearch] = useState('')
  const [selectedWallet, setSelectedWallet] = useState('paytm')

  const isUpiSelected = method.startsWith('upi:') || method === 'upi'
  const currentUpiAppId = method.startsWith('upi:') ? method.replace('upi:', '') : null

  const filteredBanks = ALL_BANKS.filter(
    (b) =>
      b.name.toLowerCase().includes(bankSearch.toLowerCase()) ||
      b.short.toLowerCase().includes(bankSearch.toLowerCase())
  )

  const activeBankObj = ALL_BANKS.find((b) => b.id === selectedBank) || TOP_BANKS[0]
  const activeWalletObj = WALLETS.find((w) => w.id === selectedWallet) || WALLETS[0]

  return (
    <section
      className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6"
      aria-labelledby="step-payment"
    >
      <h2 id="step-payment" className="text-lg font-semibold text-slate-900 mb-3">
        3. Payment method
      </h2>
      <p className="text-sm text-emerald-700 bg-stone-100 rounded-md px-3 py-2 mb-3">
        Suggested: pay directly from your bank account with UPI
      </p>

      {/* UPI Quick Selector */}
      <div
        className={`rounded-xl border-2 p-4 transition-colors ${
          isUpiSelected ? 'border-zinc-900 bg-stone-50/60' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <Smartphone size={16} className="text-slate-700" />
          <p className="font-semibold text-slate-900">UPI Options (Razorpay)</p>
        </div>
        <p className="text-sm text-slate-600 mb-2">
          Pay via Razorpay Test Gateway. In the Razorpay popup, select <strong>UPI</strong> and enter{' '}
          <code className="text-xs font-mono bg-stone-200 text-stone-800 px-1.5 py-0.5 rounded">success@razorpay</code>{' '}
          (or click the green <strong>Success</strong> test button).
        </p>

        <div className="flex flex-wrap gap-2.5" role="group" aria-label="Select UPI Application">
          {UPI_APPS.map((a) => {
            const isSelected = isUpiSelected && currentUpiAppId === a.id
            return (
              <button
                key={a.id}
                id={`upi-${a.id}`}
                type="button"
                className={`inline-flex items-center gap-2 h-10 px-4 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100 shadow-xs'
                    : 'border-slate-300 bg-white text-slate-800 hover:border-slate-500'
                }`}
                aria-pressed={isSelected}
                onClick={() => {
                  setMethod(`upi:${a.id}`)
                  setOpenRail(null)
                  onInitiatePayment('upi')
                }}
              >
                {isSelected && <Check size={15} strokeWidth={2.5} />}
                {a.name}
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-sm font-semibold text-slate-800 mt-5 mb-2">Other payment options</p>

      <div className="space-y-3">
        {/* Rail 1: Cards */}
        <div
          className={`rounded-xl border transition-colors ${
            method === 'card' ? 'border-zinc-900' : 'border-slate-200'
          }`}
        >
          <button
            id="rail-card"
            type="button"
            aria-expanded={openRail === 'card'}
            onClick={() => {
              setOpenRail(openRail === 'card' ? null : 'card')
              setMethod('card')
            }}
            className="w-full flex items-center gap-3 text-left px-4 py-3 bg-transparent border-0 cursor-pointer"
          >
            <CreditCard size={18} className="text-slate-600 shrink-0" />
            <span className="flex-1">
              <span className="block font-semibold text-slate-900 text-[15px]">Credit and Debit Cards</span>
              <span className="block text-sm text-slate-600">Visa, Mastercard, Amex, RuPay</span>
            </span>
            <ChevronRight
              size={16}
              className={`text-slate-500 transition-transform ${openRail === 'card' ? 'rotate-90' : ''}`}
            />
          </button>

          {openRail === 'card' && (
            <div className="bs-fade px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
              <p className="text-sm text-slate-600">
                Pay securely with any Indian or International Credit & Debit Card through Razorpay's 3D-Secure modal.
              </p>
              <button
                id="pay-card-btn"
                type="button"
                onClick={() => onInitiatePayment('card')}
                disabled={busy}
                className="w-full h-11 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold border-0 cursor-pointer flex items-center justify-center gap-2 transition-all mt-2 active:scale-[0.99] disabled:opacity-75 shadow-sm"
              >
                <Lock size={15} />
                <span>Pay ₹{inr(amount)} with Card via Razorpay</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Rail 2: Net Banking */}
        <div
          className={`rounded-xl border transition-colors ${
            method === 'netbanking' ? 'border-zinc-900' : 'border-slate-200'
          }`}
        >
          <button
            id="rail-netbanking"
            type="button"
            aria-expanded={openRail === 'netbanking'}
            onClick={() => {
              setOpenRail(openRail === 'netbanking' ? null : 'netbanking')
              setMethod('netbanking')
            }}
            className="w-full flex items-center gap-3 text-left px-4 py-3 bg-transparent border-0 cursor-pointer"
          >
            <Landmark size={18} className="text-slate-600 shrink-0" />
            <span className="flex-1">
              <span className="block font-semibold text-slate-900 text-[15px]">Net Banking</span>
              <span className="block text-sm text-slate-600">40+ banks available</span>
            </span>
            <ChevronRight
              size={16}
              className={`text-slate-500 transition-transform ${openRail === 'netbanking' ? 'rotate-90' : ''}`}
            />
          </button>

          {openRail === 'netbanking' && (
            <div className="bs-fade px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
              <p className="text-xs font-semibold text-slate-700">Popular Banks</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TOP_BANKS.map((b) => {
                  const isBankSelected = selectedBank === b.id
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBank(b.id)}
                      className={`h-11 px-3 rounded-lg border text-left text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                        isBankSelected
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-100'
                          : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
                      }`}
                    >
                      <Building2 size={14} className={isBankSelected ? 'text-emerald-700' : 'text-slate-500'} />
                      <span className="truncate">{b.short}</span>
                    </button>
                  )
                })}
              </div>

              <div>
                <label htmlFor="all-banks-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  Or select from all banks
                </label>
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search bank name..."
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 text-xs outline-none bg-white text-zinc-900 focus:border-emerald-600"
                  />
                </div>
                <select
                  id="all-banks-select"
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm outline-none bg-white text-zinc-900 focus:border-emerald-600 cursor-pointer"
                >
                  {filteredBanks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                id="pay-netbanking-btn"
                type="button"
                onClick={() => onInitiatePayment('netbanking')}
                disabled={busy}
                className="w-full h-11 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold border-0 cursor-pointer flex items-center justify-center gap-2 transition-all mt-2 active:scale-[0.99] disabled:opacity-75 shadow-sm"
              >
                <Landmark size={15} />
                <span>Proceed to {activeBankObj.short} Net Banking via Razorpay</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Rail 3: Wallets */}
        <div
          className={`rounded-xl border transition-colors ${
            method === 'wallet' ? 'border-zinc-900' : 'border-slate-200'
          }`}
        >
          <button
            id="rail-wallet"
            type="button"
            aria-expanded={openRail === 'wallet'}
            onClick={() => {
              setOpenRail(openRail === 'wallet' ? null : 'wallet')
              setMethod('wallet')
            }}
            className="w-full flex items-center gap-3 text-left px-4 py-3 bg-transparent border-0 cursor-pointer"
          >
            <Wallet size={18} className="text-slate-600 shrink-0" />
            <span className="flex-1">
              <span className="block font-semibold text-slate-900 text-[15px]">Wallets</span>
              <span className="block text-sm text-slate-600">Paytm, Amazon Pay, PhonePe, Mobikwik</span>
            </span>
            <ChevronRight
              size={16}
              className={`text-slate-500 transition-transform ${openRail === 'wallet' ? 'rotate-90' : ''}`}
            />
          </button>

          {openRail === 'wallet' && (
            <div className="bs-fade px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {WALLETS.map((w) => {
                  const isWSelected = selectedWallet === w.id
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setSelectedWallet(w.id)}
                      className={`h-11 px-3 rounded-lg border text-left text-sm font-semibold transition-all flex items-center justify-between cursor-pointer ${
                        isWSelected
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-100'
                          : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
                      }`}
                    >
                      <span>{w.name}</span>
                      {isWSelected && <Check size={16} className="text-emerald-700" />}
                    </button>
                  )
                })}
              </div>

              <button
                id="pay-wallet-btn"
                type="button"
                onClick={() => onInitiatePayment('wallet')}
                disabled={busy}
                className="w-full h-11 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold border-0 cursor-pointer flex items-center justify-center gap-2 transition-all mt-2 active:scale-[0.99] disabled:opacity-75 shadow-sm"
              >
                <Wallet size={15} />
                <span>Pay ₹{inr(amount)} with {activeWalletObj.name} via Razorpay</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
