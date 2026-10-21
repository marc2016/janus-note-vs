# Projekt: Mobile App-Launch (v2.0)

Dies ist die zentrale Projekt-Notiz für unseren kommenden **App-Launch**. Die technische Systemübersicht befindet sich in [[architektur]], und die aktuellen Abstimmungen aus dem Team findest du in [[sprint-review]].

## Meilensteine

| Phase             | Zeitraum | Verantwortlich | Status    |
| :---------------- | :------- | :------------- | :-------- |
| Closed Beta       | KW 42    | Anna & Marc    | In Arbeit |
| Security Audit    | KW 43    | DevSecOps      | Offen     |
| App Store Release | KW 45    | Produkt-Team   | Geplant   |

## Aktuelle To-Dos & Nächste Schritte

Im gestrigen Sync haben wir folgende Punkte besprochen, die du direkt über den Button **„Aufgaben generieren"** unten in der Fußleiste extrahieren lassen kannst:

- Wir müssen dringend die Release-Notes für den Apple App Store und Google Play auf Deutsch und Englisch verfassen (hohe Priorität).
- Das Crash-Reporting via Sentry muss vor dem Start der Closed Beta mit Source-Maps getestet werden.
- Einen kurzen Demo-Screencast für das Marketing-Team aufnehmen (siehe auch [[kickoff]]).
- 28.10.2026: Das ist eine TEST

## Checkliste im Dokument

- [x] TestFlight-Gruppe für interne Tester anlegen
- [ ] Datenschutz-Erklärung im Registrierungs-Screen verlinken
- [ ] Dunkelmodus-Kontraste auf OLED-Displays prüfen

## App-Launch: Beta-Feedback & Push-Notifications (2026-10-20 15:59)

Beim heutigen Testlauf der mobilen App ist aufgefallen, dass die Push-Notifications unter iOS 18 erst verzögert ankommen.
- Wir müssen das APNs-Zertifikat im Staging-Cluster bis Donnerstag erneuern.
- Außerdem sollte die Onboarding-Tour auf maximal 3 Schritte gekürzt werden (siehe [[app-launch]]).
