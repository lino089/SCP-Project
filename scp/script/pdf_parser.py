import sys
import os
import json
import re

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

def normalize_class_name(raw):
    if not raw:
        return ""
    s = raw.replace("\n", " ").strip()
    s = re.sub(r'\s+', ' ', s)
    s = re.sub(r'^10\b|^10\s+', 'X ', s)
    s = re.sub(r'^11\b|^11\s+', 'XI ', s)
    s = re.sub(r'^12\b|^12\s+', 'XII ', s)
    m = re.match(r'^(X|XI|XII)\s*([A-Za-z]+)\s*(\d*)$', s)
    if m:
        level, major, num = m.groups()
        if num:
            return f"{level} {major.upper()} {num}"
        else:
            return f"{level} {major.upper()}"
    return s

def normalize_room_code(code):
    if not code:
        return None
    c = code.replace("\n", " ").strip().upper()
    c = re.sub(r'\s+', ' ', c)
    m = re.match(r'^(?:LAB\.?|L\.)\s*(\d+)$', c)
    if m:
        return f"L.{m.group(1)}"
    if c in ["OR", "OR1", "OR2", "OR3", "LAPANGAN"]:
        return "OR"
    if c in ["LAB IPA", "L.IPA", "LAB.IPA"]:
        return "L.IPA"
    if c in ["LAB PB", "L.PB", "LAB.PB"]:
        return "L.PB"
    return c

def parse_cell(cell_text):
    if not cell_text or cell_text.strip() in ["-x-", "---", ""]:
        return None
    
    full_text = " ".join([l.strip() for l in cell_text.strip().split("\n") if l.strip()])
    
    # Match teacher with or without closing quote (handles unclosed quotes anomaly without consuming room keyword)
    quote_match = re.search(r'"(\d+)\.?\s*([^"\n\r]+?)(?:"|(?=\s+(?:LAB|L\.|OR\d*|HALL|\d+)\b)|$)', full_text)
    
    fet_staff_id = None
    teacher_name = None
    subject_raw = None
    room_raw = None
    
    if quote_match:
        fet_staff_id = quote_match.group(1).strip()
        teacher_name = quote_match.group(2).strip().strip(',').strip()
        
        # Subject is text before quote
        subject_raw = full_text[:quote_match.start()].strip()
        
        # Room is text after teacher name / quote
        after_text = full_text[quote_match.end():].strip()
        after_text = re.sub(r'^"\s*', '', after_text).strip()
        if after_text:
            room_raw = after_text
    else:
        subject_raw = full_text
        
    return {
        "subject": subject_raw,
        "fet_staff_id": fet_staff_id,
        "teacher": teacher_name,
        "room_kelas": room_raw,
    }

