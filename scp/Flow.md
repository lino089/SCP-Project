# Roadmap Implementasi Sistem Manajemen KBM & Akademik Sekolah

Dokumentasi tahapan pengembangan sistem backend berbasis Laravel, PostgreSQL, dan Python service.

---

## Phase 1: Inisialisasi Proyek, Konfigurasi Lingkungan, & Skema Basis Data Dasar
- [ ] **Sub-phase 1.1**: Penyiapan instalasi framework Laravel dan koneksi PostgreSQL (`.env`, `config/database.php`).
    1. Database setup :
    DB_CONNECTION=postgres
    DB_HOST=127.0.0.1
    DB_PORT=5432
    DB_DATABASE=[nama_database]
    DB_USERNAME=[postgres_username]
    DB_PASSWORD=[postgres_password]
- [ ] **Sub-phase 1.2**: Pengaturan zona waktu aplikasi ke `Asia/Jakarta` (WIB) pada konfigurasi sistem.
    1. Pengaturan zona waktu di config/app.php
     'timezone' => 'Asia/Jakarta'
- [ ] **Sub-phase 1.3**: Pembuatan tabel konfigurasi dinamis (`system_configurations`) untuk parameter operasional sekolah.
    1. Membuat tabel konfigurasi dengan command diterminal php artisan make:migrations SystemConfigurations
      Tabel ini berfungsi untuk menetapkan putaran yang aktif, apakah Jurusan atau Normada serta menetukan apakah minggu ini akan ada upacara atau tidak.
    Tabel ini terdiri dari 4 kolom yaitu :
        - id()
        - active_cycle(int) : karena putaranya hanya dua, sehingga cukup satu angka 1 atau 2 dan tidak perlu tipe ENUM.
        - monday_is_upacara(bool) : untuk menentukan apakah suatu minggu upacara atau tidak (true/false).
        - timestamp()
- [ ] **Sub-phase 1.4**: Konfigurasi template jam pelajaran (`period_templates`) per hari (alokasi jam KBM, istirahat, upacara, dan salat jumat).
    1. Membuat model dan migration baru 'php artisan make:model PeriodTemplate -m'.
    2. Membuat seeder baru 'php artisan make:seeder PeriodTemplateSeeder'.
    3. Isi table period_template :
        - id()
        - enum('day_type', ['senin_upacara', 'senin_reguler', 'selasa', 'rabu_kamis', 'jumat']); -> digunakan untuk menyimpan hari yang memiliki jam khusus.
        - integer('period_number'); -> untuk menetukan minggu jurusan atau normada.
        - time('start_time'); -> untuk menetukan waktu mulai nya jam pelajaran pertama.
        - time('end_time'); -> untuk menentukan waktu selesainya jam pelajaran pertama.
        - timestamps();
    4. Memasukan data untuk tabel period_templates di PeriodTemplateSeeder.php :
    ```php
        DB::table('period_templates')->insert([
            [
                'day_type' => 'senin_upacara',
                'period_number' => 1,
                'start_time' => '08:00:00',
                'end_time' => '08:45:00'
            ],
            [
                'day_type' => 'senin_reguler',
                'period_number' => 1,
                'start_time' => '07:15',
                'end_time' => '08:00:00'
            ],
            [
                'day_type' => 'selasa',
                'period_number' => 1,
                'start_time' => '07:30:00',
                'end_type' => '08:15:00' 
            ],
            [
                'day_type' => 'rabu_kamis',
                'period_number' => 1,
                'start_time' => '07:15:00',
                'end_time' => '08:00:00'
            ],
        ]);
    ```

## Phase 2: Master Data Entitas Akademik
- [ ] **Sub-phase 2.1**: Pembuatan model dan migrasi master kelas (`classes`) dengan penanda tingkatan dan jurusan.
    1. Membuat model dan migrasi 'php artisan make:model Classes -m' untuk menyimpan data kelas
    Berikut adalah isi dari tabel classes
    - id() 
    - string('level'); -> untuk menetukan tingkatan kelas.
    - foreignId('next_class_id')->nullable()->constrained('classes'); -> untuk menentukan tingkatan kelas selanjutnya.
    - timestamps();
