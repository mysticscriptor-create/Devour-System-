# Dimensional Overseer — Reference Tables
> Quick-reference for all calculated systems in the Overseer database.

---

## 1. Core Reach → Vitals Allocation

*How rank value (RV) is distributed across the 5 vitals based on Core Reach.*

| Core Reach |         Main Vital (40% RV)         | Secondary Vital (25% RV) | Remaining 3 Vitals (11.67% RV each) |
| :--------: | :---------------------------------: | :----------------------: | :---------------------------------: |
| Substance  |              Vitality               |          Power           |      Speed, Perception, Energy      |
|   Force    |                Power                |          Speed           |    Vitality, Perception, Energy     |
|   Space    |             Perception              |          Energy          |       Power, Speed, Vitality        |
|    Mind    |             Perception              |          Energy          |       Power, Speed, Vitality        |
|    Soul    |              Vitality               |          Energy          |      Power, Speed, Perception       |
|    Time    |                Speed                |        Perception        |       Power, Vitality, Energy       |
|    Void    |               Energy                |        Perception        |       Power, Speed, Vitality        |
| **Origin** | **All 5 vitals get 20% RV equally** |            ←             |                  ←                  |

> **Formula:** Main = RV × 0.40 · Secondary = RV × 0.25 · Others = (RV × 0.35) ÷ 3

---

## 2. Vital Synergy Modifiers

*Each vital passively boosts other vitals based on its base value. Applied after base allocation, before boosts.*

| Vital Receiving Boost | Formula                                  | In Plain Terms                          |
|:---------------------:|:----------------------------------------:|:----------------------------------------|
| Power                 | +5% of Vitality + 2% of Energy           | Toughness & reserves push raw strength  |
| Speed                 | +3% of Power + 4% of Energy              | Strength & reserves improve agility     |
| Vitality              | +5% of Energy                            | Reserves reinforce durability           |
| Perception            | +4% of Energy                            | Reserves sharpen awareness              |
| Energy                | *(no synergy bonus)*                     | Energy is a pure base stat              |

> **Order of operations:** Base Vitals → Synergy Deltas → % Boosts (from traits/equipment)

---

## 3. Vital Calculation: Step-by-Step

| Step | What Happens                                                   |
|:----:|:---------------------------------------------------------------|
| 1    | Get Rank Value (RV) from rank table                            |
| 2    | Apply Core Reach allocation (40% / 25% / 11.67%)              |
| 3    | Calculate synergy deltas from base vitals                      |
| 4    | Add synergy deltas → Post-Synergy vitals                       |
| 5    | Apply % boost fields (pwr_boost, spd_boost, etc.)              |
| 6    | **Final Vital = Post-Synergy × (1 + boost% / 100)**           |

---

## 4. Core Potential — Ceiling & Kill Multiplier

*Potential defines how high a character can rank up and how efficiently they gain EU per run.*

| Potential | Max Rank Ceiling | Kill Limit Multiplier | Max Rank Index |
|:---------:|:----------------:|:---------------------:|:--------------:|
| F-Core    | D+++             | ×1.0 (baseline)       | 15             |
| E-Core    | C+++             | ×1.5                  | 20             |
| D-Core    | B+++             | ×2.0                  | 25             |
| C-Core    | A+++             | ×2.5                  | 30             |
| B-Core    | S+++             | ×3.0                  | 35             |
| A-Core    | SS+++            | ×3.75                 | 40             |
| S-Core    | SSS+++           | ×4.5                  | 44             |
| SS-Core   | SSS+++           | ×5.5                  | 44             |
| SSS-Core  | SSS+++           | ×6.5                  | 44             |

> The multiplier scales the daily kill cap per run. F-Core at D-tier gets the baseline; SSS-Core at the same tier can kill 6.5× as many per run.

---

## 5. Daily Kill Limit (Base) by Tier

