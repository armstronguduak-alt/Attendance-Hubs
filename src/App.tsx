/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from "react";
import { Header } from "./components/Header.tsx";
import { FieldBuilder } from "./components/FieldBuilder.tsx";
import { StudentForm } from "./components/StudentForm.tsx";
import { AttendanceTable } from "./components/AttendanceTable.tsx";
import { QRCodeModal } from "./components/QRCodeModal.tsx";
import { useAuth, AuthProvider } from "./context/AuthContext.tsx";
import { Attendance, AttendanceField, Submission, User } from "./types.ts";
import { 
  Plus, Calendar, MapPin, Key, Trash2, RotateCcw, Pin, Archive, ExternalLink, 
  Share2, Shield, Info, CheckCircle2, UserCheck, BarChart3, Clock, AlertCircle, Sparkles, Copy, Check, FileSpreadsheet
} from "lucide-react";

function MainApp() {
  const { user, token, loginWithEmail, registerWithEmail } = useAuth();
  
  // Custom router state
  const [path, setPath] = useState(window.location.pathname);
  
  // Dark mode state
  const [darkMode, setDarkMode] = useState(() => {
    // Light mode is the default, dark mode is only used if explicitly selected
    return localStorage.getItem("theme") === "dark";
  });

  // Email/Password Auth Modal states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Share QR code modal state
  const [qrModal, setQrModal] = useState<{ open: boolean; url: string; title: string }>({
    open: false,
    url: "",
    title: "",
  });

  // App Alerts/Toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Form Editor State
  const [formSettings, setFormSettings] = useState({
    title: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    courseCode: "",
    venue: "",
    openingTime: "",
    closingTime: "",
    publicTable: false,
    allowEditing: false,
    allowDuplicates: false,
    oneSubmissionOnly: true,
    requireConfirmation: true,
    autoClose: false,
    password: "",
  });
  const [formFields, setFormFields] = useState<AttendanceField[]>([]);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [editorId, setEditorId] = useState<string | null>(null); // null if new, string if editing

  // Dashboard state
  const [creatorAttendances, setCreatorAttendances] = useState<any[]>([]);
  const [isLoadingAttendances, setIsLoadingAttendances] = useState(false);
  const [activeDashboardForm, setActiveDashboardForm] = useState<any | null>(null);
  const [activeSubmissionsData, setActiveSubmissionsData] = useState<{ fields: AttendanceField[]; submissions: Submission[] } | null>(null);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);

  // Guest Management state
  const [guestManageData, setGuestManageData] = useState<any | null>(null);
  const [guestManageId, setGuestManageId] = useState("");

  // Student form state
  const [activeStudentAttendance, setActiveStudentAttendance] = useState<Attendance | null>(null);
  const [isFetchingForm, setIsFetchingForm] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [submissionCompleted, setSubmissionCompleted] = useState(false);

  // Public/Student Submissions Table State
  const [publicSubmissions, setPublicSubmissions] = useState<{ fields: AttendanceField[]; submissions: Submission[] } | null>(null);
  const [isLoadingPublicTable, setIsLoadingPublicTable] = useState(false);

  // Admin panel state
  const [adminStats, setAdminStats] = useState<any>(null);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminForms, setAdminForms] = useState<any[]>([]);
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  // Helper to show self-dismissing Toast notification
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Sync window pathname on navigation
  const navigate = (newPath: string) => {
    window.history.pushState({}, "", newPath);
    setPath(newPath);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Theme apply
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  // Route router logic handler
  useEffect(() => {
    const parts = path.split("/").filter(Boolean);

    if (parts[0] === "attendance" && parts[1]) {
      const attendanceId = parts[1];
      if (parts[2] === "submissions") {
        // Public submissions table: /attendance/id/submissions
        loadPublicSubmissions(attendanceId);
      } else {
        // Student submission view: /attendance/id
        loadStudentForm(attendanceId);
      }
    } else if (parts[0] === "manage" && parts[1]) {
      // Guest management: /manage/manageId
      const mId = parts[1];
      setGuestManageId(mId);
      loadGuestManagement(mId);
    } else if (path === "/dashboard" && user) {
      // Dashboard loads creator lists
      loadCreatorAttendances();
    } else if (path === "/admin" && user?.role === "admin") {
      // Admin page loads panel stats
      loadAdminPanel();
    } else if (path === "/create") {
      // Clear editor state for new form
      setEditorId(null);
      setFormSettings({
        title: "",
        description: "",
        date: new Date().toISOString().split("T")[0],
        courseCode: "",
        venue: "",
        openingTime: "",
        closingTime: "",
        publicTable: false,
        allowEditing: false,
        allowDuplicates: false,
        oneSubmissionOnly: true,
        requireConfirmation: true,
        autoClose: false,
        password: "",
      });
      setFormFields([
        { label: "Full Name", type: "text", placeholder: "e.g. Jane Doe", required: true, fieldOrder: 0, isBuiltIn: true },
        { label: "Matric Number", type: "text", placeholder: "e.g. MTR-92384", required: true, fieldOrder: 1, isBuiltIn: true },
        { label: "Email Address", type: "email", placeholder: "e.g. jane@uni.edu", required: false, fieldOrder: 2, isBuiltIn: true },
      ]);
    }
  }, [path, user]);

  // ================= BACKEND CALL SERVICE HELPER CODES =================

  // Fetch creator list
  const loadCreatorAttendances = async () => {
    if (!token) return;
    setIsLoadingAttendances(true);
    try {
      const res = await fetch("/api/creator/attendances", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCreatorAttendances(data);
      } else {
        showToast("Failed to fetch attendances list", "error");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAttendances(false);
    }
  };

  // Fetch active form submissions
  const loadActiveFormSubmissions = async (formId: string, guestToken?: string) => {
    setIsLoadingSubmissions(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (guestToken) headers["x-guest-manage-id"] = guestToken;

      const res = await fetch(`/api/attendance/${formId}/submissions`, { headers });
      if (res.ok) {
        const data = await res.json();
        setActiveSubmissionsData(data);
      } else {
        showToast("Unable to load submission records", "error");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  // Fetch student form template
  const loadStudentForm = async (attendanceId: string) => {
    setIsFetchingForm(true);
    setSubmissionCompleted(false);
    try {
      const res = await fetch(`/api/attendance/${attendanceId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveStudentAttendance(data);
        if (data.publicTable) {
          loadPublicSubmissions(attendanceId);
        }
      } else {
        setActiveStudentAttendance(null);
        showToast("Attendance form not found.", "error");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingForm(false);
    }
  };

  // Submit student form
  const handleStudentFormSubmit = async (payload: { password?: string; fieldValues: Array<{ fieldId: number; value: string }> }) => {
    if (!activeStudentAttendance) return;
    setIsSubmittingForm(true);
    try {
      const res = await fetch(`/api/attendance/${activeStudentAttendance.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast("Attendance recorded successfully!");
        setSubmissionCompleted(true);
        if (activeStudentAttendance.publicTable) {
          setTimeout(() => {
            navigate(`/attendance/${activeStudentAttendance.id}/submissions`);
          }, 2000);
        }
      } else {
        const err = await res.json();
        showToast(err.error || "Submission rejected.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error recording submission.", "error");
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // Load public submissions table
  const loadPublicSubmissions = async (attendanceId: string) => {
    setIsLoadingPublicTable(true);
    try {
      const res = await fetch(`/api/attendance/${attendanceId}/submissions`);
      if (res.ok) {
        const data = await res.json();
        setPublicSubmissions(data);
      } else {
        setPublicSubmissions(null);
        showToast("Unable to load public attendance records.", "error");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingPublicTable(false);
    }
  };

  // Load guest management workspace
  const loadGuestManagement = async (mId: string) => {
    try {
      const res = await fetch(`/api/attendance-by-manage/${mId}`);
      if (res.ok) {
        const data = await res.json();
        setGuestManageData(data);
        // Automatically load submissions for this guest workspace
        loadActiveFormSubmissions(data.id, mId);
      } else {
        setGuestManageData(null);
        showToast("Management link is invalid.", "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle email/password sign-in and registration
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setIsSubmittingAuth(true);

    try {
      if (authMode === "signin") {
        await loginWithEmail(authEmail, authPassword);
        showToast("Signed in successfully!");
      } else {
        await registerWithEmail(authEmail, authPassword, authDisplayName);
        showToast("Account created successfully!");
      }
      setIsAuthModalOpen(false);
      setAuthEmail("");
      setAuthPassword("");
      setAuthDisplayName("");
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Save / Publish form
  const handlePublishForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSettings.title.trim()) {
      showToast("Please provide a title for the attendance", "error");
      return;
    }
    if (formFields.length === 0) {
      showToast("Please add at least one form field to submit", "error");
      return;
    }

    setIsSavingForm(true);
    try {
      const method = editorId ? "PUT" : "POST";
      const endpoint = editorId ? `/api/attendance/${editorId}` : "/api/attendance";
      
      const payload: any = {
        settings: formSettings,
        fields: formFields,
      };

      if (editorId && guestManageId) {
        payload.guestManageId = guestManageId;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const savedForm = await res.json();
        showToast(editorId ? "Attendance updated successfully!" : "Attendance published successfully!");
        
        if (editorId) {
          // Editing existing form
          if (guestManageId) {
            navigate(`/manage/${guestManageId}`);
          } else {
            navigate("/dashboard");
          }
        } else {
          // New Form Created
          if (user) {
            navigate("/dashboard");
          } else {
            // Unregistered creator -> Show management warning page
            setGuestManageData(savedForm);
            navigate(`/manage/${savedForm.guestManageId}`);
          }
        }
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to save attendance.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("An error occurred while saving.", "error");
    } finally {
      setIsSavingForm(false);
    }
  };

  // Edit action trigger (prepopulate editor)
  const handleStartEditForm = (form: any) => {
    setEditorId(form.id);
    setFormSettings({
      title: form.title,
      description: form.description || "",
      date: form.date,
      courseCode: form.courseCode || "",
      venue: form.venue || "",
      openingTime: form.openingTime || "",
      closingTime: form.closingTime || "",
      publicTable: form.publicTable,
      allowEditing: form.allowEditing,
      allowDuplicates: form.allowDuplicates,
      oneSubmissionOnly: form.oneSubmissionOnly,
      requireConfirmation: form.requireConfirmation,
      autoClose: form.autoClose,
      password: form.password || "",
    });
    setFormFields(form.fields || []);
    navigate("/create");
  };

  // Toggle Pinned
  const handleTogglePin = async (form: any, guestToken?: string) => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/attendance/${form.id}/toggle-pin`, {
        method: "POST",
        headers,
        body: JSON.stringify({ isPinned: !form.isPinned, guestManageId: guestToken }),
      });

      if (res.ok) {
        showToast(!form.isPinned ? "Form pinned" : "Form unpinned");
        if (guestToken) {
          loadGuestManagement(guestToken);
        } else {
          loadCreatorAttendances();
          if (activeDashboardForm?.id === form.id) {
            setActiveDashboardForm((prev: any) => ({ ...prev, isPinned: !form.isPinned }));
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Archived
  const handleToggleArchive = async (form: any, guestToken?: string) => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/attendance/${form.id}/toggle-archive`, {
        method: "POST",
        headers,
        body: JSON.stringify({ isArchived: !form.isArchived, guestManageId: guestToken }),
      });

      if (res.ok) {
        showToast(!form.isArchived ? "Form archived" : "Form restored");
        if (guestToken) {
          loadGuestManagement(guestToken);
        } else {
          loadCreatorAttendances();
          if (activeDashboardForm?.id === form.id) {
            setActiveDashboardForm((prev: any) => ({ ...prev, isArchived: !form.isArchived }));
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Reset Submissions
  const handleResetSubmissions = async (formId: string, guestToken?: string) => {
    if (!confirm("Are you sure you want to delete ALL student submissions for this form? This action is irreversible.")) return;
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (guestToken) headers["x-guest-manage-id"] = guestToken;

      const res = await fetch(`/api/attendance/${formId}/reset`, { method: "POST", headers });
      if (res.ok) {
        showToast("All submissions have been reset successfully.");
        loadActiveFormSubmissions(formId, guestToken);
        if (!guestToken) loadCreatorAttendances();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Form
  const handleDeleteForm = async (formId: string, guestToken?: string) => {
    if (!confirm("Are you sure you want to permanently delete this attendance form and all its submissions?")) return;
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (guestToken) headers["x-guest-manage-id"] = guestToken;

      const res = await fetch(`/api/attendance/${formId}${guestToken ? `?guestManageId=${guestToken}` : ""}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        showToast("Form deleted successfully.");
        if (guestToken) {
          navigate("/");
        } else {
          setActiveDashboardForm(null);
          loadCreatorAttendances();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Admin Workspace Loader
  const loadAdminPanel = async () => {
    if (!token) return;
    setIsAdminLoading(true);
    try {
      // Load general stats
      const sRes = await fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } });
      if (sRes.ok) {
        const sData = await sRes.json();
        setAdminStats(sData);
      }

      // Load admin list of users
      const uRes = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
      if (uRes.ok) {
        setAdminUsers(await uRes.json());
      }

      // Load admin lists of forms
      const fRes = await fetch("/api/admin/attendances", { headers: { Authorization: `Bearer ${token}` } });
      if (fRes.ok) {
        setAdminForms(await fRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAdminLoading(false);
    }
  };

  // Admin Delete Form Moderation
  const handleAdminDeleteForm = async (formId: string) => {
    if (!confirm("ADMIN ACTION: Permanently delete this attendance list due to terms abuse?")) return;
    try {
      const res = await fetch(`/api/attendance/${formId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast("Attendance deleted successfully by admin.");
        loadAdminPanel();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Clipboard copies
  const handleCopyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    showToast("Link copied to clipboard!");
  };

  // Submissions stats calculators
  const statsSummary = useMemo(() => {
    if (!activeSubmissionsData || activeSubmissionsData.submissions.length === 0) return null;
    const subs = activeSubmissionsData.submissions;
    const total = subs.length;

    // Submission times helper
    const times = subs.map(s => new Date(s.submittedAt).getTime());
    const earliest = new Date(Math.min(...times)).toLocaleString();
    const latest = new Date(Math.max(...times)).toLocaleString();

    // Average time of day calculation
    let totalMinutes = 0;
    subs.forEach(s => {
      const d = new Date(s.submittedAt);
      totalMinutes += d.getHours() * 60 + d.getMinutes();
    });
    const avgMinutes = Math.round(totalMinutes / total);
    const avgHours = Math.floor(avgMinutes / 60);
    const avgMins = avgMinutes % 60;
    const averageTime = `${avgHours.toString().padStart(2, "0")}:${avgMins.toString().padStart(2, "0")}`;

    return {
      total,
      earliest,
      latest,
      averageTime,
    };
  }, [activeSubmissionsData]);

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 font-sans ${darkMode ? "dark bg-slate-950 text-slate-100" : "bg-white text-slate-900"}`}>
      
      {/* Dynamic Toast Feedback Overlay */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold">
          <CheckCircle2 size={16} className={toast.type === "error" ? "text-rose-500" : "text-emerald-500"} />
          <span className="text-slate-800 dark:text-slate-200">{toast.message}</span>
        </div>
      )}

      {/* Main Header Component */}
      <Header
        currentView={path}
        navigate={navigate}
        darkMode={darkMode}
        toggleDarkMode={() => setDarkMode(!darkMode)}
        openAuthModal={() => {
          setAuthMode("signin");
          setIsAuthModalOpen(true);
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        
        {/* ========================================================= */}
        {/* LANDING / HOME PAGE VIEW */}
        {/* ========================================================= */}
        {path === "/" && (
          <div className="space-y-20">
            {/* Hero Section */}
            <div className="text-center max-w-3xl mx-auto space-y-6 pt-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 rounded-full text-xs font-semibold border border-indigo-100 dark:border-indigo-900/30">
                <Sparkles size={12} />
                Now with digital signatures and photo verification
              </div>
              
              <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
                Attendance Sheets, <br />
                <span className="text-indigo-600 dark:text-indigo-400">Streamlined & Secure</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                Create customized, responsive attendance sheets in under 30 seconds. Share with a quick link. Students submit easily—no account creation needed.
              </p>

              <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-4">
                <button
                  onClick={() => navigate("/create")}
                  className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition shadow-lg hover:shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus size={18} />
                  Create Attendance List
                </button>
                {!user && (
                  <button
                    onClick={() => {
                      setAuthMode("signin");
                      setIsAuthModalOpen(true);
                    }}
                    className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-2xl transition shadow-xs cursor-pointer"
                  >
                    Sign In to save sheets
                  </button>
                )}
              </div>
            </div>

            {/* Features list */}
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                  Fully Loaded, Lightweight Platform
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
                  Equipped with features designed to handle university lecture classes, meetings, or training sessions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-6 rounded-3xl shadow-xs hover:shadow-md transition">
                  <div className="h-10 w-10 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-xl flex items-center justify-center mb-4">
                    <Pin size={18} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">No App Required</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Students don't need to sign in or create accounts. They simply visit your shared link, fill fields, and submit!
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-6 rounded-3xl shadow-xs hover:shadow-md transition">
                  <div className="h-10 w-10 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-xl flex items-center justify-center mb-4">
                    <Key size={18} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">Verification Security</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Mitigate proxy submissions with digital signature verification, custom required fields, and live photo snaps.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-6 rounded-3xl shadow-xs hover:shadow-md transition">
                  <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 rounded-xl flex items-center justify-center mb-4">
                    <FileSpreadsheet size={18} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">Rich Analytics & PDF Exporter</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Filter, search, and page through tables. Export lists directly to Excel/CSV or generate high-quality PDF printout files.
                  </p>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className="bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800 rounded-3xl p-8 sm:p-12 space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Simple 3-Step Flow</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center space-y-3">
                  <div className="h-10 w-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm mx-auto shadow-md">
                    1
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Design Your Form</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Choose from built-in fields (Name, Matric) or add custom dropdowns, files, maps, or signatures.
                  </p>
                </div>

                <div className="text-center space-y-3">
                  <div className="h-10 w-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm mx-auto shadow-md">
                    2
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Share Your Link</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Copy the public URL, generate a scannable QR Code, or share directly to WhatsApp or Telegram.
                  </p>
                </div>

                <div className="text-center space-y-3">
                  <div className="h-10 w-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm mx-auto shadow-md">
                    3
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Track Submissions</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Watch the live response counter increase. Check statistics, manage lists, and export files easily.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <footer className="border-t border-slate-200 dark:border-slate-900 pt-8 text-center text-xs text-slate-400 dark:text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-4">
              <span>© {new Date().getFullYear()} AttendanceHub Platform. Built for precision.</span>
              <div className="flex gap-4">
                <span className="hover:underline cursor-pointer">Terms</span>
                <span className="hover:underline cursor-pointer">Privacy</span>
                <span className="hover:underline cursor-pointer">Security</span>
              </div>
            </footer>
          </div>
        )}

        {/* ========================================================= */}
        {/* CREATE / EDIT FORM PAGE VIEW */}
        {/* ========================================================= */}
        {path === "/create" && (
          <form onSubmit={handlePublishForm} className="space-y-8 max-w-3xl mx-auto">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-5">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {editorId ? "Edit Attendance Form" : "Create Attendance Form"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {editorId ? "Modify fields and update setting constraints" : "Design your custom sheet template"}
                </p>
              </div>
              <button
                type="submit"
                disabled={isSavingForm}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-40 cursor-pointer"
              >
                {isSavingForm ? "Publishing..." : editorId ? "Save Modifications" : "Publish Form Template"}
              </button>
            </div>

            {/* Settings block */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
                Attendance Form Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    SHEET TITLE <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS 101 Lecture Attendance"
                    value={formSettings.title}
                    onChange={(e) => setFormSettings({ ...formSettings, title: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    DATE <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formSettings.date}
                    onChange={(e) => setFormSettings({ ...formSettings, date: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    DESCRIPTION (OPTIONAL)
                  </label>
                  <textarea
                    placeholder="Provide additional details or guidelines for students..."
                    rows={2}
                    value={formSettings.description}
                    onChange={(e) => setFormSettings({ ...formSettings, description: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    COURSE CODE
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CS-101"
                    value={formSettings.courseCode}
                    onChange={(e) => setFormSettings({ ...formSettings, courseCode: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    VENUE
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hall B, Block 4"
                    value={formSettings.venue}
                    onChange={(e) => setFormSettings({ ...formSettings, venue: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    OPENING TIME (OPTIONAL)
                  </label>
                  <input
                    type="time"
                    value={formSettings.openingTime}
                    onChange={(e) => setFormSettings({ ...formSettings, openingTime: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    CLOSING TIME (OPTIONAL)
                  </label>
                  <input
                    type="time"
                    value={formSettings.closingTime}
                    onChange={(e) => setFormSettings({ ...formSettings, closingTime: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Visibility Settings block */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-4 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 mb-2">
                Visibility & Form Controls
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formSettings.publicTable}
                    onChange={(e) => setFormSettings({ ...formSettings, publicTable: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5 border-slate-300 dark:border-slate-800 cursor-pointer"
                  />
                  <div>
                    <span className="block text-xs font-semibold dark:text-slate-200">Public Attendance Table</span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500">Students see live submissions list after they submit</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formSettings.oneSubmissionOnly}
                    onChange={(e) => setFormSettings({ ...formSettings, oneSubmissionOnly: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5 border-slate-300 dark:border-slate-800 cursor-pointer"
                  />
                  <div>
                    <span className="block text-xs font-semibold dark:text-slate-200">One Submission Only</span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500">Prevent duplicate device submissions (IP & UID validation)</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formSettings.requireConfirmation}
                    onChange={(e) => setFormSettings({ ...formSettings, requireConfirmation: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5 border-slate-300 dark:border-slate-800 cursor-pointer"
                  />
                  <div>
                    <span className="block text-xs font-semibold dark:text-slate-200">Submit Confirmation Overlay</span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500">Force student verification modal check before submit</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formSettings.allowDuplicates}
                    onChange={(e) => setFormSettings({ ...formSettings, allowDuplicates: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5 border-slate-300 dark:border-slate-800 cursor-pointer"
                  />
                  <div>
                    <span className="block text-xs font-semibold dark:text-slate-200">Allow Duplicates</span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500">Permit multiple entries from same device</span>
                  </div>
                </label>

                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Password Protect Attendance (Optional)
                  </label>
                  <input
                    type="password"
                    placeholder="Enter password given to students"
                    value={formSettings.password}
                    onChange={(e) => setFormSettings({ ...formSettings, password: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs rounded-lg focus:outline-hidden focus:border-indigo-500 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Custom fields builder block */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xs">
              <FieldBuilder
                fields={formFields}
                onChange={setFormFields}
              />
            </div>

            {/* Warnings block for Unregistered Creators */}
            {!user && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex gap-3 text-xs">
                <Info size={18} className="shrink-0 text-amber-500" />
                <div>
                  <span className="font-semibold block mb-0.5">Note: Guest Creator Mode</span>
                  <span>You are not logged in. Anyone with the generated "Private Management Link" will be able to alter settings or view table logs. Register or Login to save sheets directly to your dashboard.</span>
                </div>
              </div>
            )}
          </form>
        )}

        {/* ========================================================= */}
        {/* CREATOR DASHBOARD VIEW */}
        {/* ========================================================= */}
        {path === "/dashboard" && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 dark:border-slate-800 pb-5 gap-4">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  Creator Workspace
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Create, configure, monitor sheets, and extract report assets.
                </p>
              </div>
              <button
                onClick={() => navigate("/create")}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={16} />
                Create New Sheet
              </button>
            </div>

            {/* Overall Analytics */}
            {creatorAttendances.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl flex items-center gap-4 shadow-2xs">
                  <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 rounded-2xl flex items-center justify-center">
                    <FileSpreadsheet size={18} />
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-300 font-mono uppercase">TOTAL SHEETS CREATED</span>
                    <span className="text-xl font-bold dark:text-slate-200">{creatorAttendances.length}</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl flex items-center gap-4 shadow-2xs">
                  <div className="h-10 w-10 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 rounded-2xl flex items-center justify-center">
                    <UserCheck size={18} />
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-300 font-mono uppercase">AGGREGATED SUBMISSIONS</span>
                    <span className="text-xl font-bold dark:text-slate-200">
                      {creatorAttendances.reduce((sum, item) => sum + item.submissionCount, 0)}
                    </span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl flex items-center gap-4 shadow-2xs">
                  <div className="h-10 w-10 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-2xl flex items-center justify-center">
                    <Pin size={18} />
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-300 font-mono uppercase">PINNED LISTS</span>
                    <span className="text-xl font-bold dark:text-slate-200">
                      {creatorAttendances.filter(c => c.isPinned).length}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* List and detail grid layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Creator Forms List Column */}
              <div className="lg:col-span-5 space-y-4">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider">
                  My Attendance Sheets ({creatorAttendances.length})
                </h3>

                {isLoadingAttendances ? (
                  <div className="space-y-3">
                    <div className="h-20 bg-slate-100 dark:bg-slate-900 animate-pulse rounded-2xl" />
                    <div className="h-20 bg-slate-100 dark:bg-slate-900 animate-pulse rounded-2xl" />
                  </div>
                ) : creatorAttendances.length === 0 ? (
                  <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-slate-400">
                    No sheets created yet. Click "Create New Sheet" to begin.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
                    {creatorAttendances.map((item) => {
                      const isActive = activeDashboardForm?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setActiveDashboardForm(item);
                            loadActiveFormSubmissions(item.id);
                          }}
                          className={`p-4 border rounded-2xl shadow-2xs hover:shadow-sm cursor-pointer transition flex justify-between items-start ${
                            isActive
                              ? "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-900"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 hover:bg-slate-50/50 dark:hover:bg-slate-950/10"
                          }`}
                        >
                          <div className="space-y-1.5 flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.isPinned && <Pin size={11} className="text-indigo-500" />}
                              {item.isArchived && <Archive size={11} className="text-amber-500" />}
                              <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate block">
                                {item.title}
                              </span>
                            </div>
                            <span className="block text-[10px] text-slate-500 dark:text-slate-300 font-mono">
                              Date: {item.date} {item.venue ? `| Venue: ${item.venue}` : ""}
                            </span>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="inline-block px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-800 dark:text-slate-300 rounded-xl font-mono">
                              {item.submissionCount} rxs
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Detail Analytics & Submissions Table Column */}
              <div className="lg:col-span-7">
                {activeDashboardForm ? (
                  <div className="space-y-6">
                    {/* Header Detail Box */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xs space-y-4">
                      <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                            {activeDashboardForm.title}
                          </h3>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            Created: {new Date(activeDashboardForm.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        {/* Quick links */}
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleTogglePin(activeDashboardForm)}
                            title={activeDashboardForm.isPinned ? "Unpin form" : "Pin form"}
                            className="p-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg cursor-pointer"
                          >
                            <Pin size={14} className={activeDashboardForm.isPinned ? "fill-current text-indigo-500" : ""} />
                          </button>
                          <button
                            onClick={() => handleToggleArchive(activeDashboardForm)}
                            title={activeDashboardForm.isArchived ? "Restore form" : "Archive form"}
                            className="p-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg cursor-pointer"
                          >
                            <Archive size={14} className={activeDashboardForm.isArchived ? "fill-current text-amber-500" : ""} />
                          </button>
                          <button
                            onClick={() => handleStartEditForm(activeDashboardForm)}
                            title="Edit Form"
                            className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>
                      </div>

                      {/* Stat summary cards block */}
                      {statsSummary && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                          <div>
                            <span className="block text-[9px] font-semibold text-slate-500 dark:text-slate-300 font-mono">TOTAL RESPONSES</span>
                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{statsSummary.total}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] font-semibold text-slate-500 dark:text-slate-300 font-mono">EARLIEST SUBMIT</span>
                            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate block">{statsSummary.earliest.split(",")[1] || statsSummary.earliest}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] font-semibold text-slate-500 dark:text-slate-300 font-mono">LATEST SUBMIT</span>
                            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate block">{statsSummary.latest.split(",")[1] || statsSummary.latest}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] font-semibold text-slate-500 dark:text-slate-300 font-mono">AVG TIME</span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{statsSummary.averageTime}</span>
                          </div>
                        </div>
                      )}

                      {/* Share channels and quick URLs */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                          onClick={() => {
                            const publicLink = `${window.location.origin}/attendance/${activeDashboardForm.id}`;
                            setQrModal({ open: true, url: publicLink, title: activeDashboardForm.title });
                          }}
                          className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition flex justify-center items-center gap-1.5 cursor-pointer"
                        >
                          <Share2 size={13} />
                          Share & QR Code
                        </button>

                        <button
                          onClick={() => {
                            const publicLink = `${window.location.origin}/attendance/${activeDashboardForm.id}`;
                            handleCopyText(publicLink);
                          }}
                          className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition flex justify-center items-center gap-1.5 cursor-pointer"
                        >
                          <Copy size={13} />
                          Copy Public Link
                        </button>

                        <button
                          onClick={() => handleResetSubmissions(activeDashboardForm.id)}
                          className="py-2 px-3 border border-rose-200 hover:bg-rose-50 dark:border-rose-950/20 dark:hover:bg-rose-950/10 text-rose-600 text-xs font-medium rounded-xl transition flex items-center gap-1 justify-center cursor-pointer"
                        >
                          <RotateCcw size={13} />
                          Reset
                        </button>

                        <button
                          onClick={() => handleDeleteForm(activeDashboardForm.id)}
                          className="py-2 px-3 border border-rose-200 hover:bg-rose-50 dark:border-rose-950/20 dark:hover:bg-rose-950/10 text-rose-600 text-xs font-medium rounded-xl transition flex items-center gap-1 justify-center cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Submissions list panel */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider">
                        Recorded Sheet Submissions
                      </h4>

                      {isLoadingSubmissions ? (
                        <div className="h-48 bg-white dark:bg-slate-900 animate-pulse rounded-3xl" />
                      ) : activeSubmissionsData ? (
                        <AttendanceTable
                          fields={activeSubmissionsData.fields}
                          submissions={activeSubmissionsData.submissions}
                          title={activeDashboardForm.title}
                        />
                      ) : (
                        <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-slate-400 text-xs">
                          Failed to load records.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-96 flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center p-6 text-slate-400 bg-white/40 dark:bg-slate-900/10 backdrop-blur-xs">
                    <Info size={24} className="mb-2 text-slate-300" />
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Sheet Selected</h3>
                    <p className="text-xs max-w-xs mt-1">
                      Click on an attendance form list from the left-hand column to view live response counts, metrics, and manage lists.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PRIVATE GUEST MANAGEMENT PAGE VIEW */}
        {/* ========================================================= */}
        {path.startsWith("/manage/") && (
          <div className="space-y-8 max-w-4xl mx-auto">
            {guestManageData ? (
              <div className="space-y-6">
                {/* Info Block on Guest Creation Alert */}
                <div className="p-5 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40 rounded-3xl flex gap-4 text-xs shadow-inner">
                  <CheckCircle2 size={24} className="shrink-0 text-amber-500 animate-pulse" />
                  <div>
                    <span className="font-extrabold block text-sm mb-1">Attendance Created Successfully!</span>
                    <span className="block mb-3">Below is your private management workspace. Because you didn't create an account, anyone with this link can manage your attendance sheet. Please bookmark this URL to manage submissions in the future.</span>
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={window.location.href}
                        className="flex-1 max-w-md px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 text-xs font-mono rounded-xl text-slate-600 dark:text-slate-300 select-all focus:outline-hidden"
                      />
                      <button
                        onClick={() => handleCopyText(window.location.href)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        <Copy size={13} />
                        Copy Private Link
                      </button>
                    </div>
                  </div>
                </div>

                {/* Info and Analytics block */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl shadow-xl space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 dark:border-slate-800 pb-5 gap-4">
                    <div>
                      <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 font-mono uppercase tracking-wide">GUEST SHEET WORKSPACE</span>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{guestManageData.title}</h2>
                      {guestManageData.description && <p className="text-xs text-slate-400 mt-1">{guestManageData.description}</p>}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTogglePin(guestManageData, guestManageId)}
                        className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-lg cursor-pointer"
                        title={guestManageData.isPinned ? "Unpin Form" : "Pin Form"}
                      >
                        <Pin size={14} className={guestManageData.isPinned ? "fill-current text-indigo-500" : ""} />
                      </button>
                      <button
                        onClick={() => handleToggleArchive(guestManageData, guestManageId)}
                        className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-lg cursor-pointer"
                        title={guestManageData.isArchived ? "Restore Form" : "Archive Form"}
                      >
                        <Archive size={14} className={guestManageData.isArchived ? "fill-current text-amber-500" : ""} />
                      </button>
                      <button
                        onClick={() => handleStartEditForm(guestManageData)}
                        className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
                      >
                        Edit Fields
                      </button>
                    </div>
                  </div>

                  {statsSummary && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                      <div>
                        <span className="block text-[9px] font-semibold text-slate-500 dark:text-slate-300 font-mono uppercase">Submissions</span>
                        <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">{statsSummary.total}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-semibold text-slate-500 dark:text-slate-300 font-mono uppercase">Earliest</span>
                        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate block">{statsSummary.earliest.split(",")[1] || statsSummary.earliest}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-semibold text-slate-500 dark:text-slate-300 font-mono uppercase">Latest</span>
                        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate block">{statsSummary.latest.split(",")[1] || statsSummary.latest}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-semibold text-slate-500 dark:text-slate-300 font-mono uppercase">Avg Submit</span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{statsSummary.averageTime}</span>
                      </div>
                    </div>
                  )}

                  {/* Share widgets */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      onClick={() => {
                        const publicLink = `${window.location.origin}/attendance/${guestManageData.id}`;
                        setQrModal({ open: true, url: publicLink, title: guestManageData.title });
                      }}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition flex justify-center items-center gap-1.5 cursor-pointer"
                    >
                      <Share2 size={13} />
                      Share & QR Code
                    </button>

                    <button
                      onClick={() => {
                        const publicLink = `${window.location.origin}/attendance/${guestManageData.id}`;
                        handleCopyText(publicLink);
                      }}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition flex justify-center items-center gap-1.5 cursor-pointer"
                    >
                      <Copy size={13} />
                      Copy Student Form Link
                    </button>

                    <button
                      onClick={() => handleResetSubmissions(guestManageData.id, guestManageId)}
                      className="py-2.5 px-4 border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-medium rounded-xl transition flex items-center gap-1 justify-center cursor-pointer"
                    >
                      <RotateCcw size={13} />
                      Reset List
                    </button>

                    <button
                      onClick={() => handleDeleteForm(guestManageData.id, guestManageId)}
                      className="py-2.5 px-4 border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-medium rounded-xl transition flex items-center gap-1 justify-center cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Submissions section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider">
                    Recorded Student Submissions
                  </h3>

                  {isLoadingSubmissions ? (
                    <div className="h-48 bg-white dark:bg-slate-900 animate-pulse rounded-3xl" />
                  ) : activeSubmissionsData ? (
                    <AttendanceTable
                      fields={activeSubmissionsData.fields}
                      submissions={activeSubmissionsData.submissions}
                      title={guestManageData.title}
                    />
                  ) : (
                    <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-slate-400 text-xs">
                      No submissions logged yet. Give the attendance link to students to begin tracking.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md mx-auto p-8">
                <AlertCircle size={32} className="text-rose-500 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Management Link Invalid</h3>
                <p className="text-xs text-slate-400 mt-2">
                  The guest management key provided in the URL is incorrect or has been deleted. Please check your bookmarks or create a new form.
                </p>
                <button
                  onClick={() => navigate("/")}
                  className="mt-6 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl"
                >
                  Return Home
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* STUDENT FORM FILLING / SUBMISSION VIEW */}
        {/* ========================================================= */}
        {path.startsWith("/attendance/") && !path.endsWith("/submissions") && (
          <div className="py-6">
            {isFetchingForm ? (
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="h-10 bg-slate-100 dark:bg-slate-900 animate-pulse rounded-xl" />
                <div className="h-64 bg-slate-100 dark:bg-slate-900 animate-pulse rounded-3xl" />
              </div>
            ) : activeStudentAttendance ? (
              <div className="space-y-10">
                {submissionCompleted ? (
                  <div className="max-w-md mx-auto text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-xl space-y-6">
                    <div className="h-16 w-16 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-md">
                      <CheckCircle2 size={32} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                        Attendance Recorded Successfully!
                      </h3>
                      <p className="text-xs text-slate-400">
                        Your attendance entry for "{activeStudentAttendance.title}" has been successfully logged with the server.
                      </p>
                    </div>
                    {activeStudentAttendance.publicTable ? (
                      <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse">
                        Redirecting to attendance logs...
                      </p>
                    ) : (
                      <button
                        onClick={() => navigate("/")}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-md"
                      >
                        Return Home
                      </button>
                    )}
                  </div>
                ) : (
                  <StudentForm
                    attendance={activeStudentAttendance}
                    onSubmit={handleStudentFormSubmit}
                    isSubmitting={isSubmittingForm}
                  />
                )}

                {activeStudentAttendance.publicTable && (
                  <div className="mt-12 border-t border-slate-200 dark:border-slate-800 pt-8 max-w-4xl mx-auto space-y-6">
                    <div className="text-left">
                      <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 font-mono uppercase tracking-wide">
                        Live Public Logs
                      </span>
                      <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
                        Current Attendance List
                      </h3>
                      <p className="text-xs text-slate-400">
                        You can view everyone who has submitted their attendance so far.
                      </p>
                    </div>

                    {isLoadingPublicTable ? (
                      <div className="space-y-4">
                        <div className="h-10 bg-slate-100 dark:bg-slate-900 animate-pulse rounded-xl" />
                        <div className="h-32 bg-slate-100 dark:bg-slate-900 animate-pulse rounded-3xl" />
                      </div>
                    ) : publicSubmissions ? (
                      <AttendanceTable
                        fields={publicSubmissions.fields}
                        submissions={publicSubmissions.submissions}
                        title={`${activeStudentAttendance.title} Live Logs`}
                      />
                    ) : (
                      <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                        No submissions recorded yet. Be the first to join!
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md mx-auto p-8">
                <AlertCircle size={32} className="text-rose-500 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Attendance Form Closed</h3>
                <p className="text-xs text-slate-400 mt-2">
                  This attendance form does not exist, has expired, or was closed by the creator. Please verify the URL with your course instructor.
                </p>
                <button
                  onClick={() => navigate("/")}
                  className="mt-6 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl"
                >
                  Return Home
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* PUBLIC SUBMISSIONS TABLE VIEW */}
        {/* ========================================================= */}
        {path.startsWith("/attendance/") && path.endsWith("/submissions") && (
          <div className="space-y-6">
            {isLoadingPublicTable ? (
              <div className="space-y-4">
                <div className="h-10 bg-slate-100 dark:bg-slate-900 animate-pulse rounded-xl" />
                <div className="h-64 bg-slate-100 dark:bg-slate-900 animate-pulse rounded-3xl" />
              </div>
            ) : publicSubmissions ? (
              <div className="space-y-6">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
                  <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 font-mono uppercase tracking-wide">PUBLIC ATTENDANCE LOGS</span>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{partsNameOrId(path)} Logs</h2>
                  <p className="text-xs text-slate-400 mt-1">Live submissions table for this form.</p>
                </div>

                <AttendanceTable
                  fields={publicSubmissions.fields}
                  submissions={publicSubmissions.submissions}
                  title={`${partsNameOrId(path)} Logs`}
                />
              </div>
            ) : (
              <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md mx-auto p-8">
                <AlertCircle size={32} className="text-rose-500 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Attendance Table Private</h3>
                <p className="text-xs text-slate-400 mt-2">
                  The creator of this attendance form has disabled public table viewing. Submissions are kept strictly confidential.
                </p>
                <button
                  onClick={() => navigate("/")}
                  className="mt-6 px-4 py-2 bg-sky-600 text-white text-xs font-semibold rounded-xl"
                >
                  Return Home
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* ADMIN WORKSPACE PANEL VIEW */}
        {/* ========================================================= */}
        {path === "/admin" && user?.role === "admin" && (
          <div className="space-y-8 animate-fade-in">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <Shield size={24} />
                <h2 className="text-xl md:text-2xl font-black">
                  Central Admin Workspace
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Moderation panel for user accounts, platform metrics, and content removal.
              </p>
            </div>

            {/* Platform Stats */}
            {adminStats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xs">
                  <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-300 font-mono uppercase tracking-wide">PLATFORM USER PROFILES</span>
                  <span className="text-3xl font-black text-rose-600 dark:text-rose-400 block mt-2">{adminStats.totalUsers}</span>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xs">
                  <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-300 font-mono uppercase tracking-wide">ACTIVE SHEET TEMPLATES</span>
                  <span className="text-3xl font-black text-rose-600 dark:text-rose-400 block mt-2">{adminStats.totalForms}</span>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xs">
                  <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-300 font-mono uppercase tracking-wide">TOTAL RESPONSES RECORDED</span>
                  <span className="text-3xl font-black text-rose-600 dark:text-rose-400 block mt-2">{adminStats.totalSubmissions}</span>
                </div>
              </div>
            )}

            {/* Moderation section split */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Registered Users */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
                  Registered Users Directory ({adminUsers.length})
                </h3>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[50vh] overflow-y-auto pr-1">
                  {adminUsers.map((u) => (
                    <div key={u.uid} className="py-3 flex justify-between items-center gap-4 text-xs">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{u.displayName || "Unknown User"}</span>
                        <span className="text-slate-500 dark:text-slate-300 font-mono text-[10px]">{u.email}</span>
                      </div>
                      <span className="font-mono text-slate-500 dark:text-slate-300 text-[10px]">
                        Joined: {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attendance forms moderation */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
                  System Sheet Registry ({adminForms.length})
                </h3>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[50vh] overflow-y-auto pr-1">
                  {adminForms.map((f) => (
                    <div key={f.id} className="py-3 flex justify-between items-center gap-4 text-xs">
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">{f.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {f.id} | Date: {f.date} | {f.submissionCount} submissions
                        </span>
                      </div>
                      <button
                        onClick={() => handleAdminDeleteForm(f.id)}
                        className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg transition"
                        title="Delete abusive sheet"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Share QR Modal overlay block */}
      <QRCodeModal
        isOpen={qrModal.open}
        onClose={() => setQrModal({ open: false, url: "", title: "" })}
        url={qrModal.url}
        title={qrModal.title}
      />

      {/* Email/Password Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setIsAuthModalOpen(false);
                setAuthError("");
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm cursor-pointer"
            >
              ✕
            </button>
            
            <h4 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-2">
              {authMode === "signin" ? "Sign In" : "Create Account"}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {authMode === "signin" 
                ? "Enter your credentials to manage your sheets." 
                : "Register with your email and password to start creating."}
            </p>

            {authError && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl border border-rose-100 dark:border-rose-900/30">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === "signup" && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    DISPLAY NAME
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Professor Smith"
                    value={authDisplayName}
                    onChange={(e) => setAuthDisplayName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@university.edu"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  PASSWORD
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-xs hover:shadow-md cursor-pointer flex justify-center items-center gap-1.5"
              >
                {isSubmittingAuth ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : null}
                {authMode === "signin" ? "Sign In" : "Register & Sign Up"}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
              <button
                onClick={() => {
                  setAuthMode(authMode === "signin" ? "signup" : "signin");
                  setAuthError("");
                }}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-semibold"
              >
                {authMode === "signin" 
                  ? "Don't have an account? Create one" 
                  : "Already have an account? Sign In"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Router Path title extractor helper
function partsNameOrId(pathString: string): string {
  const parts = pathString.split("/").filter(Boolean);
  return parts[1] ? `Sheet ${parts[1].toUpperCase()}` : "Attendance";
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
