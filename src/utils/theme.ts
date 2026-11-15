/**
 * Světlý / tmavý režim. Bez vlastní volby se aplikace řídí nastavením zařízení (a sleduje jeho změny);
 * jakmile uživatel použije přepínač, platí jeho volba na tomto zařízení natrvalo.
 */

const CHOICE_KEY = 'theme_choice';

export type ThemeChoice = 'light' | 'dark';

export function getThemeChoice(): ThemeChoice | null {
  try {
    const value = localStorage.getItem(CHOICE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(CHOICE_KEY, choice);
  } catch {
    // bez přístupu k úložišti platí volba jen do zavření stránky
  }
}

export function systemPrefersDark(): boolean {
  try {
    return !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function resolveIsDark(): boolean {
  const choice = getThemeChoice();
  return choice ? choice === 'dark' : systemPrefersDark();
}

export function applyTheme(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark);
}

/** Zavolá `onChange`, když se změní režim zařízení a uživatel nemá vlastní volbu. Vrací funkci pro zrušení. */
export function watchSystemTheme(onChange: (isDark: boolean) => void): () => void {
  if (!window.matchMedia) return () => {};
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (!getThemeChoice()) onChange(query.matches);
  };
  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
}
