const field = (err) =>
  `w-full h-11 rounded-lg border px-3 text-[15px] text-zinc-900 bg-white outline-none transition-all placeholder:text-slate-400 ${
    err ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'}`

export default function DonorDetailsForm({ donor, setDonor, errors }) {
  const set = (k) => (e) => setDonor((d) => ({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const onPhone = (e) => setDonor((d) => ({ ...d, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6" aria-labelledby="step-details">
      <h2 id="step-details" className="text-lg font-semibold text-slate-900 mb-3">2. Your details</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="donor-name" className="block text-sm font-semibold text-slate-800 mb-1.5">Full name</label>
          <input
            id="donor-name"
            className={field(errors.name)}
            placeholder="Aarav Sharma"
            value={donor.name}
            onChange={set('name')}
            autoComplete="name"
          />
          {errors.name && <p className="text-xs text-red-600 mt-1 font-medium">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="donor-phone" className="block text-sm font-semibold text-slate-800 mb-1.5">Mobile number</label>
          <div
            className={`flex items-center rounded-lg border bg-white overflow-hidden transition-all ${
              errors.phone
                ? 'border-red-500 ring-2 ring-red-100'
                : 'border-slate-300 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500'
            }`}
          >
            <span className="flex items-center justify-center px-3 py-2.5 text-black font-medium border-r border-slate-200 select-none bg-slate-50 text-[15px] h-11">
              +91
            </span>
            <input
              id="donor-phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="9876543210"
              className="flex-1 px-3 py-2.5 text-black outline-none bg-transparent placeholder:text-slate-400 text-[15px] font-medium h-11"
              value={donor.phone}
              onChange={onPhone}
              autoComplete="tel-national"
            />
          </div>
          {errors.phone && <p className="text-xs text-red-600 mt-1 font-medium">{errors.phone}</p>}
        </div>
      </div>
      <div className="mt-3">
        <label htmlFor="donor-email" className="block text-sm font-semibold text-slate-800 mb-1.5">Email for receipt</label>
        <input
          id="donor-email"
          type="email"
          className={field(errors.email)}
          placeholder="aarav@example.com"
          value={donor.email}
          onChange={set('email')}
          autoComplete="email"
        />
        {errors.email && <p className="text-xs text-red-600 mt-1 font-medium">{errors.email}</p>}
      </div>
      <label htmlFor="donor-anon" className="flex items-start gap-2.5 mt-3 cursor-pointer text-sm text-slate-700">
        <input
          id="donor-anon"
          type="checkbox"
          checked={donor.anonymous}
          onChange={set('anonymous')}
          className="mt-0.5 w-4 h-4 accent-emerald-600"
        />
        <span>
          <strong className="text-slate-900">Donate anonymously.</strong> Hide my name on the public donor wall. My receipt is still emailed to me.
        </span>
      </label>
    </section>
  )
}
