

### Si la réponse PayTech est incertaine

Si le checkout expire, renvoie une réponse illisible ou affiche une référence à vérifier, ne soumettez pas une seconde demande de paiement. La commande garde sa réservation de session afin d’empêcher la création concurrente d’un deuxième lien payable. Vérifiez la référence dans l’espace marchand PayTech et réconciliez l’état de la commande avant de relancer ou d’annuler; seul un refus explicite `success = 0` entraîne automatiquement l’annulation et la libération du stock.
