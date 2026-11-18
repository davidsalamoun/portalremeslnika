/** Testovací data: zhotovitel, dva klienti, šest zakázek ve všech fázích a dvě události v kalendáři. */
export function seedData(sig: string, photo: string, opts: { vatPayer?: boolean } = {}) {
  const today = new Date();
  const iso = (d: number) => new Date(today.getTime() + d * 864e5).toISOString().split('T')[0];
  const contractor = {
    name: 'Jan Novák – obklady a rekonstrukce', ico: '12345678', dic: opts.vatPayer ? 'CZ8503120000' : '',
    address: 'Květinová 124/8, 140 00 Praha 4', bankAccount: '19-2000145399/0800', phone: '+420 777 123 456',
    email: 'jan@example.cz', defaultPlace: 'Praze', signature: sig,
  };
  const clients = [
    { id: 'client_1', name: 'Marek Dvořák', address: 'Slunečná 45, 252 28 Černošice', phone: '+420 608 987 654', email: 'marek@example.cz', createdAt: iso(-30) + 'T10:00:00.000Z' },
    { id: 'client_2', name: 'Nova Real s.r.o.', ico: '27074358', address: 'Dlouhá 5, 602 00 Brno', phone: '+420 602 111 222', email: 'info@novareal.example', createdAt: iso(-20) + 'T10:00:00.000Z' },
  ];
  const items = [
    { id: 'i1', type: 'prace', title: 'Vybourání starých obkladů', quantity: 18, unit: 'm²', unitPrice: 320, totalPrice: 5760 },
    { id: 'i2', type: 'prace', title: 'Pokládka obkladu a dlažby', quantity: 24, unit: 'm²', unitPrice: 720, totalPrice: 17280 },
    { id: 'i3', type: 'material', title: 'Flexibilní lepidlo C2TE S1', quantity: 6, unit: 'bal', unitPrice: 380, totalPrice: 2280 },
    { id: 'i4', type: 'ostatni', title: 'Odvoz suti', quantity: 1, unit: 'kpl', unitPrice: 2200, totalPrice: 2200 },
  ];
  const base = (i: number, over: Record<string, unknown>) => ({
    id: 'contract_' + i, docKind: 'contract', pricingType: 'budget', contractNumber: 'SML-2026-00' + i, invoiceNumber: '202600' + i,
    variableSymbol: '202600' + i, contractor, client: clients[0], workDescription: 'Rekonstrukce koupelny včetně obkladů a dlažeb',
    price: 27520, advanceAmount: 8000, deliveryDate: iso(20), conclusionDate: iso(-10), executionPlace: 'Slunečná 45, Černošice',
    hasVat: !!opts.vatPayer, status: 'in_progress', leadStage: 'realization', items, createdAt: iso(-10) + 'T08:00:00.000Z', ...over,
  });
  const full = base(1, {
    contractorSignature: sig, contractorSignatureDate: iso(-10), clientSignature: sig, clientSignatureDate: iso(-9),
    photos: [
      { id: 'ph1', dataUrl: photo, caption: 'Koupelna před rekonstrukcí', category: 'before', createdAt: iso(-9) + 'T09:00:00.000Z' },
      { id: 'ph2', dataUrl: photo, caption: 'Hotové obklady', category: 'after', createdAt: iso(-1) + 'T09:00:00.000Z' },
    ],
    handoverData: { handoverDate: iso(0), status: 's_vadami', defectsNotes: 'Chybí silikon v rohu sprchy', resolutionTerm: iso(7) },
    amendments: [
      { id: 'a1', amendmentNumber: 1, issueDate: iso(-5), title: 'Vícepráce – nika ve sprše', description: 'Vyzdění a obložení niky', priceDifference: 4502, additionalDays: 2, newDeliveryDate: iso(22), items: [{ id: 'ai1', type: 'prace', title: 'Vyzdění niky', quantity: 1, unit: 'kpl', unitPrice: 4502, totalPrice: 4502 }], createdAt: iso(-5) + 'T10:00:00.000Z' },
      { id: 'a2', amendmentNumber: 2, issueDate: iso(-3), title: 'Méněpráce – sokl', description: 'Sokl se neprovádí', priceDifference: -1200, createdAt: iso(-3) + 'T10:00:00.000Z' },
    ],
    cashReceipts: [{ id: 'r1', receiptNumber: 'PPD-2026-001', issueDate: iso(-9), amount: 8000, paymentFor: 'zaloha', purposeDescription: 'Záloha na materiál', receivedFrom: 'Marek Dvořák', receivedBy: contractor.name, createdAt: iso(-9) + 'T10:00:00.000Z' }],
    expenses: [
      { id: 'e1', date: iso(-8), title: 'Lepidlo a spárovačka', supplier: 'Stavebniny DEK', amount: 3480, category: 'material', receiptPhotoUrl: photo, createdAt: iso(-8) + 'T10:00:00.000Z' },
      { id: 'e2', date: iso(-7), title: 'PHM', amount: 900, category: 'travel', createdAt: iso(-7) + 'T10:00:00.000Z' },
    ],
    trips: [{ id: 't1', date: iso(-8), origin: 'Praha 4', destination: 'Černošice', distanceKm: 24, purpose: 'Zaměření', ratePerKm: 5.6, totalCost: 134.4, createdAt: iso(-8) + 'T10:00:00.000Z' }],
  });
  const contracts = [
    full,
    base(2, { client: clients[1], workDescription: 'Malování kanceláří', price: 45000, advanceAmount: 0, status: 'handover_done', leadStage: 'completed', deliveryDate: iso(-20), conclusionDate: iso(-40), items: [], pricingType: 'fixed' }),
    base(3, { docKind: 'quote', quoteNumber: 'CN-2026-003', quoteValidUntil: iso(14), workDescription: 'Sádrokartonový podhled', price: 38000, status: 'draft', leadStage: 'quote', advanceAmount: 0 }),
    base(4, { workDescription: 'Výměna dlažby na terase', price: 62001, status: 'paid', paidDate: iso(-2), leadStage: 'completed', deliveryDate: iso(-15), conclusionDate: iso(-45) }),
    base(5, { workDescription: 'Poptávka – rekonstrukce WC', price: 0, status: 'draft', leadStage: 'inquiry', inquiryDate: iso(-1), nextStepDate: iso(1), nextStepNote: 'Zavolat a domluvit obhlídku', items: [], advanceAmount: 0 }),
    base(6, { workDescription: 'Zateplení fasády rodinného domu', price: 180000, advanceAmount: 0, status: 'in_progress', leadStage: 'realization', deliveryDate: iso(20), conclusionDate: iso(-5) }),
  ];
  const events = [
    { id: 'ev1', title: 'Obhlídka – WC', date: iso(0), time: '09:00', type: 'obhlidka', clientName: 'Marek Dvořák', location: 'Černošice', createdAt: iso(-1) + 'T10:00:00.000Z' },
    { id: 'ev2', title: 'Předání koupelny', date: iso(3), time: '14:00', type: 'predani', contractId: 'contract_1', createdAt: iso(-1) + 'T10:00:00.000Z' },
  ];
  return { contractor, clients, contracts, events };
}
