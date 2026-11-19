# Plan aprobat — Autentificarea demo a clientei și Fidelizarea în rezervare

**Proiect:** Beauty Studio · P01
**Dimensiune:** M · Două mock-up-uri conectate printr-o sesiune demo
**Stadiu:** Documentare retrospectivă a implementărilor din `fae02c7` și `8a0af79`, consemnate în sesiunile 16 și 17. Statutul din registrul de design este `approved` pentru `DS-pub-booking` și `draft` pentru `DS-pub-auth`. [Jurnal](../../AI_LOG.md) · [Registru](../design/registry.yaml)

## Abordare și secvență

### 1. Acces la cont și previzualizarea reducerii în rezervare

În `fae02c7`, cardul Beauty Studio primește linkul „Contul meu / Autentificare”, cu iconiță de utilizator și text vizibil. Footerul oferă linkul „Acces echipă / Admin” către `DS-adm-login.html`. În `8a0af79`, linkul de cont indică direct `DS-pub-auth.html#auth-entry`.

Comutatorul demonstrativ „Clientă autentificată” folosește `aria-pressed` pentru a activa și dezactiva simularea unei vizite eligibile. La activare, eticheta devine „Contul meu”, apare badge-ul de Fidelizare și prețul demonstrativ este calculat ca `preț × 0,90`. Sumarul, butonul de confirmare și ecranul de succes afișează același total. La dezactivare revine prețul integral.

### 2. Autentificare, creare cont și revenire în rezervare

În `8a0af79`, pagina contului deschide implicit formularul „Autentificare” și oferă fila „Creează cont nou”. După trimiterea validă a oricărui formular, pagina salvează numai indicatorul `beauty-studio-demo-client=1` în `sessionStorage`, golește formularul și afișează panoul „Contul meu și fidelizare”. Panoul arată progresul demonstrativ de 4/5 vizite, programările viitoare și istoricul.

Cu sesiunea activă, „Programare nouă cu −10%” deschide `DS-pub-booking.html` în aceeași filă. Rezervarea citește indicatorul, ascunde comutatorul manual și aplică automat reducerea demonstrativă. „Deconectare” șterge indicatorul, redeschide formularul „Autentificare” și mută focalizarea pe fila acestuia. La revenirea în rezervare după deconectare se afișează prețul integral și comutatorul manual devine disponibil. Reîncărcarea în aceeași filă păstrează sesiunea cât timp indicatorul există.

## Fișiere de referință

| Fișier | Rol în implementare |
| --- | --- |
| [DS-pub-booking.html](../design/mocks/DS-pub-booking.html) | Linkurile de cont și echipă, comutatorul, citirea sesiunii și afișarea totalului. |
| [DS-pub-auth.html](../design/mocks/DS-pub-auth.html) | Formularele, indicatorul de sesiune, panoul 4/5, linkul de rezervare și deconectarea. |
| [DS-adm-login.html](../design/mocks/DS-adm-login.html) | Destinația linkului din footer. |

## Design și verificare

Se folosesc token-urile Warm Minimalist din D-003, inclusiv paleta Nude Rose și Muted Gold, tipografia Playfair Display și Plus Jakarta Sans și suprafețele pentru ambele teme. Formularele folosesc validarea nativă a câmpurilor obligatorii. Filele sunt navigabile cu tastatura, iar pagina afișează o eroare dacă stocarea sesiunii este blocată la trimitere. [Sistem de design](../design/DESIGN.md) · [D-003](DECISIONS.md#d-003--visual-identity-and-design-tokens)

| Criteriu de acceptare | Verificare manuală în browser |
| --- | --- |
| Navigare publică | Deschide rezervarea fără sesiune și verifică iconița, eticheta contului și destinația linkului din footer. |
| Reducere demonstrativă | Activează și dezactivează comutatorul. Pentru un serviciu de 180 RON, verifică totalul de 162 RON la activare și 180 RON la dezactivare, inclusiv în sumar, buton și confirmare. |
| Autentificare și creare cont | Trimite fiecare formular cu date de test într-o sesiune separată. Verifică afișarea progresului 4/5, focalizarea titlului și păstrarea sesiunii după reîncărcare. |
| Revenire și deconectare | Din panou, urmează „Programare nouă cu −10%” și verifică totalul redus și comutatorul ascuns. Deconectează-te din cont și verifică revenirea la formular și la prețul integral în rezervare. |
| Accesibilitate și afișare | Verifică focalizarea, navigarea cu tastatura, câmpurile obligatorii și lizibilitatea pe mobil și desktop, în ambele teme. |

Sesiunile 16 și 17 consemnează verificări în Chrome pentru navigare, Fidelizare, reîncărcare și deconectare. Tabelul descrie criteriile de verificare ale implementării. [Jurnal](../../AI_LOG.md)

## Reguli aprobate și limitele demonstrației

- **D-005** stabilește ciclul recurent de cinci vizite finalizate, numărate la nivelul întregului studio. În aplicație, Serverul calculează reducerea de 10% la confirmarea programării eligibile și o persistă pe `Appointment`. Mock-up-urile reprezintă cazul demonstrativ 4/5 cu un indicator de sesiune care nu conține date din formulare. [D-005](DECISIONS.md#d-005--client-loyalty-program-with-automatic-recurring-discount) · [Vocabular](../../CONTEXT.md)
- Cele două pagini citesc aceeași cheie de sesiune. Pentru traseul complet, paginile trebuie deschise în aceeași filă și pe aceeași origine, cu stocarea disponibilă. Dacă citirea eșuează, rezervarea păstrează disponibil comutatorul manual.