*Maximum kills allowed per dungeon run at baseline (×1.0 multiplier). Multiply by potential mult for actual cap.*

| Rank Tier | Base Daily Kill Limit | With ×1.5 | With ×2.0 | With ×2.5 | With ×3.0 | With ×3.75 | With ×4.5 | With ×5.5 | With ×6.5 |
|:---------:|:---------------------:|:---------:|:---------:|:---------:|:---------:|:----------:|:---------:|:---------:|:---------:|
| Dormant   | 15                    | 22        | 30        | 37        | 45        | 56         | 67        | 82        | 97        |
| F         | 15                    | 22        | 30        | 37        | 45        | 56         | 67        | 82        | 97        |
| E         | 20                    | 30        | 40        | 50        | 60        | 75         | 90        | 110       | 130       |
| D         | 25                    | 37        | 50        | 62        | 75        | 93         | 112       | 137       | 162       |
| C         | 15                    | 22        | 30        | 37        | 45        | 56         | 67        | 82        | 97        |
| B         | 10                    | 15        | 20        | 25        | 30        | 37         | 45        | 55        | 65        |
| A         | 7                     | 10        | 14        | 17        | 21        | 26         | 31        | 38        | 45        |
| S         | 4                     | 6         | 8         | 10        | 12        | 15         | 18        | 22        | 26        |
| SS        | 4                     | 6         | 8         | 10        | 12        | 15         | 18        | 22        | 26        |
| SSS       | 4                     | 6         | 8         | 10        | 12        | 15         | 18        | 22        | 26        |

> *Values are floored (no partial kills). Minimum is always 1.*

---

## 6. Full Rank Table — All Sub-Phases

*Every rank, its Rank Value (power multiplier), EU earned per kill, and EU required to reach this rank.*

| Rank    | Tier    | Rank Value | EU / Kill | EU Required to Reach |
|:-------:|:-------:|:----------:|:---------:|:--------------------:|
| Dormant | Dormant | 3          | 3         | —                    |
| F−      | F       | 8          | 8         | —                    |
| F       | F       | 10         | 15        | 104,464              |
| F+      | F       | 13         | 22        | 104,464              |
| F++     | F       | 16         | 30        | 104,464              |
| F+++    | F       | 20         | 50        | 125,357              |
| E−      | E       | 21         | 60        | 125,357              |
| E       | E       | 30         | 80        | 1,035,714            |
| E+      | E       | 37         | 130       | 1,035,714            |
| E++     | E       | 44         | 170       | 1,035,714            |
| E+++    | E       | 50         | 200       | 1,242,857            |
| D−      | D       | 51         | 220       | 1,242,857            |
| D       | D       | 100        | 350       | 6,845,238            |
| D+      | D       | 160        | 500       | 6,845,238            |
| D++     | D       | 230        | 650       | 6,845,238            |
| D+++    | D       | 300        | 800       | 8,214,286            |
| C−      | C       | 301        | 900       | 8,214,286            |
| C       | C       | 800        | 1,400     | 38,333,333           |
| C+      | C       | 1,050      | 2,000     | 38,333,333           |
| C++     | C       | 1,250      | 2,600     | 38,333,333           |
| C+++    | C       | 1,500      | 3,200     | 46,000,000           |
| B−      | B       | 1,501      | 3,800     | 46,000,000           |
| B       | B       | 2,500      | 6,000     | 337,857,143          |
| B+      | B       | 2,900      | 9,000     | 337,857,143          |
| B++     | B       | 3,200      | 12,000    | 337,857,143          |
| B+++    | B       | 3,500      | 16,000    | 405,428,571          |
| A−      | A       | 3,501      | 20,000    | 405,428,571          |
| A       | A       | 5,000      | 35,000    | 3,571,428,571        |
| A+      | A       | 6,500      | 60,000    | 3,571,428,571        |
| A++     | A       | 8,000      | 90,000    | 3,571,428,571        |
| A+++    | A       | 10,000     | 115,000   | 4,285,714,286        |
| S−      | S       | 10,001     | 140,000   | 4,285,714,286        |
| S       | S       | 15,000     | 250,000   | 50,000,000,000       |
| S+      | S       | 25,000     | 450,000   | 50,000,000,000       |
| S++     | S       | 37,000     | 700,000   | 50,000,000,000       |
| S+++    | S       | 50,000     | 1,000,000 | 60,000,000,000       |
| SS−     | SS      | 50,001     | 1,300,000 | 60,000,000,000       |
| SS      | SS      | 70,000     | 2,500,000 | 982,142,857,143      |
| SS+     | SS      | 130,000    | 5,000,000 | 982,142,857,143      |
| SS++    | SS      | 210,000    | 8,000,000 | 982,142,857,143      |
| SS+++   | SS      | 300,000    | 12,000,000| 1,178,571,428,571    |
| SSS     | SSS     | 400,000    | 20,000,000| 17,261,904,761,905   |
| SSS+    | SSS     | 600,000    | 40,000,000| 17,261,904,761,905   |
| SSS++   | SSS     | 900,000    | 80,000,000| 17,261,904,761,905   |
| SSS+++  | SSS     | 1,500,000  | 150,000,000| 20,714,285,714,286  |

