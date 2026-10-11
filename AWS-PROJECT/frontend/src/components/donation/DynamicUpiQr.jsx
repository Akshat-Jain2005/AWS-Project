import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Check, Copy, ExternalLink, ShieldCheck } from 'lucide-react'
import { inr } from './AmountSelector'

export const MERCHANT_VPA = 'pankaj.bansal78.pb@okhdfcbank'
export const MERCHANT_NAME = 'Bio-Sentinel'

export function buildUpiUrl(amount) {
  const am = Number(amount || 0).toFixed(2)
  return `upi://pay?pa=${encodeURIComponent(MERCHANT_VPA)}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${am}&cu=INR&tn=${encodeURIComponent('Donation to Bio-Sentinel Relief Fund')}`
}

export default function DynamicUpiQr({ amount, size = 220 }) {
  const [copied, setCop] = useState(false)
  const upiUrl = buildUpiUrl(amount)

  const copyVpa = async () => {
    try {
      await navigator.clipboard.writeText(MERCHANT_VPA)
      setCop(true)
      setTimeout(() => setCop(false), 2000)
    } catch {
      // Fallback if clipboard API is restricted
      const el = document.createElement('textarea')
      el.value = MERCHANT_VPA
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCop(true)
      setTimeout(() => setCop(false), 2000)
    }
  }

  return (
    <div className="w-full flex flex-col items-center text-center">
      {/* Verified Badge */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-xs mb-3">
        <ShieldCheck size={14} className="text-emerald-400" />
        <span>Verified Merchant: {MERCHANT_NAME}</span>
      </div>

      {/* Amount Display */}
      <div className="mb-3">
        <p className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Total Amount</p>
        <p className="text-3xl font-extrabold text-white tracking-tight tabular-nums mt-0.5">
          ₹{inr(amount)}
        </p>
      </div>

      {/* Dynamic SVG QR Container */}
      <div className="bg-white p-3.5 rounded-2xl shadow-xl border border-slate-200/80 flex items-center justify-center">
        <QRCodeSVG
          value={upiUrl}
          size={size}
          level="H"
          includeMargin={true}
          className="rounded-lg"
        />
      </div>

      {/* Payee VPA Details & Copy Button */}
      <div className="mt-3.5 w-full max-w-[280px]">
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
          <span className="font-mono text-zinc-300 truncate select-all">{MERCHANT_VPA}</span>
          <button
            type="button"
            onClick={copyVpa}
            aria-label="Copy UPI ID"
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-0 cursor-pointer text-[11px] font-medium transition-colors"
          >
            {copied ? (
              <>
                <Check size={12} className="text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Direct Deep-Link Button */}
      <div className="mt-3 w-full max-w-[280px]">
        <a
          href={upiUrl}
          className="w-full h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs tracking-wide flex items-center justify-center gap-2 no-underline transition-all shadow-md active:scale-[0.99]"
        >
          <span>Pay via UPI App</span>
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  )
}
