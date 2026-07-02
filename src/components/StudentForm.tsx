import React, { useState } from "react";
import { MapPin, Camera, Check, AlertTriangle, Lock, Trash2 } from "lucide-react";
import { Attendance, AttendanceField } from "../types.ts";
import { SignaturePad } from "./SignaturePad.tsx";

interface StudentFormProps {
  attendance: Attendance;
  onSubmit: (data: { password?: string; fieldValues: Array<{ fieldId: number; value: string }> }) => Promise<void>;
  isSubmitting: boolean;
}

export const StudentForm: React.FC<StudentFormProps> = ({ attendance, onSubmit, isSubmitting }) => {
  const [password, setPassword] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<number, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [gpsLoading, setGpsLoading] = useState<Record<number, boolean>>({});
  const [gpsCoords, setGpsCoords] = useState<Record<number, { lat: number; lng: number }>>({});
  const [photoPreviews, setPhotoPreviews] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState("");

  const handleTextChange = (fieldId: number, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleGpsCapture = (fieldId: number) => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setGpsLoading((prev) => ({ ...prev, [fieldId]: true }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setGpsCoords((prev) => ({ ...prev, [fieldId]: { lat, lng } }));
        setFieldValues((prev) => ({ ...prev, [fieldId]: `${lat},${lng}` }));
        setGpsLoading((prev) => ({ ...prev, [fieldId]: false }));
      },
      (error) => {
        console.error("GPS capture failed", error);
        alert(`Failed to capture GPS Location: ${error.message}. Please ensure location permissions are enabled.`);
        setGpsLoading((prev) => ({ ...prev, [fieldId]: false }));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePhotoCapture = (fieldId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPhotoPreviews((prev) => ({ ...prev, [fieldId]: base64 }));
      setFieldValues((prev) => ({ ...prev, [fieldId]: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (fieldId: number) => {
    const updatedPreviews = { ...photoPreviews };
    delete updatedPreviews[fieldId];
    setPhotoPreviews(updatedPreviews);

    const updatedValues = { ...fieldValues };
    delete updatedValues[fieldId];
    setFieldValues(updatedValues);
  };

  const handleSubmitAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // Validate password if form is password-protected
    if (attendance.hasPassword && !password) {
      setFormError("This form is password protected. Please enter the attendance password.");
      return;
    }

    // Validate required fields
    for (const field of attendance.fields || []) {
      const val = fieldValues[field.id!];
      if (field.required && (!val || val.trim() === "")) {
        setFormError(`"${field.label}" is required. Please fill it out.`);
        return;
      }
    }

    if (attendance.requireConfirmation) {
      setShowConfirm(true);
    } else {
      performSubmit();
    }
  };

  const performSubmit = () => {
    setShowConfirm(false);
    
    const formattedValues = Object.entries(fieldValues).map(([fid, val]) => ({
      fieldId: Number(fid),
      value: val,
    }));

    onSubmit({
      password: attendance.hasPassword ? password : undefined,
      fieldValues: formattedValues,
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl max-w-2xl mx-auto">
      {/* Title & Header */}
      <div className="border-b border-slate-100 dark:border-slate-800 pb-5 mb-6 text-center md:text-left">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
          {attendance.title}
        </h2>
        {attendance.description && (
          <p className="mt-2 text-xs md:text-sm text-slate-600 dark:text-slate-300">
            {attendance.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-4 justify-center md:justify-start text-[11px] text-slate-600 dark:text-slate-300">
          {attendance.courseCode && (
            <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg font-mono">
              Course: {attendance.courseCode}
            </span>
          )}
          {attendance.venue && (
            <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
              Venue: {attendance.venue}
            </span>
          )}
          <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
            Date: {attendance.date}
          </span>
        </div>
      </div>

      {formError && (
        <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs rounded-2xl flex items-center gap-2 border border-rose-100 dark:border-rose-900/30">
          <AlertTriangle size={16} />
          {formError}
        </div>
      )}

      {/* Main Submission Form */}
      <form onSubmit={handleSubmitAttempt} className="space-y-6">
        {/* Password field if required */}
        {attendance.hasPassword && (
          <div className="bg-amber-50/50 dark:bg-amber-950/10 p-4 border border-amber-100 dark:border-amber-900/30 rounded-2xl">
            <label className="block text-xs font-semibold text-amber-800 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
              <Lock size={12} />
              ATTENDANCE PASSWORD REQUIRED
            </label>
            <input
              type="password"
              required
              placeholder="Enter password given by creator"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-slate-950 border border-amber-200 dark:border-amber-900/40 text-xs rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-slate-200"
            />
          </div>
        )}

        {/* Dynamic Fields */}
        {(attendance.fields || []).map((field) => {
          const fid = field.id!;
          return (
            <div key={fid} className="space-y-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {field.label}
                {field.required && <span className="text-rose-500 ml-0.5">*</span>}
              </label>

              {/* Text / Email / Phone / Number */}
              {(field.type === "text" || field.type === "email" || field.type === "tel" || field.type === "number") && (
                <input
                  type={field.type === "tel" ? "tel" : field.type === "number" ? "number" : field.type}
                  required={field.required}
                  placeholder={field.placeholder || ""}
                  value={fieldValues[fid] || ""}
                  onChange={(e) => handleTextChange(fid, e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200 focus:bg-white"
                />
              )}

              {/* Date */}
              {field.type === "date" && (
                <input
                  type="date"
                  required={field.required}
                  value={fieldValues[fid] || ""}
                  onChange={(e) => handleTextChange(fid, e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200"
                />
              )}

              {/* Time */}
              {field.type === "time" && (
                <input
                  type="time"
                  required={field.required}
                  value={fieldValues[fid] || ""}
                  onChange={(e) => handleTextChange(fid, e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200"
                />
              )}

              {/* Textarea */}
              {field.type === "textarea" && (
                <textarea
                  required={field.required}
                  placeholder={field.placeholder || ""}
                  value={fieldValues[fid] || ""}
                  onChange={(e) => handleTextChange(fid, e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200 focus:bg-white"
                />
              )}

              {/* Dropdown Select */}
              {field.type === "dropdown" && (
                <select
                  required={field.required}
                  value={fieldValues[fid] || ""}
                  onChange={(e) => handleTextChange(fid, e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200 cursor-pointer"
                >
                  <option value="">{field.placeholder || "Select option"}</option>
                  {(field.options || "").split(",").map((opt, oIdx) => {
                    const trimmed = opt.trim();
                    return (
                      <option key={oIdx} value={trimmed}>
                        {trimmed}
                      </option>
                    );
                  })}
                </select>
              )}

              {/* Radio Selection */}
              {field.type === "radio" && (
                <div className="flex flex-col gap-2 mt-1">
                  {(field.options || "").split(",").map((opt, oIdx) => {
                    const trimmed = opt.trim();
                    const isChecked = fieldValues[fid] === trimmed;
                    return (
                      <label key={oIdx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name={`radio-${fid}`}
                          required={field.required && !fieldValues[fid]}
                          checked={isChecked}
                          onChange={() => handleTextChange(fid, trimmed)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-800 cursor-pointer"
                        />
                        {trimmed}
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Checkbox Agree */}
              {field.type === "checkbox" && (
                <label className="flex items-center gap-2 cursor-pointer py-1.5">
                  <input
                    type="checkbox"
                    required={field.required}
                    checked={fieldValues[fid] === "true"}
                    onChange={(e) => handleTextChange(fid, e.target.checked ? "true" : "")}
                    className="rounded h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-800 cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    {field.placeholder || "I agree and confirm"}
                  </span>
                </label>
              )}

              {/* Signature Field */}
              {field.type === "signature" && (
                <SignaturePad
                  onSave={(base64) => handleTextChange(fid, base64)}
                  savedValue={fieldValues[fid]}
                />
              )}

              {/* GPS coordinates field */}
              {field.type === "gps" && (
                <div className="flex flex-col gap-2 p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    GPS Location Logging Disabled
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Geopolitical location tracking has been removed for privacy compliance. No coordinates will be logged.
                  </p>
                </div>
              )}

              {/* Photo Verification Field */}
              {field.type === "photo" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl cursor-pointer transition">
                      <Camera size={14} className="text-indigo-500" />
                      Take / Upload Photo
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        required={field.required && !fieldValues[fid]}
                        onChange={(e) => handlePhotoCapture(fid, e)}
                        className="hidden"
                      />
                    </label>

                    {photoPreviews[fid] && (
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(fid)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {photoPreviews[fid] && (
                    <div className="max-w-[150px] aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                      <img src={photoPreviews[fid]} alt="Captured student verification" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-2xl transition shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex justify-center items-center gap-2 text-sm"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Recording Attendance...
            </>
          ) : (
            "Record Attendance Submission"
          )}
        </button>
      </form>

      {/* Confirmation Modal overlay if requireConfirmation is enabled */}
      {showConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center">
            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              Confirm Submission
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Please double check that all your entered details are correct before submitting. Once submitted, you cannot edit unless the instructor permits.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={performSubmit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-xs hover:shadow-md cursor-pointer"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
