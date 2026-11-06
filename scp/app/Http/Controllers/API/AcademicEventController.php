<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\AcademicEvent;
use App\Models\Classes;
use App\Models\Schedule;
use App\Models\SystemConfiguration;
use App\Services\AcademicCalendarExclusionService;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
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

        // Cek filter spesifik kelas siswa / pengguna dengan pengamanan berbasis peran
        $user = $request->user();
        $classId = null;

        if ($user && $user->role === 'student') {
            $classId = $user->class_id;
        } elseif ($user && $user->role === 'parent') {
            $children = $user->getLinkedStudents();
            $allowedClassIds = $children->pluck('class_id')->filter()->map('intval')->unique()->toArray();
            if ($request->filled('class_id')) {
                $reqClassId = $request->integer('class_id');
                if (!in_array($reqClassId, $allowedClassIds, true)) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Akses ditolak. Anda tidak memiliki izin untuk melihat agenda kelas ini.',
                    ], 403);
                }
                $classId = $reqClassId;
            }
        } elseif ($request->boolean('for_my_class')) {
            if ($user?->role === 'student') {
                $classId = $user->class_id;
            } elseif ($user?->role === 'parent') {
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
        } elseif ($user && $user->role === 'parent') {
            $children = $user->getLinkedStudents();
            $events = $events->filter(function (AcademicEvent $e) use ($children) {
                if ($e->scope_type === AcademicEvent::SCOPE_ALL) return true;
                foreach ($children as $ch) {
                    if ($ch->class_id && $this->exclusionService->isEventApplicableToClass($e, $ch->class_id, $ch->schoolClass?->level ?? 10)) {
                        return true;
                    }
                }
                return false;
            })->values();
        } elseif ($user && $user->role === 'student' && !$classId) {
            $events = $events->filter(fn (AcademicEvent $e) => $e->scope_type === AcademicEvent::SCOPE_ALL)->values();
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
     * Endpoint personalisasi agenda kalender akademik multi-role.
     * GET /api/academic-events/my-calendar
     */
    public function myCalendar(Request $request): JsonResponse
    {
        $request->validate([
            'month' => 'nullable|integer|between:1,12',
            'year' => 'nullable|integer|min:2020|max:2099',
            'start_date' => 'nullable|date_format:Y-m-d',
            'end_date' => 'nullable|date_format:Y-m-d|after_or_equal:start_date',
            'type' => 'nullable|string|in:' . implode(',', AcademicEvent::TYPES),
            'class_id' => 'nullable|integer|exists:classes,id',
            'grade' => 'nullable|string',
            'only_affects_my_teaching' => 'nullable|boolean',
            'only_my_scope' => 'nullable|boolean',
            'only_my_classes' => 'nullable|boolean',
            'child_id' => 'nullable|integer|exists:users,id',
        ]);

        $user = $request->user();
        $role = $user->role;

        // 1. Tentukan Rentang Tanggal
        if ($request->filled('month') && $request->filled('year')) {
            $startDate = Carbon::createFromDate($request->integer('year'), $request->integer('month'), 1)->startOfMonth();
            $endDate = Carbon::createFromDate($request->integer('year'), $request->integer('month'), 1)->endOfMonth();
            $month = $request->integer('month');
            $year = $request->integer('year');
        } elseif ($request->filled('start_date') && $request->filled('end_date')) {
            $startDate = Carbon::parse($request->input('start_date'))->startOfDay();
            $endDate = Carbon::parse($request->input('end_date'))->endOfDay();
            $month = (int) $startDate->month;
            $year = (int) $startDate->year;
        } else {
            $now = Carbon::now('Asia/Jakarta');
            $startDate = $now->copy()->startOfMonth();
            $endDate = $now->copy()->endOfMonth();
            $month = (int) $now->month;
            $year = (int) $now->year;
        }

        $startStr = $startDate->toDateString();
        $endStr = $endDate->toDateString();

        // Query agenda dalam rentang tanggal
        $query = AcademicEvent::query()
            ->with('creator:id,name,role')
            ->where(function ($q) use ($startStr, $endStr) {
                $q->whereBetween('start_date', [$startStr, $endStr])
                    ->orWhereBetween('end_date', [$startStr, $endStr])
                    ->orWhere(function ($sub) use ($startStr, $endStr) {
                        $sub->where('start_date', '<=', $startStr)
                            ->where('end_date', '>=', $endStr);
                    });
            })
            ->orderBy('start_date')
            ->orderBy('id');

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        $allRawEvents = $query->get();

        // Ambil data referensi kelas untuk batch lookup nama rombel
        $allClassTargets = [];
        foreach ($allRawEvents as $e) {
            if ($e->scope_type === AcademicEvent::SCOPE_CLASS && !empty($e->scope_targets)) {
                foreach ($e->scope_targets as $t) {
                    $allClassTargets[] = (int) $t;
                }
            }
        }
        $classTargetMap = empty($allClassTargets) ? collect() : Classes::whereIn('id', array_unique($allClassTargets))->get(['id', 'name', 'level'])->keyBy('id');

        // Struktur respon data kontekstual
        $context = [
            'taught_classes' => [],
            'homeroom_class' => null,
            'student' => null,
            'children' => [],
        ];

        $filteredEvents = collect();
        $dailyTeachingStatus = [];

        // 2. Personalisasi Berdasarkan Role
        if ($role === 'vice_principal') {
            // Waka / Admin
            $filteredEvents = $allRawEvents;

            // Filter opsional tingkat untuk simulasi waka
            if ($request->filled('grade')) {
                $normGrade = $this->exclusionService->normalizeGrade($request->input('grade'));
                $filteredEvents = $filteredEvents->filter(function (AcademicEvent $e) use ($normGrade) {
                    if ($e->scope_type === AcademicEvent::SCOPE_ALL) return true;
                    if ($e->scope_type === AcademicEvent::SCOPE_GRADE) {
                        $targets = array_map(fn($t) => $this->exclusionService->normalizeGrade($t), $e->scope_targets ?? []);
                        return in_array($normGrade, $targets, true);
                    }
                    if ($e->scope_type === AcademicEvent::SCOPE_CLASS) {
                        return Classes::whereIn('id', $e->scope_targets ?? [])
                            ->get()
                            ->some(fn($c) => $this->exclusionService->normalizeGrade($c->level) === $normGrade);
                    }
                    return false;
                })->values();
            }

            // Filter opsional rombel spesifik
            if ($request->filled('class_id')) {
                $cId = $request->integer('class_id');
                $targetClass = Classes::find($cId);
                if ($targetClass) {
                    $filteredEvents = $filteredEvents->filter(function (AcademicEvent $e) use ($targetClass) {
                        return $this->exclusionService->isEventApplicableToClass($e, $targetClass->id, $targetClass->level);
                    })->values();
                }
            }

        } elseif ($role === 'teacher') {
            // Guru Pengampu, Wali Kelas, & Kesiswaan
            $schedules = Schedule::where('teacher_id', $user->id)
                ->with('schoolClass:id,name,level')
                ->get();

            $taughtClasses = $schedules->map(fn($s) => $s->schoolClass)->filter()->unique('id')->values();
            $taughtClassIds = $taughtClasses->pluck('id')->map('intval')->toArray();

            $assignments = $user->assignments()->with('schoolClass:id,name,level')->get();
            $homeroomAsgn = $assignments->firstWhere('type', 'wali_kelas');
            $assignedClasses = $assignments->map(fn($a) => $a->schoolClass)->filter()->unique('id')->values();
            $assignedClassIds = $assignedClasses->pluck('id')->map('intval')->toArray();

            $allRelevantClasses = $taughtClasses->concat($assignedClasses)->unique('id')->values();
            $allRelevantClassIds = $allRelevantClasses->pluck('id')->map('intval')->toArray();
            $allRelevantGrades = $allRelevantClasses->pluck('level')
                ->map(fn($l) => $this->exclusionService->normalizeGrade($l))
                ->unique()
                ->values()
                ->toArray();

            $isGlobalKesiswaan = $user->assignments()->where('type', 'kesiswaan')->whereNull('class_id')->exists();
            $isKesiswaan = $user->assignments()->where('type', 'kesiswaan')->exists();

            $context['taught_classes'] = $taughtClasses->map(fn($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'level' => $this->exclusionService->normalizeGrade($c->level),
            ])->toArray();

            $context['is_kesiswaan'] = $isKesiswaan;
            $context['is_global_kesiswaan'] = $isGlobalKesiswaan;
            $context['relevant_class_ids'] = $allRelevantClassIds;
            $context['relevant_grades'] = $allRelevantGrades;

            if ($homeroomAsgn && $homeroomAsgn->schoolClass) {
                $context['homeroom_class'] = [
                    'id' => $homeroomAsgn->schoolClass->id,
                    'name' => $homeroomAsgn->schoolClass->name,
                    'level' => $this->exclusionService->normalizeGrade($homeroomAsgn->schoolClass->level),
                ];
            }

            // Keputusan 4: Guru dan Kesiswaan dapat melihat seluruh agenda kegiatan sekolah (all, grade, class).
            // Filter hanya berlaku jika guru secara sengaja meminta penyempitan via only_my_scope / only_my_classes
            if ($request->boolean('only_my_scope') || $request->boolean('only_my_classes')) {
                $filteredEvents = $allRawEvents->filter(function (AcademicEvent $e) use ($allRelevantClassIds, $allRelevantGrades) {
                    if ($e->scope_type === AcademicEvent::SCOPE_ALL) {
                        return true;
                    }
                    if ($e->scope_type === AcademicEvent::SCOPE_GRADE) {
                        $targets = array_map(fn($t) => $this->exclusionService->normalizeGrade($t), $e->scope_targets ?? []);
                        return !empty(array_intersect($targets, $allRelevantGrades));
                    }
                    if ($e->scope_type === AcademicEvent::SCOPE_CLASS) {
                        $targets = array_map('intval', $e->scope_targets ?? []);
                        return !empty(array_intersect($targets, $allRelevantClassIds));
                    }
                    return false;
                })->values();
            } else {
                $filteredEvents = $allRawEvents;
            }

            // Hitung status mengajar harian guru
            $dailyTeachingStatus = $this->exclusionService->evaluateDailyTeachingStatus(
                $user,
                $schedules,
                $startDate,
                $endDate
            );

        } elseif ($role === 'student') {
            // Siswa
            $studentClass = $user->schoolClass;
            $classId = $studentClass?->id;
            $gradeLevel = $studentClass?->level ? $this->exclusionService->normalizeGrade($studentClass->level) : '10';

            if ($studentClass) {
                $context['student'] = [
                    'id' => $user->id,
                    'name' => $user->name,
                    'class_id' => $studentClass->id,
                    'class_name' => $studentClass->name,
                    'level' => $gradeLevel,
                ];

                $filteredEvents = $allRawEvents->filter(function (AcademicEvent $e) use ($studentClass, $gradeLevel) {
                    return $this->exclusionService->isEventApplicableToClass($e, $studentClass->id, $gradeLevel);
                })->values();
            } else {
                $filteredEvents = $allRawEvents->filter(fn(AcademicEvent $e) => $e->scope_type === AcademicEvent::SCOPE_ALL)->values();
            }

        } elseif ($role === 'parent') {
            // Orang Tua
            $children = $user->getLinkedStudents();

            if ($request->filled('child_id')) {
                $targetChildId = $request->integer('child_id');
                $selectedChild = $children->firstWhere('id', $targetChildId);

                if (!$selectedChild) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Akses ditolak. Anda tidak memiliki akses ke data siswa tersebut.',
                    ], 403);
                }

                $childClass = $selectedChild->schoolClass;
                $cId = $childClass?->id;
                $gLevel = $childClass?->level ? $this->exclusionService->normalizeGrade($childClass->level) : '10';

                $filteredEvents = $allRawEvents->filter(function (AcademicEvent $e) use ($cId, $gLevel) {
                    if (!$cId) return $e->scope_type === AcademicEvent::SCOPE_ALL;
                    return $this->exclusionService->isEventApplicableToClass($e, $cId, $gLevel);
                })->values();

            } else {
                // Semua agenda yang relevan bagi seluruh anak orang tua ini
                $filteredEvents = $allRawEvents->filter(function (AcademicEvent $e) use ($children) {
                    if ($e->scope_type === AcademicEvent::SCOPE_ALL) return true;
                    foreach ($children as $ch) {
                        if ($ch->class_id && $this->exclusionService->isEventApplicableToClass($e, $ch->class_id, $ch->schoolClass?->level ?? 10)) {
                            return true;
                        }
                    }
                    return false;
                })->values();
            }

            $context['children'] = $children->map(fn($ch) => [
                'id' => $ch->id,
                'name' => $ch->name,
                'nis' => $ch->nis_nip,
                'class_id' => $ch->class_id,
                'class_name' => $ch->schoolClass?->name ?? 'Belum Ditentukan',
                'level' => $ch->schoolClass?->level ? $this->exclusionService->normalizeGrade($ch->schoolClass->level) : '10',
            ])->toArray();
        }

        // 3. Format & Perkayaan Atribut Event
        $transformedEvents = $filteredEvents->map(function (AcademicEvent $e) use ($role, $user, $classTargetMap, $context) {
            $item = $e->toArray();

            // Sediakan daftar target_classes terformat jika scope_type = 'class'
            if ($e->scope_type === AcademicEvent::SCOPE_CLASS && !empty($e->scope_targets)) {
                $targets = array_map('intval', $e->scope_targets);
                $item['target_classes'] = collect($targets)
                    ->map(fn($id) => $classTargetMap->get($id))
                    ->filter()
                    ->values()
                    ->toArray();
            } else {
                $item['target_classes'] = [];
            }

            // Panduan Kehadiran
            $item['attendance_guidance'] = $this->exclusionService->getAttendanceGuidance($e);

            // Perhitungan Dampak Mengajar bagi Guru
            if ($role === 'teacher') {
                $affectsMyTeaching = false;
                $affectedClasses = [];

                if ((bool) $e->disables_teaching) {
                    $taughtClasses = $context['taught_classes'] ?? [];
                    foreach ($taughtClasses as $tc) {
                        $tcId = (int) $tc['id'];
                        $tcLevel = $tc['level'];

                        if ($this->exclusionService->isEventApplicableToClass($e, $tcId, $tcLevel)) {
                            $schedules = Schedule::where('teacher_id', $user->id)
                                ->where('class_id', $tcId)
                                ->get();

                            $hasMatchingDay = false;
                            $eStart = Carbon::parse($e->start_date);
                            $eEnd = Carbon::parse($e->end_date);
                            $period = CarbonPeriod::create($eStart, $eEnd);

                            foreach ($period as $pDate) {
                                $isoDay = (int) $pDate->dayOfWeekIso;
                                if ($schedules->contains(fn($s) => (int) $s->day_of_week === $isoDay)) {
                                    $hasMatchingDay = true;
                                    break;
                                }
                            }

                            if ($hasMatchingDay) {
                                $affectsMyTeaching = true;
                                $affectedClasses[] = $tc['name'];
                            }
                        }
                    }
                }

                $item['affects_my_teaching'] = $affectsMyTeaching;
                $item['affected_my_classes'] = array_values(array_unique($affectedClasses));

                // Hitung is_my_scope untuk visualisasi guru & kesiswaan
                $isMyScope = false;
                if ($e->scope_type === AcademicEvent::SCOPE_ALL) {
                    $isMyScope = true;
                } elseif ($e->scope_type === AcademicEvent::SCOPE_GRADE) {
                    $relGrades = $context['relevant_grades'] ?? [];
                    $targets = array_map(fn($t) => $this->exclusionService->normalizeGrade($t), $e->scope_targets ?? []);
                    $isMyScope = !empty(array_intersect($targets, $relGrades));
                } elseif ($e->scope_type === AcademicEvent::SCOPE_CLASS) {
                    $relClassIds = $context['relevant_class_ids'] ?? [];
                    $targets = array_map('intval', $e->scope_targets ?? []);
                    $isMyScope = !empty(array_intersect($targets, $relClassIds));
                }
                $item['is_my_scope'] = $isMyScope;
            } else {
                $item['affects_my_teaching'] = false;
                $item['affected_my_classes'] = [];
                $item['is_my_scope'] = true;
            }

            // Tagging Multi-Anak untuk Orang Tua
            if ($role === 'parent') {
                $applicableChildren = [];
                $children = $context['children'] ?? [];

                foreach ($children as $ch) {
                    if ($e->scope_type === AcademicEvent::SCOPE_ALL) {
                        $applicableChildren[] = [
                            'id' => $ch['id'],
                            'name' => $ch['name'],
                            'class_name' => $ch['class_name'],
                            'tag_label' => "Anak - {$ch['name']} ({$ch['class_name']})",
                        ];
                    } elseif (!empty($ch['class_id']) && $this->exclusionService->isEventApplicableToClass($e, $ch['class_id'], $ch['level'])) {
                        $applicableChildren[] = [
                            'id' => $ch['id'],
                            'name' => $ch['name'],
                            'class_name' => $ch['class_name'],
                            'tag_label' => "Anak - {$ch['name']} ({$ch['class_name']})",
                        ];
                    }
                }
                $item['applicable_children'] = $applicableChildren;
            } else {
                $item['applicable_children'] = [];
            }

            return $item;
        });

        // Filter opsi only_affects_my_teaching untuk guru
        if ($role === 'teacher' && $request->boolean('only_affects_my_teaching')) {
            $transformedEvents = $transformedEvents->filter(function ($item) {
                return (bool) ($item['affects_my_teaching'] ?? false) || ($item['type'] === AcademicEvent::TYPE_HOLIDAY && $item['scope_type'] === AcademicEvent::SCOPE_ALL);
            })->values();
        }

        // Summary KPI
        $holidayCount = $transformedEvents->filter(fn($e) => $e['type'] === AcademicEvent::TYPE_HOLIDAY)->count();
        $classEventCount = $transformedEvents->filter(fn($e) => $e['type'] === AcademicEvent::TYPE_CLASS_EVENT || $e['type'] === AcademicEvent::TYPE_SCHOOL_EVENT)->count();
        $examCount = $transformedEvents->filter(fn($e) => $e['type'] === AcademicEvent::TYPE_EXAM)->count();
        $affectingCount = $transformedEvents->filter(fn($e) => !empty($e['affects_my_teaching']))->count();

        return response()->json([
            'success' => true,
            'message' => 'Kalender akademik berhasil dimuat.',
            'data' => [
                'role' => $role,
                'can_manage' => $role === 'vice_principal',
                'period' => [
                    'month' => $month,
                    'year' => $year,
                    'start_date' => $startStr,
                    'end_date' => $endStr,
                ],
                'context' => $context,
                'summary' => [
                    'total_events' => $transformedEvents->count(),
                    'holiday_count' => $holidayCount,
                    'special_event_count' => $classEventCount,
                    'exam_count' => $examCount,
                    'affecting_teaching_count' => $affectingCount,
                ],
                'daily_teaching_status' => (object) $dailyTeachingStatus,
                'events' => $transformedEvents->values(),
            ],
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
    public function show(Request $request, int|string $id): JsonResponse
    {
        $event = AcademicEvent::with('creator:id,name,role')->find($id);

        if (!$event) {
            return response()->json([
                'success' => false,
                'message' => 'Agenda kalender akademik tidak ditemukan.',
            ], 404);
        }

        $user = $request->user();
        if ($user && $user->role === 'student') {
            if ($event->scope_type !== AcademicEvent::SCOPE_ALL) {
                if (!$user->class_id || !$this->exclusionService->isEventApplicableToClass($event, $user->class_id, $user->schoolClass?->level ?? 10)) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Akses ditolak. Anda tidak memiliki izin untuk melihat agenda kelas ini.',
                    ], 403);
                }
            }
        } elseif ($user && $user->role === 'parent') {
            if ($event->scope_type !== AcademicEvent::SCOPE_ALL) {
                $children = $user->getLinkedStudents();
                $isAllowed = false;
                foreach ($children as $ch) {
                    if ($ch->class_id && $this->exclusionService->isEventApplicableToClass($event, $ch->class_id, $ch->schoolClass?->level ?? 10)) {
                        $isAllowed = true;
                        break;
                    }
                }
                if (!$isAllowed) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Akses ditolak. Anda tidak memiliki izin untuk melihat agenda kelas ini.',
                    ], 403);
                }
            }
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
