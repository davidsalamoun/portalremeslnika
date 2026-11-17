import React, { useEffect, useRef, useState } from 'react';
import { OPERATOR } from '../config/operator';
import { PrivacyLink } from './PrivacyPolicy';
import { Check, RotateCcw } from 'lucide-react';
import { Logo, Metr } from './Logo';

/**
 * Úvodní stránka pro nepřihlášené: co aplikace umí, živá ukázka zakázky, podpis na zkoušku a cesta k registraci.
 * Přihlášený uživatel ji nevidí (AuthGate ho pustí rovnou do aplikace).
 */
interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
}

const STAGES = ['Poptávka', 'Nabídka', 'Smlouva', 'Realizace', 'Předáno', 'Zaplaceno'];

// Ukázkové zakázky podle řemesla (vymyšlené, jen pro ukázku na úvodní stránce)
const CRAFTS = [
  { key: 'obklady', label: 'Obklady', title: 'Rekonstrukce koupelny', client: 'Marek Dvořák, Černošice', price: '38 000 Kč', items: '4 položky', photos: '12 fotek, 5 zápisů' },
  { key: 'elektro', label: 'Elektro', title: 'Elektroinstalace v bytě 3+1', client: 'Jana Malá, Kladno', price: '64 000 Kč', items: '6 položek', photos: '9 fotek, revize' },
  { key: 'malovani', label: 'Malování', title: 'Výmalba bytu 2+kk', client: 'Petr Novotný, Brno', price: '14 500 Kč', items: '3 položky', photos: '6 fotek, 2 zápisy' },
  { key: 'sadrokarton', label: 'Sádrokarton', title: 'Podhled v obývacím pokoji', client: 'Eva Králová, Beroun', price: '27 800 Kč', items: '4 položky', photos: '8 fotek, 3 zápisy' },
  { key: 'podlahy', label: 'Podlahy', title: 'Vinylová podlaha 45 m²', client: 'Tomáš Beneš, Plzeň', price: '32 400 Kč', items: '5 položek', photos: '7 fotek, 2 zápisy' },
] as const;
type Craft = (typeof CRAFTS)[number];

// Co se v každé fázi děje a jaký doklad přibude
const demoSteps = (c: Craft): { next: string; doc?: { title: string; note: string; kind?: 'sign' | 'paid' } }[] => [
  { next: 'Obhlídka v úterý v 9:00' },
  { next: 'Čeká na potvrzení nabídky', doc: { title: 'Cenová nabídka', note: `${c.price}, ${c.items}` } },
  { next: 'Zákazník podepsal v mobilu', doc: { title: 'Smlouva o dílo', note: '', kind: 'sign' } },
  { next: 'Po dokončení předat dílo protokolem', doc: { title: 'Fotky a deník', note: c.photos } },
  { next: 'Vystavit fakturu', doc: { title: 'Předávací protokol', note: 'Podepsáno bez vad' } },
  { next: 'Hotovo', doc: { title: 'Faktura s QR platbou', note: `Zaplaceno ${c.price}`, kind: 'paid' } },
];

const STEPS = [
  ['Poptávka', 'Zapíšete telefonát a obhlídku do kalendáře.'],
  ['Nabídka', 'Rozpočet z vlastního ceníku nebo šablony řemesla.'],
  ['Smlouva', 'Smlouva o dílo, zákazník ji podepíše v mobilu.'],
  ['Realizace', 'Fotky, deník, náklady, dodatky na vícepráce.'],
  ['Předáno', 'Předávací protokol a záruční list.'],
  ['Zaplaceno', 'Faktura s QR platbou a připomínka splatnosti.'],
];

