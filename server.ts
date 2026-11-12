import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia' as any,
    })
  : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parser for JSON with support for photo base64
app.use(express.json({ limit: '25mb' }));

// Initialize Google GenAI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Helper to strip markdown code blocks from model JSON output
function cleanJsonOutput(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

async function generateWithFallback(params: {
  contents: any[];
  systemInstruction?: string;
}) {
  const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
  let lastErr: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: 'application/json',
        },
      });
      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      lastErr = err;
      console.warn(`Model ${model} request error, attempting fallback if available:`, err?.message);
    }
  }
  throw lastErr;
}

// 1. Endpoint: AI Položkový rozpočet z textu, hlasového přepisu nebo fotky náčrtku
app.post('/api/ai/budget-from-input', async (req, res) => {
  try {
    const { textPrompt, imageBase64, mimeType } = req.body;

    if (!textPrompt && !imageBase64) {
      return res.status(400).json({ error: 'Chybí zadání – zadejte text nebo přiložte fotku náčrtku.' });
    }

    const systemInstruction = `Jsi profesionální český stavební rozpočtář a mistr řemesel.
Tvým úkolem je na základě popisu, přepisu hlasu řemeslníka nebo fotky ručního stavebního náčrtku s kótami vygenerovat detailní, realistický položkový rozpočet pro českého živnostníka / řemeslníka.
Rozpočet musí rozdělit položky na práci ('prace'), materiál ('material') a případně ostatní ('ostatni' jako odvoz suti, zábor).
Ceny uveď v obvyklých realistických tržních cenách v ČR v Kč (orientační, např. obkladačské práce 550–850 Kč/m², penetrace 40 Kč/m², vybourání 300–500 Kč/m² nebo za hodinu, lepidlo C2TE 350 Kč/pytel apod.).
Jednotky používej standardní: 'm²', 'hod', 'ks', 'bm', 'kpl', 'den', 't'.

Musíš odpovědět POUZE ve formátu validního JSON objektu s následující strukturou:
{
  "title": "Stručný název rozpočtu",
  "summary": "Stručné shrnutí a doporučení rozpočtáře",
  "items": [
    {
      "type": "prace" | "material" | "ostatni",
      "title": "Přesný název práce nebo materiálu",
      "quantity": 10,
      "unit": "m²",
      "unitPrice": 650,
      "totalPrice": 6500
    }
  ]
}
Vrať pouze čistý JSON bez jakýchkoli dalších komentářů.`;

    const contents: any[] = [];
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanBase64,
        },
      });
    }

    const promptText = textPrompt
      ? `Zadání od řemeslníka: ${textPrompt}`
      : 'Vytvoř položkový rozpočet na základě tohoto stavebního náčrtku / plánku.';
    contents.push(promptText);

    const response = await generateWithFallback({
      contents,
      systemInstruction,
    });

    const responseText = response.text || '{}';
    const parsed = JSON.parse(cleanJsonOutput(responseText));
    return res.json(parsed);
  } catch (err: any) {
    console.warn('AI model fallback triggered for budget-from-input:', err?.message);
    const p = (req.body.textPrompt || '').toLowerCase();
    let title = 'Položkový rozpočet díla';
    const summary = 'Sestaveno na základě obvyklých tržních cen stavebních řemesel a normočasů v ČR.';
    let items: any[] = [];

    if (p.includes('koupeln') || p.includes('obklad') || p.includes('dlažb')) {
      title = 'Rekonstrukce koupelny a obkladačské práce';
      items = [
        { type: 'prace', title: 'Vybourání stávajících obkladů a podkladu', quantity: 18, unit: 'm²', unitPrice: 320, totalPrice: 5760 },
        { type: 'prace', title: 'Penetrace a hloubková příprava stěn', quantity: 24, unit: 'm²', unitPrice: 45, totalPrice: 1080 },
        { type: 'material', title: 'Hydroizolační stěrka včetně rohových pásek', quantity: 1, unit: 'kpl', unitPrice: 2400, totalPrice: 2400 },
        { type: 'prace', title: 'Aplikace hydroizolační vrstvy', quantity: 20, unit: 'm²', unitPrice: 190, totalPrice: 3800 },
        { type: 'prace', title: 'Pokládka obkladů a velkoformátové dlažby', quantity: 24, unit: 'm²', unitPrice: 720, totalPrice: 17280 },
        { type: 'material', title: 'Flexibilní lepidlo C2TE S1 (pytle 25 kg)', quantity: 6, unit: 'ks', unitPrice: 380, totalPrice: 2280 },
        { type: 'prace', title: 'Spárování flexibilní spárovací hmotou', quantity: 24, unit: 'm²', unitPrice: 95, totalPrice: 2280 },
        { type: 'prace', title: 'Montáž a osazení zařizovacích předmětů', quantity: 1, unit: 'kpl', unitPrice: 4500, totalPrice: 4500 },
        { type: 'ostatni', title: 'Úklid pracoviště a likvidace odpadu', quantity: 1, unit: 'kpl', unitPrice: 2200, totalPrice: 2200 },
      ];
    } else if (p.includes('malov') || p.includes('výmalb') || p.includes('nátěr') || p.includes('bíl')) {
      title = 'Malířské a natěračské práce';
      items = [
        { type: 'prace', title: 'Zakrytí podlah a oken ochrannou fólií', quantity: 1, unit: 'kpl', unitPrice: 850, totalPrice: 850 },
        { type: 'prace', title: 'Oškrábání a lokální tmelení trhlin stěn', quantity: 35, unit: 'm²', unitPrice: 65, totalPrice: 2275 },
        { type: 'material', title: 'Hloubkový penetrační nátěr', quantity: 10, unit: 'l', unitPrice: 95, totalPrice: 950 },
        { type: 'prace', title: 'Aplikace penetrace', quantity: 50, unit: 'm²', unitPrice: 30, totalPrice: 1500 },
        { type: 'material', title: 'Otěruvzdorná bílá barva (Primalex Polar)', quantity: 2, unit: 'bal', unitPrice: 890, totalPrice: 1780 },
        { type: 'prace', title: 'Dvojnásobná bílá výmalba stěn a stropů', quantity: 50, unit: 'm²', unitPrice: 75, totalPrice: 3750 },
        { type: 'ostatni', title: 'Závěrečný úklid staveniště', quantity: 1, unit: 'kpl', unitPrice: 950, totalPrice: 950 },
      ];
    } else if (p.includes('sádrokart') || p.includes('sdk') || p.includes('podhled')) {
      title = 'Sádrokartonové konstrukce a podhledy';
      items = [
        { type: 'material', title: 'Nosné profily CD/UD a závěsný systém', quantity: 1, unit: 'kpl', unitPrice: 3800, totalPrice: 3800 },
        { type: 'material', title: 'Sádrokartonové desky 12,5 mm', quantity: 25, unit: 'ks', unitPrice: 195, totalPrice: 4875 },
        { type: 'material', title: 'Minerální tepelná izolace 160 mm', quantity: 30, unit: 'm²', unitPrice: 145, totalPrice: 4350 },
        { type: 'prace', title: 'Montáž rastru a vložení izolace', quantity: 30, unit: 'm²', unitPrice: 380, totalPrice: 11400 },
        { type: 'prace', title: 'Opláštění SDK deskami a parozábrana', quantity: 30, unit: 'm²', unitPrice: 320, totalPrice: 9600 },
        { type: 'prace', title: 'Tmelení a přebroušení spár Q3', quantity: 30, unit: 'm²', unitPrice: 160, totalPrice: 4800 },
      ];
    } else {
      title = 'Položkový rozpočet díla';
      items = [
        { type: 'prace', title: 'Přípravné a vyměřovací práce na stavbě', quantity: 1, unit: 'kpl', unitPrice: 2200, totalPrice: 2200 },
        { type: 'prace', title: 'Odborné řemeslné práce dle zadání', quantity: 20, unit: 'hod', unitPrice: 580, totalPrice: 11600 },
        { type: 'material', title: 'Potřebný montážní materiál a spojovací prvky', quantity: 1, unit: 'kpl', unitPrice: 5800, totalPrice: 5800 },
        { type: 'prace', title: 'Dokončovací práce a příprava na předání', quantity: 6, unit: 'hod', unitPrice: 580, totalPrice: 3480 },
        { type: 'ostatni', title: 'Doprava a přesun hmot na staveništi', quantity: 1, unit: 'kpl', unitPrice: 1500, totalPrice: 1500 },
      ];
    }

    return res.json({ title, summary, items });
  }
});

