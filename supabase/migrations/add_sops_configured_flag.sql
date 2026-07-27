-- AUDIT — app_settings.sops is `not null default '[]'`, so an untouched
-- row and a deliberately-emptied-and-saved row are byte-for-byte
-- indistinguishable (both read back as `[]`). A fix that tried to tell
-- them apart by checking `Array.isArray(data.sops)` alone therefore
-- treated EVERY untouched workspace as "deliberately emptied," permanently
-- suppressing the 8 default SOP sections on any brand-new install. A real
-- boolean flag, set only when a save actually happens, is the only way to
-- distinguish the two states.

alter table app_settings add column if not exists sops_configured boolean not null default false;
