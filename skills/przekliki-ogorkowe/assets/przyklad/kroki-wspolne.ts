/**
 * Kroki wspólne: wejście na adres, klik po widocznej nazwie, pole formularza, widoczny tekst.
 * Kopiujesz do e2e/przekliki/kroki/wspolne.ts; kroki swojej domeny dopisujesz w osobnych plikach.
 * Zasada: krok robi to, co robi człowiek (rola i widoczna nazwa), nie selektor CSS.
 */
import { expect } from "@playwright/test";
import { Blokada, krok } from "../_silnik/rejestr";

const doRegex = (tekst: string) => new RegExp(tekst.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "iu");

krok(/^otwieram "([^"]+)"(?: na telefonie)?$/u, async (swiat, adres) => {
  const cel = adres.startsWith("http") ? adres : `${swiat.baseURL}${adres}`;
  const odp = await swiat.page.goto(cel, { waitUntil: "domcontentloaded" });
  const status = odp?.status() ?? 0;
  swiat.dowod(`GET ${cel} -> HTTP ${status}, po przekierowaniach: ${swiat.page.url()}`);
  expect(status, `trasa ${adres} oddała HTTP ${status}`).toBeLessThan(400);
});

krok(/^klikam "([^"]+)"$/u, async (swiat, nazwa) => {
  const wzorzec = doRegex(nazwa);
  const cel = swiat.page.getByRole("button", { name: wzorzec }).or(swiat.page.getByRole("link", { name: wzorzec })).first();
  await expect(cel, `nie ma czego kliknąć: "${nazwa}"`).toBeVisible({ timeout: 20_000 });
  await cel.click();
});

krok(/^wpisuję "([^"]*)" w pole "([^"]+)"$/u, async (swiat, wartosc, pole) => {
  await swiat.page.getByLabel(doRegex(pole)).fill(wartosc);
});

krok(/^wpisuję hasło testowe w pole "([^"]+)"$/u, async (swiat, pole) => {
  const haslo = process.env.PRZEKLIKI_HASLO_TESTOWE;
  if (!haslo) throw new Blokada("brak zmiennej PRZEKLIKI_HASLO_TESTOWE (hasło konta testowego, nigdy prawdziwe)");
  await swiat.page.getByLabel(doRegex(pole)).fill(haslo);
  swiat.dowod(`wpisano hasło testowe w pole "${pole}" (wartość niezapisana)`);
});

krok(/^widzę tekst "([^"]+)"$/u, async (swiat, tekst) => {
  await expect(swiat.page.getByText(doRegex(tekst)).first(), `brak tekstu "${tekst}"`).toBeVisible({ timeout: 20_000 });
  swiat.dowod(`widoczny tekst "${tekst}" na ${swiat.page.url()}`);
});

krok(/^nie widzę tekstu "([^"]+)"$/u, async (swiat, tekst) => {
  await expect(swiat.page.getByText(doRegex(tekst))).toHaveCount(0);
});

krok(/^adres strony zawiera "([^"]+)"$/u, async (swiat, fragment) => {
  await expect(swiat.page).toHaveURL(doRegex(fragment));
});

krok(/^dostałem link logowania na skrzynkę testową$/u, async () => {
  throw new Blokada("brak skrzynki testowej w tym środowisku: dopisz krok, który ją czyta, albo zostaw scenariusz jako @planowane");
});