- [ ] **Sub-phase 2.2**: Pembuatan model dan migrasi master ruangan (`rooms`) beserta kapasitas dan tipe laboratorium/teori.
    1. Membuat model dan migrasi rooms 'php artisan make:model Room -m' untuk menyimpan data ruangan.
    Berikut adalah isi dari tabel rooms
    - id();
    - string('name'); -> Nama dari ruangan.
    - integer('capacity'); -> untuk menyimpan banyaknya siswa.
    - softDeletes(); -> Soft delete tidak menghapus baris. Laravel hanya mengisi kolom deleted_at dengan waktu penghapusan.
    - timestamps();
- [ ] **Sub-phase 2.3**: Pembuatan model dan migrasi mata pelajaran (`subjects`) beserta kode dan bobot jam.\
    1. Membuat model dan migrasi 'php artisan make:model Subject -m' digunakan untuk menyimpan mata pelajaran.
    berikut adalah isi dari table subjects :
    - id();
    - string('name'); -> menyimpan nama mapel
    - softDeletes(); -> Soft delete tidak menghapus baris. Laravel hanya mengisi kolom deleted_at dengan waktu penghapusan.
    - timestamps();
- [ ] **Sub-phase 2.4**: Penyusunan API CRUD master data untuk kelas, ruangan, dan mata pelajaran.
    1. API CRUD Master Data kelas :
    Endpoint  :
    GET api/classes
    - Membuat SchoolClassController 'php artisan make:controller SchoolClassController.
    - Didalamnya terdapat Method 'index' :
    ``` php
    public function index(Request $request)
    {

        1. Ambil data dari tabel classes
        $classes = SchoolClass::paginate($request->validate([
            'per_page' => 'nullable|integer|min:1|max:100'
        ]));
        - SchoolClass adalah Eloquent model untuk tabel classes.
        - paginate() mengambil data perhalaman dan otomatis menghitung offser serta jumlah halaman.
        - $request->query('per_page', 15) membaca parameter ?per_page= dari URL. Jika tidak dikirim, nilai default-nya 15.
        - validate() memvalidasi minimal halaman yang di ambil.

        2. Menyusun response JSON
        return response()->json([
            'success' => true,
            'message' => 'Data kelas berhasil diambil.',
            'data' => $classes->items(),
            'meta' => [
                'current_page' => $classes->currentPage(),
                'per_page' => $classes->perPage(),
                'total' => $classes->total(),
                'last_page' => $classes->lastPage()
            ]
        ]);

        // meta berisi informasi pagination dengan format yang sama seperti yang ditulis di PRD: current_page, per_page, total, dan last_page. Klien (React atau Flutter) memakai informasi ini untuk membuat navigasi halaman.
    }
    ```
    - Didalam model SchoolClass.php 
    ``` php
    class SchoolClass extends Model
    {
        // Menghubungkan ke tabel classes
        protected $table = 'classes';
    }
    ```
    - didalam file api.php tuliskan ```php Route::get('/classes', [SchoolClassController::class, 'index']);``` didalam group dengan middleware role ' vice_principal '.
    - Untuk melakukan Test gunakan postman. Jalankan dulu php artisan serve, lalu kan masukan url nya beserta api-nya di postman dan pastikan methodnya GET, dan juga gunakan bearer token WAKA. setelah itu jalankan.  

    POST api/classes
    - Didalam SchoolClassController.php terdapat method store :
    ```php
    public function store(Request $request)
    {
        1. Validasi Input.
        $request->validate([
            'name' => 'required|string',
            'level' => 'required|string'
        ]);

        2. Menyimpan Data.
        $schoolClass = SchoolClass::create([
            'name' => $request->name,
            'level' => $request->level
        ]);

        3. Mengembalikan response sukses dalam bentuk JSON.
        return response()->json([
            'success' => true,
            'message' => 'Data berhasil ditambahkan',
            'data' => $schoolClass
        ],201);
    }
    ```
    - di model SchoolClass.php
    ```php
    class SchoolClass extends Model
    {
    
        1. Menghubungkan dengan tabel classes
        protected $table = 'classes';

        2. Melarang mengisi kolom id, selain id di izinkan.
        protected $guarded = ['id'];
    }
    ```
    - Mendaftarkan API di api.php, didalam group middleware dengan role waka ```php Route::post('/classes', [SchoolClassController::class, 'store']);```
    - Untuk melakukan Test gunakan postman. Jalankan dulu php artisan serve, lalu kan masukan url nya beserta api-nya di postman dan pastikan methodnya post, dan juga gunakan bearer token WAKA. Sebelum dijalankan dibagian body->row tuliskan
    ```JSON
    contoh
    {
        "name" : "XI RPL 2",
        "level": "11",
    }
    ```

    PUT api/classes/{id} (Belum Ada).
    
    DELETE api/classes/{id}
    - Didalam SchoolClassController.php terdapat Method destroy.php :
    ```php
    public function destroy($id){
        1. Mencari kelas
        $schoolClass = SchoolClass::findOrFail($id);

        2. Mennghapus data
        $schoolClass->delete();

        3. Mengembalikan response sukses dalam bentuk JSON.
        return response()->json([
            'success' => true,
            'message' => 'Data kelas berhasil dihapus',
            'data' => $schoolClass
        ]);
    }
    ```
    - Didalam model SchoolClass.php
    ```php
    class SchoolClass extends Model
    {
        1. Membuat delete() menjadi softDelete
        use SoftDeletes;
    
        2. Menghubungkan dengan tabel classes
        protected $table = 'classes';

        3. Melarang mengisi kolom id, selain id di izinkan.
        protected $guarded = ['id'];
    }
    ```
    - Mendaftarkan API di api.php, didalam group middleware dengan role waka ```php Route::post('/classes/{id}', [SchoolClassController::class, 'destroy']);```
    - Untuk melakukan Test gunakan postman. Jalankan dulu php artisan serve, lalu kan masukan url "api/classes/{id}" di postman dan pastikan methodnya GET, dan juga gunakan bearer token WAKA. setelah itu jalankan. 

