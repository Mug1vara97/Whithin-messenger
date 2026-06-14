using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhithinMessenger.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSavedMessagesChatType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM "ChatTypes" WHERE "TypeName" = 'Saved') THEN
                        IF EXISTS (SELECT 1 FROM "ChatTypes" WHERE "Id" = '55555555-5555-5555-5555-555555555555') THEN
                            UPDATE "ChatTypes"
                            SET "TypeName" = 'Saved'
                            WHERE "Id" = '55555555-5555-5555-5555-555555555555';
                        ELSE
                            INSERT INTO "ChatTypes" ("Id", "TypeName")
                            VALUES ('55555555-5555-5555-5555-555555555555', 'Saved');
                        END IF;
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DELETE FROM "ChatTypes"
                WHERE "Id" = '55555555-5555-5555-5555-555555555555'
                  AND "TypeName" = 'Saved';
                """);
        }
    }
}
