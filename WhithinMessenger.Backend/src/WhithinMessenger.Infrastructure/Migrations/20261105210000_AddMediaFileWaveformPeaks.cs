using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using WhithinMessenger.Infrastructure.Database;

#nullable disable

namespace WhithinMessenger.Infrastructure.Migrations
{
    [DbContext(typeof(WithinDbContext))]
    [Migration("20261105210000_AddMediaFileWaveformPeaks")]
    public partial class AddMediaFileWaveformPeaks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "WaveformPeaks",
                table: "MediaFiles",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "WaveformPeaks",
                table: "MediaFiles");
        }
    }
}
