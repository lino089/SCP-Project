<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('scp:prune-failed-imports')->dailyAt('01:00');
Schedule::command('scp:prune-graduated-students')->dailyAt('02:00');
Schedule::command('scp:prune-expired-otps')->dailyAt('03:00');