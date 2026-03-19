# 🎱 Snooker Score Manager

Application de gestion de score pour des parties de snooker, **100% vibecoded**.

## Fonctionnalités

- **Suivi du score en temps réel** pour deux joueurs
- **Gestion complète des phases de jeu** : rouges → couleurs → phase finale
- **Empochage de rouges multiples** (doublés, triplés…) avec compteur visuel
- **Gestion des miss** avec sélection de la bille visée et décision de l'adversaire (rejouer ou accepter)
- **Gestion des fautes** sur toutes les billes (rouge, jaune, vert, marron, bleu, rose, noir)
- **Annulation du dernier coup** (undo)
- **Historique des coups** de la manche en cours
- **Thème clair / sombre** avec bascule en un clic
- **Calcul automatique** du score maximum restant
- **Écran de fin de manche** avec résultat et option nouvelle manche

## Stack technique

- [React 19](https://react.dev/) + [Vite 8](https://vite.dev/)
- [TailwindCSS v4](https://tailwindcss.com/) via `@tailwindcss/vite`
- Police [DM Sans](https://fonts.google.com/specimen/DM+Sans) (Google Fonts)

## Builder l'application

```bash
npm install
npm run dev
```
