export type ContractStatus = 'draft' | 'signed' | 'in_progress' | 'handover_done' | 'paid';

/** Otisk údajů v okamžiku načtení z registru ARES. Štítek platí, jen dokud se údaje profilu shodují. */
export interface AresVerification {
  ico: string;
  name: string;
  address: string;
  verifiedAt: string;    // ISO datum a čas načtení z ARES
}

export interface ContractorProfile {
  name: string;          // Jméno / obchodní jméno
  ico: string;           // IČO (přesně 8 číslic)
  dic?: string;          // DIČ (nepovinné, např. CZ12345678)
  address: string;       // Sídlo / Místo podnikání
  bankAccount: string;   // Bankovní účet (např. 123456789/0100)
  phone: string;         // Telefon
  email: string;         // E-mail
  defaultPlace: string;  // Místo uzavření smlouvy (např. v Praze, v Brně)
  signature?: string;    // Výchozí digitální podpis zhotovitele (base64 PNG)
  aresVerified?: AresVerification; // Údaje naposledy načtené z registru ARES (pro štítek „ověřeno“)
  subscriptionPlan?: 'free' | 'pro_trial' | 'pro_monthly' | 'pro_yearly';
  subscriptionExpiresAt?: string; // ISO datum expirace licence
  trialStartedAt?: string;        // ISO datum aktivace zkušební doby
  subscriptionInvoiceNumber?: string; // Číslo daňového dokladu pro odpočet nákladů
}

export interface Client {
  id: string;
  name: string;          // Jméno a příjmení / Firma
  ico?: string;          // IČO (nepovinné)
  address: string;       // Adresa bydliště / sídlo
  email: string;         // E-mail
  phone: string;         // Telefon
  createdAt: string;
}

export interface HandoverData {
  handoverDate: string;
  status: 'bez_vad' | 's_vadami';
  defectsNotes?: string;
  resolutionTerm?: string;
}

export interface ContractPhoto {
  id: string;
  dataUrl: string;       // Komprimovaný base64 obrázek
  caption: string;       // Popisek (např. "Koupelna před rekonstrukcí")
  category: 'before' | 'progress' | 'after';
  createdAt: string;
}

export interface BudgetItem {
  id: string;
  type: 'prace' | 'material' | 'ostatni'; // Typ položky
  title: string;                         // Název položky (např. Montáž obkladů)
  quantity: number;                      // Množství (např. 25)
  unit: string;                          // Jednotka (m², hod, ks, bm, kpl, den)
  unitPrice: number;                     // Jednotková cena v Kč
  totalPrice: number;                    // Celková cena položky v Kč
}

export interface ContractAmendment {
  id: string;
  amendmentNumber: number;               // Číslo dodatku (1, 2, ...)
  issueDate: string;                     // Datum vystavení (YYYY-MM-DD)
  title: string;                         // Název / předmět dodatku
  description: string;                   // Popis víceprací / změn
  priceDifference: number;               // Rozdíl ceny (např. +15 000 Kč)
  additionalDays?: number;               // Prodloužení termínu ve dnech
  newDeliveryDate?: string;              // Nový termín dokončení (YYYY-MM-DD)
  items?: BudgetItem[];                  // Položkový rozpis víceprací
  contractorSignature?: string;          // Podpis zhotovitele
  contractorSignatureDate?: string;
  clientSignature?: string;              // Podpis objednatele
  clientSignatureDate?: string;
  createdAt: string;
}

export interface CashReceipt {
  id: string;
  receiptNumber: string;                 // PPD-2026-001
  issueDate: string;                     // Datum přijetí hotovosti
  amount: number;                        // Přijatá částka v Kč
  paymentFor: 'zaloha' | 'doplatek' | 'plna_castka' | 'viceprace' | 'jine';
  purposeDescription: string;            // Text účelu (např. "Přijatá záloha na nákup materiálu")
  receivedFrom: string;                  // Od koho (klient)
  receivedBy: string;                    // Kým (živnostník)
  contractorSignature?: string;
  clientSignature?: string;
  createdAt: string;
}

