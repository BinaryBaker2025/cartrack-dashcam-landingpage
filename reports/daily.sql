-- Contact-free daily counts in South African time. Includes all recorded outcomes.
SELECT * FROM lead_daily_summary
ORDER BY submitted_date_sa DESC, delivery_status, leadbyte_code;