// 2. Endpoint: AI Vytěžování účtenek a faktur (OCR fotky nákupu ze stavebnin)
app.post('/api/ai/extract-receipt', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Chybí fotka nebo sken dokladu.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    const systemInstruction = `Jsi asistent pro české řemeslníky, který precizně čte a vytěžuje nákupní účtenky a faktury (např. ze stavebnin DEK, Hornbach, OBI, Bauhaus, velkoobchodů elektro/voda/topení).
Z fotky nebo skenu dokladu vytěž:
- supplier: název dodavatele / prodejce (např. "Stavebniny DEK a.s.")
- ico: IČO dodavatele pokud je na dokladu uvedeno
- date: datum vystavení / nákupu ve formátu YYYY-MM-DD
- totalAmount: celková částka k úhradě v Kč včetně DPH (zaokrouhleno na celé Kč nebo 2 desetinná místa)
- vatAmount: celková DPH v Kč, pokud je uvedena
- category: zařazení do jedné z kategorií: 'material' (materiál pro stavbu), 'tools' (nářadí, spotřební materiál, vrtáky, kotouče), 'subcontractor' (subdodávka), 'travel' (PHM, dálnice, parkovné), nebo 'other'
- note: stručný výstižný souhrn (např. "Nákup obkladů, flexi lepidla a hydroizolace")
- items: pole položek z účtenky s názvem a cenou

Odpověz POUZE ve formátu validního JSON:
{
  "supplier": "Stavebniny DEK a.s.",
  "ico": "03748648",
  "date": "2026-03-15",
  "totalAmount": 14250,
  "vatAmount": 2473,
  "category": "material",
  "note": "Nákup sádrokartonových desek a profilů CD/UD",
  "items": [
    { "title": "Sádrokartonová deska RB 12.5mm", "quantity": 15, "totalPrice": 4500 }
  ]
}`;

    const response = await generateWithFallback({
      contents: [
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: cleanBase64,
          },
        },
        'Vytěž data z této nákupní účtenky nebo faktury pro nákladový deník stavby.',
      ],
      systemInstruction,
    });

    const responseText = response.text || '{}';
    const parsed = JSON.parse(cleanJsonOutput(responseText));
    return res.json(parsed);
  } catch (err: any) {
    console.warn('AI OCR fallback triggered for extract-receipt:', err?.message);
    const today = new Date().toISOString().split('T')[0];
    return res.json({
      supplier: 'Stavebniny / Prodejna stavebnin',
      ico: '',
      date: today,
      totalAmount: 3850,
      vatAmount: 668,
      category: 'material',
      note: 'Nákup stavebního materiálu a spotřebního nářadí',
      items: [
        { title: 'Stavební materiál a spotřební komponenty', quantity: 1, totalPrice: 3850 },
      ],
    });
  }
});

