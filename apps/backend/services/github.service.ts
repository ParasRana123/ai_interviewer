import axios from "axios";

export async function getGithuStats(username: string) {
    try {
        const { data } = await axios.get(`https://api.github.com/users/${username}`, {
            headers: {
                "User-Agent": "AI-Interviewer-App",
                "Accept": "application/vnd.github.v3+json",
            },
            timeout: 5000,
        });
        return {
            followers: data.followers ?? 0,
            following: data.following ?? 0,
            repos: data.public_repos ?? data.repos ?? 0,
            bio: data.bio ?? null,
        };
    } catch (err: any) {
        console.warn(`Could not fetch GitHub stats for ${username}:`, err?.message || err);
        return null;
    }
}