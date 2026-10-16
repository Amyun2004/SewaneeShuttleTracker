"""Real Tiger Transit schedule, transcribed from the printed timetable
(prettier-shuttle-schedules-10-21-24.pdf).

seed.py reads this file, so updating the schedule means editing the
lists below and re-running the seed. Nothing else needs to change.

Times are stored as minutes after midnight of the *service day*. Night
runs that leave after midnight go past 1440 (12:08 am Friday night is
24*60 + 8 = 1448), the same convention GTFS transit feeds use.
"""

# ---------------------------------------------------------------------------
# Stops: (name, latitude, longitude, description)
# TODO: placeholder coordinates around campus center, replace with the
#       real pickup spots.
# ---------------------------------------------------------------------------
STOPS = [
    ("TWC Parking Lot",                  35.204600, -85.921300, "Every loop starts and ends here."),
    ("Gorgas / Quintard",                35.205600, -85.921300, None),
    ("Classics House",                   35.205500, -85.920600, "Stop is near the Classics House."),
    ("Hodgson Hill",                     35.205100, -85.920100, None),
    ("Biehl Commons",                    35.204500, -85.919900, None),
    ("Fowler",                           35.203900, -85.920200, None),
    ("French House",                     35.203500, -85.920800, None),
    ("Woodlands",                        35.203300, -85.921500, None),
    ("Crafting Guild / Fine Arts Houses", 35.203500, -85.922200, None),
    ("Tennis Courts",                    35.203900, -85.922800, None),
    ("Zone C Parking Lot",               35.204500, -85.923100, None),
    ("Trezvant",                         35.205100, -85.923000, None),
    ("Humphreys",                        35.205600, -85.922600, None),
    ("The BC",                           35.206000, -85.922000, None),
    ("Wellness Commons",                 35.206300, -85.921300, None),
    ("Village (near Regions Bank)",      35.206600, -85.920500, None),
]

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
DAYTIME = "Daytime Loop"
NIGHT = "Night Route"

ROUTES = [
    (DAYTIME, "Monday to Friday, every 30 minutes from 7:18 am, with breaks "
              "during the day. The last loop before each break continues "
              "on to Biehl Commons."),
    (NIGHT,   "Thursday 9:08 to 11:37 pm. Friday and Saturday 9:08 pm to 1:07 am."),
]

# Stops in order with minutes after the run leaves TWC.
# The loop starts and ends at TWC, so it appears twice.
DAYTIME_STOPS = [
    ("TWC Parking Lot", 0),
    ("Gorgas / Quintard", 2),
    ("Classics House", 3),
    ("Hodgson Hill", 5),
    ("Biehl Commons", 7),
    ("Fowler", 8),
    ("French House", 11),
    ("Woodlands", 12),
    ("Crafting Guild / Fine Arts Houses", 13),
    ("Tennis Courts", 15),
    ("Zone C Parking Lot", 17),
    ("Trezvant", 18),
    ("Humphreys", 20),
    ("The BC", 22),
    ("Wellness Commons", 24),
    ("Village (near Regions Bank)", 26),
    ("TWC Parking Lot", 29),
]

# Only the last run before each break drives these (extension_only=True).
DAYTIME_EXTENSION = [
    ("Gorgas / Quintard", 30),
    ("Classics House", 31),
    ("Hodgson Hill", 33),
    ("Biehl Commons", 35),
]

# Night offsets differ from daytime at Gorgas, Fowler and Trezvant.
NIGHT_STOPS = [
    ("TWC Parking Lot", 0),
    ("Gorgas / Quintard", 3),
    ("Classics House", 4),
    ("Hodgson Hill", 5),
    ("Biehl Commons", 7),
    ("Fowler", 9),
    ("French House", 11),
    ("Woodlands", 12),
    ("Crafting Guild / Fine Arts Houses", 13),
    ("Tennis Courts", 15),
    ("Zone C Parking Lot", 17),
    ("Trezvant", 19),
    ("Humphreys", 20),
    ("The BC", 22),
    ("Wellness Commons", 24),
    ("Village (near Regions Bank)", 26),
    ("TWC Parking Lot", 29),
]

# ---------------------------------------------------------------------------
# Runs: (route, start minute, ISO weekdays 1=Mon..7=Sun, includes_extension)
# ---------------------------------------------------------------------------
MON_FRI = [1, 2, 3, 4, 5]
THU_FRI_SAT = [4, 5, 6]
FRI_SAT = [5, 6]


def hm(hour: int, minute: int) -> int:
    """24-hour clock to minutes after midnight."""
    return hour * 60 + minute


RUNS = [
    # Morning block
    (DAYTIME, hm(7, 18),  MON_FRI, False),
    (DAYTIME, hm(7, 48),  MON_FRI, False),
    (DAYTIME, hm(8, 18),  MON_FRI, False),
    (DAYTIME, hm(8, 48),  MON_FRI, False),
    (DAYTIME, hm(9, 18),  MON_FRI, False),
    (DAYTIME, hm(9, 48),  MON_FRI, True),
    # Late morning
    (DAYTIME, hm(11, 18), MON_FRI, False),
    (DAYTIME, hm(11, 48), MON_FRI, True),
    # Early afternoon
    (DAYTIME, hm(13, 18), MON_FRI, False),
    (DAYTIME, hm(13, 48), MON_FRI, True),
    # Late afternoon
    (DAYTIME, hm(15, 18), MON_FRI, False),
    (DAYTIME, hm(15, 48), MON_FRI, False),
    (DAYTIME, hm(16, 18), MON_FRI, True),
    # Evening
    (DAYTIME, hm(18, 48), MON_FRI, False),
    (DAYTIME, hm(19, 18), MON_FRI, False),
    (DAYTIME, hm(19, 48), MON_FRI, True),
    # Night: Thursday, Friday, Saturday
    (NIGHT,   hm(21, 8),  THU_FRI_SAT, False),
    (NIGHT,   hm(21, 38), THU_FRI_SAT, False),
    (NIGHT,   hm(22, 8),  THU_FRI_SAT, False),
    (NIGHT,   hm(22, 38), THU_FRI_SAT, False),
    (NIGHT,   hm(23, 8),  THU_FRI_SAT, False),
    # Night: Friday and Saturday only (runs past midnight)
    (NIGHT,   hm(23, 38), FRI_SAT, False),
    (NIGHT,   hm(24, 8),  FRI_SAT, False),
    (NIGHT,   hm(24, 38), FRI_SAT, False),
]