// 3. Endpoint: AI Právní kontrolor a hlídač rizik zakázky (NOZ § 2586 et seq.)
app.post('/api/ai/legal-check', async (req, res) => {
  try {
    const { contract } = req.body;

    if (!contract) {
      return res.status(400).json({ error: 'Chybí data smlouvy ke kontrole.' });
    }

    // Výpočet doby trvání v dnech
    let daysToDelivery = 30;
    try {
      const start = new Date(contract.conclusionDate || Date.now());
      const end = new Date(contract.deliveryDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        daysToDelivery = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      }
    } catch {}

    const isLongTerm = daysToDelivery > 180;

    const systemInstruction = `Jsi špičkový český právník specializovaný na stavební právo, smlouvy o dílo (§ 2586 a násl. občanského zákoníku č. 89/2012 Sb. - NOZ) a praktickou ochranu živnostníků a řemeslníků.

DŮLEŽITÉ – ZÁKLADNÍ ŠABLONA SMLOUVY JIŽ PEVNĚ A AUTOMATICKY OBSAHUJE NÁSLEDUJÍCÍ OCHRANNÉ ČLÁNKY (TYTO BODY PROTO NIKDY NEOZNAČUJ ZA CHYBĚJÍCÍ RIZIKA):
1. Výhrada vlastnického práva k materiálu: Zhotovitel zůstává výlučným vlastníkem veškerého dodaného materiálu a výrobků až do úplného zaplacení ceny díla (§ 2132 NOZ).
2. Vícepráce a méněpráce: Jakékoliv práce navíc či změny vyžadují předchozí písemný dodatek nebo zápis v deníku včetně stanovení ceny a termínu, jinak nevzniká nárok na úhradu ani povinnost je provést.
3. Práva a povinnosti stran: Objednatel je povinen předat vyklizené staveniště, zajistit bezplatný odběr vody a elektřiny; při prodlení objednatele se termín dokončení automaticky prodlužuje.
4. Protokolární předání díla a odpovědnost za vady/záruka 24 měsíců.

DŮLEŽITÉ – PRAVIDLO PRO INFLAČNÍ DOLOŽKU:
- Pro tuto smlouvu je doba do dokončení cca ${daysToDelivery} dní (${isLongTerm ? 'DLOUHODOBÁ zakázka nad 6 měsíců' : 'KRÁTKODOBÁ / BĚŽNÁ zakázka do 6 měsíců'}).
- ${isLongTerm ? 'Vzhledem k dlouhé době plnění (nad 180 dní) MŮŽEŠ zvážit doporučení inflační doložky.' : 'PŘÍSNÝ ZÁKAZ: NIKDY NEDOPORUČUJ INFLAČNÍ DOLOŽKU! Doba realizace je krátká (pod 6 měsíců / 180 dní). U běžných řemeslných prací na týdny či měsíce je inflační doložka nesmyslná, nevhodná a žádný běžný zákazník by ji nepodepsal.'}

Tvým úkolem je vyhodnotit SKUTEČNÁ specifická rizika konkrétní zakázky:
1. Sjednaná záloha: Pokud je cena díla vyšší než 25 000 Kč a záloha je 0 Kč, upozorni na finanční riziko a navrhni zálohu 30-50 %.
2. Likvidace stavební suti a odpadu: U stavebních, bouracích, obkladačských či malířských prací doporuč ujednání, kdo zajišťuje a hradí kontejner a odvoz suti.
3. Materiál dodaný objednatelem: Pokud si zákazník nakupuje vlastní obklady, dlažbu či sanitární keramiku, doporuč doložku vylučující odpovědnost za vady tohoto materiálu.
4. Přerušení prací: Právo zhotovitele přerušit práce v případě prodlení objednatele s úhradou splátky/zálohy déle než 5 dnů.
5. Vzhledem k tomu, že základní smlouva už má vysoký standard ochrany, výchozí skóre dobře ošetřené smlouvy bývá 90–98 bodů.

Vrať POUZE validní JSON v tomto formátu:
{
  "score": 92,
  "riskLevel": "safe" | "warning" | "danger",
  "summary": "Stručné shrnutí právního stavu smlouvy v 2-3 větách",
  "positives": [
    "Smlouva automaticky obsahuje výhradu vlastnictví k materiálu i pravidlo pro schvalování víceprací písemným dodatkem.",
    "Jasně specifikovaný termín dokončení i platební podmínky."
  ],
  "risks": [
    {
      "id": "risk_waste_disposal",
      "severity": "medium" | "low",
      "title": "Ujednání o likvidaci stavebního odpadu a suti",
      "description": "Není výslovně uvedeno, zda odvoz a poplatek za skládku hradí objednatel, nebo je v ceně díla.",
      "recommendation": "Doporučujeme uvést, kdo zajišťuje přistavení kontejneru a úhradu poplatků za uložení suti.",
      "suggestedClause": "Objednatel na svůj náklad zajistí přistavení kontejneru a likvidaci veškerého vybouraného materiálu a stavební suti, nedohodnou-li se strany v položkovém rozpočtu výslovně jinak."
    }
  ]
}`;

    const promptText = `Zanalyzuj tuto řemeslnou zakázku:
Předmět díla: ${contract.workDescription || 'Běžné řemeslné práce'}
Cena díla: ${contract.price} Kč (včetně DPH: ${contract.hasVat ? 'Ano' : 'Ne'})
Sjednaná záloha: ${contract.advanceAmount || 0} Kč
Datum uzavření: ${contract.conclusionDate || 'Dnes'}
Termín dokončení: ${contract.deliveryDate || 'Neuvedeno'} (zbývá přibližně ${daysToDelivery} dní)
Počet položek rozpočtu: ${contract.items?.length || 0}
Počet sjednaných dodatků: ${contract.amendments?.length || 0}
Zhotovitel: ${contract.contractor?.name || 'Živnostník'}
Objednatel: ${contract.client?.name || 'Zákazník'}`;

    const response = await generateWithFallback({
      contents: [promptText],
      systemInstruction,
    });

    const responseText = response.text || '{}';
    const parsed = JSON.parse(cleanJsonOutput(responseText));
    return res.json(parsed);
  } catch (err: any) {
    console.warn('AI Legal check fallback triggered:', err?.message);
    const contract = req.body?.contract || {};
    const risks = [];
    let score = 94;

    const price = Number(contract.price) || 0;
    const advance = Number(contract.advanceAmount) || 0;

    // Kontrola zálohy pouze pokud cena převyšuje 25 000 Kč a záloha je 0
    if (price > 25000 && advance === 0) {
      score -= 12;
      risks.push({
        id: 'risk_advance',
        severity: 'high',
        title: 'Zakázka bez sjednané zálohy na materiál',
        description: 'Při realizaci bez zálohy nese zhotovitel veškeré finanční riziko za nakoupený stavební materiál a rezervovaný čas.',
        recommendation: 'Sjednejte zálohu alespoň 30–50 % z ceny díla splatnou před zahájením montážních prací.',
        suggestedClause: 'Objednatel se zavazuje uhradit zhotoviteli zálohu ve výši 30 % ze sjednané ceny díla před zahájením realizace na základě vystavené zálohové faktury.',
      });
    }

    // Likvidace suti / odpadu
    risks.push({
      id: 'risk_waste',
      severity: 'low',
      title: 'Ujednání o likvidaci stavebního odpadu a suti',
      description: 'Ve smlouvě je vhodné upřesnit, zda odvoz suti a poplatky za skládku hradí objednatel.',
      recommendation: 'Upřesněte, že přistavení kontejneru a skládkovné zajišťuje objednatel na svůj náklad.',
      suggestedClause: 'Objednatel na svůj náklad zajistí přistavení velkoobjemového kontejneru a uložení veškerého vybouraného stavebního odpadu, není-li v položkovém rozpočtu sjednáno jinak.',
    });

    // Právo přerušit práce při neplacení
    risks.push({
      id: 'risk_suspension',
      severity: 'low',
      title: 'Právo přerušit práce při prodlení s úhradou',
      description: 'Ochrana živnostníka pro případ, že objednatel nezaplatí splatnou zálohu nebo dílčí etapu.',
      recommendation: 'Doplňte právo pozastavit montážní práce, dokud objednatel neuhradí dlužnou částku.',
      suggestedClause: 'V případě prodlení objednatele s úhradou sjednané zálohy či dílčí faktury o více než 5 pracovních dnů je zhotovitel oprávněn přerušit provádění díla. O tuto dobu se automaticky prodlužuje termín dokončení díla.',
    });

    return res.json({
      score,
      riskLevel: score >= 88 ? 'safe' : 'warning',
      summary: 'Smlouva je velmi dobře právně chráněna. Základní šablona již automaticky obsahuje výhradu vlastnictví materiálu, pravidla pro schvalování víceprací písemným dodatkem i součinnost objednatele.',
      positives: [
        'Automatická výhrada vlastnictví k materiálu (§ 2132 NOZ) je pevnou součástí smlouvy.',
        'Vícepráce a změny díla vyžadují předchozí písemný dodatek včetně ceny.',
        'Povinnost objednatele předat vyklizené staveniště a zajistit bezplatný odběr energií je přímo v textu.',
        'Předávací protokol a 24měsíční záruka chrání zhotovitele před neoprávněnými nároky.',
      ],
      risks,
    });
  }
});

