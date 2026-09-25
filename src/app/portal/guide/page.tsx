/**
 * Partner Guide — in-depth onboarding tutorial + reference for the portal.
 * Bilingual, chaptered, written for a first-time user who may never have
 * used a government platform before. Static content, no data required.
 */

import Link from 'next/link';

export const dynamic = 'force-dynamic';

function Chapter({
  no, en, ar, children,
}: { no: string; en: string; ar: string; children: React.ReactNode }) {
  return (
    <section id={`ch-${no}`} className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="section-rule" aria-hidden />
          <h2 className="text-xl font-semibold tracking-tight text-brand-800">
            <span className="mr-2 font-mono text-sm text-gold-600">{no}</span>
            {en}
          </h2>
          <div className="text-brand-700">{ar}</div>
        </div>
      </div>
      <div className="space-y-4 text-[15px] leading-relaxed text-ink">{children}</div>
    </section>
  );
}

function Step({ n, en, ar }: { n: number; en: React.ReactNode; ar?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">
        {n}
      </div>
      <div>
        <div>{en}</div>
        {ar && <div className="text-sm text-brand-700">{ar}</div>}
      </div>
    </div>
  );
}

function Callout({ tone = 'info', children }: { tone?: 'info' | 'gold' | 'warn'; children: React.ReactNode }) {
  const styles = {
    info: 'border-brand-200 bg-brand-50 text-brand-800',
    gold: 'border-gold-300 bg-gold-50 text-gold-700',
    warn: 'border-amber-300 bg-amber-50 text-amber-800',
  }[tone];
  return <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${styles}`}>{children}</div>;
}

export default function PartnerGuidePage() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-2xl p-6 text-white shadow-card-hover sm:p-8"
        style={{ background: 'linear-gradient(135deg, #0C3B43, #124E57 60%, #17606B)' }}
      >
        <div className="dot-grid absolute inset-0 opacity-60" aria-hidden />
        <div className="relative">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/70">Partner Guide · دليل الشريك</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything you need to use the Partner Network
          </h1>
          <div className="mt-1 text-lg text-white/85">كل ما تحتاجه لاستخدام شبكة الشركاء — خطوة بخطوة</div>
          <p className="mt-3 max-w-2xl text-sm text-white/75">
            Ten short chapters. Read the first three and you are ready; the rest is reference for
            whenever you need it. And remember — you can always just ask Abdullah.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {[
              ['01', 'Start here'], ['02', 'First 10 minutes'], ['03', 'Abdullah'], ['04', 'Quarterly report'],
              ['05', 'Membership ladder'], ['06', 'Collection'], ['07', 'Marketplace'], ['08', 'Applications'],
              ['09', 'Sustainability'], ['10', 'FAQ'],
            ].map(([n, t]) => (
              <a key={n} href={`#ch-${n}`} className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-white/90 transition hover:bg-white/20">
                {n} · {t}
              </a>
            ))}
          </div>
        </div>
      </section>

      <Chapter no="01" en="What this platform is" ar="ما هي هذه المنصة">
        <p>
          The UAE Palm Network is the official digital home of your relationship with the
          National Center for Palms and Dates. Your membership, your quarterly reports, your
          certificates, your benefits — everything lives here, in one place, in your language.
        </p>
        <p className="ar text-right text-brand-800" dir="rtl">
          شبكة نخيل الإمارات هي بيتكم الرقمي الرسمي في الشبكة: عضويتكم
          وتقاريركم الربعية وشهاداتكم ومزاياكم — كلها في مكان واحد وبلغتكم.
        </p>
        <Callout tone="gold">
          <b>The one rule that matters:</b> the more complete your quarterly reporting, the higher
          your standing — and the more the Center can do for you. Reporting is how you climb.
          · <span dir="rtl">التقارير هي طريق الصعود</span>
        </Callout>
      </Chapter>

      <Chapter no="02" en="Your first 10 minutes" ar="أول عشر دقائق">
        <Step n={1} en={<>Open <Link href="/portal/profile" className="text-brand-600 underline underline-offset-2">Profile</Link> and check what the Center knows about your facility — palm count, varieties, capacity, contact. Fill anything missing. The completeness meter shows you how far along you are.</>} ar="أكمل ملف منشأتك — عداد الاكتمال يدلك على الناقص" />
        <Step n={2} en={<>Tap the <b>Abdullah</b> button (bottom corner of every screen) and say hello. He already knows your registry number and history — try asking him anything about your membership.</>} ar="اضغط زر عبدالله وسلّم عليه — يعرف سجلكم مسبقًا" />
        <Step n={3} en={<>Look at your <Link href="/portal" className="text-brand-600 underline underline-offset-2">home screen</Link>: your tier card shows where you stand and exactly how many approved quarters remain to the next level.</>} ar="بطاقة العضوية تريكم موقعكم وكم بقي للمستوى التالي" />
        <Callout>
          Nothing here requires training. If you are ever unsure what to do next, the answer is
          always the same: <b>ask Abdullah</b>. · <span dir="rtl">إذا احترتم، اسألوا عبدالله</span>
        </Callout>
      </Chapter>

      <Chapter no="03" en="Meet Abdullah — your one door to the network" ar="عبدالله — بابكم الواحد إلى الشبكة">
        <p>
          Abdullah is the Center&apos;s agentic director. He is not a form and not a call center —
          he is a concierge who remembers every conversation. Talk to him the way you would talk to
          a trusted colleague, in Arabic or English, formally or casually.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-mist p-4">
            <div className="mb-2 text-sm font-semibold text-brand-800">Abdullah can:</div>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Complete your entire quarterly report with you in chat</li>
              <li>Read an Excel file in <b>any layout</b> — even messy ones</li>
              <li>Read photos of paper ledgers and handwritten notes</li>
              <li>Tell you your regional benchmark after every submission</li>
              <li>Open a waste-collection ticket for you</li>
              <li>Submit award and grant applications for you</li>
              <li>Update your profile so you are never asked twice</li>
            </ul>
          </div>
          <div className="rounded-xl bg-mist p-4">
            <div className="mb-2 text-sm font-semibold text-brand-800">Abdullah will never:</div>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Promise a tier change or certification — those are <b>approved by network officials only</b></li>
              <li>Show you another partner&apos;s data — benchmarks are always aggregates</li>
              <li>Scold you for a late quarter — there is always an easy path back</li>
            </ul>
          </div>
        </div>
        <Callout tone="gold">
          Good first messages to try: <i>&quot;وش وضع تقريري لهذا الربع؟&quot;</i> ·
          <i> &quot;How do I reach the next tier?&quot;</i> ·
          <i> &quot;عندي سعف كثير — وش أسوي فيه؟&quot;</i>
        </Callout>
      </Chapter>

      <Chapter no="04" en="The quarterly report — three ways to submit" ar="التقرير الربعي — ثلاث طرق">
        <p>Once a quarter, the Center asks every partner what happened: what you produced, what you sold, and where your byproducts went. Choose whichever way is easiest for you:</p>
        <Step n={1} en={<><b>Just chat.</b> Tell Abdullah your figures in plain words. He will play back what he understood and ask only for what is genuinely missing — at most a question or two.</>} ar="بالمحادثة: قولوا الأرقام وعبدالله يرتبها" />
        <Step n={2} en={<><b>Send any file.</b> Attach your own Excel, in your own layout, with your own units — kg, tons, mixed, it does not matter. Abdullah converts and structures everything, then asks you to confirm.</>} ar="بالملف: أرسلوا إكسل بأي تنسيق وبأي وحدات" />
        <Step n={3} en={<><b>Send a photo.</b> A picture of your paper ledger or handwritten notes works too.</>} ar="بالصورة: صورة الدفتر أو الملاحظات تكفي" />
        <p>
          After you confirm and submit, the Center&apos;s validation team checks the figures against
          your history and regional patterns. Once an official approves the report, it counts toward
          your tier — and you immediately receive your <b>regional benchmark</b> and one practical
          insight in return. If something looks unusual, Abdullah will come back with a friendly
          question, never an accusation.
        </p>
        <Callout>
          <b>Never asked twice:</b> anything you tell Abdullah once — palm count, varieties,
          irrigation, contacts — is remembered. Future reports get faster every quarter.
        </Callout>
      </Chapter>

      <Chapter no="05" en="The membership ladder, certificates, and standing" ar="سلّم العضوية والشهادات">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="p-2">Tier</th><th className="p-2">How you earn it</th><th className="p-2">What it unlocks</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Registered · مسجّل', 'Join the network', 'Portal access, Abdullah, announcements'],
                ['Active · نشط', '2 consecutive approved quarters', 'Marketplace listings, collection priority'],
                ['Certified · معتمد', '4 consecutive approved quarters + validated data', 'Official certificate, awards eligibility, benchmark reports'],
                ['Elite · نخبة', 'Sustained excellence + verified waste diversion', 'Gold certificate, national recognition, first access to programs'],
              ].map(([t, e, u]) => (
                <tr key={t} className="border-t border-line/70">
                  <td className="p-2 font-medium text-brand-800">{t}</td><td className="p-2">{e}</td><td className="p-2">{u}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          From <b>Certified</b> upward you can download your official bilingual certificate from your
          home screen (the &quot;Certificate · الشهادة&quot; button on your tier card). Every
          certificate carries a QR code — anyone who scans it sees a live confirmation of your
          standing from the Center, without any of your figures. Show it to buyers, banks, anyone.
        </p>
        <p>
          <b>Standing</b> is separate from tier: <b>Good</b> means your reporting is current;
          <b> At-risk</b> means one quarter was missed; <b>Paused</b> means two or more. Nothing is
          ever taken away permanently — completing your record with Abdullah restores standing.
        </p>
        <Callout tone="gold">
          <b>Certification is annual.</b> Your certificate carries a year seal (e.g. {new Date().getUTCFullYear()})
          and is valid through 31 December — it renews automatically as long as your quarterly
          reporting stays current. A full year without an approved report lapses the certification
          (by official decision, with re-certification always open). The yearly stamp is what makes
          the certificate credible to buyers and banks: it proves the data behind it is fresh.
          · <span dir="rtl">الشهادة سنوية وتتجدد تلقائيًا بتقاريركم</span>
        </Callout>
      </Chapter>

      <Chapter no="06" en="Waste collection tickets" ar="تذاكر جمع النواتج">
        <Step n={1} en={<><b>Post:</b> when you have fronds, pits, or other byproducts ready, open <Link href="/portal/collection" className="text-brand-600 underline underline-offset-2">Collection</Link> (or tell Abdullah) and post a ticket: what, how much, where.</>} />
        <Step n={2} en={<><b>Claimed:</b> a recycler or collector in the network claims your ticket. You see who, and when they are coming.</>} />
        <Step n={3} en={<><b>Collected:</b> after pickup you confirm — and the transfer is recorded in the national traceability ledger. Verified diversion counts toward Elite.</>} />
        <Callout tone="gold">Material that used to be burned or buried becomes a recorded contribution — and a step up the ladder.</Callout>
      </Chapter>

      <Chapter no="07" en="The marketplace" ar="السوق">
        <p>
          List surplus dates, pits, fronds, or processing capacity in
          {' '}<Link href="/portal/market" className="text-brand-600 underline underline-offset-2">Market</Link>,
          and browse what other members offer. Interested parties connect through the platform;
          prices and payment are agreed <b>directly between you</b> — the Center hosts the
          matchmaking, not the transaction.
        </p>
      </Chapter>

      <Chapter no="08" en="Applications — awards, honors, grants" ar="الطلبات — الجوائز والمنح">
        <p>
          In <Link href="/portal/applications" className="text-brand-600 underline underline-offset-2">Applications</Link> you
          can apply for national awards, honorable mentions, and support programs. Write it yourself
          or dictate it to Abdullah — he will structure the application properly. Every application
          is reviewed and decided by network officials; you will see the status change in the same page.
        </p>
      </Chapter>

      <Chapter no="09" en="Your sustainability page" ar="صفحة الاستدامة">
        <p>
          <Link href="/portal/esg" className="text-brand-600 underline underline-offset-2">Sustainability</Link> shows
          the estimated climate contribution of your verified waste diversion — the tons of CO₂e
          avoided because your fronds were recycled instead of burned.
        </p>
        <Callout tone="warn">
          These figures are <b>indicative estimates</b>, clearly labeled — they are not tradeable
          carbon credits. As the UAE&apos;s carbon-market infrastructure matures, partners with a verified
          diversion history will be best placed. Your reporting today is your eligibility tomorrow.
        </Callout>
      </Chapter>

      <Chapter no="10" en="Common questions" ar="أسئلة شائعة">
        <div className="space-y-3">
          {[
            ['Who sees my numbers? · من يرى أرقامي؟',
             'Only the network team. Other partners never see your data. Regional benchmarks are aggregates of at least three partners — individual figures are never exposed. This is a hard rule of the platform.'],
            ['I made a mistake in a submitted report. · أخطأت في تقرير مرسل',
             'Tell Abdullah. If the report is still in review he corrects it directly; if it was already approved he will route a correction to the Center.'],
            ['Can I use the platform only in Arabic? · هل أستطيع استخدام المنصة بالعربية فقط؟',
             'Yes. Tell Abdullah once — he will remember and speak Arabic first, always.'],
            ['I missed a quarter. Am I in trouble? · فاتني ربع — هل هناك مشكلة؟',
             'No. Your standing shows At-risk so you know, and completing the record with Abdullah — even late — restores it. The Center never penalizes; it invites you back.'],
            ['Who do I contact for something Abdullah cannot solve? · لمن أرفع ما لا يحله عبدالله؟',
             'Use Your Voice to send a request or complaint directly to network staff — every entry is read and tracked in the Center’s inbox.'],
          ].map(([q, a]) => (
            <div key={q} className="rounded-xl border border-line bg-mist/50 p-4">
              <div className="text-sm font-semibold text-brand-800">{q}</div>
              <p className="mt-1 text-sm">{a}</p>
            </div>
          ))}
        </div>
      </Chapter>

      <div className="rounded-2xl border border-gold-300 bg-gold-50 p-5 text-center text-sm text-gold-700">
        Still unsure about anything? Open the chat and ask —{' '}
        <Link href="/portal/chat" className="font-semibold underline underline-offset-2">Abdullah is online now</Link>
        {' '}· عبدالله متصل الآن
      </div>
    </div>
  );
}
