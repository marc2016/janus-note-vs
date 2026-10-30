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
- **Alias-Link**: [[Systemdesign]] führt ebenfalls zur Architektur-Notiz – sie trägt im Frontmatter `aliases: [Systemdesign, Backend-Architektur]`. Tippe `[[Backend` und die Autovervollständigung schlägt sie über den Alias vor.
- **Meetings**: [[sprint-review]]
- **Wissensbasis**: [[ki-prompts]], [[ollama-models]]

## 4. Verweise mit Zeilenmarkierung testen
Klicke auf die folgenden Links, um das automatische Springen zur Zeile und die Hervorhebung zu testen:
- **Sprung in Markdown-Notiz**: [[app-launch:9]] (springt zu Zeile 9 der Meilensteine in `app-launch.md` und markiert die Zeile)
- **Sprung in Markdown-Abschnitt**: [Architektur-Sync:9](projects/App-Launch/architektur.md:9) (springt zu Zeile 9 in `architektur.md`)
- **Sprung in Code-/Projektdatei**: [package.json:20](package.json:20) (öffnet `package.json` bei Zeile 20 und markiert sie)
- **Backlinks in der Fußleiste**: Öffne z. B. [[architektur]] und sieh dir die Fußleiste an. Dort zeigt das Backlink-Badge die genaue Zeilennummer, woher der Verweis stammt (z. B. `app-launch :3`). Ein Klick führt direkt dorthin!

## 5. Tagesnotizen
- Klicke in der Titelleiste der Notizen-Ansicht auf **„Tagesnotiz öffnen"**, um die Notiz für heute in `journal/` zu öffnen oder anzulegen. Neue Tagesnotizen nutzen die Vorlage `.templates/tagesnotiz.md`.
- Öffne [[journal/2026-10-29]]: Sie hat drei Abschnitte, die noch nicht einsortiert sind. Klicke in der Fußleiste auf **„Tagesnotiz einsortieren"**. Die Abschnitte werden in passende Notizen *kopiert*, und unter jedem erscheint ein Link `-> [[…]]`, wohin er ging.
- [[journal/2026-10-28]] zeigt das Ergebnis: Der Abschnitt „Modell-Test im Zug" wurde schon nach [[ollama-models]] einsortiert und wird beim nächsten Durchlauf übersprungen.
- Im Kalender erscheinen beide Tagesnotizen an ihrem Tag. In den Tagesdetails gibt es den Button **„Tagesnotiz öffnen"** bzw. **„Tagesnotiz anlegen"**.

## 6. Vorlagen
- Unter **„Neue Notiz"** kannst du nach dem Namen eine Vorlage wählen: `meeting`, `projekt` oder `tagesnotiz` aus `.templates/`. Platzhalter wie `{{title}}`, `{{date}}`, `{{date:DD.MM.YYYY}}`, `{{weekday}}` und `{{time}}` werden beim Anlegen ausgefüllt.
- Über **„Vorlagen bearbeiten"** im Menü der Notizen-Ansicht öffnest du eine Vorlage oder legst eine neue an.

## 7. Umbenennen mit Link-Aktualisierung
- Benenne z. B. [[design-system]] in der Notizen-Ansicht um: Alle Links darauf (etwa in [[kickoff]] und [[sprint-review]]) werden automatisch angepasst.

## 8. Bilder einfügen
- Kopiere einen Screenshot und füge ihn mit `Cmd+V` in eine Notiz ein, oder ziehe Bilder aus dem Finder hinein. Sie landen im Ordner `assets/` neben der Notiz, und der Link wird automatisch eingefügt.
- Das Bild erscheint direkt unter seiner Zeile. Setzt du den Cursor auf die Zeile, siehst du den Markdown-Link zum Bearbeiten:

![Sync-Skizze](assets/sync-skizze.svg)

- Auch beim **Einsortieren der Inbox** bleiben Bilder und relative Links intakt: Der Abschnitt „Sync-Architektur“ in der [[inbox]] enthält diese Skizze. Landet er z. B. in `projects/App-Launch/architektur.md`, wird der Pfad automatisch zu `../../assets/sync-skizze.svg`.

## 9. Mermaid-Diagramme
- ```` ```mermaid ````-Blöcke erscheinen im Editor direkt als Diagramm. Mit dem Schalter **„Code"** oben rechts siehst du den Quelltext und darunter eine Live-Vorschau, **„Diagramm"** klappt den Code wieder ein.
- Ein neues Diagramm legst du mit `/chart` an. Ein Sequenzdiagramm findest du in [[architektur]].

```mermaid
graph LR
    Gedanke --> Inbox[inbox.md]
    Gedanke --> Tag[Tagesnotiz]
    Inbox -->|Inbox einsortieren| Notizen[Projekt- und Wissensnotizen]
    Tag -->|Tagesnotiz einsortieren| Notizen
    Notizen --> Aufgaben[Aufgaben generieren]