const FAQ = [
  ['Kolik to stojí?', 'Teď ve zkušebním provozu nic. Než se cokoli změní, dozvíte se to předem.'],
  ['Kde jsou moje data?', 'V telefonu nebo počítači a ve vašem účtu na serveru v EU (Paříž). Nikomu je neprodáváme.'],
  ['Nahradí mi to právníka nebo účetní?', 'Ne. Vzory smluv a přehled daní jsou pomůcka, důležité věci si ověřte.'],
  ['Potřebuji něco instalovat?', 'Ne, stačí prohlížeč. Na telefonu si aplikaci můžete přidat na plochu.'],
];

const yellowButton =
  'min-h-12 px-5 inline-flex items-center justify-center rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold cursor-pointer transition-colors';
const whiteOutline =
  'min-h-12 px-5 inline-flex items-center justify-center rounded-md border-[1.5px] border-white text-white font-semibold hover:bg-white/10 cursor-pointer transition-colors';
const sectionTitle = 'font-display font-semibold text-3xl sm:text-[40px] leading-tight text-slate-900 dark:text-white';
const muted = 'text-slate-600 dark:text-slate-400';

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Zakázka, která v úvodu sama projde od poptávky po zaplacení (bez animací rovnou hotová). Návštěvník si nahoře
 * vybere své řemeslo a ukázka se přepne na zakázku z jeho oboru.
 */