export interface ContractFormData {
  clientId: string;
  docKind?: 'contract' | 'quote';        // 'contract' = Smlouva o dílo, 'quote' = Cenová nabídka
  quoteValidUntil?: string;              // Platnost nabídky do YYYY-MM-DD
  pricingType?: 'fixed' | 'budget';      // 'fixed' = paušální cena, 'budget' = položkový rozpočet
  workDescription: string;
  price: number | '';
  deliveryDate: string;                  // YYYY-MM-DD
  advanceAmount?: number | '';           // Volitelná záloha v Kč
  conclusionDate?: string;               // YYYY-MM-DD (dnešní datum)
  executionPlace?: string;               // Místo uzavření
  items?: BudgetItem[];                  // Položky rozpočtu
}

export interface Contract {
  id: string;
  docKind?: 'contract' | 'quote';        // 'contract' = Smlouva o dílo, 'quote' = Cenová nabídka
  quoteNumber?: string;                  // Číslo cenové nabídky (např. CN-2026-001)
  quoteValidUntil?: string;              // Platnost nabídky do YYYY-MM-DD
  pricingType?: 'fixed' | 'budget';
  contractNumber: string;
  invoiceNumber: string;
  variableSymbol: string;
  contractor: ContractorProfile;
  client: Client;
  workDescription: string;
  price: number;
  advanceAmount?: number;                // Sjednaná záloha v Kč
  deliveryDate: string;
  conclusionDate: string;
  executionPlace: string;
  hasVat: boolean;
  status?: ContractStatus;               // Stav workflow zakázky
  leadStage?: LeadStage;                 // Fáze v CRM pipeline poptávek
  nextStepDate?: string;                 // Datum příštího kroku (obhlídka, zavolat, poslat nabídku)
  nextStepNote?: string;                 // Poznámka k příštímu kroku
  inquiryDate?: string;                  // Datum vzniku poptávky
  paidDate?: string;                     // Datum úhrady faktury
  reminderHistory?: InvoiceReminder[];   // Historie odeslaných upomínek
  contractorSignature?: string;          // Digitální podpis zhotovitele (dataUrl)
  contractorSignatureDate?: string;      // Datum podpisu zhotovitele
  clientSignature?: string;              // Digitální podpis objednatele (dataUrl)
  clientSignatureDate?: string;          // Datum podpisu objednatele
  signToken?: string;                    // Tajný kód odkazu pro online podpis zákazníkem (?sign=…)
  photos?: ContractPhoto[];              // Fotodokumentace k zakázce / protokolu
  handoverData?: HandoverData;
  items?: BudgetItem[];                  // Položkový rozpočet zakázky
  amendments?: ContractAmendment[];      // Dodatky na vícepráce (Změnové listy)
  cashReceipts?: CashReceipt[];          // Příjmové pokladní doklady v hotovosti
  expenses?: ContractExpense[];          // Skutečné náklady a výdaje zakázky (materiál, subdodávky, atd.)
  trips?: LogbookTrip[];                 // Kniha jízd a cesty na stavbu k dané zakázce
  warranty?: WarrantyCertificateData;    // Záruční list (garanční certifikát)
  siteLogs?: SiteLogEntry[];             // Digitální stavební deník s počasím a fotkami
  schedule?: ScheduleMilestone[];        // Harmonogram etap realizace a milníků
  legalCheck?: LegalCheckResult;         // AI Právní analýza a hlídač rizik
  shoppingList?: ShoppingListItem[];     // Nákupní lístek do stavebnin
  technicalProtocols?: TechnicalProtocol[]; // Technické zkušební protokoly (tlakové zkoušky vody/topení atd.)
  subcontractors?: SubcontractorWork[];  // Evidence parťáků a brigádníků na stavbě
  toolRentals?: ToolRental[];            // Hlídač půjčeného nářadí a techniky (DEK, Boels...)
  departureChecklists?: DepartureChecklist[]; // Bezpečnostní checklisty při odjezdu ze stavby
  createdAt: string;
}

export interface SubcontractorWork {
  id: string;
  workerName: string;
  role?: string;               // Pomocník, Zedník, Instalatér, Elektrikář, Svářeč...
  date: string;
  hoursWorked: number;
  hourlyRate: number;          // Kč/hod
  taskDescription?: string;
  fixedPrice?: number;         // Kč za úkol pokud není na hodiny
  paidAmount: number;          // Kolik již vyplaceno zálohou
  isFullyPaid: boolean;
  notes?: string;
}

