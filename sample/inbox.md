# Inbox

Willkommen in deinen Janus Notes!
Hier kannst du schnell neue Notizen, spontane Gedanken und Aufgaben erfassen. Über den Button **„Inbox einsortieren"** in der Fußleiste kann die KI diese Abschnitte automatisch in bestehende Projekte einsortieren oder als neue Notizen anlegen.

## App-Launch: Beta-Feedback & Push-Notifications
Beim heutigen Testlauf der mobilen App ist aufgefallen, dass die Push-Notifications unter iOS 18 erst verzögert ankommen.
- Wir müssen das APNs-Zertifikat im Staging-Cluster bis Donnerstag erneuern.
- Außerdem sollte die Onboarding-Tour auf maximal 3 Schritte gekürzt werden (siehe [[app-launch:24]]).
- 2026-10-25 14:00: Feedback-Runde mit den ersten 20 TestFlight-Usern.

## Website-Relaunch: Lighthouse & SEO-Check
Für den [[kickoff]] des Website-Relaunchs fehlen noch die finalen Redirect-Tabellen für alte Blog-URLs.
- OG-Images für alle Landingpages automatisiert generieren.
- Core Web Vitals (LCP unter 1.8s) auf mobilen Geräten vor dem Go-Live prüfen.
- 2026-10-28: SEO-Audit mit externer Agentur durchführen.

## Design-System: WCAG-Kontraste & Badges
Im dunklen Design-Modus wirken einige Badge-Rahmen noch etwas kontrastarm.
- Kontrastwerte für `--success` und `--primary` auf OLED-Schirmen nachmessen (siehe [[design-system:8]]).
- Figma-Komponenten für Status-Pills exportieren.

## Sprint-Retrospektive: Team-Prozesse & Fokuszeiten
Für das nächste [[sprint-review]] sollten wir folgende Beobachtungen mitnehmen:
- Fokus-Zeiten am Vormittag (9:00–12:00 Uhr keine internen Calls) haben super funktioniert.
- Code-Reviews sollten verbindlich innerhalb von 24 Stunden abgeschlossen werden.
- 2026-10-27 10:30: Weekly Retrospektive im großen Konferenzraum.

## Sync-Architektur: WebSocket Heartbeats & Reconnect
Wenn die Verbindung im Zug kurz abreißt, sollte der Client nicht sofort einen Voll-Sync starten, sondern Delta-Sync versuchen (siehe [[architektur:9]]).
- Heartbeat-Intervall von 30s auf 15s verringern.
- Offline-Warteschlange für Notiz-Änderungen in SQLite verifizieren.

## Neue Projektidee: Quick-Capture CLI für das Terminal
Wäre es nicht genial, wenn man per `janus note "Gedanke..."` direkt aus dem Terminal heraus neue Abschnitte in diese `inbox.md` schreiben könnte?
- Könnte als kleiner Node- oder Bash-Wrapper gebaut werden.
- Direkte Integration mit den bestehenden VS Code Workspace-Pfaden.

## Sicherheit & Dependencies Check
Vor dem nächsten Release sollten wir alle externen Bibliotheken in [package.json:20](package.json:20) prüfen.
- `npm audit` ausführen und eventuelle Minor-Updates einspielen.
- Sicherstellen, dass keine API-Keys versehentlich im Repo landen.

## Wissen: Lokale Ollama-Modelle für Offline-Notizen
Wenn man unterwegs im Zug ohne Internet arbeitet, eignet sich `llama3.2` oder `qwen2.5-coder` über Ollama perfekt für die lokale Aufgaben-Extraktion und Inbox-Sortierung in Janus Note (siehe [[ollama-models]]).