---

## 7. Kills Required Per Rank Transition (Baseline ×1.0)

*Kills = EU Required ÷ EU per Kill at the current rank. Actual runs depend on daily cap × potential.*

| Transition       | EU Required  | EU / Kill | Kills Needed | Base Runs (15/day) |
|:----------------:|:------------:|:---------:|:------------:|:------------------:|
| F− → F           | 104,464      | 8         | 13,058       | 871                |
| F → F+           | 104,464      | 15        | 6,964        | 465                |
| F+ → F++         | 104,464      | 22        | 4,748        | 317                |
| F++ → F+++       | 104,464      | 30        | 3,482        | 232                |
| F+++ → E−        | 125,357      | 50        | 2,507        | 167                |
| E− → E           | 125,357      | 60        | 2,089        | 139                |
| E → E+           | 1,035,714    | 80        | 12,946       | 648                |
| E+ → E++         | 1,035,714    | 130       | 7,967        | 399                |
| E++ → E+++       | 1,035,714    | 170       | 6,092        | 305                |
| E+++ → D−        | 1,242,857    | 200       | 6,214        | 311                |
| D− → D           | 1,242,857    | 220       | 5,649        | 226                |
| D → D+           | 6,845,238    | 350       | 19,558       | 783                |
| D+ → D++         | 6,845,238    | 500       | 13,691       | 548                |
| D++ → D+++       | 6,845,238    | 650       | 10,531       | 422                |
| D+++ → C−        | 8,214,286    | 800       | 10,268       | 411                |
| C− → C           | 8,214,286    | 900       | 9,127        | 608                |
| C → C+           | 38,333,333   | 1,400     | 27,381       | 1,826              |
| C+ → C++         | 38,333,333   | 2,000     | 19,167       | 1,278              |
| C++ → C+++       | 38,333,333   | 2,600     | 14,744       | 983                |
| C+++ → B−        | 46,000,000   | 3,200     | 14,375       | 958                |
| B− → B           | 46,000,000   | 3,800     | 12,105       | 1,211              |
| B → B+           | 337,857,143  | 6,000     | 56,310       | 5,631              |
| B+ → B++         | 337,857,143  | 9,000     | 37,540       | 3,754              |
| B++ → B+++       | 337,857,143  | 12,000    | 28,155       | 2,816              |
| B+++ → A−        | 405,428,571  | 16,000    | 25,339       | 2,534              |
| A− → A           | 405,428,571  | 20,000    | 20,272       | 2,896              |
| A → A+           | 3,571,428,571| 35,000    | 102,041      | 14,577             |
| A+ → A++         | 3,571,428,571| 60,000    | 59,524       | 8,503              |
| A++ → A+++       | 3,571,428,571| 90,000    | 39,683       | 5,669              |
| A+++ → S−        | 4,285,714,286| 115,000   | 37,267       | 5,324              |