export interface ToolRental {
  id: string;
  toolName: string;            // Jádrová vrtačka Hilti, Plošina, Lešení, Odvlhčovač...
  rentalCompany: string;       // DEK půjčovna, Boels, Ramirent, Vlastní stroj...
  startDate: string;           // Datum zapůjčení
  expectedReturnDate: string;  // Termín vrácení
  actualReturnDate?: string;   // Kdy skutečně vráceno
  dailyRate: number;           // Kč / den
  deposit?: number;            // Vratná kauce v Kč
  isReturned: boolean;
  rechargeToClient: boolean;   // Přeúčtovat zákazníkovi
  notes?: string;
}

export interface DepartureChecklist {
  id: string;
  date: string;
  time: string;
  checkedBy?: string;
  waterClosed: boolean;        // 💧 Voda a přívody uzavřeny
  powerTurnedOff: boolean;     // ⚡ Hlavní jistič / spotřebiče vypnuty
  windowsAndDoorsLocked: boolean; // 🚪 Okna a dveře zamčeny (klíče uloženy)
  siteCleaned: boolean;        // 🧹 Hrubý úklid a nářadí sbaleno
  notes?: string;
}

export type LeadStage = 'inquiry' | 'quote' | 'contract' | 'realization' | 'completed';

export interface InvoiceReminder {
  id: string;
  sentAt: string;
  channel: 'whatsapp' | 'sms' | 'email';
  recipientPhone?: string;
  recipientEmail?: string;
  text: string;
}

export type CalendarEventType = 'realizace' | 'obhlidka' | 'predani' | 'zaloha' | 'material' | 'zaruka' | 'jine';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;                          // YYYY-MM-DD
  time?: string;                         // HH:mm
  type: CalendarEventType;
  contractId?: string;
  clientName?: string;
  location?: string;
  note?: string;
  done?: boolean;
  createdAt: string;
}

export interface CraftsmanChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SiteLogEntry {
  id: string;
  date: string;                          // YYYY-MM-DD
  weather?: string;                      // např. "Slunečno, 18 °C, sucho"
  temperature?: number;                  // °C
  workersCount?: number;                 // počet pracovníků na stavbě
  hoursWorked?: number;                  // celkem odpracovaných hodin
  workDescription: string;               // Podrobný zápis provedených prací
  issues?: string;                       // Závady, překážky, přerušení prací
  materialsDelivered?: string;           // Dodaný materiál a technika
  photos?: ContractPhoto[];              // Fotodokumentace k danému dni
  createdAt: string;
}

export type MilestoneStatus = 'planned' | 'in_progress' | 'completed' | 'delayed';

export interface ScheduleMilestone {
  id: string;
  title: string;                         // např. "Zahájení a hrubé bourací práce"
  startDate: string;                     // YYYY-MM-DD
  endDate: string;                       // YYYY-MM-DD
  status: MilestoneStatus;
  progressPercent: number;               // 0 - 100
  paymentMilestone?: string;             // např. "Záloha 30 % při dokončení (15 000 Kč)"
  isPaymentLinked?: boolean;
  notes?: string;
}

export interface LegalRiskItem {
  id: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  recommendation: string;
  suggestedClause?: string;             // Konkrétní znění doložky pro vložení jedním kliknutím
}

export interface LegalCheckResult {
  score: number;                         // 0 - 100
  riskLevel: 'safe' | 'warning' | 'danger';
  summary: string;
  checkedAt: string;
  risks: LegalRiskItem[];
  positives: string[];
}

export type ExpenseCategory = 'material' | 'tools' | 'subcontractor' | 'travel' | 'other';

export interface ContractExpense {
  id: string;
  date: string;                          // YYYY-MM-DD
  title: string;                         // např. "Nákup obkladů a lepidla C2TE"
  supplier?: string;                     // např. "Stavebniny DEK", "Hornbach"
  amount: number;                        // Výdaj v Kč
  category: ExpenseCategory;             // Druh nákladu
  receiptPhotoUrl?: string;              // Fotka/sken účtenky z nákupu (komprimovaný base64)
  notes?: string;                        // Poznámka
  createdAt: string;
}

