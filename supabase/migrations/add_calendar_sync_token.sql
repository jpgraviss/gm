-- Add incremental sync token to calendar_settings
ALTER TABLE calendar_settings ADD COLUMN IF NOT EXISTS google_sync_token text;

-- Add google_event_id to booking_type_bookings for two-way sync
ALTER TABLE booking_type_bookings ADD COLUMN IF NOT EXISTS google_event_id text;
