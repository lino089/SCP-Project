<?php

namespace Tests\Unit;

use App\Models\User;
use App\Services\TeacherMatcherService;
use PHPUnit\Framework\TestCase;

class TeacherMatcherTest extends TestCase
{
    private TeacherMatcherService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new TeacherMatcherService();
    }

    public function test_extract_core_name()
    {
        $this->assertEquals('MUHAMMAD FAUZI', $this->service->extractCoreName('MUHAMMAD FAUZI, S.Pd.'));
        $this->assertEquals('MUHAMAD FAUZI', $this->service->extractCoreName('MUHAMAD FAUZI, M.S.I.'));
        $this->assertEquals('ENDANG WIDIASTUTI', $this->service->extractCoreName('Dra. ENDANG WIDIASTUTI, M.Pd.'));
        $this->assertEquals('ACHMAD ROZIQIN', $this->service->extractCoreName('H. ACHMAD ROZIQIN, S.Kom.'));
        $this->assertEquals('TATIK HERAWATI', $this->service->extractCoreName('TATIK HERAWATI, S.Pd'));
        $this->assertEquals('TATIK WARDAYATI', $this->service->extractCoreName('14.TATIK WARDAYATI, S.Pd.'));
        $this->assertEquals('TATIK HERAWATI', $this->service->extractCoreName('29. TATIK HERAWATI, S.Pd'));
    }

    public function test_phonetic_normalization()
    {
        $this->assertEquals('muhamad fauzi', $this->service->normalizePhonetic('MUHAMMAD FAUZI'));
        $this->assertEquals('muhamad fauzi', $this->service->normalizePhonetic('MUHAMAD FAUZI'));
        $this->assertEquals('ahmad roziqin', $this->service->normalizePhonetic('ACHMAD ROZIQIN'));
        $this->assertEquals('ahmad roziqin', $this->service->normalizePhonetic('AHMAD ROZIQIN'));
    }

    public function test_matching_with_candidates()
    {
        $mockTeacher = new User([
            'name' => 'MUHAMAD FAUZI, M.S.I.',
            'nis_nip' => '198005122005011002',
        ]);
        $mockTeacher->id = 14;

        $teachers = collect([$mockTeacher]);

        // Input from PDF: "MUHAMMAD FAUZI, S.Pd."
        $result = $this->service->match($teachers, 'MUHAMMAD FAUZI, S.Pd.');

        // Since it's not exact full match, matched_teacher is null (awaits Waka choice)
        $this->assertNull($result['matched_teacher']);
        $this->assertCount(1, $result['candidates']);
        $this->assertEquals(14, $result['candidates'][0]['id']);
        $this->assertGreaterThanOrEqual(95.0, $result['candidates'][0]['similarity']);
    }

    public function test_known_alias_matching()
    {
        $teacherWarastitin = new User([
            'name' => 'WARASTITIN ILMIAWATI, S.Pd',
            'nis_nip' => '197507062006042023',
        ]);
        $teacherWarastitin->id = 29;

        $teacherTatikW = new User([
            'name' => 'TATIK WARDAYATI, S.Pd',
            'nis_nip' => '197311152002122005',
        ]);
        $teacherTatikW->id = 14;

        $teachers = collect([$teacherWarastitin, $teacherTatikW]);

        $result = $this->service->match($teachers, '29.TATIK HERAWATI, S.Pd');

        $this->assertNull($result['matched_teacher']);
        $this->assertNotEmpty($result['candidates']);
        // Top candidate must be WARASTITIN ILMIAWATI via known alias
        $this->assertEquals(29, $result['candidates'][0]['id']);
        $this->assertEquals(98.0, $result['candidates'][0]['similarity']);
        $this->assertStringContainsString('WARASTITIN ILMIAWATI', $result['candidates'][0]['match_reason']);
    }

    public function test_jaccard_word_ranking_prevents_subset_name_outscoring()
    {
        $singleWordTeacher = new User([
            'name' => 'WAHYUNI, S.Pd.',
            'nis_nip' => '197001011990012001',
        ]);
        $singleWordTeacher->id = 10;

        $multiWordTeacher = new User([
            'name' => 'THERECIA INDRI WAHYUNI, S.Pd',
            'nis_nip' => '198501012010012002',
        ]);
        $multiWordTeacher->id = 20;

        $teachers = collect([$multiWordTeacher, $singleWordTeacher]);

        // Input with different title punctuation: "WAHYUNI, S.Pd"
        $result = $this->service->match($teachers, 'WAHYUNI, S.Pd');

        $this->assertNull($result['matched_teacher']);
        $this->assertNotEmpty($result['candidates']);
        // Top candidate must be WAHYUNI, S.Pd. (id 10), NOT THERECIA INDRI WAHYUNI (id 20)
        $this->assertEquals(10, $result['candidates'][0]['id']);
        $this->assertEquals(98.0, $result['candidates'][0]['similarity']);
    }
}
