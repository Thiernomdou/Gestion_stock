-- =====================================================================
-- 0003_product_photos.sql — Photos des produits (Supabase Storage)
-- =====================================================================
-- Fichiers rangés par organisation : <organization_id>/<product_id>/<uuid>.webp
-- Lecture publique (URL non devinable, mise en cache par le téléphone) ;
-- écriture réservée au patron et au gérant de l'organisation du dossier.
-- products.photo_url contient le chemin dans le bucket, pas l'URL complète.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-photos', 'product-photos', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Organisation propriétaire d'un fichier : premier dossier du chemin (null si ce n'est pas un UUID).
create or replace function public.storage_object_org(p_name text) returns uuid
language sql immutable set search_path = public as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_name, '/', 1)::uuid end
$$;

create policy product_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos' and coalesce(public.is_manager(public.storage_object_org(name)), false));

create policy product_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'product-photos' and coalesce(public.is_manager(public.storage_object_org(name)), false))
  with check (bucket_id = 'product-photos' and coalesce(public.is_manager(public.storage_object_org(name)), false));

create policy product_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-photos' and coalesce(public.is_manager(public.storage_object_org(name)), false));

-- La suppression passe par l'API Storage, qui lit l'objet avant de l'effacer.
create policy product_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'product-photos' and coalesce(public.is_manager(public.storage_object_org(name)), false));
