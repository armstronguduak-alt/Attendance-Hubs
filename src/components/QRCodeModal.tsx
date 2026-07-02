import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X, Download, Copy, Check, MessageSquare, Send, Mail } from "lucide-react";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, url, title }) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && url) {
      QRCode.toDataURL(
        url,
        {
          width: 256,
          margin: 2,
          color: {
            dark: "#0f172a", // slate-900
            light: "#ffffff",
          },
        },
        (err, qrUrl) => {
          if (err) console.error("Failed to generate QR code", err);
          else setQrCodeDataUrl(qrUrl);
        }
      );
    }
  }, [isOpen, url]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const downloadQRCode = () => {
    const link = document.createElement("a");
    link.href = qrCodeDataUrl;
    link.download = `attendance_qr_${title.toLowerCase().replace(/\s+/g, "_")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const whatsappShare = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `Please fill the attendance for *${title}* here: ${url}`
  )}`;
  const telegramShare = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(
    `Please fill the attendance for ${title}`
  )}`;
  const emailShare = `mailto:?subject=${encodeURIComponent(
    `Attendance Form: ${title}`
  )}&body=${encodeURIComponent(`Please fill the attendance form by clicking here: ${url}`)}`;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden relative p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X size={20} />
        </button>

        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1 pr-6">
          Share Attendance Form
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          {title}
        </p>

        <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800/40 mb-6">
          {qrCodeDataUrl ? (
            <img
              src={qrCodeDataUrl}
              alt="Attendance QR Code"
              className="w-48 h-48 bg-white p-2 rounded-xl shadow-md"
            />
          ) : (
            <div className="w-48 h-48 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-xl" />
          )}

          <button
            onClick={downloadQRCode}
            className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-xl transition shadow-xs hover:shadow-md"
          >
            <Download size={14} />
            Download QR Code
          </button>
        </div>

        <div className="space-y-4">
          {/* Link Copier */}
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={url}
              className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-xl font-mono text-slate-600 dark:text-slate-300 select-all"
            />
            <button
              onClick={handleCopyLink}
              className={`px-3 py-2 flex items-center gap-1 text-xs font-medium rounded-xl transition ${
                copied
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {/* Share Channels */}
          <div className="grid grid-cols-3 gap-2">
            <a
              href={whatsappShare}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-medium rounded-xl transition"
            >
              <MessageSquare size={16} />
              WhatsApp
            </a>
            <a
              href={telegramShare}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-xl transition"
            >
              <Send size={16} />
              Telegram
            </a>
            <a
              href={emailShare}
              className="flex flex-col items-center gap-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-xl transition"
            >
              <Mail size={16} />
              Email
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
