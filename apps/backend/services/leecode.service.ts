import axios from "axios"

export async function getLeetcodeStats(username: string) {
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

  const { data } = await axios.post("https://leetcode.com/graphql" , { query });
  return data;
}