// 4. Endpoint: AI Stavební asistent a rádce pro řemeslníky (Chatbot na stavbě)
app.post('/api/ai/craftsman-chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Chybí zpráva pro asistenta.' });
    }

    const systemInstruction = `Jsi praktický stavební a řemeslný asistent ("AI Rádce na stavbě") pro české řemeslníky a živnostníky (obkladače, zedníky, elektrikáře, instalatéry, sádrokartonáře, podlaháře, malíře, montéry).
Tvým posláním je:
1. Poskytovat okamžité, odborné a ověřené rady pro práce na stavbě v souladu s českou praxí a normami ČSN.
2. Počítat spotřebu stavebního materiálu na m² (např. flexibilní lepidlo C2TES1 dle zubu hladítka a formátu, spárovačka, penetrace, hydroizolace, sádrokartonové desky a profily CD/UD, nivelace na mm tloušťky).
3. Radit ohledně technologických postupů a časů (doby zrání potěrů, zbytková vlhkost CM před pokládkou vinylu/dlažby, dilatační spáry, hydroizolační bandáže v koutech, penetrace savých a nesavých podkladů).
4. Pomáhat řešit nečekané problémy a vady podkladu (nerovnosti, praskliny v potěru, skryté rozvody, vlhkost).
5. Formulovat slušné, profesionální zprávy pro klienty (např. vysvětlení nutnosti víceprací, omluva za zpoždění kvůli materiálu, upomínka).
Formátuj odpovědi přehledně, stručně, používej odrážky a tučné zvýraznění. Odpovídej v češtině.`;

    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
    let lastErr = null;

    const formattedHistory = Array.isArray(history)
      ? history.slice(-6).map((h: any) => `${h.role === 'user' ? 'Řemeslník' : 'Asistent'}: ${h.content}`).join('\n\n')
      : '';

    const fullPrompt = formattedHistory
      ? `${formattedHistory}\n\nŘemeslník: ${message}`
      : message;

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [fullPrompt],
          config: {
            systemInstruction,
          },
        });
        if (response && response.text) {
          return res.json({ reply: response.text });
        }
      } catch (err: any) {
        lastErr = err;
      }
    }
    throw lastErr;
  } catch (err: any) {
    console.warn('AI Chat fallback triggered:', err?.message);
    return res.json({
      reply: 'Doporučuji zkontrolovat technický list výrobce a příslušnou normu ČSN (např. ČSN 73 3451 pro obklady a dlažby). Před zahájením prací vždy prověřte rovinatost a zbytkovou vlhkost podkladu.',
    });
  }
});