```

---

## 10. KI direkt im Editor
- **Diagramm ändern:** Klicke bei einem Diagramm oben rechts auf **„KI"** und beschreibe im Chat, was sich ändern soll (z. B. „Füge nach Notizen einen Schritt Kalender hinzu"). Mit **„Übernehmen"** landet der Vorschlag im Diagramm, `Cmd+Z` macht es rückgängig.
- **Neues Diagramm:** Tippe `/ki-diagramm` in eine leere Zeile. Die KI kennt den Abschnitt, in dem du gerade bist – schreib im Chat z. B. „Mach daraus ein Ablaufdiagramm".
- **Text markieren:** Markiere den folgenden Absatz. Im kleinen Popup kannst du ihn **zusammenfassen** (mit „Darunter einfügen" als Callout) oder direkt ein **Diagramm erstellen** lassen. Ein Beispiel für ein so erzeugtes Diagramm findest du in [[ollama-models]].

Zum Ausprobieren: Neue Gedanken landen zuerst in der Inbox oder in der Tagesnotiz. Einmal am Tag sortiert die KI sie in Projekt- und Wissensnotizen ein; in der Tagesnotiz bleibt dabei ein Link stehen, wohin jeder Abschnitt kopiert wurde. Aus den einsortierten Notizen lassen sich anschließend Aufgaben generieren, die im Kalender und in der Aufgabenübersicht erscheinen. Wiederkehrende Strukturen wie Meetings oder Projekte startest du mit einer Vorlage, und Diagramme halten die wichtigsten Abläufe fest.

## 11. Speichern
- Ganz links in der Werkzeugleiste sitzt die **Diskette**. Sie wird blau, sobald die Notiz ungespeicherte Änderungen hat, und ist grau, wenn alles gespeichert ist.
- Ein Klick darauf oder `Cmd+S` speichert – auch direkt nach dem letzten Tastendruck geht nichts verloren. Probier es hier aus: Tippe ein Wort an das Ende dieser Zeile und speichere sofort.

## 12. Ordner verlinken
- Links können auch auf Ordner zeigen: [[projects/App-Launch/]] öffnet die **Ordnerübersicht** und markiert den Ordner in der Notizen-Ansicht. Ein `/` am Ende steht immer für einen Ordner.
- Tippe `[[Web` – die Autovervollständigung schlägt neben Notizen auch den Ordner `projects/Website-Relaunch/` mit 📁 vor.
- In der Ordnerübersicht von `App-Launch` zeigt **„Verlinkt von“** diese Notiz und [[sprint-review]]; im Notiz-Graph erscheint der Ordner als Rechteck.
- Benennst du den Ordner um, werden die Links darauf automatisch angepasst.

## 13. Defekte Links reparieren
- In [[sprint-retrospective]] stehen unter „Offene Punkte“ absichtlich Links auf Notizen, die es nicht gibt: [[kickof]] (Tippfehler), [[Roadmap]] und [[ideen|Ideensammlung]].
- Führe **„Janus: Defekte Links reparieren“** aus (Befehlspalette oder `…`-Menü der Notizen-Ansicht): Die Liste zeigt jedes fehlende Ziel mit seinen Verweisen. Leite `kickof` auf [[kickoff]] um, lege `Roadmap` an oder entferne `ideen` – danach erscheint die Liste mit den restlichen Zielen.
- Einzelne Links reparierst du auch direkt per Klick im Editor: Neben **Erstellen** gibt es dort **Umleiten…** und **Link entfernen**.

## 14. Notiz-Netzwerk
- **„Janus: Notiz-Netzwerk öffnen“** zeigt alle Notizen und ihre Links als Netzwerk. Mit **„Fehlende Notizen anzeigen“** erscheinen auch die defekten Links aus Abschnitt 13 als gestrichelte Kreise.
- Für den Überblick rund um eine Notiz: Öffne z. B. [[architektur]] und führe **„Janus: Lokales Notiz-Netzwerk öffnen“** aus (auch im `…`-Menü des Editors). Das Netzwerk zeigt nur diese Notiz und ihre direkten Nachbarn; mit **Tiefe** 2 oder 3 kommen weitere Schritte dazu.
- Wechselst du im Editor zu einer anderen Notiz oder klickst einen Nachbarn an, wandert die Mitte mit. Oben schaltest du zwischen **„Ganzes Netzwerk“** und **„Aktuelle Notiz“** um.


## 15. Tags
- Notizen lassen sich mit `#tags` ordnerübergreifend gruppieren: [[app-launch]] trägt `#projekt/app-launch` und `#mobile`, [[kickoff]] und [[design-system]] tragen `#design`, die Wissensnotizen `#ki`. [[architektur]] hat seine Tags im Frontmatter (`tags: [backend, projekt/app-launch]`).
- Verschachtelte Tags wie `#projekt/app-launch` zählen auch für `#projekt` – so findest du alle Projekte auf einmal.
- Tippe in einer Notiz `#`: Die Vorschlagsliste zeigt alle vorhandenen Tags mit der Anzahl ihrer Notizen. Mit `# ` (Überschrift) verschwindet sie wieder.
- In der Notizen-Ansicht listet der Eintrag **Tags** jeden Tag mit seinen Notizen. Im Notiz-Netzwerk filterst du oben nach einem Tag, und im Chat sucht `#design typografie` nur in Notizen mit diesem Tag.
