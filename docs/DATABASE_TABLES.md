# Database Tables Reference (Admin Panel)

This describes every table you'll see in the Admin Panel's **Database Explorer**
(`/admin` → Database Tables), in plain language. Table names below match the
dropdown exactly (the Prisma model name — the explorer also shows the literal
Postgres table name in parentheses, e.g. `users`).

Three of these tables (**User**, **Coach**, **Payment**) are hidden from the
**Coach Portal**'s database view — coaches can't browse or edit account/role
data or revenue data. A few sensitive columns (session tokens, OTP hashes,
push tokens) are also blanked out (`••••••••`) on the tables coaches *can* see.
None of that redaction applies here in the Admin Panel — you see everything raw,
including password hashes, so treat this tool as sensitive.

---

## 1. Accounts & Identity

### User (`users`)
The core account record — one row per person who has ever signed up, whether
they're a regular member, a coach, or an admin. `role` (`USER` / `COACH` /
`ADMIN`) decides what they can do. `passwordHash` is the encrypted password
(never a real password — you can't read someone's password from this).
`isActive` is the suspend/ban flag; a suspended user can't log in.
`isEmailVerified` tracks whether they finished the signup OTP step.
Every other table below points back to a `User` via `userId`.

### RefreshToken (`refresh_tokens`)
A live login session. Each time someone logs in (or their session auto-renews),
a row is created here. `token` is the actual session secret (redacted for
coaches — leaking it lets someone impersonate that user). `revoked` means the
session was force-logged-out (e.g. after a password reset or admin suspend).
Rows pile up over time as people log in repeatedly; it's normal for this table
to be large.

### OtpCode (`otp_codes`)
One-time codes sent by email for signup verification or "forgot password"
(`purpose`). `codeHash` is the hashed 6-digit code, not the code itself.
`used` / `attempts` / `expiresAt` control whether a code can still be redeemed.

### UserProfile (`user_profiles`)
The extra fitness-onboarding info a member fills in that isn't part of their
core account: height, weight, age, gender, and fitness `goal`. One row per
user, only for members who've completed profile setup — `profileImageUrl`
here is a denormalized copy of their latest uploaded profile photo.

---

## 2. Coaching

### Coach (`coaches`)
A coach's public professional profile — bio, `specialties` (tags like
"Strength Training"), years of experience, and whether they're currently
`isAcceptingClients`. This is a *second* row layered on top of a `User` row
(linked by `userId`) that only exists for accounts with `role = COACH`.

### CoachAvailability (`coach_availability`)
The weekly recurring time slots a coach has opened up for bookings — e.g.
"Monday 9:00–17:00". `isActive` lets a coach hide a slot without deleting it.
This is what members see (and pick from) when booking an appointment.

### Appointment (`appointments`)
A booked 1:1 session between a member and a coach. `status` moves through
`PENDING → CONFIRMED → COMPLETED` (or `CANCELLED`). `scheduledAt` +
`durationMinutes` is the actual time slot; `reminderSentAt` tracks whether a
reminder notification already went out so it isn't sent twice.

---

## 3. Fitness Tracking (member-logged data)

### BmiLog (`bmi_logs`)
One row every time a member runs the BMI calculator. Stores the height/weight
they entered *at that moment*, the computed `bmi` number, and the resulting
`category` (Underweight/Normal/Overweight/Obese) — this is what powers the BMI
trend chart in the app.

### CalorieLog (`calorie_logs`)
Same idea for the Calorie Calculator: the inputs (age, gender, height, weight,
activity level, goal) and the computed outputs — `bmr` (baseline calories
burned at rest), `tdee` (total daily burn including activity), and
`targetCalories` (the recommended daily target for their goal).

### WeightLog (`weight_logs`)
A lightweight running log of just body weight over time, used for the
Progress Tracker's weight trend chart. Note: every BMI calculation also writes
a row here automatically, so a member doesn't have to log weight twice.

### BodyMeasurement (`body_measurements`)
Optional tape-measure stats a member can log — chest, waist, hip, arm, thigh
(all in cm, all optional per entry). Used for tracking body composition
changes beyond just weight.

### StepLog (`step_logs`)
Daily step-count summary per user (one row per user per calendar `date`),
pulled from the phone's Health Connect / step data — steps, distance,
calories burned, and active minutes for that day.

### ActivityLog (`activity_logs`)
A general "things this user did" feed — logging a workout, hitting a step
milestone, booking an appointment, etc. (`type` + a human-readable
`description`). This is what backs the "Recent Activity" feed on the
dashboard.

### Media (`media`)
Every image ever uploaded, of any kind (`type`: profile photo, progress
photo, coach photo, chat image, or content-post cover image) — one shared
table for all uploads. `angle` (Front/Back/Left/Right) and `sessionId` are
only set for progress photos, and group a set of "transformation photos"
taken together into one dated session. `storageKey` is the internal
S3/local-disk path; `url` is what the app actually displays.

---

## 4. Workouts

### Exercise (`exercises`)
A single reusable exercise definition in the library — "Push-ups", "Squats",
etc. — with its muscle group and equipment needed. These get assembled into
workout plans (see below); an exercise can appear in many plans.

