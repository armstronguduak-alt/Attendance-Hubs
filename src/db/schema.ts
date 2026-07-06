import { pgTable, text, timestamp, boolean, integer, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  uid: text('uid').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').default('creator').notNull(), // creator, admin
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const attendance = pgTable('attendance', {
  id: text('id').primaryKey(), // nanoid or custom code (e.g., abc123)
  creatorId: text('creator_id').references(() => users.uid, { onDelete: 'set null' }),
  guestManageId: text('guest_manage_id').unique(), // manage token (e.g., manage-xxxx)
  title: text('title').notNull(),
  description: text('description'),
  date: text('date').notNull(), // YYYY-MM-DD
  courseCode: text('course_code'),
  venue: text('venue'),
  openingTime: text('opening_time'), // HH:MM
  closingTime: text('closing_time'), // HH:MM
  publicTable: boolean('public_table').default(false).notNull(),
  allowEditing: boolean('allow_editing').default(false).notNull(),
  allowDuplicates: boolean('allow_duplicates').default(false).notNull(),
  oneSubmissionOnly: boolean('one_submission_only').default(false).notNull(),
  requireConfirmation: boolean('require_confirmation').default(false).notNull(),
  autoClose: boolean('auto_close').default(false).notNull(),
  password: text('password'),
  isPinned: boolean('is_pinned').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const attendanceFields = pgTable('attendance_fields', {
  id: serial('id').primaryKey(),
  attendanceId: text('attendance_id').references(() => attendance.id, { onDelete: 'cascade' }).notNull(),
  label: text('label').notNull(),
  placeholder: text('placeholder'),
  required: boolean('required').default(false).notNull(),
  type: text('type').notNull(), // e.g., text, signature, gps, dropdown, etc.
  options: text('options'), // JSON array of options (stored as stringified JSON)
  fieldOrder: integer('field_order').default(0).notNull(),
  isBuiltIn: boolean('is_built_in').default(false).notNull(),
});

export const attendanceSubmissions = pgTable('attendance_submissions', {
  id: serial('id').primaryKey(),
  attendanceId: text('attendance_id').references(() => attendance.id, { onDelete: 'cascade' }).notNull(),
  studentUid: text('student_uid'), // optional registered student logged-in ID
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  ipAddress: text('ip_address'),
});

export const submissionValues = pgTable('submission_values', {
  id: serial('id').primaryKey(),
  submissionId: integer('submission_id').references(() => attendanceSubmissions.id, { onDelete: 'cascade' }).notNull(),
  fieldId: integer('field_id').references(() => attendanceFields.id, { onDelete: 'cascade' }).notNull(),
  value: text('value').notNull(), // text, JSON, or base64 signature
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  attendances: many(attendance),
}));

export const attendanceRelations = relations(attendance, ({ one, many }) => ({
  creator: one(users, {
    fields: [attendance.creatorId],
    references: [users.uid],
  }),
  fields: many(attendanceFields),
  submissions: many(attendanceSubmissions),
}));

export const attendanceFieldsRelations = relations(attendanceFields, ({ one, many }) => ({
  attendance: one(attendance, {
    fields: [attendanceFields.attendanceId],
    references: [attendance.id],
  }),
  values: many(submissionValues),
}));

export const attendanceSubmissionsRelations = relations(attendanceSubmissions, ({ one, many }) => ({
  attendance: one(attendance, {
    fields: [attendanceSubmissions.attendanceId],
    references: [attendance.id],
  }),
  values: many(submissionValues),
}));

export const submissionValuesRelations = relations(submissionValues, ({ one }) => ({
  submission: one(attendanceSubmissions, {
    fields: [submissionValues.submissionId],
    references: [attendanceSubmissions.id],
  }),
  field: one(attendanceFields, {
    fields: [submissionValues.fieldId],
    references: [attendanceFields.id],
  }),
}));
