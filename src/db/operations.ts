import { db } from './index.ts';
import { users, attendance, attendanceFields, attendanceSubmissions, submissionValues } from './schema.ts';
import { eq, and, desc, asc } from 'drizzle-orm';

// Helper to generate custom IDs
export function generateRandomId(length: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 1. Sync or create user
export async function getOrCreateUser(uid: string, email: string, displayName?: string, role: string = 'creator') {
  try {
    const result = await db.insert(users)
      .values({
        uid,
        email,
        displayName,
        role,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName,
          role,
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error("getOrCreateUser failed:", error);
    throw new Error("Database operation failed: Unable to sync user.", { cause: error });
  }
}

// 2. Create Attendance form
export async function createAttendance(
  creatorId: string | null,
  data: {
    title: string;
    description?: string;
    date: string;
    courseCode?: string;
    venue?: string;
    openingTime?: string;
    closingTime?: string;
    publicTable?: boolean;
    allowEditing?: boolean;
    allowDuplicates?: boolean;
    oneSubmissionOnly?: boolean;
    requireConfirmation?: boolean;
    autoClose?: boolean;
    password?: string;
    isDraft?: boolean;
  },
  fieldsList: Array<{
    label: string;
    placeholder?: string;
    required?: boolean;
    type: string;
    options?: string;
    fieldOrder: number;
    isBuiltIn?: boolean;
  }>
) {
  try {
    const attendanceId = generateRandomId(8);
    const guestManageId = creatorId ? null : `manage-${generateRandomId(16)}`;

    const newAttendance = await db.insert(attendance)
      .values({
        id: attendanceId,
        creatorId,
        guestManageId,
        title: data.title,
        description: data.description || null,
        date: data.date,
        courseCode: data.courseCode || null,
        venue: data.venue || null,
        openingTime: data.openingTime || null,
        closingTime: data.closingTime || null,
        publicTable: data.publicTable ?? false,
        allowEditing: data.allowEditing ?? false,
        allowDuplicates: data.allowDuplicates ?? false,
        oneSubmissionOnly: data.oneSubmissionOnly ?? false,
        requireConfirmation: data.requireConfirmation ?? false,
        autoClose: data.autoClose ?? false,
        password: data.password || null,
        isPinned: false,
        isArchived: false,
        isDraft: data.isDraft ?? false,
      })
      .returning();

    // Insert fields
    if (fieldsList.length > 0) {
      await db.insert(attendanceFields)
        .values(
          fieldsList.map((f) => ({
            attendanceId,
            label: f.label,
            placeholder: f.placeholder || null,
            required: f.required ?? false,
            type: f.type,
            options: f.options || null,
            fieldOrder: f.fieldOrder,
            isBuiltIn: f.isBuiltIn ?? false,
          }))
        );
    }

    return newAttendance[0];
  } catch (error) {
    console.error("createAttendance failed:", error);
    throw new Error("Database operation failed: Unable to create attendance form.", { cause: error });
  }
}

// 3. Get Attendance form details
export async function getAttendance(id: string) {
  try {
    const records = await db.select().from(attendance).where(eq(attendance.id, id)).limit(1);
    if (records.length === 0) return null;

    const fields = await db.select().from(attendanceFields)
      .where(eq(attendanceFields.attendanceId, id))
      .orderBy(asc(attendanceFields.fieldOrder));

    return {
      ...records[0],
      fields,
    };
  } catch (error) {
    console.error("getAttendance failed:", error);
    throw new Error("Database operation failed: Unable to fetch attendance details.", { cause: error });
  }
}

// 4. Get Attendance by Guest Management ID
export async function getAttendanceByGuestManageId(guestManageId: string) {
  try {
    const records = await db.select().from(attendance).where(eq(attendance.guestManageId, guestManageId)).limit(1);
    if (records.length === 0) return null;

    const fields = await db.select().from(attendanceFields)
      .where(eq(attendanceFields.attendanceId, records[0].id))
      .orderBy(asc(attendanceFields.fieldOrder));

    return {
      ...records[0],
      fields,
    };
  } catch (error) {
    console.error("getAttendanceByGuestManageId failed:", error);
    throw new Error("Database operation failed: Unable to fetch management details.", { cause: error });
  }
}

// 5. Update Attendance details and fields
export async function updateAttendance(
  id: string,
  data: {
    title: string;
    description?: string;
    date: string;
    courseCode?: string;
    venue?: string;
    openingTime?: string;
    closingTime?: string;
    publicTable?: boolean;
    allowEditing?: boolean;
    allowDuplicates?: boolean;
    oneSubmissionOnly?: boolean;
    requireConfirmation?: boolean;
    autoClose?: boolean;
    password?: string;
    isDraft?: boolean;
  },
  fieldsList: Array<{
    id?: number;
    label: string;
    placeholder?: string;
    required?: boolean;
    type: string;
    options?: string;
    fieldOrder: number;
    isBuiltIn?: boolean;
  }>
) {
  try {
    const updatedAttendance = await db.update(attendance)
      .set({
        title: data.title,
        description: data.description || null,
        date: data.date,
        courseCode: data.courseCode || null,
        venue: data.venue || null,
        openingTime: data.openingTime || null,
        closingTime: data.closingTime || null,
        publicTable: data.publicTable ?? false,
        allowEditing: data.allowEditing ?? false,
        allowDuplicates: data.allowDuplicates ?? false,
        oneSubmissionOnly: data.oneSubmissionOnly ?? false,
        requireConfirmation: data.requireConfirmation ?? false,
        autoClose: data.autoClose ?? false,
        password: data.password || null,
        isDraft: data.isDraft ?? false,
      })
      .where(eq(attendance.id, id))
      .returning();

    // Safe field update:
    // Determine existing fields in DB
    const currentFields = await db.select().from(attendanceFields).where(eq(attendanceFields.attendanceId, id));
    const currentFieldIds = currentFields.map(cf => cf.id);

    const inputFieldIds = fieldsList.filter(f => f.id !== undefined).map(f => f.id as number);

    // 1. Delete fields that are in DB but not in input fields (if any)
    const fieldsToDelete = currentFieldIds.filter(cfId => !inputFieldIds.includes(cfId));
    for (const deleteId of fieldsToDelete) {
      await db.delete(attendanceFields).where(eq(attendanceFields.id, deleteId));
    }

    // 2. Update existing fields & insert new fields
    for (const field of fieldsList) {
      if (field.id && currentFieldIds.includes(field.id)) {
        await db.update(attendanceFields)
          .set({
            label: field.label,
            placeholder: field.placeholder || null,
            required: field.required ?? false,
            type: field.type,
            options: field.options || null,
            fieldOrder: field.fieldOrder,
            isBuiltIn: field.isBuiltIn ?? false,
          })
          .where(eq(attendanceFields.id, field.id));
      } else {
        await db.insert(attendanceFields)
          .values({
            attendanceId: id,
            label: field.label,
            placeholder: field.placeholder || null,
            required: field.required ?? false,
            type: field.type,
            options: field.options || null,
            fieldOrder: field.fieldOrder,
            isBuiltIn: field.isBuiltIn ?? false,
          });
      }
    }

    return updatedAttendance[0];
  } catch (error) {
    console.error("updateAttendance failed:", error);
    throw new Error("Database operation failed: Unable to update attendance form.", { cause: error });
  }
}

// 6. Delete Attendance
export async function deleteAttendance(id: string) {
  try {
    const deleted = await db.delete(attendance).where(eq(attendance.id, id)).returning();
    return deleted[0];
  } catch (error) {
    console.error("deleteAttendance failed:", error);
    throw new Error("Database operation failed: Unable to delete attendance.", { cause: error });
  }
}

// 7. Toggle Pinned status
export async function togglePinAttendance(id: string, isPinned: boolean) {
  try {
    const updated = await db.update(attendance).set({ isPinned }).where(eq(attendance.id, id)).returning();
    return updated[0];
  } catch (error) {
    console.error("togglePinAttendance failed:", error);
    throw new Error("Database operation failed: Unable to pin/unpin attendance.", { cause: error });
  }
}

// 8. Toggle Archived status
export async function toggleArchiveAttendance(id: string, isArchived: boolean) {
  try {
    const updated = await db.update(attendance).set({ isArchived }).where(eq(attendance.id, id)).returning();
    return updated[0];
  } catch (error) {
    console.error("toggleArchiveAttendance failed:", error);
    throw new Error("Database operation failed: Unable to archive/unarchive attendance.", { cause: error });
  }
}

// 9. Reset all submissions for an attendance
export async function resetAttendanceSubmissions(attendanceId: string) {
  try {
    // Due to ON DELETE CASCADE on attendanceSubmissions reference, deleting submissions will automatically delete submissionValues!
    await db.delete(attendanceSubmissions).where(eq(attendanceSubmissions.attendanceId, attendanceId));
    return { success: true };
  } catch (error) {
    console.error("resetAttendanceSubmissions failed:", error);
    throw new Error("Database operation failed: Unable to reset submissions.", { cause: error });
  }
}

// 10. Record submission
export async function submitAttendance(
  attendanceId: string,
  studentUid: string | null,
  ipAddress: string | null,
  fieldValues: Array<{ fieldId: number; value: string }>
) {
  try {
    // Create submission record
    const submission = await db.insert(attendanceSubmissions)
      .values({
        attendanceId,
        studentUid,
        ipAddress,
      })
      .returning();

    const submissionId = submission[0].id;

    // Insert all values
    if (fieldValues.length > 0) {
      await db.insert(submissionValues)
        .values(
          fieldValues.map(fv => ({
            submissionId,
            fieldId: fv.fieldId,
            value: fv.value,
          }))
        );
    }

    return submission[0];
  } catch (error) {
    console.error("submitAttendance failed:", error);
    throw new Error("Database operation failed: Unable to record attendance submission.", { cause: error });
  }
}

// 11. Get Submissions with values
export async function getSubmissions(attendanceId: string) {
  try {
    const subs = await db.select().from(attendanceSubmissions)
      .where(eq(attendanceSubmissions.attendanceId, attendanceId))
      .orderBy(desc(attendanceSubmissions.submittedAt));

    const fields = await db.select().from(attendanceFields)
      .where(eq(attendanceFields.attendanceId, attendanceId))
      .orderBy(asc(attendanceFields.fieldOrder));

    const results = [];

    for (const sub of subs) {
      const values = await db.select().from(submissionValues)
        .where(eq(submissionValues.submissionId, sub.id));

      const valueMap: Record<number, string> = {};
      values.forEach(v => {
        valueMap[v.fieldId] = v.value;
      });

      results.push({
        id: sub.id,
        submittedAt: sub.submittedAt,
        ipAddress: sub.ipAddress,
        studentUid: sub.studentUid,
        values: valueMap,
      });
    }

    return {
      fields,
      submissions: results,
    };
  } catch (error) {
    console.error("getSubmissions failed:", error);
    throw new Error("Database operation failed: Unable to fetch submissions.", { cause: error });
  }
}

// 12. Get creator's attendance lists (pinned, archived, standard)
export async function getUserAttendances(creatorId: string) {
  try {
    const lists = await db.select().from(attendance)
      .where(eq(attendance.creatorId, creatorId))
      .orderBy(desc(attendance.createdAt));

    const enriched = [];
    for (const list of lists) {
      const fieldCountResult = await db.select().from(attendanceFields).where(eq(attendanceFields.attendanceId, list.id));
      const submissionCountResult = await db.select().from(attendanceSubmissions).where(eq(attendanceSubmissions.attendanceId, list.id));

      enriched.push({
        ...list,
        fieldCount: fieldCountResult.length,
        submissionCount: submissionCountResult.length,
      });
    }

    return enriched;
  } catch (error) {
    console.error("getUserAttendances failed:", error);
    throw new Error("Database operation failed: Unable to fetch user attendance history.", { cause: error });
  }
}

// 13. Get all users (Admin Panel)
export async function getAllUsers() {
  try {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  } catch (error) {
    console.error("getAllUsers failed:", error);
    throw new Error("Database operation failed: Unable to fetch users.", { cause: error });
  }
}

// 14. Get all attendance lists (Admin Panel)
export async function getAllAttendancesAdmin() {
  try {
    const lists = await db.select().from(attendance).orderBy(desc(attendance.createdAt));
    const enriched = [];
    for (const list of lists) {
      const subCount = await db.select().from(attendanceSubmissions).where(eq(attendanceSubmissions.attendanceId, list.id));
      enriched.push({
        ...list,
        submissionCount: subCount.length,
      });
    }
    return enriched;
  } catch (error) {
    console.error("getAllAttendancesAdmin failed:", error);
    throw new Error("Database operation failed: Unable to fetch admin list.", { cause: error });
  }
}