### WorkoutPlan (`workout_plans`)
An admin-curated workout program (e.g. "4-Week Strength Builder") that any
member can browse and start — category, difficulty, duration, cover image,
and an optional demo video. `isActive` hides a plan from the app without
deleting its history.

### WorkoutPlanExercise (`workout_plan_exercises`)
The join table connecting `WorkoutPlan` ↔ `Exercise` — this is what actually
lists "which exercises, in what order, with how many sets/reps" for a given
plan. If a plan shows 4 exercises, there are 4 rows here.

### WorkoutCompletion (`workout_completions`)
A record that a member finished a `WorkoutPlan`, and when. Purely historical —
used for streaks/stats, not something anyone edits directly.

### ScheduledWorkout (`scheduled_workouts`)
A member's plan to do a specific workout at a specific *future* time (from
tapping "Schedule Workout" in the app) — distinct from `WorkoutCompletion`,
which is the record *after* it's done. Powers the calendar view alongside
appointments. `status` tracks whether it was done, skipped, or is still
pending.

### CustomWorkout (`custom_workouts`)
A workout a member built themselves from scratch (as opposed to picking one
of the admin-curated `WorkoutPlan`s). Always private to the user who created
it — never shown to anyone else.

### CustomWorkoutExercise (`custom_workout_exercises`)
The individual exercises inside one `CustomWorkout` — same idea as
`WorkoutPlanExercise` but for user-authored workouts (name/sets/reps typed in
freely, not linked to the shared `Exercise` library).

---

## 5. Payments

### Payment (`payments`)
A payment/transaction record — amount, currency, `status`
(Pending/Success/Failed/Refunded), `method` (card/UPI/etc.), and `purpose`
(what it was for — a coach session, a subscription, etc.). `transactionId` is
the payment gateway's reference. **Hidden from coaches** — this is revenue
data.

---

## 6. Messaging & Notifications

### ChatRoom (`chat_rooms`)
One conversation thread between one member and one coach (created the first
time they message each other). `lastMessageAt` sorts the inbox.
`userClearedAt` / `coachClearedAt` implement "clear chat" as a per-person
hide (like WhatsApp) — the messages still exist for the other side, just
timestamped as hidden for whoever cleared it.

### ChatMessage (`chat_messages`)
An individual message inside a `ChatRoom` — text or image, with delivery
status (`SENT` → `DELIVERED` → `SEEN`) for read-receipt behavior.

### Notification (`notifications`)
An in-app notification shown to a user (workout reminder, appointment
reminder, a coach message alert, an announcement, etc.), with `isRead`
tracking whether they've seen it in the notification bell.

### DeviceToken (`device_tokens`)
A phone's push-notification address (Firebase token) so the server can send
it a push. One row per device a user has logged in on; `platform` is iOS or
Android. The `token` value itself is redacted for coaches since leaking it
would let someone push-spam that device.

### NotificationPreference (`notification_preferences`)
Per-user on/off switches for each notification category (workout reminders,
appointment reminders, coach messages, announcements) — what the
Notifications settings screen in the app reads and writes.

---

## 7. Content (blog / tips)

### ContentCategory (`content_categories`)
A grouping/tag for posts — e.g. "Nutrition", "Strength Training". Just a
name + URL slug.

### ContentPost (`content_posts`)
A blog post, video, workout tip, or nutrition tip published in the app's
Content section. `status` is Draft/Published/Archived (drafts aren't visible
to members). `authorId` is whichever admin/coach wrote it. `viewCount`
increments as members read it.

---

## 8. System / Admin-only

### AdminAuditLog (`admin_audit_logs`)
A tamper trail of admin actions — every time an admin suspends a user,
changes a role, resets a password, or creates/edits/deletes a coach, a row
gets written here automatically (`action` + `targetType`/`targetId` + who did
it + when). This is the audit log shown on the "Audit Logs" page — treat it as
read-only history, editing it defeats its purpose.

---

## Quick lookup: "I'm looking at row X, which table is it?"

| If you see a column like… | It's probably… |
|---|---|
| `passwordHash`, `role`, `isActive`, `isEmailVerified` | **User** |
| `token`, `revoked`, `expiresAt` (no `codeHash`) | **RefreshToken** (a login session) |
| `codeHash`, `purpose: REGISTRATION/PASSWORD_RESET` | **OtpCode** |
| `heightCm`, `weightKg`, `goal`, `gender` (no `bmi`) | **UserProfile** |
| `bio`, `specialties`, `isAcceptingClients` | **Coach** |
| `bmi`, `category` | **BmiLog** |
| `bmr`, `tdee`, `targetCalories` | **CalorieLog** |
| `scheduledAt`, `coachId`, `status: PENDING/CONFIRMED…` | **Appointment** |
| `angle`, `sessionId`, `storageKey` | **Media** (a progress photo) |
| `sets`, `reps`, `sortOrder` + `planId` | **WorkoutPlanExercise** |
| `sets`, `reps`, `sortOrder` + `customWorkoutId` | **CustomWorkoutExercise** |
| `amount`, `currency`, `transactionId` | **Payment** |
| `body`, `imageUrl`, `status: SENT/DELIVERED/SEEN` | **ChatMessage** |
| `action`, `targetType`, `targetId`, `metadata` | **AdminAuditLog** |