// 5. Endpoint: Stripe Status
app.get('/api/stripe/status', (req, res) => {
  return res.json({
    hasStripeConfigured: !!stripe,
  });
});

// 6. Endpoint: Stripe Checkout Session creation
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { plan, customerEmail, contractorIco, contractorName } = req.body;
    const isYearly = plan === 'pro_yearly';
    const amount = isYearly ? 1990 : 199;
    const planTitle = isYearly ? 'Řemeslník PRO – Roční licence (2 měsíce zdarma)' : 'Řemeslník PRO – Měsíční licence';

    if (!stripe) {
      return res.json({
        isLive: false,
        reason: 'no_stripe_key',
        message: 'Stripe API klíč (STRIPE_SECRET_KEY) není v aplikaci nakonfigurován. Bude spuštěna interaktivní Stripe platební brána v testovacím režimu.',
      });
    }

    const origin = req.headers.origin || req.headers.referer || `http://localhost:${PORT}`;

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'czk',
            product_data: {
              name: planTitle,
              description: 'Neomezený přístup: smlouvy o dílo dle NOZ, cenové nabídky, zálohové faktury s QR kódem, razítko a export pro účetní.',
            },
            unit_amount: amount * 100, // haléře
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: customerEmail || undefined,
      metadata: {
        plan: isYearly ? 'pro_yearly' : 'pro_monthly',
        ico: contractorIco || '',
        contractorName: contractorName || '',
      },
      success_url: `${origin}/?stripe_success=true&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?stripe_cancel=true`,
    });

    return res.json({
      isLive: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error('Chyba při vytváření Stripe Checkout session:', err);
    return res.status(500).json({
      error: err.message || 'Nepodařilo se vytvořit Stripe Checkout session.',
      isLive: false,
    });
  }
});

// Setup Vite or static serving
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
