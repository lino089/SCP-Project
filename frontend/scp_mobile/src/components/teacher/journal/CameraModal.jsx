import { useState, useEffect, useRef } from 'react';
import {
  RotateCw,
  X,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../../shared';
import { compressImage } from '../../../utils/imageCompressor';

export default function CameraModal({
  isOpen,
  onClose,
  onPhotoCaptured,
}) {
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function initCamera() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        if (isMounted) {
          setCameraError('Browser ini tidak mendukung akses kamera langsung (WebRTC). Gunakan opsi unggah foto.');
          setIsStreaming(false);
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setIsStreaming(true);
          setCameraError('');
        }
      } catch {
        if (isMounted) {
          setCameraError(
            'Izin kamera tidak diberikan atau perangkat kamera tidak tersedia. Silakan gunakan pemilih kamera bawaan handphone di bawah.'
          );
          setIsStreaming(false);
        }
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, facingMode]);

  // Flip camera (rear / front)
  const handleToggleFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture photo from video frame
  const handleCapture = async () => {
    if (!videoRef.current || !isStreaming) return;
    setIsProcessing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 800;
      canvas.height = video.videoHeight || 600;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            setIsProcessing(false);
            return;
          }
          const rawFile = new File([blob], `kbm_${Date.now()}.jpg`, { type: 'image/jpeg' });
          const compressed = await compressImage(rawFile, {
            maxWidth: 800,
            quality: 0.35,
            targetSizeKB: 150,
          });

          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
          setIsStreaming(false);
          onPhotoCaptured(compressed, URL.createObjectURL(compressed));
          onClose();
          setIsProcessing(false);
        },
        'image/jpeg',
        0.85
      );
    } catch (err) {
      console.error('Gagal mengambil gambar kamera:', err);
      setIsProcessing(false);
    }
  };

  // Fallback to native device file capture
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const compressed = await compressImage(file, {
        maxWidth: 800,
        quality: 0.35,
        targetSizeKB: 150,
      });
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setIsStreaming(false);
      onPhotoCaptured(compressed, URL.createObjectURL(compressed));
      onClose();
    } catch (err) {
      console.error('Gagal mengompresi berkas foto:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col justify-between p-4 animate-fade-in">
      {/* Top Controls */}
      <div className="flex items-center justify-between text-white z-10">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-brand)]">
          Dokumentasi Bukti KBM
        </span>
        <button
          type="button"
          onClick={() => {
            if (streamRef.current) {
              streamRef.current.getTracks().forEach((t) => t.stop());
              streamRef.current = null;
            }
            setIsStreaming(false);
            onClose();
          }}
          className="p-2 rounded-full bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:text-white"
          aria-label="Tutup Kamera"
        >
          <X size={18} />
        </button>
      </div>

      {/* Viewport Frame */}
      <div className="relative flex-1 flex items-center justify-center my-3 overflow-hidden rounded-[16px] bg-[var(--color-text-primary)] border border-[var(--color-text-primary)]">
        {cameraError ? (
          <div className="p-4 text-center space-y-3 max-w-xs">
            <AlertCircle className="text-amber-400 mx-auto" size={32} />
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{cameraError}</p>
            <Button
              size="sm"
              variant="primary"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2 text-xs font-bold py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand)] text-[var(--color-text-primary)] w-full"
            >
              <Upload size={14} />
              Buka Kamera / Galeri HP
            </Button>
          </div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}

        {/* Shutter overlay indicator */}
        {isStreaming && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-red-600/80 rounded-full flex items-center gap-1.5 text-[11px] text-white font-mono">
            <span className="w-2 h-2 rounded-full bg-[var(--color-surface)] animate-pulse" />
            LIVE
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-around py-3 z-10">
        <button
          type="button"
          onClick={handleToggleFacing}
          disabled={!isStreaming || isProcessing}
          className="p-3 rounded-full bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:text-white disabled:opacity-40"
          aria-label="Balik Kamera"
        >
          <RotateCw size={20} />
        </button>

        <button
          type="button"
          onClick={handleCapture}
          disabled={!isStreaming || isProcessing}
          className="w-16 h-16 rounded-full border-4 border-[var(--color-brand)] bg-[var(--color-surface)] shadow-lg flex items-center justify-center active:scale-95 transition-all disabled:opacity-40"
          aria-label="Ambil Foto"
        >
          <div className="w-12 h-12 rounded-full bg-[var(--color-brand)]" />
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="p-3 rounded-full bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:text-white"
          aria-label="Unggah Berkas"
        >
          <Upload size={20} />
        </button>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
