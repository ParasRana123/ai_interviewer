import axios from "axios";

export async function getCodeforcesStats(handle: string) {
  try {
    const { data } = await axios.get(`https://codeforces.com/api/user.info?handles=${handle}`, {
      timeout: 5000,
    });
    return data?.result?.[0] || null;
  } catch (err: any) {
    console.warn(`Could not fetch Codeforces stats for ${handle}:`, err?.message || err);
    return null;
  }
}