export interface LogbookTrip {
  id: string;
  date: string;                          // YYYY-MM-DD
  origin: string;                        // Místo výjezdu (např. Sídlo zhotovitele / sklad)
  destination: string;                   // Cíl cesty (adresa stavby / prodejny)
  distanceKm: number;                    // Vzdálenost tam i zpět v km
  purpose: string;                       // Účel cesty (Nástup, Zaměření, Montáž, Nákup materiálu, Předání)
  ratePerKm: number;                     // Sazba za km v Kč (např. 10 Kč nebo 6 Kč)
  totalCost: number;                     // distanceKm * ratePerKm
  vehicle?: string;                      // Označení vozidla / SPZ
  billableToClient?: boolean;            // Účtovat klientovi do faktury vs. interní náklad
  createdAt: string;
}

export interface WarrantyCertificateData {
  warrantyNumber: string;                // např. ZL-2026-001
  issueDate: string;                     // YYYY-MM-DD
  warrantyPeriodMonths: number;          // Standardně 24, 36, 60 měsíců
  warrantyValidUntil: string;            // YYYY-MM-DD
  scopeOfWarranty: string;               // Rozsah záruky (práce, konstrukce, materiál)
  conditions: string;                    // Podmínky platnosti (běžné užívání, dodržování údržby, větrání)
  serviceContact: string;                // Telefon a e-mail pro ohlášení případné vady
  resolutionPeriodDays: number;          // Lhůta k vyjádření / zahájení opravy v dnech
  notes?: string;                        // Doplňující ujednání
  annualInspections?: WarrantyAnnualInspection[]; // Plánované a provedené roční servisní prohlídky
}

export interface WarrantyAnnualInspection {
  id: string;
  inspectionYear: number;                // 1, 2, 3...
  scheduledDate: string;                 // YYYY-MM-DD
  completedDate?: string;                // YYYY-MM-DD
  status: 'planned' | 'completed' | 'overdue';
  findings?: string;                     // Záznam o stavu (spáry, silikony, těsnost)
  performedBy?: string;                  // Kdo kontrolu provedl
}

export type TechnicalProtocolType =
  | 'water_pressure'     // Tlaková zkouška vodovodu (ČSN 73 6660)
  | 'heating_pressure'   // Tlaková zkouška otopné soustavy (ČSN EN 14336)
  | 'floor_heating_test' // Topná zkouška a nátop podlahového topení (ČSN EN 1264-4)
  | 'sewage_tightness'   // Zkouška těsnosti kanalizace (ČSN 75 6760 / ČSN EN 1610)
  | 'electrical_initial' // Výchozí kontrolní záznam elektroinstalace
  | 'other';

export interface TechnicalProtocol {
  id: string;
  protocolNumber: string;                // např. TZ-2026-001
  type: TechnicalProtocolType;
  title: string;                         // Celý název protokolu
  date: string;                          // YYYY-MM-DD
  standard: string;                      // ČSN norma (např. ČSN 73 6660)
  pipeMaterial?: string;                 // PPR, Alpex, Měď, HT/KG
  testMedium: 'voda' | 'vzduch' | 'plyn';
  operatingPressureBar?: number;         // Provozní přetlak v bar / MPa
  testPressureBar: number;               // Zkušební přetlak v bar
  testDurationMinutes: number;           // Doba trvání zkoušky v minutách
  pressureDropBar: number;               // Naměřený pokles tlaku (např. 0.00 bar)
  result: 'vyhovuje' | 'nevyhovuje';
  testedBy: string;                      // Jméno technika / řemeslníka
  witnessedBy?: string;                  // Zástupce objednatele / TDI
  notes?: string;                        // Poznámka k průběhu
  contractorSignature?: string;          // Podpis zhotovitele
  clientSignature?: string;              // Podpis svědka / objednatele
  createdAt: string;
}

export interface PriceListTemplateItem {
  id: string;
  type: 'prace' | 'material' | 'ostatni';
  category: string;                      // např. "Zednické práce", "Sádrokartony", "Elektro", "Obklady & Dlažby", "Instalatérství", "Doprava & Ostatní"
  title: string;                         // Název položky
  unit: string;                          // m², hod, ks, bm, kpl, den, km
  unitPrice: number;                     // Jednotková cena v Kč
  description?: string;                  // Stručný popis
}

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedPrice?: number;
  isBought: boolean;
  notes?: string;
  supplier?: string;
}

export interface AppBackupData {
  version: string;
  exportedAt: string;
  contractor: ContractorProfile | null;
  clients: Client[];
  contracts: Contract[];
  priceList?: PriceListTemplateItem[];
}