def parse_ruangan_pdf(file_path):
    room_lookup = {}
    day_map = {
        "SENIN": 1,
        "SELASA": 2,
        "RABU": 3,
        "KAMIS": 4,
        "JUMAT": 5
    }
    
    time_table = {}
    
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                header_row_idx = None
                class_columns = {}
                for r_idx, row in enumerate(table):
                    if len(row) >= 4 and (row[0] or "").strip().upper() == "HARI" and (row[1] or "").strip().upper() == "JAM":
                        header_row_idx = r_idx
                        for c_idx in range(3, len(row)):
                            val = row[c_idx]
                            if val:
                                norm = normalize_class_name(val)
                                if norm:
                                    class_columns[c_idx] = norm
                        break
                        
                if header_row_idx is None:
                    continue

                # Deteksi dan sanitasi anomali header FET jenjang Kelas XI:
                # Pola anomali: operator kurikulum menduplikasi tata letak kolom Kelas 12 (4 rombel AK + 1 rombel LPS)
                # ke baris jenjang Kelas 11, sehingga terbaca 'XI AK 4' dan 'XI LPS' tanpa angka.
                # Padahal struktur resmi SMK Negeri 1 Bantul untuk jenjang XI adalah 3 rombel AK (XI AK 1..3)
                # dan 2 rombel LPS (XI LPS 1..2). Kelas XI AK 4 tidak pernah ada.
                col_values = list(class_columns.values())
                if "XI AK 4" in col_values and "XI LPS 1" not in col_values:
                    for c_idx, c_name in list(class_columns.items()):
                        if c_name == "XI AK 4":
                            class_columns[c_idx] = "XI LPS 1"
                        elif c_name == "XI LPS":
                            class_columns[c_idx] = "XI LPS 2"
                    sys.stderr.write(
                        "[PENYELARASAN HEADER FET] Terdeteksi anomali duplikasi tata letak Kelas XII pada kolom jenjang XI: "
                        "kolom '11 AK4' diselaraskan ke alokasi ruang 'XI LPS 1' dan '11 LPS' ke 'XI LPS 2' "
                        "(menjaga kemurnian kelas Akuntansi XI AK 1..3 tetap utuh tanpa rombel hantu XI AK 4).\n"
                    )
                    
                current_day = None
                for row in table[header_row_idx + 1:]:
                    if not row or len(row) < 4:
                        continue
                        
                    c0 = (row[0] or "").replace("\n", " ").strip().upper()
                    if c0 in day_map:
                        current_day = day_map[c0]
                    if not current_day:
                        continue
                        
                    c1 = (row[1] or "").strip().upper()
                    raw_waktu = (row[2] or "").replace("\n", " ").strip() if len(row) > 2 else ""

                    # Catat dan validasi waktu istirahat
                    if c1 == "IST" and raw_waktu:
                        time_table[(current_day, "IST", raw_waktu)] = True
                        continue

                    if not c1.isdigit():
                        continue
                    period_num = int(c1)
                    if period_num < 1 or period_num > 10:
                        continue

                    if raw_waktu:
                        time_table[(current_day, period_num)] = raw_waktu
                        # Peringatan Anomali Selasa Jam Ke-10
                        if current_day == 2 and period_num == 10 and "14.45" in raw_waktu:
                            sys.stderr.write(
                                "[PERINGATAN WAKTU] Selasa Jam Ke-10 tertulis '14.45 - 15.10' di PDF Jadwal Ruangan "
                                "(terdapat jeda kosong 10 menit dari akhir JP 9 pukul 14:35). "
                                "Rekomendasi: Diselaraskan menjadi '14:35 - 15:10' (durasi 35 menit) agar kronologis "
                                "menyambung dari Jam Ke-9 dan konsisten dengan pola jam siang hari Senin.\n"
                            )
                        
                    for c_idx, norm_class in class_columns.items():
                        if c_idx < len(row):
                            room_val = (row[c_idx] or "").replace("\n", " ").strip()
                            if room_val and room_val not in ["-x-", "---", ""]:
                                room_lookup[(norm_class, current_day, period_num)] = room_val
                                
    return room_lookup

