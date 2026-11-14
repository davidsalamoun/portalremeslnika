import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { preloadExportLibraries } from './utils/lazyExports';
import { Navbar, TabType } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { DashboardPage } from './components/DashboardPage';
import type { DocumentType } from './components/ContractPreview';
import { ClientDialog } from './components/ClientDialog';
import { CloudAccountModal } from './components/CloudAccountModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { OfflineStatusIndicator } from './components/OfflineStatusIndicator';
import { compressImageFile } from './utils/imageCompression';
import { triggerHaptic } from './utils/haptics';
import {
  ContractorProfile,
  Client,
  Contract,
  CalendarEvent,
  LeadStage,
  AppBackupData,
} from './types/contract';
import {
  getContractorProfile,
  saveContractorProfile,
  getStoredClients,
  saveStoredClients,
  addStoredClient,
  updateStoredClient,
  deleteStoredClient,
  getStoredContracts,
  addStoredContract,
  deleteStoredContract,
  getStoredCalendarEvents,
  addStoredCalendarEvent,
  updateStoredCalendarEvent,
  deleteStoredCalendarEvent,
  seedSampleData,
} from './utils/storage';
import { cleanPlaceName } from './utils/numberToWordsCs';
import { applyBackup } from './utils/backup';
import { checkAndSyncRemoteSignatures } from './utils/signShares';
import { useCloudUser } from './components/AuthGate';
import { isInvoiceable, getInvoiceStatus } from './utils/invoiceMath';
import { CLOUD_DATA_CHANGED_EVENT } from './utils/cloudSync';
import { isProUser, PRO_CONFIG, PAYMENTS_ENABLED } from './utils/subscription';

// Stránky a modály se stahují až při prvním použití; po startu se na pozadí dotáhnou všechny,
// aby aplikace fungovala i bez připojení (viz preloadLazyChunks níže).
const lazyLoaders = {
  CalendarPage: () => import('./components/CalendarPage'),
  LeadsPipelinePage: () => import('./components/LeadsPipelinePage'),
  InvoicesOverviewPage: () => import('./components/InvoicesOverviewPage'),
  ContractForm: () => import('./components/ContractForm'),
  ContractPreview: () => import('./components/ContractPreview'),
  ClientsPage: () => import('./components/ClientsPage'),
  HistoryPage: () => import('./components/HistoryPage'),
  SettingsPage: () => import('./components/SettingsPage'),
  FinancialRadarPage: () => import('./components/FinancialRadarPage'),
  RemoteSigningPortal: () => import('./components/RemoteSigningPortal'),
  QuickClientMessagesModal: () => import('./components/QuickClientMessagesModal'),
  QuickEstimateCalculatorModal: () => import('./components/QuickEstimateCalculatorModal'),
  ClientSigningKioskModal: () => import('./components/ClientSigningKioskModal'),
  ShoppingListModal: () => import('./components/ShoppingListModal'),
  QuickCashReceiptModal: () => import('./components/QuickCashReceiptModal'),
  LogbookModal: () => import('./components/LogbookModal'),
  AccountantExportModal: () => import('./components/AccountantExportModal'),
  TechnicalProtocolsModal: () => import('./components/TechnicalProtocolsModal'),
  SubcontractorsModal: () => import('./components/SubcontractorsModal'),
  ToolRentalModal: () => import('./components/ToolRentalModal'),
  DepartureChecklistModal: () => import('./components/DepartureChecklistModal'),
  ContractArchiveModal: () => import('./components/ContractArchiveModal'),
  PaywallModal: () => import('./components/PaywallModal'),
  SubscriptionInvoiceModal: () => import('./components/SubscriptionInvoiceModal'),
};
const CalendarPage = lazy(() => lazyLoaders.CalendarPage().then((m) => ({ default: m.CalendarPage })));
const LeadsPipelinePage = lazy(() => lazyLoaders.LeadsPipelinePage().then((m) => ({ default: m.LeadsPipelinePage })));
const InvoicesOverviewPage = lazy(() => lazyLoaders.InvoicesOverviewPage().then((m) => ({ default: m.InvoicesOverviewPage })));
const ContractForm = lazy(() => lazyLoaders.ContractForm().then((m) => ({ default: m.ContractForm })));
const ContractPreview = lazy(() => lazyLoaders.ContractPreview().then((m) => ({ default: m.ContractPreview })));
const ClientsPage = lazy(() => lazyLoaders.ClientsPage().then((m) => ({ default: m.ClientsPage })));
const HistoryPage = lazy(() => lazyLoaders.HistoryPage().then((m) => ({ default: m.HistoryPage })));
const SettingsPage = lazy(() => lazyLoaders.SettingsPage().then((m) => ({ default: m.SettingsPage })));
const FinancialRadarPage = lazy(() => lazyLoaders.FinancialRadarPage().then((m) => ({ default: m.FinancialRadarPage })));
const RemoteSigningPortal = lazy(() => lazyLoaders.RemoteSigningPortal().then((m) => ({ default: m.RemoteSigningPortal })));
const QuickClientMessagesModal = lazy(() => lazyLoaders.QuickClientMessagesModal().then((m) => ({ default: m.QuickClientMessagesModal })));
const QuickEstimateCalculatorModal = lazy(() => lazyLoaders.QuickEstimateCalculatorModal().then((m) => ({ default: m.QuickEstimateCalculatorModal })));
const ClientSigningKioskModal = lazy(() => lazyLoaders.ClientSigningKioskModal().then((m) => ({ default: m.ClientSigningKioskModal })));
const ShoppingListModal = lazy(() => lazyLoaders.ShoppingListModal().then((m) => ({ default: m.ShoppingListModal })));
const QuickCashReceiptModal = lazy(() => lazyLoaders.QuickCashReceiptModal().then((m) => ({ default: m.QuickCashReceiptModal })));
const LogbookModal = lazy(() => lazyLoaders.LogbookModal().then((m) => ({ default: m.LogbookModal })));
const AccountantExportModal = lazy(() => lazyLoaders.AccountantExportModal().then((m) => ({ default: m.AccountantExportModal })));
const TechnicalProtocolsModal = lazy(() => lazyLoaders.TechnicalProtocolsModal().then((m) => ({ default: m.TechnicalProtocolsModal })));
const SubcontractorsModal = lazy(() => lazyLoaders.SubcontractorsModal().then((m) => ({ default: m.SubcontractorsModal })));
const ToolRentalModal = lazy(() => lazyLoaders.ToolRentalModal().then((m) => ({ default: m.ToolRentalModal })));
const DepartureChecklistModal = lazy(() => lazyLoaders.DepartureChecklistModal().then((m) => ({ default: m.DepartureChecklistModal })));
const ContractArchiveModal = lazy(() => lazyLoaders.ContractArchiveModal().then((m) => ({ default: m.ContractArchiveModal })));
const PaywallModal = lazy(() => lazyLoaders.PaywallModal().then((m) => ({ default: m.PaywallModal })));
const SubscriptionInvoiceModal = lazy(() => lazyLoaders.SubscriptionInvoiceModal().then((m) => ({ default: m.SubscriptionInvoiceModal })));

