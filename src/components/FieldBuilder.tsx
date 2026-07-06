import React, { useState, useRef } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Settings, Check, CheckCircle2 } from "lucide-react";
import { AttendanceField } from "../types.ts";

interface FieldBuilderProps {
  fields: AttendanceField[];
  onChange: (fields: AttendanceField[]) => void;
}

const BUILT_IN_TEMPLATES = [
  { label: "Full Name", type: "text", placeholder: "e.g. John Doe", required: true, isBuiltIn: true },
  { label: "Matric Number", type: "text", placeholder: "e.g. ENG1802930", required: true, isBuiltIn: true },
  { label: "Email Address", type: "email", placeholder: "e.g. john@university.edu", required: true, isBuiltIn: true },
  { label: "Phone Number", type: "tel", placeholder: "e.g. +23480...", required: false, isBuiltIn: true },
  { label: "Department", type: "text", placeholder: "e.g. Electrical Engineering", required: false, isBuiltIn: true },
  { label: "Level", type: "dropdown", placeholder: "Select level", required: false, options: "100L, 200L, 300L, 400L, 500L, Graduate", isBuiltIn: true },
];

const ADVANCED_TEMPLATES = [
  { label: "Digital Signature", type: "signature", placeholder: "", required: true, isBuiltIn: false },
  { label: "Photo Verification", type: "photo", placeholder: "", required: false, isBuiltIn: false },
  { label: "Dropdown Select", type: "dropdown", placeholder: "Choose option", required: false, options: "Option 1, Option 2, Option 3", isBuiltIn: false },
  { label: "Short Comment", type: "textarea", placeholder: "Enter details...", required: false, isBuiltIn: false },
];

