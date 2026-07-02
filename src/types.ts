export interface User {
  uid: string;
  email: string;
  displayName?: string | null;
  role: string;
  createdAt: string;
}

export interface AttendanceField {
  id?: number;
  label: string;
  placeholder?: string | null;
  required: boolean;
  type: string; // text, signature, gps, dropdown, radio, checkbox, number, date, time, textarea, etc.
  options?: string | null; // stringified JSON options
  fieldOrder: number;
  isBuiltIn: boolean;
}

export interface Attendance {
  id: string;
  creatorId?: string | null;
  guestManageId?: string | null;
  title: string;
  description?: string | null;
  date: string;
  courseCode?: string | null;
  venue?: string | null;
  openingTime?: string | null;
  closingTime?: string | null;
  publicTable: boolean;
  allowEditing: boolean;
  allowDuplicates: boolean;
  oneSubmissionOnly: boolean;
  requireConfirmation: boolean;
  autoClose: boolean;
  password?: string | null;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  fields?: AttendanceField[];
  hasPassword?: boolean;
}

export interface Submission {
  id: number;
  submittedAt: string;
  ipAddress?: string | null;
  studentUid?: string | null;
  values: Record<number, string>; // fieldId -> value
}

export interface SubmissionsResponse {
  fields: AttendanceField[];
  submissions: Submission[];
}
