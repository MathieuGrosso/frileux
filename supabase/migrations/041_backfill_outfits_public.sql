-- ============================================
-- Frileux — backfill : rendre toutes les tenues existantes publiques
-- ============================================
-- Décision produit : à la bascule vers le feed global, on rend visible
-- tout l'historique pour peupler le feed (sinon il n'y a que les nouveaux
-- posts et il paraît vide). Les utilisateurs qui veulent cacher une tenue
-- passée peuvent la passer en privée depuis son écran de détail (à faire).
update public.outfits
   set is_public = true
 where is_public = false
   and photo_url is not null;
