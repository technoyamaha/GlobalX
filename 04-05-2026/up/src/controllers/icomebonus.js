
// Rank thresholds as per your structure
const RANKS = [
  { name: 'Bronze', required: 1000, monthly: 20 },
  { name: 'Silver', required: 2000, monthly: 40 },
  { name: 'Gold', required: 2000, monthly: 60 },
  { name: 'Platinum', required: 4000, monthly: 80 },
  { name: 'Diamond', required: 10000, monthly: 200 },
  { name: 'Emerald', required: 25000, monthly: 500 },
];

  
async function processUserRankRewards(userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Get total successful recharge
    const [rows] = await conn.query(
      `SELECT SUM(money) AS total FROM recharge WHERE phone = ? AND status = 1`,
      [userId]
    );
    const totalRecharge = rows[0].total || 0;

    // 2. Get ranks already achieved
    const [achieved] = await conn.query(
      `SELECT rank FROM user_rewards WHERE user_id = ?`,
      [userId]
    );
    const achievedRanks = achieved.map(r => r.rank);

    // 3. Determine new ranks to unlock based on sequential logic
    let remaining = totalRecharge;
    const newRanks = [];
    for (const rank of RANKS) {
      if (remaining >= rank.required && !achievedRanks.includes(rank.name)) {
        newRanks.push(rank);
        remaining -= rank.required;
      } else break;
    }

    if (newRanks.length === 0) {
      console.log("No new ranks achieved");
      await conn.rollback();
      return { totalRecharge, newRanks: [], addedMoney: 0 };
    }

    // 4. Calculate reward for all new ranks
    const addedMoney = newRanks.reduce((sum, r) => sum + r.monthly * 5, 0);
    await conn.query(
      `UPDATE users SET money = money + ? WHERE id = ?`,
      [addedMoney, userId]
    );

    // 5. Insert records into user_rewards table
    for (const rank of newRanks) {
      await conn.query(
        `INSERT INTO user_rewards (user_id, rank, monthly_reward, months, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [userId, rank.name, rank.monthly, 5]
      );
    }

    await conn.commit();
    console.log(
      `Processed user ${userId}. Rewards added: $${addedMoney}. Ranks unlocked: ${newRanks.map(r => r.name).join(', ')}`
    );

    return { totalRecharge, newRanks: newRanks.map(r => r.name), addedMoney };
  } catch (error) {
    await conn.rollback();
    console.error("Error processing rank rewards:", error);
    throw error;
  } finally {
    conn.release();
  }
}
