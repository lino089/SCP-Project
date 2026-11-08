<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Safety Guard: Testing MUST NEVER touch production database db_scp
        $defaultConn = config('database.default');
        $dbName = config("database.connections.{$defaultConn}.database");

        if ($defaultConn === 'pgsql' && $dbName === 'db_scp') {
            throw new \RuntimeException(
                "CRITICAL SAFETY GUARD: Test suite attempted to run against production database 'db_scp'! Aborting test execution to protect data."
            );
        }
    }
}
