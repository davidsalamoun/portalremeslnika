import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Contract, Client, ContractorProfile, SiteLogEntry } from '../types/contract';

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Use custom firestoreDatabaseId if configured in firebase-applet-config.json
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot per requirements
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or network restricted.');
    }
    return false;
  }
}

// Auth provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Cloud sync functions for Craftsman
export async function syncContractorProfileToCloud(profile: ContractorProfile, userId: string) {
  const path = `users/${userId}`;
  try {
    await setDoc(
      doc(db, 'users', userId),
      {
        userId,
        email: profile.email || auth.currentUser?.email || '',
        name: profile.name || 'Živnostník',
        ico: profile.ico || '',
        dic: profile.dic || '',
        address: profile.address || '',
        phone: profile.phone || '',
        bankAccount: profile.bankAccount || '',
        subscriptionPlan: profile.subscriptionPlan || 'free',
        subscriptionExpiresAt: profile.subscriptionExpiresAt || null,
        trialStartedAt: profile.trialStartedAt || null,
        subscriptionInvoiceNumber: profile.subscriptionInvoiceNumber || null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadContractorProfileFromCloud(userId: string): Promise<Partial<ContractorProfile> | null> {
  const path = `users/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (snap.exists()) {
      return snap.data() as Partial<ContractorProfile>;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// Contracts cloud sync
export async function syncContractToCloud(contract: Contract, userId: string) {
  const path = `users/${userId}/contracts/${contract.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'contracts', contract.id), {
      id: contract.id,
      ownerId: userId,
      contractNumber: contract.contractNumber || 'SML',
      title: contract.workDescription?.substring(0, 80) || 'Zakázka',
      docKind: contract.docKind || 'contract',
      status: contract.status || 'draft',
      totalAmount: contract.price || 0,
      dataJson: JSON.stringify(contract),
      clientSignature: contract.clientSignature || '',
      clientSignedAt: contract.clientSignatureDate || '',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadContractsFromCloud(userId: string): Promise<Contract[]> {
  const path = `users/${userId}/contracts`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'contracts'));
    const list: Contract[] = [];
    snap.forEach((d) => {
      try {
        const item = d.data();
        if (item.dataJson) {
          const parsed = JSON.parse(item.dataJson) as Contract;
          list.push(parsed);
        }
      } catch (e) {
        console.error('Failed to parse contract JSON from cloud', e);
      }
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteContractFromCloud(contractId: string, userId: string) {
  const path = `users/${userId}/contracts/${contractId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'contracts', contractId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Clients cloud sync
export async function syncClientToCloud(client: Client, userId: string) {
  const path = `users/${userId}/clients/${client.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'clients', client.id), {
      id: client.id,
      ownerId: userId,
      name: client.name,
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      ico: client.ico || '',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadClientsFromCloud(userId: string): Promise<Client[]> {
  const path = `users/${userId}/clients`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'clients'));
    const list: Client[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: data.id,
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        ico: data.ico,
        createdAt: data.updatedAt || new Date().toISOString(),
      });
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteClientFromCloud(clientId: string, userId: string) {
  const path = `users/${userId}/clients/${clientId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'clients', clientId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Remote signing share creation and retrieval
export interface PublicContractShare {
  id: string;
  ownerId: string;
  contractNumber: string;
  title: string;
  totalAmount: number;
  contractData: string;
  status: 'pending' | 'signed';
  clientSignature?: string;
  clientSignedAt?: string;
  signerName?: string;
  updatedAt?: string;
}

export async function createPublicSignShare(contract: Contract, ownerId: string): Promise<string> {
  const shareId = contract.id;
  const path = `public_shares/${shareId}`;
  try {
    // Ověřit, zda dokument již neexistuje a není podepsán
    const existingSnap = await getDoc(doc(db, 'public_shares', shareId));
    if (existingSnap.exists()) {
      const existingData = existingSnap.data() as PublicContractShare;
      if (existingData.status === 'signed' && existingData.clientSignature) {
        // Již podepsáno klientem, nepřepisovat na pending
        return shareId;
      }
    }

    await setDoc(doc(db, 'public_shares', shareId), {
      id: shareId,
      ownerId,
      contractNumber: contract.contractNumber || 'SML',
      title: contract.workDescription?.substring(0, 100) || 'Zakázka',
      totalAmount: contract.price || 0,
      contractData: JSON.stringify(contract),
      status: 'pending',
      updatedAt: new Date().toISOString(),
    });
    return shareId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getPublicSignShare(shareId: string): Promise<PublicContractShare | null> {
  const path = `public_shares/${shareId}`;
  try {
    const snap = await getDoc(doc(db, 'public_shares', shareId));
    if (snap.exists()) {
      return snap.data() as PublicContractShare;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function submitRemoteClientSignature(
  shareId: string,
  signatureBase64: string,
  signerName: string
) {
  const path = `public_shares/${shareId}`;
  try {
    await updateDoc(doc(db, 'public_shares', shareId), {
      clientSignature: signatureBase64,
      clientSignedAt: new Date().toISOString(),
      signerName: signerName.trim() || 'Zákazník',
      status: 'signed',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Real-time posluchač pro sledování stavu online podpisu klientem
 */
export function subscribePublicSignShare(
  shareId: string,
  onUpdate: (share: PublicContractShare | null) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const unsub = onSnapshot(
      doc(db, 'public_shares', shareId),
      (snap) => {
        if (snap.exists()) {
          onUpdate(snap.data() as PublicContractShare);
        } else {
          onUpdate(null);
        }
      },
      (err) => {
        console.warn('Posluchač stavu podpisu zaznamenal chybu:', err?.message || err);
        onError?.(err);
      }
    );
    return unsub;
  } catch (err) {
    console.warn('Nepodařilo se nastavit onSnapshot pro public_share:', err);
    return () => {};
  }
}

/**
 * Kontrola nepodepsaných smluv proti cloudu (pro synchronizaci při startu nebo obnovení)
 */
export async function checkAndSyncRemoteSignatures(
  contracts: Contract[]
): Promise<{ updatedContracts: Contract[]; hasChanges: boolean }> {
  let hasChanges = false;
  const updatedContracts: Contract[] = await Promise.all(
    contracts.map(async (contract) => {
      // Pokud už klient podepsal, není třeba volat
      if (contract.clientSignature) {
        return contract;
      }
      try {
        const share = await getPublicSignShare(contract.id);
        if (share && share.status === 'signed' && share.clientSignature) {
          hasChanges = true;
          const datePart = (share.clientSignedAt || new Date().toISOString()).split('T')[0];
          return {
            ...contract,
            clientSignature: share.clientSignature,
            clientSignatureDate: datePart,
            status: contract.status === 'draft' ? ('signed' as const) : contract.status,
          };
        }
      } catch {
        // Ignorujeme síťové chyby
      }
      return contract;
    })
  );
  return { updatedContracts, hasChanges };
}

// Site Log Entries (Stavební deník) in Firestore
export async function syncSiteLogToCloud(
  userId: string,
  contractId: string,
  log: SiteLogEntry
) {
  const path = `users/${userId}/contracts/${contractId}/site_logs/${log.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'contracts', contractId, 'site_logs', log.id), {
      id: log.id,
      ownerId: userId,
      contractId,
      date: log.date,
      weather: log.weather || '',
      workersCount: log.workersCount || 1,
      hoursWorked: log.hoursWorked || 8,
      workDescription: log.workDescription,
      issues: log.issues || '',
      materialsDelivered: log.materialsDelivered || '',
      photosCount: log.photos?.length || 0,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadSiteLogsFromCloud(
  userId: string,
  contractId: string
): Promise<SiteLogEntry[]> {
  const path = `users/${userId}/contracts/${contractId}/site_logs`;
  try {
    const snap = await getDocs(
      collection(db, 'users', userId, 'contracts', contractId, 'site_logs')
    );
    const list: SiteLogEntry[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: data.id,
        date: data.date,
        weather: data.weather,
        workersCount: data.workersCount,
        hoursWorked: data.hoursWorked,
        workDescription: data.workDescription,
        issues: data.issues,
        materialsDelivered: data.materialsDelivered,
        photos: [],
        createdAt: data.updatedAt || new Date().toISOString(),
      });
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
