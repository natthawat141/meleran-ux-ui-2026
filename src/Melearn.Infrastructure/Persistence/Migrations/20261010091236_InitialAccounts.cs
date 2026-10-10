using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Melearn.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "accounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Username = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    NormalizedUsername = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    NormalizedEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    EmailVerified = table.Column<bool>(type: "boolean", nullable: false),
                    AvatarUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    Origin = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Roles = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Disabled = table.Column<bool>(type: "boolean", nullable: false),
                    ProfileJson = table.Column<string>(type: "text", nullable: false),
                    Revision = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_accounts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "app_sessions",
                columns: table => new
                {
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Audience = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    RevokedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_app_sessions", x => x.TokenHash);
                    table.ForeignKey(
                        name: "FK_app_sessions_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "external_identities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Provider = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Project = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Subject = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Method = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_external_identities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_external_identities_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "local_credentials",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_local_credentials", x => x.AccountId);
                    table.ForeignKey(
                        name: "FK_local_credentials_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_accounts_NormalizedEmail",
                table: "accounts",
                column: "NormalizedEmail",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_accounts_NormalizedUsername",
                table: "accounts",
                column: "NormalizedUsername",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_app_sessions_AccountId_Audience",
                table: "app_sessions",
                columns: new[] { "AccountId", "Audience" });

            migrationBuilder.CreateIndex(
                name: "IX_external_identities_AccountId",
                table: "external_identities",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_external_identities_Provider_Project_Subject",
                table: "external_identities",
                columns: new[] { "Provider", "Project", "Subject" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "app_sessions");

            migrationBuilder.DropTable(
                name: "external_identities");

            migrationBuilder.DropTable(
                name: "local_credentials");

            migrationBuilder.DropTable(
                name: "accounts");
        }
    }
}
