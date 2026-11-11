# Supabase — AD Shop

## État de la base

La base Supabase existante a déjà reçu le schéma newsroom `schema.sql`. Ce fichier est conservé comme historique et ne doit pas être relancé pour préparer la boutique. Les tables `articles`, `categories`, `tags` et `article_tags` doivent rester intactes; le nouveau commerce utilise des tables distinctes comme `product_categories`, `products`, `orders` et `order_items`.

La migration `migrations/20261106_commerce.sql` est préparée, mais **elle n’a pas été exécutée**. Ne l’appliquez qu’à la phase finale, après sauvegarde et accord du propriétaire. Elle est additive : elle crée les tables, les fonctions transactionnelles, les vues de catalogue, les restrictions RLS et les buckets produits/numériques sans supprimer le schéma historique.

## Application manuelle — à reporter jusqu’au raccordement final

1. Dans Supabase, ouvrez **Database → Backups** ou créez une sauvegarde équivalente avant toute modification.
2. Confirmez que vous utilisez le bon projet Supabase et que l’ancien site newsroom peut être conservé.
3. Ouvrez **SQL Editor → New query**.
4. Ouvrez `migrations/20261106_commerce.sql`, copiez son contenu complet, collez-le dans l’éditeur et vérifiez que le fichier commence par `begin;` et se termine par `commit;`.
5. Exécutez-le une seule fois. N’exécutez ni ne rejouez `schema.sql` sur la base existante.
6. Dans **Table Editor**, confirmez la présence de `product_categories`, `products`, `product_variants`, `product_images`, `digital_assets`, `shipping_zones`, `orders`, `order_items`, `payment_events`, `order_status_events`, `digital_entitlements` et `store_admins`.
7. Dans **Storage**, vérifiez `product-images` (public pour les images de catalogue) et `digital-files` (privé pour les fichiers vendus).

Ne lancez pas cette migration maintenant si vous souhaitez encore différer la configuration de la base. Si le SQL échoue, arrêtez-vous et examinez l’erreur avant toute relance; ne supprimez pas manuellement les tables newsroom.

## Autoriser le compte marchand

Les inscriptions publiques Supabase Auth doivent rester désactivées. Après exécution de la migration, créez ou vérifiez l’utilisateur marchand prévu dans **Authentication → Users**, puis exécutez une fois cette requête en remplaçant l’adresse fictive par celle du compte voulu :

```sql
insert into public.store_admins (user_id)
select id
from auth.users
where lower(email) = lower('ADMIN_EMAIL_HERE')
on conflict (user_id) do nothing;
```

Si aucune ligne n’est créée, vérifiez l’adresse utilisée et l’existence du compte Auth. Le middleware Express vérifie à la fois le JWT Supabase et l’inscription dans `store_admins`; un utilisateur simplement authentifié n’est pas un administrateur de boutique.

## Accès et stockage

- Les tables métier ne sont pas directement lisibles/éditables par `anon` ou `authenticated`; le serveur Express y accède avec sa clé privilégiée après validation du JWT et du rôle marchand.
- Les vues publiques de catalogue n’exposent que les produits publiés, leurs images et leurs variantes actives. Elles n’exposent ni commandes, ni données client, ni paiements, ni stock détaillé, ni fichiers numériques.
- Les images produits sont dans un bucket public distinct; les fichiers numériques sont dans un bucket privé. La clé de stockage est le chemin privé, et les téléchargements client passent par des URL signées temporaires après vérification d’une commande payée.
- La migration crée `shipping_zones` sans frais ni transporteurs fictifs. Les zones et tarifs doivent être renseignés avec les coûts réels avant d’accepter des commandes physiques.
- La fonction SQL de création de commande vérifie les prix depuis la base, réserve le stock dans une transaction, conserve des instantanés des lignes de commande et exige une adresse lorsque le panier contient un article.

## Clés et configuration du serveur

Le client reçoit seulement `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`. Le serveur reçoit `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_SECRET_KEY`. La clé secret contourne RLS : ne la publiez pas, ne la mettez jamais dans `client/.env`, une variable `VITE_`, Git ou le chat. Utilisez les secrets côté serveur de l’hébergeur ou un fichier `server/.env` local ignoré par Git.

L’interrupteur serveur `PAYMENTS_ENABLED` reste `false`. Les identifiants PayTech ne sont pas nécessaires pour parcourir le mode démo et ne doivent être ajoutés qu’après activation du compte marchand via un canal sécurisé. Le mode test PayTech peut débiter 100–150 FCFA selon sa documentation; aucun test ne doit être déclenché sans accord explicite du propriétaire.

## Sources officielles Supabase

- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Contrôle d’accès Storage](https://supabase.com/docs/guides/storage/security/access-control)
- [Configuration Supabase Auth](https://supabase.com/docs/guides/auth/general-configuration)
- [Clés API Supabase](https://supabase.com/docs/guides/getting-started/api-keys)


## Activation explicite après migration

La présence de clés Supabase provenant de l’ancien site ne suffit pas pour connecter la boutique. Par défaut, `COMMERCE_DB_ENABLED=false` (serveur) et `VITE_COMMERCE_DB_ENABLED=false` (client) maintiennent le catalogue de démonstration et bloquent l’admin, les lectures de commandes, l’IPN et les écritures. **Après avoir appliqué et vérifié la migration sur le bon projet**, activez ces deux variables dans les environnements correspondants et redémarrez/reconstruisez le site. En production, Express refusera de démarrer tant que `COMMERCE_DB_ENABLED` n’est pas vrai. Ne changez pas ces interrupteurs avant d’être certain que la base contient le schéma e-commerce.