export const FieldBuilder: React.FC<FieldBuilderProps> = ({ fields, onChange }) => {
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showFeedback = (message: string) => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    setFeedback(message);
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
    }, 2200);
  };

  const isTemplateAdded = (template: { label: string; type: string }) => {
    return fields.some(
      (f) =>
        f.type === template.type &&
        f.label.toLowerCase() === template.label.toLowerCase()
    );
  };

  const toggleField = (template: typeof BUILT_IN_TEMPLATES[0] | typeof ADVANCED_TEMPLATES[0]) => {
    const existingIndex = fields.findIndex(
      (f) =>
        f.type === template.type &&
        f.label.toLowerCase() === template.label.toLowerCase()
    );

    if (existingIndex >= 0) {
      // Remove
      const updated = fields.filter((_, idx) => idx !== existingIndex);
      const resetOrder = updated.map((f, idx) => ({ ...f, fieldOrder: idx }));
      onChange(resetOrder);
      showFeedback(`Removed "${template.label}"`);
    } else {
      // Add
      const newField: AttendanceField = {
        label: template.label,
        placeholder: template.placeholder,
        required: template.required,
        type: template.type,
        options: "options" in template ? template.options : null,
        fieldOrder: fields.length,
        isBuiltIn: template.isBuiltIn,
      };
      onChange([...fields, newField]);
      showFeedback(`Added "${template.label}"`);
    }
  };

  const removeField = (index: number) => {
    const fieldToRemove = fields[index];
    const updated = fields.filter((_, idx) => idx !== index);
    // Recalculate orders
    const resetOrder = updated.map((f, idx) => ({ ...f, fieldOrder: idx }));
    onChange(resetOrder);
    if (fieldToRemove) {
      showFeedback(`Removed "${fieldToRemove.label}"`);
    }
  };

  const updateFieldProperty = (index: number, key: keyof AttendanceField, value: any) => {
    const updated = [...fields];
    updated[index] = {
      ...updated[index],
      [key]: value,
    };
    onChange(updated);
  };

  const moveField = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === fields.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...fields];

    // Swap fields
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Re-assign explicit orders
    const resetOrder = updated.map((f, idx) => ({ ...f, fieldOrder: idx }));
    onChange(resetOrder);
  };

  return (
    <div className="space-y-6">
      {/* Fields List (Rendered first so templates are below after you fill the form) */}
      <div>
        <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-300 font-mono uppercase tracking-wider mb-3">
          Form Fields & Configuration ({fields.length} field{fields.length !== 1 && "s"})
        </h4>

        {fields.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 dark:text-slate-500 text-xs">
            No fields added yet. Choose from the template buttons below to add custom fields to your attendance form.
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field, idx) => (
              <div
                key={idx}
                className="flex flex-col md:flex-row gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xs hover:shadow-sm transition"
              >
                {/* Order Handles */}
                <div className="flex md:flex-col justify-between md:justify-center items-center gap-1 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 pb-2 md:pb-0 pr-0 md:pr-4">
                  <div className="flex md:flex-col gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveField(idx, "up")}
                      className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-20 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === fields.length - 1}
                      onClick={() => moveField(idx, "down")}
                      className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-20 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                  <span className="text-[10px] font-semibold font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-md">
                    #{idx + 1}
                  </span>
                </div>

                {/* Properties form */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
                  {/* Label */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-1">
                      FIELD LABEL
                    </label>
                    <input
                      type="text"
                      required
                      value={field.label}
                      onChange={(e) => updateFieldProperty(idx, "label", e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200"
                    />
                  </div>

                  {/* Placeholder */}
                  {field.type !== "signature" && field.type !== "photo" && field.type !== "gps" && field.type !== "checkbox" && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-1">
                        PLACEHOLDER TEXT
                      </label>
                      <input
                        type="text"
                        value={field.placeholder || ""}
                        onChange={(e) => updateFieldProperty(idx, "placeholder", e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200"
                      />
                    </div>
                  )}

                  {/* Options Input (Dropdown/Radio) */}
                  {(field.type === "dropdown" || field.type === "radio") && (
                    <div className="col-span-1 sm:col-span-2 md:col-span-1">
                      <label className="block text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1">
                        <Settings size={10} />
                        OPTIONS (COMMA-SEPARATED)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Red, Blue, Green"
                        value={field.options || ""}
                        onChange={(e) => updateFieldProperty(idx, "options", e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200"
                      />
                    </div>
                  )}

                  {/* Metadata display & required toggle */}
                  <div className="flex items-center gap-4 py-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateFieldProperty(idx, "required", e.target.checked)}
                        className="rounded border-slate-300 dark:border-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                      />
                      Required
                    </label>

                    <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-md font-mono uppercase tracking-wide">
                      {field.type}
                    </span>
                  </div>
                </div>

                {/* Remove button */}
                <div className="flex items-center justify-end border-t md:border-t-0 border-slate-100 dark:border-slate-800 pt-2 md:pt-0 pl-0 md:pl-2">
                  <button
                    type="button"
                    onClick={() => removeField(idx)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition"
                    title="Remove field"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Templates Selector (Rendered at the bottom so it appears after form you publish) */}
      <div className="bg-slate-50 dark:bg-slate-950 p-5 border border-slate-200 dark:border-slate-800 rounded-2xl relative">
        
        {/* Animated Feedback overlay badge inside template selector */}
        {feedback && (
          <div className="absolute top-4 right-4 bg-indigo-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 animate-pulse z-10 border border-indigo-500">
            <CheckCircle2 size={12} className="text-white" />
            <span>{feedback}</span>
          </div>
        )}

        <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-300 font-mono uppercase tracking-wider mb-3">
          Add Form Fields from Templates
        </h4>

        {/* Built-in template buttons */}
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-2">BUILT-IN TEMPLATES</p>
          <div className="flex flex-wrap gap-2">
            {BUILT_IN_TEMPLATES.map((t, idx) => {
              const added = isTemplateAdded(t);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleField(t)}
                  className={`flex items-center gap-1.5 px-3 py-2 border text-xs rounded-xl transition-all duration-200 shadow-2xs font-medium cursor-pointer transform active:scale-95 ${
                    added
                      ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-xs"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300"
                  }`}
                >
                  {added ? (
                    <Check size={12} className="text-white shrink-0" />
                  ) : (
                    <Plus size={12} className="text-slate-400 shrink-0" />
                  )}
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced / custom fields buttons */}
        <div>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-2">ADVANCED & CUSTOM FIELDS</p>
          <div className="flex flex-wrap gap-2">
            {ADVANCED_TEMPLATES.map((t, idx) => {
              const added = isTemplateAdded(t);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleField(t)}
                  className={`flex items-center gap-1.5 px-3 py-2 border text-xs rounded-xl transition-all duration-200 shadow-2xs font-medium cursor-pointer transform active:scale-95 ${
                    added
                      ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-xs"
                      : "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/40"
                  }`}
                >
                  {added ? (
                    <Check size={12} className="text-white shrink-0" />
                  ) : (
                    <Plus size={12} className="text-indigo-400 shrink-0" />
                  )}
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
