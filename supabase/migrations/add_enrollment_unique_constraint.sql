-- Prevent duplicate enrollments for the same student in a course
create unique index if not exists uniq_enrollment_course_email
  on public.course_enrollments(course_id, student_email);
