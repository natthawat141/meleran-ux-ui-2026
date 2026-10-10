using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Melearn.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InstructorGrantAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "InstructorAddedAt",
                table: "accounts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "InstructorAddedBy",
                table: "accounts",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InstructorAddedAt",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "InstructorAddedBy",
                table: "accounts");
        }
    }
}
