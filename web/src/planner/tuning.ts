// Every tunable number in the planner. See the spec, sections 2 and 3.

export const STARTING_TOKENS = 650;

// Value
export const POOL_PER_WEIGHT = 100; // value per requirement weight point
export const TASK_SHARE = 0.7; // part of the pool shared among a requirement's tasks
export const FINISH_SHARE = 0.3; // part paid when the requirement's last task is done
export const UNBLOCK_BONUS_PER_TASK = 0.15;
export const UNBLOCK_BONUS_MAX = 0.6;
export const NEGLECT_BONUS_START_DAYS = 5; // bonus counts idle days beyond this
export const NEGLECT_BONUS_PER_DAY = 0.05;
export const NEGLECT_BONUS_MAX = 0.5;
export const RECOVERY_NEGLECT_FACTOR = 2; // neglect bonus (and its max) while Recovering
export const DAILY_FULL_PAY_COUNT = 5; // paid completions per local day at full pay
export const DAILY_DECAY = 0.8;
export const DAILY_FLOOR = 0.25;
export const TOKENS_PER_VALUE = 0.3;
export const SICK_TOKEN_MULTIPLIER = 0.5;

// Neglect and sickness
export const NEGLECT_DAYS = 7;
export const SICK_DAYS = 14;
export const RECOVERY_DAYS = 3;

// Mood thresholds, in percentage points of schedule gap
export const DELIGHTED_GAP = 10; // gap >= this
export const WORRIED_GAP = -10; // gap <= this is Worried or worse
export const UPSET_GAP = -25; // gap <= this is Upset

// Learning
export const LEARNING_MAX_SAMPLES = 20;
export const LEARNING_PRIOR_SAMPLES = 5;
export const LEARNING_MIN_SAMPLES_SHOWN = 3;
export const MULTIPLIER_MIN = 0.5;
export const MULTIPLIER_MAX = 3;

// Pet lifecycle
export const HATCH_REQUIREMENTS = 3; // an egg hatches once its project has this many requirements
export const JUVENILE_SCALE = 0.75; // juveniles are drawn at this fraction of the adult size

// Misc
export const SUGGESTED_COUNT = 6;
export const MEDICINE_PRODUCT_ID = "medicine";
export const MEDICINE_PRICE = 80;
export const DEFAULT_ESTIMATE_MIN = 60;
