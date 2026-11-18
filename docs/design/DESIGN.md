# Design System — Beauty Studio (P01)

> Ghidul de stil, identitatea vizuală și token-urile de design pentru sistemul de programări online al studioului de make-up & sprâncene.

---

## 1. Viziune și Ton (Brand Identity)

- **Vibe & Atmosferă:** *Elegant & Warm Minimalist* — rafinat, intim, aerisit și primitor.
- **Inspirație vizuală:** GlossGenius, Aesop, Squarespace Beauty templates.
- **Principii vizuale:**
  - Spațiu alb generos (*generous whitespace*) pentru lizibilitate și senzație de calm.
  - Colțuri rotunjite subtil (organic, non-agresiv).
  - Umbre calde, difuze, fără tonuri sintetice reci.
  - Tipografie editorială chic (combinație între serif sofisticat pentru titluri și sans-serif geometric aerisit pentru interfețe).

---

## 2. Token-uri Cromatice (Color Tokens)

### 2.1. Culori de Brand (Comune)
- **Primary / Nude Rose:** `#C48B71` (accent principal, butoane primare, elemente active)
- **Primary Hover:** `#B07D62`
- **Secondary / Warm Terracotta:** `#9E6B55`
- **Highlight / Muted Gold:** `#D4AF37` (insigne VIP, stele, detalii decorative rafinate)
- **Gold Hover:** `#C29E2E`

### 2.2. Modul Luminos (Light Mode — Implicit)
- `bg-app`: `#FAF7F2` (Linen / Crem cald)
- `surface-card`: `#FFFFFF` (Alb pur pentru carduri principale)
- `surface-subtle`: `#F4EFEA` (Carduri secundare, inputuri inactive, fundal sloturi orare)
- `surface-hover`: `#EFE9E2`
- `text-primary`: `#2B2523` (Espresso profund — contrast ridicat, fără a fi negru dur)
- `text-secondary`: `#615651` (Muted Warm Gray)
- `text-muted`: `#8E827B` (Placeholder, etichete secundare)
- `border-subtle`: `#E8E2D9` (Separatori, margini discrete de carduri)
- `border-strong`: `#D5CBC0` (Contur inputuri active, margini evidențiate)

### 2.3. Modul Întunecat (Dark Mode)
- `bg-app-dark`: `#1A1716` (Deep Espresso Black)
- `surface-card-dark`: `#241F1D` (Carduri principale)
- `surface-subtle-dark`: `#2E2825` (Carduri secundare, fundaluri de selecție)
- `surface-hover-dark`: `#3A332F`
- `text-primary-dark`: `#F5F2EB` (Linen deschis)
- `text-secondary-dark`: `#C7BFB7` (Gris cald)
- `text-muted-dark`: `#8E847C`
- `border-subtle-dark`: `#38302C`
- `border-strong-dark`: `#4D433E`
- `primary-dark`: `#D49D85` (Nuanță adaptată pentru contrast optim pe fundal închis)

### 2.4. Culori Semantice & Stări (Feedback Tokens)
- **Success (Slot confirmat, disponibil):**
  - Light: `#4E7A5D` (Sage Green) | Bg: `#EDF4EF`
  - Dark: `#6FA07F` | Bg: `#1E2D23`
- **Warning / Waitlist (Listă de așteptare, expirare fereastră):**
  - Light: `#C98A2C` (Warm Amber) | Bg: `#FAF2E4`
  - Dark: `#E2A346` | Bg: `#2E2415`
- **Destructive / Error (Anulare sub 24h blocată, alertă):**
  - Light: `#B84A39` (Terracotta Crimson) | Bg: `#F8ECE9`
  - Dark: `#D96B5A` | Bg: `#2E1916`
- **Info (Etape split libere):**
  - Light: `#5F758E` (Dusty Blue) | Bg: `#EFF3F7`
  - Dark: `#8197AF` | Bg: `#1B242D`

---

## 3. Tipografie (Typography Tokens)

- **Headings Font (Titluri & Branding):**
  - Font: `Playfair Display`, serif
  - Fallback: `Didot`, `Georgia`, serif
  - Stil: Elegant, editorial, serifă clasică rafinată
  - Utilizare: Nume studio, titluri pagini (`h1`), titluri categorii servicii (`h2`)
- **Body & UI Font (Texte, butoane, formulare, tabele):**
  - Font: `Plus Jakarta Sans`, sans-serif
  - Fallback: `Inter`, system-ui, sans-serif
  - Stil: Modern, curat, lizibilitate maximă la dimensiuni mici pe telefoane mobile
  - Utilizare: Text de bază, carduri servicii, calendar, butoane, etichete formulare

