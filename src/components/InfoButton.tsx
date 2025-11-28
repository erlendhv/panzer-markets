import { useState, useRef, useEffect } from 'react';

export function InfoButton() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        aria-label="Informasjon"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-[80vh] overflow-y-auto">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Hvordan fungerer Panzer Markets?</h3>
          </div>

          <div className="p-4 space-y-4">
            {/* Betting explanation */}
            <section>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="text-green-600">📈</span> Slik fungerer betting
              </h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                <p>
                  <strong>Predikasjonsmarked:</strong> Du vedder på om noe kommer til å skje (JA) eller ikke (NEI).
                </p>
                <p>
                  <strong>Pris = sannsynlighet:</strong> Prisen vises i cent (¢). En pris på 70¢ betyr at markedet tror det er 70% sjanse for at utfallet blir JA.
                </p>
                <p>
                  <strong>Kjøp andeler:</strong> Kjøp JA-andeler hvis du tror noe vil skje, eller NEI-andeler hvis du tror det ikke vil skje.
                </p>
                <p>
                  <strong>Utbetaling:</strong> Hvis du har rett, får du $1 per andel. Hvis du tar feil, mister du innsatsen.
                </p>
                <p>
                  <strong>Eksempel:</strong> Du kjøper 10 JA-andeler til 40¢ = $4 investert. Hvis utfallet blir JA, får du $10 tilbake (gevinst på $6).
                </p>
              </div>
            </section>

            {/* Order types */}
            <section>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="text-blue-600">💱</span> Ordretyper
              </h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                <p>
                  <strong>Markedsordre:</strong> Kjøp eller selg til beste tilgjengelige pris umiddelbart.
                </p>
                <p>
                  <strong>Limitordre:</strong> Sett din egen pris. Ordren fylles når noen matcher prisen din.
                </p>
              </div>
            </section>

            {/* What you can do */}
            <section>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="text-purple-600">🎯</span> Hva kan du gjøre?
              </h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                <p>
                  <strong>Bets:</strong> Se og delta i aktive bets. Kjøp og selg andeler basert på dine spådommer.
                </p>
                <p>
                  <strong>Foreslå:</strong> Kom med forslag til nye bets. En admin må godkjenne før de blir aktive.
                </p>
                <p>
                  <strong>Portefølje:</strong> Se dine aktive posisjoner, ordrer og transaksjonshistorikk.
                </p>
                <p>
                  <strong>Grupper:</strong> Opprett eller bli med i private grupper for å bette med venner.
                </p>
                <p>
                  <strong>Avgjort:</strong> Se historikk over bets som er avgjort og utfallene.
                </p>
              </div>
            </section>

            {/* Groups */}
            <section>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="text-orange-600">👥</span> Grupper
              </h4>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                <p>
                  <strong>Offentlig:</strong> Alle kan se og delta i offentlige bets.
                </p>
                <p>
                  <strong>Private grupper:</strong> Opprett en gruppe for å bette kun med inviterte medlemmer.
                </p>
                <p>
                  <strong>Bli med:</strong> Send forespørsel om å bli med i en gruppe. Admin godkjenner medlemskap.
                </p>
              </div>
            </section>

            {/* Tips */}
            <section className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
              <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                <span>💡</span> Tips
              </h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                <li>Start med små innsatser for å lære systemet</li>
                <li>Følg med på ordreboken for å se markedsaktivitet</li>
                <li>Bruk limitordrer for bedre kontroll over prisen</li>
                <li>Sjekk varsler for oppdateringer om dine bets</li>
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