---

## 8. Kills Required — S Through SSS (Baseline ×1.0)

| Transition       | EU Required      | EU / Kill  | Kills Needed    | Base Runs (4/day) |
|:----------------:|:----------------:|:----------:|:---------------:|:-----------------:|
| S− → S           | 4,285,714,286    | 140,000    | 30,612          | 7,653             |
| S → S+           | 50,000,000,000   | 250,000    | 200,000         | 50,000            |
| S+ → S++         | 50,000,000,000   | 450,000    | 111,111         | 27,778            |
| S++ → S+++       | 50,000,000,000   | 700,000    | 71,429          | 17,857            |
| S+++ → SS−       | 60,000,000,000   | 1,000,000  | 60,000          | 15,000            |
| SS− → SS         | 60,000,000,000   | 1,300,000  | 46,154          | 11,539            |
| SS → SS+         | 982,142,857,143  | 2,500,000  | 392,857         | 98,214            |
| SS+ → SS++       | 982,142,857,143  | 5,000,000  | 196,429         | 49,107            |
| SS++ → SS+++     | 982,142,857,143  | 8,000,000  | 122,768         | 30,692            |
| SS+++ → SSS      | 1,178,571,428,571| 12,000,000 | 98,214          | 24,554            |
| SSS → SSS+       | 17,261,904,761,905| 20,000,000| 863,095         | 215,774           |
| SSS+ → SSS++     | 17,261,904,761,905| 40,000,000| 431,548         | 107,887           |
| SSS++ → SSS+++   | 17,261,904,761,905| 80,000,000| 215,774         | 53,944            |

---

## 9. Timeline Analysis — Progression Speed Reference

*Based on the simulator's standard benchmark of 3 runs/week.*

| Scenario                                           | Interpretation                                        |
|:---------------------------------------------------|:------------------------------------------------------|
| Active years ≈ projected years (±50%)              | Normal progression — consistent 3 runs/week           |
| Active years < projected × 0.67                   | Accelerated — extreme dedication or faction backing   |
| Active years > projected × 2                      | Delayed — injury, downtime, or low-efficiency loops   |
| Runs/week > 3                                      | Requires institutional or faction backing             |
| Runs/week > 7                                      | Impossible (exceeds 7 days/week)                      |
| Target rank exceeds potential ceiling              | Hard cap — character cannot progress further          |

---

## 10. EU Number Format Reference

| Shorthand | Full Value              |
|:---------:|:-----------------------:|
| K         | × 1,000                 |
| M         | × 1,000,000             |
| B         | × 1,000,000,000         |
| T         | × 1,000,000,000,000     |

---

## 11. Quick Vitals Example — Force Core at D Rank (RV 100)

| Vital       | Allocation | Base Value | Synergy Bonus        | Post-Synergy |
|:-----------:|:----------:|:----------:|:--------------------:|:------------:|
| Power       | 40% RV     | 40.00      | +5% Vit + 2% Energy  | ≈ 41.52      |
| Speed       | 25% RV     | 25.00      | +3% Pwr + 4% Energy  | ≈ 26.39      |
| Vitality    | 11.67% RV  | 11.67      | +5% Energy           | ≈ 12.25      |
| Perception  | 11.67% RV  | 11.67      | +4% Energy           | ≈ 12.15      |
| Energy      | 11.67% RV  | 11.67      | *(none)*             | 11.67        |

> Final values further scaled by any % boost fields on the character file.

---

*Source: Dimensional Overseer v6.5 — all values reverse-engineered from `RANKS`, `POTENTIALS`, `MAX_DAILY_LIMITS`, and `calculateVitals()` logic.*
