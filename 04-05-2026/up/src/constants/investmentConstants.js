export const NORMAL_INVESTMENT_TYPE = "normal";
export const REINVESTMENT_TYPE = "reinvestment";

export const MINIMUM_INVESTMENT_AMOUNT = 50;
export const MINIMUM_REINVESTMENT_AMOUNT = 10;

export const REINVESTMENT_DAILY_PERCENT = 3.5;

export const SIGNUP_BONUS_AMOUNT = 100;
export const SIGNUP_BONUS_MIN_ACTIVATION = 50;

export const WITHDRAWAL_FEE_PERCENT = 5;
export const MINIMUM_WITHDRAWAL_AMOUNT = 10;

export const MINIMUM_DEPOSIT_FOR_ACTIVATION = 50;
export const SIGNUP_BONUS_DAILY_INCOME = 0.5;

export const downlinePercent = [
  { level: 1, percent: 15 },
  { level: 2, percent: 10 },
  { level: 3, percent: 5 },
  { level: 4, percent: 3 },
  { level: 5, percent: 2 },
  { level: 6, percent: 1 },
];

export const FASTTRACK_DIRECT_REQUIRED = 10;
export const FASTTRACK_DAYS_LIMIT = 7;

export const leadershipRewards = [
  {
    rankLevel: 1,
    name: "GlobalX Leader",
    businessRequired: 10000,
    oneTimeReward: 200,
    monthlyReward: 100,
  },
  {
    rankLevel: 2,
    name: "GlobalX Elite",
    businessRequired: 20000,
    oneTimeReward: 400,
    monthlyReward: 200,
  },
  {
    rankLevel: 3,
    name: "GlobalX Crown",
    businessRequired: 40000,
    oneTimeReward: 800,
    monthlyReward: 400,
  },
  {
    rankLevel: 4,
    name: "GlobalX Prime",
    businessRequired: 80000,
    oneTimeReward: 1600,
    monthlyReward: 800,
  },
  {
    rankLevel: 5,
    name: "GlobalX Star",
    businessRequired: 150000,
    oneTimeReward: 3000,
    monthlyReward: 1500,
  },
  {
    rankLevel: 6,
    name: "GlobalX Pro",
    businessRequired: 300000,
    oneTimeReward: 6000,
    monthlyReward: 3000,
  },
  {
    rankLevel: 7,
    name: "GlobalX Max",
    businessRequired: 1000000,
    oneTimeReward: 20000,
    monthlyReward: 10000,
  },
];
