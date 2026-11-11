

## Session unique par commande et erreurs ambiguës

Avant tout appel réseau, le serveur réserve atomiquement la création de checkout avec `claim_paytech_checkout`, qui verrouille la ligne `orders`; une seconde requête retrouve l’URL déjà créée ou reçoit un conflit « session en cours ». L’URL et le jeton PayTech ne sont enregistrés comme session créée qu’avec le même claim. L’IPN est appliqué seulement si `provider_session_status = created` et si son jeton correspond exactement au jeton stocké. Un nouveau `sale_complete` après que la commande est payée est rejeté; un doublon déjà appliqué reste idempotent, tandis qu’un callback précédemment rejeté n’est pas annoncé comme accepté.

Seul un refus PayTech explicite (`success = 0`) annule la commande et libère le stock. Un timeout, une réponse illisible, un jeton manquant ou un échec d’enregistrement après création peuvent laisser l’état du prestataire incertain : la réservation reste bloquée volontairement. Ne pas relancer ce paiement; vérifier la référence dans le tableau de bord marchand PayTech et réconcilier la commande avant toute nouvelle tentative.
