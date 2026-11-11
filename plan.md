# Plan de réalisation — AD Shop

## Portée et état actuel

Le propriétaire demande de remplacer entièrement le site de presse par une boutique de sélection mode destinée à l’Afrique, principalement au Sénégal. Le catalogue proposera des articles physiques et numériques; les prix seront stockés et affichés en francs CFA BCEAO (XOF). L’interface et les contenus seront en français; le code, les noms de variables, les modules et les tables resteront en anglais. L’expérience sera simple, rapide et conçue d’abord pour mobile.

Le dépôt est déjà un monorepo fonctionnel `/client` (React, Vite, React Router, Tailwind) et `/server` (Express, API REST, SSR), avec Supabase Auth, PostgreSQL et Storage déjà configurés pour l’ancien site. Le SQL newsroom a déjà été exécuté sur la base réelle. La refonte retire les pages et endpoints éditoriaux de l’application, mais ne supprime ni ne modifie les tables historiques `articles`, `categories`, `tags` et `article_tags`.

Pour éviter de réexécuter un script déjà appliqué, `supabase/schema.sql` restera un artefact historique intact. Le nouveau modèle sera un fichier de migration distinct, par exemple `supabase/migrations/20261106_commerce.sql`, conçu pour ajouter les tables, index, fonctions, politiques RLS et buckets de la boutique. Il ne sera pas exécuté pendant la construction. Aucun achat, paiement ou changement réel dans Supabase ne sera effectué avant la configuration finale et un accord explicite.

En développement, un catalogue de démonstration clairement identifié permettra de parcourir la boutique et de tester le panier. Le mode démonstration ne créera pas de commande payée et n’ouvrira pas de paiement réel. En production, les données de démonstration et les paiements désactivés ne pourront pas se substituer silencieusement à la configuration requise.

## Produit et parcours

Le visiteur pourra parcourir le catalogue et ses catégories, rechercher ou filtrer des produits, voir leurs détails, sélectionner une taille/couleur ou une variante lorsqu’elle existe, puis ajouter ou retirer des articles du panier. Le panier restera local au navigateur et ne contiendra que les identifiants de produits/variantes et les quantités; le serveur recalculera toujours prix, disponibilité, livraison et total depuis la base avant de créer une commande.

Le paiement invité demandera une adresse e-mail et un numéro de téléphone; une adresse de livraison sera requise si le panier contient au moins un article. Un panier composé uniquement de produits numériques ne demandera pas d’adresse. Après confirmation serveur d’un paiement, les téléchargements numériques seront délivrés par liens temporaires signés, sans rendre les fichiers publics. Les commandes physiques auront une adresse et des statuts de préparation, d’expédition et de livraison. Les prix et montants seront des entiers XOF, sans calcul monétaire en nombres flottants.

Le lancement sera préparé d’abord pour le Sénégal, avec des zones de livraison configurables pour les autres marchés africains retenus par le propriétaire. Les prix de catalogue et de paiement resteront en XOF au démarrage, sans conversion automatique. Les tarifs, transporteurs, délais, politique de retour, fiscalité et texte légal restent des décisions du propriétaire; l’aperçu pourra afficher des exemples clairement fictifs, mais ne présentera pas ces exemples comme des conditions commerciales validées.

## Paiements : éléments vérifiés et proposition

Le modèle de commande et l’interface de paiement resteront indépendants du prestataire. Un adaptateur serveur créera une session hébergée par le fournisseur; aucune donnée de carte ne transitera ni ne sera conservée par AD Shop. La commande ne passera à « payée » qu’après vérification serveur d’une notification signée et, lorsque l’API le permet, du statut, du montant, de la devise et de la référence de transaction. Les notifications seront idempotentes; un retour navigateur ne suffira jamais à confirmer un paiement.

