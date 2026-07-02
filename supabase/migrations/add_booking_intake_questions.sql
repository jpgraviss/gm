ALTER TABLE booking_types ADD COLUMN IF NOT EXISTS intake_questions jsonb DEFAULT '[]';
ALTER TABLE booking_type_bookings ADD COLUMN IF NOT EXISTS intake_answers jsonb DEFAULT '{}';
