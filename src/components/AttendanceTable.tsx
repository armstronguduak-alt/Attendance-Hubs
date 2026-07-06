import React, { useState, useMemo } from "react";
import { Search, Download, Copy, Printer, Check, X, MapPin, Image as ImageIcon, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { AttendanceField, Submission } from "../types.ts";
import jsPDF from "jspdf";

interface AttendanceTableProps {
  fields: AttendanceField[];
  submissions: Submission[];
  title: string;
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({ fields, submissions, title }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<Record<number, string>>({});
  const [sortColumn, setSortColumn] = useState<{ id: number | string; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [selectedCopyTarget, setSelectedCopyTarget] = useState<string>("table");

  // Extract unique options from submission values for dropdown filters
  const filterOptions = useMemo(() => {
    const options: Record<number, Set<string>> = {};
    fields.forEach(field => {
      if (field.type === "dropdown" || field.type === "radio" || field.isBuiltIn) {
        options[field.id!] = new Set<string>();
      }
    });

    submissions.forEach(sub => {
      Object.entries(sub.values).forEach(([fid, val]) => {
        const fieldId = Number(fid);
        const valStr = String(val || "");
        if (options[fieldId] && valStr && valStr.trim() !== "" && !valStr.startsWith("data:image")) {
          options[fieldId].add(valStr.trim());
        }
      });
    });

    return options;
  }, [fields, submissions]);

  const handleFilterChange = (fieldId: number, value: string) => {
    setSelectedFilters(prev => {
      const updated = { ...prev };
      if (value === "") delete updated[fieldId];
      else updated[fieldId] = value;
      return updated;
    });
    setCurrentPage(1);
  };

  const toggleSort = (columnId: number | string) => {
    setSortColumn(prev => {
      if (prev && prev.id === columnId) {
        return { id: columnId, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { id: columnId, direction: "asc" };
    });
  };

  // Filter and search submissions
  const processedSubmissions = useMemo(() => {
    let result = [...submissions];

    // 1. Search Query Matcher
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(sub => {
        // Search IP, date, and any field value
        if (sub.ipAddress?.toLowerCase().includes(query)) return true;
        
        return Object.values(sub.values).some(val => {
          const valStr = String(val || "");
          if (valStr && !valStr.startsWith("data:image")) {
            return valStr.toLowerCase().includes(query);
          }
          return false;
        });
      });
    }

    // 2. Dropdown Filter Matcher
    Object.entries(selectedFilters).forEach(([fid, filterVal]) => {
      const fieldId = Number(fid);
      result = result.filter(sub => {
        const valStr = String(sub.values[fieldId] || "");
        return valStr.trim() === filterVal;
      });
    });

    // 3. Sorter
    if (sortColumn) {
      const { id, direction } = sortColumn;
      result.sort((a, b) => {
        let valA = "";
        let valB = "";

        if (id === "submittedAt") {
          valA = new Date(a.submittedAt).getTime().toString();
          valB = new Date(b.submittedAt).getTime().toString();
        } else {
          valA = String(a.values[Number(id)] || "").toLowerCase();
          valB = String(b.values[Number(id)] || "").toLowerCase();
        }

        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [submissions, searchQuery, selectedFilters, sortColumn]);

  // Paginated chunk
  const paginatedSubmissions = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return processedSubmissions.slice(startIdx, startIdx + itemsPerPage);
  }, [processedSubmissions, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(processedSubmissions.length / itemsPerPage);

  const handleCopySelectedTarget = async () => {
    try {
      let textToCopy = "";

      if (selectedCopyTarget === "table") {
        // Header
        const headers = ["S/N", ...fields.map(f => f.label), "Submitted At"];
        const rows = processedSubmissions.map((sub, idx) => {
          const rowVals = fields.map(f => {
            const v = sub.values[f.id!] || "";
            return v.startsWith("data:image") ? "[Image]" : v;
          });
          return [`${idx + 1}`, ...rowVals, new Date(sub.submittedAt).toLocaleString()];
        });

        textToCopy = [headers.join("\t"), ...rows.map(r => r.join("\t"))].join("\n");
      } else if (selectedCopyTarget.startsWith("field-")) {
        const fieldId = Number(selectedCopyTarget.replace("field-", ""));
        const targetField = fields.find(f => f.id === fieldId);
        if (!targetField) return;

        textToCopy = processedSubmissions
          .map(s => s.values[fieldId] || "")
          .filter(v => v.trim() !== "" && !v.startsWith("data:image"))
          .join("\n");
      }

      await navigator.clipboard.writeText(textToCopy);
      setCopyStatus(selectedCopyTarget);
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (err) {
      console.error("Clipboard copy failed", err);
    }
  };

  // CSV Exporter
  const exportCSV = () => {
    const csvHeaders = ["S/N", ...fields.map(f => `"${f.label.replace(/"/g, '""')}"`), "Submitted At"];
    const csvRows = processedSubmissions.map((sub, idx) => {
      const rowVals = fields.map(f => {
        const v = sub.values[f.id!] || "";
        return v.startsWith("data:image") ? '"[Image]"' : `"${v.replace(/"/g, '""')}"`;
      });
      return [`${idx + 1}`, ...rowVals, `"${new Date(sub.submittedAt).toLocaleString()}"`].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [csvHeaders.join(","), ...csvRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_${title.toLowerCase().replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to draw signature as vector lines in PDF (satisfying "drawing, not an image" constraint)
  const drawVectorSignature = (doc: any, signatureDataStr: string, x: number, y: number, width: number, height: number): boolean => {
    if (!signatureDataStr) return false;
    try {
      // Clean leading/trailing spaces or quotes if any
      const cleanedStr = signatureDataStr.trim();
      if (!cleanedStr.startsWith("{")) return false;

      const data = JSON.parse(cleanedStr);
      if (!data.strokes || !Array.isArray(data.strokes)) return false;

      // Find bounding box of the strokes to crop/center tightly
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      data.strokes.forEach((stroke: any[]) => {
        if (!Array.isArray(stroke)) return;
        stroke.forEach((p: { x: number; y: number }) => {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        });
      });

      if (minX === Infinity || minY === Infinity) return false;

      const strokeW = maxX - minX;
      const strokeH = maxY - minY;
      if (strokeW === 0 || strokeH === 0) return false;

      // Scale to fit inside the given cell box while preserving aspect ratio
      const padding = 1.5;
      const targetW = width - padding * 2;
      const targetH = height - padding * 2;
      const scale = Math.min(targetW / strokeW, targetH / strokeH);
      const offsetX = x + padding + (targetW - strokeW * scale) / 2;
      const offsetY = y + padding + (targetH - strokeH * scale) / 2;

      const originalColor = doc.getDrawColor();
      const originalWidth = doc.getLineWidth();

      doc.setDrawColor(30, 27, 75); // Dark navy line color for aesthetics
      doc.setLineWidth(0.4); // Clean thin vector stroke

      data.strokes.forEach((stroke: any[]) => {
        if (!Array.isArray(stroke) || stroke.length < 2) return;
        for (let i = 0; i < stroke.length - 1; i++) {
          const p1 = stroke[i];
          const p2 = stroke[i + 1];

          const px1 = offsetX + (p1.x - minX) * scale;
          const py1 = offsetY + (p1.y - minY) * scale;
          const px2 = offsetX + (p2.x - minX) * scale;
          const py2 = offsetY + (p2.y - minY) * scale;

          doc.line(px1, py1, px2, py2);
        }
      });

      // Restore drawing properties
      doc.setDrawColor(originalColor);
      doc.setLineWidth(originalWidth);
      return true;
    } catch (err) {
      console.warn("Failed to parse vector signature data:", err);
      return false;
    }
  };

  // PDF Exporter
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("AttendanceHub Report", 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Title: ${title}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34);
    doc.text(`Total Records: ${processedSubmissions.length}`, 14, 40);

    let yPosition = 50;
    doc.setDrawColor(220);
    doc.line(14, yPosition, 196, yPosition);

    yPosition += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(50);

    // Dynamic columns configuration to draw ALL user details
    const snWidth = 10;
    const timeWidth = 32;
    const usableWidth = 182;
    const fieldsWidth = usableWidth - snWidth - timeWidth;
    const colWidth = fieldsWidth / fields.length;

    // Headers
    doc.text("S/N", 14, yPosition);
    fields.forEach((f, idx) => {
      const colX = 14 + snWidth + idx * colWidth;
      doc.text(f.label.slice(0, 18), colX, yPosition);
    });
    doc.text("Submitted At", 14 + snWidth + fieldsWidth, yPosition);

    yPosition += 4;
    doc.line(14, yPosition, 196, yPosition);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80);

    // Make row height generous if there is a digital signature field
    const hasSignatureField = fields.some(f => f.type === "signature");
    const rowHeight = hasSignatureField ? 14 : 8;

    processedSubmissions.forEach((sub, idx) => {
      if (yPosition + rowHeight > 275) {
        doc.addPage();
        yPosition = 20;
        doc.line(14, yPosition, 196, yPosition);
        yPosition += 8;

        // Re-draw table headers on the new page
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(50);
        doc.text("S/N", 14, yPosition);
        fields.forEach((f, fIdx) => {
          doc.text(f.label.slice(0, 18), 14 + snWidth + fIdx * colWidth, yPosition);
        });
        doc.text("Submitted At", 14 + snWidth + fieldsWidth, yPosition);

        yPosition += 4;
        doc.line(14, yPosition, 196, yPosition);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(80);
      }

      // Record baseline Y index inside cell
      const verticalAlignOffset = yPosition + (rowHeight / 2) + 1;

      // S/N
      doc.text(`${idx + 1}`, 14, verticalAlignOffset);

      // Data Columns
      fields.forEach((f, fIdx) => {
        const val = sub.values[f.id!] || "-";
        const cellX = 14 + snWidth + fIdx * colWidth;

        if (f.type === "signature") {
          const drawn = drawVectorSignature(doc, val, cellX, yPosition, colWidth, rowHeight);
          if (!drawn) {
            // Raw fallback for legacy image signatures or missing values
            const isImage = val.startsWith("data:image") || val.startsWith("{\"image\":\"data:image");
            doc.text(isImage ? "[Signed]" : "-", cellX, verticalAlignOffset);
          }
        } else if (f.type === "photo") {
          doc.text(val ? "[Photo Verified]" : "-", cellX, verticalAlignOffset);
        } else if (f.type === "checkbox") {
          doc.text(val === "true" ? "Yes" : "No", cellX, verticalAlignOffset);
        } else {
          doc.text(val.slice(0, 20), cellX, verticalAlignOffset);
        }
      });

      // Date Time Column
      const formattedDate = new Date(sub.submittedAt).toLocaleDateString() + " " + new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      doc.text(formattedDate, 14 + snWidth + fieldsWidth, verticalAlignOffset);

      yPosition += rowHeight;

      // Draw light horizontal divider
      doc.setDrawColor(240);
      doc.line(14, yPosition, 196, yPosition);
    });

    doc.save(`attendance_report_${title.toLowerCase().replace(/\s+/g, "_")}.pdf`);
  };

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Action Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl focus:outline-hidden focus:border-indigo-500 dark:text-slate-200"
          />
        </div>

        {/* Copy Tools & Exporters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Clipboard select utilities */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <select
              value={selectedCopyTarget}
              onChange={(e) => setSelectedCopyTarget(e.target.value)}
              className="px-2 py-1 bg-transparent text-slate-700 dark:text-slate-300 text-xs rounded-lg focus:outline-hidden cursor-pointer"
            >
              <option value="table">Full Table (TSV)</option>
              {fields.map(field => (
                <option key={field.id} value={`field-${field.id}`}>
                  Column: {field.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleCopySelectedTarget}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg transition font-medium flex items-center gap-1 cursor-pointer active:scale-95"
            >
              {copyStatus === selectedCopyTarget ? (
                <>
                  <Check size={12} className="text-white animate-pulse" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Exporters */}
          <button
            onClick={exportCSV}
            className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/30 text-xs rounded-lg hover:bg-indigo-100 transition font-medium flex items-center gap-1 cursor-pointer"
          >
            <Download size={12} />
            CSV
          </button>
          <button
            onClick={exportPDF}
            className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/30 text-xs rounded-lg hover:bg-indigo-100 transition font-medium flex items-center gap-1 cursor-pointer"
          >
            <Download size={12} />
            PDF Report
          </button>
          <button
            onClick={triggerPrint}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg transition font-medium flex items-center gap-1 cursor-pointer"
          >
            <Printer size={12} />
            Print
          </button>
        </div>
      </div>

      {/* Unique column filters */}
      {Object.keys(filterOptions).length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap gap-4 items-center">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase font-mono tracking-wider">
            Filters:
          </span>
          {fields.map(field => {
            const fid = field.id!;
            if (!filterOptions[fid] || filterOptions[fid].size === 0) return null;

            return (
              <div key={fid} className="flex items-center gap-1 text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-medium">{field.label}:</span>
                <select
                  value={selectedFilters[fid] || ""}
                  onChange={(e) => handleFilterChange(fid, e.target.value)}
                  className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value="">All</option>
                  {Array.from(filterOptions[fid]).map((opt, oIdx) => (
                    <option key={oIdx} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Table View */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 font-mono uppercase tracking-wider">
                <th className="py-3 px-4 w-16">S/N</th>
                {fields.map(field => (
                  <th
                    key={field.id}
                    onClick={() => toggleSort(field.id!)}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      {field.label}
                      <ArrowUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>
                ))}
                <th
                  onClick={() => toggleSort("submittedAt")}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none"
                >
                  <div className="flex items-center gap-1.5">
                    Submitted At
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
              {paginatedSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={fields.length + 2} className="py-12 text-center text-slate-500 dark:text-slate-300">
                    No submissions found matching criteria.
                  </td>
                </tr>
              ) : (
                paginatedSubmissions.map((sub, idx) => {
                  const serialNum = (currentPage - 1) * itemsPerPage + idx + 1;
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/10 transition">
                      <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-300">
                        {serialNum}
                      </td>
                      {fields.map(field => {
                        const val = sub.values[field.id!] || "-";

                        // Handle image / base64 rendering
                        if (val.startsWith("data:image")) {
                          const isSig = field.type === "signature";
                          return (
                            <td key={field.id} className="py-2 px-4">
                              <button
                                type="button"
                                onClick={() => setLightboxImage(val)}
                                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                              >
                                {isSig ? (
                                  <span className="inline-block h-6 w-14 bg-white border border-slate-200 dark:border-slate-800 rounded p-0.5 overflow-hidden">
                                    <img src={val} alt="Sig" className="w-full h-full object-contain" />
                                  </span>
                                ) : (
                                  <ImageIcon size={14} />
                                )}
                                View {isSig ? "Signature" : "Photo"}
                              </button>
                            </td>
                          );
                        }

                        // Handle GPS location links
                        if (field.type === "gps" && val.includes(",")) {
                          const [lat, lng] = val.split(",");
                          return (
                            <td key={field.id} className="py-3 px-4">
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline"
                              >
                                <MapPin size={12} />
                                Map Location
                              </a>
                            </td>
                          );
                        }

                        // Handle checkboxes
                        if (field.type === "checkbox") {
                          const isTrue = val === "true";
                          return (
                            <td key={field.id} className="py-3 px-4">
                              {isTrue ? (
                                <span className="inline-flex items-center justify-center h-5 w-5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full">
                                  <Check size={12} />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center h-5 w-5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-full">
                                  <X size={12} />
                                </span>
                              )}
                            </td>
                          );
                        }

                        // Standard text cell
                        return (
                          <td key={field.id} className="py-3 px-4 font-medium max-w-[150px] truncate" title={val}>
                            {val}
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {new Date(sub.submittedAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 bg-slate-50 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-300">
              Showing {paginatedSubmissions.length} of {processedSubmissions.length} record{processedSubmissions.length !== 1 && "s"}
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-20 cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="text-xs font-semibold px-3 text-slate-700 dark:text-slate-300">
                Page {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-20 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox for Signatures / Photo verification */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 bg-slate-900/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 cursor-zoom-out animate-fade-in"
        >
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-2xl max-w-lg max-h-[85vh] overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-2 right-2 p-1 bg-slate-900/60 text-white rounded-full hover:bg-slate-900/80 transition"
            >
              <X size={16} />
            </button>
            <img src={lightboxImage} alt="Verification Zoom" className="w-full max-h-[80vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};