## Phase 3: Autentikasi Pengguna & Manajemen Peran Berbasis Token
- [ ] **Sub-phase 3.1**: Perluasan skema tabel `users` (penambahan `nis_nip`, `role` enum, `linked_student_id` dll).
    1. Penambahan kolom di tabel users
    ```php
    1. Menyimpan Role.
    $table->enum('role', ['vice_principal', 'teacher', 'student', 'parent']);
    2. Menyimpan nis atau nip untuk kredensial login. 
    $table->string('nis_nip')->unique();
    3. Menyimpan ID resmi dari waka.
    $table->string('fet_staff_id')->nullable()->unique();
    4. Memaksa ganti password saat login pertama kali.
    $table->boolean('must_change_password')->default(true);
    5. Untuk login google.
    $table->string('google_id')->nullable();
    6. Nomor telepon.
    $table->string('phone_number')->nullable();
    7. Menghubungkan Akun orang tua dengan anak-nya.
    $table->foreignId('linked_student_id')->nullable();
    8. Kelas siswa.
    $table->foreignId('class_id')->nullable();
    9. Tanggal Kelulusan.
    $table->date('graduation_date')->nullable();
    10. Kolom untuk softDelete.
    $table->softDeletes('deleted_at');
    ```
- [ ] **Sub-phase 3.2**: Implementasi Laravel Sanctum untuk otentikasi berbasis Bearer Token.
    1. Didalam kode AuthController :
    ```php
    public function login(Request $request){
        1. Validasi Input.
        $request->validate([
            'nis_nip' => 'required|string',
            'password' => 'required|string',
            'device_name' => 'required|string'
        ]);

        2. Memeriksa Kredensial.
        - Auth::attempt : mencari user dengan nis_nip
        - Jika data tidak sesuai akan mengembalikan response gagal dalam bentuk JSON 401
        if(!Auth::attempt($request->only('nis_nip', 'password'))){
            return response()->json([
                'success' => false,
                'message' => "Kredensial tidak valid",
                'error' => [
                    'field' => 'NIS/NIP atau Password salah'
                ]
            ], 401);
        }

        3. Mengambil User dan menyimpanya dalam variable $user.
        $user = User::where('nis_nip', $request->nis_nip)->firstOrFail();

        4. Membuat Token.
        - createToken membuat baris di tabel personal_access_tokens.
        - plainTextToken adalah string token yang dikirim ke klien, sedangkan database hanya menyimpan hashnya.
        $token = $user->createToken($request->device_name)->plainTextToken;

        5. Mengembalikan response sukses dalam bentuk JSON.
        return response()->json([
            'success' => true,
            'message' => 'Berhasil Login',
            "data" => $token
        ], 200);
    }
    ```