const LiveJob: React.FC = () => {
  const [craft, setCraft] = useState<Craft>(CRAFTS[0]);
  const [step, setStep] = useState(() => (prefersReducedMotion() ? 5 : 0));
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = window.setTimeout(() => setStep((s) => (s + 1) % 6), step === 5 ? 3200 : 1700);
    return () => window.clearTimeout(timer);
  }, [step, craft]);
  const pickCraft = (c: Craft) => {
    if (c.key === craft.key) return;
    setCraft(c);
    setStep(prefersReducedMotion() ? 5 : 0);
  };

  const demo = demoSteps(craft);
  const docs = demo.slice(0, step + 1).filter((d) => d.doc);
  return (
    <div className="pb-10 lg:pb-12">
      <div id="uvod-remeslo" className="text-[15px] text-blue-100 mb-2">
        Jaké děláte řemeslo?
      </div>
      <div role="group" aria-labelledby="uvod-remeslo" className="flex flex-wrap gap-2 mb-4">
        {CRAFTS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={c.key === craft.key}
            onClick={() => pickCraft(c)}
            className={`min-h-11 px-3.5 rounded-md border-[1.5px] font-medium cursor-pointer transition-colors ${
              c.key === craft.key ? 'bg-white text-blue-700 border-white' : 'border-white/70 text-white hover:bg-white/10'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div aria-hidden="true">
      <div className="bg-white text-slate-900 border border-slate-200 rounded-md px-5 py-5 shadow-2xl">
        <div className="flex items-baseline justify-between gap-3">
          <div key={craft.key} className="landing-fade min-w-0">
            <div className="font-semibold text-lg">{craft.title}</div>
            <div className="text-[14px] text-slate-600">{craft.client}</div>
          </div>
          <div key={craft.price} className="landing-fade font-display font-bold text-[28px] tabular-nums whitespace-nowrap">{craft.price}</div>
        </div>
        <Metr step={step} done={step === 5} label="" className="mt-4" />
        {/* Na úzkém displeji se popisky nevejdou – fázi říká řádek pod metrem */}
        <div className="hidden sm:grid grid-cols-6 text-[13px] text-slate-600 mt-1.5">
          {STAGES.map((s, i) => (
            <span key={s} className={i === step ? 'font-semibold text-slate-900' : ''}>
              {s}
            </span>
          ))}
        </div>
        <div className="mt-3.5 min-h-6">
          <span className="font-semibold">{STAGES[step]}:</span> <span key={`${craft.key}-${step}`} className="landing-fade">{demo[step].next}</span>
        </div>
      </div>
      {/* Místo pro všechny doklady je vyhrazené předem, aby stránka při animaci neposkakovala */}
      <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-3 gap-2.5 min-h-[222px] sm:min-h-[150px] content-start">
        {docs.map(({ doc }) => (
          <div key={`${craft.key}-${doc!.title}`} className="landing-pop bg-white text-slate-900 border border-slate-200 rounded-sm px-3 py-2.5 text-[13px] shadow-lg">
            <div className="font-display font-semibold text-base leading-tight">{doc!.title}</div>
            {doc!.kind === 'sign' ? (
              <svg width="120" height="30" viewBox="0 0 120 34" className="mt-1">
                <path
                  className="landing-draw"
                  d="M4 26c10-18 16-20 18-8s6 10 12-4 10-10 12 2 8 8 16-6 10-6 14 6 12 4 38-2"
                  fill="none"
                  stroke="#1B3F8B"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <div className={doc!.kind === 'paid' ? 'font-semibold text-emerald-700' : 'text-slate-600'}>
                {doc!.kind === 'paid' && '✓ '}
                {doc!.note}
              </div>
            )}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
};

/** Plocha, kam se návštěvník může podepsat jako zákazník. Nic se neukládá ani neodesílá. */
const TrySignature: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);
  const [done, setDone] = useState(false);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return [((e.clientX - rect.left) * canvas.width) / rect.width, ((e.clientY - rect.top) * canvas.height) / rect.height] as const;
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(...point(e));
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!drawing.current || !ctx) return;
    ctx.lineTo(...point(e));
    ctx.strokeStyle = '#1B3F8B';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setSigned(true);
  };
  const end = () => {
    if (drawing.current && signed) setDone(true);
    drawing.current = false;
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setSigned(false);
    setDone(false);
  };

  return (
    <div>
      <div className="relative h-[190px] bg-white border-[1.5px] border-slate-900 dark:border-slate-400 rounded-md touch-none">
        <canvas
          ref={canvasRef}
          width={1000}
          height={380}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          aria-label="Plocha pro podpis na zkoušku"
          className="w-full h-full block cursor-crosshair rounded-md"
        />
        <div className="absolute left-4 right-4 bottom-9 border-t-[1.5px] border-dotted border-slate-400 pointer-events-none" />
        {!signed && <div className="absolute left-4 bottom-2.5 text-[14px] text-slate-600 pointer-events-none">Podepište se prstem nebo myší</div>}
      </div>
      <div className="mt-2 min-h-11 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="font-semibold text-emerald-700 dark:text-emerald-400">
          {done && (
            <>
              <Check className="inline w-4 h-4 mr-1 -mt-0.5" />
              Takhle snadno. Zhotovitel by teď podpis viděl v aplikaci.
            </>
          )}
        </p>
        {signed && (
          <button type="button" onClick={clear} className="min-h-11 inline-flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-300 underline underline-offset-2 cursor-pointer">
            <RotateCcw className="w-4 h-4" />
            Zkusit znovu
          </button>
        )}
      </div>
    </div>
  );
};

/** QR kód s adresou aplikace, aby si ji návštěvník u počítače otevřel rovnou v telefonu. */
const OpenOnPhone: React.FC = () => {
  const [qr, setQr] = useState('');
  useEffect(() => {
    let active = true;
    import('qrcode')
      .then((m) => m.toDataURL(window.location.origin, { margin: 1, width: 184, color: { dark: '#1A1D21', light: '#FFFFFF' } }))
      .then((url) => active && setQr(url))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  if (!qr) return null;
  return (
    <div className="hidden lg:flex mt-6 max-w-lg items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-4 py-3.5">
      <img src={qr} alt="QR kód s adresou aplikace" width={92} height={92} className="shrink-0 bg-white" />
      <div>
        <div className="font-semibold text-slate-900 dark:text-white">Otevřete si to v mobilu</div>
        <div className={muted}>Naskenujte kód telefonem – na stavbě budete aplikaci používat hlavně tam.</div>
      </div>
    </div>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onRegister }) => {
  const year = new Date().getFullYear();
  // Na mobilu se po odrolování pod úvod přilepí dole tlačítko „Založit účet“; u závěrečné výzvy zase zmizí
  const heroCta = useRef<HTMLDivElement>(null);
  const finalCta = useRef<HTMLDivElement>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  const [finalVisible, setFinalVisible] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === heroCta.current) setHeroVisible(entry.isIntersecting);
        if (entry.target === finalCta.current) setFinalVisible(entry.isIntersecting);
      }
    });
    if (heroCta.current) observer.observe(heroCta.current);
    if (finalCta.current) observer.observe(finalCta.current);
    return () => observer.disconnect();
  }, []);
  const showStickyCta = !heroVisible && !finalVisible;
  return (
    <div className="min-h-screen bg-[#F4F5F2] dark:bg-[#111316] text-slate-900 dark:text-slate-100 text-base leading-normal">
      {/* Úvod */}
      <div
        className="bg-blue-600 text-white"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
        }}
      >
        <header className="max-w-[1180px] mx-auto px-4 sm:px-6 h-[68px] flex items-center justify-between">
          <Logo size={34} />
          <button type="button" onClick={onLogin} className={whiteOutline}>
            Přihlásit se
          </button>
        </header>
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-6 lg:pt-10 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-end">
          <div className="pb-2 lg:pb-12">
            <h1 className="font-display font-bold text-[42px] sm:text-6xl leading-[1.02] text-white">
              Smlouva, faktura i předávací protokol dřív, než sbalíte nářadí.
            </h1>
            <p className="mt-5 text-lg sm:text-xl text-blue-100 max-w-xl">
              Aplikace pro řemeslníky a živnostníky. Zakázka od poptávky po zaplacení v mobilu na stavbě i večer u počítače.
            </p>
            <div ref={heroCta} className="mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={onRegister} className={`${yellowButton} flex-1 sm:flex-none`}>
                Založit účet zdarma
              </button>
              <button type="button" onClick={onLogin} className={`${whiteOutline} hidden sm:inline-flex`}>
                Přihlásit se
              </button>
            </div>
            <p className="mt-3 text-[14px] text-blue-100">Zdarma ve zkušebním provozu. Bez platební karty.</p>
          </div>
          <LiveJob />
        </div>
      </div>

      <main className="max-w-[1180px] mx-auto px-4 sm:px-6">
        {/* Cesta zakázky */}
        <section aria-labelledby="uvod-zakazka" className="py-14 sm:py-16">
          <h2 id="uvod-zakazka" className={sectionTitle}>
            Celá zakázka na jednom místě
          </h2>
          <p className={`mt-2 mb-7 text-lg max-w-2xl ${muted}`}>Každá zakázka má metr, na kterém vidíte, kde je a co je potřeba udělat dál.</p>
          <Metr step={5} done label="Šest fází zakázky od poptávky po zaplacení" />
          <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-5 mt-3">
            {STEPS.map(([title, text]) => (
              <li key={title} className="pr-4">
                <div className="font-display font-semibold text-xl">{title}</div>
                <div className={`text-[14px] ${muted}`}>{text}</div>
              </li>
            ))}
          </ol>
        </section>

        {/* Podpis na zkoušku */}
        <section aria-labelledby="uvod-podpis" className="py-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <h2 id="uvod-podpis" className="font-display font-semibold text-3xl leading-tight">
              Zkuste si to: podepište se jako zákazník
            </h2>
            <p className={`mt-2 ${muted}`}>
              Takhle podepisuje smlouvu váš zákazník. Dostane odkaz přes WhatsApp nebo SMS, přečte si celé znění a podepíše prstem. Vy
              podpis hned vidíte v aplikaci.
            </p>
            <OpenOnPhone />
          </div>
          <TrySignature />
        </section>

        {/* Faktura */}
        <section aria-labelledby="uvod-faktura" className="py-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <h2 id="uvod-faktura" className="font-display font-semibold text-3xl leading-tight">
              Faktura s QR platbou na pár kliknutí
            </h2>
            <p className={`mt-2 ${muted}`}>Částka, záloha i dodatky se do faktury propíšou samy. Zákazník zaplatí naskenováním QR kódu.</p>
            <ul className={`mt-3 list-disc pl-5 space-y-1 ${muted}`}>
              <li>pro plátce i neplátce DPH, sazba 21 % i 12 %</li>
              <li>přehled, kdo nezaplatil, a text upomínky</li>
              <li>podklady pro účetní</li>
            </ul>
          </div>
          <div className="bg-white border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden max-h-[340px] -order-1 lg:order-none">
            <img src="/landing/faktura.webp" alt="Ukázka faktury s QR platbou" loading="lazy" width={1200} height={1000} className="w-full h-auto block" />
          </div>
        </section>

        {/* Bez signálu */}
        <section aria-labelledby="uvod-offline" className="py-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <h2 id="uvod-offline" className="font-display font-semibold text-3xl leading-tight">
              Funguje i bez signálu
            </h2>
            <p className={`mt-2 ${muted}`}>Na stavbě bez signálu aplikaci otevřete a pracujete dál. Změny se odešlou, až signál bude.</p>
            <p className={`mt-2 ${muted}`}>Hlídá vám i hranici obratu pro DPH a paušální daň a upozorní na déšť nebo mráz u venkovní zakázky.</p>
          </div>
          <div className="flex justify-center -order-1 lg:order-none">
            <img
              src="/landing/bez-signalu.webp"
              alt="Aplikace v telefonu bez signálu"
              loading="lazy"
              width={390}
              height={700}
              className="w-[260px] h-auto border border-slate-300 dark:border-slate-700 rounded-[18px] shadow-xl"
            />
          </div>
        </section>

        {/* Otázky */}
        <section aria-labelledby="uvod-otazky" className="py-14">
          <h2 id="uvod-otazky" className={sectionTitle}>
            Časté otázky
          </h2>
          <dl className="mt-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800">
            {FAQ.map(([q, a]) => (
              <div key={q} className="px-5 py-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-6 gap-y-1">
                <dt className="font-semibold">{q}</dt>
                <dd className={muted}>{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      {/* Závěr */}
      <div className="bg-slate-900 dark:bg-black text-white">
        <div ref={finalCta} className="max-w-[1180px] mx-auto px-4 sm:px-6 py-12 flex flex-wrap items-center justify-between gap-5">
          <div>
            <div className="font-display font-bold text-3xl sm:text-[40px] leading-tight">Zkuste to na příští zakázce.</div>
            <div className="mt-1 text-slate-300">Účet založíte za minutu, stačí e-mail.</div>
          </div>
          <button type="button" onClick={onRegister} className={`${yellowButton} w-full sm:w-auto`}>
            Založit účet zdarma
          </button>
        </div>
      </div>
      <footer className="max-w-[1180px] mx-auto px-4 sm:px-6 py-5 text-[14px] text-slate-600 dark:text-slate-400 flex flex-wrap justify-between gap-3">
        <span>© {year} Řemeslník PRO</span>
        <span className="flex flex-wrap gap-x-5 gap-y-1">
          <a href={`mailto:${OPERATOR.email}`} className="underline underline-offset-2">
            Kontakt: {OPERATOR.email}
          </a>
          <PrivacyLink />
        </span>
      </footer>

      {/* Přilepené tlačítko na mobilu */}
      <div
        className={`sm:hidden fixed inset-x-0 bottom-0 z-40 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 transition-transform duration-300 ${
          showStickyCta ? 'translate-y-0' : 'translate-y-full'
        }`}
        aria-hidden={!showStickyCta}
      >
        <button type="button" onClick={onRegister} tabIndex={showStickyCta ? 0 : -1} className={`${yellowButton} w-full`}>
          Založit účet zdarma
        </button>
      </div>
    </div>
  );
};
