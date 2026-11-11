<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Schedule;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Mengambil daftar notifikasi milik pengguna saat ini.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $notifications = Notification::forUser($userId)
            ->with('sender:id,name,role')
            ->orderByDesc('created_at')
            ->take(20)
            ->get();

        $unreadCount = Notification::forUser($userId)
            ->unread()
            ->count();

        return response()->json([
            'success' => true,
            'message' => 'Daftar notifikasi berhasil dimuat.',
            'data' => $notifications,
            'meta' => [
                'unread_count' => $unreadCount,
            ],
        ]);
    }

    /**
     * Menandai satu notifikasi sebagai sudah dibaca.
     */
    public function markAsRead(Request $request, int $id): JsonResponse
    {
        $userId = $request->user()->id;

        $notification = Notification::forUser($userId)->find($id);

        if (!$notification) {
            return response()->json([
                'success' => false,
                'message' => 'Notifikasi tidak ditemukan.',
            ], 404);
        }

        if (!$notification->read_at) {
            $notification->update(['read_at' => now()]);
        }

        $unreadCount = Notification::forUser($userId)
            ->unread()
            ->count();

        return response()->json([
            'success' => true,
            'message' => 'Notifikasi telah ditandai sebagai dibaca.',
            'data' => $notification,
            'meta' => [
                'unread_count' => $unreadCount,
            ],
        ]);
    }

    /**
     * Menandai semua notifikasi milik pengguna sebagai sudah dibaca.
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        Notification::forUser($userId)
            ->unread()
            ->update(['read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'Semua notifikasi telah ditandai sebagai dibaca.',
            'meta' => [
                'unread_count' => 0,
            ],
        ]);
    }

    /**
     * Mengirimkan pengingat keterlambatan pengisian jurnal KBM oleh Waka ke Guru.
     */
    public function remindJournal(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'vice_principal') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya Waka Kurikulum yang memiliki wewenang mengirimkan pengingat jurnal.',
            ], 403);
        }

        $validated = $request->validate([
            'schedule_id' => 'required|integer|exists:schedules,id',
            'teacher_id' => 'required|integer|exists:users,id',
            'custom_message' => 'nullable|string|max:500',
        ]);

        $schedule = Schedule::with(['schoolClass', 'subject', 'teacher'])->findOrFail($validated['schedule_id']);
        $teacher = User::findOrFail($validated['teacher_id']);

        // Anti-spam check: bila dalam 15 menit terakhir sudah ada notifikasi serupa, perbarui statusnya
        $recent = Notification::forUser($teacher->id)
            ->where('type', 'journal_reminder')
            ->where('data->schedule_id', $schedule->id)
            ->where('created_at', '>=', now()->subMinutes(15))
            ->first();

        if ($recent) {
            $recent->update([
                'read_at' => null,
                'created_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => "Pengingat KBM telah diperbarui dan dikirimkan ulang ke {$teacher->name}.",
                'data' => $recent,
            ]);
        }

        $className = $schedule->schoolClass?->name ?? 'Kelas';
        $subjectName = $schedule->subject?->name ?? 'Mata Pelajaran';
        $periodInfo = "Jam ke-{$schedule->period_number}";

        $message = $validated['custom_message'] ?? "Pengingat Waka Kurikulum: Sesi KBM {$subjectName} di kelas {$className} ({$periodInfo}) telah selesai lebih dari 30 menit lalu namun jurnal pembelajaran belum diisi. Mohon segera melengkapi jurnal KBM.";

        $notification = Notification::create([
            'user_id' => $teacher->id,
            'sender_id' => $user->id,
            'title' => 'Peringatan Pengisian Jurnal KBM',
            'message' => $message,
            'type' => 'journal_reminder',
            'action_url' => '/teacher/journal',
            'data' => [
                'schedule_id' => $schedule->id,
                'class_name' => $className,
                'subject_name' => $subjectName,
                'period_number' => $schedule->period_number,
                'sender_name' => $user->name,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => "Pengingat KBM berhasil dikirimkan ke {$teacher->name}.",
            'data' => $notification,
        ], 201);
    }
}
