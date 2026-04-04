create index if not exists idx_sticker_assets_last_seen
  on public.sticker_assets (last_seen_at asc);

create index if not exists idx_sticker_asset_refs_asset_id
  on public.sticker_asset_refs (asset_id);
