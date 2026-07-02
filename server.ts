import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

import { optionalAuth, requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import {
  getOrCreateUser,
  createAttendance,
  getAttendance,
  getAttendanceByGuestManageId,
  updateAttendance,
  deleteAttendance,
  togglePinAttendance,
  toggleArchiveAttendance,
  resetAttendanceSubmissions,
  submitAttendance,
  getSubmissions,
  getUserAttendances,
  getAllUsers,
  getAllAttendancesAdmin,
} from "./src/db/operations.ts";

const PORT = 3000;
const app = express();

  // Allow larger JSON payloads for base64 digital signatures
  app.use(express.json({ limit: "10mb" }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // 1. Sync / Create user in database upon client login
  app.post("/api/users/sync", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || "";
      const displayName = req.user!.name || "";
      
      // Determine role: make armstronguduak@gmail.com the admin
      const role = email.toLowerCase() === "armstronguduak@gmail.com" ? "admin" : "creator";

      const user = await getOrCreateUser(uid, email, displayName, role);
      res.json(user);
    } catch (error: any) {
      console.error("Error syncing user:", error);
      res.status(500).json({ error: error.message || "Failed to sync user." });
    }
  });

  // 2. Create Attendance
  app.post("/api/attendance", optionalAuth, async (req: AuthRequest, res) => {
    try {
      let creatorId = null;
      if (req.user) {
        creatorId = req.user.uid;
        const email = req.user.email || "";
        const displayName = req.user.name || "";
        const role = email.toLowerCase() === "armstronguduak@gmail.com" ? "admin" : "creator";
        await getOrCreateUser(creatorId, email, displayName, role);
      }
      
      const { settings, fields } = req.body;

      if (!settings || !settings.title || !settings.date) {
        return res.status(400).json({ error: "Missing required settings: title and date are required." });
      }

      const newAttendance = await createAttendance(creatorId, settings, fields);
      res.status(201).json(newAttendance);
    } catch (error: any) {
      console.error("Error creating attendance:", error);
      res.status(500).json({ error: error.message || "Failed to create attendance." });
    }
  });

  // 3. Get Attendance by ID (Public view / Student submission context)
  app.get("/api/attendance/:id", async (req, res) => {
    try {
      const attendanceData = await getAttendance(req.params.id);
      if (!attendanceData) {
        return res.status(404).json({ error: "Attendance form not found." });
      }
      // Block public access to draft forms
      if (attendanceData.isDraft) {
        return res.status(404).json({ error: "This attendance form is not yet published." });
      }
      // Strip passwords from public responses unless checked elsewhere
      const { password, ...publicData } = attendanceData;
      res.json({ ...publicData, hasPassword: !!password });
    } catch (error: any) {
      console.error("Error getting attendance:", error);
      res.status(500).json({ error: error.message || "Failed to fetch attendance details." });
    }
  });

  // 4. Get Attendance by Guest Management ID
  app.get("/api/attendance-by-manage/:manageId", async (req, res) => {
    try {
      const attendanceData = await getAttendanceByGuestManageId(req.params.manageId);
      if (!attendanceData) {
        return res.status(404).json({ error: "Attendance management link not found." });
      }
      res.json(attendanceData);
    } catch (error: any) {
      console.error("Error getting attendance by manage link:", error);
      res.status(500).json({ error: error.message || "Failed to fetch attendance management details." });
    }
  });

  // 5. Update Attendance (Requires Ownership or Guest Management Token)
  app.put("/api/attendance/:id", optionalAuth, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const { settings, fields, guestManageId } = req.body;

      // Fetch existing record first
      const existing = await getAttendance(id);
      if (!existing) {
        return res.status(404).json({ error: "Attendance not found." });
      }

      // Check permissions:
      const isOwner = req.user && existing.creatorId === req.user.uid;
      const isGuestManager = guestManageId && existing.guestManageId === guestManageId;

      if (!isOwner && !isGuestManager) {
        return res.status(403).json({ error: "You are not authorized to update this attendance form." });
      }

      const updated = await updateAttendance(id, settings, fields);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating attendance:", error);
      res.status(500).json({ error: error.message || "Failed to update attendance." });
    }
  });

  // 6. Delete Attendance (Requires Ownership or Guest Management Token)
  app.delete("/api/attendance/:id", optionalAuth, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const guestManageId = req.headers["x-guest-manage-id"] as string || req.query.guestManageId as string;

      const existing = await getAttendance(id);
      if (!existing) {
        return res.status(404).json({ error: "Attendance not found." });
      }

      const isOwner = req.user && existing.creatorId === req.user.uid;
      const isGuestManager = guestManageId && existing.guestManageId === guestManageId;

      if (!isOwner && !isGuestManager) {
        return res.status(403).json({ error: "You are not authorized to delete this attendance form." });
      }

      await deleteAttendance(id);
      res.json({ success: true, message: "Attendance form deleted successfully." });
    } catch (error: any) {
      console.error("Error deleting attendance:", error);
      res.status(500).json({ error: error.message || "Failed to delete attendance." });
    }
  });

  // 7. Submit Attendance Form
  app.post("/api/attendance/:id/submit", optionalAuth, async (req: AuthRequest, res) => {
    try {
      const attendanceId = req.params.id;
      const { password, fieldValues } = req.body;
      const ipAddress = req.ip || req.headers["x-forwarded-for"] as string || null;
      const studentUid = req.user?.uid || null;

      const record = await getAttendance(attendanceId);
      if (!record) {
        return res.status(404).json({ error: "Attendance form not found." });
      }

      // Verify password protection
      if (record.password && record.password !== password) {
        return res.status(401).json({ error: "Incorrect password. Submission rejected." });
      }

      // Check limits (one submission only/duplicates)
      if (record.oneSubmissionOnly) {
        const { submissions } = await getSubmissions(attendanceId);
        
        // If logged-in student: check by studentUid
        if (studentUid) {
          const alreadySubmitted = submissions.some(s => s.studentUid === studentUid);
          if (alreadySubmitted) {
            return res.status(400).json({ error: "You have already submitted attendance for this form." });
          }
        }

        // Check by IP address if no login is present
        if (ipAddress) {
          const alreadySubmittedIp = submissions.some(s => s.ipAddress === ipAddress);
          if (alreadySubmittedIp && !record.allowDuplicates) {
            return res.status(400).json({ error: "Attendance already recorded from this device/IP." });
          }
        }
      }

      const submission = await submitAttendance(attendanceId, studentUid, ipAddress, fieldValues);
      res.status(201).json({ success: true, submission });
    } catch (error: any) {
      console.error("Error submitting attendance:", error);
      res.status(500).json({ error: error.message || "Failed to record attendance submission." });
    }
  });

  // 8. Get Submissions (Creator access OR Public view if allowed)
  app.get("/api/attendance/:id/submissions", optionalAuth, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const guestManageId = req.headers["x-guest-manage-id"] as string || req.query.guestManageId as string;

      const record = await getAttendance(id);
      if (!record) {
        return res.status(404).json({ error: "Attendance not found." });
      }

      const isOwner = req.user && record.creatorId === req.user.uid;
      const isGuestManager = guestManageId && record.guestManageId === guestManageId;
      const isPublic = record.publicTable;

      if (!isOwner && !isGuestManager && !isPublic) {
        return res.status(403).json({ error: "Unauthorized: Access to submissions is private." });
      }

      const submissionsData = await getSubmissions(id);
      res.json(submissionsData);
    } catch (error: any) {
      console.error("Error getting submissions:", error);
      res.status(500).json({ error: error.message || "Failed to fetch submissions." });
    }
  });

  // 9. Pin Attendance List
  app.post("/api/attendance/:id/toggle-pin", optionalAuth, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const { isPinned, guestManageId } = req.body;

      const record = await getAttendance(id);
      if (!record) return res.status(404).json({ error: "Attendance not found." });

      const isOwner = req.user && record.creatorId === req.user.uid;
      const isGuestManager = guestManageId && record.guestManageId === guestManageId;

      if (!isOwner && !isGuestManager) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const updated = await togglePinAttendance(id, isPinned);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 10. Archive Attendance List
  app.post("/api/attendance/:id/toggle-archive", optionalAuth, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const { isArchived, guestManageId } = req.body;

      const record = await getAttendance(id);
      if (!record) return res.status(404).json({ error: "Attendance not found." });

      const isOwner = req.user && record.creatorId === req.user.uid;
      const isGuestManager = guestManageId && record.guestManageId === guestManageId;

      if (!isOwner && !isGuestManager) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const updated = await toggleArchiveAttendance(id, isArchived);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 11. Reset Submissions
  app.post("/api/attendance/:id/reset", optionalAuth, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const guestManageId = req.headers["x-guest-manage-id"] as string || req.query.guestManageId as string;

      const record = await getAttendance(id);
      if (!record) return res.status(404).json({ error: "Attendance not found." });

      const isOwner = req.user && record.creatorId === req.user.uid;
      const isGuestManager = guestManageId && record.guestManageId === guestManageId;

      if (!isOwner && !isGuestManager) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await resetAttendanceSubmissions(id);
      res.json({ success: true, message: "Submissions reset successfully." });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 12. List Creator Attendances
  app.get("/api/creator/attendances", requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const list = await getUserAttendances(uid);
      res.json(list);
    } catch (error: any) {
      console.error("Error fetching creator attendances:", error);
      res.status(500).json({ error: error.message || "Failed to fetch attendances." });
    }
  });

  // 13. Admin Panel - Overall platform stats & items (Protected)
  app.get("/api/admin/stats", requireAuth, async (req: AuthRequest, res) => {
    try {
      // Confirm is admin
      const email = req.user!.email || "";
      if (email.toLowerCase() !== "armstronguduak@gmail.com") {
        return res.status(403).json({ error: "Access denied. Admins only." });
      }

      const allUsers = await getAllUsers();
      const allLists = await getAllAttendancesAdmin();

      const totalSubmissionsCount = allLists.reduce((sum, list) => sum + list.submissionCount, 0);

      res.json({
        totalUsers: allUsers.length,
        totalForms: allLists.length,
        totalSubmissions: totalSubmissionsCount,
        recentUsers: allUsers.slice(0, 10),
        recentForms: allLists.slice(0, 10),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 14. Admin Panel - All Users
  app.get("/api/admin/users", requireAuth, async (req: AuthRequest, res) => {
    try {
      const email = req.user!.email || "";
      if (email.toLowerCase() !== "armstronguduak@gmail.com") {
        return res.status(403).json({ error: "Access denied." });
      }
      const usersList = await getAllUsers();
      res.json(usersList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 15. Admin Panel - All Attendances
  app.get("/api/admin/attendances", requireAuth, async (req: AuthRequest, res) => {
    try {
      const email = req.user!.email || "";
      if (email.toLowerCase() !== "armstronguduak@gmail.com") {
        return res.status(403).json({ error: "Access denied." });
      }
      const lists = await getAllAttendancesAdmin();
      res.json(lists);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite development vs production fallback
  async function setupViteAndListen() {
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    // Only listen on port if not running in Vercel Serverless environment
    if (!process.env.VERCEL) {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
      });
    }
  }

  setupViteAndListen();

  export default app;
