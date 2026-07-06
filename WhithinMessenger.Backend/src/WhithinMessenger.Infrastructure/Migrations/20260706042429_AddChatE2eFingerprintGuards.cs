using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhithinMessenger.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddChatE2eFingerprintGuards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ChatKeyFingerprint",
                table: "ChatE2eWrappedKeys",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            // Migrate legacy sentinel marker rows into the dedicated fingerprint column.
            migrationBuilder.Sql("""
                UPDATE "ChatE2eWrappedKeys" AS target
                SET "ChatKeyFingerprint" = marker."WrappedKeyBase64"
                FROM "ChatE2eWrappedKeys" AS marker
                WHERE marker."ChatId" = target."ChatId"
                  AND marker."DeviceId" = '__chat_key_fingerprint__'
                  AND target."DeviceId" <> '__chat_key_fingerprint__'
                  AND target."ChatKeyFingerprint" IS NULL;
                """);

            migrationBuilder.Sql("""
                DELETE FROM "ChatE2eWrappedKeys"
                WHERE "DeviceId" = '__chat_key_fingerprint__';
                """);

            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION enforce_chat_e2e_fingerprint_consistency()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                DECLARE
                    existing_fp text;
                BEGIN
                    SELECT k."ChatKeyFingerprint"
                    INTO existing_fp
                    FROM "ChatE2eWrappedKeys" k
                    WHERE k."ChatId" = NEW."ChatId"
                      AND k."ChatKeyFingerprint" IS NOT NULL
                      AND NOT (
                        k."ChatId" = NEW."ChatId"
                        AND k."UserId" = NEW."UserId"
                        AND k."DeviceId" = NEW."DeviceId"
                      )
                    LIMIT 1;

                    IF existing_fp IS NULL THEN
                        RETURN NEW;
                    END IF;

                    IF NEW."ChatKeyFingerprint" IS NULL THEN
                        NEW."ChatKeyFingerprint" := existing_fp;
                        RETURN NEW;
                    END IF;

                    IF NEW."ChatKeyFingerprint" <> existing_fp THEN
                        RAISE EXCEPTION 'Conflicting ChatKeyFingerprint for chat %', NEW."ChatId"
                            USING ERRCODE = '23514';
                    END IF;

                    RETURN NEW;
                END;
                $$;
                """);

            migrationBuilder.Sql("""
                DROP TRIGGER IF EXISTS trg_chat_e2e_fingerprint_consistency
                ON "ChatE2eWrappedKeys";
                """);

            migrationBuilder.Sql("""
                CREATE TRIGGER trg_chat_e2e_fingerprint_consistency
                BEFORE INSERT OR UPDATE ON "ChatE2eWrappedKeys"
                FOR EACH ROW
                EXECUTE FUNCTION enforce_chat_e2e_fingerprint_consistency();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TRIGGER IF EXISTS trg_chat_e2e_fingerprint_consistency
                ON "ChatE2eWrappedKeys";
                """);

            migrationBuilder.Sql("""
                DROP FUNCTION IF EXISTS enforce_chat_e2e_fingerprint_consistency();
                """);

            migrationBuilder.DropColumn(
                name: "ChatKeyFingerprint",
                table: "ChatE2eWrappedKeys");
        }
    }
}