def parse_kelas_pdf(file_path, room_lookup):
    schedules = []
    
    with pdfplumber.open(file_path) as pdf:
        for p_idx in range(1, len(pdf.pages)):
            page = pdf.pages[p_idx]
            table = page.extract_table()
            if not table or len(table) < 12:
                continue
                
            raw_class = table[0][1]
            norm_class = normalize_class_name(raw_class)
            if not norm_class:
                continue
                
            days = [table[1][c] for c in range(1, 6)]
            
            for col_idx in range(1, 6):
                day_name = days[col_idx - 1].strip()
                day_of_week = col_idx
                
                curr_entry = None
                curr_start = None
                curr_duration = 0
                
                for row_idx in range(2, 12):
                    period_num = row_idx - 1
                    cell_val = table[row_idx][col_idx]
                    
                    parsed = parse_cell(cell_val)
                    if parsed:
                        if curr_entry:
                            finalize_schedule(curr_entry, norm_class, day_name, day_of_week, curr_start, curr_duration, room_lookup, schedules)
                        curr_entry = parsed
                        curr_start = period_num
                        curr_duration = 1
                    elif cell_val is None:
                        if curr_entry:
                            curr_duration += 1
                    else:
                        if curr_entry:
                            finalize_schedule(curr_entry, norm_class, day_name, day_of_week, curr_start, curr_duration, room_lookup, schedules)
                            curr_entry = None
                            curr_duration = 0
                            
                if curr_entry:
                    finalize_schedule(curr_entry, norm_class, day_name, day_of_week, curr_start, curr_duration, room_lookup, schedules)

    # Cross-check: Deteksi ruangan yang dialokasikan di Jadwal_Ruangan.pdf tetapi tanpa KBM di Jadwal_Kelas.pdf
    scheduled_slots = set()
    for s in schedules:
        for p in range(s["period_number"], s["period_number"] + s["duration_periods"]):
            scheduled_slots.add((s["kelas_mentah"], s["day_of_week"], p))

    day_names_map = {1: "Senin", 2: "Selasa", 3: "Rabu", 4: "Kamis", 5: "Jumat"}
    for (norm_class, day_of_week, period_num), room_val in sorted(room_lookup.items()):
        if (norm_class, day_of_week, period_num) not in scheduled_slots:
            d_name = day_names_map.get(day_of_week, str(day_of_week))
            sys.stderr.write(
                f"[PERINGATAN KONFLIK RUANGAN] Kelas {norm_class} hari {d_name} Jam Ke-{period_num} "
                f"memiliki alokasi ruang '{room_val}' pada Jadwal_Ruangan.pdf, tetapi tidak memiliki kegiatan "
                f"belajar mengajar (mapel kosong '---') di Jadwal_Kelas.pdf. Rekomendasi: Ikuti Jadwal_Kelas "
                f"(kelas pulang lebih awal pada jam tersebut) dan bebaskan ruang '{room_val}'.\n"
            )
                    
    return schedules

def finalize_schedule(entry, norm_class, day_name, day_of_week, start_period, duration, room_lookup, schedules):
    room_jadwal = room_lookup.get((norm_class, day_of_week, start_period))
    room_kelas = entry["room_kelas"]
    
    norm_j = normalize_room_code(room_jadwal) if room_jadwal else None
    norm_k = normalize_room_code(room_kelas) if room_kelas else None
    room_final = norm_j or norm_k
    room_conflict = False
    
    if norm_k and norm_j and norm_k != norm_j:
        room_conflict = True
            
    schedules.append({
        "kelas_mentah": norm_class,
        "hari_mentah": day_name,
        "day_of_week": day_of_week,
        "period_number": start_period,
        "duration_periods": duration,
        "mapel_mentah": entry["subject"],
        "fet_staff_id": entry["fet_staff_id"],
        "guru_mentah": entry["teacher"],
        "ruang_kelas": room_kelas,
        "ruang_jadwal": room_jadwal,
        "ruang_final": room_final,
        "room_source_conflict": room_conflict,
    })

def main():
    if len(sys.argv) < 3:
        sys.stderr.write("Usage: python pdf_parser.py <file_kelas.pdf> <file_ruangan.pdf>\n")
        sys.exit(1)

    file_kelas = sys.argv[1]
    file_ruangan = sys.argv[2]

    if not os.path.exists(file_kelas):
        sys.stderr.write(f"Error: File kelas not found: {file_kelas}\n")
        sys.exit(1)

    if not os.path.exists(file_ruangan):
        sys.stderr.write(f"Error: File ruangan not found: {file_ruangan}\n")
        sys.exit(1)

    if pdfplumber is None:
        sys.stderr.write("Error: pdfplumber is not installed. Silakan jalankan 'pip install -r requirements.txt'.\n")
        sys.exit(1)

    try:
        room_lookup = parse_ruangan_pdf(file_ruangan)
        schedules = parse_kelas_pdf(file_kelas, room_lookup)
        sys.stdout.write(json.dumps(schedules, ensure_ascii=False))
        sys.stdout.flush()
    except Exception as e:
        sys.stderr.write(f"Error parsing PDF: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