- **PayTech** est la première option à examiner : sa documentation décrit une redirection vers un checkout hébergé, XOF, cartes, Wave, Orange Money et d’autres méthodes locales, ainsi que des callbacks/IPN vérifiables. Les tarifs Web & API affichés commencent à 2,50 % pour les cartes et 2,00 % pour le mobile money selon les paliers. Point bloquant pour les essais : la documentation indique que son environnement de test peut débiter un montant aléatoire de 100 à 150 FCFA et le réserve aux essais internes. Aucun paiement de test PayTech ne sera déclenché sans accord explicite et information préalable sur le débit. Sources : [documentation API PayTech](https://doc.paytech.sn/doc_paytech.php), [tarifs PayTech](https://paytech.sn/), [inscription PayTech](https://paytech.sn/login-register).
- **PayDunya** est une alternative locale documentée, en XOF, avec checkout hébergé, sandbox et plusieurs moyens de paiement sénégalais. Ses tarifs publiés indiquent 3,50 % sur carte et des taux mobiles par volume. Ses conditions publiques sont contradictoires sur l’existence d’un frais mensuel de gestion de 20 000 FCFA, et les délais de retrait varient selon les pages; demander un tarif écrit avant de choisir. Sources : [API de redirection PayDunya](https://developers.paydunya.com/doc/EN/http_json), [tarifs](https://paydunya.com/service-fees), [conditions](https://paydunya.com/terms-of-service).
- **CinetPay** publie pour le Sénégal les moyens Visa/Mastercard, Wave, Orange Money et Free Money en XOF, avec des frais affichés de 3,5 %, 2 %, 2 % et 2,5 % respectivement, et documente un environnement sandbox dans son SDK officiel. Ses délais de règlement publiés ne sont pas cohérents et son domaine documentaire n’était pas accessible pendant la recherche; obtenir les règles de règlement et l’activation des opérateurs par écrit. Sources : [tarifs CinetPay](https://cinetpay.com/pricing), [collecte CinetPay](https://cinetpay.com/products/payments), [SDK PHP officiel](https://github.com/cinetpay/cinetpay-php-sdk).
- **Flutterwave** documente la collecte XOF et des moyens de paiement pour des clients au Sénégal, mais l’éligibilité d’une entreprise enregistrée au Sénégal à ouvrir un compte marchand n’a pas pu être confirmée à partir de ses pages pays; ce n’est pas le choix proposé sans confirmation écrite. Sources : [conditions d’intégration](https://flutterwave.com/sn/support/general/what-are-the-requirements-for-using-flutterwave), [tarifs de réception](https://flutterwave.com/sn/support/pricing/pricing-for-receiving-payment).

Le propriétaire a validé PayTech comme premier prestataire (6 novembre 2026). L’adaptateur serveur reste désactivé tant que le compte marchand, l’URL HTTPS, les identifiants, les méthodes `target_payment`, la migration Supabase et les zones de livraison ne sont pas confirmés. Le mode test PayTech peut débiter 100–150 FCFA : aucun test, paiement réel ou onboarding ne sera effectué sans accord explicite distinct. Aucun secret ne sera demandé dans le chat.

## Données, stockage et sécurité

La migration additive créera un modèle distinct du newsroom : catégories de produits; produits publiables avec nom, slug, descriptions, type `physical`/`digital`, prix XOF en entier, état de publication et mise en avant; variantes/SKU, options et stock; images de catalogue; commandes et lignes de commande avec instantané des noms/prix; paiements; journaux de notifications dédupliquées; suivi de livraison; et droits de téléchargement numérique liés aux commandes payées.

Les images de produits utiliseront un bucket public dédié à la vitrine; les fichiers numériques utiliseront un bucket privé. Des fonctions SQL transactionnelles protégeront la création de commande et la réservation/décrémentation du stock afin d’éviter de vendre deux fois la dernière unité. RLS refusera aux visiteurs les accès aux commandes, paiements, données de clients et fichiers numériques. Une table `store_admins` associera les administrateurs explicitement autorisés à leurs comptes Supabase Auth; le serveur vérifiera le JWT puis ce rôle avant toute opération d’administration. Les inscriptions publiques resteront désactivées comme dans le projet actuel.

Les routes de paiement ne retourneront ni secrets ni données de commande sensibles. Les webhooks vérifieront la signature avec une clé serveur. Les commandes et reçus seront accessibles par une référence imprévisible et des vérifications de contact appropriées, protégées par limitation de débit. Les mises à jour du stock, de la commande et du paiement seront idempotentes.

## Architecture et structure du projet

Le serveur Express conserve son port `3000`, ses protections Helmet/rate limiting et le SSR existant. Le rendu initial des pages publiques chargera les données de produit depuis les nouveaux services Express afin que titres, descriptions, prix et images soient présents dans le HTML initial pour le référencement. Le client ne communiquera pas directement avec les tables sensibles.

```text
sportpress/
├── plan.md, TODO.md, README.md, app.config.ts
├── client/
│   ├── public/manus-routes.json
│   └── src/
│       ├── components/ (en-tête, pied de page, cartes produit, panier, composants partagés)
│       ├── pages/ (accueil, catalogue, produit, panier, paiement, commande, pages d’information)
│       ├── admin/ (authentification, catalogue, variantes, commandes, téléversements)
│       ├── context/ (session Supabase et panier)
│       └── lib/ (API, format XOF, SEO)
├── server/src/
│   ├── routes/ (catalogue, admin, téléversement, checkout, webhook, téléchargements)
│   ├── services/ (catalogue, inventaire, commandes, paiements, livraison, téléchargements)
│   ├── payments/ (contrat commun et adaptateur choisi)
│   ├── middleware/ (JWT, rôle admin, validation, limites)
│   └── ssr.js (chargement initial des pages publiques)
└── supabase/
    ├── schema.sql (ancien schéma newsroom, conservé intact)
    ├── migrations/ (nouvelle migration additive de commerce, à appliquer à la fin)
    └── README.md (instructions correspondant aux deux schémas)
```

## Direction visuelle proposée

Pistes considérées : (1) **Tribune urbaine de Dakar**, vêtements de sport dans un univers streetwear soigné, sable/ivoire et vert profond avec un accent corail — choix proposé (probabilité 0,08); (2) boutique de clientes et clients premium, noir et or — 0,04; (3) marketplace sportive très colorée, jaune et rouge — 0,03.

- **Mouvement** : photographie de mode et de streetwear éditoriale, inspirée des campagnes de marque contemporaines de Dakar, sans logos de clubs ou marques tiers.
- **Principes** : la photo produit et son prix sont immédiatement lisibles; parcours d’achat court; mobile-first; le vert-signature distingue la boutique sans reprendre littéralement un maillot ou logo d’équipe.
- **Couleurs** : ivoire chaud pour une lecture confortable, encre sombre pour les libellés/prix et vert profond comme repère de confiance; corail réservé aux actions et disponibilités importantes.
- **Mise en page** : une bannière de collection asymétrique, suivie d’un flux de produits compact; filtres simples et tiroir panier mobile plutôt qu’une page surchargée.
- **Signatures** : pastille XOF toujours explicite; petit repère « édition AD Shop » sur les produits; angles et filets qui évoquent les lignes de terrain sans décor excessif.
- **Interactions et animation** : ajout au panier confirmé immédiatement; mini-panier mobile accessible; commandes claires et transitions discrètes de moins de 200 ms; aucune animation ne retarde le paiement; respect de `prefers-reduced-motion`.
- **Typographie** : titres éditoriaux contemporains pour les campagnes, sans-serif neutre pour description, formulaires et prix; tailles fluides et contraste renforcé.
- **Essence et voix** : AD Shop équipe les femmes et hommes au Sénégal avec des articles physiques et numériques; personnalité énergique, directe et accueillante. Exemples : «  » et « Ajoutez au panier — prix en FCFA, total vérifié à la commande. »
- **Wordmark** : monogramme PS géométrique intégré à une ligne de terrain, accompagné de « AD SHOP »; utiliser un SVG propre plutôt qu’un texte généré dans une image.
- **Couleur de marque signature** : vert profond « Tribune ».

L’outil de génération d’images n’étant pas accessible pendant la mise en œuvre, des illustrations SVG originales (une bannière et cinq visuels de produits fictifs) ont été créées dans `client/public/images/shop/`. Ce sont des illustrations de démonstration, pas les photos des produits réels du propriétaire; elles doivent être remplacées par des photos exactes avant toute vente. Aucun joueur, club ou marque réelle n’est utilisé.

## Workflow de réalisation proposé

1. Après validation de ce plan, remplacer `TODO.md` par des résultats attendus correspondant à la boutique, au panier, au paiement, aux téléchargements, à l’administration, à Supabase et au guide propriétaire. Les critères reprendront les exigences explicites sans marquer comme terminé un résultat encore non réalisé.
2. Définir les emplacements des visuels; l’outil imagegen et les diagnostics Webdev n’étant pas disponibles dans cette session, le propriétaire a autorisé la poursuite manuelle avec `pnpm check` et accepte l’absence temporaire d’aperçu et de checkpoint.
3. Remplacer l’interface éditoriale et les routes par le storefront français; mettre en place les composants partagés, le panier mobile, les prix XOF et le SSR/SEO de catalogue.
4. Remplacer l’API newsroom par les routes Express du catalogue, de l’administration et des commandes. Ajouter la migration SQL et les données de démonstration locales, sans toucher à la base réelle.
5. Ajouter la connexion admin existante, le rôle `store_admins`, la gestion des produits/variantes/stock, des commandes et des fichiers numériques privés.
6. Implémenter le checkout invité, le calcul de prix serveur, les règles de livraison, l’adaptateur de paiement choisi, les vérifications de webhook, le suivi de commande et la remise des fichiers après paiement.
7. Mettre à jour le manifeste des routes, la documentation Windows, les `.env.example`, les informations de configuration Supabase et le guide d’activation différée des paiements; construire et vérifier le site et le manifeste.
8. À la phase finale, demander l’accord avant d’appliquer la migration à la base Supabase existante, ajouter le compte admin dans `store_admins`, configurer les secrets du fournisseur via le formulaire sécurisé, confirmer avec le propriétaire les tarifs/livraison/retours, puis réaliser les essais selon le mode de test du prestataire. Aucun déploiement public ne sera fait sans demande explicite.