- [ ] **Sub-phase 3.3**: Pembuatan `RoleMiddleware` untuk membatasi hak akses rute berdasarkan peran (`vice_principal`, `teacher`, `student`, `parent`).
    1. Didalam file Middleware\RoleMiddleware.php
    ```php
    <?php
    namespace App\Http\Middleware;

    use Closure;
    use Illuminate\Http\Request;
    use Symfony\Component\HttpFoundation\Response;

    class RoleMiddleware
    {
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
        1. Method Handle
        - Request $request : request yang masuk.
        - Closure $next : Tahap Berikutnya dalam rantai Middleware.
        - ...$roles : parameter variadic. Laravel mengambil bagian setelah role: di route, lalu memisahkannya dengan koma. Jadi role:vice_principal,teacher menghasilkan $roles = ['vice_principal', 'teacher'].
        public function handle(Request $request, Closure $next, ...$roles)
        {
            2. Pengecekan role
            - $request->user() : Mengambil user yang sudah diauthentikasi sanctum.
            - ?-> : nullsafe operator mencegah error jika user tidak ada.
            - $roles, true : mengecek apakah user terdaftar di $roles.
            - true : membuat perbandingan strict, sehingga tipe data juga dicek.
            if (!in_array($request->user()?->role, $roles, true)){
                3. Mengembalikan response ditolak
                return response()->json([
                    'success' => false,
                    'message' => 'Akses ditolak, anda tidak memiliki izin.',
                    'errors' => ['role' => ['Membutuhkan Privilage yang lebih tinggi.']]
                ], 403);
            }

        4. Request diteruskan. 
        return $next($request);
        }
    }

    ```
- [ ] **Sub-phase 3.4**: Pembuatan endpoint login, registrasi siswa/guru, dan otentikasi profil pengguna aktif (`/api/me`).
    1. Mendaftarkan endpoint `/login`
    -> didalam file api.php
    ```php
    - Mendaftarkan enpoint '/login'.
    Route::post('/login', [AuthController::class, 'login']);
    ```
    -> Untuk melakuakn pengujian menggunakan postman, jalankan `php artisan serve`. lalu masukan url beserta endpoint `api/login`. dan di body->raw tuliskan kode json seperti di bawah, lalu jalankan.
    ```JSON
    Contoh
    {
        "nis_nip" : "142132",
        "password" : "password",
        "device_name" : "Thinkpad"
    }
    ```
    2. Mendaftarkan endpoint `/me`.
    -> didalam AuthController.php
    ```php
    public function me(Request $request){
        1. Mengembalikan response sukses dalam bentuk JSON, dan mengambil data user.
        return response()->json([
            'success' => true,
            'message' => 'Data profil berhasil diambil',
            'data' => $request->user() 
        ], 200);
    }
    ```
    -> Mendaftarkan endpoint `/me` di api.php
    ```php
    1. endpoint `/me` dibungkus middleware untuk memastiskanuser yang mengakses memiliki bearer token.
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
    });
    ```
    3. Mendaftarkan endpoint `logout`.
    -> didalamfile AuthController.
    ```php
    public function logout(Request $request){
        1. Mengambil token yang sedang dipakai, lalu menghapusnya.
        $request->user()->currentAccessToken()->delete();

        2. Mengembalikan response sukses dalam bentuk JSON.
        return response()->json([
            'success' => true,
            'message' => 'Logout Berhasil',
        ], 200);
    }
    ```
    -> Mendaftarkan endpoint `/logout` di api.php
    ```php
    1. endpoint `/logout` dibungkus middleware untuk memastiskanuser yang mengakses memiliki bearer token.
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);

        Route::post('/logout', [AuthController::class, 'logout']);
    });
    ```