function preloadLazyChunks() {
  const run = () => {
    Object.entries(lazyLoaders).forEach(([name, load]) => {
      // Platební obrazovky se při vypnutém placení nikdy nezobrazí, není třeba je stahovat
      if (!PAYMENTS_ENABLED && (name === 'PaywallModal' || name === 'SubscriptionInvoiceModal')) return;
      void load().catch(() => undefined);
    });
    void preloadExportLibraries().catch(() => undefined);
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2000);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [contractor, setContractor] = useState<ContractorProfile | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  // Preview state
  const [previewContract, setPreviewContract] = useState<Contract | null>(null);
  const [previewInitialDoc, setPreviewInitialDoc] = useState<DocumentType>('smlouva');
  const [savedContractIds, setSavedContractIds] = useState<Set<string>>(new Set());

  // Client modal state
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  // Selected trade template for 1-click contract creation
  const [selectedTradeTemplate, setSelectedTradeTemplate] = useState<string | null>(null);

  // New tradesperson experience states
  const [quickMessagesContract, setQuickMessagesContract] = useState<Contract | null>(null);
  const [signingKioskContract, setSigningKioskContract] = useState<Contract | null>(null);
  const [isEstimateCalculatorOpen, setIsEstimateCalculatorOpen] = useState(false);
  const [shoppingListContract, setShoppingListContract] = useState<Contract | null>(null);
  const [quickCashReceiptContract, setQuickCashReceiptContract] = useState<Contract | null>(null);
  const [logbookContract, setLogbookContract] = useState<Contract | null>(null);
  const [isAccountantModalOpen, setIsAccountantModalOpen] = useState(false);
  const [technicalProtocolsContract, setTechnicalProtocolsContract] = useState<Contract | null>(null);
  const [subcontractorsContract, setSubcontractorsContract] = useState<Contract | null>(null);
  const [toolRentalContract, setToolRentalContract] = useState<Contract | null>(null);
  const [departureChecklistContract, setDepartureChecklistContract] = useState<Contract | null>(null);
  const [archiveContract, setArchiveContract] = useState<Contract | null>(null);

  // Monetization / Paywall modal state
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState<string | undefined>(undefined);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  const handleOpenPaywall = (reason?: string) => {
    if (!PAYMENTS_ENABLED) return;
    setPaywallReason(reason);
    setIsPaywallOpen(true);
  };
  // Dokud je placení vypnuté, tlačítka a bannery pro přechod na PRO se vůbec nezobrazují
  const openPaywallProp = PAYMENTS_ENABLED ? () => handleOpenPaywall() : undefined;

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', text: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Cloud Account & Remote Signing state
  const currentUser = useCloudUser();
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [signParam, setSignParam] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get('sign');
    } catch {
      return null;
    }
  });

  // Listen to storage error events (e.g. QuotaExceededError when photos are too heavy)
  useEffect(() => {
    const handleStorageError = (e: any) => {
      addToast('error', e.detail?.message || 'Chyba při ukládání do paměti prohlížeče');
    };
    window.addEventListener('app:storage_error', handleStorageError);
    return () => window.removeEventListener('app:storage_error', handleStorageError);
  }, []);

  // Data stažená z účtu (jiné zařízení, první přihlášení) se propíšou do zobrazení
  useEffect(() => {
    const reloadFromStorage = () => {
      const loadedContractor = getContractorProfile();
      if (loadedContractor && loadedContractor.defaultPlace) {
        loadedContractor.defaultPlace = cleanPlaceName(loadedContractor.defaultPlace);
      }
      const loadedContracts = getStoredContracts();
      setContractor(loadedContractor);
      setClients(getStoredClients());
      setContracts(loadedContracts);
      setCalendarEvents(getStoredCalendarEvents());
      setSavedContractIds(new Set(loadedContracts.map((c) => c.id)));
    };
    window.addEventListener(CLOUD_DATA_CHANGED_EVENT, reloadFromStorage);
    return () => window.removeEventListener(CLOUD_DATA_CHANGED_EVENT, reloadFromStorage);
  }, []);

  // Initial load from localStorage
  useEffect(() => {
    const loadedContractor = getContractorProfile();
    const loadedClients = getStoredClients();
    const loadedContracts = getStoredContracts();
    const loadedEvents = getStoredCalendarEvents();

    if (loadedContractor && loadedContractor.defaultPlace) {
      loadedContractor.defaultPlace = cleanPlaceName(loadedContractor.defaultPlace);
    }

    setContractor(loadedContractor);
    setClients(loadedClients);
    setContracts(loadedContracts);
    setCalendarEvents(loadedEvents);

    const ids = new Set(loadedContracts.map((c) => c.id));
    setSavedContractIds(ids);

    // Zákazník v portálu podpisu zbytek aplikace nepotřebuje
    if (!signParam) preloadLazyChunks();
  }, []);

  // Compute overdue invoices count for navbar badge
  const overdueInvoicesCount = useMemo(() => {
    return contracts.filter((c) => isInvoiceable(c) && getInvoiceStatus(c).isOverdue).length;
  }, [contracts]);

  // Automatic sync of remote signatures
  const syncRemoteSignatures = useCallback(async () => {
    try {
      const currentList = getStoredContracts();
      const unsigned = currentList.filter((c) => !c.clientSignature);
      if (unsigned.length === 0) return;

      const { updatedContracts, hasChanges } = await checkAndSyncRemoteSignatures(currentList);
      if (hasChanges) {
        updatedContracts.forEach((c) => addStoredContract(c));
        const all = getStoredContracts();
        setContracts(all);
        setSavedContractIds(new Set(all.map((c) => c.id)));

        if (previewContract) {
          const fresh = all.find((c) => c.id === previewContract.id);
          if (fresh && fresh.clientSignature && !previewContract.clientSignature) {
            setPreviewContract(fresh);
            addToast(
              'success',
              `Klient právě online podepsal smlouvu č. ${fresh.contractNumber}! Podpis byl propsán do smlouvy.`
            );
            return;
          }
        }
        addToast('success', '✓ Zaznamenán nový online podpis klienta. Dokument byl aktualizován.');
      }
    } catch (e) {
      console.warn('Chyba při kontrole vzdálených podpisů:', e);
    }
  }, [previewContract]);

  useEffect(() => {
    syncRemoteSignatures();

    const interval = setInterval(() => {
      syncRemoteSignatures();
    }, 15000);

    const handleFocus = () => {
      syncRemoteSignatures();
    };

    const handleLocalSign = () => {
      const all = getStoredContracts();
      setContracts(all);
      if (previewContract) {
        const fresh = all.find((c) => c.id === previewContract.id);
        if (fresh) setPreviewContract(fresh);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('contract-signed-locally', handleLocalSign);
    window.addEventListener('storage', handleLocalSign);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('contract-signed-locally', handleLocalSign);
      window.removeEventListener('storage', handleLocalSign);
    };
  }, [syncRemoteSignatures, previewContract]);

  // Open contract preview
  const handleShowPreview = (contract: Contract) => {
    setPreviewContract(contract);
    setPreviewInitialDoc(contract.docKind === 'quote' ? 'nabidka' : 'smlouva');
  };

  // Save / update contract
  const handleSaveToHistory = (contract: Contract) => {
    addStoredContract(contract);
    const updatedContracts = getStoredContracts();
    setContracts(updatedContracts);
    setSavedContractIds((prev) => new Set([...prev, contract.id]));
    if (previewContract?.id === contract.id) {
      setPreviewContract(contract);
    }
    addToast('success', 'Smlouva uložena');
  };

  const handleUpdateContract = (updated: Contract) => {
    addStoredContract(updated);
    const updatedList = getStoredContracts();
    setContracts(updatedList);
    if (previewContract?.id === updated.id) {
      setPreviewContract(updated);
    }
  };

  const handleRestoreBackup = (backup: AppBackupData, mode: 'replace' | 'merge') => {
    const result = applyBackup(backup, mode);
    setContractor(result.contractor);
    setClients(result.clients);
    setContracts(result.contracts);
    setSavedContractIds(new Set(result.contracts.map((c) => c.id)));
    setCalendarEvents(getStoredCalendarEvents());
  };

  // Delete contract
  const handleDeleteContract = (id: string) => {
    deleteStoredContract(id);
    const updated = getStoredContracts();
    setContracts(updated);
    setSavedContractIds(new Set(updated.map((c) => c.id)));
    if (previewContract?.id === id) {
      setPreviewContract(null);
    }
    addToast('info', 'Smlouva byla odstraněna z historie');
  };

  // Save contractor profile
  const handleSaveContractor = (profile: ContractorProfile) => {
    saveContractorProfile(profile);
    setContractor(profile);
    addToast('success', 'Údaje zhotovitele byly úspěšně uloženy');
  };

  const handleUpdateContractorProfile = (updated: ContractorProfile) => {
    saveContractorProfile(updated);
    setContractor(updated);
  };

  // Client dialog handlers
  const handleOpenNewClientDialog = () => {
    setClientToEdit(null);
    setIsClientModalOpen(true);
  };

  const handleEditClient = (client: Client) => {
    setClientToEdit(client);
    setIsClientModalOpen(true);
  };

  const handleSaveClient = (
    clientData: Omit<Client, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    if (existingId) {
      const existing = clients.find((c) => c.id === existingId);
      if (existing) {
        const updated: Client = { ...existing, ...clientData };
        updateStoredClient(updated);
        setClients(getStoredClients());
        addToast('success', 'Údaje klienta byly upraveny');
      }
    } else {
      addStoredClient(clientData);
      setClients(getStoredClients());
      addToast('success', 'Nový klient byl přidán do seznamu');
    }
  };

  const handleDeleteClient = (id: string) => {
    deleteStoredClient(id);
    setClients(getStoredClients());
    addToast('info', 'Klient byl smazán');
  };

  const handleCreateContractForClient = (client: Client) => {
    if (!isProUser(contractor) && contracts.length >= PRO_CONFIG.maxFreeContracts) {
      handleOpenPaywall(
        `V bezplatném tarifu máte vytvořeno ${contracts.length} ze 3 povolených smluv. Přejděte na Mistr PRO pro neomezenou tvorbu smluv a nabídek.`
      );
      return;
    }
    setActiveTab('nova-smlouva');
    setPreviewContract(null);
  };

  // Calendar handlers
  const handleAddCalendarEvent = (eventData: Omit<CalendarEvent, 'id' | 'createdAt'>) => {
    addStoredCalendarEvent(eventData);
    setCalendarEvents(getStoredCalendarEvents());
    addToast('success', `Událost "${eventData.title}" byla uložena do kalendáře.`);
  };

  const handleUpdateCalendarEvent = (event: CalendarEvent) => {
    updateStoredCalendarEvent(event);
    setCalendarEvents(getStoredCalendarEvents());
  };

  const handleDeleteCalendarEvent = (id: string) => {
    deleteStoredCalendarEvent(id);
    setCalendarEvents(getStoredCalendarEvents());
    addToast('info', 'Událost byla smazána z kalendáře.');
  };

  // Quick lead creation from pipeline
  const handleAddQuickLead = (leadData: {
    clientName: string;
    clientPhone: string;
    clientAddress: string;
    workDescription: string;
    estimatedPrice: number;
    inspectionDate?: string;
  }) => {
    const today = new Date().toISOString().slice(0, 10);
    const newClient: Client = {
      id: `cl_${Date.now()}`,
      name: leadData.clientName,
      phone: leadData.clientPhone || '',
      email: '',
      address: leadData.clientAddress || '',
      createdAt: today,
    };

    const newContract: Contract = {
      id: `contract_${Date.now()}`,
      contractNumber: `${new Date().getFullYear()}${String(contracts.length + 1).padStart(3, '0')}`,
      invoiceNumber: `FV-${new Date().getFullYear()}${String(contracts.length + 1).padStart(3, '0')}`,
      variableSymbol: `${new Date().getFullYear()}${String(contracts.length + 1).padStart(3, '0')}`,
      createdAt: today,
      contractor: contractor || {
        name: 'Živnostník',
        ico: '12345678',
        address: 'Česká republika',
        bankAccount: '123456789/0100',
        phone: '+420 777 000 000',
        email: 'info@zivnostnik.cz',
        defaultPlace: 'v Praze',
      },
      client: newClient,
      workDescription: leadData.workDescription,
      price: leadData.estimatedPrice || 0,
      deliveryDate: leadData.inspectionDate || today,
      conclusionDate: today,
      executionPlace: contractor?.defaultPlace || 'v Praze',
      hasVat: false,
      leadStage: 'inquiry',
      inquiryDate: today,
      nextStepDate: leadData.inspectionDate,
      nextStepNote: leadData.inspectionDate ? `Obhlídka dne ${leadData.inspectionDate}` : undefined,
      docKind: 'quote',
      status: 'draft',
    };

    addStoredContract(newContract);
    const updated = getStoredContracts();
    setContracts(updated);
    addToast('success', `Nová poptávka pro klienta "${leadData.clientName}" byla úspěšně uložena.`);
  };

  // Preload sample test data
  const handleSeedSampleData = () => {
    const { contractor: c } = seedSampleData();
    setContractor(c);
    setClients(getStoredClients());
    setContracts(getStoredContracts());
    setCalendarEvents(getStoredCalendarEvents());
    addToast('info', 'Byla načtena ukázková data pro testování');
  };

  // Fast photo capture from mobile camera
  const handleFastPhotoCapture = async (contract: Contract, file: File) => {
    try {
      addToast('info', 'Zpracovávám fotografii...');
      const dataUrl = await compressImageFile(file, 1400, 1400, 0.8);
      const newPhoto = {
        id: `photo_${Date.now()}`,
        dataUrl,
        caption: `Foto ze stavby (${new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })})`,
        category: 'progress' as const,
        createdAt: new Date().toISOString(),
      };
      const updatedContract: Contract = {
        ...contract,
        photos: [...(contract.photos || []), newPhoto],
      };
      handleUpdateContract(updatedContract);
      triggerHaptic('success');
      addToast('success', 'Fotografie byla úspěšně uložena k zakázce.');
    } catch (e: any) {
      console.error('Chyba při ukládání fotky:', e);
      addToast('error', 'Nepodařilo se uložit fotografii.');
    }
  };

  // Confirm on-device kiosk signature
  const handleConfirmKioskSignature = (contractId: string, signatureDataUrl: string) => {
    const target = contracts.find((c) => c.id === contractId);
    if (!target) return;
    const today = new Date().toISOString().slice(0, 10);
    const updated: Contract = {
      ...target,
      clientSignature: signatureDataUrl,
      clientSignatureDate: today,
      status: target.status === 'draft' ? 'signed' : target.status,
    };
    handleUpdateContract(updated);
  };

  // Apply on-site estimate to contract form
  const handleApplyEstimateToContract = (estimate: {
    tradeTitle: string;
    description: string;
    price: number;
    days: number;
    items: any[];
  }) => {
    if (!isProUser(contractor) && contracts.length >= PRO_CONFIG.maxFreeContracts) {
      handleOpenPaywall(
        `V bezplatném tarifu máte vytvořeno ${contracts.length} ze 3 povolených smluv. Přejděte na Mistr PRO pro neomezenou tvorbu smluv a nabídek.`
      );
      return;
    }
    setActiveTab('nova-smlouva');
    addToast('success', `Orientační rozpočet byl předvyplněn.`);
  };

  // Tab change
  const handleTabChange = (tab: TabType) => {
    if (tab === 'nova-smlouva') {
      if (!isProUser(contractor) && contracts.length >= PRO_CONFIG.maxFreeContracts) {
        handleOpenPaywall(
          `V bezplatném tarifu máte vytvořeno ${contracts.length} ze 3 povolených smluv. Přejděte na Mistr PRO pro neomezenou tvorbu smluv a nabídek.`
        );
        return;
      }
    }
    setActiveTab(tab);
    setPreviewContract(null);
  };

  const handleProtectedNewContract = () => {
    if (!isProUser(contractor) && contracts.length >= PRO_CONFIG.maxFreeContracts) {
      handleOpenPaywall(
        `V bezplatném tarifu máte vytvořeno ${contracts.length} ze 3 povolených smluv. Přejděte na Mistr PRO pro neomezenou tvorbu smluv a nabídek.`
      );
      return;
    }
    setSelectedTradeTemplate(null);
    setActiveTab('nova-smlouva');
  };

  // Remote signing portal check
  if (signParam) {
    return (
      <Suspense fallback={null}>
      <RemoteSigningPortal
        shareId={signParam}
        onBackToApp={() => {
          // Celé nové načtení bez parametru, aby aplikace prošla přihlášením (AuthGate)
          window.location.assign(window.location.pathname);
        }}
      />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FB] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 transition-colors">
      {/* Offline Status Indicator */}
      <OfflineStatusIndicator />

      {/* Toast Notifikace */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Horní navigace */}
      <Navbar
        activeTab={previewContract ? 'nova-smlouva' : activeTab}
        onSelectTab={handleTabChange}
        contractsCount={contracts.length}
        clientsCount={clients.length}
        overdueInvoicesCount={overdueInvoicesCount}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        currentUser={currentUser}
        onOpenCloudModal={() => setIsCloudModalOpen(true)}
        contractor={contractor}
        onOpenPaywall={openPaywallProp}
      />

      {/* Dialog pro přidání/úpravu klienta */}
      <ClientDialog
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSave={handleSaveClient}
        clientToEdit={clientToEdit}
      />

      {/* Účet řemeslníka a synchronizace */}
      <CloudAccountModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        currentUser={currentUser}
        clients={clients}
        contracts={contracts}
        onToast={addToast}
      />

      {/* Hlavní obsah */}
      <main className="flex-1 w-full px-3 sm:px-6 pt-5 sm:pt-7 pb-28 sm:pb-12">
        <Suspense fallback={null}>
        {previewContract ? (
          <ContractPreview
            contract={previewContract}
            initialDocType={previewInitialDoc}
            onBack={() => setPreviewContract(null)}
            onSaveToHistory={handleSaveToHistory}
            isSaved={savedContractIds.has(previewContract.id)}
            onToast={addToast}
          />
        ) : (
          <>
            {/* Dashboard: Denní přehled Dnes v práci */}
            {activeTab === 'dashboard' && (
              <DashboardPage
                contracts={contracts}
                calendarEvents={calendarEvents}
                contractor={contractor}
                onSelectTab={handleTabChange}
                onOpenPaywall={openPaywallProp}
                onOpenContract={(contract) => {
                  setPreviewContract(contract);
                  setPreviewInitialDoc('smlouva');
                }}
                onNewContract={() => {
                  if (!isProUser(contractor) && contracts.length >= PRO_CONFIG.maxFreeContracts) {
                    handleOpenPaywall(
                      `V bezplatném tarifu máte vytvořeno ${contracts.length} ze 3 povolených smluv. Přejděte na Mistr PRO pro neomezenou tvorbu smluv a nabídek.`
                    );
                    return;
                  }
                  setSelectedTradeTemplate(null);
                  setActiveTab('nova-smlouva');
                }}
                onSelectTradeTemplate={(tplId) => {
                  if (!isProUser(contractor) && contracts.length >= PRO_CONFIG.maxFreeContracts) {
                    handleOpenPaywall(
                      `V bezplatném tarifu máte vytvořeno ${contracts.length} ze 3 povolených smluv. Přejděte na Mistr PRO pro neomezenou tvorbu smluv a nabídek.`
                    );
                    return;
                  }
                  setSelectedTradeTemplate(tplId);
                  setActiveTab('nova-smlouva');
                }}
                onOpenReceiptScan={() => setActiveTab('finance')}
                onOpenQuickMessages={(c) => setQuickMessagesContract(c)}
                onOpenSigningKiosk={(c) => setSigningKioskContract(c)}
                onOpenEstimateCalculator={() => setIsEstimateCalculatorOpen(true)}
                onOpenShoppingList={(c) => setShoppingListContract(c)}
                onOpenQuickCashReceipt={(c) => setQuickCashReceiptContract(c)}
                onOpenLogbook={(c) => setLogbookContract(c)}
                onOpenAccountantModal={() => {
                  if (!isProUser(contractor)) {
                    handleOpenPaywall(
                      'Kompletní balíček pro účetní (ZIP, faktury a CSV export) je prémiová funkce pro předplatitele Mistr PRO.'
                    );
                    return;
                  }
                  setIsAccountantModalOpen(true);
                }}
                onOpenTechnicalProtocols={(c) => setTechnicalProtocolsContract(c)}
                onOpenSubcontractors={(c) => setSubcontractorsContract(c)}
                onOpenToolRental={(c) => setToolRentalContract(c)}
                onOpenDepartureChecklist={(c) => setDepartureChecklistContract(c)}
                onOpenArchive={(c) => setArchiveContract(c)}
                onFastPhotoCapture={handleFastPhotoCapture}
                onMarkInvoicePaid={(contractId) => {
                  const target = contracts.find((c) => c.id === contractId);
                  if (target) {
                    handleUpdateContract({
                      ...target,
                      status: 'paid',
                      paidDate: new Date().toISOString().slice(0, 10),
                    });
                    addToast('success', 'Faktura byla označena jako zaplacená.');
                  }
                }}
              />
            )}

            {/* Kalendář řemeslníka */}
            {activeTab === 'kalendar' && (
              <CalendarPage
                contracts={contracts}
                clients={clients}
                events={calendarEvents}
                onAddEvent={handleAddCalendarEvent}
                onUpdateEvent={handleUpdateCalendarEvent}
                onDeleteEvent={handleDeleteCalendarEvent}
                onOpenContract={(contract) => {
                  setPreviewContract(contract);
                  setPreviewInitialDoc('smlouva');
                }}
                onNewContract={handleProtectedNewContract}
              />
            )}

            {/* Časová osa poptávek (CRM Kanban Pipeline) */}
            {activeTab === 'pipeline' && (
              <LeadsPipelinePage
                contracts={contracts}
                clients={clients}
                onUpdateContract={handleUpdateContract}
                onOpenContract={(contract) => {
                  setPreviewContract(contract);
                  setPreviewInitialDoc(contract.docKind === 'quote' ? 'nabidka' : 'smlouva');
                }}
                onNewContract={handleProtectedNewContract}
                onAddQuickLead={handleAddQuickLead}
                onSwitchView={() => setActiveTab('historie')}
              />
            )}

            {/* Evidence nezaplacených faktur & hlídač splatnosti */}
            {activeTab === 'faktury' && (
              <InvoicesOverviewPage
                contracts={contracts}
                contractor={contractor}
                onOpenContract={(contract, docType) => {
                  setPreviewContract(contract);
                  setPreviewInitialDoc(docType || 'faktura');
                }}
                onUpdateContract={handleUpdateContract}
                onToast={addToast}
              />
            )}

            {/* Generátor nové smlouvy / cenové nabídky */}
            {activeTab === 'nova-smlouva' && (
              <ContractForm
                contractor={contractor}
                clients={clients}
                initialTemplateId={selectedTradeTemplate}
                onOpenSettings={() => setActiveTab('nastaveni')}
                onOpenNewClientDialog={handleOpenNewClientDialog}
                onEditClient={handleEditClient}
                onShowPreview={handleShowPreview}
                onPreloadSampleData={handleSeedSampleData}
                onToast={addToast}
              />
            )}

            {/* Seznam a správa klientů */}
            {activeTab === 'klienti' && (
              <ClientsPage
                clients={clients}
                onOpenNewClientDialog={handleOpenNewClientDialog}
                onEditClient={handleEditClient}
                onDeleteClient={handleDeleteClient}
                onCreateContractForClient={handleCreateContractForClient}
              />
            )}

            {/* Historie a archiv smluv */}
            {activeTab === 'historie' && (
              <HistoryPage
                contracts={contracts}
                onOpenContract={(contract, docType) => {
                  setPreviewContract(contract);
                  setPreviewInitialDoc(docType || (contract.docKind === 'quote' ? 'nabidka' : 'smlouva'));
                }}
                onUpdateContract={handleUpdateContract}
                onDeleteContract={handleDeleteContract}
                onNewContract={handleProtectedNewContract}
                onSyncSignatures={syncRemoteSignatures}
                onSwitchView={() => setActiveTab('pipeline')}
              />
            )}

            {/* Finanční radar & Daně */}
            {activeTab === 'finance' && (
              <FinancialRadarPage
                contracts={contracts}
                contractor={contractor}
                onOpenContract={handleShowPreview}
                onToast={addToast}
                onOpenPaywall={PAYMENTS_ENABLED ? (reason) => handleOpenPaywall(reason) : undefined}
              />
            )}

            {/* Nastavení profilu zhotovitele */}
            {activeTab === 'nastaveni' && (
              <SettingsPage
                initialProfile={contractor}
                onSave={handleSaveContractor}
                onPreloadSample={handleSeedSampleData}
                onRestoreBackup={handleRestoreBackup}
                onToast={addToast}
                onOpenPaywall={openPaywallProp}
                onOpenInvoiceModal={PAYMENTS_ENABLED ? () => setIsInvoiceModalOpen(true) : undefined}
              />
            )}
          </>
        )}
        </Suspense>
      </main>

      {/* Spodní lišta pro pohodlné ovládání palcem na mobilu */}
      <BottomNav
        activeTab={previewContract ? 'nova-smlouva' : activeTab}
        onSelectTab={handleTabChange}
        overdueInvoicesCount={overdueInvoicesCount}
        onOpenEstimateCalculator={() => setIsEstimateCalculatorOpen(true)}
        currentUser={currentUser}
        onOpenCloudModal={() => setIsCloudModalOpen(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        contractor={contractor}
        onOpenPaywall={openPaywallProp}
      />

      <Suspense fallback={null}>
      {/* Rychlé zprávy pro klienta */}
      {quickMessagesContract && (
        <QuickClientMessagesModal
          isOpen={!!quickMessagesContract}
          onClose={() => setQuickMessagesContract(null)}
          contract={quickMessagesContract}
          onUpdateContract={(updated: Contract) => {
            addStoredContract(updated);
            setContracts(getStoredContracts());
            setQuickMessagesContract(updated);
            if (previewContract?.id === updated.id) setPreviewContract(updated);
          }}
          onToast={addToast}
        />
      )}

      {/* Rychlá kalkulačka na obhlídce */}
      <QuickEstimateCalculatorModal
        isOpen={isEstimateCalculatorOpen}
        onClose={() => setIsEstimateCalculatorOpen(false)}
        onApplyToContract={handleApplyEstimateToContract}
        onToast={addToast}
      />

      {/* Kioskový režim předání telefonu zákazníkovi k podpisu */}
      {signingKioskContract && (
        <ClientSigningKioskModal
          isOpen={!!signingKioskContract}
          onClose={() => setSigningKioskContract(null)}
          contract={signingKioskContract}
          onConfirmSignature={handleConfirmKioskSignature}
          onToast={addToast}
        />
      )}

      {/* 🛒 Nákupní lístek do stavebnin na 1 klik */}
      {shoppingListContract && (
        <ShoppingListModal
          isOpen={!!shoppingListContract}
          onClose={() => setShoppingListContract(null)}
          contract={shoppingListContract}
          onUpdateContract={handleUpdateContract}
          onToast={addToast}
        />
      )}

      {/* 💵 Bleskový příjem hotovosti na ruku (PPD) */}
      {quickCashReceiptContract && (
        <QuickCashReceiptModal
          isOpen={!!quickCashReceiptContract}
          onClose={() => setQuickCashReceiptContract(null)}
          contract={quickCashReceiptContract}
          onUpdateContract={handleUpdateContract}
          onOpenFullReceiptView={(c) => {
            setPreviewContract(c);
            setPreviewInitialDoc('pokladni_doklad');
          }}
          onToast={addToast}
        />
      )}

      {/* 🚗 Kniha jízd a hromadný cesťák na celou stavbu */}
      {logbookContract && (
        <LogbookModal
          isOpen={!!logbookContract}
          onClose={() => setLogbookContract(null)}
          contract={logbookContract}
          onUpdateContract={handleUpdateContract}
          onToast={addToast}
        />
      )}

      {/* 📦 1-klikový Balíček pro účetní (měsíční/kvartální/roční) */}
      <AccountantExportModal
        isOpen={isAccountantModalOpen}
        onClose={() => setIsAccountantModalOpen(false)}
        contracts={contracts}
        contractor={contractor}
        onToast={addToast}
      />

      {/* 🔍 Protokoly technických zkoušek ČSN */}
      {technicalProtocolsContract && (
        <TechnicalProtocolsModal
          isOpen={!!technicalProtocolsContract}
          onClose={() => setTechnicalProtocolsContract(null)}
          contract={technicalProtocolsContract}
          onUpdateContract={handleUpdateContract}
          onToast={addToast}
        />
      )}

      {/* 👥 Tým & Parťáci na stavbě */}
      {subcontractorsContract && (
        <SubcontractorsModal
          isOpen={!!subcontractorsContract}
          onClose={() => setSubcontractorsContract(null)}
          contract={subcontractorsContract}
          onUpdateContract={handleUpdateContract}
          onToast={addToast}
        />
      )}

      {/* 🛠️ Hlídač půjčeného nářadí a techniky */}
      {toolRentalContract && (
        <ToolRentalModal
          isOpen={!!toolRentalContract}
          onClose={() => setToolRentalContract(null)}
          contract={toolRentalContract}
          onUpdateContract={handleUpdateContract}
          onToast={addToast}
        />
      )}

      {/* 🔒 Bezpečnostní kontrola před odjezdem ze stavby */}
      {departureChecklistContract && (
        <DepartureChecklistModal
          isOpen={!!departureChecklistContract}
          onClose={() => setDepartureChecklistContract(null)}
          contract={departureChecklistContract}
          onUpdateContract={handleUpdateContract}
          onToast={addToast}
        />
      )}

      {/* 🗂️ Kompletní složka zakázky v PDF a HTML */}
      {archiveContract && (
        <ContractArchiveModal
          isOpen={!!archiveContract}
          onClose={() => setArchiveContract(null)}
          contract={archiveContract}
          onToast={addToast}
        />
      )}

      {/* 👑 Paywall & Mistr PRO Předplatné (jen se zapnutým placením) */}
      {PAYMENTS_ENABLED && (
      <PaywallModal
        isOpen={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
        contractor={contractor}
        onUpdateContractor={handleUpdateContractorProfile}
        reason={paywallReason}
        onToast={addToast}
      />
      )}

      {/* 🧾 Daňový doklad k licenci pro účetní */}
      {PAYMENTS_ENABLED && (
      <SubscriptionInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        contractor={contractor}
      />
      )}

      </Suspense>

      {/* Footer */}
      <footer className="no-print border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 mb-16 md:mb-0 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} Řemeslník PRO · Komplexní systém řemeslníka pro smlouvy, faktury, kalendář a poptávky</p>
          <p className="text-slate-400 dark:text-slate-500">Všechna data se ukládají lokálně i do cloudu.</p>
        </div>
      </footer>
    </div>
  );
}