### Scară Tipografică (Type Scale):
| Token | Mărime (Desktop / Mobile) | Line Height | Greutate | Folosit la |
|---|---|---|---|---|
| `display` | 40px / 32px | 1.2 | Medium (500) | Hero titlu portal rezervări |
| `h1` | 32px / 26px | 1.25 | Medium (500) | Titluri principale secțiuni |
| `h2` | 24px / 20px | 1.3 | SemiBold (600) | Titlu categorie, carduri mari |
| `h3` | 18px / 16px | 1.35 | SemiBold (600) | Nume serviciu, subtitluri |
| `body-lg`| 16px / 15px | 1.5 | Regular (400) | Introduceri, mesaje cheie |
| `body-base`| 14px / 14px | 1.5 | Regular (400) | Text curent, descrieri servicii |
| `caption`| 12px / 12px | 1.4 | Medium (500) | Ore sloturi, etichete, badge-uri |
| `tiny` | 11px / 10px | 1.3 | SemiBold (600) | Durată etape split, notificări |

---

## 4. Spațiere și Structură (Spacing & Layout Tokens)

### 4.1. Scară de Spațiere (Tailwind Compatible 4px Base)
- `space-1`: 4px
- `space-2`: 8px (spațiu interior mic, elemente compacte)
- `space-3`: 12px
- `space-4`: 16px (padding standard carduri mobile, distanță între câmpuri)
- `space-6`: 24px (padding standard carduri desktop, distanță grupuri)
- `space-8`: 32px (distanță între secțiuni)
- `space-12`: 48px
- `space-16`: 64px (margini de pagină, spațiu generos hero)

### 4.2. Containere & Layout
- `container-narrow`: 640px (flux optim de rezervare, formulare centrate, atenție nedivizată)
- `container-standard`: 1024px (panou client, listă servicii)
- `container-wide`: 1280px (calendar recepție multi-angajat, tablou de bord admin)

---

## 5. Raze de Curbură și Umbre (Radius & Elevation Tokens)

### 5.1. Raze de Curbură (Border Radius)
- `radius-sm`: 6px (insigne / badge-uri, tag-uri etape split)
- `radius-md`: 10px (butoane mici, câmpuri input, selectori sloturi)
- `radius-lg`: 16px (carduri servicii, modale dialog)
- `radius-xl`: 24px (containere principale hero, ferestre plutitoare)
- `radius-full`: 9999px (butoane rotunjite, avatare)

### 5.2. Umbre Calde (Warm Shadows)
- `shadow-subtle`: `0 2px 8px -2px rgba(43, 37, 35, 0.05)`
- `shadow-card`: `0 6px 20px -4px rgba(43, 37, 35, 0.08)`
- `shadow-dropdown`: `0 12px 32px -6px rgba(43, 37, 35, 0.12)`
- `shadow-focus`: `0 0 0 3px rgba(196, 139, 113, 0.25)` (inel de focalizare input pe nuanta primară)

---

## 6. Elemente Specifice pentru Funcționalitățile P01

### 6.1. Vizualizarea Etapelor Serviciului Split (Laminare Sprâncene)
- **Etape Ocupate (1, 3, 5):** Fond Nude Rose deschis (`#F7EBE4`), contur `#C48B71`, text `#2B2523`, etichetă „Tehnician Ocupat”.
- **Etape Libere / Intercalabile (2, 4):** Fond Dusty Blue subtil (`#EFF3F7`), contur `#8FA8C4` punctat/dashed, text `#334E68`, etichetă „Slot Disponibil (ex: Pensat / Vopsit)”.

### 6.2. Indicatorul de Zile Aglomerate („Zile Full”)
- Marcaj calendaristic cu un punct auriu sau badge discret: Fond `#FAF2E4`, text `#C98A2C`, iconiță calendar cu avertisment: *„Politică de anulare strictă: min. 24h înainte”*.

### 6.3. Sloturile de Timp în Calendarul de Rezervare
- **Slot Disponibil:** Buton cu suprafață albă, contur subtil `#E8E2D9`, hover cu tranziție caldă către `#FAF7F2` și text accent.
- **Slot Selectat:** Fond plin Nude Rose (`#C48B71`), text alb `#FFFFFF`, shadow card rafinat.
- **Slot Indisponibil / Ocupat:** Text estompat `#8E827B`, fond gri deschis, cursor `not-allowed`.
