-- Admins can create client/coach accounts directly (POST /admin/users).
ALTER TYPE "AdminAction" ADD VALUE 'CREATE_USER';
