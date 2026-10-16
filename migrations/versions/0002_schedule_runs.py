"""Real timetable: repeated stops on a route + scheduled runs.

- route_stops is keyed by (route_id, sequence_number) instead of
  (route_id, stop_id), so a loop can visit a stop twice (it starts and
  ends at TWC).
- route_stops.extension_only marks stops that only the last run before
  a break drives to.
- schedule_runs holds every departure: start time in minutes after
  midnight of the service day (can pass 1440 for after-midnight runs),
  the ISO weekdays it runs (1=Mon .. 7=Sun), and whether it drives the
  extension stops.

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("route_stops_pkey", "route_stops", type_="primary")
    op.create_primary_key(
        "route_stops_pkey", "route_stops", ["route_id", "sequence_number"]
    )
    op.add_column(
        "route_stops",
        sa.Column(
            "extension_only", sa.Boolean, nullable=False,
            server_default=sa.false(),
        ),
    )

    op.create_table(
        "schedule_runs",
        sa.Column("run_id", sa.Integer, primary_key=True),
        sa.Column(
            "route_id", sa.Integer,
            sa.ForeignKey("routes.route_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("start_minutes", sa.Integer, nullable=False),
        sa.Column(
            "service_days", postgresql.ARRAY(sa.SmallInteger), nullable=False
        ),
        sa.Column(
            "includes_extension", sa.Boolean, nullable=False,
            server_default=sa.false(),
        ),
        sa.CheckConstraint(
            "start_minutes >= 0 AND start_minutes < 2880",
            name="ck_schedule_runs_start_minutes",
        ),
    )
    op.create_index(
        "idx_schedule_runs_route", "schedule_runs", ["route_id", "start_minutes"]
    )


def downgrade() -> None:
    # Going back to (route_id, stop_id) only works once no route lists the
    # same stop twice, so clear the repeats first.
    op.drop_index("idx_schedule_runs_route", table_name="schedule_runs")
    op.drop_table("schedule_runs")
    op.execute("""
        DELETE FROM route_stops a USING route_stops b
        WHERE a.route_id = b.route_id AND a.stop_id = b.stop_id
          AND a.sequence_number > b.sequence_number
    """)
    op.drop_column("route_stops", "extension_only")
    op.drop_constraint("route_stops_pkey", "route_stops", type_="primary")
    op.create_primary_key("route_stops_pkey", "route_stops", ["route_id", "stop_id"])