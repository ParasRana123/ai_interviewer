import axios from "axios";

export async function getCodeforcesStats(handle: string) {
  const { data } = await axios.get(`https://codeforces.com/api/user.info?handles=${handle}`);
  return data.result[0];
}