export interface AresCompanyData {
  ico: string;
  name: string;
  dic?: string;
  address: string;
  city?: string;
}

/**
 * Načte údaje o ekonomickém subjektu z oficiálního registru ARES (MF ČR) podle IČO.
 */
export async function fetchCompanyByIco(ico: string): Promise<AresCompanyData> {
  const cleanIco = ico.replace(/\D/g, '').trim();
  if (cleanIco.length !== 8) {
    throw new Error('IČO musí mít přesně 8 číslic.');
  }

  try {
    const response = await fetch(
      `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${cleanIco}`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Subjekt s IČO ${cleanIco} nebyl v registru ARES nalezen.`);
      }
      throw new Error(`Registr ARES vrátil chybu (kód ${response.status}).`);
    }

    const data = await response.json();

    const name = data.obchodniJmeno || '';
    const dic = data.dic || undefined;

    // Sestavení adresy
    let address = '';
    if (data.sidlo?.textovaAdresa) {
      address = data.sidlo.textovaAdresa;
    } else if (data.sidlo) {
      const s = data.sidlo;
      const street = s.nazevUlice || s.nazevObce || '';
      const num = s.cisloDomovni ? `${s.cisloDomovni}${s.cisloOrientacni ? '/' + s.cisloOrientacni : ''}` : '';
      const city = s.nazevObce || '';
      const psc = s.psc ? s.psc.toString().replace(/(\d{3})(\d{2})/, '$1 $2') : '';
      address = `${street} ${num}, ${psc} ${city}`.trim();
    }

    return {
      ico: cleanIco,
      name,
      dic,
      address,
      city: data.sidlo?.nazevObce,
    };
  } catch (err: any) {
    console.error('Chyba při volání ARES:', err);
    throw new Error(err.message || 'Nepodařilo se načíst data z registru ARES.');
  }
}
