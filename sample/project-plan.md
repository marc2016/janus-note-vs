# Janus Note – Beispiel-Workspace & Übersicht

Willkommen im **Janus Note** Test-Workspace (`sample/`)! Hier kannst du alle Funktionen direkt ausprobieren:

## 1. Gefüllte Inbox testen
Öffne die [[inbox]] – dort warten bereits mehrere verschiedene Gedanken und Abschnitte:
- Klicke unten in der Fußleiste auf **„Inbox einsortieren"**, um die Abschnitte per KI in bestehende Notizen (wie [[app-launch]] oder [[kickoff]]) anzuhängen oder als neue Notiz anzulegen.
- Standardmäßig erscheint zuerst die **Vorschau** (QuickPick), in der du einzelne Vorschläge an- oder abwählen kannst.

## 2. Aufgaben per KI aus Notizen generieren
Öffne [[app-launch]], [[kickoff]] oder [[sprint-review]] und klicke unten in der Fußleiste auf **„Aufgaben generieren"**:
- Die KI liest die offenen Punkte aus dem Text und trägt neue Aufgaben ohne Duplikate in die `tasks.json` des jeweiligen Ordners ein.

## 3. Verknüpfungen, Backlinks & Diagramme
- **Projekte**: [[app-launch]], [[architektur]] (inkl. Mermaid-Diagramm), [[kickoff]], [[design-system]]
- **Meetings**: [[sprint-review]]
- **Wissensbasis**: [[ki-prompts]], [[ollama-models]]

## 4. Verweise mit Zeilenmarkierung testen
Klicke auf die folgenden Links, um das automatische Springen zur Zeile und die Hervorhebung zu testen:
- **Sprung in Markdown-Notiz**: [[app-launch:9]] (springt zu Zeile 9 der Meilensteine in `app-launch.md` und markiert die Zeile)
- **Sprung in Markdown-Abschnitt**: [Architektur-Sync:9](projects/App-Launch/architektur.md:9) (springt zu Zeile 9 in `architektur.md`)
- **Sprung in Code-/Projektdatei**: [package.json:20](package.json:20) (öffnet `package.json` bei Zeile 20 und markiert sie)
- **Backlinks in der Fußleiste**: Öffne z. B. [[architektur]] und sieh dir die Fußleiste an. Dort zeigt das Backlink-Badge die genaue Zeilennummer, woher der Verweis stammt (z. B. `app-launch :3`). Ein Klick führt direkt dorthin!