## Phase 4: Penugasan Guru Dinamis & Manajemen Siklus (Cycle Management)
- [ ] **Sub-phase 4.1**: Pembuatan skema tabel penugasan struktural guru (`teacher_assignments`) bertipe kesiswaan, wali_kelas, dan piket.
    1. `php artisan make:migration TeacherAssinments 
    2. Kolom :
    ```php
    1. Mengambil foreign key dari tabel user.
    $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
    2. Mentukan Type penugasan.
    $table->enum('type',['kesiswaan', 'wali_kelas']);
    3. Mengambil foreign key dari tabel classes.
    $table->foreignId('class_id')->nullable()->constrained('classes');
    ```
- [ ] **Sub-phase 4.2**: Pembuatan skema tabel riwayat putaran (`cycle_history`) untuk melacak siklus ganjil/genap (Putaran 1 & Putaran 2).
    1. php artisan make:migration CycleHistory
    2. Kolom :
    ```php
    1. Menyimpan riwayat putarn aktif.
    $table->integer('cycle_number');
    2. Kapan putaran itu aktif.
    $table->timestamp('started_at');
    3. Kapan putaran itu selesai.
    $table->timestamp('ended_at')->nullable();
    4. Siapa yang mengganti putaran itu.
    $table->foreignId('changed_by')->constrained('users');
    ```
- [ ] **Sub-phase 4.3**: Pembuatan endpoint konfigurasi aktifasi putaran KBM yang sedang berjalan.
    1. Endpoint GET `/api/academic-settings`
    2. Endpoint PATCH `/api/academic-settings`
    3. Endpoint PATCH `/api/academic-settings/monday-status`
    - File academicSettingController :
    ```php
    public function updateMondayStatus(Request $request)
    {
        1. Validasi Input.
        $request->validate([
            'is_upacara' => 'required|boolean',
            'password' => 'required|string'
        ]);

        2. Konfirmasi Password.
        if (!Hash::check($request->password, $request->user()->password)) {
            return response()->json([
                "success" => false,
                'message' => 'Validasi gagal',
                'errors' => [
                    'password' => ['Password tidak valid.']
                ]
            ], 422);
        }

        3. Mengambil Konfigurasi.
        $config = SystemConfiguration::firstOrFail();
        4. Menyimpan Perubahan.
        $config->update(['monday_is_upacara' => $request->is_upacara]);

        5. Mengembalikan response sukses.
        return response()->json([
            'success' => true,
            'message' => 'Status upacara hari senin berhasil diperbarui.',
            'data' => null
        ]);
    }
    ```
    - Di model SystemConfiguration.php
    ```php
    class SystemConfiguration extends Model
    {
        1. Mengizinkan kedua kolom diisi
        protected $fillable = [
            'active_cycle',
            'monday_is_upacara',
        ];

        protected $casts = [
            'active_cycle' => 'integer',
            'monday_is_upacara' => 'boolean',
        ];
    }
    ```
    4. Endpoint GET `/api/cycle-history`

## Phase 5: Penjadwalan Manual & Deteksi Bentrok Jadwal Real-Time
- [ ] **Sub-phase 5.1**: Pembuatan model dan migrasi tabel jadwal utama (`schedules`) dengan kolom `cycle_type`, `day_of_week`, `period_number`, `duration_periods`, dan `source`.
    1. `php artisan make:model Schedule -m`
    2. Kolom :
    ```php
    1. Foreign key dari tabel users.
    $table->foreignId('teacher_id')->constrained('users');
    2. Foreign key dari tabel classes.
    $table->foreignId('class_id')->constrained('classes');
    3. Foreign key dari tabel subjects
    $table->foreignId('subject_id')->constrained('subjects');
    3. Foreign key dari tabel rooms
    $table->foreignId('room_id')->constrained('rooms');
    4. Hari pelajaran berlangsung.
    $table->integer('day_of_week');
    5. Nomor jam pelajaran.
    $table->integer('period_number');
    6. Jumlah slot yang dipakai jadwal.
    $table->integer('duration_periods')->default(1);
    7. Jenis putaran.
    $table->integer('cycle_type');
    8. Asal jadwal.
    $table->enum('source', ['manual', 'imported']);
    9. ID batch import yang menghasilkan jadwal ini.
    $table->foreignId('import_bacth_id')->nullable();
    10. softdelete.
    $table->softDeletes();
    ```
- [ ] **Sub-phase 5.2**: Logika pengecekan bentrok 3 arah: guru, kelas, dan ruangan pada slot jam yang sama (status `422 Unprocessable Entity`).
    1. Difile ScheduleControler :
    ```php
    public function store(Request $request){
        1. Validasi Input.
        $request->validate( [
            'cycle_type' => 'required|integer',
            'period_number' => 'required|integer',
            'duration_periods' => 'required|integer',
            'teacher_id' => 'required|integer|exists:users,id', 
            'class_id' => 'required|integer|exists:classes,id',
            'room_id' => 'required|integer|exists:rooms,id',
            'subject_id' => 'required|integer|exists:subjects,id',
            'day_of_week' => 'required|integer',
            'source' => 'required|in:manual,imported',
            'password' => 'required|string'
        ]);

        2. Konfirmasi password.
        if(!Hash::check($request->password, $request->user()->password)){
            return response()->json([
                'success' => false,
                'message' => 'konfirmasi gagal',
                'errors' => [
                    'password' => ['Password Salah!!']
                ]
            ], 403);
        }

        3. Menghitung rentang periode
        - Jadwal menempati periode dari $startPeriod sampai $endPeriod, dengan batas akhir inklusif. Contohnya, period_number = 3 dan duration_periods = 2 menghasilkan rentang 3 sampai 4.
        $startPeriod = $request->period_number;
        $endPeriod = $startPeriod + $request->duration_periods - 1;
        
        4. Mengecek bentrok
        Query ini mencari jadwal yang:  
        - berada di Putaran dan hari yang sama,
        - memakai guru, kelas, atau ruangan yang sama (ketiganya dicek dengan OR),
        - rentang periodenya tumpang tindih dengan rentang baru.
        $isConflict = Schedule::where('cycle_type', $request->cycle_type)
        ->where('day_of_week', $request->day_of_week)
        ->where(function ($query) use ($request){
            $query->where('teacher_id', $request->teacher_id)
                ->orWhere('class_id', $request->class_id)
                ->orWhere('room_id', $request->room_id);
        })
        ->where(function ($query) use ($startPeriod, $endPeriod){
            $query->where('period_number', '<=', $endPeriod)
                ->whereRaw('(period_number + duration_periods - 1) >= ?', [$startPeriod]);
        })->exists();

        5. Menolak jika bentrok.
        if($isConflict){
            return response()->json([
                'success' => false,
                'message' => 'Jadwal bentrok!',
                'errors' => ['schedule' => ['Terjadi bentrok guru, kelas atau ruangan pada jam tersebut.']]
            ], 422);
        }

        6. Menyimpan jadwal.
        $newSchedule = Schedule::create([
            'cycle_type' => $request->cycle_type,
            'period_number' => $request->period_number,
            'duration_periods' => $request->duration_periods,
            'teacher_id' => $request->teacher_id,
            'class_id' => $request->class_id,
            'room_id' => $request->room_id,
            'subject_id' => $request->subject_id,
            'day_of_week' => $request->day_of_week,
            'source' => $request->source
        ]);

        7. Mengembalikan response sukses
        return response()->json([
            'success' => true,
            'message' => 'Jadwal berhasil dibuat',
            'data' => $newSchedule
        ], 201);
    }
    ```
- [ ] **Sub-phase 5.3**: Mekanisme proteksi keamanan Password Re-confirmation bagi Waka sebelum penambahan jadwal manual disimpan.
    1. Sudah ada di dalam file ScheduleController di atas.

## Phase 6: Seeding Data Uji & Factory Entitas Sekolah
- [ ] **Sub-phase 6.1**: Pembuatan Factory untuk mock data guru, siswa, kelas, mapel, dan ruangan.
- [ ] **Sub-phase 6.2**: Pembuatan Seeder akun resmi (Waka Kurikulum, Guru Mata Pelajaran, Guru Piket, Staf Kesiswaan, Siswa, dan Orang Tua).
- [ ] **Sub-phase 6.3**: Pengujian konsistensi relasi foreign key pada PostgreSQL.

## Phase 7: Manajemen Jadwal Khusus & Status Upacara
- [ ] **Sub-phase 7.1**: Penyesuaian jadwal pada hari pelaksanaan upacara bendera hari Senin (pergeseran jam awal KBM).
- [ ] **Sub-phase 7.2**: Implementasi toggle status upacara oleh Waka Kurikulum dengan validasi password.

## Phase 8: Impor Jadwal Otomatis dari Berkas PDF (Python + Queue Worker)
- [ ] **Sub-phase 8.1**: Pembuatan skema tabel riwayat impor (`schedule_imports`) dan baris ekstraksi sementara (`schedule_import_rows`).
- [ ] **Sub-phase 8.2**: Endpoint `POST /api/schedule-imports` untuk pengunggahan 2 berkas PDF (jadwal kelas & jadwal ruangan) menggunakan format `multipart/form-data`.
- [ ] **Sub-phase 8.3**: Konfigurasi Queue Worker dan pembuatan job `ParseSchedulePdfJob` untuk pemrosesan latar belakang asinkron.
- [ ] **Sub-phase 8.4**: Integrasi skrip Python berbasis `pdfplumber` via `Symfony\Component\Process` untuk ekstraksi koordinat tabel PDF.
- [ ] **Sub-phase 8.5**: Logika pemetaan kasar (Fuzzy Matching) antara teks mentah PDF dengan ID master data serta penentuan status `matched` / `unmatched`.
- [ ] **Sub-phase 8.6**: Endpoint `GET /api/schedule-imports/{id}` untuk peninjauan (preview) baris hasil parsing oleh Waka.
- [ ] **Sub-phase 8.7**: Endpoint `POST /api/schedule-imports/{id}/confirm` dengan transaksi atomik (`DB::transaction`), soft-delete jadwal lama per putaran, pembersihan berkas fisik PDF, dan pemindahan baris valid ke tabel `schedules`.

## Phase 9: Jurnal KBM Harian & Presensi Berbasis Pengecualian (Exception-Based)
- [ ] **Sub-phase 9.1**: Pembuatan model dan migrasi tabel `journals` (dengan compound unique `['schedule_id', 'date']`) dan tabel `attendances`.
- [ ] **Sub-phase 9.2**: Endpoint `POST /api/journals` untuk membuka sesi kelas KBM menggunakan logika `firstOrCreate()` dan waktu server `Asia/Jakarta`.
- [ ] **Sub-phase 9.3**: Endpoint `POST /api/journals/{id}/attendances` dengan konsep pengecualian: guru hanya mengirim siswa bermasalah (Sakit/Izin/Alpa), sistem otomatis menandai sisa siswa sebagai Hadir.
- [ ] **Sub-phase 9.4**: Integrasi pustaka Intervention Image untuk kompresi foto dokumentasi mengajar (lebar maks 1024px, encode WebP ~75%).
- [ ] **Sub-phase 9.5**: Endpoint `POST /api/journals/{id}/complete` untuk menyimpan ringkasan materi KBM, path foto WebP, dan penguncian status jurnal menjadi `completed`.

## Phase 10: Pengajuan Perizinan Siswa & Sintesis Kehadiran Otomatis
- [ ] **Sub-phase 10.1**: Pembuatan model dan tabel `student_permissions` dengan status `pending`, `approved`, dan `rejected`.
- [ ] **Sub-phase 10.2**: Endpoint `POST /api/permissions` untuk pengajuan izin sakit/dispen oleh siswa atau orang tua dengan unggah bukti surat.

# Rencana Pengembangan Fitur

## Phase 11: Penugasan Guru Pengganti (Substitute Teaching)

### Sub-phase 11.1: Model dan Tabel Penugasan Pengganti
Pembuatan model dan tabel `substitute_assignments` beserta validasi konstrain harian.

### Sub-phase 11.2: Endpoint Penunjukan Guru Pengganti
Endpoint `POST /api/substitutes` bagi Guru Piket untuk menunjuk guru pengganti pada jadwal guru yang berhalangan hadir.

### Sub-phase 11.3: Pendelegasian Wewenang di JournalController
Mengizinkan guru pengganti membuka dan mengisi jurnal jadwal tersebut tanpa penolakan hak akses (403) di `JournalController`.

---

## Phase 12: Kuota, Peringatan Alpa, & Rekapitulasi Presensi Siswa

### Sub-phase 12.1: Rekapitulasi Presensi Siswa
Endpoint `GET /api/students/{id}/attendance-summary` untuk agregasi data kehadiran siswa, meliputi total pertemuan, hadir, sakit, izin, dan alpa. Data hanya diambil dari jurnal yang berstatus `completed`.

### Sub-phase 12.2: Peringatan Alpa
Endpoint `GET /api/attendance-warnings` bagi Wali Kelas dan Kesiswaan. Endpoint ini menggunakan penyaringan agregat `HAVING (total_alpa >= 3)` untuk mendeteksi siswa rawan pembinaan.

---

## Phase 13: Pembuatan Kuis Otomatis Berbasis AI (AI Quiz Generation)

### Sub-phase 13.1: Model dan Tabel Kuis
Pembuatan model dan tabel `quizzes` serta `quiz_questions` bertipe pilihan ganda, dengan kolom `options` (jsonb) dan `correct_answer`.

### Sub-phase 13.2: Background Job Generasi Kuis
Pembuatan job `GenerateQuizJob` yang memanggil skrip Python eksternal untuk merumuskan butir soal berdasarkan ringkasan materi jurnal KBM.

### Sub-phase 13.3: Publikasi Kuis
Endpoint `PATCH /api/quizzes/{id}/publish` untuk mempublikasikan kuis oleh guru dari status draf.

### Sub-phase 13.4: Pengambilan Soal oleh Siswa
Endpoint `GET /api/quizzes/{id}` untuk pengambilan soal oleh siswa, dengan penyembunyian kunci jawaban (masking `correct_answer`) dan gerbang validasi kehadiran siswa.

### Sub-phase 13.5: Model dan Tabel Pengumpulan Kuis
Pembuatan model dan tabel `quiz_submissions` dengan aturan pengerjaan tunggal menggunakan `unique(['quiz_id', 'student_id'])`.

### Sub-phase 13.6: Pengumpulan dan Penilaian Otomatis
Endpoint `POST /api/quizzes/{id}/submit` untuk penilaian otomatis di sisi server (*server-side auto-grading*) dan pencatatan skor dalam skala 0–100.

---

## Phase 14: Rekapitulasi Pelaporan KBM & Ekspor Data

### Sub-phase 14.1: Rekapitulasi KBM per Rentang Tanggal
Endpoint `GET /api/reports/journals` untuk menyajikan rekapitulasi KBM guru per rentang tanggal (`start_date` sampai `end_date`), dengan filter opsional per pengajar.

### Sub-phase 14.2: Optimasi Query Builder
Optimasi query builder dengan *eager loading* multi-level untuk menghindari masalah performa N+1 query pada format laporan eksekutif.