import { Droplets } from 'lucide-react'

export const PRESETS = [199, 499, 999, 2499]
export const inr = (n) => Number(n || 0).toLocaleString('en-IN')
export const litersFor = (amount) => Math.floor(Number(amount || 0) * 2).toLocaleString('en-IN')

const pill = (active) =>
  `px-4 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
    active
      ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm'
      : 'bg-white border-slate-300 text-slate-800 hover:border-slate-500'
  }`

export default function AmountSelector({ amount, setAmount, preset, setPreset, frequency, setFrequency, error }) {
  const choose = (p) => { setPreset(p); setAmount(String(p)) }
  const onInput = (e) => {
    const v = e.target.value.replace(/[^\d]/g, '').slice(0, 7)
    setAmount(v)
    setPreset(PRESETS.includes(Number(v)) ? Number(v) : 'other')
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6" aria-labelledby="step-amount">
      <h2 id="step-amount" className="text-lg font-semibold text-slate-900 mb-3">1. Choose your amount</h2>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Preset amounts">
        {PRESETS.map((p) => (
          <button key={p} id={`amount-${p}`} type="button" aria-pressed={preset === p} className={pill(preset === p)} onClick={() => choose(p)}>
            ₹{inr(p)}
          </button>
        ))}
        <button id="amount-other" type="button" aria-pressed={preset === 'other'} className={pill(preset === 'other')}
          onClick={() => { setPreset('other'); document.getElementById('custom-amount')?.focus() }}>
          Other amount
        </button>
      </div>

      <label htmlFor="custom-amount" className="block text-sm font-semibold text-slate-800 mt-4 mb-1.5">Enter any amount</label>
      <div className={`flex items-center rounded-xl border-2 px-4 h-14 bg-white transition-colors ${error ? 'border-red-500' : 'border-zinc-900 focus-within:border-emerald-600'}`}>
        <span className="text-xl font-semibold text-slate-900 mr-2">₹</span>
        <input id="custom-amount" inputMode="numeric" value={amount ? inr(amount) : ''} onChange={onInput}
          placeholder="1,500" aria-invalid={!!error}
          className="flex-1 text-xl font-semibold text-slate-900 outline-none bg-transparent border-0 p-0" />
      </div>
      {error
        ? <p className="text-sm text-red-600 mt-2">{error}</p>
        : <p className="text-sm text-emerald-700 mt-2 flex items-center gap-1.5">
            <Droplets size={15} /> Your ₹{inr(amount)} can fund about {litersFor(amount)} L of verified tanker water.
          </p>}

      <div className="flex gap-2 mt-4" role="group" aria-label="Donation frequency">
        {[['once', 'Donate once'], ['monthly', 'Donate monthly']].map(([k, label]) => (
          <button key={k} id={`freq-${k}`} type="button" aria-pressed={frequency === k} onClick={() => setFrequency(k)}
            className={`px-4 py-2 rounded-full border text-sm font-medium transition-all cursor-pointer ${
              frequency === k ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-slate-300 text-slate-800 hover:border-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>
    </section>
  )
}
