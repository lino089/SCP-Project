<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\AcademicEvent;
use App\Models\Classes;
use App\Models\SystemConfiguration;
use App\Services\AcademicCalendarExclusionService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AcademicEventController extends Controller
{
    public function __construct(
        protected AcademicCalendarExclusionService $exclusionService
    ) {}

    /**
     * Menampilkan daftar agenda kalender akademik.
     * Dapat difilter berdasarkan bulan, tahun, rentang tanggal, tipe, dan cakupan kelas.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'month' => 'nullable|integer|between:1,12',
            'year' => 'nullable|integer|min:2020|max:2099',
            'start_date' => 'nullable|date_format:Y-m-d',
            'end_date' => 'nullable|date_format:Y-m-d|after_or_equal:start_date',
            'type' => 'nullable|string|in:' . implode(',', AcademicEvent::TYPES),
            'scope_type' => 'nullable|string|in:' . implode(',', AcademicEvent::SCOPES),
            'disables_teaching' => 'nullable|boolean',
            'academic_year' => 'nullable|string|max:20',
            'class_id' => 'nullable|integer|exists:classes,id',
            'for_my_class' => 'nullable|boolean',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $query = AcademicEvent::query()->with('creator:id,name,role');

        // Filter Tahun & Bulan Kalender
        if ($request->filled('month') && $request->filled('year')) {
            $startOfMonth = Carbon::createFromDate($request->integer('year'), $request->integer('month'), 1)->startOfMonth()->toDateString();
            $endOfMonth = Carbon::createFromDate($request->integer('year'), $request->integer('month'), 1)->endOfMonth()->toDateString();

            $query->where(function ($q) use ($startOfMonth, $endOfMonth) {
                $q->whereBetween('start_date', [$startOfMonth, $endOfMonth])
                    ->orWhereBetween('end_date', [$startOfMonth, $endOfMonth])
                    ->orWhere(function ($sub) use ($startOfMonth, $endOfMonth) {
                        $sub->where('start_date', '<=', $startOfMonth)
                            ->where('end_date', '>=', $endOfMonth);
                    });
            });
        } elseif ($request->filled('start_date') && $request->filled('end_date')) {
            $startDate = $request->input('start_date');
            $endDate = $request->input('end_date');

            $query->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('start_date', [$startDate, $endDate])
                    ->orWhereBetween('end_date', [$startDate, $endDate])
                    ->orWhere(function ($sub) use ($startDate, $endDate) {
                        $sub->where('start_date', '<=', $startDate)
                            ->where('end_date', '>=', $endDate);
                    });
            });
        }

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('scope_type')) {
            $query->where('scope_type', $request->input('scope_type'));
        }

        if ($request->has('disables_teaching')) {
            $query->where('disables_teaching', $request->boolean('disables_teaching'));
        }

        if ($request->filled('academic_year')) {
            $query->where('academic_year', $request->input('academic_year'));
        }

        $query->orderBy('start_date')->orderBy('id');

        // Cek filter spesifik kelas siswa / pengguna
        $classId = null;
        if ($request->boolean('for_my_class')) {
            $user = $request->user();
            if ($user->role === 'student') {
                $classId = $user->class_id;
            } elseif ($user->role === 'parent') {
                $student = $user->linkedStudent;
                $classId = $student?->class_id;
            }
        } elseif ($request->filled('class_id')) {
            $classId = $request->integer('class_id');
        }

        $events = $query->get();

        if ($classId) {
            $schoolClass = Classes::find($classId);
            if ($schoolClass) {
                $events = $events->filter(
                    fn (AcademicEvent $e) => $this->exclusionService->isEventApplicableToClass($e, $schoolClass->id, $schoolClass->level)
                )->values();
            }
        }

        if ($request->filled('per_page')) {
            $page = $request->integer('page', 1);
            $perPage = $request->integer('per_page', 15);
            $total = $events->count();
            $slice = $events->slice(($page - 1) * $perPage, $perPage)->values();

            return response()->json([
                'success' => true,
                'message' => 'Daftar agenda kalender akademik berhasil diambil.',
                'data' => $slice,
                'meta' => [
                    'current_page' => $page,
                    'per_page' => $perPage,
                    'total' => $total,
                    'last_page' => (int) ceil($total / $perPage),
                ],
            ], 200);
        }

        return response()->json([
            'success' => true,
            'message' => 'Daftar agenda kalender akademik berhasil diambil.',
            'data' => $events,
        ], 200);
    }

    /**
     * Memeriksa status eksklusi KBM untuk suatu tanggal dan kelas.
     */
    public function checkExemption(Request $request): JsonResponse
    {
        $request->validate([
            'date' => 'nullable|date_format:Y-m-d',
            'class_id' => 'nullable|integer|exists:classes,id',
        ]);

        $targetDate = $request->input('date', Carbon::now('Asia/Jakarta')->toDateString());
        $classId = $request->input('class_id');

        if (!$classId) {
            $user = $request->user();
            if ($user && $user->role === 'student') {
                $classId = $user->class_id;
            } elseif ($user && $user->role === 'parent') {
                $classId = $user->linkedStudent?->class_id;
            }
        }

        $schoolClass = $classId ? Classes::find($classId) : null;

        if ($schoolClass) {
            $disablingEvent = $this->exclusionService->getActiveDisablingEvent($schoolClass->id, $schoolClass->level, $targetDate);
            $activeEvents = $this->exclusionService->getActiveEventsForClass($schoolClass->id, $schoolClass->level, $targetDate);
            $isExempted = $disablingEvent !== null;
        } else {
            // General school check
            $dayEvents = $this->exclusionService->getEventsForDate($targetDate);
            $disablingEvent = $dayEvents->first(fn (AcademicEvent $e) => (bool) $e->disables_teaching && $e->scope_type === AcademicEvent::SCOPE_ALL);
            $isExempted = $disablingEvent !== null;
            $activeEvents = $dayEvents->filter(fn (AcademicEvent $e) => $e->scope_type === AcademicEvent::SCOPE_ALL)->values();
        }

        return response()->json([
            'success' => true,
            'message' => 'Pengecekan status agenda KBM berhasil.',
            'data' => [
                'date' => $targetDate,
                'class_id' => $schoolClass?->id,
                'class_name' => $schoolClass?->name,
                'grade_level' => $schoolClass?->level,
                'is_teaching_exempted' => $isExempted,
                'disabling_event' => $disablingEvent,
                'active_events' => $activeEvents,
            ],
        ], 200);
    }

    /**
     * Menampilkan detail satu agenda.
     */
    public function show(int|string $id): JsonResponse
    {
        $event = AcademicEvent::with('creator:id,name,role')->find($id);

        if (!$event) {
            return response()->json([
                'success' => false,
                'message' => 'Agenda kalender akademik tidak ditemukan.',
            ], 404);
        }

        $data = $event->toArray();

        // Sertakan detail rombel kelas jika scope_type = 'class'
        if ($event->scope_type === AcademicEvent::SCOPE_CLASS && !empty($event->scope_targets)) {
            $data['target_classes'] = Classes::whereIn('id', $event->scope_targets)
                ->orderBy('level')
                ->orderBy('name')
                ->get(['id', 'name', 'level', 'major']);
        }

        return response()->json([
            'success' => true,
            'message' => 'Detail agenda kalender akademik berhasil diambil.',
            'data' => $data,
        ], 200);
    }

    /**
     * Menambahkan agenda kalender akademik baru (Khusus Waka).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateEventPayload($request);

        $event = AcademicEvent::create([
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'],
            'type' => $validated['type'],
            'scope_type' => $validated['scope_type'],
            'scope_targets' => $validated['scope_targets'],
            'disables_teaching' => $validated['disables_teaching'],
            'academic_year' => $validated['academic_year'],
            'created_by' => $request->user()->id,
        ]);

        AcademicCalendarExclusionService::clearCache();

        return response()->json([
            'success' => true,
            'message' => 'Agenda kalender akademik berhasil ditambahkan.',
            'data' => $event->load('creator:id,name,role'),
        ], 201);
    }

    /**
     * Memperbarui agenda kalender akademik (Khusus Waka).
     */
    public function update(Request $request, int|string $id): JsonResponse
    {
        $event = AcademicEvent::find($id);

        if (!$event) {
            return response()->json([
                'success' => false,
                'message' => 'Agenda kalender akademik tidak ditemukan.',
            ], 404);
        }

        $validated = $this->validateEventPayload($request, $event->id);

        $event->update([
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'],
            'type' => $validated['type'],
            'scope_type' => $validated['scope_type'],
            'scope_targets' => $validated['scope_targets'],
            'disables_teaching' => $validated['disables_teaching'],
            'academic_year' => $validated['academic_year'],
        ]);

        AcademicCalendarExclusionService::clearCache();

        return response()->json([
            'success' => true,
            'message' => 'Agenda kalender akademik berhasil diperbarui.',
            'data' => $event->load('creator:id,name,role'),
        ], 200);
    }

    /**
     * Menghapus agenda kalender akademik (Soft Delete, Khusus Waka).
     */
    public function destroy(int|string $id): JsonResponse
    {
        $event = AcademicEvent::find($id);

        if (!$event) {
            return response()->json([
                'success' => false,
                'message' => 'Agenda kalender akademik tidak ditemukan.',
            ], 404);
        }

        $event->delete();

        AcademicCalendarExclusionService::clearCache();

        return response()->json([
            'success' => true,
            'message' => 'Agenda kalender akademik berhasil dihapus.',
        ], 200);
    }

    /**
     * Helper validasi dan normalisasi payload event.
     */
    protected function validateEventPayload(Request $request, ?int $ignoreId = null): array
    {
        $validated = $request->validate([
            'title' => 'required|string|max:150',
            'description' => 'nullable|string|max:1000',
            'start_date' => 'required|date_format:Y-m-d',
            'end_date' => 'required|date_format:Y-m-d|after_or_equal:start_date',
            'type' => 'required|string|in:' . implode(',', AcademicEvent::TYPES),
            'scope_type' => 'required|string|in:' . implode(',', AcademicEvent::SCOPES),
            'scope_targets' => 'nullable|array',
            'disables_teaching' => 'nullable|boolean',
            'academic_year' => 'nullable|string|max:20',
        ]);

        // Default disables_teaching berdasarkan type jika tidak dikirim
        if (!array_key_exists('disables_teaching', $validated) || $validated['disables_teaching'] === null) {
            $validated['disables_teaching'] = match ($validated['type']) {
                AcademicEvent::TYPE_HOLIDAY, AcademicEvent::TYPE_CLASS_EVENT, AcademicEvent::TYPE_EXAM => true,
                default => false,
            };
        }

        // Resolusi tahun ajaran default dari SystemConfiguration jika kosong
        if (empty($validated['academic_year'])) {
            $config = SystemConfiguration::first();
            $validated['academic_year'] = $config?->academic_year ?? '2025/2026';
        }

        // Validasi dan normalisasi scope_type & scope_targets
        if ($validated['scope_type'] === AcademicEvent::SCOPE_ALL) {
            $validated['scope_targets'] = null;
        } elseif ($validated['scope_type'] === AcademicEvent::SCOPE_GRADE) {
            $targets = $validated['scope_targets'] ?? [];
            if (empty($targets) || !is_array($targets)) {
                throw ValidationException::withMessages([
                    'scope_targets' => ['Pilih minimal satu tingkatan kelas (10, 11, atau 12).'],
                ]);
            }

            $normalizedGrades = [];
            foreach ($targets as $target) {
                $norm = $this->exclusionService->normalizeGrade($target);
                if (!in_array($norm, ['10', '11', '12'], true)) {
                    throw ValidationException::withMessages([
                        'scope_targets' => ["Tingkatan kelas '$target' tidak valid. Gunakan 10, 11, atau 12."],
                    ]);
                }
                $normalizedGrades[] = $norm;
            }
            $validated['scope_targets'] = array_values(array_unique($normalizedGrades));
        } elseif ($validated['scope_type'] === AcademicEvent::SCOPE_CLASS) {
            $targets = $validated['scope_targets'] ?? [];
            if (empty($targets) || !is_array($targets)) {
                throw ValidationException::withMessages([
                    'scope_targets' => ['Pilih minimal satu rombel kelas.'],
                ]);
            }

            $intTargets = array_values(array_unique(array_map('intval', $targets)));
            $existingCount = Classes::whereIn('id', $intTargets)->count();
            if ($existingCount !== count($intTargets)) {
                throw ValidationException::withMessages([
                    'scope_targets' => ['Satu atau lebih rombel kelas yang dipilih tidak valid di database.'],
                ]);
            }
            $validated['scope_targets'] = $intTargets;
        }

        return $validated;
    }
}
