CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091236_InitialAccounts') THEN
    CREATE TABLE accounts (
        "Id" uuid NOT NULL,
        "DisplayName" character varying(80) NOT NULL,
        "Username" character varying(30),
        "NormalizedUsername" character varying(30),
        "Email" character varying(320),
        "NormalizedEmail" character varying(320),
        "EmailVerified" boolean NOT NULL,
        "AvatarUrl" character varying(2048),
        "Origin" character varying(20) NOT NULL,
        "Roles" character varying(80) NOT NULL,
        "Disabled" boolean NOT NULL,
        "ProfileJson" text NOT NULL,
        "Revision" integer NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "PK_accounts" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091236_InitialAccounts') THEN
    CREATE TABLE app_sessions (
        "TokenHash" character varying(64) NOT NULL,
        "AccountId" uuid NOT NULL,
        "Audience" character varying(5) NOT NULL,
        "ExpiresAt" timestamp with time zone NOT NULL,
        "RevokedAt" timestamp with time zone,
        CONSTRAINT "PK_app_sessions" PRIMARY KEY ("TokenHash"),
        CONSTRAINT "FK_app_sessions_accounts_AccountId" FOREIGN KEY ("AccountId") REFERENCES accounts ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091236_InitialAccounts') THEN
    CREATE TABLE external_identities (
        "Id" uuid NOT NULL,
        "AccountId" uuid NOT NULL,
        "Provider" character varying(32) NOT NULL,
        "Project" character varying(128) NOT NULL,
        "Subject" character varying(128) NOT NULL,
        "Method" character varying(32) NOT NULL,
        CONSTRAINT "PK_external_identities" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_external_identities_accounts_AccountId" FOREIGN KEY ("AccountId") REFERENCES accounts ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091236_InitialAccounts') THEN
    CREATE TABLE local_credentials (
        "AccountId" uuid NOT NULL,
        "PasswordHash" text NOT NULL,
        CONSTRAINT "PK_local_credentials" PRIMARY KEY ("AccountId"),
        CONSTRAINT "FK_local_credentials_accounts_AccountId" FOREIGN KEY ("AccountId") REFERENCES accounts ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091236_InitialAccounts') THEN
    CREATE UNIQUE INDEX "IX_accounts_NormalizedEmail" ON accounts ("NormalizedEmail");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091236_InitialAccounts') THEN
    CREATE UNIQUE INDEX "IX_accounts_NormalizedUsername" ON accounts ("NormalizedUsername");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091236_InitialAccounts') THEN
    CREATE INDEX "IX_app_sessions_AccountId_Audience" ON app_sessions ("AccountId", "Audience");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091236_InitialAccounts') THEN
    CREATE INDEX "IX_external_identities_AccountId" ON external_identities ("AccountId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091236_InitialAccounts') THEN
    CREATE UNIQUE INDEX "IX_external_identities_Provider_Project_Subject" ON external_identities ("Provider", "Project", "Subject");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091236_InitialAccounts') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261010091236_InitialAccounts', '10.0.11');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091801_CatalogEnrollment') THEN
    ALTER TABLE accounts ADD "CreatedBy" uuid;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091801_CatalogEnrollment') THEN
    CREATE TABLE courses (
        "Id" uuid NOT NULL,
        "Slug" character varying(200) NOT NULL,
        "Title" character varying(200) NOT NULL,
        "Subtitle" text,
        "CoverUrl" text,
        "Category" text NOT NULL,
        "Level" text NOT NULL,
        "PriceMinor" integer,
        "Status" character varying(32) NOT NULL,
        "PublishedAt" timestamp with time zone,
        "Description" text,
        "OutcomesJson" text NOT NULL,
        "InstructorId" uuid NOT NULL,
        CONSTRAINT "PK_courses" PRIMARY KEY ("Id"),
        CONSTRAINT ck_course_price CHECK ("PriceMinor" IS NULL OR "PriceMinor" >= 0),
        CONSTRAINT "FK_courses_accounts_InstructorId" FOREIGN KEY ("InstructorId") REFERENCES accounts ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091801_CatalogEnrollment') THEN
    CREATE TABLE course_chapters (
        "Id" uuid NOT NULL,
        "CourseId" uuid NOT NULL,
        "Title" text NOT NULL,
        "Position" integer NOT NULL,
        CONSTRAINT "PK_course_chapters" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_course_chapters_courses_CourseId" FOREIGN KEY ("CourseId") REFERENCES courses ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091801_CatalogEnrollment') THEN
    CREATE TABLE enrollments (
        "Id" uuid NOT NULL,
        "AccountId" uuid NOT NULL,
        "CourseId" uuid NOT NULL,
        "Source" text NOT NULL,
        "GrantedAt" timestamp with time zone NOT NULL,
        "CompletedItems" integer NOT NULL,
        "CompletedAt" timestamp with time zone,
        CONSTRAINT "PK_enrollments" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_enrollments_accounts_AccountId" FOREIGN KEY ("AccountId") REFERENCES accounts ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_enrollments_courses_CourseId" FOREIGN KEY ("CourseId") REFERENCES courses ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091801_CatalogEnrollment') THEN
    CREATE TABLE course_items (
        "Id" uuid NOT NULL,
        "ChapterId" uuid NOT NULL,
        "Title" text NOT NULL,
        "Type" text NOT NULL,
        "Position" integer NOT NULL,
        CONSTRAINT "PK_course_items" PRIMARY KEY ("Id"),
        CONSTRAINT ck_item_type CHECK ("Type" IN ('article','video','quiz')),
        CONSTRAINT "FK_course_items_course_chapters_ChapterId" FOREIGN KEY ("ChapterId") REFERENCES course_chapters ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091801_CatalogEnrollment') THEN
    CREATE UNIQUE INDEX "IX_course_chapters_CourseId_Position" ON course_chapters ("CourseId", "Position");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091801_CatalogEnrollment') THEN
    CREATE UNIQUE INDEX "IX_course_items_ChapterId_Position" ON course_items ("ChapterId", "Position");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091801_CatalogEnrollment') THEN
    CREATE INDEX "IX_courses_InstructorId" ON courses ("InstructorId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091801_CatalogEnrollment') THEN
    CREATE UNIQUE INDEX "IX_courses_Slug" ON courses ("Slug");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091801_CatalogEnrollment') THEN
    CREATE UNIQUE INDEX "IX_enrollments_AccountId_CourseId" ON enrollments ("AccountId", "CourseId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091801_CatalogEnrollment') THEN
    CREATE INDEX "IX_enrollments_CourseId" ON enrollments ("CourseId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010091801_CatalogEnrollment') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261010091801_CatalogEnrollment', '10.0.11');
    END IF;
END $EF$;
COMMIT;
