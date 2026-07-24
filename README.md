# Heures Supp — Côte d'Ivoire

Application web pour calculer les heures supplémentaires d'un planning en
rotation (12h ou 8h), selon le Code du travail ivoirien (2015) et le
Décret n°96-204 du 7 mars 1996 relatif au travail de nuit :

- Durée légale : 40h / semaine
- Heures supp : +15% de la 41e à la 46e heure, +50% au-delà
- Heures de nuit (21h-5h) : +75%
- Dimanche / jour férié (jour) : +75%
- Dimanche / jour férié (nuit) : +100%

## Fonctionnalités

- **Planning** : génération automatique d'un cycle (programme 12h ou 8h) à
  partir d'une date de départ, éditable jour par jour pour gérer les
  changements ponctuels de programme.
- **Paramètres** : salaire de base mensuel (taux horaire légal calculé
  automatiquement sur 173,33h/mois), taux horaire réel du bulletin de paie
  pour comparatif, jours fériés éditables, jour de début de période de paie
  configurable (par défaut le 16).
- **Rapports** : détail par semaine et par période de paie (heures supp
  15%/50%, heures de nuit, dimanche/férié), montants en FCFA calculés avec
  le taux légal et le taux du bulletin, export PDF et Excel.
- Toutes les données sont sauvegardées automatiquement dans le navigateur
  (localStorage).

## Développement

```bash
npm install
npm run dev
```

## Hypothèses de calcul

- Une vacation est rattachée à la semaine (lundi-dimanche) de sa date de
  début pour le calcul du seuil de 40h.
- Une semaine est rattachée à la période de paie qui contient son dimanche
  de clôture.
- Les fêtes mobiles (Pâques, Tabaski, Aïd el-Fitr...) ne sont pas
  préremplies : à ajouter manuellement dans les Paramètres.
