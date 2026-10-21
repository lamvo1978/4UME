using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FourUme.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AiConversation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ConversationScenarios",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Level = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    TitleVi = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Icon = table.Column<string>(type: "character varying(48)", maxLength: 48, nullable: false),
                    Situation = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: false),
                    AiRole = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    GoalVi = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Opening = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    KeyPhrases = table.Column<List<string>>(type: "text[]", nullable: false),
                    Published = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConversationScenarios", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Conversations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScenarioId = table.Column<Guid>(type: "uuid", nullable: true),
                    Level = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EndedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LearnerTurns = table.Column<int>(type: "integer", nullable: false),
                    Score = table.Column<int>(type: "integer", nullable: true),
                    Summary = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Conversations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Conversations_ConversationScenarios_ScenarioId",
                        column: x => x.ScenarioId,
                        principalTable: "ConversationScenarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Conversations_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ConversationTurns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ConversationId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Index = table.Column<int>(type: "integer", nullable: false),
                    FromLearner = table.Column<bool>(type: "boolean", nullable: false),
                    Text = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Correction = table.Column<string>(type: "jsonb", nullable: true),
                    HintVi = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Suggestions = table.Column<string>(type: "jsonb", nullable: true),
                    LocalDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TtsChars = table.Column<int>(type: "integer", nullable: false),
                    TtsPaid = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConversationTurns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConversationTurns_Conversations_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "Conversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_ScenarioId",
                table: "Conversations",
                column: "ScenarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_StartedAt",
                table: "Conversations",
                column: "StartedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_UserId_StartedAt",
                table: "Conversations",
                columns: new[] { "UserId", "StartedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ConversationScenarios_Level_Published",
                table: "ConversationScenarios",
                columns: new[] { "Level", "Published" });

            migrationBuilder.CreateIndex(
                name: "IX_ConversationTurns_ConversationId_Index",
                table: "ConversationTurns",
                columns: new[] { "ConversationId", "Index" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ConversationTurns_CreatedAt",
                table: "ConversationTurns",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ConversationTurns_UserId_LocalDate",
                table: "ConversationTurns",
                columns: new[] { "UserId", "LocalDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ConversationTurns");

            migrationBuilder.DropTable(
                name: "Conversations");

            migrationBuilder.DropTable(
                name: "ConversationScenarios");
        }
    }
}
