import axios from "axios";

export async function getLeetcodeStats(username: string) {
    try {
        const query = `
        query {
          matchedUser(username: "${username}") {
            submitStats {
              acSubmissionNum {
                difficulty
                count
              }
            }
          }
        }
      `;

      const { data } = await axios.post(
        "https://leetcode.com/graphql",
        { query },
        {
          headers: {
            "Content-Type": "application/json",
            "Referer": "https://leetcode.com",
            "User-Agent": "Mozilla/5.0",
          },
          timeout: 5000,
        }
      );
      return data?.data?.matchedUser?.submitStats?.acSubmissionNum || data;
    } catch (err: any) {
        console.warn(`Could not fetch LeetCode stats for ${username}:`, err?.message || err);
        return null;
    }
}